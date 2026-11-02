import request from './request'

/**
 * 操作日志 /api/logs（ADMIN）
 * 列表过滤参数：username、module、from、to
 */

export function listLogs(params) {
  return request.get('/logs', { params })
}
