import request from './request'

/**
 * 楼栋 /api/buildings
 * 列表过滤参数：communityId、keyword
 */

export function listBuildings(params) {
  return request.get('/buildings', { params })
}

export function getBuilding(id) {
  return request.get(`/buildings/${id}`)
}

export function createBuilding(data) {
  return request.post('/buildings', data)
}

export function updateBuilding(id, data) {
  return request.put(`/buildings/${id}`, data)
}

export function deleteBuilding(id) {
  return request.delete(`/buildings/${id}`)
}

/** GET /api/buildings/options?communityId=1 -> [{ id, label }] */
export function buildingOptions(communityId) {
  return request.get('/buildings/options', { params: { communityId } })
}
