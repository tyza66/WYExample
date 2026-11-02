import request from './request'

/**
 * 催缴通知（docs/api.md §4.5）
 */

// ---------- 模板 ----------
export function listNoticeTemplates(params) {
  return request.get('/notice-templates', { params })
}

export function createNoticeTemplate(data) {
  return request.post('/notice-templates', data)
}

export function updateNoticeTemplate(id, data) {
  return request.put(`/notice-templates/${id}`, data)
}

export function deleteNoticeTemplate(id) {
  return request.delete(`/notice-templates/${id}`)
}

// ---------- 发送记录 ----------
/** GET /api/notices —— 过滤：channel、status、roomId、from、to、keyword */
export function listNotices(params) {
  return request.get('/notices', { params })
}

/**
 * POST /api/notices/send —— { channel, templateId, billIds?, roomIds?, period?, dryRun? }
 * dryRun=true 只返回渲染后的内容不发送。
 * res: { sentCount, failedCount, notices[] }
 */
export function sendNotices(data) {
  return request.post('/notices/send', data)
}
