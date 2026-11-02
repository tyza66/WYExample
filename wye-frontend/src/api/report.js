import request from './request'

/**
 * 报表
 */

/** GET /api/reports/arrears —— 过滤：communityId、period、feeItemId、page、size */
export function getArrearsReport(params) {
  return request.get('/reports/arrears', { params })
}

/** GET /api/reports/collection —— 过滤：from、to、communityId、groupBy=day|month|method|feeItem */
export function getCollectionReport(params) {
  return request.get('/reports/collection', { params })
}

/** GET /api/reports/daily-close?date=yyyy-MM-dd */
export function getDailyClose(params) {
  return request.get('/reports/daily-close', { params })
}
