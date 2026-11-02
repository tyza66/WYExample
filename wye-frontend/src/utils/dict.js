/**
 * 全局字典：所有枚举的 label 与 el-tag 颜色映射集中在这里，页面复用。
 * 枚举取值来源：docs/data-model.md（字段定义）与 docs/api.md（接口字段）。
 */

// el-tag type 可选值：primary / success / info / warning / danger（空串表示默认灰）
export const DICT = {
  // 房屋类型
  roomType: {
    RESIDENCE: { label: '住宅', tag: 'primary' },
    SHOP: { label: '商铺', tag: 'success' },
    OFFICE: { label: '办公', tag: 'warning' },
    PARKING: { label: '车位', tag: 'info' }
  },
  // 房屋状态
  roomStatus: {
    VACANT: { label: '空置', tag: 'info' },
    OCCUPIED: { label: '自住', tag: 'success' },
    RENTED: { label: '出租', tag: 'warning' }
  },
  // 住户类型
  residentType: {
    OWNER: { label: '业主', tag: 'primary' },
    TENANT: { label: '租户', tag: 'warning' },
    FAMILY: { label: '家属', tag: 'info' }
  },
  // 住户状态
  residentStatus: {
    LIVING: { label: '在住', tag: 'success' },
    MOVED_OUT: { label: '已迁出', tag: 'info' }
  },
  // 收费项目类型
  feeType: {
    PROPERTY: { label: '物业费', tag: 'primary' },
    WATER: { label: '水费', tag: 'success' },
    ELECTRIC: { label: '电费', tag: 'warning' },
    PARKING: { label: '车位费', tag: 'info' },
    OTHER: { label: '其他', tag: '' }
  },
  // 计费方式
  chargeMode: {
    AREA: { label: '按面积', tag: 'primary' },
    UNIT: { label: '按户', tag: 'success' },
    METER: { label: '按用量', tag: 'warning' },
    FIXED: { label: '固定金额', tag: 'info' }
  },
  // 收费周期
  period: {
    MONTHLY: { label: '月', tag: 'primary' },
    QUARTERLY: { label: '季', tag: 'success' },
    YEARLY: { label: '年', tag: 'warning' },
    ONCE: { label: '一次性', tag: 'info' }
  },
  // 收款方式
  paymentMethod: {
    CASH: { label: '现金', tag: 'primary' },
    WECHAT: { label: '微信', tag: 'success' },
    ALIPAY: { label: '支付宝', tag: 'primary' },
    BANK_TRANSFER: { label: '银行转账', tag: 'warning' },
    POS: { label: 'POS 刷卡', tag: 'info' },
    BANK_DEDUCT: { label: '银行代扣', tag: 'danger' },
    ONLINE: { label: '在线支付', tag: 'success' }
  },
  // 账单状态
  billStatus: {
    UNPAID: { label: '未缴', tag: 'danger' },
    PARTIAL: { label: '部分缴纳', tag: 'warning' },
    PAID: { label: '已缴清', tag: 'success' },
    VOID: { label: '已作废', tag: 'info' }
  },
  // 用户角色
  role: {
    ADMIN: { label: '管理员', tag: 'danger' },
    CASHIER: { label: '收费员', tag: 'warning' },
    VIEWER: { label: '只读', tag: 'info' }
  },
  // ===== 二期 =====
  // 资金账户类型
  accountType: {
    ADVANCE: { label: '预收', tag: 'success' },
    DEPOSIT: { label: '押金', tag: 'warning' }
  },
  // 资金流水方向
  flowDirection: {
    IN: { label: '转入', tag: 'success' },
    OUT: { label: '转出', tag: 'danger' }
  },
  // 资金流水业务类型
  fundBizType: {
    PAYMENT_ADVANCE: { label: '收款转预收', tag: 'success' },
    ADVANCE_USE: { label: '预收抵扣', tag: 'primary' },
    DEPOSIT_IN: { label: '收取押金', tag: 'success' },
    DEPOSIT_REFUND: { label: '退还押金', tag: 'danger' },
    ADVANCE_REFUND: { label: '退还预收', tag: 'danger' },
    IMPORT: { label: '历史导入', tag: 'info' }
  },
  // 银行签约状态
  bankContractStatus: {
    ACTIVE: { label: '正常', tag: 'success' },
    CANCELLED: { label: '已解约', tag: 'info' }
  },
  // 代扣批次状态
  bankBatchStatus: {
    GENERATED: { label: '已生成', tag: 'primary' },
    SENT: { label: '已报盘', tag: 'warning' },
    RETURNED: { label: '已回盘', tag: 'success' },
    CLOSED: { label: '已关闭', tag: 'info' }
  },
  // 回盘明细结果
  batchItemResult: {
    PENDING: { label: '待处理', tag: 'info' },
    SUCCESS: { label: '成功', tag: 'success' },
    FAIL: { label: '失败', tag: 'danger' }
  },
  // 通知通道
  noticeChannel: {
    SMS: { label: '短信', tag: 'primary' },
    EMAIL: { label: '邮件', tag: 'success' }
  },
  // 通知状态
  noticeStatus: {
    PENDING: { label: '待发送', tag: 'warning' },
    SENT: { label: '已发送', tag: 'success' },
    FAILED: { label: '发送失败', tag: 'danger' }
  },
  // 票据类型
  receiptType: {
    RECEIPT: { label: '收据', tag: 'primary' },
    INVOICE: { label: '发票', tag: 'warning' }
  },
  // 票据状态
  receiptStatus: {
    ISSUED: { label: '已开具', tag: 'success' },
    VOID: { label: '已作废', tag: 'info' }
  },
  // 审批类型
  approvalType: {
    BILL_DISCOUNT: { label: '减免', tag: 'primary' },
    ADVANCE_REFUND: { label: '预收退款', tag: 'warning' },
    DEPOSIT_REFUND: { label: '押金退还', tag: 'warning' }
  },
  // 审批状态
  approvalStatus: {
    PENDING: { label: '待审批', tag: 'warning' },
    APPROVED: { label: '已通过', tag: 'success' },
    REJECTED: { label: '已驳回', tag: 'danger' }
  },
  // 数据范围
  dataScope: {
    ALL: { label: '全部', tag: 'primary' },
    COMMUNITY: { label: '指定小区', tag: 'warning' }
  },
  // 数据导入类型
  importType: {
    rooms: { label: '房屋', tag: 'primary' },
    residents: { label: '住户', tag: 'success' },
    arrears: { label: '历史欠费', tag: 'warning' },
    advances: { label: '历史预收押金', tag: 'info' }
  }
}

const EMPTY = { label: '-', tag: 'info' }

/** 取枚举项的 label，未命中返回原值（便于排查后端新增枚举） */
export function dictLabel(key, value) {
  if (value === null || value === undefined || value === '') return '-'
  return DICT[key]?.[value]?.label ?? String(value)
}

/** 取枚举项的 el-tag type */
export function dictTag(key, value) {
  return DICT[key]?.[value]?.tag ?? EMPTY.tag
}

/** 生成 el-select 的 options：[{ label, value }] */
export function dictOptions(key) {
  const map = DICT[key] || {}
  return Object.keys(map).map((value) => ({ value, label: map[value].label }))
}

/** 生成「全部」下拉：用于搜索栏（空值表示不过滤） */
export function dictFilterOptions(key, allLabel = '全部') {
  return [{ value: '', label: allLabel }, ...dictOptions(key)]
}

/** 取字典颜色（用于自定义徽标） */
export function dictColor(key, value) {
  const map = {
    primary: '#409eff',
    success: '#67c23a',
    warning: '#e6a23c',
    danger: '#f56c6c',
    info: '#909399'
  }
  return map[dictTag(key, value)] || '#909399'
}
