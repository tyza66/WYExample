// 演示数据：一个小区、3 栋楼、12 套房屋、10 位住户、4 个收费项目、近 3 个账期账单与部分收款
// 独立执行：node prisma/seed.js    也可被 src/db/bootstrap.js 在库为空时调用
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'
import dayjs from 'dayjs'
import { prisma } from '../src/db/prisma.js'
import { D } from '../src/common/money.js'
import { shiftPeriod } from '../src/common/utils.js'
import { generateBills } from '../src/services/billing.js'
import { createPayment } from '../src/services/payments.js'
import { billAmounts } from '../src/services/serialize.js'

const BUILDINGS = [
  { name: '1 号楼', unitCount: 2 },
  { name: '2 号楼', unitCount: 2 },
  { name: '3 号楼', unitCount: 1 }
]

const ROOMS = [
  { building: '1 号楼', unit: '1', floor: 1, roomNo: '1-101', area: 89.5, roomType: 'RESIDENCE', status: 'OCCUPIED' },
  { building: '1 号楼', unit: '1', floor: 1, roomNo: '1-102', area: 105.2, roomType: 'RESIDENCE', status: 'OCCUPIED' },
  { building: '1 号楼', unit: '1', floor: 2, roomNo: '1-201', area: 89.5, roomType: 'RESIDENCE', status: 'RENTED' },
  { building: '1 号楼', unit: '1', floor: 2, roomNo: '1-202', area: 105.2, roomType: 'RESIDENCE', status: 'OCCUPIED' },
  { building: '2 号楼', unit: '1', floor: 1, roomNo: '2-101', area: 76.8, roomType: 'RESIDENCE', status: 'OCCUPIED' },
  { building: '2 号楼', unit: '1', floor: 2, roomNo: '2-201', area: 120.5, roomType: 'RESIDENCE', status: 'RENTED' },
  { building: '2 号楼', unit: '1', floor: 2, roomNo: '2-202', area: 88.0, roomType: 'RESIDENCE', status: 'OCCUPIED' },
  { building: '2 号楼', unit: '1', floor: 3, roomNo: '2-301', area: 143.6, roomType: 'RESIDENCE', status: 'VACANT' },
  { building: '3 号楼', unit: '1', floor: 1, roomNo: '3-101', area: 210.0, roomType: 'SHOP', status: 'RENTED' },
  { building: '3 号楼', unit: '1', floor: 1, roomNo: '3-102', area: 168.5, roomType: 'SHOP', status: 'OCCUPIED' },
  { building: '3 号楼', unit: '1', floor: -1, roomNo: 'P-001', area: 0, roomType: 'PARKING', status: 'OCCUPIED' },
  { building: '3 号楼', unit: '1', floor: -1, roomNo: 'P-002', area: 0, roomType: 'PARKING', status: 'VACANT' }
]

const RESIDENTS = [
  { roomNo: '1-101', name: '张三', phone: '13800000001', idCard: '110101199001011234', residentType: 'OWNER', startDate: '2021-03-01' },
  { roomNo: '1-101', name: '张小妹', phone: '13800000011', idCard: '110101201505054321', residentType: 'FAMILY', startDate: '2021-03-01' },
  { roomNo: '1-102', name: '李四', phone: '13800000002', idCard: '110101198807152345', residentType: 'OWNER', startDate: '2020-06-15' },
  { roomNo: '1-201', name: '王五', phone: '13800000003', idCard: '110101199203041122', residentType: 'TENANT', startDate: '2024-01-01' },
  { roomNo: '1-202', name: '赵六', phone: '13800000004', idCard: '110101198511209876', residentType: 'OWNER', startDate: '2019-09-01' },
  { roomNo: '2-101', name: '钱七', phone: '13800000005', idCard: '110101199507081357', residentType: 'OWNER', startDate: '2022-05-20' },
  { roomNo: '2-201', name: '孙八', phone: '13800000006', idCard: '110101199109234680', residentType: 'TENANT', startDate: '2023-11-01' },
  { roomNo: '2-202', name: '周九', phone: '13800000007', idCard: '110101198802124567', residentType: 'OWNER', startDate: '2021-07-01' },
  { roomNo: '3-101', name: '吴十', phone: '13800000008', idCard: '110101198609301234', residentType: 'TENANT', startDate: '2022-08-01' },
  { roomNo: '3-102', name: '郑一', phone: '13800000009', idCard: '110101199406068765', residentType: 'OWNER', startDate: '2020-04-10' }
]

const FEE_ITEMS = [
  { name: '物业管理费', code: 'WYF', type: 'PROPERTY', chargeMode: 'AREA', unitPrice: 3.5, priceUnit: '元/㎡', period: 'MONTHLY', sortNo: 1 },
  { name: '水费', code: 'SF', type: 'WATER', chargeMode: 'METER', unitPrice: 3.2, priceUnit: '元/吨', period: 'MONTHLY', sortNo: 2 },
  { name: '电费', code: 'DF', type: 'ELECTRIC', chargeMode: 'METER', unitPrice: 0.6185, priceUnit: '元/度', period: 'MONTHLY', sortNo: 3 },
  { name: '车位管理费', code: 'CWGLF', type: 'PARKING', chargeMode: 'FIXED', unitPrice: 80, priceUnit: '元/月', period: 'MONTHLY', sortNo: 4 }
]

const USERS = [
  { username: 'admin', password: 'admin123', realName: '系统管理员', role: 'ADMIN', phone: '13900000001' },
  { username: 'cashier', password: '123456', realName: '收费员小李', role: 'CASHIER', phone: '13900000002' },
  { username: 'viewer', password: '123456', realName: '物业经理（只读）', role: 'VIEWER', phone: '13900000003' }
]

async function clean(client) {
  await client.paymentAllocation.deleteMany()
  await client.fundFlow.deleteMany()
  await client.roomAccount.deleteMany()
  await client.bankBatchItem.deleteMany()
  await client.bankBatch.deleteMany()
  await client.bankContract.deleteMany()
  await client.notice.deleteMany()
  await client.noticeTemplate.deleteMany()
  await client.receipt.deleteMany()
  await client.approval.deleteMany()
  await client.importLog.deleteMany()
  await client.userCommunity.deleteMany()
  await client.bill.deleteMany()
  await client.payment.deleteMany()
  await client.meterReading.deleteMany()
  await client.resident.deleteMany()
  await client.room.deleteMany()
  await client.building.deleteMany()
  await client.feeItem.deleteMany()
  await client.community.deleteMany()
  await client.ledger.deleteMany()
  await client.user.deleteMany()
  await client.operationLog.deleteMany()
  await client.sequence.deleteMany()
}

export async function seed(client = prisma) {
  await clean(client)

  // 1. 账号
  for (const user of USERS) {
    await client.user.create({
      data: {
        username: user.username,
        password: bcrypt.hashSync(user.password, 10),
        realName: user.realName,
        role: user.role,
        phone: user.phone
      }
    })
  }

  // 2. 账套、小区与楼栋
  const defaultLedger = await client.ledger.create({ data: { name: '阳光花园账套', code: 'YGHY-DEFAULT', company: 'WYE 演示物业', enabled: true } })
  const community = await client.community.create({
    data: {
      name: '阳光花园',
      code: 'YGHY',
      address: '幸福路 88 号',
      manager: '陈经理',
      phone: '0571-88888888',
      remark: '演示小区：3 栋楼、12 套房、含商铺与车位'
    }
  })

  const buildingMap = new Map()
  for (const building of BUILDINGS) {
    const created = await client.building.create({
      data: { communityId: community.id, name: building.name, unitCount: building.unitCount }
    })
    buildingMap.set(building.name, created)
  }

  // 3. 房屋
  const roomMap = new Map()
  for (const room of ROOMS) {
    const created = await client.room.create({
      data: {
        communityId: community.id,
        buildingId: buildingMap.get(room.building).id,
        unit: room.unit,
        roomNo: room.roomNo,
        floor: room.floor,
        area: D(room.area),
        roomType: room.roomType,
        status: room.status
      }
    })
    roomMap.set(room.roomNo, created)
  }

  // 4. 住户
  for (const resident of RESIDENTS) {
    await client.resident.create({
      data: {
        roomId: roomMap.get(resident.roomNo).id,
        name: resident.name,
        phone: resident.phone,
        idCard: resident.idCard,
        residentType: resident.residentType,
        startDate: new Date(resident.startDate),
        status: 'LIVING'
      }
    })
  }

  // 5. 收费项目
  const feeItemMap = new Map()
  for (const item of FEE_ITEMS) {
    const created = await client.feeItem.create({ data: { ...item, communityId: null, enabled: true } })
    feeItemMap.set(item.code, created)
  }

  // 6. 近 3 个账期的抄表（住宅与商铺抄表，车位不抄）
  const currentPeriod = dayjs().format('YYYY-MM')
  const periods = [shiftPeriod(currentPeriod, -2), shiftPeriod(currentPeriod, -1), currentPeriod]
  const meteredRooms = ROOMS.filter((room) => room.roomType !== 'PARKING')
  const readingJobs = []

  meteredRooms.forEach((room, roomIndex) => {
    const roomId = roomMap.get(room.roomNo).id
    let waterPrev = 120 + roomIndex * 15
    let electricPrev = (120 + roomIndex * 15) * 8
    periods.forEach((period, periodIndex) => {
      const usageWater = 6 + ((roomIndex + periodIndex) % 5) * 2
      const usageElectric = 90 + ((roomIndex * 3 + periodIndex * 7) % 60)
      const waterCurr = waterPrev + usageWater
      const electricCurr = electricPrev + usageElectric
      readingJobs.push(
        { feeCode: 'SF', period, roomId, prev: waterPrev, curr: waterCurr, usage: usageWater },
        { feeCode: 'DF', period, roomId, prev: electricPrev, curr: electricCurr, usage: usageElectric }
      )
      waterPrev = waterCurr
      electricPrev = electricCurr
    })
  })

  for (const job of readingJobs) {
    const feeItemId = feeItemMap.get(job.feeCode).id
    const data = {
      prevReading: D(job.prev),
      currReading: D(job.curr),
      usageQty: D(job.usage),
      readingDate: new Date(`${job.period}-01`),
      operator: 'cashier'
    }
    await client.meterReading.upsert({
      where: { roomId_feeItemId_period: { roomId: job.roomId, feeItemId, period: job.period } },
      create: { roomId: job.roomId, feeItemId, period: job.period, ...data },
      update: data
    })
  }

  // 7. 近 3 个账期账单：物业费/水费/电费全量生成，车位费只给车位生成
  const parkingRoomIds = ROOMS.filter((room) => room.roomType === 'PARKING').map((room) => roomMap.get(room.roomNo).id)
  const sharedFeeIds = [feeItemMap.get('WYF').id, feeItemMap.get('SF').id, feeItemMap.get('DF').id]
  for (const period of periods) {
    await generateBills({ period, feeItemIds: sharedFeeIds })
    await generateBills({ period, feeItemIds: [feeItemMap.get('CWGLF').id], roomIds: parkingRoomIds })
  }

  // 8. 收款：全额结清、部分缴、超缴形成预收，三种情形都要有
  const latestPeriod = periods[periods.length - 1]
  // 收款日期必须落在「当月且不晚于今天」，否则收款汇总的默认区间会查不到数据
  const payDate = (day) => `${latestPeriod}-${String(Math.min(day, dayjs().date())).padStart(2, '0')}`

  const arrearsOf = async (roomId, period) => {
    const bills = await client.bill.findMany({
      where: { roomId, period, status: { in: ['UNPAID', 'PARTIAL'] } }
    })
    return bills.reduce((acc, bill) => {
      const { arrears } = billAmounts(bill)
      return arrears.isNegative() ? acc : acc.plus(arrears)
    }, D(0))
  }

  const payLatest = async (roomNo, method, remark) => {
    const room = roomMap.get(roomNo)
    const bills = await client.bill.findMany({
      where: { roomId: room.id, period: latestPeriod, status: { in: ['UNPAID', 'PARTIAL'] } }
    })
    const amount = bills.reduce((acc, bill) => {
      const { arrears } = billAmounts(bill)
      return arrears.isNegative() ? acc : acc.plus(arrears)
    }, D(0))
    if (amount.lessThanOrEqualTo(0)) return
    await createPayment(
      {
        roomId: room.id,
        amount: amount.toDecimalPlaces(2),
        method,
        paidAt: new Date(`${payDate(4)}T10:20:00`),
        billIds: bills.map((bill) => bill.id),
        remark
      },
      'admin'
    )
  }

  await payLatest('1-101', 'WECHAT', `${latestPeriod} 物业费与水电费`)
  await payLatest('2-101', 'ALIPAY', `${latestPeriod} 费用结清`)
  await payLatest('3-102', 'POS', `${latestPeriod} 商铺费用`)

  // 部分缴：缴一半，留欠费给欠费报表
  const partialRoom = roomMap.get('1-102')
  const partialArrears = await arrearsOf(partialRoom.id, latestPeriod)
  if (partialArrears.greaterThan(0)) {
    await createPayment(
      {
        roomId: partialRoom.id,
        amount: partialArrears.div(2).toDecimalPlaces(2),
        method: 'CASH',
        paidAt: new Date(`${payDate(6)}T09:05:00`),
        remark: '先缴一半，其余下周补齐'
      },
      'cashier'
    )
  }

  // 超缴形成预收余额
  await createPayment(
    {
      roomId: roomMap.get('1-202').id,
      amount: D(500),
      method: 'BANK_TRANSFER',
      paidAt: new Date(`${payDate(8)}T14:30:00`),
      remark: '多缴部分作为预收，抵扣下期'
    },
    'cashier'
  )

  // 9. 二期演示数据：账套、资金账户、代扣签约、通知模板、审批、收据、导入记录
  const ledger = await client.ledger.findFirst({ where: { code: 'YGHY-DEFAULT' } })
  if (ledger) await client.community.update({ where: { id: community.id }, data: { ledgerId: ledger.id } })
  const accountRoom = roomMap.get('1-202')
  const account = await client.roomAccount.upsert({ where: { roomId: accountRoom.id }, create: { roomId: accountRoom.id, advanceBalance: D(500), depositBalance: D(1200) }, update: { advanceBalance: D(500), depositBalance: D(1200) } })
  await client.fundFlow.createMany({ data: [
    { roomId: accountRoom.id, accountType: 'ADVANCE', direction: 'IN', amount: D(500), balanceAfter: D(500), bizType: 'IMPORT', operator: 'admin', remark: '演示预收余额', occurredAt: new Date() },
    { roomId: accountRoom.id, accountType: 'DEPOSIT', direction: 'IN', amount: D(1200), balanceAfter: D(1200), bizType: 'DEPOSIT_IN', operator: 'admin', remark: '演示押金', occurredAt: new Date() }
  ] })
  await client.bankContract.create({ data: { roomId: roomMap.get('1-102').id, bankName: '演示银行', accountName: '李四', accountNoMasked: '6222****1234', contractNo: 'DEMO-001', status: 'ACTIVE', signedAt: new Date() } })
  await client.noticeTemplate.createMany({ data: [
    { name: '短信欠费提醒', channel: 'SMS', content: '{业主}您好，{房号}{账期}欠费{金额}元，请及时缴费。', enabled: true },
    { name: '邮件欠费提醒', channel: 'EMAIL', title: 'WYE 物业欠费提醒', content: '{业主}您好，{小区}{房号}有账单欠费{金额}元。', enabled: true }
  ] })
  await client.approval.create({ data: { approvalNo: 'A-DEMO-001', type: 'BILL_DISCOUNT', targetType: 'BILL', targetId: 1, roomId: roomMap.get('1-101').id, amount: D(120), reason: '演示减免审批', applicant: 'cashier', status: 'PENDING' } })
  const firstPayment = await client.payment.findFirst({ orderBy: { id: 'asc' } })
  if (firstPayment) await client.receipt.create({ data: { receiptNo: 'R-DEMO-001', type: 'RECEIPT', paymentId: firstPayment.id, roomId: firstPayment.roomId, title: '阳光花园业主', amount: firstPayment.amount, issuedAt: new Date(), operator: 'admin' } })
  await client.importLog.create({ data: { type: 'advances', fileName: 'demo-advance.csv', totalCount: 1, successCount: 1, failCount: 0, detail: '[]', operator: 'admin' } })
  void account

  const [roomCount, billCount, paymentCount] = await Promise.all([
    client.room.count(),
    client.bill.count(),
    client.payment.count()
  ])

  return { roomCount, billCount, paymentCount, periods }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (isDirectRun) {
  seed()
    .then((result) => {
      console.log(`演示数据已写入：${result.roomCount} 套房屋、${result.billCount} 条账单、${result.paymentCount} 笔收款`)
      console.log(`账期：${result.periods.join('、')}`)
      console.log('账号：admin/admin123、cashier/123456、viewer/123456')
      return prisma.$disconnect()
    })
    .catch(async (error) => {
      console.error('写入演示数据失败：', error)
      await prisma.$disconnect()
      process.exit(1)
    })
}

export default seed
