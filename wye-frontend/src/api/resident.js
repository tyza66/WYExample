import request from './request'

/**
 * 住户 /api/residents
 * 列表过滤参数：roomId、communityId、residentType、status、keyword（姓名/电话）
 * 响应中的 idCard 为后端脱敏值（110101********1234），前端直接展示。
 */

export function listResidents(params) {
  return request.get('/residents', { params })
}

export function getResident(id) {
  return request.get(`/residents/${id}`)
}

export function createResident(data) {
  return request.post('/residents', data)
}

export function updateResident(id, data) {
  return request.put(`/residents/${id}`, data)
}

export function deleteResident(id) {
  return request.delete(`/residents/${id}`)
}
