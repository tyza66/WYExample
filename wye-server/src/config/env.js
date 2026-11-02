// 环境变量集中读取，只在这里碰 process.env
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
// wye-server/ 根目录（src/config -> ../..）
export const serverRoot = path.resolve(here, '../..')

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback
  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase())
}

export const env = {
  port: Number(process.env.PORT || 8080),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.WYE_JWT_SECRET || 'wye-dev-secret-change-me',
  usingDefaultSecret: !process.env.WYE_JWT_SECRET,
  seed: bool(process.env.WYE_SEED, true),
  autoMigrate: bool(process.env.WYE_AUTO_MIGRATE, true),
  webDist: process.env.WYE_WEB_DIST || '',
  isProduction: process.env.NODE_ENV === 'production',
  serverRoot
}
