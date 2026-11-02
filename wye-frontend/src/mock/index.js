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
  role: { ADMIN: '管理员', CASHIER: '收费员', VIEWER: '只读' },
  accountType: { ADVANCE: '预收', DEPOSIT: '押金' },
  flowDirection: { IN: '转入', OUT: '转出' },
  fundBizType: { PAYMENT_ADVANCE: '收款转预收', ADVANCE_USE: '预收抵扣', DEPOSIT_IN: '收取押金', DEPOSIT_REFUND: '退还押金', ADVANCE_REFUND: '退还预收', IMPORT: '历史导入' }
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
  // ===== 二期 =====
  ledgers: [],
  accounts: [],
  fundFlows: [],
  approvals: [],
  bankContracts: [],
  bankBatches: [],
  bankBatchItems: [],
  noticeTemplates: [],
  notices: [],
  receipts: [],
  importLogs: [],
  portalOrders: [],
  portalSession: null,
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
    return { id: index + 1, name, code, type, chargeMode, unitPrice, priceUnit, period: 'MONTHLY', communityId: null, enabled: true, sortNo, lateFeeRate: index === 0 ? 0.0005 : 0, graceDays: index === 0 ? 5 : 0, remark: null }
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
      lateFee: 0,
      lateFeeAt: null,
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
  // ===== 二期演示数据 =====
  state.ledgers = [
    { id: 1, name: '阳光花园账套', code: 'YGHY', company: '阳光物业管理有限公司', enabled: true, remark: '默认账套', createdAt: `${periods[0]}-01 09:00:00` },
    { id: 2, name: '停车场账套', code: 'TCC', company: '阳光物业管理有限公司', enabled: true, remark: '车位费用单独核算', createdAt: `${periods[0]}-01 09:00:00` }
  ]
  state.communities[0].ledgerId = 1

  // 资金账户：预收余额由「收款未核销部分」推导，保持与流水一致
  state.accounts = state.rooms.map((room) => {
    const roomPayments = state.payments.filter((p) => p.roomId === room.id)
    const paid = roomPayments.reduce((acc, p) => acc + p.amount, 0)
    const used = state.allocations
      .filter((a) => roomPayments.some((p) => p.id === a.paymentId))
      .reduce((acc, a) => acc + a.amount, 0)
    return { roomId: room.id, advanceBalance: yuan(Math.max(0, paid - used)), depositBalance: 0 }
  })

  // 押金：部分房屋收取，并写流水
  const depositSeed = [
    ['1-101', 1000],
    ['1-102', 800],
    ['2-101', 800],
    ['3-101', 2000],
    ['3-102', 1500]
  ]
  depositSeed.forEach(([roomNo, amount], index) => {
    const room = state.rooms.find((r) => r.roomNo === roomNo)
    if (!room) return
    const account = state.accounts.find((a) => a.roomId === room.id)
    account.depositBalance = yuan(account.depositBalance + amount)
    state.fundFlows.push({
      id: idOf(state.fundFlows),
      roomId: room.id,
      accountType: 'DEPOSIT',
      direction: 'IN',
      amount: yuan(amount),
      balanceAfter: account.depositBalance,
      bizType: 'DEPOSIT_IN',
      refType: 'PAYMENT',
      refId: null,
      operator: 'admin',
      remark: '入住押金',
      occurredAt: `${periods[0]}-05 10:${String(10 + index).padStart(2, '0')}:00`
    })
  })

  // 预收流水
  state.accounts
    .filter((a) => a.advanceBalance > 0)
    .forEach((account) => {
      state.fundFlows.push({
        id: idOf(state.fundFlows),
        roomId: account.roomId,
        accountType: 'ADVANCE',
        direction: 'IN',
        amount: account.advanceBalance,
        balanceAfter: account.advanceBalance,
        bizType: 'PAYMENT_ADVANCE',
        refType: 'PAYMENT',
        refId: null,
        operator: 'admin',
        remark: '收款未核销部分转预收',
        occurredAt: `${periods[2]}-08 10:30:00`
      })
    })

  // 银行代扣签约（只落掩码）
  const contractSeed = [
    ['1-101', '中国工商银行', '6222', '1234'],
    ['1-102', '中国建设银行', '6227', '5678'],
    ['2-101', '招商银行', '6214', '4321'],
    ['2-201', '中国农业银行', '6228', '8765']
  ]
  state.bankContracts = contractSeed.map(([roomNo, bankName, prefix, suffix], index) => {
    const room = state.rooms.find((r) => r.roomNo === roomNo)
    const owner = ownerOf(room.id)
    return {
      id: index + 1,
      roomId: room.id,
      bankName,
      accountName: owner?.name || '业主',
      accountNoMasked: `${prefix}****${suffix}`,
      contractNo: `HT${dayjs().format('YYYYMM')}${String(index + 1).padStart(4, '0')}`,
      status: 'ACTIVE',
      signedAt: `${periods[0]}-06`,
      remark: null
    }
  })

  // 通知模板
  state.noticeTemplates = [
    { id: 1, name: '物业费催缴短信', channel: 'SMS', title: null, content: '【WYE物业】{业主}您好，{小区}{房号} {账期} 应缴 {金额} 元，应缴日 {应缴日}，请及时缴纳。', enabled: true },
    { id: 2, name: '欠费提醒邮件', channel: 'EMAIL', title: '{小区}{房号} {账期} 费用提醒', content: '尊敬的{业主}：您{房号}的{账期}账单应缴 {金额} 元，应缴截止 {应缴日}，请尽快办理。', enabled: true }
  ]

  // 通知发送记录
  const noticeRoom = state.rooms.find((r) => r.roomNo === '1-102')
  const noticeOwner = ownerOf(noticeRoom.id)
  state.notices = [
    {
      id: 1,
      channel: 'SMS',
      templateId: 1,
      roomId: noticeRoom.id,
      billId: null,
      receiver: maskPhone(noticeOwner?.phone),
      content: `【WYE物业】${noticeOwner?.name || '业主'}您好，1-102 ${periods[2]} 账单请及时缴纳。`,
      status: 'SENT',
      provider: 'mock',
      providerMsg: 'mock 通道已发送',
      sentAt: `${periods[2]}-09 09:30:00`,
      operator: 'admin'
    }
  ]

  // 收据（挂在前两笔收款单上）
  state.receipts = state.payments.slice(0, 2).map((payment, index) => {
    const room = roomOf(payment.roomId)
    const owner = ownerOf(room.id)
    return {
      id: index + 1,
      receiptNo: `S${dayjs(payment.paidAt.slice(0, 10)).format('YYYYMMDD')}${String(index + 1).padStart(4, '0')}`,
      type: index === 1 ? 'INVOICE' : 'RECEIPT',
      paymentId: payment.id,
      roomId: room.id,
      title: owner?.name || '业主',
      taxNo: null,
      amount: yuan(payment.amount),
      status: 'ISSUED',
      issuedAt: payment.paidAt,
      operator: 'admin',
      voidReason: null
    }
  })

  // 审批单：一张已通过（供退款选择）、一张待审批
  const refundRoom = state.rooms.find((r) => r.roomNo === '1-202')
  const pendingBill = state.bills.find((b) => b.status === 'UNPAID')
  state.approvals = [
    {
      id: 1,
      approvalNo: `SP${dayjs().format('YYYYMM')}0001`,
      type: 'ADVANCE_REFUND',
      targetType: 'ROOM_ACCOUNT',
      targetId: refundRoom.id,
      roomId: refundRoom.id,
      amount: 200,
      payload: JSON.stringify({ accountType: 'ADVANCE' }),
      reason: '业主申请退回多缴预收',
      applicant: 'cashier',
      status: 'APPROVED',
      approver: 'admin',
      approveRemark: '同意退还',
      decidedAt: `${periods[2]}-09 15:00:00`,
      createdAt: `${periods[2]}-09 14:00:00`
    },
    {
      id: 2,
      approvalNo: `SP${dayjs().format('YYYYMM')}0002`,
      type: 'BILL_DISCOUNT',
      targetType: 'BILL',
      targetId: pendingBill?.id || null,
      roomId: pendingBill?.roomId || null,
      amount: 150,
      payload: JSON.stringify({ discount: 150 }),
      reason: '困难户减免申请',
      applicant: 'cashier',
      status: 'PENDING',
      approver: null,
      approveRemark: null,
      decidedAt: null,
      createdAt: `${periods[2]}-10 10:00:00`
    }
  ]

  // 导入记录
  state.importLogs = [
    { id: 1, type: 'rooms', fileName: '房屋模板.csv', totalCount: 1, successCount: 1, failCount: 0, detail: '[]', operator: 'admin', createdAt: `${periods[0]}-02 09:10:00` },
    { id: 2, type: 'advances', fileName: '历史预收押金.csv', totalCount: 2, successCount: 1, failCount: 1, detail: JSON.stringify([{ line: 3, message: '房号 9-999 不存在' }]), operator: 'admin', createdAt: `${periods[0]}-02 09:20:00` }
  ]

  state.periods = periods
}

// ---------------- 查询辅助 ----------------
const billNet = (bill) => yuan(bill.amount - bill.discount + (bill.lateFee || 0))
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

// ---------------- 二期查询辅助 ----------------
const accountOf = (roomId) =>
  state.accounts.find((row) => row.roomId === Number(roomId)) || { roomId: Number(roomId), advanceBalance: 0, depositBalance: 0 }

function roomArrears(roomId) {
  return yuan(
    state.bills.filter((bill) => bill.roomId === roomId && bill.status !== 'VOID').reduce((acc, bill) => acc + billArrears(bill), 0)
  )
}

function accountVO(account) {
  const room = roomOf(account.roomId)
  const owner = ownerOf(account.roomId)
  return {
    roomId: account.roomId,
    roomNo: room?.roomNo,
    communityId: room?.communityId,
    communityName: communityOf(room?.communityId)?.name,
    buildingId: room?.buildingId,
    buildingName: buildingOf(room?.buildingId)?.name,
    ownerName: owner?.name || '未登记',
    advanceBalance: yuan(account.advanceBalance),
    depositBalance: yuan(account.depositBalance),
    arrears: roomArrears(account.roomId)
  }
}

function flowVO(flow) {
  const room = roomOf(flow.roomId)
  const owner = ownerOf(flow.roomId)
  return { ...flow, roomNo: room?.roomNo, ownerName: owner?.name || '未登记', communityId: room?.communityId }
}

function approvalVO(row) {
  const room = roomOf(row.roomId)
  const owner = ownerOf(row.roomId)
  return { ...row, roomNo: room?.roomNo, ownerName: owner?.name || '未登记' }
}

function noticeVO(row) {
  const room = roomOf(row.roomId)
  return { ...row, roomNo: room?.roomNo }
}

function receiptVO(row) {
  const room = roomOf(row.roomId)
  return { ...row, roomNo: room?.roomNo, communityName: communityOf(room?.communityId)?.name }
}

function bankContractVO(row) {
  const room = roomOf(row.roomId)
  const owner = ownerOf(row.roomId)
  return { ...row, roomNo: room?.roomNo, ownerName: owner?.name || '未登记' }
}

function bankBatchVO(row, withItems = false) {
  const vo = { ...row, communityName: communityOf(row.communityId)?.name }
  if (withItems) {
    vo.items = state.bankBatchItems
      .filter((item) => item.batchId === row.id)
      .map((item) => ({ ...item, roomNo: roomOf(item.roomId)?.roomNo }))
  }
  return vo
}

/** 写资金流水并同步账户余额（余额只能由流水推导） */
function writeFundFlow(roomId, accountType, direction, amount, bizType, refType, refId, remark, occurredAt) {
  const account = accountOf(roomId)
  const delta = direction === 'IN' ? yuan(amount) : -yuan(amount)
  if (accountType === 'DEPOSIT') account.depositBalance = yuan(account.depositBalance + delta)
  else account.advanceBalance = yuan(account.advanceBalance + delta)
  const balanceAfter = accountType === 'DEPOSIT' ? account.depositBalance : account.advanceBalance
  state.fundFlows.push({
    id: idOf(state.fundFlows),
    roomId: Number(roomId),
    accountType,
    direction,
    amount: yuan(amount),
    balanceAfter,
    bizType,
    refType: refType || null,
    refId: refId || null,
    operator: currentUsername || 'admin',
    remark: remark || null,
    occurredAt: occurredAt || dayjs().format('YYYY-MM-DD HH:mm:ss')
  })
  return balanceAfter
}

/** 按应缴日顺序核销房屋欠费，返回核销明细与剩余金额 */
function allocateBills(roomId, amount, billIds, paymentId) {
  const targets = state.bills
    .filter((bill) => bill.roomId === Number(roomId) && bill.status !== 'VOID' && (!billIds?.length || billIds.map(Number).includes(bill.id)))
    .sort((a, b) => {
      const da = a.dueDate || '9999-99-99'
      const db = b.dueDate || '9999-99-99'
      return da === db ? a.id - b.id : da < db ? -1 : 1
    })
  let remaining = yuan(amount)
  const allocations = []
  for (const bill of targets) {
    if (remaining <= 0) break
    const due = billArrears(bill)
    if (due <= 0) continue
    const alloc = yuan(Math.min(due, remaining))
    bill.paidAmount = yuan(bill.paidAmount + alloc)
    bill.status = bill.paidAmount >= billNet(bill) ? 'PAID' : 'PARTIAL'
    if (paymentId) {
      state.allocations.push({ id: idOf(state.allocations), paymentId, billId: bill.id, amount: alloc })
    }
    allocations.push({ billId: bill.id, billNo: bill.billNo, period: bill.period, feeItemName: feeItemOf(bill.feeItemId)?.name, amount: alloc })
    remaining = yuan(remaining - alloc)
  }
  return { allocations, remaining: yuan(Math.max(0, remaining)) }
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
        lateFee: 0,
        lateFeeAt: null,
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

// ---------------- 二期：导入 / 导出 / 门户辅助 ----------------
function requirePortal() {
  if (!state.portalSession) throw new Error('登录已失效，请重新登录')
  return state.portalSession
}

function csvCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvText(headers, rows) {
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** 导入：逐行校验，返回 { total, success, failed, errors } */
function runImport(type, body) {
  const lines = String(body.content || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length) throw new Error('导入内容为空')
  const rows = lines.slice(1) // 首行表头
  const errors = []
  let success = 0

  const findCommunity = (code) => state.communities.find((c) => c.code === code || c.name === code) || state.communities[0]
  const findRoom = (community, roomNo) => state.rooms.find((r) => r.communityId === community?.id && r.roomNo === roomNo)

  rows.forEach((line, index) => {
    const lineNo = index + 2
    const cols = line.split(',').map((cell) => cell.trim())
    try {
      if (type === 'rooms') {
        const [communityCode, buildingName, unit, roomNo, floor, area, roomType, status] = cols
        const community = findCommunity(communityCode)
        if (!community) throw new Error('小区不存在')
        if (!roomNo) throw new Error('房号不能为空')
        if (state.rooms.some((r) => r.communityId === community.id && r.roomNo === roomNo)) throw new Error(`房号 ${roomNo} 已存在`)
        let building = state.buildings.find((b) => b.communityId === community.id && b.name === buildingName)
        if (!building) {
          building = { id: idOf(state.buildings), communityId: community.id, name: buildingName || '未命名楼栋', unitCount: 1, remark: null }
          state.buildings.push(building)
        }
        state.rooms.push({ id: idOf(state.rooms), communityId: community.id, buildingId: building.id, unit: unit || null, roomNo, floor: floor ? Number(floor) : null, area: area ? Number(area) : 0, roomType: roomType || 'RESIDENCE', status: status || 'VACANT', remark: null })
        success += 1
      } else if (type === 'residents') {
        const [communityCode, roomNo, name, phone, idCard, residentType, startDate] = cols
        const community = findCommunity(communityCode)
        const room = findRoom(community, roomNo)
        if (!room) throw new Error(`房号 ${roomNo} 不存在`)
        if (!name) throw new Error('姓名不能为空')
        state.residents.push({ id: idOf(state.residents), roomId: room.id, name, phone: phone || null, idCard: idCard || null, residentType: residentType || 'OWNER', startDate: startDate || null, endDate: null, status: 'LIVING', remark: null })
        success += 1
      } else if (type === 'arrears') {
        const [communityCode, roomNo, feeCode, period, amount, dueDate] = cols
        const community = findCommunity(communityCode)
        const room = findRoom(community, roomNo)
        if (!room) throw new Error(`房号 ${roomNo} 不存在`)
        const feeItem = state.feeItems.find((f) => f.code === feeCode || f.name === feeCode)
        if (!feeItem) throw new Error(`收费项目 ${feeCode} 不存在`)
        if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(period || ''))) throw new Error('账期格式应为 yyyy-MM')
        if (state.bills.some((b) => b.roomId === room.id && b.feeItemId === feeItem.id && b.period === period && b.status !== 'VOID')) throw new Error('该账期同项目账单已存在')
        const qty = feeItem.chargeMode === 'AREA' ? room.area : 1
        state.bills.push({ id: idOf(state.bills), billNo: nextNo('B', String(period).replace('-', '')), communityId: room.communityId, roomId: room.id, feeItemId: feeItem.id, period, chargeMode: feeItem.chargeMode, quantity: yuan(qty), unitPrice: feeItem.unitPrice, amount: yuan(amount), discount: 0, lateFee: 0, lateFeeAt: null, paidAmount: 0, status: 'UNPAID', dueDate: dueDate || dayjs(`${period}-01`).add(1, 'month').date(10).format('YYYY-MM-DD'), generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'), remark: '历史欠费导入', voidReason: null })
        success += 1
      } else if (type === 'advances') {
        const [communityCode, roomNo, accountText, amount, remark] = cols
        const community = findCommunity(communityCode)
        const room = findRoom(community, roomNo)
        if (!room) throw new Error(`房号 ${roomNo} 不存在`)
        const isDeposit = /押金|DEPOSIT/i.test(accountText || '')
        const accountType = isDeposit ? 'DEPOSIT' : 'ADVANCE'
        const value = yuan(amount)
        if (value <= 0) throw new Error('金额必须大于 0')
        writeFundFlow(room.id, accountType, 'IN', value, 'IMPORT', 'IMPORT', null, remark || '历史导入', null)
        success += 1
      } else {
        throw new Error(`不支持的导入类型：${type}`)
      }
    } catch (error) {
      errors.push({ line: lineNo, message: error.message })
    }
  })

  return { total: rows.length, success, failed: errors.length, errors }
}

/** 导出：按类型生成 UTF-8 BOM CSV 文本 */
function buildExportCsv(type, params = {}) {
  const label = (key, value) => LABEL[key]?.[value] || value || ''
  if (type === 'rooms') {
    const rows = state.rooms
      .filter((room) => (!params.communityId || room.communityId === Number(params.communityId)) && (!params.buildingId || room.buildingId === Number(params.buildingId)) && (!params.roomType || room.roomType === params.roomType) && (!params.status || room.status === params.status) && (!params.keyword || has(room.roomNo, params.keyword)))
      .map((room) => [communityOf(room.communityId)?.code, buildingOf(room.buildingId)?.name, room.unit, room.roomNo, room.floor, room.area, label('roomType', room.roomType), label('roomStatus', room.status)])
    return csvText(['小区编码', '楼栋', '单元', '房号', '楼层', '面积', '房屋类型', '使用状态'], rows)
  }
  if (type === 'residents') {
    const rows = state.residents
      .filter((row) => (!params.communityId || roomOf(row.roomId)?.communityId === Number(params.communityId)) && (!params.roomId || row.roomId === Number(params.roomId)) && (!params.keyword || has(row.name, params.keyword) || has(row.phone, params.keyword)))
      .map((row) => {
        const room = roomOf(row.roomId)
        return [communityOf(room?.communityId)?.code, room?.roomNo, row.name, row.phone, row.idCard, label('residentType', row.residentType), row.startDate]
      })
    return csvText(['小区编码', '房号', '姓名', '电话', '证件号', '住户类型', '入住日期'], rows)
  }
  if (type === 'bills') {
    const rows = state.bills
      .filter((bill) => (!params.period || bill.period === params.period) && (!params.communityId || bill.communityId === Number(params.communityId)) && (!params.status || bill.status === params.status) && (!params.roomId || bill.roomId === Number(params.roomId)))
      .map((bill) => {
        const room = roomOf(bill.roomId)
        return [bill.billNo, communityOf(bill.communityId)?.name, buildingOf(room?.buildingId)?.name, room?.roomNo, feeItemOf(bill.feeItemId)?.name, bill.period, label('chargeMode', bill.chargeMode), bill.quantity, bill.unitPrice, bill.amount, bill.discount, bill.lateFee || 0, billNet(bill), bill.paidAmount, billArrears(bill), label('billStatus', bill.status), bill.dueDate]
      })
    return csvText(['账单号', '小区', '楼栋', '房号', '收费项目', '账期', '计费方式', '数量', '单价', '金额', '减免', '滞纳金', '应收', '已收', '欠费', '状态', '应缴日'], rows)
  }
  if (type === 'arrears') {
    const rows = state.bills
      .filter((bill) => bill.status !== 'VOID' && billArrears(bill) > 0 && (!params.period || bill.period === params.period) && (!params.communityId || bill.communityId === Number(params.communityId)))
      .map((bill) => {
        const room = roomOf(bill.roomId)
        return [communityOf(bill.communityId)?.code, room?.roomNo, feeItemOf(bill.feeItemId)?.code, bill.period, billArrears(bill), bill.dueDate]
      })
    return csvText(['小区编码', '房号', '收费项目编码', '账期', '金额', '应缴日'], rows)
  }
  if (type === 'payments') {
    const rows = state.payments
      .filter((payment) => (!params.communityId || payment.communityId === Number(params.communityId)) && (!params.roomId || payment.roomId === Number(params.roomId)) && (!params.method || payment.method === params.method))
      .map((payment) => {
        const vo = paymentVO(payment)
        return [payment.paymentNo, communityOf(payment.communityId)?.name, vo.roomNo, payment.amount, label('paymentMethod', payment.method), payment.paidAt, payment.operator, vo.allocatedAmount, vo.advanceAmount, payment.remark]
      })
    return csvText(['收款单号', '小区', '房号', '金额', '方式', '收款时间', '操作人', '已核销', '预收', '备注'], rows)
  }
  if (type === 'fund-flows') {
    const rows = state.fundFlows
      .filter((flow) => (!params.roomId || flow.roomId === Number(params.roomId)) && (!params.accountType || flow.accountType === params.accountType) && (!params.bizType || flow.bizType === params.bizType) && (!params.from || flow.occurredAt.slice(0, 10) >= params.from) && (!params.to || flow.occurredAt.slice(0, 10) <= params.to))
      .map((flow) => [flow.occurredAt, communityOf(roomOf(flow.roomId)?.communityId)?.name, roomOf(flow.roomId)?.roomNo, label('accountType', flow.accountType), label('flowDirection', flow.direction), label('fundBizType', flow.bizType), flow.amount, flow.balanceAfter, flow.operator, flow.remark])
    return csvText(['时间', '小区', '房号', '账户类型', '方向', '业务类型', '金额', '变动后余额', '操作人', '备注'], rows)
  }
  throw new Error(`不支持的导出类型：${type}`)
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

  // ==================== 二期接口实现 ====================

  // ---------- 账套 ----------
  if (path === '/ledgers' && method === 'get') {
    const rows = state.ledgers.filter((row) => !params.keyword || has(row.name, params.keyword) || has(row.code, params.keyword))
    return {
      list: rows.map((row) => ({ ...row, communityCount: state.communities.filter((c) => c.ledgerId === row.id).length })),
      total: rows.length,
      page: 1,
      size: rows.length
    }
  }
  if (path === '/ledgers/options') {
    return state.ledgers.filter((row) => row.enabled !== false).map((row) => ({ id: row.id, label: row.name }))
  }
  if (path === '/ledgers' && method === 'post') {
    if (state.ledgers.some((row) => row.code === body.code)) throw new Error(`账套编码 ${body.code} 已存在`)
    const created = { ...body, id: idOf(state.ledgers), enabled: body.enabled !== false, createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
    state.ledgers.push(created)
    return created
  }
  if (segments[0] === 'ledgers' && segments[1] && method === 'put') {
    const row = ledgerOf(segments[1])
    if (!row) throw new Error('账套不存在')
    Object.assign(row, body, { id: row.id })
    return row
  }
  if (segments[0] === 'ledgers' && segments[1] && method === 'delete') {
    const row = ledgerOf(segments[1])
    if (!row) throw new Error('账套不存在')
    if (state.communities.some((c) => c.ledgerId === row.id)) throw new Error('该账套下仍有小区，无法删除')
    state.ledgers.splice(state.ledgers.indexOf(row), 1)
    return true
  }

  // ---------- 资金账户与流水 ----------
  if (path === '/accounts' && method === 'get') {
    const rows = state.accounts
      .map(accountVO)
      .filter(
        (row) =>
          (!params.communityId || row.communityId === Number(params.communityId)) &&
          (!params.buildingId || row.buildingId === Number(params.buildingId)) &&
          (!params.roomId || row.roomId === Number(params.roomId)) &&
          (!params.keyword || has(row.roomNo, params.keyword) || has(row.ownerName, params.keyword)) &&
          (String(params.nonzero) !== 'true' || row.advanceBalance > 0 || row.depositBalance > 0 || row.arrears > 0)
      )
    return paginate(rows, params)
  }
  if (path === '/accounts/deposit' && method === 'post') {
    const room = roomOf(Number(body.roomId))
    if (!room) throw new Error('房屋不存在')
    const amount = yuan(body.amount)
    if (amount <= 0) throw new Error('押金金额必须大于 0')
    const balance = writeFundFlow(room.id, 'DEPOSIT', 'IN', amount, 'DEPOSIT_IN', 'PAYMENT', null, body.remark || '收取押金', body.paidAt)
    return { roomId: room.id, depositBalance: balance }
  }
  if (path === '/accounts/advance/use' && method === 'post') {
    const room = roomOf(Number(body.roomId))
    if (!room) throw new Error('房屋不存在')
    if (accountOf(room.id).advanceBalance <= 0) throw new Error('该房屋没有可用的预收余额')
    const limit = body.amount ? Math.min(yuan(body.amount), accountOf(room.id).advanceBalance) : accountOf(room.id).advanceBalance
    const { allocations, remaining } = allocateBills(room.id, limit, body.billIds, null)
    const used = yuan(limit - remaining)
    if (used <= 0) throw new Error('没有可抵扣的欠费账单')
    writeFundFlow(room.id, 'ADVANCE', 'OUT', used, 'ADVANCE_USE', 'ALLOCATION', null, body.remark || '预收抵扣', null)
    return { usedAmount: used, remainingAdvance: accountOf(room.id).advanceBalance, allocations }
  }
  if (path === '/accounts/refund' && method === 'post') {
    const room = roomOf(Number(body.roomId))
    if (!room) throw new Error('房屋不存在')
    if (!body.approvalNo) throw new Error('退款需先提交审批')
    const approval = state.approvals.find((row) => row.approvalNo === body.approvalNo && row.status === 'APPROVED')
    if (!approval) throw new Error('未找到已通过的审批单，请先提交审批')
    const accountType = body.accountType === 'DEPOSIT' ? 'DEPOSIT' : 'ADVANCE'
    const amount = yuan(body.amount)
    if (amount <= 0) throw new Error('退款金额必须大于 0')
    const balance = accountType === 'DEPOSIT' ? accountOf(room.id).depositBalance : accountOf(room.id).advanceBalance
    if (amount > balance) throw new Error('退款金额不能大于可用余额')
    const after = writeFundFlow(room.id, accountType, 'OUT', amount, accountType === 'DEPOSIT' ? 'DEPOSIT_REFUND' : 'ADVANCE_REFUND', 'APPROVAL', approval.id, body.remark || '退款', null)
    return { roomId: room.id, accountType, refundAmount: amount, balanceAfter: after }
  }
  if (segments[0] === 'accounts' && segments[1] && method === 'get') {
    const roomId = Number(segments[1])
    const vo = accountVO(accountOf(roomId))
    vo.flows = state.fundFlows
      .filter((flow) => flow.roomId === roomId)
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
      .slice(0, 50)
      .map(flowVO)
    return vo
  }
  if (path === '/fund-flows' && method === 'get') {
    const rows = state.fundFlows
      .filter(
        (flow) =>
          (!params.roomId || flow.roomId === Number(params.roomId)) &&
          (!params.accountType || flow.accountType === params.accountType) &&
          (!params.bizType || flow.bizType === params.bizType) &&
          (!params.from || flow.occurredAt.slice(0, 10) >= params.from) &&
          (!params.to || flow.occurredAt.slice(0, 10) <= params.to) &&
          (!params.keyword || has(roomOf(flow.roomId)?.roomNo, params.keyword) || has(flow.remark, params.keyword))
      )
      .sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1))
    return paginate(rows.map(flowVO), params)
  }

  // ---------- 计提滞纳金 ----------
  if (path === '/bills/late-fee' && method === 'post') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.period || ''))) throw new Error('账期格式不正确，应为 yyyy-MM')
    let updated = 0
    let skipped = 0
    let total = 0
    const stamp = dayjs().format('YYYY-MM-DD HH:mm:ss')
    state.bills
      .filter(
        (bill) =>
          bill.period === body.period &&
          bill.status !== 'VOID' &&
          (!body.communityId || bill.communityId === Number(body.communityId)) &&
          (!body.buildingId || roomOf(bill.roomId)?.buildingId === Number(body.buildingId)) &&
          (!body.feeItemIds?.length || body.feeItemIds.map(Number).includes(bill.feeItemId))
      )
      .forEach((bill) => {
        const feeItem = feeItemOf(bill.feeItemId)
        const rate = feeItem?.lateFeeRate || 0
        const grace = feeItem?.graceDays || 0
        const overdue = Math.max(0, dayjs().diff(dayjs(bill.dueDate), 'day') - grace)
        if (!rate || overdue <= 0 || bill.status === 'PAID') {
          skipped += 1
          return
        }
        bill.lateFee = yuan(yuan(bill.amount - bill.discount) * overdue * rate)
        bill.lateFeeAt = stamp
        updated += 1
        total = yuan(total + bill.lateFee)
      })
    return { updated, totalLateFee: total, skipped }
  }

  // ---------- 银行代扣：签约 ----------
  if (path === '/bank-contracts' && method === 'get') {
    const rows = state.bankContracts
      .filter(
        (row) =>
          (!params.roomId || row.roomId === Number(params.roomId)) &&
          (!params.status || row.status === params.status) &&
          (!params.keyword || has(roomOf(row.roomId)?.roomNo, params.keyword) || has(row.accountName, params.keyword) || has(row.contractNo, params.keyword))
      )
      .map(bankContractVO)
    return paginate(rows, params)
  }
  if (path === '/bank-contracts' && method === 'post') {
    const room = roomOf(Number(body.roomId))
    if (!room) throw new Error('房屋不存在')
    if (!/^\d{4}\*{4}\d{4}$/.test(String(body.accountNoMasked || ''))) throw new Error('账号掩码格式不正确，如 6222****1234')
    const created = {
      ...body,
      id: idOf(state.bankContracts),
      roomId: room.id,
      status: body.status || 'ACTIVE',
      signedAt: body.signedAt || dayjs().format('YYYY-MM-DD')
    }
    state.bankContracts.push(created)
    return bankContractVO(created)
  }
  if (segments[0] === 'bank-contracts' && segments[1] && method === 'put') {
    const row = state.bankContracts.find((item) => item.id === Number(segments[1]))
    if (!row) throw new Error('签约记录不存在')
    Object.assign(row, body, { id: row.id })
    return bankContractVO(row)
  }
  if (segments[0] === 'bank-contracts' && segments[1] && method === 'delete') {
    const row = state.bankContracts.find((item) => item.id === Number(segments[1]))
    if (!row) throw new Error('签约记录不存在')
    row.status = 'CANCELLED'
    return true
  }

  // ---------- 银行代扣：批次 ----------
  if (path === '/bank-batches' && method === 'get') {
    const rows = state.bankBatches
      .filter(
        (row) =>
          (!params.period || row.period === params.period) &&
          (!params.status || row.status === params.status) &&
          (!params.communityId || row.communityId === Number(params.communityId))
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((row) => bankBatchVO(row))
    return paginate(rows, params)
  }
  if (path === '/bank-batches/generate' && method === 'post') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(body.period || ''))) throw new Error('账期格式不正确，应为 yyyy-MM')
    const contracts = state.bankContracts.filter(
      (row) =>
        row.status === 'ACTIVE' &&
        (!body.communityId || roomOf(row.roomId)?.communityId === Number(body.communityId)) &&
        (!body.buildingId || roomOf(row.roomId)?.buildingId === Number(body.buildingId))
    )
    const items = []
    contracts.forEach((contract) => {
      const bills = state.bills.filter(
        (bill) =>
          bill.roomId === contract.roomId &&
          bill.period === body.period &&
          bill.status !== 'VOID' &&
          (!body.feeItemIds?.length || body.feeItemIds.map(Number).includes(bill.feeItemId))
      )
      const amount = yuan(bills.reduce((acc, bill) => acc + billArrears(bill), 0))
      if (amount <= 0) return
      items.push({ roomId: contract.roomId, billId: bills[0]?.id || null, amount, result: 'PENDING', failReason: null, accountName: contract.accountName, accountNoMasked: contract.accountNoMasked })
    })
    if (!items.length) throw new Error('没有符合条件的代扣房屋（需已签约且该账期有欠费）')
    const batchId = idOf(state.bankBatches)
    const batch = {
      id: batchId,
      batchNo: `BATCH${String(body.period).replace('-', '')}${String(batchId).padStart(4, '0')}`,
      period: body.period,
      communityId: body.communityId ? Number(body.communityId) : null,
      totalCount: items.length,
      totalAmount: yuan(items.reduce((acc, item) => acc + item.amount, 0)),
      successCount: 0,
      failCount: 0,
      status: 'GENERATED',
      fileName: null,
      operator: currentUsername || 'admin',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      returnedAt: null
    }
    state.bankBatches.push(batch)
    items.forEach((item) => state.bankBatchItems.push({ id: idOf(state.bankBatchItems), batchId, ...item }))
    return bankBatchVO(batch, true)
  }
  if (segments[0] === 'bank-batches' && segments[1] && segments[2] === 'export' && method === 'get') {
    const batch = state.bankBatches.find((row) => row.id === Number(segments[1]))
    if (!batch) throw new Error('批次不存在')
    const rows = state.bankBatchItems
      .filter((item) => item.batchId === batch.id)
      .map((item) => {
        const room = roomOf(item.roomId)
        const contract = state.bankContracts.find((row) => row.roomId === item.roomId && row.status === 'ACTIVE')
        return [room?.roomNo, item.accountName, item.accountNoMasked, yuan(item.amount).toFixed(2), batch.period, contract?.contractNo || '']
      })
    return csvText(['房号', '户名', '账号', '金额(元)', '账期', '签约号'], rows)
  }
  if (segments[0] === 'bank-batches' && segments[1] && segments[2] === 'return' && method === 'post') {
    const batch = state.bankBatches.find((row) => row.id === Number(segments[1]))
    if (!batch) throw new Error('批次不存在')
    if (batch.status === 'CLOSED') throw new Error('批次已关闭，不能回盘')
    const lines = String(body.content || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    if (!lines.length) throw new Error('回盘内容为空')
    const start = /房号/.test(lines[0]) ? 1 : 0
    let success = 0
    let failed = 0
    let total = 0
    for (let i = start; i < lines.length; i += 1) {
      const cols = lines[i].split(',').map((cell) => cell.trim())
      const [roomNo, amountText, resultText, reason] = cols
      const room = state.rooms.find((row) => row.roomNo === roomNo)
      const item = room ? state.bankBatchItems.find((row) => row.batchId === batch.id && row.roomId === room.id) : null
      if (!item) {
        failed += 1
        continue
      }
      if (/成功|SUCCESS|true/i.test(resultText || '')) {
        item.result = 'SUCCESS'
        item.failReason = null
        success += 1
        const amount = yuan(amountText) || item.amount
        total = yuan(total + amount)
        const payment = {
          id: idOf(state.payments),
          paymentNo: nextNo('P', dayjs().format('YYYYMMDD')),
          communityId: room.communityId,
          roomId: room.id,
          amount,
          method: 'BANK_DEDUCT',
          paidAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          operator: currentUsername || 'admin',
          remark: `代扣回盘 ${batch.batchNo}`,
          channel: 'COUNTER'
        }
        state.payments.push(payment)
        allocateBills(room.id, amount, item.billId ? [item.billId] : null, payment.id)
      } else {
        item.result = 'FAIL'
        item.failReason = reason || '银行返回失败'
        failed += 1
      }
    }
    batch.successCount = (batch.successCount || 0) + success
    batch.failCount = (batch.failCount || 0) + failed
    batch.status = 'RETURNED'
    batch.returnedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    return { success, failed, totalAmount: total }
  }
  if (segments[0] === 'bank-batches' && segments[1] && segments[2] === 'close' && method === 'post') {
    const batch = state.bankBatches.find((row) => row.id === Number(segments[1]))
    if (!batch) throw new Error('批次不存在')
    batch.status = 'CLOSED'
    return bankBatchVO(batch)
  }
  if (segments[0] === 'bank-batches' && segments[1] && method === 'get') {
    const batch = state.bankBatches.find((row) => row.id === Number(segments[1]))
    if (!batch) throw new Error('批次不存在')
    return bankBatchVO(batch, true)
  }

  // ---------- 催缴通知：模板 ----------
  if (path === '/notice-templates' && method === 'get') {
    const rows = state.noticeTemplates.filter((row) => !params.keyword || has(row.name, params.keyword))
    return { list: rows, total: rows.length, page: 1, size: rows.length }
  }
  if (path === '/notice-templates' && method === 'post') {
    const created = { ...body, id: idOf(state.noticeTemplates), enabled: body.enabled !== false }
    state.noticeTemplates.push(created)
    return created
  }
  if (segments[0] === 'notice-templates' && segments[1] && method === 'put') {
    const row = state.noticeTemplates.find((item) => item.id === Number(segments[1]))
    if (!row) throw new Error('模板不存在')
    Object.assign(row, body, { id: row.id })
    return row
  }
  if (segments[0] === 'notice-templates' && segments[1] && method === 'delete') {
    const index = state.noticeTemplates.findIndex((item) => item.id === Number(segments[1]))
    if (index < 0) throw new Error('模板不存在')
    state.noticeTemplates.splice(index, 1)
    return true
  }

  // ---------- 催缴通知：记录与发送 ----------
  if (path === '/notices' && method === 'get') {
    const rows = state.notices
      .filter(
        (row) =>
          (!params.channel || row.channel === params.channel) &&
          (!params.status || row.status === params.status) &&
          (!params.roomId || row.roomId === Number(params.roomId)) &&
          (!params.from || (row.sentAt || '').slice(0, 10) >= params.from) &&
          (!params.to || (row.sentAt || '').slice(0, 10) <= params.to) &&
          (!params.keyword || has(row.receiver, params.keyword) || has(roomOf(row.roomId)?.roomNo, params.keyword))
      )
      .sort((a, b) => ((a.sentAt || '') < (b.sentAt || '') ? 1 : -1))
      .map(noticeVO)
    return paginate(rows, params)
  }
  if (path === '/notices/send' && method === 'post') {
    const template = state.noticeTemplates.find((row) => row.id === Number(body.templateId))
    if (!template) throw new Error('通知模板不存在')
    let bills = []
    if (body.billIds?.length) {
      bills = state.bills.filter((bill) => body.billIds.map(Number).includes(bill.id))
    } else if (body.roomIds?.length) {
      bills = state.bills.filter((bill) => body.roomIds.map(Number).includes(bill.roomId) && bill.status !== 'VOID' && billArrears(bill) > 0)
    } else if (body.period) {
      bills = state.bills.filter((bill) => bill.period === body.period && bill.status !== 'VOID' && billArrears(bill) > 0)
    }
    if (!bills.length) throw new Error('没有可发送的欠费账单')
    const render = (text, bill) => {
      const room = roomOf(bill.roomId)
      const owner = ownerOf(bill.roomId)
      return String(text || '')
        .replace(/\{业主\}/g, owner?.name || '业主')
        .replace(/\{房号\}/g, room?.roomNo || '')
        .replace(/\{小区\}/g, communityOf(room?.communityId)?.name || '')
        .replace(/\{账期\}/g, bill.period || '')
        .replace(/\{金额\}/g, billArrears(bill).toFixed(2))
        .replace(/\{应缴日\}/g, bill.dueDate || '')
    }
    const stamp = dayjs().format('YYYY-MM-DD HH:mm:ss')
    const notices = bills.map((bill) => {
      const owner = ownerOf(bill.roomId)
      return {
        id: idOf(state.notices),
        channel: body.channel || template.channel,
        templateId: template.id,
        roomId: bill.roomId,
        billId: bill.id,
        receiver: maskPhone(owner?.phone) || '未登记',
        content: render(template.content, bill),
        status: body.dryRun ? 'PENDING' : 'SENT',
        provider: 'mock',
        providerMsg: body.dryRun ? '仅预览，未发送' : 'mock 通道已发送',
        sentAt: body.dryRun ? null : stamp,
        operator: currentUsername || 'admin'
      }
    })
    if (!body.dryRun) state.notices.push(...notices)
    return { sentCount: body.dryRun ? 0 : notices.length, failedCount: 0, notices }
  }

  // ---------- 收据发票 ----------
  if (path === '/receipts' && method === 'get') {
    const rows = state.receipts
      .filter(
        (row) =>
          (!params.roomId || row.roomId === Number(params.roomId)) &&
          (!params.type || row.type === params.type) &&
          (!params.status || row.status === params.status) &&
          (!params.from || (row.issuedAt || '').slice(0, 10) >= params.from) &&
          (!params.to || (row.issuedAt || '').slice(0, 10) <= params.to) &&
          (!params.keyword || has(row.receiptNo, params.keyword) || has(row.title, params.keyword) || has(roomOf(row.roomId)?.roomNo, params.keyword))
      )
      .sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))
      .map(receiptVO)
    return paginate(rows, params)
  }
  if (path === '/receipts' && method === 'post') {
    const payment = state.payments.find((row) => row.id === Number(body.paymentId))
    if (!payment) throw new Error('收款单不存在')
    if (!['RECEIPT', 'INVOICE'].includes(body.type)) throw new Error('票据类型不正确')
    if (state.receipts.some((row) => row.paymentId === payment.id && row.type === body.type && row.status === 'ISSUED')) {
      throw new Error('该收款单已开具同类型票据')
    }
    const amount = body.amount ? yuan(body.amount) : yuan(payment.amount)
    if (amount > payment.amount) throw new Error('开票金额不得超过收款单金额')
    const id = idOf(state.receipts)
    const created = {
      id,
      receiptNo: `S${dayjs().format('YYYYMMDD')}${String(id).padStart(4, '0')}`,
      type: body.type,
      paymentId: payment.id,
      roomId: payment.roomId,
      title: body.title,
      taxNo: body.taxNo || null,
      amount,
      status: 'ISSUED',
      issuedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      operator: currentUsername || 'admin',
      voidReason: null,
      remark: body.remark || null
    }
    state.receipts.push(created)
    return receiptVO(created)
  }
  if (segments[0] === 'receipts' && segments[1] && segments[2] === 'void' && method === 'post') {
    const row = state.receipts.find((item) => item.id === Number(segments[1]))
    if (!row) throw new Error('票据不存在')
    if (!body.reason) throw new Error('请填写作废原因')
    row.status = 'VOID'
    row.voidReason = body.reason
    return receiptVO(row)
  }
  if (segments[0] === 'receipts' && segments[1] && segments[2] === 'print' && method === 'get') {
    const row = state.receipts.find((item) => item.id === Number(segments[1]))
    if (!row) throw new Error('票据不存在')
    const vo = receiptVO(row)
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${vo.receiptNo}</title></head><body style="font-family:sans-serif;padding:32px"><h1>${vo.type === 'INVOICE' ? '发票' : '收据'}</h1><p>编号：${vo.receiptNo}</p><p>抬头：${vo.title}</p><p>房号：${vo.roomNo}</p><p>金额：￥${yuan(vo.amount).toFixed(2)}</p></body></html>`
  }

  // ---------- 导入导出 ----------
  if (segments[0] === 'import' && segments[1] && method === 'post') {
    const type = segments[1]
    const result = runImport(type, body)
    state.importLogs.push({
      id: idOf(state.importLogs),
      type,
      fileName: body.fileName || '粘贴导入.csv',
      totalCount: result.total,
      successCount: result.success,
      failCount: result.failed,
      detail: JSON.stringify(result.errors),
      operator: currentUsername || 'admin',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    })
    return result
  }
  if (path === '/import-logs' && method === 'get') {
    const rows = state.importLogs
      .filter((row) => !params.type || row.type === params.type)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return paginate(rows, params)
  }
  if (segments[0] === 'export' && segments[1] && method === 'get') {
    return buildExportCsv(segments[1], params)
  }

  // ---------- 审批 ----------
  if (path === '/approvals' && method === 'get') {
    const rows = state.approvals
      .filter(
        (row) =>
          (!params.status || row.status === params.status) &&
          (!params.type || row.type === params.type) &&
          (!params.roomId || row.roomId === Number(params.roomId)) &&
          (!params.keyword || has(row.approvalNo, params.keyword) || has(roomOf(row.roomId)?.roomNo, params.keyword) || has(row.applicant, params.keyword))
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(approvalVO)
    return paginate(rows, params)
  }
  if (path === '/approvals' && method === 'post') {
    if (!['BILL_DISCOUNT', 'ADVANCE_REFUND', 'DEPOSIT_REFUND'].includes(body.type)) throw new Error('审批类型不正确')
    const id = idOf(state.approvals)
    const created = {
      id,
      approvalNo: `SP${dayjs().format('YYYYMM')}${String(id).padStart(4, '0')}`,
      type: body.type,
      targetType: body.type === 'BILL_DISCOUNT' ? 'BILL' : 'ROOM_ACCOUNT',
      targetId: body.billId || body.roomId,
      roomId: Number(body.roomId),
      amount: yuan(body.amount),
      payload: JSON.stringify(body.payload || {}),
      reason: body.reason,
      applicant: currentUsername || 'admin',
      status: 'PENDING',
      approver: null,
      approveRemark: null,
      decidedAt: null,
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
    state.approvals.push(created)
    return approvalVO(created)
  }
  if (segments[0] === 'approvals' && segments[1] && segments[2] === 'approve' && method === 'post') {
    const row = state.approvals.find((item) => item.id === Number(segments[1]))
    if (!row) throw new Error('审批单不存在')
    if (row.status !== 'PENDING') throw new Error('该审批单已处理')
    row.status = 'APPROVED'
    row.approver = currentUsername || 'admin'
    row.approveRemark = body.remark || null
    row.decidedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    if (row.type === 'BILL_DISCOUNT' && row.targetId) {
      const bill = state.bills.find((item) => item.id === Number(row.targetId))
      if (bill) {
        bill.discount = yuan(bill.discount + row.amount)
        bill.status = bill.paidAmount >= billNet(bill) ? 'PAID' : bill.paidAmount > 0 ? 'PARTIAL' : 'UNPAID'
        bill.remark = `${bill.remark ? `${bill.remark} ` : ''}减免审批 ${row.approvalNo}`
      }
    } else if (row.type === 'ADVANCE_REFUND' || row.type === 'DEPOSIT_REFUND') {
      const accountType = row.type === 'DEPOSIT_REFUND' ? 'DEPOSIT' : 'ADVANCE'
      const account = accountOf(row.roomId)
      const balance = accountType === 'DEPOSIT' ? account.depositBalance : account.advanceBalance
      const amount = yuan(Math.min(row.amount, balance))
      if (amount > 0) {
        writeFundFlow(row.roomId, accountType, 'OUT', amount, accountType === 'DEPOSIT' ? 'DEPOSIT_REFUND' : 'ADVANCE_REFUND', 'APPROVAL', row.id, `审批通过退款 ${row.approvalNo}`, null)
      }
    }
    return approvalVO(row)
  }
  if (segments[0] === 'approvals' && segments[1] && segments[2] === 'reject' && method === 'post') {
    const row = state.approvals.find((item) => item.id === Number(segments[1]))
    if (!row) throw new Error('审批单不存在')
    if (row.status !== 'PENDING') throw new Error('该审批单已处理')
    if (!body.remark) throw new Error('驳回必须填写意见')
    row.status = 'REJECTED'
    row.approver = currentUsername || 'admin'
    row.approveRemark = body.remark
    row.decidedAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
    return approvalVO(row)
  }

  // ---------- 业主端（免登录 H5） ----------
  if (path === '/portal/login' && method === 'post') {
    const roomNo = String(body.roomNo || '').trim()
    const suffix = String(body.phoneSuffix || '').trim()
    const room = state.rooms.find((row) => row.roomNo === roomNo)
    if (!room) throw new Error('房号不存在，请核对后重试')
    const owner = ownerOf(room.id) || livingResidents(room.id)[0]
    if (!owner || String(owner.phone || '').slice(-4) !== suffix) throw new Error('手机号后 4 位不正确')
    state.portalSession = { roomId: room.id }
    return {
      token: `portal-token-${room.id}`,
      room: { id: room.id, roomNo: room.roomNo, communityName: communityOf(room.communityId)?.name, buildingName: buildingOf(room.buildingId)?.name },
      ownerName: owner.name
    }
  }
  if (path === '/portal/summary' && method === 'get') {
    const session = requirePortal()
    const account = accountOf(session.roomId)
    const unpaid = state.bills.filter((bill) => bill.roomId === session.roomId && bill.status !== 'VOID' && billArrears(bill) > 0)
    return {
      roomNo: roomOf(session.roomId)?.roomNo,
      arrears: yuan(unpaid.reduce((acc, bill) => acc + billArrears(bill), 0)),
      unpaidCount: unpaid.length,
      advanceBalance: account.advanceBalance,
      depositBalance: account.depositBalance
    }
  }
  if (path === '/portal/bills' && method === 'get') {
    const session = requirePortal()
    const rows = state.bills
      .filter((bill) => bill.roomId === session.roomId)
      .sort((a, b) => (a.period < b.period ? 1 : -1))
      .map(billVO)
    return { list: rows, total: rows.length, page: 1, size: rows.length }
  }
  if (path === '/portal/payments' && method === 'get') {
    const session = requirePortal()
    const rows = state.payments
      .filter((payment) => payment.roomId === session.roomId)
      .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1))
      .map(paymentVO)
    return { list: rows, total: rows.length, page: 1, size: rows.length }
  }
  if (path === '/portal/orders' && method === 'post') {
    const session = requirePortal()
    const bills = state.bills.filter(
      (bill) =>
        bill.roomId === session.roomId &&
        bill.status !== 'VOID' &&
        (!body.billIds?.length || body.billIds.map(Number).includes(bill.id)) &&
        billArrears(bill) > 0
    )
    if (!bills.length) throw new Error('请选择要缴费的账单')
    const amount = yuan(bills.reduce((acc, bill) => acc + billArrears(bill), 0))
    const order = {
      orderNo: `OD${dayjs().format('YYYYMMDDHHmmss')}${String(idOf(state.portalOrders)).padStart(3, '0')}`,
      roomId: session.roomId,
      billIds: bills.map((bill) => bill.id),
      amount,
      status: 'CREATED',
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
    state.portalOrders.push(order)
    return { orderNo: order.orderNo, amount, payUrl: `/portal/pay/${order.orderNo}` }
  }
  if (segments[0] === 'portal' && segments[1] === 'orders' && segments[3] === 'pay' && method === 'post') {
    const order = state.portalOrders.find((row) => row.orderNo === segments[2])
    if (!order) throw new Error('支付单不存在')
    if (order.status === 'PAID') throw new Error('该支付单已支付')
    const payment = {
      id: idOf(state.payments),
      paymentNo: nextNo('P', dayjs().format('YYYYMMDD')),
      communityId: roomOf(order.roomId)?.communityId,
      roomId: order.roomId,
      amount: order.amount,
      method: 'ONLINE',
      paidAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      operator: 'portal',
      remark: '业主端在线缴费',
      channel: 'PORTAL'
    }
    state.payments.push(payment)
    const { allocations } = allocateBills(order.roomId, order.amount, order.billIds, payment.id)
    order.status = 'PAID'
    return { orderNo: order.orderNo, amount: order.amount, status: 'PAID', allocations }
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
