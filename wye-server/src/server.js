// 服务入口：建表 -> 演示数据 -> 监听
import { buildApp } from './app.js'
import { env } from './config/env.js'
import { bootstrap } from './db/bootstrap.js'
import { prisma } from './db/prisma.js'

const app = await buildApp()

try {
  await bootstrap(app.log)
} catch (error) {
  app.log.error({ err: error }, '启动初始化失败')
  process.exit(1)
}

if (env.usingDefaultSecret) {
  app.log.warn('当前使用默认 JWT 密钥，生产环境请设置 WYE_JWT_SECRET')
}

await app.listen({ port: env.port, host: env.host })
app.log.info(`WYE 已启动：http://localhost:${env.port}`)

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    app.log.info(`收到 ${signal}，正在关闭…`)
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  })
}
