import dayjs from 'dayjs'

/**
 * 统一格式化工具。
 * 约定（docs/api.md §1.4）：日期 yyyy-MM-dd，时间 yyyy-MM-dd HH:mm:ss，账期 yyyy-MM。
 */

export const DATE_FORMAT = 'YYYY-MM-DD'
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
export const PERIOD_FORMAT = 'YYYY-MM'

/** 金额：两位小数 + 千分位；空值显示 0.00 */
export function formatAmount(value) {
  const num = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(num)) return '0.00'
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 金额（不带千分位） */
export function formatAmountPlain(value) {
  const num = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(num)) return '0.00'
  return num.toFixed(2)
}

/** 数量 / 面积 / 用量：最多两位小数（去掉无意义的尾随 0） */
export function formatNumber(value, digits = 2) {
  const num = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(num)) return '-'
  const fixed = num.toFixed(digits)
  if (!fixed.includes('.')) return fixed
  return fixed.replace(/0+$/, '').replace(/\.$/, '')
}

/** 单价：最多 4 位小数（data-model：unit_price decimal(12,4)） */
export function formatPrice(value) {
  const num = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(num)) return '-'
  return String(Number(num.toFixed(4)))
}

/** 比例：0.7231 -> 72.31% */
export function formatRate(value) {
  const num = Number(value)
  if (value === null || value === undefined || value === '' || Number.isNaN(num)) return '0.00%'
  return `${(num * 100).toFixed(2)}%`
}

/** 日期 */
export function formatDate(value, format = DATE_FORMAT) {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format(format) : String(value)
}

/** 日期时间 */
export function formatDateTime(value, format = DATETIME_FORMAT) {
  if (!value) return '-'
  const d = dayjs(value)
  return d.isValid() ? d.format(format) : String(value)
}

/** 账期 yyyy-MM */
export function formatPeriod(value) {
  if (!value) return '-'
  const d = dayjs(value, 'YYYY-MM')
  return d.isValid() ? d.format(PERIOD_FORMAT) : String(value)
}

/** 当前账期 */
export function currentPeriod() {
  return dayjs().format(PERIOD_FORMAT)
}

/** 当前日期 */
export function today() {
  return dayjs().format(DATE_FORMAT)
}

/** 当前时间 */
export function now() {
  return dayjs().format(DATETIME_FORMAT)
}

/** 账期加减月数 */
export function shiftPeriod(period, months) {
  return dayjs(period, 'YYYY-MM').add(months, 'month').format(PERIOD_FORMAT)
}

/** 某月第一天 / 最后一天 */
export function periodStart(period) {
  return dayjs(period, 'YYYY-MM').startOf('month').format(DATE_FORMAT)
}

export function periodEnd(period) {
  return dayjs(period, 'YYYY-MM').endOf('month').format(DATE_FORMAT)
}

/** el-date-picker 常用快捷选项：本月 / 上月 / 近三个月 */
export const monthShortcuts = [
  {
    text: '本月',
    value: () => dayjs().startOf('month').toDate()
  },
  {
    text: '上月',
    value: () => dayjs().subtract(1, 'month').startOf('month').toDate()
  },
  {
    text: '近三个月',
    value: () => dayjs().subtract(2, 'month').startOf('month').toDate()
  }
]

export { dayjs }
