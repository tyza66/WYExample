# WYE 架构与开发说明

## 1. 项目定位

**WYE 是一套开源的物业收费管理系统**，把"房户资料 → 按标准生成账单 → 收款核销 → 欠费催缴 → 报表对账"这条链路做成一套可自部署、可二次开发的系统。

- 面向：中小物业公司、园区/公寓运营方、需要自建物业收费模块的开发团队。
- 不面向：需要银行资金托管、代收代付牌照能力的商业场景（本项目只做软件，不碰资金）。
- 设计原则：**账务口径唯一**（报表与明细同源）、**一个进程即一套系统**（Node 同时提供 API 与页面）、**默认零配置**（SQLite + 演示数据）、**不存敏感支付信息**。

## 2. 技术选型

| 层 | 选型 | 版本 | 说明 |
|---|---|---|---|
| 运行时 | Node.js | ≥ 20 | ESM，不用 TypeScript |
| 后端框架 | Fastify | 5 | 自带高性能路由与 logger |
| ORM | Prisma | 6 | schema 即文档，`prisma db push` 同步表结构 |
| 数据库 | SQLite | 单文件 | 默认 `wye-server/data/wye.db`，可换 MySQL / Postgres |
| 鉴权 | @fastify/jwt + 角色 preHandler | — | token 12h，角色 ADMIN / CASHIER / VIEWER |
| 入参校验 | zod | 3 | 错误信息直接转成中文提示 |
| 密码 | bcryptjs | — | 10 轮 |
| 前端 | Vue | 3.4 | Composition API + `<script setup>` |
| 构建 | Vite | 5 | 开发代理 `/api` → 8080 |
| UI | Element Plus | 2.5 | 中后台组件 |
| 状态 | Pinia | 2 | 用户态与全局字典 |
| 图表 | ECharts | 5 | 工作台趋势与收款汇总 |
| 请求 | axios | 1 | 统一信封解析与错误提示 |

**金额处理**：数据库用 Prisma `Decimal`，JS 侧一律用 `Prisma.Decimal`（decimal.js，`ROUND_HALF_UP`）运算，禁止用 `+ - * /` 直接算浮点数；出接口时转成保留 2 位小数的 number。单价允许 4 位小数（如 0.6185 元/度）。

## 3. 分层与目录结构

```
WYExample/
├── package.json            一站式命令入口（setup / dev / build / start / docker:*）
├── Dockerfile              多阶段镜像：构建前端 → 运行 Node 服务
├── docker-compose.yml      一条命令起全栈（含 SQLite 持久化卷）
├── render.yaml             Render Blueprint（含持久磁盘）
├── railway.json            Railway 配置
├── netlify.toml            Netlify 静态在线 Demo（VITE_DEMO_MODE=true）
├── docker-compose.mysql.yml MySQL 8 生产覆盖配置
├── docker-compose.postgres.yml PostgreSQL 16 生产覆盖配置
├── scripts/                dev.sh / dev.bat / switch-db.mjs
├── docs/                   architecture / data-model / api / deploy
├── wye-server/
│   ├── package.json        dev / start / db:push / db:seed
│   ├── prisma/
│   │   ├── schema.prisma   全部 wye_ 表
│   │   └── seed.js         演示数据（与业务同口径生成）
│   └── src/
│       ├── server.js       入口：引导 → 监听 → 优雅退出
│       ├── app.js          组装 Fastify：CORS、JWT、路由、错误处理、静态托管
│       ├── config/env.js   环境变量集中读取
│       ├── common/         Result 信封、业务异常、金额工具、枚举、校验、通用工具
│       ├── plugins/auth.js JWT 签发与角色校验
│       ├── db/             PrismaClient 单例、启动引导（建表 + 播种）
│       ├── routes/         auth / basic / billing / reports / system
│       └── services/       billing（账单）、payments（核销）、reports（报表）、
│                           crud（通用 CRUD 工厂）、serialize（出参序列化）、log、numbering
└── wye-frontend/
    ├── vite.config.js      5173 端口，/api 代理到 8080
    └── src/
        ├── api/            request.js + 各模块接口（路径与 docs/api.md 一一对应）
        ├── router/         路由与登录/角色守卫
        ├── stores/         用户态
        ├── layout/         侧边栏 + 顶栏框架
        ├── views/          14 个页面
        ├── mock/           在线 Demo 用的内存 mock（仅 VITE_DEMO_MODE 打包）
        ├── utils/          字典、格式化、导出、图表
        └── styles/
```

**依赖方向：** `routes → services → prisma`。路由只做参数解析与响应封装，业务规则写在 `services`，实体不直接出接口（统一过 `serialize.js`）。跨层不得反向引用。

## 4. 前端页面与路由

| 路由 | 页面 | 角色 |
|---|---|---|
| `/login` | 登录 | 公开 |
| `/dashboard` | 工作台：应收/实收/欠费/收缴率、趋势图、欠费 TOP | 全部 |
| `/basic/communities` | 小区管理 | 全部（写操作 ADMIN） |
| `/basic/buildings` | 楼栋管理 | 同上 |
| `/basic/rooms` | 房屋管理 | 同上 |
| `/basic/residents` | 住户管理 | 同上 |
| `/fee/items` | 收费项目配置 | ADMIN |
| `/fee/bills` | 账单管理（生成、调整、作废） | 全部 |
| `/fee/payments` | 收款登记与流水 | 全部 |
| `/fee/meters` | 抄表录入 | 全部 |
| `/report/arrears` | 欠费报表 | 全部 |
| `/report/collection` | 收款汇总 | 全部 |
| `/report/dailyClose` | 日结 | 全部 |
| `/system/users` | 用户管理 | ADMIN |
| `/system/logs` | 操作日志 | ADMIN |

**前端约定：** 路由元信息带 `meta: { title, roles: ['ADMIN'] }`；守卫根据 `stores/user` 校验，无权限菜单不渲染。枚举展示统一走 `utils/dict.js`，金额统一两位小数。**前端不做业务计算**，应收/欠费/收缴率一律以后端返回为准。

## 5. 运行方式

### 5.1 一条命令（本地开发）

```bash
pnpm run setup     # 安装依赖 + 建库 + 灌演示数据
pnpm run dev       # 后端 8080 + 前端 5173
```

生产的单进程模式（Node 同时托管 API 与页面）：

```bash
pnpm run build && pnpm run start   # http://localhost:8080
```

### 5.2 Docker

```bash
docker compose up -d      # http://localhost:8080
```

镜像内：前端产物在 `/app/web`，SQLite 在 `/app/wye-server/data`（挂 `wye-data` 卷）；启动时自动建表（`WYE_AUTO_MIGRATE`）并按需灌演示数据（`WYE_SEED`）。

### 5.3 在线 Demo（Netlify）

`netlify.toml` 用 `VITE_DEMO_MODE=true` 构建前端：`src/mock/index.js` 会把 axios 的 adapter 换成内存实现，所有 `/api` 请求由内置演示数据应答，不需要后端。写操作只改内存，刷新即还原。

### 5.4 云平台

- **Render**：`render.yaml` 已声明 Docker 构建、`/api/health` 健康检查、持久磁盘（必须挂，否则重启丢数据）。
- **Railway**：`railway.json` 用 DOCKERFILE 构建。

### 5.5 建表与演示数据

```bash
pnpm --dir wye-server db:push    # 同步表结构
pnpm --dir wye-server db:seed    # 清空并重灌演示数据
```

服务启动时若 `WYE_AUTO_MIGRATE=true`（默认）会自动执行 `prisma db push`，所以首次运行不需要手动建表。

## 6. 开发约定

1. **接口先改 `docs/api.md`**，再动代码；新增字段必须补文档。
2. 所有接口返回 `Result` 信封（`{code,message,data}`）；业务失败抛 `BusinessException`，由全局错误处理转成 `code=1` + 中文 `message`；未登录返回 HTTP 401 + `code=401`；角色不足返回 403。
3. 金额一律走 `common/money.js`（内部 Prisma.Decimal），禁止浮点直算。
4. 写操作必须记 `wye_operation_log`（模块、动作、对象、摘要、操作人、IP）。
5. 跨表一致性（收款 + 核销 + 账单状态）必须放在 `prisma.$transaction` 里。
6. 提交信息用 `feat:` / `fix:` / `docs:` / `refactor:` 前缀。

## 7. 实现状态与路线图

**一期与二期已完成**：基础资料、收费项目、账单生成、收款核销、抄表、欠费与收款报表、日结、用户与日志、预收/押金/资金流水、退款与减免审批、滞纳金、银行代扣报盘回盘、催缴通知模拟通道、收据发票、CSV 导入导出、数据范围、账套、业主端 H5、SQLite/MySQL/PostgreSQL Docker 配置。

**后续增强**：

- [ ] 微信小程序壳（复用 `/portal` H5 的接口）
- [ ] 真实短信 / 邮件 / 支付 / 银行 SDK 适配器
- [ ] 电子发票平台接口与银行定长文件模板
- [ ] 更细粒度的审批流与按楼栋数据权限
- [ ] 定时备份、恢复演练与多实例部署文档

## 8. 安全与合规边界

- 系统只做**账务与流程软件**，不参与资金收付；任何场景下都不应让资金经过本系统运营方账户。
- **不存储银行卡号**等支付敏感信息；如接入银行代扣，只保存银行返回的签约标识。
- 业主姓名、电话、证件号属个人信息：最小化采集、接口脱敏返回（证件号前 6 后 4、手机号中间打码）、按角色控制可见范围、操作留痕。
- 生产部署请自行完成 HTTPS、数据库备份、账号口令管理与所在地区的合规要求。
