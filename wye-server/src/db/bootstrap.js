// 启动引导：确保数据目录存在 -> 同步表结构 -> 按需灌演示数据
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { env, serverRoot } from '../config/env.js'
import { prisma } from './prisma.js'

/** 把 DATABASE_URL 里的 file: 路径解析成绝对路径（相对 prisma/schema.prisma 所在目录） */
export function resolveSqliteFile() {
  const url = process.env.DATABASE_URL || 'file:../data/wye.db'
  if (!url.startsWith('file:')) return null
  const raw = url.slice('file:'.length)
  if (raw.startsWith('/')) return raw
  return path.resolve(serverRoot, 'prisma', raw)
}

export function ensureDataDir() {
  const file = resolveSqliteFile()
  if (!file) return
  fs.mkdirSync(path.dirname(file), { recursive: true })
}

/** 调用本地 prisma CLI 同步表结构（会顺带 prisma generate，保证 client 与 schema 同步） */
export function runDbPush(logger) {
  const cli = path.join(serverRoot, 'node_modules', 'prisma', 'build', 'index.js')
  if (!fs.existsSync(cli)) {
    throw new Error('未找到 prisma CLI，请先在 wye-server 目录执行 pnpm install（或 npm install）')
  }
  logger?.info?.('同步数据库表结构：prisma db push')
  const result = spawnSync(process.execPath, [cli, 'db', 'push', '--accept-data-loss'], {
    cwd: serverRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8'
  })
  if (result.status !== 0) {
    throw new Error(`prisma db push 失败：\n${result.stdout || ''}\n${result.stderr || ''}`)
  }
}

/** 库为空时灌演示数据 */
export async function runSeedIfNeeded(logger) {
  const count = await prisma.user.count()
  if (count > 0) {
    logger?.info?.(`已有 ${count} 个账号，跳过演示数据`)
    return
  }
  const { seed } = await import('../../prisma/seed.js')
  logger?.info?.('数据库为空，灌入演示数据…')
  await seed(prisma)
}

export async function bootstrap(logger) {
  ensureDataDir()
  if (env.autoMigrate) {
    runDbPush(logger)
  }
  if (env.seed) {
    await runSeedIfNeeded(logger)
  }
}
