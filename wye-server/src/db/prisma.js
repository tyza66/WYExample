// PrismaClient 单例：避免 --watch 热重载时反复建连接
import { Prisma, PrismaClient } from '@prisma/client'

export const prisma = globalThis.__wyePrisma__ || new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalThis.__wyePrisma__ = prisma

// 金额统一用 Prisma.Decimal（decimal.js），舍入规则固定 HALF_UP
export const Decimal = Prisma.Decimal
Decimal.set({ rounding: Decimal.ROUND_HALF_UP })

export default prisma
