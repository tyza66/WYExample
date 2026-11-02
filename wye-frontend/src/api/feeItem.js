import request from './request'

/**
 * 收费项目 /api/fee-items
 * 列表过滤参数：type、chargeMode、enabled、keyword
 */

export function listFeeItems(params) {
  return request.get('/fee-items', { params })
}

export function getFeeItem(id) {
  return request.get(`/fee-items/${id}`)
}

export function createFeeItem(data) {
  return request.post('/fee-items', data)
}

export function updateFeeItem(id, data) {
  return request.put(`/fee-items/${id}`, data)
}

export function deleteFeeItem(id) {
  return request.delete(`/fee-items/${id}`)
}

/** GET /api/fee-items/options?enabled=true -> [{ id, label }] */
export function feeItemOptions(enabled = true) {
  return request.get('/fee-items/options', { params: { enabled } })
}
