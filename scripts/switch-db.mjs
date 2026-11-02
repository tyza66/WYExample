#!/usr/bin/env node
/**
 * 切换 Prisma 数据库方言（sqlite / mysql / postgresql）
 *
 * 用法：
 *   node scripts/switch-db.mjs mysql        # 切到 MySQL
 *   node scripts/switch-db.mjs postgresql   # 切到 PostgreSQL
 *   node scripts/switch-db.mjs sqlite       # 切回默认 SQLite
 *
 * 说明：Prisma 的 provider 不支持用环境变量，只能写死在 schema 里，
 *      所以这里做的是改写 wye-server/prisma/schema.prisma 的 provider 行。
 *      切换后请重新生成 client 并同步表结构：
 *        pnpm --dir wye-server install && pnpm --dir wye-server db:push
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const DIALECTS = {
  sqlite: { provider: 'sqlite', example: 'file:../data/wye.db' },
  mysql: { provider: 'mysql', example: 'mysql://wye:wye@127.0.0.1:3306/wye' },
  postgresql: { provider: 'postgresql', example: 'postgresql://wye:wye@127.0.0.1:5432/wye?schema=public' }
}

const target = String(process.argv[2] || '').toLowerCase()
if (!DIALECTS[target]) {
  console.error(`用法：node scripts/switch-db.mjs <${Object.keys(DIALECTS).join('|')}>`)
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaPath = resolve(root, 'wye-server/prisma/schema.prisma')
const schema = readFileSync(schemaPath, 'utf8')

if (!/datasource\s+db\s*\{[\s\S]*?\}/.test(schema)) {
  console.error('未在 schema.prisma 中找到 datasource db 块，中止')
  process.exit(1)
}

const next = schema.replace(/(datasource\s+db\s*\{[\s\S]*?\})/, (block) =>
  block.replace(/provider\s*=\s*"[^"]*"/, `provider = "${DIALECTS[target].provider}"`)
)

if (next === schema) {
  console.log(`schema.prisma 已是 ${target}，无需修改`)
} else {
  writeFileSync(schemaPath, next)
  console.log(`已把 wye-server/prisma/schema.prisma 的 provider 改为 ${DIALECTS[target].provider}`)
}

console.log(`\n下一步：`)
console.log(`  1) 在 wye-server/.env 里设置 DATABASE_URL=${DIALECTS[target].example}`)
console.log(`  2) pnpm --dir wye-server install   # 重新生成 Prisma Client`)
console.log(`  3) pnpm --dir wye-server db:push   # 同步表结构`)
console.log(`  4) pnpm --dir wye-server db:seed   # 可选：灌演示数据`)
