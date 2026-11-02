import request from '@/api/request'

/**
 * 前端 CSV 导出工具。
 * 注意：必须写入 UTF-8 BOM（\uFEFF），否则 Excel 打开中文会乱码。
 */

/** 转义单个 CSV 单元格 */
function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/**
 * 把二维数组（第一行为表头）拼成 CSV 文本
 * @param {string[]} headers 表头
 * @param {Array<Array<any>>} rows 数据行
 */
export function buildCsv(headers, rows) {
  const lines = []
  lines.push(headers.map(escapeCell).join(','))
  rows.forEach((row) => lines.push(row.map(escapeCell).join(',')))
  return lines.join('\r\n')
}

/**
 * 触发浏览器下载
 * @param {string} filename 文件名（不含扩展名）
 * @param {string} csvText CSV 文本（不含 BOM）
 */
export function downloadCsv(filename, csvText) {
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.style.display = 'none'
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 一步导出：表头 + 数据行 -> 下载 CSV
 * @param {string} filename
 * @param {string[]} headers
 * @param {Array<Array<any>>} rows
 * @param {Array<function>} [formatters] 每列可选的格式化函数
 */
export function exportCsv(filename, headers, rows, formatters = []) {
  const data = rows.map((row) =>
    row.map((cell, index) => (typeof formatters[index] === 'function' ? formatters[index](cell) : cell))
  )
  downloadCsv(filename, buildCsv(headers, data))
}

/** 带账期/时间戳的文件名，避免重复覆盖 */
export function exportFileName(prefix, suffix = '') {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`
  return suffix ? `${prefix}_${suffix}_${stamp}` : `${prefix}_${stamp}`
}

/**
 * 下载后端生成的 CSV（docs/api.md §4.7）。
 * 后端返回 UTF-8 带 BOM 的文本；演示模式下 mock 同样返回 CSV 文本，
 * 走统一 axios 实例后两种模式行为一致。
 * @param {string} path 以 / 开头的接口路径，如 /export/bills
 * @param {object} [params] 查询参数（筛选条件）
 * @param {string} [filename] 下载文件名（不含扩展名）
 */
export async function downloadBackendCsv(path, params = {}, filename = 'export') {
  const text = await request.get(path, {
    params,
    responseType: 'text',
    transformResponse: [(data) => data]
  })
  const csv = String(text ?? '').replace(/^\uFEFF/, '')
  downloadCsv(filename, csv)
  return csv
}

/**
 * 导出接口的便捷封装：type ∈ rooms/residents/bills/arrears/payments/fund-flows
 * @param {string} type
 * @param {object} [params] 筛选条件
 * @param {string} [prefix] 文件名前缀（默认取类型名）
 */
export function exportBackend(type, params = {}, prefix) {
  return downloadBackendCsv(`/export/${type}`, params, exportFileName(prefix || type))
}
