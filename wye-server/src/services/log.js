// 操作日志：所有写操作都记一笔（契约见 docs/data-model.md §3.6）
import { prisma } from '../db/prisma.js'

export async function recordLog(request, { module, action, target, detail }) {
  try {
    const user = request?.user || {}
    await prisma.operationLog.create({
      data: {
        username: user.username || 'anonymous',
        module,
        action,
        target: target ? String(target).slice(0, 100) : null,
        detail: detail ? String(detail).slice(0, 1000) : null,
        ip: request?.ip || request?.headers?.['x-forwarded-for'] || null
      }
    })
  } catch (error) {
    // 日志失败不能影响主流程
    request?.log?.warn?.({ err: error }, '写入操作日志失败')
  }
}

export default recordLog
