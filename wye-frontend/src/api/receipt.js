import request from './request'

/**
 * 收据 / 发票（docs/api.md §4.6）
 */

/** GET /api/receipts —— 过滤：roomId、type、status、from、to、keyword */
export function listReceipts(params) {
  return request.get('/receipts', { params })
}

/** POST /api/receipts —— { paymentId, type: 'RECEIPT'|'INVOICE', title, taxNo?, amount?, remark? } */
export function createReceipt(data) {
  return request.post('/receipts', data)
}

/** POST /api/receipts/{id}/void —— { reason } */
export function voidReceipt(id, data) {
  return request.post(`/receipts/${id}/void`, data)
}

/**
 * GET /api/receipts/{id}/print —— 返回可打印 HTML，前端新窗口打开即打印。
 * 新窗口不带 Authorization 头，故演示/生产均由同源会话 Cookie 或公开打印页处理；
 * 需要鉴权时由后端按 token 放行打印页。
 */
export function receiptPrintPath(id) {
  return `/api/receipts/${id}/print`
}
