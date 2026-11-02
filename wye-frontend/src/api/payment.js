import request from './request'

/**
 * 收款 /api/payments
 * 列表过滤参数：period、communityId、roomId、method、keyword（收款单号/房号/住户）
 */

export function listPayments(params) {
  return request.get('/payments', { params })
}

/** GET /api/payments/{id} —— 含核销明细 */
export function getPayment(id) {
  return request.get(`/payments/${id}`)
}

/**
 * POST /api/payments —— 登记收款并自动核销
 * req: { roomId, amount, method, paidAt, billIds, remark }
 * res: { paymentId, paymentNo, amount, allocatedAmount, advanceAmount,
 *        allocations: [{ billId, billNo, period, amount }], roomArrearsAfter }
 */
export function createPayment(data) {
  return request.post('/payments', data)
}
