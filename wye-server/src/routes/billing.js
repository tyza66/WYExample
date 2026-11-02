// 账单 / 收款 / 抄表路由
import { z } from 'zod'
import dayjs from 'dayjs'
import { prisma } from '../db/prisma.js'
import { bad, ok, pageResult } from '../common/errors.js'
import { parse } from '../common/validate.js'
import { D, yuan } from '../common/money.js'
import { assertPeriod, pageParams, shiftPeriod, toDate } from '../common/utils.js'
import { BILL_STATUS } from '../common/constants.js'
import { adjustBill, generateBills, voidBill, BILL_INCLUDE } from '../services/billing.js'
import { createPayment, findPayment, PAYMENT_INCLUDE } from '../services/payments.js'
import { billVO, meterReadingVO, paymentVO } from '../services/serialize.js'
import { recordLog } from '../services/log.js'

const enumOf = (dict, message) => z.string().refine((value) => Object.values(dict).includes(value), message)

export async function registerBillingRoutes(app) {
  const auth = app.authenticate
  const cashier = app.requireRole('ADMIN', 'CASHIER')
  const admin = app.requireRole('ADMIN')

  // ---------- 账单 ----------
  app.get('/api/bills', { preHandler: [auth] }, async (request) => {
    const { page, size, skip, take } = pageParams(request.query)
    const query = request.query
    const keyword = query.keyword ? String(query.keyword).trim() : ''
    const where = {
      ...(query.period ? { period: String(query.period) } : {}),
      ...(query.communityId ? { communityId: Number(query.communityId) } : {}),
      ...(query.feeItemId ? { feeItemId: Number(query.feeItemId) } : {}),
      ...(query.roomId ? { roomId: Number(query.roomId) } : {}),
      ...(query.status ? { status: String(query.status) } : {}),
      ...(query.buildingId ? { room: { buildingId: Number(query.buildingId) } } : {}),
      ...(keyword
        ? {
            OR: [
              { billNo: { contains: keyword } },
              { room: { roomNo: { contains: keyword } } },
              { room: { residents: { some: { name: { contains: keyword } } } } }
            ]
          }
        : {})
    }
    const [total, rows] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        include: BILL_INCLUDE,
        orderBy: [{ period: 'desc' }, { id: 'desc' }],
        skip,
        take
      })
    ])
    return ok(pageResult(rows.map(billVO), total, page, size))
  })

  app.get('/api/bills/:id', { preHandler: [auth] }, async (request) => {
    const row = await prisma.bill.findUnique({ where: { id: Number(request.params.id) }, include: BILL_INCLUDE })
    if (!row) bad('账单不存在')
    return ok(billVO(row))
  })

  app.post('/api/bills/generate', { preHandler: [auth, cashier] }, async (request) => {
    const payload = parse(
      z.object({
        period: z.string().trim().min(1, '账期不能为空'),
        communityId: z.coerce.number().int().positive().nullish(),
        buildingId: z.coerce.number().int().positive().nullish(),
        feeItemIds: z.array(z.coerce.number().int().positive()).nullish(),
        overwrite: z.coerce.boolean().default(false)
      }),
      request.body
    )
    if (!assertPeriod(payload.period)) bad('账期格式不正确，应为 yyyy-MM')
    const result = await generateBills(payload)
    await recordLog(request, {
      module: '账单',
      action: '批量生成',
      target: payload.period,
      detail: `生成 ${result.generated} 条，跳过 ${result.skipped} 条，合计 ${result.totalAmount} 元`
    })
    return ok(result)
  })

  app.put('/api/bills/:id', { preHandler: [auth, cashier] }, async (request) => {
    const payload = parse(
      z.object({
        discount: z.coerce.number().nonnegative('减免金额不能为负数').nullish(),
        dueDate: z.string().trim().nullish(),
        remark: z.string().trim().max(255).nullish()
      }),
      request.body
    )
    const bill = await adjustBill(request.params.id, payload)
    await recordLog(request, { module: '账单', action: '调整', target: bill.billNo, detail: JSON.stringify(payload) })
    return ok(bill)
  })

  app.post('/api/bills/:id/void', { preHandler: [auth, admin] }, async (request) => {
    const payload = parse(z.object({ reason: z.string().trim().min(1, '请填写作废原因') }), request.body)
    const bill = await voidBill(request.params.id, payload.reason)
    await recordLog(request, { module: '账单', action: '作废', target: bill.billNo, detail: payload.reason })
    return ok(bill)
  })

  // ---------- 收款 ----------
  app.get('/api/payments', { preHandler: [auth] }, async (request) => {
    const { page, size, skip, take } = pageParams(request.query)
    const query = request.query
    const keyword = query.keyword ? String(query.keyword).trim() : ''
    const where = {
      ...(query.communityId ? { communityId: Number(query.communityId) } : {}),
      ...(query.roomId ? { roomId: Number(query.roomId) } : {}),
      ...(query.method ? { method: String(query.method) } : {}),
      ...(query.from || query.to
        ? {
            paidAt: {
              ...(query.from ? { gte: dayjs(String(query.from)).startOf('day').toDate() } : {}),
              ...(query.to ? { lte: dayjs(String(query.to)).endOf('day').toDate() } : {})
            }
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              { paymentNo: { contains: keyword } },
              { room: { roomNo: { contains: keyword } } },
              { room: { residents: { some: { name: { contains: keyword } } } } }
            ]
          }
        : {})
    }
    // 按账期过滤：命中该账期账单的收款
    if (query.period) {
      where.allocations = { some: { bill: { period: String(query.period) } } }
    }
    const [total, rows] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        skip,
        take
      })
    ])
    return ok(pageResult(rows.map(paymentVO), total, page, size))
  })

  app.get('/api/payments/:id', { preHandler: [auth] }, async (request) => ok(await findPayment(request.params.id)))

  app.post('/api/payments', { preHandler: [auth, cashier] }, async (request) => {
    const payload = parse(
      z.object({
        roomId: z.coerce.number().int().positive('请选择房屋'),
        amount: z.coerce.number().positive('收款金额必须大于 0'),
        method: z.string().trim().min(1, '请选择收款方式'),
        paidAt: z.string().trim().nullish(),
        billIds: z.array(z.coerce.number().int().positive()).nullish(),
        remark: z.string().trim().max(255).nullish()
      }),
      request.body
    )
    const user = app.currentUser(request)
    const result = await createPayment(payload, user.username)
    await recordLog(request, {
      module: '收款',
      action: '登记',
      target: result.paymentNo,
      detail: `房屋 #${payload.roomId} 收款 ${result.amount} 元，核销 ${result.allocatedAmount} 元，预收 ${result.advanceAmount} 元`
    })
    return ok(result)
  })

  // ---------- 抄表 ----------
  app.get('/api/meter-readings', { preHandler: [auth] }, async (request) => {
    const { page, size, skip, take } = pageParams(request.query)
    const query = request.query
    const where = {
      ...(query.period ? { period: String(query.period) } : {}),
      ...(query.roomId ? { roomId: Number(query.roomId) } : {}),
      ...(query.feeItemId ? { feeItemId: Number(query.feeItemId) } : {}),
      ...(query.communityId ? { room: { communityId: Number(query.communityId) } } : {})
    }
    const [total, rows] = await Promise.all([
      prisma.meterReading.count({ where }),
      prisma.meterReading.findMany({
        where,
        include: { room: { include: { community: true, building: true } }, feeItem: true },
        orderBy: [{ period: 'desc' }, { id: 'desc' }],
        skip,
        take
      })
    ])
    return ok(pageResult(rows.map((row) => meterReadingVO(row)), total, page, size))
  })

  app.post('/api/meter-readings', { preHandler: [auth, cashier] }, async (request) => {
    const payload = parse(
      z.object({
        roomId: z.coerce.number().int().positive('请选择房屋'),
        feeItemId: z.coerce.number().int().positive('请选择收费项目'),
        period: z.string().trim().min(1, '账期不能为空'),
        prevReading: z.coerce.number().nonnegative('上期读数不能为负').nullish(),
        currReading: z.coerce.number().nonnegative('本期读数不能为负'),
        readingDate: z.string().trim().nullish(),
        remark: z.string().trim().max(255).nullish()
      }),
      request.body
    )
    if (!assertPeriod(payload.period)) bad('账期格式不正确，应为 yyyy-MM')

    const [room, feeItem] = await Promise.all([
      prisma.room.findUnique({ where: { id: payload.roomId } }),
      prisma.feeItem.findUnique({ where: { id: payload.feeItemId } })
    ])
    if (!room) bad('房屋不存在')
    if (!feeItem) bad('收费项目不存在')
    if (feeItem.chargeMode !== 'METER') bad('该收费项目不是按用量计费，无需抄表')

    let prevReading = payload.prevReading
    if (prevReading === null || prevReading === undefined) {
      const previous = await prisma.meterReading.findUnique({
        where: { roomId_feeItemId_period: { roomId: payload.roomId, feeItemId: payload.feeItemId, period: shiftPeriod(payload.period, -1) } }
      })
      prevReading = previous ? Number(previous.currReading) : 0
    }

    const prev = D(prevReading)
    const curr = D(payload.currReading)
    if (curr.lessThan(prev)) bad('本期读数小于上期读数，请核对')
    const usageQty = curr.minus(prev)

    const row = await prisma.meterReading.upsert({
      where: { roomId_feeItemId_period: { roomId: payload.roomId, feeItemId: payload.feeItemId, period: payload.period } },
      create: {
        roomId: payload.roomId,
        feeItemId: payload.feeItemId,
        period: payload.period,
        prevReading: prev,
        currReading: curr,
        usageQty,
        readingDate: toDate(payload.readingDate) || new Date(),
        operator: app.currentUser(request).username,
        remark: payload.remark || null
      },
      update: {
        prevReading: prev,
        currReading: curr,
        usageQty,
        readingDate: toDate(payload.readingDate) || new Date(),
        operator: app.currentUser(request).username,
        remark: payload.remark || null
      },
      include: { room: { include: { community: true, building: true } }, feeItem: true }
    })

    await recordLog(request, {
      module: '抄表',
      action: '录入',
      target: `${room.roomNo}/${feeItem.name}/${payload.period}`,
      detail: `上期 ${yuan(prev)}，本期 ${yuan(curr)}，用量 ${yuan(usageQty)}`
    })
    return ok(meterReadingVO(row))
  })
}

export default registerBillingRoutes
