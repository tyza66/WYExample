import request from './request'

/**
 * 账套 /api/ledgers（docs/api.md §4.1）
 * 列表/报表接口均支持可选 ledgerId 过滤（由 request 拦截器统一附加）。
 */

export function listLedgers(params) {
  return request.get('/ledgers', { params })
}

/** GET /api/ledgers/options -> [{ id, label }] */
export function ledgerOptions() {
  return request.get('/ledgers/options')
}

export function createLedger(data) {
  return request.post('/ledgers', data)
}

export function updateLedger(id, data) {
  return request.put(`/ledgers/${id}`, data)
}

/** DELETE /api/ledgers/{id} —— 有小区归属时后端禁止删除 */
export function deleteLedger(id) {
  return request.delete(`/ledgers/${id}`)
}
