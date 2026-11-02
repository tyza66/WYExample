// 数据范围（dataScope）+ 账套（ledgerId）过滤
// 见 docs/data-model.md §3.7 / §3.8：COMMUNITY 范围只看指定小区；账套按「房屋 → 小区 → 账套」推导
import { prisma } from '../db/prisma.js'
import { DATA_SCOPE } from './constants.js'
import { bad } from './errors.js'

/**
 * 当前用户可见的小区 id。
 * @returns {Promise<number[]|null>} null 表示不限制（全部可见）
 */
export async function visibleCommunityIds(request) {
  const user = request?.user || {}
  if (!user.sub) return []
  const me = await prisma.user.findUnique({ where: { id: Number(user.sub) } })
  if (!me) return []
  if (me.dataScope !== DATA_SCOPE.COMMUNITY) return null
  const rows = await prisma.userCommunity.findMany({
    where: { userId: me.id },
    select: { communityId: true }
  })
  return rows.map((row) => row.communityId)
}

/** 某账套下的小区 id；未指定账套时返回 null（不限制） */
export async function ledgerCommunityIds(ledgerId) {
  if (ledgerId === undefined || ledgerId === null || ledgerId === '' || Number(ledgerId) === 0) return null
  const rows = await prisma.community.findMany({
    where: { ledgerId: Number(ledgerId) },
    select: { id: true }
  })
  return rows.map((row) => row.id)
}

/** 取当前请求允许访问的小区 id：null = 不限制，数组（可能为空）= 白名单 */
export async function allowedCommunityIds(request) {
  const ids = await visibleCommunityIds(request)
  const ledgerIds = await ledgerCommunityIds(request?.query?.ledgerId)
  if (ledgerIds === null) return ids
  if (ids === null) return ledgerIds
  return ids.filter((id) => ledgerIds.includes(id))
}

/**
 * 生成带 communityId 字段的模型的过滤条件。
 * 注意：白名单为空时用 in: [-1] 保证「什么都查不到」，不能退化成不过滤。
 */
export function communityFilter(ids) {
  if (ids === null) return {}
  return { communityId: { in: ids.length ? ids : [-1] } }
}

/** 生成「带 room 关联」的模型的过滤条件（账单、收款等） */
export function roomCommunityFilter(ids) {
  if (ids === null) return {}
  return { room: { communityId: { in: ids.length ? ids : [-1] } } }
}

/** 常用组合：直接给带 communityId 字段的模型用 */
export async function scopeWhere(request) {
  return communityFilter(await allowedCommunityIds(request))
}

/** 常用组合：给带 room 关联的模型用 */
export async function roomScopeWhere(request) {
  return roomCommunityFilter(await allowedCommunityIds(request))
}

/** 判断某个小区是否在当前用户范围内 */
export async function assertCommunityAllowed(request, communityId) {
  const ids = await allowedCommunityIds(request)
  if (ids === null) return
  if (!ids.includes(Number(communityId))) bad('该小区不在你的数据权限范围内')
}
