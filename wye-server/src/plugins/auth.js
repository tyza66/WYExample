// 鉴权：@fastify/jwt 签发 token + 角色校验 preHandler
// 契约：未登录 HTTP 401 + code=401；角色不足 HTTP 403 + code=1
import jwt from '@fastify/jwt'
import { env } from '../config/env.js'

const unauthorized = { code: 401, message: '登录已失效，请重新登录', data: null }
const forbidden = { code: 1, message: '没有权限执行该操作', data: null }

export async function registerAuth(app) {
  await app.register(jwt, {
    secret: env.jwtSecret,
    sign: { expiresIn: '12h' }
  })

  app.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify()
    } catch {
      return reply.code(401).send(unauthorized)
    }
    return undefined
  })

  app.decorate('requireRole', function (...roles) {
    return async function (request, reply) {
      if (!request.user) return reply.code(401).send(unauthorized)
      if (roles.length && !roles.includes(request.user.role)) {
        return reply.code(403).send(forbidden)
      }
      return undefined
    }
  })

  app.decorate('currentUser', function (request) {
    const user = request.user || {}
    return { id: user.sub, username: user.username, role: user.role }
  })
}

export default registerAuth
