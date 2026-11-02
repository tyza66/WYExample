# WYE 部署指南

三种部署形态，按需要挑一个。核心原则只有一条：**数据库要放在持久化存储上**。

## 1. 本地开发

```bash
pnpm run setup     # 安装依赖 + 建库 + 灌演示数据
pnpm run dev       # 后端 8080 + 前端 5173（Vite 代理 /api）
```

分开跑：`pnpm run dev:server`、`pnpm run dev:web`。

## 2. 单进程生产（一个端口同时给 API 和页面）

```bash
pnpm run build     # 构建前端到 wye-frontend/dist
pnpm run start     # Node 托管 API + 页面，http://localhost:8080
```

后端会自动探测前端产物目录（`WYE_WEB_DIST` 可显式指定），找不到就只提供 API。

## 3. Docker

### 3.1 SQLite（默认，零外部依赖）

```bash
docker compose up -d --build
docker compose logs -f wye
```

- 页面与接口：`http://localhost:8080`
- 数据落在命名卷 `wye-data`（容器内 `/app/wye-server/data/wye.db`），`docker compose down` 不会删数据，`down -v` 才会。
- 容器启动时会自动建表（`WYE_AUTO_MIGRATE=true`），库为空时自动灌演示数据（`WYE_SEED=true`）。

### 3.2 MySQL 8

```bash
docker compose -f docker-compose.yml -f docker-compose.mysql.yml up -d --build
```

数据卷 `wye-mysql-data`。可用环境变量覆盖账号：`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_ROOT_PASSWORD`。

### 3.3 PostgreSQL 16

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml up -d --build
```

数据卷 `wye-pg-data`。可用 `POSTGRES_DB`、`POSTGRES_USER`、`POSTGRES_PASSWORD` 覆盖。

> **为什么换库要重新 build？** Prisma 的 `provider` 只能写死在 `schema.prisma` 里，不支持环境变量。
> compose 文件通过 `build.args.DB_PROVIDER` 在生成 Prisma Client 之前改写它。
> 手工部署（不用 Docker）时用 `pnpm run db:switch mysql` 之类的脚本改写 schema，再 `pnpm --dir wye-server install && pnpm --dir wye-server db:push`。

## 4. 云平台

| 平台 | 配置 | 要点 |
|---|---|---|
| Render | [`render.yaml`](../render.yaml) | Docker 构建；**必须保留 disk**（挂到 `/app/wye-server/data`），否则重新部署数据清空 |
| Railway | [`railway.json`](../railway.json) | DOCKERFILE 构建；加一个 Volume 挂到 `/app/wye-server/data` |
| Netlify | [`netlify.toml`](../netlify.toml) | 只部署前端静态站（`VITE_DEMO_MODE=true`，内置 mock，不需要后端），适合做在线 Demo |
| 任意 VPS | 本文第 3 节 | 建议前面挂 Nginx/Caddy 做 HTTPS 反代到 8080 |

健康检查地址：`GET /api/health`（无需鉴权）。

## 5. 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8080` | 监听端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `DATABASE_URL` | `file:../data/wye.db` | 连接串（相对 `wye-server/prisma/` 解析） |
| `WYE_JWT_SECRET` | 开发占位串 | **生产必须改**，改了所有人需重新登录 |
| `WYE_SEED` | `true` | 库为空时灌演示数据；生产建议 `false` |
| `WYE_AUTO_MIGRATE` | `true` | 启动时 `prisma db push` 同步表结构 |
| `WYE_WEB_DIST` | 自动探测 | 前端产物目录 |

## 6. 上线前检查清单

- [ ] `WYE_JWT_SECRET` 换成足够长的随机串
- [ ] 修改/删除演示账号（`admin/admin123`、`cashier/123456`、`viewer/123456`）
- [ ] `WYE_SEED=false`（如需演示数据可先灌后关）
- [ ] 数据库放在持久化卷/磁盘，并配置定时备份
- [ ] 前面挂 HTTPS（Nginx/Caddy/云负载均衡）
- [ ] 确认 `WYE_SMS_*`、`WYE_MAIL_*`、支付与银行通道配置（未配置时走内置模拟通道，不会真的发短信/扣款）
- [ ] 按 `docs/architecture.md` §8 核对合规边界：不代收代付、不存银行卡号、个人信息脱敏

## 7. 数据备份与迁移

**SQLite**

```bash
# 备份（容器内）
docker compose exec wye sh -c 'cp /app/wye-server/data/wye.db /app/wye-server/data/backup-$(date +%F).db'
# 拷出来
docker compose cp wye:/app/wye-server/data/wye.db ./wye-backup.db
```

**MySQL**

```bash
docker compose -f docker-compose.yml -f docker-compose.mysql.yml exec mysql \
  sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > wye-$(date +%F).sql
```

**PostgreSQL**

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml exec postgres \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > wye-$(date +%F).sql
```

业务数据建议用系统内置的 CSV 导出（房屋/住户/账单/欠费/收款/资金流水）做一层可读备份，换系统时也能用得上。
