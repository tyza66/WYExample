import request from './request'

/**
 * 抄表 /api/meter-readings
 * 列表过滤参数：period、roomId、feeItemId、communityId
 */

export function listMeterReadings(params) {
  return request.get('/meter-readings', { params })
}

/**
 * POST /api/meter-readings —— 新增或覆盖同账期记录
 * req: { roomId, feeItemId, period, prevReading, currReading, readingDate, remark }
 * prevReading 不传则后端自动取该房该项目上一账期读数。
 */
export function createMeterReading(data) {
  return request.post('/meter-readings', data)
}
