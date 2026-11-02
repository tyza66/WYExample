// 资金账户（预收余额 / 押金余额）与资金流水
// 口径见 docs/data-model.md §3.10：余额只能由流水推导，不允许直接改余额；余额不可为负。
import { prisma } from '../db/prisma.js'
import { D, yuan } from '../common/money.js'
import { bad } from '../common/errors.js'
import { allowedCommunityIds, communityFilter } from '../common/scope.js'
import { pageParams, now, toDate, dateStr } from '../common/utils.js'
import { nextPaymentNo } from './numbering.js'
import { recordLog } from './log.js'
import { accountVO, flowVO, netOf } from './serialize.js'
import { ACCOUNT_TYPE, PAYMENT_METHOD, values } from '../common/constants.js'

const isOneOf = (dict, value) => Object.values(dict).includes(value)

/** 取（或建）房屋资金账户 */
export async function getOrCreateAccount(client, roomId) {
  const db = client || prisma
  const exists = await db.roomAccount.findUnique({ where: { roomId } })
  if (exists) return exists
  return db.roomAccount.create({ data: { roomId } })
}

/**
 * 记一笔资金流水并更新余额。
 * @param client 事务客户端（强烈建议在事务里调用）
 * @param payload.accountType ADVANCE | DEPOSIT
 * @param payload.direction IN 收入 | OUT 支出
 */
export async function applyFlow(client, payload) {
  const db = client || prisma
  const { roomId, accountType, direction, bizType } = payload
  const amount = D(payload.amount)
  if (!isOneOf(ACCOUNT_TYPE, accountType)) bad('资金账户类型不正确')
  if (direction !== 'IN' && direction !== 'OUT') bad('资金流水方向不正确')
  if (amount.lte(0)) bad('资金变动金额必须大于 0')

  const account = await getOrCreateAccount(db, Number(roomId))
  const field = accountType === ACCOUNT_TYPE.ADVANCE ? 'advanceBalance' : 'depositBalance'
  const before = D(account[field])
  const after = direction === 'IN' ? before.plus(amount) : before.minus(amount)
  if (after.isNegative()) {
    bad(`${accountType === ACCOUNT_TYPE.ADVANCE ? '预收余额' : '押金余额'}不足，当前可用 ${yuan(before)} 元`)
  }

  await db.roomAccount.update({ where: { id: account.id }, data: { [field]: after } })
  const flow = await db.fundFlow.create({
    data: {
      roomId: Number(roomId),
      accountType,
      direction,
      amount,
      balanceAfter: after,
      bizType,
      refType: payload.refType ?? null,
      refId: payload.refId ?? null,
      operator: payload.operator ?? null,
      remark: payload.remark ?? null,
      occurredAt: payload.occurredAt ? toDate(payload.occurredAt) : now()
    }
  })
  return { flow, balanceAfter: after }
}

/** 收取押金：生成一张 bizType=DEPOSIT 的收款单 + 押金流水 */
export async function deposit(request, payload) {
  const room = await prisma.room.findUnique({ where: { id: Number(payload.roomId) } })
  if (!room) bad('房屋不存在')
  const amount = D(payload.amount)
  if (amount.lte(0)) bad('押金金额必须大于 0')
  if (!isOneOf(PAYMENT_METHOD, payload.method)) bad('收款方式不正确')
  const paidAt = payload.paidAt ? toDate(payload.paidAt) : now()
  const operator = request.user?.username || 'system'

  const result = await prisma.$transaction(async (tx) => {
    const paymentNo = await nextPaymentNo(tx, dateStr(paidAt).replace(/-/g, ''))
    const payment = await tx.payment.create({
      data: {
        paymentNo,
        communityId: room.communityId,
        roomId: room.id,
        amount,
        method: payload.method,
        channel: 'COUNTER',
        bizType: 'DEPOSIT',
        paidAt,
        operator,
        remark: payload.remark ? `押金：${payload.remark}` : '押金'
      }
    })
    const { balanceAfter } = await applyFlow(tx, {
      roomId: room.id,
      accountType: ACCOUNT_TYPE.DEPOSIT,
      direction: 'IN',
      bizType: 'DEPOSIT_IN',
      amount,
      refType: 'PAYMENT',
      refId: payment.id,
      operator,
      remark: payload.remark || '收取押金',
      occurredAt: paidAt
    })
    return { payment, balanceAfter }
  })

  await recordLog(request, {
    module: '资金',
    action: '收取押金',
    target: result.payment.paymentNo,
    detail: `${room.roomNo} 收押金 ${yuan(amount)} 元，押金余额 ${yuan(result.balanceAfter)} 元`
  })
  return {
    paymentId: result.payment.id,
    paymentNo: result.payment.paymentNo,
    amount: yuan(amount),
    depositBalance: yuan(result.balanceAfter)
  }
}

/** 预收抵扣：用预收余额核销该户欠费账单 */
export async function useAdvance(request, payload) {
  const room = await prisma.room.findUnique({ where: { id: Number(payload.roomId) } })
  if (!room) bad('房屋不存在')
  const account = await getOrCreateAccount(prisma, room.id)
  const balance = D(account.advanceBalance)
  if (balance.lte(0)) bad('该房屋没有可用的预收余额')

  const where = { roomId: room.id, status: { not: 'VOID' } }
  if (Array.isArray(payload.billIds) && payload.billIds.length) {
    where.id = { in: payload.billIds.map(Number) }
  }
  const bills = await prisma.bill.findMany({ where, orderBy: [{ dueDate: 'asc' }, { id: 'asc' }] })
  const targets = bills.filter((bill) => netOf(bill).minus(D(bill.paidAmount)).gt(0))
  if (!targets.length) bad('该房屋没有欠费账单，无需抵扣')

  const cap = payload.amount === undefined || payload.amount === null || payload.amount === '' ? balance : D(payload.amount)
  if (cap.lte(0)) bad('抵扣金额必须大于 0')
  const limit = cap.gt(balance) ? balance : cap

  const operator = request.user?.username || 'system'
  const at = now()
  const result = await prisma.$transaction(async (tx) => {
    const paymentNo = await nextPaymentNo(tx, dateStr(at).replace(/-/g, ''))
    const payment = await tx.payment.create({
      data: {
        paymentNo,
        communityId: room.communityId,
        roomId: room.id,
        amount: limit,
        method: 'BALANCE',
        channel: 'COUNTER',
        bizType: 'ADVANCE_USE',
        paidAt: at,
        operator,
        remark: payload.remark || '预收余额抵扣'
      }
    })

    let remaining = limit
    const allocations = []
    for (const bill of targets) {
      if (remaining.lte(0)) break
      const due = netOf(bill).minus(D(bill.paidAmount))
      if (due.lte(0)) continue
      const alloc = due.lt(remaining) ? due : remaining
      const paid = D(bill.paidAmount).plus(alloc)
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: paid,
          status: paid.gte(netOf(bill)) ? 'PAID' : 'PARTIAL'
        }
      })
      await tx.paymentAllocation.create({ data: { paymentId: payment.id, billId: bill.id, amount: alloc } })
      allocations.push({ billId: bill.id, billNo: bill.billNo, period: bill.period, amount: yuan(alloc) })
      remaining = remaining.minus(alloc)
    }
    const used = limit.minus(remaining)
    // 没用完的部分退回预收余额（理论上不会发生，保底）
    const { balanceAfter } = await applyFlow(tx, {
      roomId: room.id,
      accountType: ACCOUNT_TYPE.ADVANCE,
      direction: 'OUT',
      bizType: 'ADVANCE_USE',
      amount: used,
      refType: 'PAYMENT',
      refId: payment.id,
      operator,
      remark: payload.remark || '预收余额抵扣',
      occurredAt: at
    })
    return { payment, used, allocations, balanceAfter }
  })

  await recordLog(request, {
    module: '资金',
    action: '预收抵扣',
    target: result.payment.paymentNo,
    detail: `${room.roomNo} 抵扣 ${yuan(result.used)} 元，剩余预收 ${yuan(result.balanceAfter)} 元`
  })
  return {
    paymentId: result.payment.id,
    paymentNo: result.payment.paymentNo,
    usedAmount: yuan(result.used),
    remainingAdvance: yuan(result.balanceAfter),
    allocations: result.allocations
  }
}

/** 退款（预收 / 押金）：必须携带已通过的审批单 */
export async function refund(request, payload) {
  const room = await prisma.room.findUnique({ where: { id: Number(payload.roomId) } })
  if (!room) bad('房屋不存在')
  const amount = D(payload.amount)
  if (amount.lte(0)) bad('退款金额必须大于 0')
  const accountType = payload.accountType
  if (!isOneOf(ACCOUNT_TYPE, accountType)) bad('资金账户类型不正确')
  const label = accountType === ACCOUNT_TYPE.ADVANCE ? '预收余额' : '押金'

  const approval = await prisma.approval.findFirst({
    where: {
      approvalNo: String(payload.approvalNo || ''),
      status: 'APPROVED',
      type: accountType === ACCOUNT_TYPE.ADVANCE ? 'ADVANCE_REFUND' : 'DEPOSIT_REFUND'
    }
  })
  if (!approval) bad('退款需先提交审批，且审批通过后才能执行')
  if (Number(approval.roomId) !== room.id) bad('审批单与房屋不匹配')
  if (D(approval.amount).lt(amount)) bad(`审批金额 ${yuan(approval.amount)} 元小于本次退款金额`)

  const operator = request.user?.username || 'system'
  const at = now()
  const result = await prisma.$transaction(async (tx) => {
    const { flow, balanceAfter } = await applyFlow(tx, {
      roomId: room.id,
      accountType,
      direction: 'OUT',
      bizType: accountType === ACCOUNT_TYPE.ADVANCE ? 'ADVANCE_REFUND' : 'DEPOSIT_REFUND',
      amount,
      refType: 'APPROVAL',
      refId: approval.id,
      operator,
      remark: payload.remark || `退还${label}`,
      occurredAt: at
    })
    await tx.approval.update({
      where: { id: approval.id },
      data: { targetType: 'FUND_FLOW', targetId: flow.id, payload: JSON.stringify({ executedAt: dateStr(at) }) }
    })
    return { flow, balanceAfter }
  })

  await recordLog(request, {
    module: '资金',
    action: '退款',
    target: approval.approvalNo,
    detail: `${room.roomNo} 退还${label} ${yuan(amount)} 元（方式 ${payload.method}），剩余 ${yuan(result.balanceAfter)} 元`
  })
  return {
    approvalNo: approval.approvalNo,
    roomId: room.id,
    accountType,
    refundAmount: yuan(amount),
    balanceAfter: yuan(result.balanceAfter)
  }
}

/** 批量取业主（在住 & 业主类型优先） */
async function ownersOf(roomIds) {
  if (!roomIds.length) return new Map()
  const rows = await prisma.resident.findMany({
    where: { roomId: { in: roomIds }, status: 'LIVING' },
    orderBy: [{ residentType: 'asc' }, { id: 'asc' }]
  })
  const map = new Map()
  for (const row of rows) {
    const current = map.get(row.roomId)
    // OWNER < TENANT < FAMILY 的字典序恰好让业主排在最前
    if (!current) map.set(row.roomId, row)
  }
  return map
}

/** 批量算欠费（按房屋） */
async function arrearsOf(roomIds) {
  if (!roomIds.length) return new Map()
  const bills = await prisma.bill.findMany({
    where: { roomId: { in: roomIds }, status: { not: 'VOID' } },
    select: { roomId: true, amount: true, discount: true, lateFee: true, paidAmount: true }
  })
  const map = new Map()
  for (const bill of bills) {
    const left = netOf(bill).minus(D(bill.paidAmount))
    if (left.lte(0)) continue
    map.set(bill.roomId, (map.get(bill.roomId) || D(0)).plus(left))
  }
  return map
}

/** 资金账户列表 */
export async function listAccounts(request, query = {}) {
  const ids = await allowedCommunityIds(request)
  const { page, size } = pageParams(query)
  const where = {
    ...communityFilter(ids),
    ...(query.communityId ? { communityId: Number(query.communityId) } : {}),
    ...(query.buildingId ? { buildingId: Number(query.buildingId) } : {}),
    ...(query.roomId ? { id: Number(query.roomId) } : {})
  }
  if (query.keyword) {
    const keyword = String(query.keyword)
    const hitRooms = await prisma.resident.findMany({
      where: { name: { contains: keyword } },
      select: { roomId: true }
    })
    where.OR = [{ roomNo: { contains: keyword } }, { id: { in: hitRooms.map((row) => row.roomId) } }]
  }

  const rooms = await prisma.room.findMany({
    where,
    include: { community: true, building: true },
    orderBy: [{ buildingId: 'asc' }, { roomNo: 'asc' }]
  })
  const roomIds = rooms.map((room) => room.id)
  const [accounts, owners, arrears] = await Promise.all([
    roomIds.length ? prisma.roomAccount.findMany({ where: { roomId: { in: roomIds } } }) : [],
    ownersOf(roomIds),
    arrearsOf(roomIds)
  ])
  const accountMap = new Map(accounts.map((row) => [row.roomId, row]))

  let list = rooms.map((room) =>
    accountVO({
      roomId: room.id,
      roomNo: room.roomNo,
      communityId: room.communityId,
      communityName: room.community?.name,
      buildingName: room.building?.name,
      ownerName: owners.get(room.id)?.name || '未登记',
      ownerPhone: owners.get(room.id)?.phone,
      advanceBalance: accountMap.get(room.id)?.advanceBalance || 0,
      depositBalance: accountMap.get(room.id)?.depositBalance || 0,
      arrears: arrears.get(room.id) || 0
    })
  )
  if (String(query.nonzero) === 'true') {
    list = list.filter((row) => row.advanceBalance !== 0 || row.depositBalance !== 0 || row.arrears !== 0)
  }
  const total = list.length
  const summary = {
    advanceTotal: yuan(list.reduce((acc, row) => acc.plus(D(row.advanceBalance)), D(0))),
    depositTotal: yuan(list.reduce((acc, row) => acc.plus(D(row.depositBalance)), D(0))),
    arrearsTotal: yuan(list.reduce((acc, row) => acc.plus(D(row.arrears)), D(0)))
  }
  return { list: list.slice((page - 1) * size, page * size), total, page, size, summary }
}

/** 单户账户详情（余额 + 最近流水） */
export async function accountDetail(roomId) {
  const room = await prisma.room.findUnique({
    where: { id: Number(roomId) },
    include: { community: true, building: true }
  })
  if (!room) bad('房屋不存在')
  const account = await getOrCreateAccount(prisma, room.id)
  const [owners, arrears, flows] = await Promise.all([
    ownersOf([room.id]),
    arrearsOf([room.id]),
    prisma.fundFlow.findMany({ where: { roomId: room.id }, orderBy: { id: 'desc' }, take: 50 })
  ])
  const owner = owners.get(room.id)
  return {
    account: accountVO({
      roomId: room.id,
      roomNo: room.roomNo,
      communityId: room.communityId,
      communityName: room.community?.name,
      buildingName: room.building?.name,
      ownerName: owner?.name || '未登记',
      ownerPhone: owner?.phone,
      advanceBalance: account.advanceBalance,
      depositBalance: account.depositBalance,
      arrears: arrears.get(room.id) || 0
    }),
    flows: flows.map((row) => flowVO({ ...row, roomNo: room.roomNo, communityName: room.community?.name, buildingName: room.building?.name }))
  }
}

/** 资金流水列表 */
export async function listFlows(request, query = {}) {
  const ids = await allowedCommunityIds(request)
  const { page, size, skip, take } = pageParams(query)
  let roomIds = null
  if (ids !== null) {
    const rooms = await prisma.room.findMany({ where: communityFilter(ids), select: { id: true } })
    roomIds = rooms.map((room) => room.id)
  }
  const where = {
    ...(roomIds ? { roomId: { in: roomIds.length ? roomIds : [-1] } } : {}),
    ...(query.roomId ? { roomId: Number(query.roomId) } : {}),
    ...(query.accountType ? { accountType: query.accountType } : {}),
    ...(query.bizType ? { bizType: query.bizType } : {})
  }
  if (query.from || query.to) {
    where.occurredAt = {}
    if (query.from) where.occurredAt.gte = toDate(query.from)
    if (query.to) where.occurredAt.lte = toDate(`${query.to} 23:59:59`)
  }
  const [rows, total] = await Promise.all([
    prisma.fundFlow.findMany({ where, orderBy: { id: 'desc' }, skip, take }),
    prisma.fundFlow.count({ where })
  ])
  const rooms = rows.length
    ? await prisma.room.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.roomId))] } },
        include: { community: true, building: true }
      })
    : []
  const roomMap = new Map(rooms.map((room) => [room.id, room]))
  const list = rows.map((row) => {
    const room = roomMap.get(row.roomId)
    return flowVO({
      ...row,
      roomNo: room?.roomNo,
      communityName: room?.community?.name,
      buildingName: room?.building?.name
    })
  })
  return { list, total, page, size }
}
