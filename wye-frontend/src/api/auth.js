import request from './request'

/** POST /api/auth/login —— 公开 */
export function login(data) {
  return request.post('/auth/login', data)
}

/** GET /api/auth/profile —— 当前用户 */
export function getProfile() {
  return request.get('/auth/profile')
}

/** POST /api/auth/logout —— 销毁 token */
export function logout() {
  return request.post('/auth/logout')
}
