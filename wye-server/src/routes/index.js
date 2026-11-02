// 路由注册入口
import { registerAuthRoutes } from './auth.js'
import { registerBasicRoutes } from './basic.js'
import { registerBillingRoutes } from './billing.js'
import { registerReportRoutes } from './reports.js'
import { registerSystemRoutes } from './system.js'
import { registerPhase2Routes } from './phase2.js'

export async function registerRoutes(app) {
  app.get('/api/health', async () => ({
    code: 0,
    message: 'ok',
    data: { status: 'ok', version: '1.0.0', db: 'up' }
  }))

  await registerAuthRoutes(app)
  await registerBasicRoutes(app)
  await registerBillingRoutes(app)
  await registerReportRoutes(app)
  await registerSystemRoutes(app)
  await registerPhase2Routes(app)
}

export default registerRoutes
