// 收款与核销（规则见 docs/data-model.md §3.2）
import { prisma } from '../db/prisma.js'
import { bad } from '../common/errors.js'
import { D, yuan } from '../common/money.js'
import { toDate } from '../common/utils.js'
import { PAYMENT_METHOD, valuesOf } from '../common/constants.js'
import { nextPaymentNo } from './numbering.js'
import { billAmounts, paymentVO } from './serialize.js'
import { applyFlow } from './accounts.js'
import { ACCOUNT_TYPE } from '../common/constants.js'

export const PAYMENT_INCLUDE = {
  room: { include: { community: true, building: true } },
  allocations: { include: { bill: { include: { feeItem: true } } } }
}

/** 核销顺序：应缴日升序（为空排最后），再按 id 升序 */
function sortForAllocation(bills) {
  return [...bills].sort((a, b) => {
    const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
    if (left !== right) return left - right
    return a.id - b.id
  })
}

/** 某房屋当前欠费合计 */
export async function roomArrears(tx, roomId) {
  const client = tx || prisma
  const bills = await client.bill.findMany({
    where: { roomId: Number(roomId), status: { not: 'VOID' } },
    select: { amount: true, discount: true, lateFee: true, paidAmount: true }
  })
  return bills.reduce((acc, row) => {
    const { arrears } = billAmounts(row)
    return arrears.isNegative() ? acc : acc.plus(arrears)
  }, D(0))
}

export async function findPayment(id) {
  const row = await prisma.payment.findUnique({ where: { id: Number(id) }, include: PAYMENT_INCLUDE })
  if (!row) bad('收款单不存在')
  return { ...paymentVO(row), allocations: row.allocations.map((item) => ({
    billId: item.billId,
    billNo: item.bill.billNo,
    period: item.bill.period,
    feeItemName: item.bill.feeItem?.name,
    amount: yuan(item.amount)
  })) }
}

/**
 * 登记收款并自动核销。返回结构见 docs/api.md §2.4。
 */
export async function createPayment(payload, operator) {
  const roomId = Number(payload.roomId)
  if (!roomId) bad('请选择房屋')
  const amount = D(payload.amount)
  if (amount.lessThanOrEqualTo(0)) bad('收款金额必须大于 0')

  const method = String(payload.method || '')
  if (!valuesOf(PAYMENT_METHOD).includes(method)) bad('收款方式不正确')

  const room = await prisma.room.findUnique({ where: { id: roomId } })
  if (!room) bad('房屋不存在')

  const paidAt = toDate(payload.paidAt) || new Date()
  const billIds = Array.isArray(payload.billIds)
    ? payload.billIds.map(Number).filter((n) => !Number.isNaN(n))
    : []

  return prisma.$transaction(async (tx) => {
    const day = paidAt.toISOString().slice(0, 10)
    const payment = await tx.payment.create({
      data: {
        paymentNo: await nextPaymentNo(tx, day),
        communityId: room.communityId,
        roomId,
        amount: amount.toDecimalPlaces(2),
        method,
        channel: payload.channel || 'COUNTER',
        bizType: 'BILL',
        paidAt,
        operator,
        remark: payload.remark ? String(payload.remark).slice(0, 255) : null
      }
    })

    const candidates = await tx.bill.findMany({
      where: billIds.length
        ? { id: { in: billIds }, roomId, status: { not: 'VOID' } }
        : { roomId, status: { in: ['UNPAID', 'PARTIAL'] } }
    })

    // 指定账单时保持传入顺序；自动核销时按应缴日排序
    const ordered = billIds.length
      ? billIds.map((id) => candidates.find((bill) => bill.id === id)).filter(Boolean)
      : sortForAllocation(candidates)

    let remaining = amount
    const allocations = []

    for (const bill of ordered) {
      if (remaining.lessThanOrEqualTo(0)) break
      const { net, paid } = billAmounts(bill)
      const due = net.minus(paid)
      if (due.lessThanOrEqualTo(0)) continue

      const alloc = due.lessThan(remaining) ? due : remaining
      const newPaid = paid.plus(alloc)
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaid.toDecimalPlaces(2),
          status: newPaid.greaterThanOrEqualTo(net) ? 'PAID' : 'PARTIAL'
        }
      })
      await tx.paymentAllocation.create({
        data: { paymentId: payment.id, billId: bill.id, amount: alloc.toDecimalPlaces(2) }
      })
      allocations.push({
        billId: bill.id,
        billNo: bill.billNo,
        period: bill.period,
        amount: yuan(alloc)
      })
      remaining = remaining.minus(alloc)
    }

    const allocated = amount.minus(remaining)
    const arrears = await roomArrears(tx, roomId)

    // 未核销完的部分进预收余额（单一数据源：wye_room_account + wye_fund_flow）
    let advanceBalance = null
    if (remaining.greaterThan(0)) {
      const { balanceAfter } = await applyFlow(tx, {
        roomId,
        accountType: ACCOUNT_TYPE.ADVANCE,
        direction: 'IN',
        bizType: 'PAYMENT_ADVANCE',
        amount: remaining,
        refType: 'PAYMENT',
        refId: payment.id,
        operator,
        remark: '收款未核销部分转预收',
        occurredAt: paidAt
      })
      advanceBalance = yuan(balanceAfter)
    }

    return {
      paymentId: payment.id,
      paymentNo: payment.paymentNo,
      amount: yuan(amount),
      allocatedAmount: yuan(allocated),
      advanceAmount: yuan(remaining.isNegative() ? D(0) : remaining),
      advanceBalance,
      allocations,
      roomArrearsAfter: yuan(arrears)
    }
  })
}

export default createPayment
