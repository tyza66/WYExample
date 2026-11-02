#!/usr/bin/env bash
# WYE 一条命令启动全栈（macOS / Linux）
# 首次运行会自动安装依赖、建库、灌演示数据，然后同时起后端和前端。
set -e
cd "$(dirname "$0")/.."

if [ ! -d wye-server/node_modules ] || [ ! -d wye-frontend/node_modules ]; then
  echo "==> 首次运行，正在安装依赖"
  pnpm install
  pnpm --dir wye-server install
  pnpm --dir wye-frontend install
fi

if [ ! -f wye-server/data/wye.db ]; then
  echo "==> 初始化数据库与演示数据"
  pnpm --dir wye-server db:push
  pnpm --dir wye-server db:seed
fi

echo "==> 启动中：后端 http://localhost:8080 ，前端 http://localhost:5173"
echo "==> 演示账号：admin/admin123 、cashier/123456 、viewer/123456"
pnpm run dev
