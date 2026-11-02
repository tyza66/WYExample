/**
 * 在线 Demo 模式（Netlify 静态站用）
 *
 * 开启方式：构建时设置 VITE_DEMO_MODE=true（见根目录 netlify.toml）。
 * 原理：给统一的 axios 实例换一个内存 adapter，所有 /api 请求都由本文件处理，
 *      不需要后端。数据是启动时按与 wye-server/prisma/seed.js 同口径生成的演示数据，
 *      写操作只改内存，刷新即还原。
 *
 * 注意：这是演示实现，金额用普通数字，不追求账务级精度；真实账务请走后端。
 */
import dayjs from 'dayjs'
import request from '@/api/request'

const LABEL = {
  paymentMethod: { CASH: '现金', WECHAT: '微信', ALIPAY: '支付宝', BANK_TRANSFER: '银行转账', POS: 'POS 刷卡', BANK_DEDUCT: '银行代扣' },
  roomType: { RESIDENCE: '住宅', SHOP: '商铺', OFFICE: '办公', PARKING: '车位' },
  roomStatus: { VACANT: '空置', OCCUPIED: '自住', RENTED: '出租' },
  residentType: { OWNER: '业主', TENANT: '租户', FAMILY: '家属' },
  residentStatus: { LIVING: '在住', MOVED_OUT: '已迁出' },
  feeType: { PROPERTY: '物业费', WATER: '水费', ELECTRIC: '电费', PARKING: '车位费', OTHER: '其他' },
  chargeMode: { AREA: '按面积', UNIT: '按户', METER: '按用量', FIXED: '固定金额' },
  feePeriod: { MONTHLY: '按月', QUARTERLY: '按季', YEARLY: '按年', ONCE: '一次性' },
  billStatus: { UNPAID: '未缴', PARTIAL: '部分缴', PAID: '已缴清', VOID: '已作废' },
  role: { ADMIN: '管理员', CASHIER: '收费员', VIEWER: '只读' }
}

const yuan = (value) => Math.round((Number(value) || 0) * 100) / 100
const idOf = (list) => (list.length ? Math.max(...list.map((item) => item.id)) + 1 : 1)

const BUILDINGS = [
  { name: '1 号楼', unitCount: 2 },
  { name: '2 号楼', unitCount: 2 },
  { name: '3 号楼', unitCount: 1 }
]

const ROOM_SEED = [
  ['1 号楼', '1', 1, '1-101', 89.5, 'RESIDENCE', 'OCCUPIED'],
  ['1 号楼', '1', 1, '1-102', 105.2, 'RESIDENCE', 'OCCUPIED'],
  ['1 号楼', '1', 2, '1-201', 89.5, 'RESIDENCE', 'RENTED'],
  ['1 号楼', '1', 2, '1-202', 105.2, 'RESIDENCE', 'OCCUPIED'],
  ['2 号楼', '1', 1, '2-101', 76.8, 'RESIDENCE', 'OCCUPIED'],
  ['2 号楼', '1', 2, '2-201', 120.5, 'RESIDENCE', 'RENTED'],
  ['2 号楼', '1', 2, '2-202', 88.0, 'RESIDENCE', 'OCCUPIED'],
  ['2 号楼', '1', 3, '2-301', 143.6, 'RESIDENCE', 'VACANT'],
  ['3 号楼', '1', 1, '3-101', 210.0, 'SHOP', 'RENTED'],
  ['3 号楼', '1', 1, '3-102', 168.5, 'SHOP', 'OCCUPIED'],
  ['3 号楼', '1', -1, 'P-001', 0, 'PARKING', 'OCCUPIED'],
  ['3 号楼', '1', -1, 'P-002', 0, 'PARKING', 'VACANT']
]

const RESIDENT_SEED = [
  ['1-101', '张三', '13800000001', '110101199001011234', 'OWNER'],
  ['1-101', '张小妹', '13800000011', '110101201505054321', 'FAMILY'],
  ['1-102', '李四', '13800000002', '110101198807152345', 'OWNER'],
  ['1-201', '王五', '13800000003', '110101199203041122', 'TENANT'],
  ['1-202', '赵六', '13800000004', '110101198511209876', 'OWNER'],
  ['2-101', '钱七', '13800000005', '110101199507081357', 'OWNER'],
  ['2-201', '孙八', '13800000006', '110101199109234680', 'TENANT'],
  ['2-202', '周九', '13800000007', '110101198802124567', 'OWNER'],
  ['3-101', '吴十', '13800000008', '110101198609301234', 'TENANT'],
  ['3-102', '郑一', '13800000009', '110101199406068765', 'OWNER']
]

const FEE_SEED = [
  ['物业管理费', 'WYF', 'PROPERTY', 'AREA', 3.5, '元/㎡', 1],
  ['水费', 'SF', 'WATER', 'METER', 3.2, '元/吨', 2],
  ['电费', 'DF', 'ELECTRIC', 'METER', 0.6185, '元/度', 3],
  ['车位管理费', 'CWGLF', 'PARKING', 'FIXED', 80, '元/月', 4]
]

const maskIdCard = (value) => (!value ? value : `${String(value).slice(0, 6)}${'*'.repeat(4)}${String(value).slice(-4)}`)
const maskPhone = (value) => (!value ? value : `${String(value).slice(0, 3)}****${String(value).slice(-4)}`)

const state = {
  users: [],
  communities: [],
  buildings: [],
  rooms: [],
  residents: [],
  feeItems: [],
  bills: [],
  payments: [],
  allocations: [],
  meterReadings: [],
  logs: [],
  seq: 0
}

const nextNo = (prefix, periodText) => {
  state.seq += 1
  return `${prefix}${periodText}${String(state.seq).padStart(6, '0')}`
}

function seed() {
  state.users = [
    { id: 1, username: 'admin', password: 'admin123', realName: '系统管理员', role: 'ADMIN', phone: '13900000001', enabled: true, remark: null, createdAt: `${dayjs().format('YYYY-MM-DD')} 09:00:00` },
    { id: 2, username: 'cashier', password: '123456', realName: '收费员小李', role: 'CASHIER', phone: '13900000002', enabled: true, remark: null, createdAt: `${dayjs().format('YYYY-MM-DD')} 09:00:00` },
    { id: 3, username: 'viewer', password: '123456', realName: '物业经理（只读）', role: 'VIEWER', phone: '13900000003', enabled: true, remark: null, createdAt: `${dayjs().format('YYYY-MM-DD')} 09:00:00` }
  ]

  state.communities = [{ id: 1, name: '阳光花园', code: 'YGHY', address: '幸福路 88 号', manager: '陈经理', phone: '0571-88888888', remark: '在线 Demo：数据仅存在浏览器内存中' }]

  state.buildings = BUILDINGS.map((item, index) => ({ id: index + 1, communityId: 1, name: item.name, unitCount: item.unitCount, remark: null }))

  state.rooms = ROOM_SEED.map((item, index) => {
    const [buildingName, unit, floor, roomNo, area, roomType, status] = item
    const building = state.buildings.find((row) => row.name === buildingName)
    return { id: index + 1, communityId: 1, buildingId: building.id, unit, roomNo, floor, area, roomType, status, remark: null }
  })

  state.residents = RESIDENT_SEED.map((item, index) => {
    const [roomNo, name, phone, idCard, residentType] = item
    const room = state.rooms.find((row) => row.roomNo === roomNo)
    return {
      id: index + 1,
      roomId: room.id,
      name,
      phone,
      idCard,
      residentType,
      startDate: '2021-03-01',
      endDate: null,
      status: 'LIVING',
      remark: null
    }
  })

  state.feeItems = FEE_SEED.map((item, index) => {
    const [name, code, type, chargeMode, unitPrice, priceUnit, sortNo] = item
    return { id: index + 1, name, code, type, chargeMode, unitPrice, priceUnit, period: 'MONTHLY', communityId: null, enabled: true, sortNo, remark: null }
  })

  const current = dayjs().format('YYYY-MM')
  const periods = [dayjs(`${current}-01`).subtract(2, 'month').format('YYYY-MM'), dayjs(`${current}-01`).subtract(1, 'month').format('YYYY-MM'), current]

  // 抄表
  let meterId = 1
  state.rooms
    .filter((room) => room.roomType !== 'PARKING')
    .forEach((room, roomIndex) => {
      let waterPrev = 120 + roomIndex * 15
      let electricPrev = (120 + roomIndex * 15) * 8
      periods.forEach((period, periodIndex) => {
        const waterUsage = 6 + ((roomIndex + periodIndex) % 5) * 2
        const electricUsage = 90 + ((roomIndex * 3 + periodIndex * 7) % 60)
        state.meterReadings.push(
          { id: meterId++, roomId: room.id, feeItemId: 2, period, prevReading: waterPrev, currReading: waterPrev + waterUsage, usageQty: waterUsage, readingDate: `${period}-01`, operator: 'cashier', remark: null },
          { id: meterId++, roomId: room.id, feeItemId: 3, period, prevReading: electricPrev, currReading: electricPrev + electricUsage, usageQty: electricUsage, readingDate: `${period}-01`, operator: 'cashier', remark: null }
        )
        waterPrev += waterUsage
        electricPrev += electricUsage
      })
    })

  // 账单：与后端同一套计费规则
  let billId = 1
  const createBill = (room, feeItem, period, quantity) => {
    state.bills.push({
      id: billId,
      billNo: nextNo('B', period.replace('-', '')),
      communityId: room.communityId,
      roomId: room.id,
      feeItemId: feeItem.id,
      period,
      chargeMode: feeItem.chargeMode,
      quantity: yuan(quantity),
      unitPrice: feeItem.unitPrice,
      amount: yuan(quantity * feeItem.unitPrice),
      discount: 0,
      paidAmount: 0,
      status: 'UNPAID',
      dueDate: dayjs(`${period}-01`).add(1, 'month').date(10).format('YYYY-MM-DD'),
      generatedAt: `${period}-01 08:00:00`,
      remark: null,
      voidReason: null
    })
    billId += 1
  }

  for (const period of periods) {
    for (const room of state.rooms) {
      for (const feeItem of state.feeItems) {
        if (feeItem.id === 4) {
          if (room.roomType !== 'PARKING') continue
          createBill(room, feeItem, period, 1)
          continue
        }
        if (feeItem.chargeMode === 'AREA') {
          if (!room.area) continue
          createBill(room, feeItem, period, room.area)
          continue
        }
        const reading = state.meterReadings.find((row) => row.roomId === room.id && row.feeItemId === feeItem.id && row.period === period)
        if (!reading) continue
        createBill(room, feeItem, period, reading.usageQty)
      }
    }
  }

  // 收款：全额 / 部分 / 超缴各一
  let paymentId = 1
  let allocationId = 1
  /**
   * 登记一笔收款。
   * @param ratio 只核销欠费的比例（默认 1，用于演示"部分缴"）
   * @param extra 在欠费之外再多收的金额（用于演示"预收余额"）
   */
  const pay = (roomNo, method, periodDay, remark, onlyPeriod, ratio = 1, extra = 0) => {
    const room = state.rooms.find((row) => row.roomNo === roomNo)
    const targets = state.bills
      .filter((bill) => bill.roomId === room.id && bill.status !== 'VOID' && (!onlyPeriod || bill.period === onlyPeriod))
      .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    const arrearsTotal = yuan(targets.reduce((acc, bill) => acc + billArrears(bill), 0))
    const amount = yuan(arrearsTotal * ratio + extra)

    const payment = {
      id: paymentId++,
      paymentNo: nextNo('P', periodDay.replace(/-/g, '')),
      communityId: room.communityId,
      roomId: room.id,
      amount,
      method,
      paidAt: `${periodDay} 10:20:00`,
      operator: 'admin',
      remark
    }
    state.payments.push(payment)

    let remaining = amount
    for (const bill of targets) {
      if (remaining <= 0) break
      const due = billArrears(bill)
      if (due <= 0) continue
      const alloc = Math.min(due, remaining)
      bill.paidAmount = yuan(bill.paidAmount + alloc)
      bill.status = bill.paidAmount >= billNet(bill) ? 'PAID' : 'PARTIAL'
      state.allocations.push({ id: allocationId++, paymentId: payment.id, billId: bill.id, amount: alloc })
      remaining = yuan(remaining - alloc)
    }
  }

  // 收款日期必须落在"当月且不晚于今天"，否则收款汇总的默认区间会查不到数据
  const payDate = (day) => `${periods[2]}-${String(Math.min(day, dayjs().date())).padStart(2, '0')}`

  pay('1-101', 'WECHAT', payDate(4), `${periods[2]} 物业费与水电费`, periods[2])
  pay('2-101', 'ALIPAY', payDate(4), `${periods[2]} 费用结清`, periods[2])
  pay('3-102', 'POS', payDate(5), `${periods[2]} 商铺费用`, periods[2])
  pay('1-102', 'CASH', payDate(6), '先缴一半，其余下周补齐', null, 0.5)
  pay('1-202', 'BANK_TRANSFER', payDate(8), '多缴部分作为预收，抵扣下期', periods[2], 1, 500)

  state.logs = [
    { id: 1, username: 'admin', module: '账单', action: '批量生成', target: periods[2], detail: `生成账单成功`, ip: '127.0.0.1', createdAt: `${periods[2]}-01 08:05:00` },
    { id: 2, username: 'admin', module: '收款', action: '登记', target: 'P' + periods[2].replace('-', ''), detail: '演示数据初始化', ip: '127.0.0.1', createdAt: `${periods[2]}-04 10:20:00` }
  ]
  state.periods = periods
}

// ---------------- 查询辅助 ----------------
const billNet = (bill) => yuan(bill.amount - bill.discount)
const billArrears = (bill) => Math.max(0, yuan(billNet(bill) - bill.paidAmount))
const communityOf = (id) => state.communities.find((row) => row.id === id)
const buildingOf = (id) => state.buildings.find((row) => row.id === id)
const roomOf = (id) => state.rooms.find((row) => row.id === id)
const feeItemOf = (id) => state.feeItems.find((row) => row.id === id)
const livingResidents = (roomId) => state.residents.filter((row) => row.roomId === roomId && row.status === 'LIVING')
const ownerOf = (roomId) => livingResidents(roomId).find((row) => row.residentType === 'OWNER')

function roomVO(room) {
  return {
    ...room,
    communityName: communityOf(room.communityId)?.name,
    buildingName: buildingOf(room.buildingId)?.name,
    residentCount: livingResidents(room.id).length
  }
}

function billVO(bill) {
  const room = roomOf(bill.roomId)
  return {
    ...bill,
    communityName: communityOf(bill.communityId)?.name,
    roomNo: room?.roomNo,
    buildingName: buildingOf(room?.buildingId)?.name,
    feeItemName: feeItemOf(bill.feeItemId)?.name,
    netAmount: billNet(bill),
    arrears: billArrears(bill)
  }
}

function residentVO(row) {
  const room = roomOf(row.roomId)
  return {
    ...row,
    idCard: maskIdCard(row.idCard),
    roomNo: room?.roomNo,
    communityId: room?.communityId,
    communityName: communityOf(room?.communityId)?.name,
    buildingName: buildingOf(room?.buildingId)?.name
  }
}

function paymentVO(payment) {
  const room = roomOf(payment.roomId)
  const allocated = state.allocations.filter((row) => row.paymentId === payment.id).reduce((acc, row) => acc + row.amount, 0)
  return {
    ...payment,
    roomNo: room?.roomNo,
    communityName: communityOf(payment.communityId)?.name,
    buildingName: buildingOf(room?.buildingId)?.name,
    paidAt: payment.paidAt.length > 16 ? payment.paidAt : `${payment.paidAt}:00`,
    allocatedAmount: yuan(allocated),
    advanceAmount: yuan(Math.max(0, payment.amount - allocated)),
    allocationCount: state.allocations.filter((row) => row.paymentId === payment.id).length
  }
}

function meterVO(row) {
  const room = roomOf(row.roomId)
  const feeItem = feeItemOf(row.feeItemId)
  return {
    ...row,
    roomNo: room?.roomNo,
    buildingName: buildingOf(room?.buildingId)?.name,
    communityName: communityOf(room?.communityId)?.name,
    feeItemName: feeItem?.name,
    unitPrice: feeItem?.unitPrice ?? 0,
    estimatedAmount: yuan((row.usageQty || 0) * (feeItem?.unitPrice ?? 0))
  }
}

function paginate(list, params = {}) {
  const page = Math.max(1, Number(params.page) || 1)
  const size = Math.min(100, Math.max(1, Number(params.size) || 10))
  return { list: list.slice((page - 1) * size, page * size), total: list.length, page, size }
}

const has = (value, keyword) => String(value ?? '').toLowerCase().includes(String(keyword).toLowerCase())

function filterBasic(name, params = {}) {
  switch (name) {
    case 'communities':
      return state.communities.filter((row) => !params.keyword || has(row.name, params.keyword) || has(row.code, params.keyword))
    case 'buildings':
      return state.buildings.filter((row) => (!params.communityId || row.communityId === Number(params.communityId)) && (!params.keyword || has(row.name, params.keyword)))
    case 'rooms':
      return state.rooms.filter(
        (row) =>
          (!params.communityId || row.communityId === Number(params.communityId)) &&
          (!params.buildingId || row.buildingId === Number(params.buildingId)) &&
          (!params.roomType || row.roomType === params.roomType) &&
          (!params.status || row.status === params.status) &&
          (!params.keyword || has(row.roomNo, params.keyword) || livingResidents(row.id).some((item) => has(item.name, params.keyword)))
      )
    case 'residents':
      return state.residents.filter(
        (row) =>
          (!params.roomId || row.roomId === Number(params.roomId)) &&
          (!params.residentType || row.residentType === params.residentType) &&
          (!params.status || row.status === params.status) &&
          (!params.keyword || has(row.name, params.keyword) || has(row.phone, params.keyword)) &&
          (!params.communityId || roomOf(row.roomId)?.communityId === Number(params.communityId))
      )
    case 'fee-items':
      return state.feeItems.filter(
        (row) =>
          (!params.type || row.type === params.type) &&
          (!params.chargeMode || row.chargeMode === params.chargeMode) &&
          (params.enabled === undefined || params.enabled === '' || row.enabled === (String(params.enabled) === 'true')) &&
          (!params.keyword || has(row.name, params.keyword) || has(row.code, params.keyword))
      )
    default:
      return []
  }
}

function listVO(name, rows) {
  if (name === 'rooms') return rows.map(roomVO)
  if (name === 'residents') return rows.map(residentVO)
  if (name === 'buildings') return rows.map((row) => ({ ...row, communityName: communityOf(row.communityId)?.name, roomCount: state.rooms.filter((room) => room.buildingId === row.id).length }))
  if (name === 'communities') {
    return rows.map((row) => ({
      ...row,
      buildingCount: state.buildings.filter((item) => item.communityId === row.id).length,
      roomCount: state.rooms.filter((item) => item.communityId === row.id).length
    }))
  }
  return rows
}

// ---------------- 业务操作 ----------------
function generateBills(payload) {
  const period = payload.period
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) throw new Error('账期格式不正确，应为 yyyy-MM')
  const feeItems = state.feeItems.filter((item) => item.enabled && (!payload.feeItemIds?.length || payload.feeItemIds.includes(item.id)))
  if (!feeItems.length) throw new Error('没有可用的收费项目，请先在「收费项目」中启用')
  const rooms = state.rooms.filter((room) => (!payload.communityId || room.communityId === Number(payload.communityId)) && (!payload.buildingId || room.buildingId === Number(payload.buildingId)))
  if (!rooms.length) throw new Error('所选范围内没有房屋，请先维护基础资料')

  let generated = 0
  let skipped = 0
  let total = 0
  const skipReasons = []

  for (const room of rooms) {
    for (const feeItem of feeItems) {
      const exists = state.bills.find((bill) => bill.roomId === room.id && bill.feeItemId === feeItem.id && bill.period === period && bill.status !== 'VOID')
      const skipIt = (reason) => {
        skipped += 1
        if (skipReasons.length < 30) skipReasons.push({ roomNo: room.roomNo, feeItem: feeItem.name, reason })
      }
      if (exists && !payload.overwrite) {
        skipIt('该账期账单已存在')
        continue
      }
      if (exists && exists.paidAmount > 0) {
        skipIt('已有收款记录，不能覆盖生成')
        continue
      }
      let quantity = 1
      if (feeItem.chargeMode === 'AREA') {
        if (!room.area) {
          skipIt('房屋面积未维护')
          continue
        }
        quantity = room.area
      } else if (feeItem.chargeMode === 'METER') {
        const reading = state.meterReadings.find((row) => row.roomId === room.id && row.feeItemId === feeItem.id && row.period === period)
        if (!reading || reading.usageQty <= 0) {
          skipIt('该账期无抄表记录')
          continue
        }
        quantity = reading.usageQty
      }
      if (exists) {
        exists.status = 'VOID'
        exists.voidReason = '账单重新生成'
      }
      const bill = {
        id: idOf(state.bills),
        billNo: nextNo('B', period.replace('-', '')),
        communityId: room.communityId,
        roomId: room.id,
        feeItemId: feeItem.id,
        period,
        chargeMode: feeItem.chargeMode,
        quantity: yuan(quantity),
        unitPrice: feeItem.unitPrice,
        amount: yuan(quantity * feeItem.unitPrice),
        discount: 0,
        paidAmount: 0,
        status: 'UNPAID',
        dueDate: dayjs(`${period}-01`).add(1, 'month').date(10).format('YYYY-MM-DD'),
        generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        remark: null,
        voidReason: null
      }
      state.bills.push(bill)
      generated += 1
      total = yuan(total + bill.amount)
    }
  }
  return { generated, skipped, totalAmount: total, skipReasons }
}

function createPayment(payload) {
  const room = roomOf(Number(payload.roomId))
  if (!room) throw new Error('房屋不存在')
  const amount = yuan(payload.amount)
  if (amount <= 0) throw new Error('收款金额必须大于 0')
  const method = payload.method
  if (!LABEL.paymentMethod[method]) throw new Error('收款方式不正确')

  const payment = {
    id: idOf(state.payments),
    paymentNo: nextNo('P', dayjs().format('YYYYMMDD')),
    communityId: room.communityId,
    roomId: room.id,
    amount,
    method,
    paidAt: (payload.paidAt || dayjs().format('YYYY-MM-DD HH:mm:ss')).replace('T', ' '),
    operator: 'admin',
    remark: payload.remark || null
  }
  state.payments.push(payment)

  const targets = state.bills
    .filter((bill) => bill.roomId === room.id && bill.status !== 'VOID' && (!payload.billIds?.length || payload.billIds.includes(bill.id)))
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))

  let remaining = amount
  const allocations = []
  for (const bill of targets) {
    if (remaining <= 0) break
    const due = billArrears(bill)
    if (due <= 0) continue
    const alloc = Math.min(due, remaining)
    bill.paidAmount = yuan(bill.paidAmount + alloc)
    bill.status = bill.paidAmount >= billNet(bill) ? 'PAID' : 'PARTIAL'
    state.allocations.push({ id: idOf(state.allocations), paymentId: payment.id, billId: bill.id, amount: alloc })
    allocations.push({ billId: bill.id, billNo: bill.billNo, period: bill.period, amount: alloc })
    remaining = yuan(remaining - alloc)
  }

  const roomArrearsAfter = state.bills.filter((bill) => bill.roomId === room.id && bill.status !== 'VOID').reduce((acc, bill) => acc + billArrears(bill), 0)
  return {
    paymentId: payment.id,
    paymentNo: payment.paymentNo,
    amount,
    allocatedAmount: yuan(amount - remaining),
    advanceAmount: yuan(Math.max(0, remaining)),
    allocations,
    roomArrearsAfter: yuan(roomArrearsAfter)
  }
}

function dashboard(params = {}) {
  const period = params.period || state.periods[2]
  const cid = params.communityId ? Number(params.communityId) : null
  const scoped = state.bills.filter((bill) => bill.status !== 'VOID' && (!cid || bill.communityId === cid))
  const periods = state.periods
  const trend = periods.map((item) => {
    const rows = scoped.filter((bill) => bill.period === item)
    return {
      period: item,
      receivable: yuan(rows.reduce((acc, bill) => acc + billNet(bill), 0)),
      received: yuan(rows.reduce((acc, bill) => acc + bill.paidAmount, 0))
    }
  })
  const current = scoped.filter((bill) => bill.period === period)
  const receivable = yuan(current.reduce((acc, bill) => acc + billNet(bill), 0))
  const received = yuan(current.reduce((acc, bill) => acc + bill.paidAmount, 0))
  const arrearsByRoom = new Map()
  current.forEach((bill) => {
    const value = billArrears(bill)
    if (value > 0) arrearsByRoom.set(bill.roomId, yuan((arrearsByRoom.get(bill.roomId) || 0) + value))
  })
  const advanceTotal = state.payments.reduce((acc, payment) => acc + paymentVO(payment).advanceAmount, 0)

  return {
    period,
    communityCount: cid ? 1 : state.communities.length,
    buildingCount: state.buildings.filter((row) => !cid || row.communityId === cid).length,
    roomCount: state.rooms.filter((row) => !cid || row.communityId === cid).length,
    residentCount: state.residents.filter((row) => row.status === 'LIVING' && (!cid || roomOf(row.roomId)?.communityId === cid)).length,
    receivable,
    received,
    arrears: yuan(Math.max(0, receivable - received)),
    collectionRate: receivable > 0 ? Math.round((received / receivable) * 10000) / 10000 : 1,
    unpaidRoomCount: arrearsByRoom.size,
    advanceTotal: yuan(advanceTotal),
    trend,
    topArrears: [...arrearsByRoom.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([roomId, value]) => ({ roomId, roomNo: roomOf(roomId)?.roomNo, ownerName: ownerOf(roomId)?.name || '未登记', amount: value }))
  }
}

// ---------------- 路由表 ----------------
const basicResources = ['communities', 'buildings', 'rooms', 'residents', 'fee-items']
// URL 名 -> state 键（kebab-case 与 camelCase 的映射）
const stateKey = { communities: 'communities', buildings: 'buildings', rooms: 'rooms', residents: 'residents', 'fee-items': 'feeItems' }

function handle(method, url, params, body) {
  const path = url.replace(/^\/api/, '').replace(/\?.*$/, '')
  const segments = path.split('/').filter(Boolean)

  if (path === '/health') return { status: 'ok', version: '1.0.0-demo', db: 'memory' }

  if (path === '/auth/login' && method === 'post') {
    const user = state.users.find((row) => row.username === body.username && row.password === body.password)
    if (!user) throw new Error('用户名或密码错误')
    if (!user.enabled) throw new Error('账号已停用，请联系管理员')
    return { token: `demo-token-${user.username}`, user: { id: user.id, username: user.username, realName: user.realName, role: user.role } }
  }
  if (path === '/auth/profile') {
    const user = state.users.find((row) => row.username === currentUsername) || state.users[0]
    return { id: user.id, username: user.username, realName: user.realName, role: user.role, phone: user.phone, enabled: user.enabled }
  }
  if (path === '/auth/logout') return true

  // 下拉选项
  if (path === '/communities/options') return state.communities.map((row) => ({ id: row.id, label: row.name, extra: null }))
  if (path === '/buildings/options') {
    return state.buildings
      .filter((row) => !params.communityId || row.communityId === Number(params.communityId))
      .map((row) => ({ id: row.id, label: row.name, extra: null }))
  }
  if (path === '/fee-items/options') {
    return state.feeItems.map((row) => ({ id: row.id, label: `${row.name}（${row.unitPrice}${row.priceUnit ? ` ${row.priceUnit}` : ''}）`, extra: { chargeMode: row.chargeMode, period: row.period, unitPrice: row.unitPrice, priceUnit: row.priceUnit, type: row.type } }))
  }
  if (path === '/rooms/options') {
    const keyword = params.keyword ? String(params.keyword) : ''
    return state.rooms
      .filter((room) => (!params.communityId || room.communityId === Number(params.communityId)) && (!keyword || has(room.roomNo, keyword) || livingResidents(room.id).some((item) => has(item.name, keyword))))
      .slice(0, 50)
      .map((room) => ({ id: room.id, label: room.roomNo, extra: { area: room.area, roomType: room.roomType, communityId: room.communityId, buildingId: room.buildingId } }))
  }

  // 基础资料 CRUD
  if (basicResources.includes(segments[0])) {
    const name = segments[0]
    const list = state[stateKey[name]]
    const id = segments[1] ? Number(segments[1]) : null
    if (method === 'get' && !id) return paginate(listVO(name, filterBasic(name, params)), params)
    if (method === 'get' && id) {
      const row = list.find((item) => item.id === id)
      if (!row) throw new Error('记录不存在')
      return listVO(name, [row])[0]
    }
    if (method === 'post') {
      const created = { ...body, id: idOf(list) }
      if (name === 'fee-items') created.enabled = created.enabled !== false
      list.push(created)
      return listVO(name, [created])[0]
    }
    if (method === 'put' && id) {
      const index = list.findIndex((item) => item.id === id)
      if (index < 0) throw new Error('记录不存在')
      list[index] = { ...list[index], ...body, id }
      return listVO(name, [list[index]])[0]
    }
    if (method === 'delete' && id) {
      const index = list.findIndex((item) => item.id === id)
      if (index < 0) throw new Error('记录不存在')
      if (name === 'rooms' && state.bills.some((bill) => bill.roomId === id && bill.status !== 'VOID')) throw new Error('该房屋已有账单记录，无法删除')
      list.splice(index, 1)
      return true
    }
  }

  // 账单
  if (path === '/bills' && method === 'get') {
    const keyword = params.keyword ? String(params.keyword) : ''
    const rows = state.bills
      .filter(
        (bill) =>
          (!params.period || bill.period === params.period) &&
          (!params.communityId || bill.communityId === Number(params.communityId)) &&
          (!params.feeItemId || bill.feeItemId === Number(params.feeItemId)) &&
          (!params.roomId || bill.roomId === Number(params.roomId)) &&
          (!params.status || bill.status === params.status) &&
          (!params.buildingId || roomOf(bill.roomId)?.buildingId === Number(params.buildingId)) &&
          (!keyword || has(bill.billNo, keyword) || has(roomOf(bill.roomId)?.roomNo, keyword))
      )
      .sort((a, b) => (a.period === b.period ? b.id - a.id : a.period < b.period ? 1 : -1))
    return paginate(rows.map(billVO), params)
  }
  if (path === '/bills/generate' && method === 'post') return generateBills(body)
  if (segments[0] === 'bills' && segments[2] === 'void' && method === 'post') {
    const bill = state.bills.find((row) => row.id === Number(segments[1]))
    if (!bill) throw new Error('账单不存在')
    if (bill.paidAmount > 0) throw new Error('该账单已有收款记录，请先处理对应收款单')
    if (!body.reason) throw new Error('请填写作废原因')
    bill.status = 'VOID'
    bill.voidReason = body.reason
    return billVO(bill)
  }
  if (segments[0] === 'bills' && method === 'put') {
    const bill = state.bills.find((row) => row.id === Number(segments[1]))
    if (!bill) throw new Error('账单不存在')
    if (body.discount !== undefined && body.discount !== null) {
      if (yuan(body.discount) > billNet(bill) - bill.paidAmount) throw new Error(`减免后金额不能低于已收金额 ${bill.paidAmount} 元`)
      bill.discount = yuan(body.discount)
    }
    if (body.dueDate) bill.dueDate = body.dueDate
    if (body.remark !== undefined) bill.remark = body.remark
    return billVO(bill)
  }
  if (segments[0] === 'bills' && segments[1] && method === 'get') {
    const bill = state.bills.find((row) => row.id === Number(segments[1]))
    if (!bill) throw new Error('账单不存在')
    return billVO(bill)
  }

  // 收款
  if (path === '/payments' && method === 'get') {
    const keyword = params.keyword ? String(params.keyword) : ''
    const rows = state.payments
      .filter(
        (payment) =>
          (!params.communityId || payment.communityId === Number(params.communityId)) &&
          (!params.roomId || payment.roomId === Number(params.roomId)) &&
          (!params.method || payment.method === params.method) &&
          (!keyword || has(payment.paymentNo, keyword) || has(roomOf(payment.roomId)?.roomNo, keyword))
      )
      .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
    return paginate(rows.map(paymentVO), params)
  }
  if (path === '/payments' && method === 'post') return createPayment(body)
  if (segments[0] === 'payments' && segments[1] && method === 'get') {
    const payment = state.payments.find((row) => row.id === Number(segments[1]))
    if (!payment) throw new Error('收款单不存在')
    return {
      ...paymentVO(payment),
      allocations: state.allocations
        .filter((row) => row.paymentId === payment.id)
        .map((row) => {
          const bill = state.bills.find((item) => item.id === row.billId)
          return { billId: row.billId, billNo: bill?.billNo, period: bill?.period, feeItemName: feeItemOf(bill?.feeItemId)?.name, amount: row.amount }
        })
    }
  }

  // 抄表
  if (path === '/meter-readings' && method === 'get') {
    const rows = state.meterReadings
      .filter(
        (row) =>
          (!params.period || row.period === params.period) &&
          (!params.roomId || row.roomId === Number(params.roomId)) &&
          (!params.feeItemId || row.feeItemId === Number(params.feeItemId)) &&
          (!params.communityId || roomOf(row.roomId)?.communityId === Number(params.communityId))
      )
      .sort((a, b) => (a.period === b.period ? b.id - a.id : a.period < b.period ? 1 : -1))
    return paginate(rows.map(meterVO), params)
  }
  if (path === '/meter-readings' && method === 'post') {
    const room = roomOf(Number(body.roomId))
    if (!room) throw new Error('房屋不存在')
    const feeItem = feeItemOf(Number(body.feeItemId))
    if (!feeItem) throw new Error('收费项目不存在')
    if (feeItem.chargeMode !== 'METER') throw new Error('该收费项目不是按用量计费，无需抄表')
    const previous = state.meterReadings.find((row) => row.roomId === room.id && row.feeItemId === feeItem.id && row.period === dayjs(`${body.period}-01`).subtract(1, 'month').format('YYYY-MM'))
    const prevReading = body.prevReading ?? previous?.currReading ?? 0
    if (Number(body.currReading) < Number(prevReading)) throw new Error('本期读数小于上期读数，请核对')
    const existing = state.meterReadings.find((row) => row.roomId === room.id && row.feeItemId === feeItem.id && row.period === body.period)
    const payload = {
      roomId: room.id,
      feeItemId: feeItem.id,
      period: body.period,
      prevReading: yuan(prevReading),
      currReading: yuan(body.currReading),
      usageQty: yuan(Number(body.currReading) - Number(prevReading)),
      readingDate: body.readingDate || dayjs().format('YYYY-MM-DD'),
      operator: 'cashier',
      remark: body.remark || null
    }
    if (existing) Object.assign(existing, payload)
    else state.meterReadings.push({ id: idOf(state.meterReadings), ...payload })
    return meterVO(existing || state.meterReadings[state.meterReadings.length - 1])
  }

  // 工作台与报表
  if (path === '/dashboard/summary') return dashboard(params)
  if (path === '/reports/arrears') {
    const keywordPeriod = params.period
    const rows = state.bills
      .filter((bill) => bill.status !== 'VOID' && (!keywordPeriod || bill.period === keywordPeriod) && (!params.communityId || bill.communityId === Number(params.communityId)) && (!params.feeItemId || bill.feeItemId === Number(params.feeItemId)))
      .map((bill) => ({ bill, arrears: billArrears(bill) }))
      .filter((item) => item.arrears > 0)
      .sort((a, b) => b.arrears - a.arrears)
    const list = rows.map(({ bill, arrears }) => {
      const room = roomOf(bill.roomId)
      const owner = ownerOf(bill.roomId)
      const days = Math.max(0, dayjs().diff(dayjs(bill.dueDate), 'day'))
      return {
        billId: bill.id,
        billNo: bill.billNo,
        roomId: bill.roomId,
        roomNo: room?.roomNo,
        buildingName: buildingOf(room?.buildingId)?.name,
        communityName: communityOf(room?.communityId)?.name,
        ownerName: owner?.name || '未登记',
        phone: maskPhone(owner?.phone),
        period: bill.period,
        feeItemName: feeItemOf(bill.feeItemId)?.name,
        netAmount: billNet(bill),
        paidAmount: bill.paidAmount,
        arrears,
        dueDate: bill.dueDate,
        daysOverdue: days
      }
    })
    return {
      ...paginate(list, params),
      summary: {
        totalArrears: yuan(list.reduce((acc, row) => acc + row.arrears, 0)),
        roomCount: new Set(list.map((row) => row.roomId)).size,
        billCount: list.length
      }
    }
  }
  if (path === '/reports/collection') {
    const from = params.from || dayjs().startOf('month').format('YYYY-MM-DD')
    const to = params.to || dayjs().format('YYYY-MM-DD')
    const groupBy = params.groupBy || 'method'
    const rows = state.payments.filter((payment) => payment.paidAt.slice(0, 10) >= from && payment.paidAt.slice(0, 10) <= to)
    const groups = new Map()
    const add = (key, label, amount) => {
      const item = groups.get(key) || { key, label, amount: 0, count: 0 }
      item.amount = yuan(item.amount + amount)
      item.count += 1
      groups.set(key, item)
    }
    if (groupBy === 'feeItem') {
      rows.forEach((payment) => {
        state.allocations
          .filter((row) => row.paymentId === payment.id)
          .forEach((row) => {
            const bill = state.bills.find((item) => item.id === row.billId)
            const name = feeItemOf(bill?.feeItemId)?.name || '其他'
            add(name, name, row.amount)
          })
      })
    } else {
      rows.forEach((payment) => {
        if (groupBy === 'day') add(payment.paidAt.slice(0, 10), payment.paidAt.slice(0, 10), payment.amount)
        else if (groupBy === 'month') add(payment.paidAt.slice(0, 7), payment.paidAt.slice(0, 7), payment.amount)
        else add(payment.method, LABEL.paymentMethod[payment.method] || payment.method, payment.amount)
      })
    }
    return {
      from,
      to,
      groupBy,
      totalAmount: yuan(rows.reduce((acc, payment) => acc + payment.amount, 0)),
      totalCount: rows.length,
      groups: [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : 1))
    }
  }
  if (path === '/reports/daily-close' || path === '/reports/dailyClose') {
    const date = params.date || dayjs().format('YYYY-MM-DD')
    const rows = state.payments.filter((payment) => payment.paidAt.slice(0, 10) === date)
    const groups = new Map()
    rows.forEach((payment) => {
      const item = groups.get(payment.method) || { key: payment.method, label: LABEL.paymentMethod[payment.method] || payment.method, amount: 0, count: 0 }
      item.amount = yuan(item.amount + payment.amount)
      item.count += 1
      groups.set(payment.method, item)
    })
    return {
      date,
      totalAmount: yuan(rows.reduce((acc, payment) => acc + payment.amount, 0)),
      totalCount: rows.length,
      advanceAmount: yuan(rows.reduce((acc, payment) => acc + paymentVO(payment).advanceAmount, 0)),
      groups: [...groups.values()]
    }
  }

  // 用户与日志
  if (path === '/users' && method === 'get') {
    const rows = state.users.filter((row) => (!params.role || row.role === params.role) && (!params.keyword || has(row.username, params.keyword) || has(row.realName, params.keyword)))
    return paginate(rows.map(({ password, ...rest }) => rest), params)
  }
  if (path === '/users' && method === 'post') {
    if (state.users.some((row) => row.username === body.username)) throw new Error(`用户名 ${body.username} 已存在`)
    const created = { ...body, id: idOf(state.users), enabled: true }
    state.users.push(created)
    const { password, ...rest } = created
    return rest
  }
  if (segments[0] === 'users' && segments[2] === 'reset-password') {
    const user = state.users.find((row) => row.id === Number(segments[1]))
    if (!user) throw new Error('用户不存在')
    user.password = '123456'
    return true
  }
  if (segments[0] === 'users' && method === 'put') {
    const user = state.users.find((row) => row.id === Number(segments[1]))
    if (!user) throw new Error('用户不存在')
    Object.assign(user, body)
    const { password, ...rest } = user
    return rest
  }
  if (segments[0] === 'users' && method === 'delete') {
    const user = state.users.find((row) => row.id === Number(segments[1]))
    if (!user) throw new Error('用户不存在')
    user.enabled = false
    return true
  }
  if (path === '/logs') {
    const rows = state.logs.filter((row) => (!params.username || has(row.username, params.username)) && (!params.module || row.module === params.module))
    return paginate(rows, params)
  }

  throw new Error(`演示模式未实现该接口：${method.toUpperCase()} ${path}`)
}

// 所有辅助函数都已就绪，这里才开始生成演示数据（seed 内部会用到 billArrears 等）
seed()

let currentUsername = 'admin'
const api = { handle }

function mockAdapter(config) {
  return new Promise((resolve) => {
    const method = (config.method || 'get').toLowerCase()
    const params = { ...(config.params || {}) }
    let body = config.data
    if (typeof body === 'string' && body) {
      try {
        body = JSON.parse(body)
      } catch {
        body = {}
      }
    }
    const token = config.headers?.Authorization || config.headers?.get?.('Authorization')
    if (typeof token === 'string' && token.startsWith('Bearer demo-token-')) {
      currentUsername = token.replace('Bearer demo-token-', '')
    }
    try {
      const data = handle(method, config.url || '', params, body || {})
      resolve({ data: { code: 0, message: 'ok', data }, status: 200, statusText: 'OK', headers: {}, config })
    } catch (error) {
      resolve({
        data: { code: 1, message: error.message || '演示模式请求失败', data: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config
      })
    }
  })
}

export function isDemoMode() {
  return import.meta.env.VITE_DEMO_MODE === 'true'
}

export function installMockIfNeeded() {
  if (!isDemoMode()) return false
  request.defaults.adapter = mockAdapter
  // eslint-disable-next-line no-console
  console.info('[WYE] 在线 Demo 模式：所有接口由内置 mock 处理，数据仅存在浏览器内存中')
  return true
}

export { api }
