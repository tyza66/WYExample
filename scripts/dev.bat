@echo off
REM WYE 一条命令启动全栈（Windows）
REM 双击运行即可；首次会自动安装依赖、建库、灌演示数据。
cd /d "%~dp0.."

if not exist "wye-server\node_modules" (
  echo ==^> 首次运行，正在安装依赖
  call pnpm install
  call pnpm --dir wye-server install
  call pnpm --dir wye-frontend install
)

if not exist "wye-server\data\wye.db" (
  echo ==^> 初始化数据库与演示数据
  call pnpm --dir wye-server db:push
  call pnpm --dir wye-server db:seed
)

echo ==^> 启动中：后端 http://localhost:8080 ，前端 http://localhost:5173
echo ==^> 演示账号：admin/admin123 、cashier/123456 、viewer/123456
call pnpm run dev
