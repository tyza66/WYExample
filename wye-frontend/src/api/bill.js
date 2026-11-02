import request from './request'

/**
 * 账单 /api/bills
 * 列表过滤参数：period、communityId、buildingId、roomId、feeItemId、status、keyword（房号/住户/账单号）
 */

export function listBills(params) {
  return request.get('/bills', { params })
}

export function getBill(id) {
  return request.get(`/bills/${id}`)
}

/**
 * POST /api/bills/generate
 * req: { period, communityId, buildingId, feeItemIds, overwrite }
 * res: { generated, skipped, totalAmount, skipReasons: [{ roomNo, feeItem, reason }] }
 */
export function generateBills(data) {
  return request.post('/bills/generate', data)
}

/** PUT /api/bills/{id} —— 调整减免/应缴日/备注：{ discount, dueDate, remark } */
export function updateBill(id, data) {
  return request.put(`/bills/${id}`, data)
}

/** POST /api/bills/{id}/void —— { reason } */
export function voidBill(id, data) {
  return request.post(`/bills/${id}/void`, data)
}

/**
 * POST /api/bills/late-fee —— 计提滞纳金（二期，docs/api.md §4.3）
 * req: { period, communityId?, buildingId?, feeItemIds? }
 * res: { updated, totalLateFee, skipped }
 */
export function chargeLateFee(data) {
  return request.post('/bills/late-fee', data)
}
