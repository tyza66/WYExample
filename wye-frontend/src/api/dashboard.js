import request from './request'

/**
 * 工作台 /api/dashboard/summary?period=yyyy-MM&communityId=
 * res: { period, communityCount, buildingCount, roomCount, residentCount,
 *        receivable, received, arrears, collectionRate, unpaidRoomCount, advanceTotal,
 *        trend: [{ period, receivable, received }],
 *        topArrears: [{ roomId, roomNo, ownerName, amount }] }
 */
export function getDashboardSummary(params) {
  return request.get('/dashboard/summary', { params })
}
