// 出参序列化：实体不出接口，金额转元、日期转字符串、敏感字段脱敏
import { D, yuan } from '../common/money.js'
import { dateStr, dateTimeStr, maskIdCard, maskPhone } from '../common/utils.js'

export const communityVO = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  address: row.address,
  manager: row.manager,
  phone: row.phone,
  ledgerId: row.ledgerId ?? null,
  ledgerName: row.ledger?.name ?? null,
  remark: row.remark,
  buildingCount: row._count?.buildings,
  roomCount: row._count?.rooms
})

export const buildingVO = (row) => ({
  id: row.id,
  communityId: row.communityId,
  communityName: row.community?.name,
  name: row.name,
  unitCount: row.unitCount,
  remark: row.remark,
  roomCount: row._count?.rooms
})

export const roomVO = (row) => ({
  id: row.id,
  communityId: row.communityId,
  communityName: row.community?.name,
  buildingId: row.buildingId,
  buildingName: row.building?.name,
  unit: row.unit,
  roomNo: row.roomNo,
  floor: row.floor,
  area: row.area === null || row.area === undefined ? null : yuan(row.area),
  roomType: row.roomType,
  status: row.status,
  residentCount: row._count?.residents ?? 0,
  remark: row.remark
})

export const residentVO = (row) => ({
  id: row.id,
  roomId: row.roomId,
  roomNo: row.room?.roomNo,
  communityId: row.room?.communityId,
  communityName: row.room?.community?.name,
  buildingName: row.room?.building?.name,
  name: row.name,
  phone: row.phone,
  idCard: maskIdCard(row.idCard),
  residentType: row.residentType,
  startDate: dateStr(row.startDate),
  endDate: dateStr(row.endDate),
  status: row.status,
  remark: row.remark
})

export const feeItemVO = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  type: row.type,
  chargeMode: row.chargeMode,
  unitPrice: yuan(row.unitPrice),
  priceUnit: row.priceUnit,
  period: row.period,
  communityId: row.communityId,
  lateFeeRate: Number(D(row.lateFeeRate ?? 0).toString()),
  graceDays: row.graceDays ?? 0,
  enabled: row.enabled,
  sortNo: row.sortNo,
  remark: row.remark
})

/** 账单净额（含滞纳金）：口径见 docs/data-model.md §3.9 */
export function netOf(row) {
  return D(row.amount).minus(D(row.discount)).plus(D(row.lateFee || 0))
}

export function billAmounts(row) {
  const net = netOf(row)
  const paid = D(row.paidAmount)
  const arrears = net.minus(paid)
  return { net, paid, arrears }
}

export const billVO = (row) => {
  const { net, arrears } = billAmounts(row)
  return {
    id: row.id,
    billNo: row.billNo,
    communityId: row.communityId,
    communityName: row.room?.community?.name,
    roomId: row.roomId,
    roomNo: row.room?.roomNo,
    buildingName: row.room?.building?.name,
    feeItemId: row.feeItemId,
    feeItemName: row.feeItem?.name,
    period: row.period,
    chargeMode: row.chargeMode,
    quantity: yuan(row.quantity),
    unitPrice: yuan(row.unitPrice),
    amount: yuan(row.amount),
    discount: yuan(row.discount),
    lateFee: yuan(row.lateFee || 0),
    lateFeeAt: dateTimeStr(row.lateFeeAt),
    netAmount: yuan(net),
    paidAmount: yuan(row.paidAmount),
    arrears: yuan(arrears.isNegative() ? 0 : arrears),
    status: row.status,
    dueDate: dateStr(row.dueDate),
    generatedAt: dateTimeStr(row.generatedAt),
    remark: row.remark,
    voidReason: row.voidReason
  }
}

export const paymentVO = (row) => {
  const allocated = (row.allocations || []).reduce((acc, item) => acc.plus(D(item.amount)), D(0))
  const amount = D(row.amount)
  const left = amount.minus(allocated)
  const isDeposit = row.bizType === 'DEPOSIT'
  return {
    id: row.id,
    paymentNo: row.paymentNo,
    communityId: row.communityId,
    communityName: row.room?.community?.name,
    roomId: row.roomId,
    roomNo: row.room?.roomNo,
    buildingName: row.room?.building?.name,
    amount: yuan(amount),
    allocatedAmount: yuan(allocated),
    advanceAmount: yuan(isDeposit || left.isNegative() ? D(0) : left),
    bizType: row.bizType || 'BILL',
    method: row.method,
    channel: row.channel || 'COUNTER',
    paidAt: dateTimeStr(row.paidAt),
    operator: row.operator,
    remark: row.remark,
    allocationCount: (row.allocations || []).length
  }
}

export const meterReadingVO = (row, unitPrice) => ({
  id: row.id,
  roomId: row.roomId,
  roomNo: row.room?.roomNo,
  buildingName: row.room?.building?.name,
  communityName: row.room?.community?.name,
  feeItemId: row.feeItemId,
  feeItemName: row.feeItem?.name,
  period: row.period,
  prevReading: yuan(row.prevReading),
  currReading: yuan(row.currReading),
  usageQty: yuan(row.usageQty),
  unitPrice: unitPrice === undefined ? yuan(row.feeItem?.unitPrice) : yuan(unitPrice),
  estimatedAmount: yuan(D(row.usageQty).times(D(unitPrice ?? row.feeItem?.unitPrice ?? 0))),
  readingDate: dateStr(row.readingDate),
  operator: row.operator,
  remark: row.remark
})

export const userVO = (row) => ({
  id: row.id,
  username: row.username,
  realName: row.realName,
  role: row.role,
  phone: row.phone,
  dataScope: row.dataScope || 'ALL',
  communityIds: row.communityIds || [],
  enabled: row.enabled,
  remark: row.remark,
  createdAt: dateTimeStr(row.createdAt)
})

export const logVO = (row) => ({
  id: row.id,
  username: row.username,
  module: row.module,
  action: row.action,
  target: row.target,
  detail: row.detail,
  ip: row.ip,
  createdAt: dateTimeStr(row.createdAt)
})

export const optionVO = (row, label, extra) => ({
  id: row.id,
  label: label ?? row.name,
  extra: extra ?? null
})

// ==================== 二期 ====================

export const ledgerVO = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  company: row.company,
  enabled: row.enabled,
  remark: row.remark,
  communityCount: row._count?.communities ?? row.communityCount,
  createdAt: dateTimeStr(row.createdAt)
})

/** 房屋资金账户（含业主、欠费） */
export const accountVO = (row) => ({
  roomId: row.roomId,
  roomNo: row.roomNo,
  communityId: row.communityId,
  communityName: row.communityName,
  buildingName: row.buildingName,
  ownerName: row.ownerName,
  ownerPhone: maskPhone(row.ownerPhone),
  advanceBalance: yuan(row.advanceBalance || 0),
  depositBalance: yuan(row.depositBalance || 0),
  arrears: yuan(row.arrears || 0),
  totalBalance: yuan(D(row.advanceBalance || 0).plus(D(row.depositBalance || 0)))
})

export const flowVO = (row) => ({
  id: row.id,
  roomId: row.roomId,
  roomNo: row.roomNo,
  communityName: row.communityName,
  buildingName: row.buildingName,
  accountType: row.accountType,
  direction: row.direction,
  amount: yuan(row.amount),
  balanceAfter: yuan(row.balanceAfter),
  bizType: row.bizType,
  refType: row.refType,
  refId: row.refId,
  operator: row.operator,
  remark: row.remark,
  occurredAt: dateTimeStr(row.occurredAt)
})

export const bankContractVO = (row) => ({
  id: row.id,
  roomId: row.roomId,
  roomNo: row.roomNo,
  communityName: row.communityName,
  buildingName: row.buildingName,
  bankName: row.bankName,
  accountName: row.accountName,
  accountNoMasked: row.accountNoMasked,
  contractNo: row.contractNo,
  status: row.status,
  signedAt: dateStr(row.signedAt),
  remark: row.remark
})

export const bankBatchVO = (row, items) => ({
  id: row.id,
  batchNo: row.batchNo,
  period: row.period,
  communityId: row.communityId,
  communityName: row.communityName,
  totalCount: row.totalCount,
  totalAmount: yuan(row.totalAmount),
  successCount: row.successCount,
  failCount: row.failCount,
  status: row.status,
  fileName: row.fileName,
  operator: row.operator,
  returnedAt: dateTimeStr(row.returnedAt),
  remark: row.remark,
  createdAt: dateTimeStr(row.createdAt),
  items: items ? items.map(bankBatchItemVO) : undefined
})

export const bankBatchItemVO = (row) => ({
  id: row.id,
  roomId: row.roomId,
  roomNo: row.roomNo,
  roomName: row.roomName,
  billId: row.billId,
  billNo: row.billNo,
  period: row.period,
  amount: yuan(row.amount),
  result: row.result,
  failReason: row.failReason,
  accountName: row.accountName,
  accountNoMasked: row.accountNoMasked
})

export const noticeTemplateVO = (row) => ({
  id: row.id,
  name: row.name,
  channel: row.channel,
  title: row.title,
  content: row.content,
  enabled: row.enabled,
  remark: row.remark
})

export const noticeVO = (row) => ({
  id: row.id,
  channel: row.channel,
  templateId: row.templateId,
  templateName: row.templateName,
  roomId: row.roomId,
  roomNo: row.roomNo,
  communityName: row.communityName,
  ownerName: row.ownerName,
  billId: row.billId,
  receiver: row.receiver,
  content: row.content,
  status: row.status,
  provider: row.provider,
  providerMsg: row.providerMsg,
  sentAt: dateTimeStr(row.sentAt),
  operator: row.operator,
  createdAt: dateTimeStr(row.createdAt)
})

export const receiptVO = (row) => ({
  id: row.id,
  receiptNo: row.receiptNo,
  type: row.type,
  paymentId: row.paymentId,
  paymentNo: row.paymentNo,
  roomId: row.roomId,
  roomNo: row.roomNo,
  communityName: row.communityName,
  title: row.title,
  taxNo: row.taxNo,
  amount: yuan(row.amount),
  status: row.status,
  issuedAt: dateTimeStr(row.issuedAt),
  operator: row.operator,
  voidReason: row.voidReason,
  remark: row.remark
})

export const approvalVO = (row) => ({
  id: row.id,
  approvalNo: row.approvalNo,
  type: row.type,
  targetType: row.targetType,
  targetId: row.targetId,
  billNo: row.billNo,
  roomId: row.roomId,
  roomNo: row.roomNo,
  communityName: row.communityName,
  amount: yuan(row.amount),
  reason: row.reason,
  applicant: row.applicant,
  status: row.status,
  approver: row.approver,
  approveRemark: row.approveRemark,
  decidedAt: dateTimeStr(row.decidedAt),
  createdAt: dateTimeStr(row.createdAt)
})

export const importLogVO = (row) => ({
  id: row.id,
  type: row.type,
  fileName: row.fileName,
  totalCount: row.totalCount,
  successCount: row.successCount,
  failCount: row.failCount,
  operator: row.operator,
  createdAt: dateTimeStr(row.createdAt)
})
