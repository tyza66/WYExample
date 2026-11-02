// 金额工具：所有金额运算都走 Decimal，禁止用 JS 浮点直接加减乘
import { Decimal } from '../db/prisma.js'

export { Decimal }

/** 任意值 -> Decimal（空值视为 0） */
export function D(value) {
  if (value === null || value === undefined || value === '') return new Decimal(0)
  return new Decimal(value)
}

/** Decimal -> API 返回的元（保留 2 位小数的 number） */
export function yuan(value) {
  return Number(D(value).toDecimalPlaces(2).toString())
}

/** 累加，picker 取出要累加的字段 */
export function sumBy(list, picker = (item) => item) {
  return (list || []).reduce((acc, item, index) => acc.plus(D(picker(item, index))), new Decimal(0))
}

/** 数量 × 单价，HALF_UP 保留 2 位 */
export function multiply(quantity, unitPrice) {
  return D(quantity).times(D(unitPrice)).toDecimalPlaces(2)
}

/** 比率（实收 / 应收），应收为 0 视为 100% */
export function rateOf(received, receivable) {
  const top = D(received)
  const bottom = D(receivable)
  if (bottom.isZero()) return 1
  return Number(top.div(bottom).toDecimalPlaces(4).toString())
}

/** 单调不减，避免 reduce 中出现负零 */
export function zero() {
  return new Decimal(0)
}
