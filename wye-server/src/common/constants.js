// 枚举与中文标签：与 docs/data-model.md 保持一致
export const ROLE = {
  ADMIN: 'ADMIN',
  CASHIER: 'CASHIER',
  VIEWER: 'VIEWER'
}

export const ROOM_TYPE = { RESIDENCE: 'RESIDENCE', SHOP: 'SHOP', OFFICE: 'OFFICE', PARKING: 'PARKING' }
export const ROOM_STATUS = { VACANT: 'VACANT', OCCUPIED: 'OCCUPIED', RENTED: 'RENTED' }
export const RESIDENT_TYPE = { OWNER: 'OWNER', TENANT: 'TENANT', FAMILY: 'FAMILY' }
export const RESIDENT_STATUS = { LIVING: 'LIVING', MOVED_OUT: 'MOVED_OUT' }
export const FEE_TYPE = { PROPERTY: 'PROPERTY', WATER: 'WATER', ELECTRIC: 'ELECTRIC', PARKING: 'PARKING', OTHER: 'OTHER' }
export const CHARGE_MODE = { AREA: 'AREA', UNIT: 'UNIT', METER: 'METER', FIXED: 'FIXED' }
export const FEE_PERIOD = { MONTHLY: 'MONTHLY', QUARTERLY: 'QUARTERLY', YEARLY: 'YEARLY', ONCE: 'ONCE' }
export const PAYMENT_METHOD = {
  CASH: 'CASH',
  WECHAT: 'WECHAT',
  ALIPAY: 'ALIPAY',
  BANK_TRANSFER: 'BANK_TRANSFER',
  POS: 'POS',
  BANK_DEDUCT: 'BANK_DEDUCT'
}
export const BILL_STATUS = { UNPAID: 'UNPAID', PARTIAL: 'PARTIAL', PAID: 'PAID', VOID: 'VOID' }

export const LABELS = {
  role: { ADMIN: '管理员', CASHIER: '收费员', VIEWER: '只读' },
  roomType: { RESIDENCE: '住宅', SHOP: '商铺', OFFICE: '办公', PARKING: '车位' },
  roomStatus: { VACANT: '空置', OCCUPIED: '自住', RENTED: '出租' },
  residentType: { OWNER: '业主', TENANT: '租户', FAMILY: '家属' },
  residentStatus: { LIVING: '在住', MOVED_OUT: '已迁出' },
  feeType: { PROPERTY: '物业费', WATER: '水费', ELECTRIC: '电费', PARKING: '车位费', OTHER: '其他' },
  chargeMode: { AREA: '按面积', UNIT: '按户', METER: '按用量', FIXED: '固定金额' },
  feePeriod: { MONTHLY: '按月', QUARTERLY: '按季', YEARLY: '按年', ONCE: '一次性' },
  paymentMethod: {
    CASH: '现金',
    WECHAT: '微信',
    ALIPAY: '支付宝',
    BANK_TRANSFER: '银行转账',
    POS: 'POS 刷卡',
    BANK_DEDUCT: '银行代扣'
  },
  billStatus: { UNPAID: '未缴', PARTIAL: '部分缴', PAID: '已缴清', VOID: '已作废' }
}

export const values = (dict) => Object.values(dict)
export const valuesOf = values
export const isOneOf = (dict, value) => Object.values(dict).includes(value)
