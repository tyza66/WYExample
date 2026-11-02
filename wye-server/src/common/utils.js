// 通用小工具：脱敏、日期、分页参数
import dayjs from 'dayjs'

/** 证件号脱敏：保留前 6 后 4 */
export function maskIdCard(value) {
  if (!value) return value
  const text = String(value)
  if (text.length <= 10) return text.replace(/.(?=.{2})/g, '*')
  return `${text.slice(0, 6)}${'*'.repeat(Math.max(4, text.length - 10))}${text.slice(-4)}`
}

/** 手机号脱敏：138****0001 */
export function maskPhone(value) {
  if (!value) return value
  const text = String(value)
  if (text.length < 7) return text
  return `${text.slice(0, 3)}****${text.slice(-4)}`
}

export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const parsed = dayjs(String(value))
  return parsed.isValid() ? parsed.toDate() : null
}

export function dateStr(value) {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null
}

export function dateTimeStr(value) {
  if (!value) return null
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : null
}

export function now() {
  return new Date()
}

/** 当期账期 yyyy-MM */
export function currentPeriod() {
  return dayjs().format('YYYY-MM')
}

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export function assertPeriod(period) {
  return PERIOD_RE.test(String(period || ''))
}

/** 账期偏移，用于"上一账期读数" */
export function shiftPeriod(period, months) {
  return dayjs(`${period}-01`).add(months, 'month').format('YYYY-MM')
}

/** 账期对应的一组月份（按季/按年生成时用） */
export function periodMonths(period, feePeriod) {
  const start = dayjs(`${period}-01`)
  if (feePeriod === 'QUARTERLY') return [period]
  if (feePeriod === 'YEARLY') return [String(period).slice(0, 4)]
  return [start.format('YYYY-MM')]
}

/** 分页参数规范化：page 从 1 开始，size 上限 100 */
export function pageParams(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const rawSize = Number.parseInt(query.size, 10) || 10
  const size = Math.min(100, Math.max(1, rawSize))
  return { page, size, skip: (page - 1) * size, take: size }
}

/** 把 yyyy-MM 账期的应缴日定为下月 10 号 */
export function defaultDueDate(period) {
  return dayjs(`${period}-01`).add(1, 'month').date(10).format('YYYY-MM-DD')
}

export function todayOf(period) {
  return dayjs(`${period}-01`).endOf('month').format('YYYY-MM-DD')
}
