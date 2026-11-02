// Fastify 应用组装：CORS + JWT + 业务路由 + 统一错误处理 + 前端静态托管
import fs from 'node:fs'
import path from 'node:path'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { env, serverRoot } from './config/env.js'
import { registerAuth } from './plugins/auth.js'
import { BusinessException } from './common/errors.js'
import { registerRoutes } from './routes/index.js'

/** 找到前端构建产物目录：一个进程同时提供 API 和页面，这是一站式启动的关键 */
export function findWebDist() {
  const candidates = [
    env.webDist,
    path.resolve(serverRoot, '../wye-frontend/dist'),
    path.resolve(serverRoot, '../web'),
    path.resolve(serverRoot, 'public')
  ].filter(Boolean)
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || null
}

export async function buildApp() {
  const app = Fastify({
    logger: { level: 'info', transport: undefined }
  })

  await app.register(cors, { origin: true, credentials: true })
  await registerAuth(app)

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof BusinessException) {
      return reply.code(200).send({ code: 1, message: error.message, data: null })
    }
    if (error.statusCode === 401) {
      return reply.code(401).send({ code: 401, message: '登录已失效，请重新登录', data: null })
    }
    if (error.validation) {
      return reply.code(200).send({ code: 1, message: '请求参数不正确', data: null })
    }
    if (error.code === 'P2002') {
      return reply.code(200).send({ code: 1, message: '数据重复，请检查唯一字段', data: null })
    }
    if (error.code === 'P2025') {
      return reply.code(200).send({ code: 1, message: '记录不存在或已被删除', data: null })
    }
    request.log.error({ err: error }, '未处理的服务端异常')
    return reply.code(500).send({ code: 500, message: '服务端异常，请稍后重试', data: null })
  })

  await registerRoutes(app)

  const webDist = findWebDist()
  if (webDist) {
    await app.register(fastifyStatic, { root: webDist })
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) {
        return reply.code(404).send({ code: 1, message: '接口不存在（404）', data: null })
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return reply.code(404).send({ code: 1, message: '资源不存在（404）', data: null })
      }
      // 单页应用回退
      return reply.sendFile('index.html')
    })
    app.log.info({ webDist }, '已启用前端静态托管')
  } else {
    app.setNotFoundHandler((request, reply) =>
      reply.code(404).send({ code: 1, message: '接口不存在（404）', data: null })
    )
  }

  return app
}

export default buildApp
