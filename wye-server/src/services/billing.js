// 账单业务：批量生成、减免调整、作废（规则见 docs/data-model.md §3）
import { prisma } from '../db/prisma.js'
import { bad } from '../common/errors.js'
import { D, multiply, yuan } from '../common/money.js'
import { assertPeriod, defaultDueDate, toDate } from '../common/utils.js'
import { nextBillNo } from './numbering.js'
import { billVO } from './serialize.js'

const MAX_SKIP_REASONS = 30
const BILL_INCLUDE = { room: { include: { community: true, building: true } }, feeItem: true }

/** 按 房屋 × 收费项目 判定计费数量；返回 null 表示需要跳过 */
function resolveQuantity(room, feeItem, readingMap) {
  switch (feeItem.chargeMode) {
    case 'AREA': {
      const area = D(room.area)
      if (area.lessThanOrEqualTo(0)) return { error: '房屋面积未维护' }
      return { quantity: area }
    }
    case 'UNIT':
    case 'FIXED':
      return { quantity: D(1) }
    case 'METER': {
      const reading = readingMap.get(`${room.id}:${feeItem.id}`)
      if (!reading) return { error: '该账期无抄表记录' }
      if (D(reading.usageQty).lessThanOrEqualTo(0)) return { error: '该账期用量为 0' }
      return { quantity: D(reading.usageQty) }
    }
    default:
      return { error: `计费方式 ${feeItem.chargeMode} 暂不支持` }
  }
}

/**
 * 批量生成账单。
 * @returns {{generated:number,skipped:number,totalAmount:number,skipReasons:Array}}
 */
export async function generateBills({ period, communityId, buildingId, feeItemIds, roomIds, overwrite = false }) {
  if (!assertPeriod(period)) bad('账期格式不正确，应为 yyyy-MM')

  const cid = communityId ? Number(communityId) : null
  const bid = buildingId ? Number(buildingId) : null
  const ids = Array.isArray(feeItemIds) ? feeItemIds.map(Number).filter((n) => !Number.isNaN(n)) : []
  // roomIds 为内部用途（演示数据/单测），用于限定只给指定房屋生成
  const onlyRoomIds = Array.isArray(roomIds) ? roomIds.map(Number).filter((n) => !Number.isNaN(n)) : []

  const feeItems = await prisma.feeItem.findMany({
    where: {
      enabled: true,
      ...(ids.length ? { id: { in: ids } } : {}),
      OR: [{ communityId: null }, ...(cid ? [{ communityId: cid }] : [])]
    },
    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }]
  })
  if (!feeItems.length) bad('没有可用的收费项目，请先在「收费项目」中启用')

  const rooms = await prisma.room.findMany({
    where: {
      ...(cid ? { communityId: cid } : {}),
      ...(bid ? { buildingId: bid } : {}),
      ...(onlyRoomIds.length ? { id: { in: onlyRoomIds } } : {})
    },
    orderBy: [{ buildingId: 'asc' }, { roomNo: 'asc' }]
  })
  if (!rooms.length) bad('所选范围内没有房屋，请先维护基础资料')

  const targetRoomIds = rooms.map((room) => room.id)
  const [existing, readings] = await Promise.all([
    prisma.bill.findMany({
      where: { period: String(period), status: { not: 'VOID' }, roomId: { in: targetRoomIds } },
      select: { id: true, roomId: true, feeItemId: true, paidAmount: true }
    }),
    prisma.meterReading.findMany({
      where: { period: String(period), roomId: { in: targetRoomIds } },
      select: { roomId: true, feeItemId: true, usageQty: true }
    })
  ])

  const existingMap = new Map(existing.map((row) => [`${row.roomId}:${row.feeItemId}`, row]))
  const readingMap = new Map(readings.map((row) => [`${row.roomId}:${row.feeItemId}`, row]))

  const skipReasons = []
  const skip = (room, feeItem, reason) => {
    if (skipReasons.length < MAX_SKIP_REASONS) {
      skipReasons.push({ roomNo: room.roomNo, feeItem: feeItem.name, reason })
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    let generated = 0
    let skipped = 0
    let total = D(0)

    for (const room of rooms) {
      for (const feeItem of feeItems) {
        const key = `${room.id}:${feeItem.id}`
        const previous = existingMap.get(key)

        if (previous && !overwrite) {
          skipped += 1
          skip(room, feeItem, '该账期账单已存在')
          continue
        }
        if (previous && D(previous.paidAmount).greaterThan(0)) {
          skipped += 1
          skip(room, feeItem, '已有收款记录，不能覆盖生成')
          continue
        }

        const { quantity, error } = resolveQuantity(room, feeItem, readingMap)
        if (error) {
          skipped += 1
          skip(room, feeItem, error)
          continue
        }

        if (previous) {
          await tx.bill.update({
            where: { id: previous.id },
            data: { status: 'VOID', voidReason: '账单重新生成' }
          })
        }

        const amount = multiply(quantity, feeItem.unitPrice)
        await tx.bill.create({
          data: {
            billNo: await nextBillNo(tx, period),
            communityId: room.communityId,
            roomId: room.id,
            feeItemId: feeItem.id,
            period: String(period),
            chargeMode: feeItem.chargeMode,
            quantity,
            unitPrice: D(feeItem.unitPrice),
            amount,
            discount: D(0),
            paidAmount: D(0),
            status: 'UNPAID',
            dueDate: toDate(defaultDueDate(period)),
            generatedAt: new Date()
          }
        })
        generated += 1
        total = total.plus(amount)
      }
    }
    return { generated, skipped, totalAmount: yuan(total), skipReasons }
  })

  return result
}

/** 调整账单：只允许改减免与应缴日，且净额不得低于已收 */
export async function adjustBill(id, payload) {
  const bill = await prisma.bill.findUnique({ where: { id: Number(id) } })
  if (!bill) bad('账单不存在')
  if (bill.status === 'VOID') bad('该账单已作废，不能调整')

  const data = {}
  if (payload.discount !== undefined && payload.discount !== null) {
    const discount = D(payload.discount)
    if (discount.isNegative()) bad('减免金额不能为负数')
    const net = D(bill.amount).minus(discount)
    if (net.lessThan(D(bill.paidAmount))) {
      bad(`减免后金额不能低于已收金额 ${yuan(bill.paidAmount)} 元`)
    }
    data.discount = discount.toDecimalPlaces(2)
  }
  if (payload.dueDate !== undefined) {
    data.dueDate = toDate(payload.dueDate)
  }
  if (payload.remark !== undefined) {
    data.remark = payload.remark ? String(payload.remark).slice(0, 255) : null
  }
  if (!Object.keys(data).length) bad('没有需要修改的内容')

  const updated = await prisma.bill.update({
    where: { id: bill.id },
    data,
    include: BILL_INCLUDE
  })
  return billVO(updated)
}

/** 作废账单：必须填原因，有核销记录不允许作废 */
export async function voidBill(id, reason) {
  const text = String(reason || '').trim()
  if (!text) bad('请填写作废原因')

  const bill = await prisma.bill.findUnique({ where: { id: Number(id) } })
  if (!bill) bad('账单不存在')
  if (bill.status === 'VOID') bad('该账单已作废')
  if (D(bill.paidAmount).greaterThan(0)) {
    bad('该账单已有收款记录，请先处理对应收款单')
  }

  const updated = await prisma.bill.update({
    where: { id: bill.id },
    data: { status: 'VOID', voidReason: text.slice(0, 255) },
    include: BILL_INCLUDE
  })
  return billVO(updated)
}

export { BILL_INCLUDE }
