import request from './request'

/**
 * 银行代扣（docs/api.md §4.4）
 * 只保存账号掩码（accountNoMasked），前端禁止收集完整卡号。
 */

// ---------- 签约 ----------
export function listBankContracts(params) {
  return request.get('/bank-contracts', { params })
}

/** POST /api/bank-contracts —— { roomId, bankName, accountName, accountNoMasked, contractNo, signedAt?, remark } */
export function createBankContract(data) {
  return request.post('/bank-contracts', data)
}

export function updateBankContract(id, data) {
  return request.put(`/bank-contracts/${id}`, data)
}

/** DELETE /api/bank-contracts/{id} —— 解约（置 CANCELLED） */
export function cancelBankContract(id) {
  return request.delete(`/bank-contracts/${id}`)
}

// ---------- 批次 ----------
export function listBankBatches(params) {
  return request.get('/bank-batches', { params })
}

/** POST /api/bank-batches/generate —— { period, communityId?, buildingId?, feeItemIds? } */
export function generateBankBatch(data) {
  return request.post('/bank-batches/generate', data)
}

/** GET /api/bank-batches/{id} —— 含明细 */
export function getBankBatch(id) {
  return request.get(`/bank-batches/${id}`)
}

/** 报盘文件下载地址（format: csv | txt），由 export.js 统一下载 */
export function bankBatchExportPath(id, format = 'csv') {
  return { url: `/bank-batches/${id}/export`, params: { format } }
}

/** POST /api/bank-batches/{id}/return —— { fileName?, content } */
export function returnBankBatch(id, data) {
  return request.post(`/bank-batches/${id}/return`, data)
}

/** POST /api/bank-batches/{id}/close */
export function closeBankBatch(id) {
  return request.post(`/bank-batches/${id}/close`)
}
