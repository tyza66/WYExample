import request from './request'

/**
 * 房屋 /api/rooms
 * 列表过滤参数：communityId、buildingId、roomType、status、keyword（房号/住户名）
 */

export function listRooms(params) {
  return request.get('/rooms', { params })
}

export function getRoom(id) {
  return request.get(`/rooms/${id}`)
}

export function createRoom(data) {
  return request.post('/rooms', data)
}

export function updateRoom(id, data) {
  return request.put(`/rooms/${id}`, data)
}

export function deleteRoom(id) {
  return request.delete(`/rooms/${id}`)
}

/**
 * GET /api/rooms/options?communityId=1&keyword=1-1
 * -> [{ id, label, extra: { area, roomType } }]
 */
export function roomOptions(params) {
  return request.get('/rooms/options', { params })
}
