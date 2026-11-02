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
    BANK_DEDUCT: { label: '银行代扣', tag: 'danger' }
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
