// 工作台与报表路由
import { ok } from '../common/errors.js'
import { arrearsReport, collectionReport, dailyClose, dashboardSummary } from '../services/reports.js'

export async function registerReportRoutes(app) {
  const auth = app.authenticate

  app.get('/api/dashboard/summary', { preHandler: [auth] }, async (request) => ok(await dashboardSummary(request.query)))
  app.get('/api/reports/arrears', { preHandler: [auth] }, async (request) => ok(await arrearsReport(request.query)))
  app.get('/api/reports/collection', { preHandler: [auth] }, async (request) => ok(await collectionReport(request.query)))
  app.get('/api/reports/daily-close', { preHandler: [auth] }, async (request) => ok(await dailyClose(request.query)))
  app.get('/api/reports/dailyClose', { preHandler: [auth] }, async (request) => ok(await dailyClose(request.query)))
}

export default registerReportRoutes
