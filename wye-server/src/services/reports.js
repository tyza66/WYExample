// 工作台与报表：口径与账单列表同源（见 docs/data-model.md §3.5）
import dayjs from 'dayjs'
import { prisma } from '../db/prisma.js'
import { D, rateOf, yuan } from '../common/money.js'
import { currentPeriod, maskPhone, pageParams, shiftPeriod } from '../common/utils.js'
import { LABELS } from '../common/constants.js'
import { billAmounts } from './serialize.js'

const PERIOD_TREND = 6

/** 汇总一组账单的应收 / 实收 / 欠费 */
export function aggregateBills(bills) {
  let receivable = D(0)
  let received = D(0)
  for (const bill of bills) {
    const { net, paid } = billAmounts(bill)
    receivable = receivable.plus(net)
    received = received.plus(paid)
  }
  return { receivable, received, arrears: receivable.minus(received) }
}

function unallocatedOf(payment) {
  const allocated = (payment.allocations || []).reduce((acc, item) => acc.plus(D(item.amount)), D(0))
  const left = D(payment.amount).minus(allocated)
  return left.isNegative() ? D(0) : left
}

/** 工作台汇总 */
export async function dashboardSummary(query = {}) {
  const period = query.period || currentPeriod()
  const cid = query.communityId ? Number(query.communityId) : null
  const roomWhere = cid ? { communityId: cid } : {}

  const [communityCount, buildingCount, roomCount, residentCount] = await Promise.all([
    cid ? Promise.resolve(1) : prisma.community.count(),
    prisma.building.count({ where: roomWhere }),
    prisma.room.count({ where: roomWhere }),
    prisma.resident.count({ where: { status: 'LIVING', room: roomWhere } })
  ])

  const periods = Array.from({ length: PERIOD_TREND }, (_, index) => shiftPeriod(period, index - (PERIOD_TREND - 1)))
  const [bills, payments] = await Promise.all([
    prisma.bill.findMany({
      where: { period: { in: periods }, status: { not: 'VOID' }, ...(cid ? { communityId: cid } : {}) },
      select: { period: true, amount: true, discount: true, paidAmount: true, roomId: true }
    }),
    prisma.payment.findMany({
      where: cid ? { communityId: cid } : {},
      select: { amount: true, allocations: { select: { amount: true } } }
    })
  ])

  const trend = periods.map((item) => {
    const scoped = bills.filter((bill) => bill.period === item)
    const agg = aggregateBills(scoped)
    return { period: item, receivable: yuan(agg.receivable), received: yuan(agg.received) }
  })

  const currentBills = bills.filter((bill) => bill.period === period)
  const agg = aggregateBills(currentBills)

  const arrearsByRoom = new Map()
  for (const bill of currentBills) {
    const { arrears } = billAmounts(bill)
    if (arrears.lessThanOrEqualTo(0)) continue
    arrearsByRoom.set(bill.roomId, (arrearsByRoom.get(bill.roomId) || D(0)).plus(arrears))
  }

  const topIds = [...arrearsByRoom.entries()]
    .sort((a, b) => (b[1].greaterThan(a[1]) ? 1 : -1))
    .slice(0, 8)
    .map(([roomId]) => roomId)

  const topRooms = topIds.length
    ? await prisma.room.findMany({
        where: { id: { in: topIds } },
        include: { residents: { where: { residentType: 'OWNER', status: 'LIVING' }, take: 1 } }
      })
    : []
  const roomMap = new Map(topRooms.map((room) => [room.id, room]))

  const advanceTotal = payments.reduce((acc, payment) => acc.plus(unallocatedOf(payment)), D(0))
  const totalReceived = payments.reduce((acc, payment) => acc.plus(D(payment.amount)), D(0))

  return {
    period,
    communityCount,
    buildingCount,
    roomCount,
    residentCount,
    receivable: yuan(agg.receivable),
    received: yuan(agg.received),
    arrears: yuan(agg.arrears.isNegative() ? D(0) : agg.arrears),
    collectionRate: rateOf(agg.received, agg.receivable),
    unpaidRoomCount: arrearsByRoom.size,
    advanceTotal: yuan(advanceTotal),
    totalReceived: yuan(totalReceived),
    trend,
    topArrears: topIds.map((roomId) => {
      const room = roomMap.get(roomId)
      return {
        roomId,
        roomNo: room?.roomNo ?? `#${roomId}`,
        ownerName: room?.residents?.[0]?.name ?? '未登记',
        amount: yuan(arrearsByRoom.get(roomId))
      }
    })
  }
}

/** 欠费报表：按账单明细列出未结清项 */
export async function arrearsReport(query = {}) {
  const { page, size, skip, take } = pageParams(query)
  const cid = query.communityId ? Number(query.communityId) : null
  const bid = query.buildingId ? Number(query.buildingId) : null

  const bills = await prisma.bill.findMany({
    where: {
      status: { not: 'VOID' },
      ...(query.period ? { period: String(query.period) } : {}),
      ...(cid ? { communityId: cid } : {}),
      ...(query.feeItemId ? { feeItemId: Number(query.feeItemId) } : {}),
      ...(bid ? { room: { buildingId: bid } } : {})
    },
    include: {
      feeItem: true,
      room: {
        include: {
          building: true,
          community: true,
          residents: { where: { residentType: 'OWNER', status: 'LIVING' }, take: 1 }
        }
      }
    }
  })

  const today = dayjs()
  const rows = bills
    .map((bill) => {
      const { net, arrears } = billAmounts(bill)
      const dueDate = bill.dueDate ? dayjs(bill.dueDate) : null
      const overdue = dueDate && dueDate.isBefore(today, 'day') ? today.diff(dueDate, 'day') : 0
      return {
        billId: bill.id,
        billNo: bill.billNo,
        roomId: bill.roomId,
        roomNo: bill.room?.roomNo,
        buildingName: bill.room?.building?.name,
        communityName: bill.room?.community?.name,
        ownerName: bill.room?.residents?.[0]?.name ?? '未登记',
        phone: maskPhone(bill.room?.residents?.[0]?.phone),
        period: bill.period,
        feeItemName: bill.feeItem?.name,
        netAmount: yuan(net),
        paidAmount: yuan(bill.paidAmount),
        arrears: yuan(arrears),
        dueDate: bill.dueDate ? dayjs(bill.dueDate).format('YYYY-MM-DD') : null,
        daysOverdue: overdue,
        _arrears: arrears
      }
    })
    .filter((row) => row._arrears.greaterThan(0))
    .sort((a, b) => (b._arrears.greaterThan(a._arrears) ? 1 : -1))

  const totalArrears = rows.reduce((acc, row) => acc.plus(row._arrears), D(0))
  const list = rows.slice(skip, skip + take).map(({ _arrears, ...rest }) => rest)

  return {
    list,
    total: rows.length,
    page,
    size,
    summary: {
      totalArrears: yuan(totalArrears),
      roomCount: new Set(rows.map((row) => row.roomId)).size,
      billCount: rows.length
    }
  }
}

const METHOD_LABELS = LABELS.paymentMethod

/** 收款汇总：按日 / 月 / 方式 / 收费项目分组 */
export async function collectionReport(query = {}) {
  const from = query.from || dayjs().startOf('month').format('YYYY-MM-DD')
  const to = query.to || dayjs().format('YYYY-MM-DD')
  const groupBy = query.groupBy || 'method'
  const cid = query.communityId ? Number(query.communityId) : null

  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: dayjs(from).startOf('day').toDate(), lte: dayjs(to).endOf('day').toDate() },
      ...(cid ? { communityId: cid } : {})
    },
    include: { allocations: { include: { bill: { include: { feeItem: true } } } } }
  })

  const groups = new Map()
  const add = (key, label, amount, count = 1) => {
    const exists = groups.get(key) || { key, label, amount: D(0), count: 0 }
    exists.amount = exists.amount.plus(D(amount))
    exists.count += count
    groups.set(key, exists)
  }

  if (groupBy === 'feeItem') {
    for (const payment of payments) {
      for (const alloc of payment.allocations) {
        const name = alloc.bill?.feeItem?.name || '其他'
        add(name, name, alloc.amount)
      }
    }
  } else {
    for (const payment of payments) {
      let key = payment.method
      let label = METHOD_LABELS[payment.method] || payment.method
      if (groupBy === 'day') {
        key = dayjs(payment.paidAt).format('YYYY-MM-DD')
        label = key
      } else if (groupBy === 'month') {
        key = dayjs(payment.paidAt).format('YYYY-MM')
        label = key
      }
      add(key, label, payment.amount)
    }
  }

  const groupList = [...groups.values()]
    .map((item) => ({ key: item.key, label: item.label, amount: yuan(item.amount), count: item.count }))
    .sort((a, b) => (a.key < b.key ? -1 : 1))

  const totalAmount = payments.reduce((acc, payment) => acc.plus(D(payment.amount)), D(0))

  return {
    from,
    to,
    groupBy,
    totalAmount: yuan(totalAmount),
    totalCount: payments.length,
    groups: groupList
  }
}

/** 日结：某天各收款方式的金额、笔数与合计 */
export async function dailyClose(query = {}) {
  const date = query.date || dayjs().format('YYYY-MM-DD')
  const cid = query.communityId ? Number(query.communityId) : null

  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: dayjs(date).startOf('day').toDate(), lte: dayjs(date).endOf('day').toDate() },
      ...(cid ? { communityId: cid } : {})
    },
    include: { allocations: { select: { amount: true } } }
  })

  const groups = new Map()
  let advance = D(0)
  for (const payment of payments) {
    const exists = groups.get(payment.method) || {
      key: payment.method,
      label: METHOD_LABELS[payment.method] || payment.method,
      amount: D(0),
      count: 0
    }
    exists.amount = exists.amount.plus(D(payment.amount))
    exists.count += 1
    groups.set(payment.method, exists)
    advance = advance.plus(unallocatedOf(payment))
  }

  const totalAmount = payments.reduce((acc, payment) => acc.plus(D(payment.amount)), D(0))

  return {
    date,
    totalAmount: yuan(totalAmount),
    totalCount: payments.length,
    advanceAmount: yuan(advance),
    groups: [...groups.values()].map((item) => ({
      key: item.key,
      label: item.label,
      amount: yuan(item.amount),
      count: item.count
    }))
  }
}
