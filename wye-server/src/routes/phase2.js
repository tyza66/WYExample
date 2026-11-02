// WYE 二期路由：账套、资金账户、审批、代扣、通知、票据、导入导出、业主端
import { z } from 'zod'
import { ok, bad, pageResult } from '../common/errors.js'
import { parse } from '../common/validate.js'
import { prisma } from '../db/prisma.js'
import {
  listLedgers, ledgerOptions, saveLedger, deleteLedger,
  listAccounts, accountDetail, listFlows, deposit, useAdvance, refund,
  listApprovals, createApproval, decideApproval,
  listContracts, saveContract, cancelContract, listBatches, generateBatch, getBatch, exportBatch, importBatchReturn, closeBatch,
  listTemplates, saveTemplate, deleteTemplate, listNotices, sendNotices,
  listReceipts, issueReceipt, voidReceipt, receiptPrint,
  importData, listImportLogs, exportCsv,
  portalLogin, portalBills, portalPayments, portalSummary, portalOrder, portalPay
} from '../services/phase2.js'
import { recordLog } from '../services/log.js'

export async function registerPhase2Routes(app) {
  const auth = app.authenticate
  const portalAuth = app.authenticatePortal
  const cashier = app.requireRole('ADMIN', 'CASHIER')
  const admin = app.requireRole('ADMIN')

  // ---------- 账套 ----------
  app.get('/api/ledgers', { preHandler: [auth] }, async (request) => ok(await listLedgers(request.query)))
  app.get('/api/ledgers/options', { preHandler: [auth] }, async () => ok(await ledgerOptions()))
  app.post('/api/ledgers', { preHandler: [auth, admin] }, async (request) => ok(await saveLedger(request.body)))
  app.put('/api/ledgers/:id', { preHandler: [auth, admin] }, async (request) => ok(await saveLedger(request.body, request.params.id)))
  app.delete('/api/ledgers/:id', { preHandler: [auth, admin] }, async (request) => ok(await deleteLedger(request.params.id)))

  // ---------- 房屋资金账户 ----------
  app.get('/api/accounts', { preHandler: [auth] }, async (request) => ok(await listAccounts(request, request.query)))
  app.get('/api/accounts/:roomId', { preHandler: [auth] }, async (request) => ok(await accountDetail(request.params.roomId)))
  app.post('/api/accounts/deposit', { preHandler: [auth, cashier] }, async (request) => ok(await deposit(request, request.body)))
  app.post('/api/accounts/advance/use', { preHandler: [auth, cashier] }, async (request) => ok(await useAdvance(request, request.body)))
  app.post('/api/accounts/refund', { preHandler: [auth, admin] }, async (request) => ok(await refund(request, request.body)))
  app.get('/api/fund-flows', { preHandler: [auth] }, async (request) => ok(await listFlows(request, request.query)))

  // ---------- 审批 ----------
  app.get('/api/approvals', { preHandler: [auth] }, async (request) => ok(await listApprovals(request.query)))
  app.post('/api/approvals', { preHandler: [auth, cashier] }, async (request) => ok(await createApproval(request, request.body)))
  app.post('/api/approvals/:id/approve', { preHandler: [auth, admin] }, async (request) => ok(await decideApproval(request, request.params.id, true, request.body?.remark)))
  app.post('/api/approvals/:id/reject', { preHandler: [auth, admin] }, async (request) => ok(await decideApproval(request, request.params.id, false, request.body?.remark)))

  // ---------- 银行代扣 ----------
  app.get('/api/bank-contracts', { preHandler: [auth] }, async (request) => ok(await listContracts(request.query)))
  app.post('/api/bank-contracts', { preHandler: [auth, admin] }, async (request) => ok(await saveContract(request.body)))
  app.put('/api/bank-contracts/:id', { preHandler: [auth, admin] }, async (request) => ok(await saveContract(request.body, request.params.id)))
  app.delete('/api/bank-contracts/:id', { preHandler: [auth, admin] }, async (request) => ok(await cancelContract(request.params.id)))
  app.get('/api/bank-batches', { preHandler: [auth] }, async (request) => ok(await listBatches(request.query)))
  app.post('/api/bank-batches/generate', { preHandler: [auth, cashier] }, async (request) => ok(await generateBatch(request, request.body)))
  app.get('/api/bank-batches/:id', { preHandler: [auth] }, async (request) => ok(await getBatch(request.params.id)))
  app.get('/api/bank-batches/:id/export', { preHandler: [auth] }, async (request, reply) => {
    const content = await exportBatch(request.params.id)
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="wye-bank-${request.params.id}.csv"`).send(content)
  })
  app.post('/api/bank-batches/:id/return', { preHandler: [auth, cashier] }, async (request) => ok(await importBatchReturn(request, request.params.id, request.body)))
  app.post('/api/bank-batches/:id/close', { preHandler: [auth, admin] }, async (request) => ok(await closeBatch(request.params.id)))

  // ---------- 通知 ----------
  app.get('/api/notice-templates', { preHandler: [auth] }, async (request) => ok(await listTemplates(request.query)))
  app.post('/api/notice-templates', { preHandler: [auth, admin] }, async (request) => ok(await saveTemplate(request.body)))
  app.put('/api/notice-templates/:id', { preHandler: [auth, admin] }, async (request) => ok(await saveTemplate(request.body, request.params.id)))
  app.delete('/api/notice-templates/:id', { preHandler: [auth, admin] }, async (request) => ok(await deleteTemplate(request.params.id)))
  app.get('/api/notices', { preHandler: [auth] }, async (request) => ok(await listNotices(request.query)))
  app.post('/api/notices/send', { preHandler: [auth, cashier] }, async (request) => ok(await sendNotices(request, request.body)))

  // ---------- 收据/发票 ----------
  app.get('/api/receipts', { preHandler: [auth] }, async (request) => ok(await listReceipts(request.query)))
  app.post('/api/receipts', { preHandler: [auth, cashier] }, async (request) => ok(await issueReceipt(request, request.body)))
  app.post('/api/receipts/:id/void', { preHandler: [auth, admin] }, async (request) => ok(await voidReceipt(request.params.id, request.body?.reason)))
  app.get('/api/receipts/:id/print', { preHandler: [auth] }, async (request, reply) => reply.header('Content-Type', 'text/html; charset=utf-8').send(await receiptPrint(request.params.id)))

  // ---------- CSV 导入导出 ----------
  app.post('/api/import/:type', { preHandler: [auth, admin] }, async (request) => ok(await importData(request, request.params.type, request.body)))
  app.get('/api/import-logs', { preHandler: [auth, admin] }, async (request) => ok(await listImportLogs(request.query)))
  app.get('/api/export/:type', { preHandler: [auth] }, async (request, reply) => {
    const content = await exportCsv(request.params.type, request.query)
    reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="wye-${request.params.type}.csv"`).send(content)
  })

  // ---------- 业主端：登录不需要后台 token，登录后为短期 portal token ----------
  app.post('/api/portal/login', async (request, reply) => {
    const result = await portalLogin(request.body)
    const token = app.jwt.sign({ sub: `portal:${result.room.id}`, roomId: result.room.id, scope: 'PORTAL', ownerName: result.ownerName }, { expiresIn: '2h' })
    return reply.send(ok({ ...result, token }))
  })
  app.get('/api/portal/bills', { preHandler: [portalAuth] }, async (request) => ok(await portalBills(request.user.roomId, request.query)))
  app.get('/api/portal/payments', { preHandler: [portalAuth] }, async (request) => ok(await portalPayments(request.user.roomId)))
  app.get('/api/portal/summary', { preHandler: [portalAuth] }, async (request) => ok(await portalSummary(request.user.roomId)))
  app.post('/api/portal/orders', { preHandler: [portalAuth] }, async (request) => ok(await portalOrder(request.user.roomId, request.body)))
  app.post('/api/portal/orders/:orderNo/pay', { preHandler: [portalAuth] }, async (request) => ok(await portalPay(request.user.roomId, request.params.orderNo, request.body)))
}

export default registerPhase2Routes
