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
  BANK_DEDUCT: 'BANK_DEDUCT',
  ONLINE: 'ONLINE',
  BALANCE: 'BALANCE'
}
export const BILL_STATUS = { UNPAID: 'UNPAID', PARTIAL: 'PARTIAL', PAID: 'PAID', VOID: 'VOID' }

// ---- 二期枚举 ----
export const DATA_SCOPE = { ALL: 'ALL', COMMUNITY: 'COMMUNITY' }
export const PAYMENT_CHANNEL = { COUNTER: 'COUNTER', PORTAL: 'PORTAL' }
export const ACCOUNT_TYPE = { ADVANCE: 'ADVANCE', DEPOSIT: 'DEPOSIT' }
export const FLOW_DIRECTION = { IN: 'IN', OUT: 'OUT' }
export const FLOW_BIZ = {
  PAYMENT_ADVANCE: 'PAYMENT_ADVANCE',
  ADVANCE_USE: 'ADVANCE_USE',
  DEPOSIT_IN: 'DEPOSIT_IN',
  DEPOSIT_REFUND: 'DEPOSIT_REFUND',
  ADVANCE_REFUND: 'ADVANCE_REFUND',
  IMPORT: 'IMPORT'
}
export const CONTRACT_STATUS = { ACTIVE: 'ACTIVE', CANCELLED: 'CANCELLED' }
export const BATCH_STATUS = { GENERATED: 'GENERATED', SENT: 'SENT', RETURNED: 'RETURNED', CLOSED: 'CLOSED' }
export const BATCH_ITEM_RESULT = { PENDING: 'PENDING', SUCCESS: 'SUCCESS', FAIL: 'FAIL' }
export const NOTICE_CHANNEL = { SMS: 'SMS', EMAIL: 'EMAIL' }
export const NOTICE_STATUS = { PENDING: 'PENDING', SENT: 'SENT', FAILED: 'FAILED' }
export const RECEIPT_TYPE = { RECEIPT: 'RECEIPT', INVOICE: 'INVOICE' }
export const RECEIPT_STATUS = { ISSUED: 'ISSUED', VOID: 'VOID' }
export const APPROVAL_TYPE = { BILL_DISCOUNT: 'BILL_DISCOUNT', ADVANCE_REFUND: 'ADVANCE_REFUND', DEPOSIT_REFUND: 'DEPOSIT_REFUND' }
export const APPROVAL_STATUS = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' }
export const IMPORT_TYPE = { rooms: 'rooms', residents: 'residents', arrears: 'arrears', advances: 'advances' }

/** 减免金额达到该值时必须走审批（docs/data-model.md §3.12） */
export const DISCOUNT_APPROVAL_THRESHOLD = 100

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
    BANK_DEDUCT: '银行代扣',
    ONLINE: '在线支付',
    BALANCE: '预收抵扣'
  },
  billStatus: { UNPAID: '未缴', PARTIAL: '部分缴', PAID: '已缴清', VOID: '已作废' },
  dataScope: { ALL: '全部小区', COMMUNITY: '指定小区' },
  accountType: { ADVANCE: '预收余额', DEPOSIT: '押金' },
  flowDirection: { IN: '收入', OUT: '支出' },
  flowBiz: {
    PAYMENT_ADVANCE: '收款转预收',
    ADVANCE_USE: '预收抵扣',
    DEPOSIT_IN: '收取押金',
    DEPOSIT_REFUND: '退还押金',
    ADVANCE_REFUND: '退还预收',
    IMPORT: '历史数据导入'
  },
  contractStatus: { ACTIVE: '正常', CANCELLED: '已解约' },
  batchStatus: { GENERATED: '已生成', SENT: '已报盘', RETURNED: '已回盘', CLOSED: '已关闭' },
  batchItemResult: { PENDING: '待处理', SUCCESS: '成功', FAIL: '失败' },
  noticeChannel: { SMS: '短信', EMAIL: '邮件' },
  noticeStatus: { PENDING: '待发送', SENT: '已发送', FAILED: '发送失败' },
  receiptType: { RECEIPT: '收据', INVOICE: '发票' },
  receiptStatus: { ISSUED: '已开具', VOID: '已作废' },
  approvalType: { BILL_DISCOUNT: '账单减免', ADVANCE_REFUND: '预收退款', DEPOSIT_REFUND: '押金退还' },
  approvalStatus: { PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回' },
  importType: { rooms: '房屋', residents: '住户', arrears: '历史欠费', advances: '历史预收押金' }
}

export const values = (dict) => Object.values(dict)
export const valuesOf = values
export const isOneOf = (dict, value) => Object.values(dict).includes(value)
