import request from './request'

/**
 * 数据导入导出（docs/api.md §4.7）
 * 导入 type ∈ rooms / residents / arrears / advances
 * 导出 type ∈ rooms / residents / bills / arrears / payments / fund-flows
 */

/**
 * POST /api/import/{type} —— { fileName?, content }
 * res: { total, success, failed, errors: [{ line, message }] }
 */
export function importData(type, data) {
  return request.post(`/import/${type}`, data)
}

/** GET /api/import-logs —— 导入记录 */
export function listImportLogs(params) {
  return request.get('/import-logs', { params })
}

/** 导出接口路径（由 utils/export.js 的 exportBackend 统一下载） */
export function exportPath(type) {
  return `/export/${type}`
}

/** 各导入类型的 CSV 表头（与 docs/api.md §4.7 一致） */
export const IMPORT_COLUMNS = {
  rooms: ['小区编码', '楼栋', '单元', '房号', '楼层', '面积', '房屋类型', '使用状态'],
  residents: ['小区编码', '房号', '姓名', '电话', '证件号', '住户类型', '入住日期'],
  arrears: ['小区编码', '房号', '收费项目编码', '账期', '金额', '应缴日'],
  advances: ['小区编码', '房号', '类型', '金额', '备注']
}

export const IMPORT_TYPE_LABELS = {
  rooms: '房屋',
  residents: '住户',
  arrears: '历史欠费',
  advances: '历史预收押金'
}

export const EXPORT_TYPE_LABELS = {
  rooms: '房屋',
  residents: '住户',
  bills: '账单',
  arrears: '欠费',
  payments: '收款',
  'fund-flows': '资金流水'
}
