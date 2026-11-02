import request from './request'

/**
 * 资金账户 / 资金流水 / 审批（docs/api.md §4.2、§4.8）
 * 账户余额只能由流水推导，前端只读展示。
 */

// ---------- 资金账户 ----------
export function listAccounts(params) {
  return request.get('/accounts', { params })
}

/** GET /api/accounts/{roomId} —— 余额 + 该户最近 50 条资金流水 */
export function getAccount(roomId) {
  return request.get(`/accounts/${roomId}`)
}

/** POST /api/accounts/deposit —— { roomId, amount, method, paidAt?, remark } */
export function deposit(data) {
  return request.post('/accounts/deposit', data)
}

/** POST /api/accounts/advance/use —— { roomId, amount?, billIds?, remark } */
export function useAdvance(data) {
  return request.post('/accounts/advance/use', data)
}

/**
 * POST /api/accounts/refund —— { roomId, accountType, amount, method, remark, approvalNo }
 * accountType: ADVANCE | DEPOSIT；必须携带已通过的审批单 approvalNo
 */
export function refund(data) {
  return request.post('/accounts/refund', data)
}

/** GET /api/fund-flows —— 过滤：roomId、accountType、bizType、from、to、keyword */
export function listFundFlows(params) {
  return request.get('/fund-flows', { params })
}

// ---------- 审批 ----------
/** GET /api/approvals —— 过滤：status、type、roomId、keyword */
export function listApprovals(params) {
  return request.get('/approvals', { params })
}

/** POST /api/approvals —— { type, billId?, roomId?, amount, payload?, reason } */
export function createApproval(data) {
  return request.post('/approvals', data)
}

/** POST /api/approvals/{id}/approve —— { remark? } */
export function approveApproval(id, data) {
  return request.post(`/approvals/${id}/approve`, data)
}

/** POST /api/approvals/{id}/reject —— { remark } */
export function rejectApproval(id, data) {
  return request.post(`/approvals/${id}/reject`, data)
}
