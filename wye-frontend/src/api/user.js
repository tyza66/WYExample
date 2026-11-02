import request from './request'

/**
 * 用户 /api/users（ADMIN）
 * 列表过滤参数：keyword、role、enabled
 */

export function listUsers(params) {
  return request.get('/users', { params })
}

export function createUser(data) {
  return request.post('/users', data)
}

/** 密码为空表示不修改 */
export function updateUser(id, data) {
  return request.put(`/users/${id}`, data)
}

/** POST /api/users/{id}/reset-password —— 重置为 123456 */
export function resetUserPassword(id) {
  return request.post(`/users/${id}/reset-password`)
}

/** DELETE /api/users/{id} —— 停用（软删除） */
export function disableUser(id) {
  return request.delete(`/users/${id}`)
}
