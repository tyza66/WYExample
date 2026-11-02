// 系统管理路由：用户与操作日志
import { z } from 'zod'
import dayjs from 'dayjs'
import bcrypt from 'bcryptjs'
import { prisma } from '../db/prisma.js'
import { bad, ok, pageResult } from '../common/errors.js'
import { parse } from '../common/validate.js'
import { pageParams } from '../common/utils.js'
import { ROLE } from '../common/constants.js'
import { logVO, userVO } from '../services/serialize.js'
import { recordLog } from '../services/log.js'

const DEFAULT_PASSWORD = '123456'
const enumOf = (dict, message) => z.string().refine((value) => Object.values(dict).includes(value), message)

export async function registerSystemRoutes(app) {
  const auth = app.authenticate
  const admin = app.requireRole('ADMIN')

  app.get('/api/users', { preHandler: [auth, admin] }, async (request) => {
    const { page, size, skip, take } = pageParams(request.query)
    const query = request.query
    const where = {
      ...(query.role ? { role: String(query.role) } : {}),
      ...(query.enabled === undefined || query.enabled === '' ? {} : { enabled: String(query.enabled) === 'true' }),
      ...(query.keyword
        ? {
            OR: [
              { username: { contains: String(query.keyword).trim() } },
              { realName: { contains: String(query.keyword).trim() } },
              { phone: { contains: String(query.keyword).trim() } }
            ]
          }
        : {})
    }
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, orderBy: { id: 'asc' }, skip, take })
    ])
    return ok(pageResult(rows.map(userVO), total, page, size))
  })

  app.post('/api/users', { preHandler: [auth, admin] }, async (request) => {
    const payload = parse(
      z.object({
        username: z.string().trim().min(3, '用户名至少 3 个字符').max(50),
        password: z.string().min(6, '密码至少 6 位'),
        realName: z.string().trim().min(1, '姓名不能为空').max(50),
        role: enumOf(ROLE, '角色不正确'),
        phone: z.string().trim().max(20).nullish(),
        remark: z.string().trim().max(255).nullish()
      }),
      request.body
    )
    const duplicated = await prisma.user.findUnique({ where: { username: payload.username } })
    if (duplicated) bad(`用户名 ${payload.username} 已存在`)

    const created = await prisma.user.create({
      data: {
        username: payload.username,
        password: bcrypt.hashSync(payload.password, 10),
        realName: payload.realName,
        role: payload.role,
        phone: payload.phone || null,
        remark: payload.remark || null
      }
    })
    await recordLog(request, { module: '用户', action: '新增', target: created.username, detail: `角色 ${created.role}` })
    return ok(userVO(created))
  })

  app.put('/api/users/:id', { preHandler: [auth, admin] }, async (request) => {
    const id = Number(request.params.id)
    const exists = await prisma.user.findUnique({ where: { id } })
    if (!exists) bad('用户不存在')

    const payload = parse(
      z.object({
        realName: z.string().trim().min(1, '姓名不能为空').max(50),
        role: enumOf(ROLE, '角色不正确'),
        phone: z.string().trim().max(20).nullish(),
        enabled: z.coerce.boolean().default(true),
        password: z.string().nullish(),
        remark: z.string().trim().max(255).nullish()
      }),
      request.body
    )

    const me = app.currentUser(request)
    if (me.id === id && payload.enabled === false) bad('不能停用当前登录账号')

    const data = {
      realName: payload.realName,
      role: payload.role,
      phone: payload.phone || null,
      enabled: payload.enabled,
      remark: payload.remark || null
    }
    if (payload.password) {
      if (payload.password.length < 6) bad('密码至少 6 位')
      data.password = bcrypt.hashSync(payload.password, 10)
    }

    const updated = await prisma.user.update({ where: { id }, data })
    await recordLog(request, { module: '用户', action: '修改', target: updated.username, detail: `角色 ${updated.role}，状态 ${updated.enabled ? '启用' : '停用'}` })
    return ok(userVO(updated))
  })

  app.post('/api/users/:id/reset-password', { preHandler: [auth, admin] }, async (request) => {
    const id = Number(request.params.id)
    const exists = await prisma.user.findUnique({ where: { id } })
    if (!exists) bad('用户不存在')
    await prisma.user.update({ where: { id }, data: { password: bcrypt.hashSync(DEFAULT_PASSWORD, 10) } })
    await recordLog(request, { module: '用户', action: '重置密码', target: exists.username })
    return ok(true)
  })

  // 软删除：停用而不是物理删除
  app.delete('/api/users/:id', { preHandler: [auth, admin] }, async (request) => {
    const id = Number(request.params.id)
    const exists = await prisma.user.findUnique({ where: { id } })
    if (!exists) bad('用户不存在')
    const me = app.currentUser(request)
    if (me.id === id) bad('不能停用当前登录账号')
    await prisma.user.update({ where: { id }, data: { enabled: false } })
    await recordLog(request, { module: '用户', action: '停用', target: exists.username })
    return ok(true)
  })

  app.get('/api/logs', { preHandler: [auth, admin] }, async (request) => {
    const { page, size, skip, take } = pageParams(request.query)
    const query = request.query
    const where = {
      ...(query.username ? { username: { contains: String(query.username).trim() } } : {}),
      ...(query.module ? { module: String(query.module) } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: dayjs(String(query.from)).startOf('day').toDate() } : {}),
              ...(query.to ? { lte: dayjs(String(query.to)).endOf('day').toDate() } : {})
            }
          }
        : {})
    }
    const [total, rows] = await Promise.all([
      prisma.operationLog.count({ where }),
      prisma.operationLog.findMany({ where, orderBy: { id: 'desc' }, skip, take })
    ])
    return ok(pageResult(rows.map(logVO), total, page, size))
  })
}

export default registerSystemRoutes
