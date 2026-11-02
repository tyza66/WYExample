// 入参校验：zod schema 的错误直接转成可展示的中文提示
import { bad } from './errors.js'

export function parse(schema, payload) {
  const result = schema.safeParse(payload ?? {})
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue.path.join('.')
    bad(field ? `${field}：${issue.message}` : issue.message)
  }
  return result.data
}

/** 可选日期：空串视为 null */
export function optionalDate() {
  return (value) => (value === '' ? null : value)
}
