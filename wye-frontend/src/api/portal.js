import request from './request'

/**
 * 业主端 H5（免登录，docs/api.md §4.9）
 * 门户 token 有效期 2 小时，只允许访问登录房屋；由 request 拦截器优先携带。
 */

export const PORTAL_TOKEN_KEY = 'wye_portal_token'

export function getPortalToken() {
  return localStorage.getItem(PORTAL_TOKEN_KEY) || ''
}

export function setPortalToken(token) {
  if (token) localStorage.setItem(PORTAL_TOKEN_KEY, token)
}

export function clearPortalAuth() {
  localStorage.removeItem(PORTAL_TOKEN_KEY)
  localStorage.removeItem('wye_portal_room')
}

export function readPortalRoom() {
  try {
    const raw = localStorage.getItem('wye_portal_room')
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export function savePortalRoom(room) {
  if (room) localStorage.setItem('wye_portal_room', JSON.stringify(room))
}

/** POST /api/portal/login —— { roomNo, phoneSuffix } -> { token, room, ownerName } */
export function portalLogin(data) {
  return request.post('/portal/login', data)
}

/** GET /api/portal/summary —— 欠费合计、待缴账单数、预收余额 */
export function portalSummary() {
  return request.get('/portal/summary')
}

/** GET /api/portal/bills —— 本房账单 */
export function portalBills(params) {
  return request.get('/portal/bills', { params })
}

/** GET /api/portal/payments —— 本房缴费记录 */
export function portalPayments(params) {
  return request.get('/portal/payments', { params })
}

/** POST /api/portal/orders —— { billIds } -> { orderNo, amount, payUrl } */
export function createPortalOrder(data) {
  return request.post('/portal/orders', data)
}

/** POST /api/portal/orders/{orderNo}/pay —— 模拟支付成功回调 */
export function payPortalOrder(orderNo) {
  return request.post(`/portal/orders/${orderNo}/pay`)
}
