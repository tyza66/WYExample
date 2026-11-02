# WYE · 开源物业收费管理系统

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933.svg)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000.svg)](https://fastify.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748.svg)](https://www.prisma.io/)
[![Vue](https://img.shields.io/badge/Vue-3.4-42b883.svg)](https://vuejs.org/)

WYE 是一套面向中小物业公司、园区与公寓运营方的**物业收费管理系统**，把「房户资料 → 按标准生成账单 → 收款核销 → 欠费催缴 → 报表对账」这条链路做成一套可自部署、可二次开发的开源系统。

**一个进程就是一套系统**：后端（Fastify）同时提供 API 和前端页面，数据库用 SQLite 单文件，克隆下来一条命令就能跑，也可以一个容器部署上线。

> 定位说明：WYE 只是**账务与流程软件**，不参与资金收付、不存储银行卡号。任何场景下都不应让资金经过本系统运营方的账户。

## 🚀 三种用法，按需选一个

| 方式 | 命令 / 入口 | 适合 |
|---|---|---|
| **一条命令本地跑** | `pnpm run setup` 然后 `pnpm run dev` | 想看代码、二次开发 |
| **Docker 一键起** | `docker compose up -d` → 打开 `http://localhost:8080` | 想直接部署到服务器 |
| **在线 Demo** | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/tyza66/WYExample) | 只想点开看看（前端内置 mock，不需要后端） |

### 云平台一键部署

| 平台 | 按钮 | 说明 |
|---|---|---|
| Render | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/tyza66/WYExample) | 用 `render.yaml`，已配好持久磁盘与健康检查 |
| Railway | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Ftyza66%2FWYExample) | 用 `railway.json`，Dockerfile 构建 |

> ⚠️ **SQLite 必须挂持久化磁盘**（Render 的 disk、Railway 的 volume、Docker 的 `wye-data` 卷）。
> 平台文件系统是临时的，不挂盘的话每次重新部署数据都会丢。

## ✨ 功能特性

| 模块 | 能力 |
|---|---|
| 基础资料 | 小区、楼栋、房屋/商铺/车位、住户（业主/租户/家属），面积与使用状态管理 |
| 收费项目 | 按面积 / 按户 / 按用量 / 固定金额四种计费方式，月/季/年/一次性周期 |
| 账单管理 | 按小区+楼栋+账期批量生成，支持减免调整、作废留痕、覆盖生成校验、跳过原因明细 |
| 收款核销 | 现金/微信/支付宝/银行转账/POS/银行代扣六种方式，按应缴日自动核销，支持一单多收、一笔多单，超出部分自动记为预收余额 |
| 水电抄表 | 上期读数自动带出、用量计算、异常读数校验、按用量预估金额 |
| 报表对账 | 工作台汇总（应收/实收/欠费/收缴率/欠费 TOP）、欠费明细、收款汇总（按日/月/方式/项目）、日结 |
| 资金管理 | 预收/押金账户、预收抵扣、资金流水、退款审批与余额变动留痕 |
| 银行代扣 | 掩码签约信息、批量报盘 CSV、回盘导入、自动核销与失败记录 |
| 催缴与票据 | 短信/邮件模板与模拟通道、收据/发票开具、作废、可打印 HTML |
| 数据迁移 | 房屋/住户/历史欠费/预收押金 CSV 导入，账单/欠费/收款/资金流水导出 |
| 业主端 | 独立移动 H5：房号+手机号后四位登录、查账、模拟在线缴费 |
| 系统管理 | 三角色权限、账套切换、用户可见小区范围、审批中心、用户管理、全量写操作日志 |

报表与账单列表**同源计算**：应收 = Σ(金额 − 减免)、实收 = Σ(已核销)、欠费 = 应收 − 实收，不会出现两套口径对不上账。

## 🧱 技术栈

- **后端**：Node.js 20 · Fastify 5 · Prisma 6 · SQLite（可换 MySQL/Postgres）· JWT · bcrypt
- **前端**：Vue 3.4 · Vite 5 · Element Plus 2.5 · Pinia · Vue Router · axios · ECharts
- **部署**：单容器镜像 / docker compose / Render / Railway / Netlify 静态 Demo

## 🏁 快速开始

### 方式一：一条命令（推荐）

```bash
git clone https://github.com/tyza66/WYExample.git && cd WYExample
pnpm run setup     # 安装依赖 + 建库 + 灌演示数据
pnpm run dev       # 同时起后端(8080)和前端(5173)
```

打开 `http://localhost:5173` 登录。（`scripts/dev.sh` / `scripts/dev.bat` 是等价的兜底脚本，Windows 可双击。）

也可以只跑生产模式，一个端口搞定：

```bash
pnpm run build && pnpm run start   # 打开 http://localhost:8080
```

### 方式二：Docker

```bash
docker compose up -d          # 构建并启动，打开 http://localhost:8080
docker compose logs -f wye    # 看日志
docker compose down           # 停止（数据保留在 wye-data 卷）
```

生产环境记得在同目录放一个 `.env`（参考 [`.env.example`](./.env.example)），至少改掉 `WYE_JWT_SECRET`。

### 演示账号

| 账号 | 密码 | 角色 | 能看到什么 |
|---|---|---|---|
| `admin` | `admin123` | 管理员 | 全部功能 |
| `cashier` | `123456` | 收费员 | 账单、收款、抄表、报表（不能改基础资料与用户） |
| `viewer` | `123456` | 只读 | 只能查看 |

演示数据包含 1 个小区、3 栋楼、12 套房屋/商铺/车位、10 位住户、4 个收费项目，以及最近 3 个账期的账单、抄表与部分收款（含全额结清、部分缴、预收余额三种情形），工作台和报表开箱即有内容。

> 正式使用请关闭演示数据：`WYE_SEED=false`，并修改默认密码。

## 📁 目录结构

```
WYExample/
├── package.json            一站式命令入口（setup / dev / build / start / docker:*）
├── Dockerfile              单镜像：构建前端 + 运行 Node 服务
├── docker-compose.yml      一条命令起全栈
├── render.yaml             Render Blueprint
├── railway.json            Railway 配置
├── netlify.toml            Netlify 静态在线 Demo（VITE_DEMO_MODE）
├── docs/                   接口契约、数据模型、架构说明（改代码前先看这里）
├── wye-server/             Node 后端（Fastify + Prisma + SQLite）
│   ├── prisma/schema.prisma
│   └── src/{routes,services,common,plugins,db}
└── wye-frontend/           Vue 3 前端
    ├── src/views/          14 个页面
    └── src/mock/           在线 Demo 用的内存 mock（仅 VITE_DEMO_MODE 下打包）
```

## ⚙️ 配置项

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8080` | 后端端口 |
| `DATABASE_URL` | `file:../data/wye.db` | SQLite 文件位置（相对 `prisma/` 目录解析） |
| `WYE_JWT_SECRET` | 开发用占位串 | **生产必须改** |
| `WYE_SEED` | `true` | 库为空时自动灌演示数据 |
| `WYE_AUTO_MIGRATE` | `true` | 启动时自动同步表结构 |
| `WYE_WEB_DIST` | 自动探测 | 前端产物目录，存在时由本进程托管页面 |
| `DATABASE_PROVIDER` | `sqlite` | 文档用途；实际切换请用 `pnpm run db:switch mysql\|postgresql` 或对应 Docker compose |
| `WYE_SMS_*` / `WYE_MAIL_*` | 未配置 | 未配置时通知走内置模拟通道，不会真实发送 |

接口自检：`curl http://localhost:8080/api/health`

## 📚 文档

| 文档 | 内容 |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | 架构、目录约定、开发规范、路线图 |
| [docs/data-model.md](./docs/data-model.md) | 表结构、字段、业务规则（账单生成/核销/金额口径） |
| [docs/api.md](./docs/api.md) | REST 接口契约（前后端唯一约定） |
| [docs/deploy.md](./docs/deploy.md) | SQLite / MySQL / PostgreSQL / Docker / 云平台部署、备份与上线检查 |

## 🗺️ 路线图

一期与二期已完成：基础资料、收费项目、账单生成、收款核销、抄表、报表、资金账户、押金/预收、退款审批、滞纳金、银行代扣、催缴通知、收据发票、CSV 导入导出、数据范围、审批中心、账套、业主端 H5、多数据库部署配置。

真实短信、支付、银行代扣只需要替换对应通道适配器；当前默认实现是可自测的 mock 通道，不会连接外部资金或短信账户。

后续增强方向：

- [ ] 微信小程序壳（复用 `/portal` H5 的接口与页面逻辑）
- [ ] 真实短信 / 邮件 / 支付 / 银行 SDK 适配器
- [ ] 电子发票平台接口与银行定长文件模板
- [ ] 更细粒度的审批流与按楼栋数据权限

## 🤝 参与贡献

欢迎提 Issue 和 PR，请先阅读 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 📄 许可证

[MIT](./LICENSE)
