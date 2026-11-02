// 基础资料路由：小区 / 楼栋 / 房屋 / 住户 / 收费项目
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { bad, ok } from '../common/errors.js'
import { yuan } from '../common/money.js'
import { toDate } from '../common/utils.js'
import {
  CHARGE_MODE,
  FEE_PERIOD,
  FEE_TYPE,
  RESIDENT_STATUS,
  RESIDENT_TYPE,
  ROOM_STATUS,
  ROOM_TYPE
} from '../common/constants.js'
import { crudRoutes } from '../services/crud.js'
import { buildingVO, communityVO, feeItemVO, optionVO, residentVO, roomVO } from '../services/serialize.js'

const enumOf = (dict, message) => z.string().refine((value) => Object.values(dict).includes(value), message)

export async function registerBasicRoutes(app) {
  // ---------- 小区 ----------
  crudRoutes(app, {
    path: 'communities',
    model: 'community',
    label: '小区',
    include: { _count: { select: { buildings: true, rooms: true } } },
    searchFields: ['name', 'code', 'address', 'manager'],
    orderBy: [{ id: 'asc' }],
    toVO: communityVO,
    createSchema: z.object({
      name: z.string().trim().min(1, '小区名称不能为空').max(100),
      code: z.string().trim().min(1, '小区编码不能为空').max(50),
      address: z.string().trim().max(255).nullish(),
      manager: z.string().trim().max(50).nullish(),
      phone: z.string().trim().max(20).nullish(),
      remark: z.string().trim().max(255).nullish()
    }),
    updateSchema: z.object({
      name: z.string().trim().min(1, '小区名称不能为空').max(100),
      code: z.string().trim().min(1, '小区编码不能为空').max(50),
      address: z.string().trim().max(255).nullish(),
      manager: z.string().trim().max(50).nullish(),
      phone: z.string().trim().max(20).nullish(),
      remark: z.string().trim().max(255).nullish()
    }),
    beforeDelete: async (id) => {
      const [buildings, rooms] = await Promise.all([
        prisma.building.count({ where: { communityId: id } }),
        prisma.room.count({ where: { communityId: id } })
      ])
      if (buildings > 0 || rooms > 0) bad('该小区下仍有楼栋或房屋，无法删除')
    }
  })

  // ---------- 楼栋 ----------
  crudRoutes(app, {
    path: 'buildings',
    model: 'building',
    label: '楼栋',
    include: { community: true, _count: { select: { rooms: true } } },
    searchFields: ['name'],
    buildWhere: (query) => (query.communityId ? { communityId: Number(query.communityId) } : {}),
    orderBy: [{ communityId: 'asc' }, { id: 'asc' }],
    toVO: buildingVO,
    createSchema: z.object({
      communityId: z.coerce.number().int().positive('请选择所属小区'),
      name: z.string().trim().min(1, '楼栋名称不能为空').max(50),
      unitCount: z.coerce.number().int().min(1, '单元数至少为 1').default(1),
      remark: z.string().trim().max(255).nullish()
    }),
    updateSchema: z.object({
      communityId: z.coerce.number().int().positive('请选择所属小区'),
      name: z.string().trim().min(1, '楼栋名称不能为空').max(50),
      unitCount: z.coerce.number().int().min(1, '单元数至少为 1').default(1),
      remark: z.string().trim().max(255).nullish()
    }),
    beforeDelete: async (id) => {
      const rooms = await prisma.room.count({ where: { buildingId: id } })
      if (rooms > 0) bad('该楼栋下仍有房屋，无法删除')
    }
  })

  // ---------- 房屋 ----------
  const roomSchema = z.object({
    communityId: z.coerce.number().int().positive('请选择所属小区'),
    buildingId: z.coerce.number().int().positive('请选择所属楼栋'),
    unit: z.string().trim().max(20).nullish(),
    roomNo: z.string().trim().min(1, '房号不能为空').max(50),
    floor: z.coerce.number().int().nullish(),
    area: z.coerce.number().nonnegative('面积不能为负数').nullish(),
    roomType: enumOf(ROOM_TYPE, '房屋类型不正确'),
    status: enumOf(ROOM_STATUS, '使用状态不正确'),
    remark: z.string().trim().max(255).nullish()
  })

  async function assertRoomUnique(payload, excludeId) {
    const building = await prisma.building.findUnique({ where: { id: payload.buildingId } })
    if (!building) bad('楼栋不存在')
    if (building.communityId !== payload.communityId) bad('楼栋不属于所选小区')
    const duplicated = await prisma.room.findFirst({
      where: { communityId: payload.communityId, roomNo: payload.roomNo, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (duplicated) bad(`房号 ${payload.roomNo} 已存在`)
    return payload
  }

  crudRoutes(app, {
    path: 'rooms',
    model: 'room',
    label: '房屋',
    include: {
      community: true,
      building: true,
      _count: { select: { residents: { where: { status: 'LIVING' } } } }
    },
    searchFields: ['roomNo'],
    buildWhere: (query) => {
      const where = {}
      if (query.communityId) where.communityId = Number(query.communityId)
      if (query.buildingId) where.buildingId = Number(query.buildingId)
      if (query.roomType) where.roomType = String(query.roomType)
      if (query.status) where.status = String(query.status)
      return where
    },
    orderBy: [{ communityId: 'asc' }, { buildingId: 'asc' }, { roomNo: 'asc' }],
    toVO: roomVO,
    createSchema: roomSchema,
    updateSchema: roomSchema,
    beforeCreate: (payload) => assertRoomUnique(payload),
    beforeUpdate: (payload, exists) => assertRoomUnique(payload, exists.id),
    beforeDelete: async (id) => {
      const [living, bills] = await Promise.all([
        prisma.resident.count({ where: { roomId: id, status: 'LIVING' } }),
        prisma.bill.count({ where: { roomId: id, status: { not: 'VOID' } } })
      ])
      if (living > 0) bad('该房屋下仍有在住住户，无法删除')
      if (bills > 0) bad('该房屋已有账单记录，无法删除')
    }
  })

  // ---------- 住户 ----------
  const residentSchema = z.object({
    roomId: z.coerce.number().int().positive('请选择所属房屋'),
    name: z.string().trim().min(1, '住户姓名不能为空').max(50),
    phone: z.string().trim().max(20).nullish(),
    idCard: z.string().trim().max(50).nullish(),
    residentType: enumOf(RESIDENT_TYPE, '住户类型不正确'),
    startDate: z.string().trim().nullish(),
    endDate: z.string().trim().nullish(),
    status: enumOf(RESIDENT_STATUS, '居住状态不正确'),
    remark: z.string().trim().max(255).nullish()
  })

  function residentData(payload) {
    return {
      roomId: payload.roomId,
      name: payload.name,
      phone: payload.phone || null,
      idCard: payload.idCard || null,
      residentType: payload.residentType,
      startDate: toDate(payload.startDate),
      endDate: toDate(payload.endDate),
      status: payload.status,
      remark: payload.remark || null
    }
  }

  crudRoutes(app, {
    path: 'residents',
    model: 'resident',
    label: '住户',
    include: { room: { include: { community: true, building: true } } },
    searchFields: ['name', 'phone'],
    buildWhere: (query) => {
      const where = {}
      if (query.roomId) where.roomId = Number(query.roomId)
      if (query.residentType) where.residentType = String(query.residentType)
      if (query.status) where.status = String(query.status)
      if (query.communityId) where.room = { communityId: Number(query.communityId) }
      return where
    },
    orderBy: [{ id: 'desc' }],
    toVO: residentVO,
    createSchema: residentSchema,
    updateSchema: residentSchema,
    beforeCreate: async (payload) => {
      const room = await prisma.room.findUnique({ where: { id: payload.roomId } })
      if (!room) bad('房屋不存在')
      return residentData(payload)
    },
    beforeUpdate: async (payload) => {
      const room = await prisma.room.findUnique({ where: { id: payload.roomId } })
      if (!room) bad('房屋不存在')
      return residentData(payload)
    }
  })

  // ---------- 收费项目 ----------
  const feeItemSchema = z.object({
    name: z.string().trim().min(1, '收费项目名称不能为空').max(50),
    code: z.string().trim().min(1, '项目编码不能为空').max(50),
    type: enumOf(FEE_TYPE, '收费类型不正确'),
    chargeMode: enumOf(CHARGE_MODE, '计费方式不正确'),
    unitPrice: z.coerce.number().nonnegative('单价不能为负数'),
    priceUnit: z.string().trim().max(20).nullish(),
    period: enumOf(FEE_PERIOD, '计费周期不正确'),
    communityId: z.coerce.number().int().positive().nullish(),
    enabled: z.coerce.boolean().default(true),
    sortNo: z.coerce.number().int().default(0),
    remark: z.string().trim().max(255).nullish()
  })

  async function assertFeeItemCode(payload, excludeId) {
    const duplicated = await prisma.feeItem.findFirst({
      where: { code: payload.code, ...(excludeId ? { id: { not: excludeId } } : {}) }
    })
    if (duplicated) bad(`项目编码 ${payload.code} 已存在`)
    return {
      ...payload,
      communityId: payload.communityId || null,
      priceUnit: payload.priceUnit || null,
      remark: payload.remark || null
    }
  }

  crudRoutes(app, {
    path: 'fee-items',
    model: 'feeItem',
    label: '收费项目',
    searchFields: ['name', 'code'],
    buildWhere: (query) => {
      const where = {}
      if (query.type) where.type = String(query.type)
      if (query.chargeMode) where.chargeMode = String(query.chargeMode)
      if (query.enabled !== undefined && query.enabled !== '') where.enabled = String(query.enabled) === 'true'
      if (query.communityId) where.OR = [{ communityId: null }, { communityId: Number(query.communityId) }]
      return where
    },
    orderBy: [{ sortNo: 'asc' }, { id: 'asc' }],
    toVO: feeItemVO,
    createSchema: feeItemSchema,
    updateSchema: feeItemSchema,
    beforeCreate: (payload) => assertFeeItemCode(payload),
    beforeUpdate: (payload, exists) => assertFeeItemCode(payload, exists.id),
    beforeDelete: async (id) => {
      const bills = await prisma.bill.count({ where: { feeItemId: id } })
      if (bills > 0) bad('该收费项目已有账单记录，无法删除，可改为停用')
    }
  })

  // ---------- 下拉选项 ----------
  app.get('/api/communities/options', { preHandler: [app.authenticate] }, async () => {
    const rows = await prisma.community.findMany({ orderBy: { id: 'asc' } })
    return ok(rows.map((row) => optionVO(row, row.name)))
  })

  app.get('/api/buildings/options', { preHandler: [app.authenticate] }, async (request) => {
    const where = request.query.communityId ? { communityId: Number(request.query.communityId) } : {}
    const rows = await prisma.building.findMany({ where, orderBy: { id: 'asc' } })
    return ok(rows.map((row) => optionVO(row, row.name)))
  })

  app.get('/api/fee-items/options', { preHandler: [app.authenticate] }, async (request) => {
    const enabled = request.query.enabled === undefined || request.query.enabled === '' ? undefined : String(request.query.enabled) === 'true'
    const rows = await prisma.feeItem.findMany({
      where: enabled === undefined ? {} : { enabled },
      orderBy: [{ sortNo: 'asc' }, { id: 'asc' }]
    })
    return ok(
      rows.map((row) =>
        optionVO(
          row,
          `${row.name}（${yuan(row.unitPrice)}${row.priceUnit ? ` ${row.priceUnit}` : ''}）`,
          {
            chargeMode: row.chargeMode,
            period: row.period,
            unitPrice: yuan(row.unitPrice),
            priceUnit: row.priceUnit,
            type: row.type
          }
        )
      )
    )
  })

  app.get('/api/rooms/options', { preHandler: [app.authenticate] }, async (request) => {
    const keyword = request.query.keyword ? String(request.query.keyword).trim() : ''
    const where = {
      ...(request.query.communityId ? { communityId: Number(request.query.communityId) } : {}),
      ...(keyword
        ? { OR: [{ roomNo: { contains: keyword } }, { residents: { some: { name: { contains: keyword } } } }] }
        : {})
    }
    const rows = await prisma.room.findMany({
      where,
      orderBy: [{ communityId: 'asc' }, { buildingId: 'asc' }, { roomNo: 'asc' }],
      take: 50
    })
    return ok(
      rows.map((row) =>
        optionVO(row, row.roomNo, {
          area: row.area === null ? null : yuan(row.area),
          roomType: row.roomType,
          communityId: row.communityId,
          buildingId: row.buildingId
        })
      )
    )
  })
}

export default registerBasicRoutes
