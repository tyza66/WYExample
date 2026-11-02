# 贡献指南

感谢愿意为 WYE 出力。为了让改动能顺利合入，请先花两分钟看完下面几条。

## 开始之前

1. **接口和数据模型是契约。** 任何涉及接口路径、字段名、表结构的改动，必须**先改文档再改代码**：
   - 接口 → [`docs/api.md`](./docs/api.md)
   - 表结构与业务规则 → [`docs/data-model.md`](./docs/data-model.md)
   - 架构与目录约定 → [`docs/architecture.md`](./docs/architecture.md)
2. 提交 PR 前请在本机跑通构建（见下）。
3. 一个 PR 只做一件事。格式化、重命名等无关改动请单独提交，方便 review。

## 本地开发

```bash
pnpm run setup        # 安装依赖 + 建库 + 灌演示数据（首次）
pnpm run dev          # 后端 8080 + 前端 5173

# 也可以分开跑
pnpm run dev:server   # 只起后端（Fastify + SQLite）
pnpm run dev:web      # 只起前端（Vite）
```

提交前自检：

```bash
pnpm run build                                   # 前端必须构建成功
node --check $(find wye-server/src -name "*.js") # 后端语法自检
pnpm --dir wye-server db:seed                    # 演示数据能重新灌入（会清空本地数据）
```

涉及账务逻辑（账单生成、核销、报表口径）的改动，请在 PR 描述里写清**验证方式**，例如："把 2026-03 的账单全收完后，工作台实收 = 账单列表实收 = 收款流水合计，收缴率 100%"。

## 代码约定

- **金额一律用 `Prisma.Decimal`（decimal.js）**，禁止用 JS 浮点直接加减乘；除法统一 `ROUND_HALF_UP` 保留 2 位，工具函数见 `wye-server/src/common/money.js`。
- 业务失败抛 `BusinessException`，`message` 写成**能直接弹给收费员看的中文**，不要抛英文异常或空提示。
- 跨表一致性（收款单 + 核销明细 + 账单状态）必须包在 `prisma.$transaction` 里。
- 写操作必须记 `wye_operation_log`。
- 前端不做业务计算，应收/欠费/收缴率一律以后端返回为准；枚举展示统一走 `src/utils/dict.js`。
- 遵循现有 `routes → services → prisma` 分层与命名，不要引入新的分层风格。

## 分支与提交信息

- 分支：`feat/xxx`、`fix/xxx`、`docs/xxx`。
- 提交信息前缀：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`，例：
  - `feat: 账单批量生成支持按楼栋过滤`
  - `fix: 核销顺序在应缴日为空时排序不稳定`

## Issue 建议格式

- **Bug**：复现步骤 + 期望结果 + 实际结果 + 截图/日志 + 运行方式（本地 Node / Docker / 在线 Demo）。
- **新功能**：使用场景（谁在什么情况下需要）+ 期望交互 + 是否愿意自己实现。

## 合规红线（PR 会被直接拒绝的情况）

- 让资金经过系统运营方账户，或实现代收代付、资金归集类功能。
- 存储银行卡号等支付敏感信息（如需对接银行代扣，只保存银行返回的签约标识）。
- 采集超出业务必要的业主个人信息，或不加脱敏地返回证件号、手机号。
- 在日志、报错信息或导出文件里明文带出完整证件号、手机号、银行卡号。

## 许可证

本项目采用 [MIT](./LICENSE)。提交 PR 即表示你同意以同一许可证授权你的贡献。
