// WYE 二期业务服务：账套、审批、代扣、通知、票据、导入导出、业主端
import dayjs from 'dayjs'
import { prisma } from '../db/prisma.js'
import { D, yuan } from '../common/money.js'
import { bad } from '../common/errors.js'
import { pageParams, toDate, maskPhone, dateTimeStr } from '../common/utils.js'
import { nextPaymentNo, nextSequence } from './numbering.js'
import { applyFlow, getOrCreateAccount, listAccounts, accountDetail, listFlows, deposit, useAdvance, refund } from './accounts.js'
import { recordLog } from './log.js'
import { billVO, netOf, ledgerVO, bankContractVO, bankBatchVO, bankBatchItemVO, noticeTemplateVO, noticeVO, receiptVO, approvalVO, importLogVO } from './serialize.js'

const page = (list, query = {}) => {
  const { page: current, size } = pageParams(query)
  return { list: list.slice((current - 1) * size, current * size), total: list.length, page: current, size }
}

const roomInfo = async (roomIds) => {
  if (!roomIds.length) return new Map()
  const rows = await prisma.room.findMany({ where: { id: { in: roomIds } }, include: { community: true, building: true } })
  return new Map(rows.map((row) => [row.id, row]))
}

const ownerInfo = async (roomIds) => {
  if (!roomIds.length) return new Map()
  const rows = await prisma.resident.findMany({ where: { roomId: { in: roomIds }, status: 'LIVING' }, orderBy: [{ residentType: 'asc' }, { id: 'asc' }] })
  const result = new Map()
  rows.forEach((row) => { if (!result.has(row.roomId)) result.set(row.roomId, row) })
  return result
}

export { listAccounts, accountDetail, listFlows, deposit, useAdvance, refund }

// ---------- 账套 ----------
export async function listLedgers(query = {}) {
  const rows = await prisma.ledger.findMany({ orderBy: [{ enabled: 'desc' }, { id: 'asc' }] })
  return page(rows.map((row) => ledgerVO({ ...row, communityCount: 0 })), query)
}

export async function ledgerOptions() {
  const rows = await prisma.ledger.findMany({ where: { enabled: true }, orderBy: { id: 'asc' } })
  return rows.map((row) => ({ id: row.id, label: `${row.name}（${row.code}）`, extra: { code: row.code } }))
}

export async function saveLedger(payload, id = null) {
  const data = {
    name: String(payload.name || '').trim(),
    code: String(payload.code || '').trim(),
    company: payload.company ? String(payload.company).trim() : null,
    enabled: payload.enabled !== false,
    remark: payload.remark ? String(payload.remark).slice(0, 255) : null
  }
  if (!data.name || !data.code) bad('账套名称和编码不能为空')
  try {
    return id
      ? ledgerVO(await prisma.ledger.update({ where: { id: Number(id) }, data }))
      : ledgerVO(await prisma.ledger.create({ data }))
  } catch (error) {
    if (error.code === 'P2002') bad(`账套编码 ${data.code} 已存在`)
    throw error
  }
}

export async function deleteLedger(id) {
  const count = await prisma.community.count({ where: { ledgerId: Number(id) } })
  if (count) bad('该账套仍有小区归属，不能删除')
  await prisma.ledger.delete({ where: { id: Number(id) } })
  return true
}

// ---------- 审批 ----------
export async function listApprovals(query = {}) {
  const rows = await prisma.approval.findMany({
    where: {
      ...(query.status ? { status: String(query.status) } : {}),
      ...(query.type ? { type: String(query.type) } : {}),
      ...(query.roomId ? { roomId: Number(query.roomId) } : {})
    },
    orderBy: { id: 'desc' }
  })
  const rooms = await roomInfo(rows.map((row) => row.roomId).filter(Boolean))
  const bills = await prisma.bill.findMany({ where: { id: { in: rows.filter((row) => row.targetType === 'BILL' && row.targetId).map((row) => row.targetId) } }, select: { id: true, billNo: true } })
  const billMap = new Map(bills.map((row) => [row.id, row.billNo]))
  return page(rows.map((row) => approvalVO({ ...row, roomNo: rooms.get(row.roomId)?.roomNo, communityName: rooms.get(row.roomId)?.community?.name, billNo: billMap.get(row.targetId) })), query)
}

export async function createApproval(request, payload) {
  const type = String(payload.type || '')
  if (!['BILL_DISCOUNT', 'ADVANCE_REFUND', 'DEPOSIT_REFUND'].includes(type)) bad('审批类型不正确')
  const amount = D(payload.amount || 0)
  if (amount.lte(0)) bad('审批金额必须大于 0')
  let roomId = payload.roomId ? Number(payload.roomId) : null
  let targetType = null
  let targetId = null
  if (type === 'BILL_DISCOUNT') {
    targetType = 'BILL'
    targetId = Number(payload.billId || 0)
    const bill = await prisma.bill.findUnique({ where: { id: targetId } })
    if (!bill) bad('账单不存在')
    roomId = bill.roomId
  }
  if (!roomId) bad('请选择房屋')
  const approvalNo = `A${dayjs().format('YYYYMMDDHHmmss')}${String(await nextSequence(null, 'approval')).padStart(4, '0')}`
  const row = await prisma.approval.create({
    data: {
      approvalNo,
      type,
      targetType,
      targetId,
      roomId,
      amount: amount.toDecimalPlaces(2),
      payload: payload.payload ? JSON.stringify(payload.payload) : null,
      reason: String(payload.reason || '').trim() || '未填写原因',
      applicant: request.user?.username || 'system'
    }
  })
  await recordLog(request, { module: '审批', action: '提交', target: approvalNo, detail: type })
  return approvalVO(row)
}

export async function decideApproval(request, id, approve, remark) {
  const row = await prisma.approval.findUnique({ where: { id: Number(id) } })
  if (!row) bad('审批单不存在')
  if (row.status !== 'PENDING') bad('该审批单已经处理')
  const operator = request.user?.username || 'system'
  if (!approve) {
    const updated = await prisma.approval.update({ where: { id: row.id }, data: { status: 'REJECTED', approver: operator, approveRemark: remark || '驳回', decidedAt: new Date() } })
    return approvalVO(updated)
  }
  const updated = await prisma.$transaction(async (tx) => {
    if (row.type === 'BILL_DISCOUNT') {
      const bill = await tx.bill.findUnique({ where: { id: row.targetId } })
      if (!bill) bad('审批对应账单不存在')
      const net = D(bill.amount).minus(D(row.amount)).plus(D(bill.lateFee || 0))
      if (net.lt(D(bill.paidAmount))) bad('减免后金额不能低于已收金额')
      await tx.bill.update({ where: { id: bill.id }, data: { discount: D(row.amount), remark: `审批 ${row.approvalNo}：${row.reason}` } })
    } else {
      const accountType = row.type === 'ADVANCE_REFUND' ? 'ADVANCE' : 'DEPOSIT'
      await applyFlow(tx, { roomId: row.roomId, accountType, direction: 'OUT', amount: row.amount, bizType: row.type, refType: 'APPROVAL', refId: row.id, operator, remark: row.reason })
    }
    return tx.approval.update({ where: { id: row.id }, data: { status: 'APPROVED', approver: operator, approveRemark: remark || '通过', decidedAt: new Date() } })
  })
  await recordLog(request, { module: '审批', action: '通过', target: row.approvalNo, detail: row.type })
  return approvalVO(updated)
}

// ---------- 银行代扣 ----------
export async function listContracts(query = {}) {
  const rows = await prisma.bankContract.findMany({
    where: { ...(query.roomId ? { roomId: Number(query.roomId) } : {}), ...(query.status ? { status: query.status } : {}) },
    orderBy: { id: 'desc' }
  })
  const rooms = await roomInfo(rows.map((row) => row.roomId))
  return page(rows.map((row) => { const room = rooms.get(row.roomId); return bankContractVO({ ...row, roomNo: room?.roomNo, communityName: room?.community?.name, buildingName: room?.building?.name }) }), query)
}

export async function saveContract(payload, id = null) {
  const data = {
    roomId: Number(payload.roomId), bankName: String(payload.bankName || '').trim(), accountName: String(payload.accountName || '').trim(),
    accountNoMasked: String(payload.accountNoMasked || '').trim(), contractNo: payload.contractNo || null,
    status: payload.status || 'ACTIVE', signedAt: payload.signedAt ? toDate(payload.signedAt) : new Date(), remark: payload.remark || null
  }
  if (!data.roomId || !data.bankName || !data.accountName || !/^\d{4,}\*+\d{2,}$/.test(data.accountNoMasked)) bad('请填写正确的掩码账号，例如 6222****1234')
  const row = id ? await prisma.bankContract.update({ where: { id: Number(id) }, data }) : await prisma.bankContract.create({ data })
  const room = await prisma.room.findUnique({ where: { id: row.roomId }, include: { community: true, building: true } })
  return bankContractVO({ ...row, roomNo: room?.roomNo, communityName: room?.community?.name, buildingName: room?.building?.name })
}

export async function cancelContract(id) {
  await prisma.bankContract.update({ where: { id: Number(id) }, data: { status: 'CANCELLED' } })
  return true
}

export async function listBatches(query = {}) {
  const rows = await prisma.bankBatch.findMany({ where: { ...(query.period ? { period: query.period } : {}), ...(query.status ? { status: query.status } : {}) }, orderBy: { id: 'desc' } })
  const communities = await prisma.community.findMany({ where: { id: { in: rows.map((row) => row.communityId).filter(Boolean) } } })
  const map = new Map(communities.map((row) => [row.id, row.name]))
  return page(rows.map((row) => bankBatchVO({ ...row, communityName: map.get(row.communityId) })), query)
}

function dueOf(bill) { return netOf(bill).minus(D(bill.paidAmount)).isNegative() ? D(0) : netOf(bill).minus(D(bill.paidAmount)) }

export async function generateBatch(request, payload) {
  const bills = await prisma.bill.findMany({
    where: { period: String(payload.period), status: { in: ['UNPAID', 'PARTIAL'] }, ...(payload.communityId ? { communityId: Number(payload.communityId) } : {}), ...(payload.buildingId ? { room: { buildingId: Number(payload.buildingId) } } : {}) },
    include: { room: true }
  })
  const contracts = await prisma.bankContract.findMany({ where: { status: 'ACTIVE', roomId: { in: bills.map((row) => row.roomId) } } })
  const contractMap = new Map(contracts.map((row) => [row.roomId, row]))
  const selected = bills.filter((bill) => dueOf(bill).gt(0) && contractMap.has(bill.roomId))
  if (!selected.length) bad('没有找到已签约且有欠费的房屋')
  const total = selected.reduce((sum, bill) => sum.plus(dueOf(bill)), D(0))
  const batch = await prisma.$transaction(async (tx) => {
    const no = `BD${dayjs().format('YYYYMMDDHHmmss')}${String(await nextSequence(tx, 'bank-batch')).padStart(4, '0')}`
    const created = await tx.bankBatch.create({ data: { batchNo: no, period: String(payload.period), communityId: payload.communityId ? Number(payload.communityId) : null, totalCount: selected.length, totalAmount: total, operator: request.user?.username || 'system', fileName: `${no}.csv` } })
    for (const bill of selected) {
      const contract = contractMap.get(bill.roomId)
      await tx.bankBatchItem.create({ data: { batchId: created.id, roomId: bill.roomId, billId: bill.id, amount: dueOf(bill), accountName: contract.accountName, accountNoMasked: contract.accountNoMasked } })
    }
    return created
  })
  await recordLog(request, { module: '银行代扣', action: '生成报盘', target: batch.batchNo, detail: `${selected.length} 笔，${yuan(total)} 元` })
  return getBatch(batch.id)
}

export async function getBatch(id) {
  const row = await prisma.bankBatch.findUnique({ where: { id: Number(id) } })
  if (!row) bad('代扣批次不存在')
  const items = await prisma.bankBatchItem.findMany({ where: { batchId: row.id }, orderBy: { id: 'asc' } })
  const rooms = await roomInfo(items.map((item) => item.roomId))
  const bills = await prisma.bill.findMany({ where: { id: { in: items.map((item) => item.billId) } }, select: { id: true, billNo: true, period: true } })
  const billMap = new Map(bills.map((bill) => [bill.id, bill]))
  return bankBatchVO(row, items.map((item) => ({ ...item, roomNo: rooms.get(item.roomId)?.roomNo, roomName: rooms.get(item.roomId)?.roomNo, billNo: billMap.get(item.billId)?.billNo, period: billMap.get(item.billId)?.period })))
}

export async function exportBatch(id) {
  const batch = await getBatch(id)
  const lines = ['房号,户名,账号,金额(元),账期,签约号']
  for (const item of batch.items || []) lines.push([item.roomNo, item.accountName, item.accountNoMasked, item.amount.toFixed(2), item.period, ''].map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function csvCell(value) { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text }

export async function importBatchReturn(request, id, payload) {
  const batch = await prisma.bankBatch.findUnique({ where: { id: Number(id) } })
  if (!batch) bad('代扣批次不存在')
  const text = String(payload.content || '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) bad('回盘文件没有有效数据')
  const items = await prisma.bankBatchItem.findMany({ where: { batchId: batch.id } })
  const rooms = await roomInfo(items.map((item) => item.roomId))
  const byRoom = new Map(items.map((item) => [rooms.get(item.roomId)?.roomNo, item]))
  let success = 0; let failed = 0; let totalAmount = D(0)
  await prisma.$transaction(async (tx) => {
    for (const line of lines.slice(1)) {
      const [roomNo, amountText, result, reason] = line.split(',').map((part) => part.replace(/^"|"$/g, '').trim())
      const item = byRoom.get(roomNo)
      if (!item) continue
      if (['成功', 'SUCCESS', '1', 'OK'].includes(String(result).toUpperCase())) {
        const amount = D(amountText)
        const bill = await tx.bill.findUnique({ where: { id: item.billId } })
        if (!bill || amount.lte(0)) continue
        const payment = await tx.payment.create({ data: { paymentNo: await nextPaymentNo(tx, dayjs().format('YYYY-MM-DD')), communityId: bill.communityId, roomId: bill.roomId, amount, method: 'BANK_DEDUCT', channel: 'COUNTER', bizType: 'BILL', paidAt: new Date(), operator: request.user?.username || 'system', remark: `代扣批次 ${batch.batchNo}` } })
        const due = dueOf(bill); const alloc = amount.gt(due) ? due : amount
        if (alloc.gt(0)) {
          const newPaid = D(bill.paidAmount).plus(alloc)
          await tx.bill.update({ where: { id: bill.id }, data: { paidAmount: newPaid, status: newPaid.gte(netOf(bill)) ? 'PAID' : 'PARTIAL' } })
          await tx.paymentAllocation.create({ data: { paymentId: payment.id, billId: bill.id, amount: alloc } })
        }
        await tx.bankBatchItem.update({ where: { id: item.id }, data: { result: 'SUCCESS', failReason: null } })
        success += 1; totalAmount = totalAmount.plus(amount)
      } else {
        await tx.bankBatchItem.update({ where: { id: item.id }, data: { result: 'FAIL', failReason: reason || '银行返回失败' } })
        failed += 1
      }
    }
    await tx.bankBatch.update({ where: { id: batch.id }, data: { status: 'RETURNED', successCount: success, failCount: failed, returnedAt: new Date(), fileName: payload.fileName || batch.fileName } })
  })
  return { success, failed, totalAmount: yuan(totalAmount) }
}

export async function closeBatch(id) { await prisma.bankBatch.update({ where: { id: Number(id) }, data: { status: 'CLOSED' } }); return true }

// ---------- 通知 ----------
export async function listTemplates(query = {}) { return page((await prisma.noticeTemplate.findMany({ orderBy: { id: 'desc' } })).map(noticeTemplateVO), query) }
export async function saveTemplate(payload, id = null) {
  const data = { name: String(payload.name || '').trim(), channel: payload.channel || 'SMS', title: payload.title || null, content: String(payload.content || '').trim(), enabled: payload.enabled !== false, remark: payload.remark || null }
  if (!data.name || !data.content) bad('模板名称和内容不能为空')
  return noticeTemplateVO(id ? await prisma.noticeTemplate.update({ where: { id: Number(id) }, data }) : await prisma.noticeTemplate.create({ data }))
}
export async function deleteTemplate(id) { await prisma.noticeTemplate.delete({ where: { id: Number(id) } }); return true }
export async function listNotices(query = {}) {
  const rows = await prisma.notice.findMany({ where: { ...(query.channel ? { channel: query.channel } : {}), ...(query.status ? { status: query.status } : {}), ...(query.roomId ? { roomId: Number(query.roomId) } : {}) }, orderBy: { id: 'desc' } })
  const rooms = await roomInfo(rows.map((row) => row.roomId)); const owners = await ownerInfo(rows.map((row) => row.roomId)); const templates = await prisma.noticeTemplate.findMany({ where: { id: { in: rows.map((row) => row.templateId).filter(Boolean) } } }); const tm = new Map(templates.map((row) => [row.id, row.name]))
  return page(rows.map((row) => { const room = rooms.get(row.roomId); return noticeVO({ ...row, templateName: tm.get(row.templateId), roomNo: room?.roomNo, communityName: room?.community?.name, ownerName: owners.get(row.roomId)?.name }) }), query)
}
function renderNotice(template, owner, room, bill, channel) { const values = { '{业主}': owner?.name || '业主', '{房号}': room?.roomNo || '', '{小区}': room?.community?.name || '', '{账期}': bill?.period || '', '{金额}': bill ? yuan(netOf(bill).minus(D(bill.paidAmount))) : 0, '{应缴日}': bill?.dueDate ? dayjs(bill.dueDate).format('YYYY-MM-DD') : '' }; let content = template.content; Object.entries(values).forEach(([key, value]) => { content = content.replaceAll(key, String(value)) }); return { content, receiver: channel === 'EMAIL' ? (owner?.phone ? `${owner.phone}@demo.invalid` : 'owner@example.invalid') : maskPhone(owner?.phone) } }
export async function sendNotices(request, payload) {
  const template = await prisma.noticeTemplate.findUnique({ where: { id: Number(payload.templateId) } }); if (!template) bad('通知模板不存在')
  const bills = await prisma.bill.findMany({ where: { status: { in: ['UNPAID', 'PARTIAL'] }, ...(payload.billIds?.length ? { id: { in: payload.billIds.map(Number) } } : {}), ...(payload.roomIds?.length ? { roomId: { in: payload.roomIds.map(Number) } } : {}), ...(payload.period ? { period: payload.period } : {}) }, include: { room: { include: { community: true } } } })
  const owners = await ownerInfo(bills.map((bill) => bill.roomId)); let sentCount = 0; let failedCount = 0; const records = []
  for (const bill of bills) { const owner = owners.get(bill.roomId); const rendered = renderNotice(template, owner, bill.room, bill, payload.channel || template.channel); if (payload.dryRun) { records.push({ billId: bill.id, roomNo: bill.room.roomNo, ...rendered }); continue } const row = await prisma.notice.create({ data: { channel: payload.channel || template.channel, templateId: template.id, roomId: bill.roomId, billId: bill.id, receiver: rendered.receiver, content: rendered.content, status: 'SENT', provider: 'mock', providerMsg: '模拟通道发送成功', sentAt: new Date(), operator: request.user?.username || 'system' } }); records.push(noticeVO({ ...row, roomNo: bill.room.roomNo, communityName: bill.room.community?.name, ownerName: owner?.name, templateName: template.name })); sentCount++ }
  failedCount = 0
  return { sentCount, failedCount, records }
}

// ---------- 收据 / 发票 ----------
export async function listReceipts(query = {}) {
  const rows = await prisma.receipt.findMany({ where: { ...(query.roomId ? { roomId: Number(query.roomId) } : {}), ...(query.type ? { type: query.type } : {}), ...(query.status ? { status: query.status } : {}) }, orderBy: { id: 'desc' } })
  const payments = await prisma.payment.findMany({ where: { id: { in: rows.map((row) => row.paymentId) } }, select: { id: true, paymentNo: true } }); const pm = new Map(payments.map((row) => [row.id, row.paymentNo])); const rooms = await roomInfo(rows.map((row) => row.roomId))
  return page(rows.map((row) => { const room = rooms.get(row.roomId); return receiptVO({ ...row, paymentNo: pm.get(row.paymentId), roomNo: room?.roomNo, communityName: room?.community?.name }) }), query)
}
export async function issueReceipt(request, payload) {
  const payment = await prisma.payment.findUnique({ where: { id: Number(payload.paymentId) }, include: { room: { include: { community: true } } } }); if (!payment) bad('收款单不存在')
  const existing = await prisma.receipt.findFirst({ where: { paymentId: payment.id, type: payload.type, status: 'ISSUED' } }); if (existing) bad('该收款单同类型票据已经开具')
  const amount = payload.amount === undefined ? D(payment.amount) : D(payload.amount); if (amount.lte(0) || amount.gt(D(payment.amount))) bad('开票金额不正确')
  const no = `R${dayjs().format('YYYYMMDDHHmmss')}${String(await nextSequence(null, 'receipt')).padStart(4, '0')}`
  const row = await prisma.receipt.create({ data: { receiptNo: no, type: payload.type || 'RECEIPT', paymentId: payment.id, roomId: payment.roomId, title: String(payload.title || '个人'), taxNo: payload.taxNo || null, amount, issuedAt: new Date(), operator: request.user?.username || 'system', remark: payload.remark || null } })
  return receiptVO({ ...row, paymentNo: payment.paymentNo, roomNo: payment.room?.roomNo, communityName: payment.room?.community?.name })
}
export async function voidReceipt(id, reason) { if (!reason) bad('请填写作废原因'); return receiptVO(await prisma.receipt.update({ where: { id: Number(id) }, data: { status: 'VOID', voidReason: String(reason).slice(0, 255) } })) }
export async function receiptPrint(id) {
  const row = await prisma.receipt.findUnique({ where: { id: Number(id) } }); if (!row) bad('票据不存在')
  const payment = await prisma.payment.findUnique({ where: { id: row.paymentId }, include: { room: { include: { community: true } } } })
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${row.receiptNo}</title><style>body{font-family:Arial,"Microsoft YaHei";width:720px;margin:40px auto;color:#222}.title{text-align:center;font-size:26px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;border:1px solid #333;padding:20px;margin-top:24px}.amount{font-size:26px;font-weight:bold;text-align:right;margin:28px 0}button{padding:8px 16px}@media print{button{display:none}}</style></head><body><h1 class="title">${row.type === 'INVOICE' ? '物业服务发票' : '物业收费收据'}</h1><div class="meta"><div>票据号：${row.receiptNo}</div><div>状态：${row.status === 'VOID' ? '已作废' : '有效'}</div><div>小区：${payment?.room?.community?.name || ''}</div><div>房号：${payment?.room?.roomNo || ''}</div><div>抬头：${row.title}</div><div>税号：${row.taxNo || ''}</div></div><div class="amount">金额：¥ ${yuan(row.amount).toFixed(2)}</div><p>收款单号：${payment?.paymentNo || ''}</p><p>开具时间：${dateTimeStr(row.issuedAt)}</p><button onclick="window.print()">打印</button></body></html>`
}

// ---------- CSV 导入导出 ----------
export function parseCsv(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []; let current = []; let cell = ''; let quoted = false
  for (let i = 0; i < source.length; i++) { const ch = source[i]; const next = source[i + 1]; if (ch === '"' && quoted && next === '"') { cell += '"'; i++; continue } if (ch === '"') { quoted = !quoted; continue } if (!quoted && (ch === ',' || ch === '\n' || ch === '\r')) { if (ch === '\r' && next === '\n') i++; current.push(cell); cell = ''; if (ch === '\n' || ch === '\r') { rows.push(current); current = [] } continue } cell += ch }
  if (cell || current.length) { current.push(cell); rows.push(current) }
  return rows.filter((row) => row.some((value) => String(value).trim() !== ''))
}
function enumValue(value, map) { const text = String(value || '').trim(); return map[text] || text }
const roomTypeMap = { 住宅: 'RESIDENCE', 商铺: 'SHOP', 办公: 'OFFICE', 车位: 'PARKING', RESIDENCE: 'RESIDENCE', SHOP: 'SHOP', OFFICE: 'OFFICE', PARKING: 'PARKING' }
const roomStatusMap = { 空置: 'VACANT', 自住: 'OCCUPIED', 出租: 'RENTED', VACANT: 'VACANT', OCCUPIED: 'OCCUPIED', RENTED: 'RENTED' }
const residentTypeMap = { 业主: 'OWNER', 租户: 'TENANT', 家属: 'FAMILY', OWNER: 'OWNER', TENANT: 'TENANT', FAMILY: 'FAMILY' }

export async function importData(request, type, payload) {
  const rows = parseCsv(payload.content); if (rows.length < 2) bad('CSV 没有有效数据')
  const headers = rows[0].map((x) => x.trim()); const data = rows.slice(1); const errors = []; let success = 0
  const communities = await prisma.community.findMany(); const communityMap = new Map(communities.map((row) => [row.code, row])); const buildings = await prisma.building.findMany(); const buildingMap = new Map(buildings.map((row) => [`${row.communityId}:${row.name}`, row])); const rooms = await prisma.room.findMany(); const roomMap = new Map(rooms.map((row) => [`${row.communityId}:${row.roomNo}`, row])); const fees = await prisma.feeItem.findMany(); const feeMap = new Map(fees.map((row) => [row.code, row]))
  for (let i = 0; i < data.length; i++) {
    const values = data[i]; const row = Object.fromEntries(headers.map((key, index) => [key, values[index] ?? '']))
    try {
      if (type === 'rooms') {
        const community = communityMap.get(row.小区编码); if (!community) bad(`小区编码不存在：${row.小区编码}`)
        const building = buildingMap.get(`${community.id}:${row.楼栋}`) || await prisma.building.create({ data: { communityId: community.id, name: row.楼栋, unitCount: 1 } }); buildingMap.set(`${community.id}:${row.楼栋}`, building)
        const key = `${community.id}:${row.房号}`; if (roomMap.has(key)) bad(`房号已存在：${row.房号}`)
        const room = await prisma.room.create({ data: { communityId: community.id, buildingId: building.id, unit: row.单元 || null, roomNo: row.房号, floor: row.楼层 ? Number(row.楼层) : null, area: row.面积 ? D(row.面积) : null, roomType: enumValue(row.房屋类型, roomTypeMap) || 'RESIDENCE', status: enumValue(row.使用状态, roomStatusMap) || 'VACANT' } }); roomMap.set(key, room)
      } else if (type === 'residents') {
        const community = communityMap.get(row.小区编码); const room = community && roomMap.get(`${community.id}:${row.房号}`); if (!room) bad(`房屋不存在：${row.房号}`)
        await prisma.resident.create({ data: { roomId: room.id, name: row.姓名, phone: row.电话 || null, idCard: row.证件号 || null, residentType: enumValue(row.住户类型, residentTypeMap) || 'OWNER', startDate: row.入住日期 ? toDate(row.入住日期) : null, status: 'LIVING' } })
      } else if (type === 'arrears') {
        const community = communityMap.get(row.小区编码); const room = community && roomMap.get(`${community.id}:${row.房号}`); const fee = feeMap.get(row.收费项目编码); if (!room || !fee) bad('房屋或收费项目不存在')
        const amount = D(row.金额); const bill = await prisma.bill.create({ data: { billNo: `H${dayjs().format('YYYYMMDDHHmmss')}${i}`, communityId: community.id, roomId: room.id, feeItemId: fee.id, period: row.账期, chargeMode: fee.chargeMode, quantity: 1, unitPrice: amount, amount, discount: 0, lateFee: 0, paidAmount: 0, status: 'UNPAID', dueDate: toDate(row.应缴日) || new Date(), generatedAt: new Date(), remark: '历史数据导入' } }); void bill
      } else if (type === 'advances') {
        const community = communityMap.get(row.小区编码); const room = community && roomMap.get(`${community.id}:${row.房号}`); if (!room) bad(`房屋不存在：${row.房号}`)
        const amount = D(row.金额); const accountType = String(row.类型).includes('押金') ? 'DEPOSIT' : 'ADVANCE'; await applyFlow(null, { roomId: room.id, accountType, direction: 'IN', amount, bizType: 'IMPORT', operator: request.user?.username || 'system', remark: row.备注 || '历史数据导入' })
      } else bad('不支持的导入类型')
      success++
    } catch (error) { errors.push({ line: i + 2, message: error.message || '导入失败' }) }
  }
  const log = await prisma.importLog.create({ data: { type, fileName: payload.fileName || null, totalCount: data.length, successCount: success, failCount: errors.length, detail: JSON.stringify(errors.slice(0, 100)), operator: request.user?.username || 'system' } })
  return { total: data.length, success, failed: errors.length, errors, importLogId: log.id }
}

export async function listImportLogs(query = {}) { return page((await prisma.importLog.findMany({ orderBy: { id: 'desc' } })).map(importLogVO), query) }

export async function exportCsv(type, query = {}) {
  let headers = []; let rows = []
  if (type === 'rooms') { headers = ['小区编码', '楼栋', '单元', '房号', '楼层', '面积', '房屋类型', '使用状态']; const data = await prisma.room.findMany({ include: { community: true, building: true }, orderBy: { id: 'asc' } }); rows = data.map((r) => [r.community?.code, r.building?.name, r.unit, r.roomNo, r.floor, yuan(r.area || 0), r.roomType, r.status]) }
  else if (type === 'residents') { headers = ['小区编码', '房号', '姓名', '电话', '证件号', '住户类型', '入住日期']; const data = await prisma.resident.findMany({ include: { room: { include: { community: true } } }, orderBy: { id: 'asc' } }); rows = data.map((r) => [r.room?.community?.code, r.room?.roomNo, r.name, r.phone, r.idCard, r.residentType, r.startDate ? dayjs(r.startDate).format('YYYY-MM-DD') : '']) }
  else if (type === 'bills' || type === 'arrears') { headers = ['账单号', '小区', '楼栋', '房号', '收费项目', '账期', '金额', '减免', '滞纳金', '应收', '已收', '欠费', '状态', '应缴日']; const data = await prisma.bill.findMany({ where: { status: { not: 'VOID' }, ...(type === 'arrears' ? {} : {}) }, include: { room: { include: { community: true, building: true } }, feeItem: true }, orderBy: { id: 'asc' } }); rows = data.map((b) => { const vo = billVO(b); return [b.billNo, b.room?.community?.name, b.room?.building?.name, b.room?.roomNo, b.feeItem?.name, b.period, vo.amount, vo.discount, vo.lateFee, vo.netAmount, vo.paidAmount, vo.arrears, vo.status, vo.dueDate] }).filter((row) => type !== 'arrears' || Number(row[11]) > 0) }
  else if (type === 'payments') { headers = ['收款单号', '小区', '房号', '金额', '方式', '收款时间', '操作人', '已核销', '预收', '备注']; const data = await prisma.payment.findMany({ include: { room: { include: { community: true } }, allocations: true }, orderBy: { id: 'asc' } }); rows = data.map((p) => { const allocated = p.allocations.reduce((a, x) => a.plus(D(x.amount)), D(0)); return [p.paymentNo, p.room?.community?.name, p.room?.roomNo, yuan(p.amount), p.method, dateTimeStr(p.paidAt), p.operator, yuan(allocated), p.bizType === 'DEPOSIT' ? 0 : yuan(D(p.amount).minus(allocated)), p.remark] }) }
  else if (type === 'fund-flows') { headers = ['房号', '账户类型', '方向', '金额', '余额', '业务', '操作人', '时间', '备注']; const data = await prisma.fundFlow.findMany({ orderBy: { id: 'asc' } }); const rooms = await roomInfo(data.map((x) => x.roomId)); rows = data.map((f) => [rooms.get(f.roomId)?.roomNo, f.accountType, f.direction, yuan(f.amount), yuan(f.balanceAfter), f.bizType, f.operator, dateTimeStr(f.occurredAt), f.remark]) }
  else bad('不支持的导出类型')
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

// ---------- 业主端 H5 ----------
export async function portalLogin(payload) {
  const room = await prisma.room.findFirst({ where: { roomNo: String(payload.roomNo || '').trim() }, include: { community: true, building: true } }); if (!room) bad('房号不存在')
  const owner = await prisma.resident.findFirst({ where: { roomId: room.id, status: 'LIVING', residentType: 'OWNER' } }); if (!owner) bad('该房屋没有登记业主')
  if (!owner.phone || !String(owner.phone).endsWith(String(payload.phoneSuffix || ''))) bad('房号或手机号后四位不正确')
  return { room: { id: room.id, roomNo: room.roomNo, communityName: room.community?.name, buildingName: room.building?.name, area: yuan(room.area || 0) }, ownerName: owner.name, phone: maskPhone(owner.phone) }
}
export async function portalBills(roomId, query = {}) { const rows = await prisma.bill.findMany({ where: { roomId: Number(roomId), ...(query.status ? { status: query.status } : {}), status: query.status || { not: 'VOID' } }, include: { room: { include: { community: true, building: true } }, feeItem: true }, orderBy: [{ period: 'desc' }, { id: 'desc' }] }); return rows.map(billVO) }
export async function portalPayments(roomId) { const rows = await prisma.payment.findMany({ where: { roomId: Number(roomId) }, include: { room: { include: { community: true, building: true } }, allocations: true }, orderBy: { paidAt: 'desc' } }); return rows.map((row) => ({ paymentNo: row.paymentNo, amount: yuan(row.amount), method: row.method, paidAt: dateTimeStr(row.paidAt), remark: row.remark })) }
export async function portalSummary(roomId) { const bills = await portalBills(roomId, {}); return { arrears: yuan(bills.reduce((a, b) => a.plus(D(b.arrears)), D(0))), unpaidCount: bills.filter((b) => b.arrears > 0).length, advanceBalance: yuan((await getOrCreateAccount(prisma, Number(roomId))).advanceBalance) } }
export async function portalOrder(roomId, payload) { const ids = (payload.billIds || []).map(Number); if (!ids.length) bad('请选择要缴纳的账单'); const bills = await prisma.bill.findMany({ where: { id: { in: ids }, roomId: Number(roomId), status: { not: 'VOID' } } }); if (bills.length !== ids.length) bad('存在不属于当前房屋的账单'); const amount = bills.reduce((a, b) => a.plus(dueOf(b)), D(0)); if (amount.lte(0)) bad('所选账单没有欠费'); const orderNo = `O${dayjs().format('YYYYMMDDHHmmss')}${String(await nextSequence(null, 'portal-order')).padStart(4, '0')}`; return { orderNo, roomId: Number(roomId), billIds: ids, amount: yuan(amount), payUrl: `mock://wye-pay/${orderNo}`, status: 'PENDING' } }
export async function portalPay(roomId, orderNo, payload = {}) { const ids = (payload.billIds || []).map(Number); const bills = await prisma.bill.findMany({ where: { id: { in: ids }, roomId: Number(roomId), status: { not: 'VOID' } } }); const amount = bills.reduce((a, b) => a.plus(dueOf(b)), D(0)); const result = await (await import('./payments.js')).createPayment({ roomId: Number(roomId), amount: yuan(amount), billIds: ids, method: 'ONLINE', channel: 'PORTAL', remark: `业主端订单 ${orderNo}` }, 'portal'); return { orderNo, status: 'PAID', ...result } }
