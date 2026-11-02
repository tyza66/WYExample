// 通用 CRUD 路由工厂：基础资料五张表共用一套分页/校验/日志/引用校验逻辑
import { prisma } from '../db/prisma.js'
import { bad, ok, pageResult } from '../common/errors.js'
import { parse } from '../common/validate.js'
import { pageParams } from '../common/utils.js'
import { recordLog } from './log.js'

/**
 * @param {import('fastify').FastifyInstance} app
 * @param {object} config
 */
export function crudRoutes(app, config) {
  const {
    path,
    model,
    label,
    include,
    searchFields = [],
    buildWhere,
    createSchema,
    updateSchema,
    toVO = (row) => row,
    beforeCreate,
    beforeUpdate,
    beforeDelete,
    orderBy = [{ id: 'desc' }],
    writeRoles = ['ADMIN']
  } = config

  const delegate = () => prisma[model]
  const auth = app.authenticate
  const requireWrite = app.requireRole(...writeRoles)

  function queryWhere(query) {
    const base = buildWhere ? buildWhere(query) : {}
    const keyword = query.keyword ? String(query.keyword).trim() : ''
    if (!keyword || !searchFields.length) return base
    const OR = searchFields.map((field) => ({ [field]: { contains: keyword } }))
    return Object.keys(base).length ? { AND: [base, { OR }] } : { OR }
  }

  // 列表
  app.get(`/api/${path}`, { preHandler: [auth] }, async (request) => {
    const { page, size, skip, take } = pageParams(request.query)
    const where = queryWhere(request.query)
    const [total, rows] = await Promise.all([
      delegate().count({ where }),
      delegate().findMany({ where, include, orderBy, skip, take })
    ])
    return ok(pageResult(rows.map(toVO), total, page, size))
  })

  // 详情
  app.get(`/api/${path}/:id`, { preHandler: [auth] }, async (request) => {
    const row = await delegate().findUnique({ where: { id: Number(request.params.id) }, include })
    if (!row) bad(`${label}不存在`)
    return ok(toVO(row))
  })

  // 新增
  app.post(`/api/${path}`, { preHandler: [auth, requireWrite] }, async (request) => {
    const payload = parse(createSchema, request.body)
    const data = beforeCreate ? await beforeCreate(payload) : payload
    const created = await delegate().create({ data, include })
    await recordLog(request, { module: label, action: '新增', target: created.id, detail: JSON.stringify(payload) })
    return ok(toVO(created))
  })

  // 修改
  app.put(`/api/${path}/:id`, { preHandler: [auth, requireWrite] }, async (request) => {
    const id = Number(request.params.id)
    const exists = await delegate().findUnique({ where: { id } })
    if (!exists) bad(`${label}不存在`)
    const payload = parse(updateSchema, request.body)
    const data = beforeUpdate ? await beforeUpdate(payload, exists) : payload
    const updated = await delegate().update({ where: { id }, data, include })
    await recordLog(request, { module: label, action: '修改', target: id, detail: JSON.stringify(payload) })
    return ok(toVO(updated))
  })

  // 删除
  app.delete(`/api/${path}/:id`, { preHandler: [auth, requireWrite] }, async (request) => {
    const id = Number(request.params.id)
    const exists = await delegate().findUnique({ where: { id } })
    if (!exists) bad(`${label}不存在`)
    if (beforeDelete) await beforeDelete(id, exists)
    await delegate().delete({ where: { id } })
    await recordLog(request, { module: label, action: '删除', target: id, detail: exists.name || String(id) })
    return ok(true)
  })
}

export default crudRoutes
