import request from './request'

/**
 * 小区 /api/communities
 * 列表过滤参数：keyword
 */

export function listCommunities(params) {
  return request.get('/communities', { params })
}

export function getCommunity(id) {
  return request.get(`/communities/${id}`)
}

export function createCommunity(data) {
  return request.post('/communities', data)
}

export function updateCommunity(id, data) {
  return request.put(`/communities/${id}`, data)
}

export function deleteCommunity(id) {
  return request.delete(`/communities/${id}`)
}

/** GET /api/communities/options -> [{ id, label }] */
export function communityOptions() {
  return request.get('/communities/options')
}
