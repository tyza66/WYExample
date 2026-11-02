// 出参序列化：实体不出接口，金额转元、日期转字符串、敏感字段脱敏
import { D, yuan } from '../common/money.js'
import { dateStr, dateTimeStr, maskIdCard } from '../common/utils.js'

export const communityVO = (row) => ({
  id: row.id,
  name: row.name,
  code: row.code,
  address: row.address,
  manager: row.manager,
  phone: row.phone,
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
  enabled: row.enabled,
  sortNo: row.sortNo,
  remark: row.remark
})

/** 账单净额与欠费：口径见 docs/data-model.md §3.5 */
export function billAmounts(row) {
  const net = D(row.amount).minus(D(row.discount))
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
    advanceAmount: yuan(amount.minus(allocated).isNegative() ? D(0) : amount.minus(allocated)),
    method: row.method,
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
