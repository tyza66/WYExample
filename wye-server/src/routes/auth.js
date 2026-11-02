// 认证路由：登录 / 当前用户 / 退出
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { prisma } from '../db/prisma.js'
import { bad, ok } from '../common/errors.js'
import { parse } from '../common/validate.js'
import { userVO } from '../services/serialize.js'
import { recordLog } from '../services/log.js'

export async function registerAuthRoutes(app) {
  app.post('/api/auth/login', async (request) => {
    const payload = parse(
      z.object({
        username: z.string().trim().min(1, '请输入用户名'),
        password: z.string().min(1, '请输入密码')
      }),
      request.body
    )

    const user = await prisma.user.findUnique({ where: { username: payload.username } })
    if (!user) bad('用户名或密码错误')
    if (!bcrypt.compareSync(payload.password, user.password)) bad('用户名或密码错误')
    if (!user.enabled) bad('账号已停用，请联系管理员')

    const token = app.jwt.sign({ sub: user.id, username: user.username, role: user.role }, { expiresIn: '12h' })
    await recordLog({ ...request, user: { username: user.username } }, { module: '认证', action: '登录', target: user.username })

    return ok({ token, user: { id: user.id, username: user.username, realName: user.realName, role: user.role } })
  })

  app.get('/api/auth/profile', { preHandler: [app.authenticate] }, async (request) => {
    const user = await prisma.user.findUnique({ where: { id: Number(request.user.sub) } })
    if (!user) bad('账号不存在')
    return ok(userVO(user))
  })

  // 采用无状态 JWT，退出由前端清除本地 token 即可
  app.post('/api/auth/logout', { preHandler: [app.authenticate] }, async () => ok(true))
}

export default registerAuthRoutes
