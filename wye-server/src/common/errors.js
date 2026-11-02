// 统一响应信封与业务异常（契约见 docs/api.md §1）
export class BusinessException extends Error {
  constructor(message) {
    super(message)
    this.name = 'BusinessException'
    this.code = 1
  }
}

/** 业务失败：message 必须是能直接弹给收费员看的中文 */
export function bad(message) {
  throw new BusinessException(message)
}

export function ok(data = null, message = 'ok') {
  return { code: 0, message, data }
}

export function pageResult(list, total, page, size) {
  return { list, total, page, size }
}
