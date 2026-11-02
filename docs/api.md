# WYE API 契约

> 后端默认端口 `8080`，所有接口前缀 `/api`。前端开发服务器 `5173`，通过 Vite 代理 `/api` → `http://localhost:8080`。
> 本文件是前后端唯一接口约定，任何一方改动都必须先改这里。

## 1. 通用约定

### 1.1 响应信封

```json
{ "code": 0, "message": "ok", "data": {} }
```

| code | 含义 | HTTP 状态 |
|---|---|---|
| 0 | 成功 | 200 |
| 1 | 业务失败（参数校验、规则不允许等），`message` 为可直接展示给用户的中文提示 | 200 |
| 401 | 未登录或登录失效 | 401 |
| 500 | 服务端异常 | 500 |

- 未登录时返回 HTTP 401 + `code=401`，前端据此跳转登录页。
- 参数校验失败返回 `code=1`，`message` 例：`房号 1-101 已存在`。

### 1.2 鉴权

- 登录成功后返回 `token`，之后所有请求带 `Authorization: Bearer <token>`。
- 服务端用内存 Token 表（本期不做 JWT、不做刷新），重启即失效。

### 1.3 分页与查询

- 请求：`?page=1&size=10`（`page` 从 1 开始，`size` 默认 10，最大 100），其余为过滤条件。
- 响应 `data`：

```json
{ "list": [], "total": 0, "page": 1, "size": 10 }
```

### 1.4 时间与金额

- 日期 `yyyy-MM-dd`，时间 `yyyy-MM-dd HH:mm:ss`，账期 `yyyy-MM`。
- 金额字段一律为 JSON number（保留 2 位小数），前端负责展示两位小数。后端内部用 `Prisma.Decimal` 运算，不用浮点。

### 1.5 健康检查与在线 Demo

- `GET /api/health` 无需鉴权，返回 `{code:0,message:'ok',data:{status:'ok',version:'1.0.0',db:'up'}}`，供 Docker HEALTHCHECK 与 Render/Railway 健康检查使用。
- 前端以 `VITE_DEMO_MODE=true` 构建时（Netlify 在线 Demo），所有 `/api` 请求由 `wye-frontend/src/mock/index.js` 在浏览器内存中应答，**不需要后端**；写操作只改内存，刷新即还原。演示实现不追求账务级精度。

## 2. 接口清单

### 2.1 认证

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/api/auth/login` | 公开 | 登录 |
| GET | `/api/auth/profile` | 登录 | 当前用户 |
| POST | `/api/auth/logout` | 登录 | 退出（销毁 token） |

```jsonc
// POST /api/auth/login
// req
{ "username": "admin", "password": "admin123" }
// res.data
{ "token": "b1f2...", "user": { "id": 1, "username": "admin", "realName": "系统管理员", "role": "ADMIN" } }
```

### 2.2 基础资料

以下 5 组资源结构一致，均为标准 CRUD：

| 资源 | 路径 | 列表过滤参数 |
|---|---|---|
| 小区 | `/api/communities` | `keyword` |
| 楼栋 | `/api/buildings` | `communityId`、`keyword` |
| 房屋 | `/api/rooms` | `communityId`、`buildingId`、`roomType`、`status`、`keyword`（房号/住户名） |
| 住户 | `/api/residents` | `roomId`、`communityId`、`residentType`、`status`、`keyword`（姓名/电话） |
| 收费项目 | `/api/fee-items` | `type`、`chargeMode`、`enabled`、`keyword` |

| 方法 | 路径 | 角色 |
|---|---|---|
| GET | `/api/{resource}` | 全部角色 |
| GET | `/api/{resource}/{id}` | 全部角色 |
| POST | `/api/{resource}` | ADMIN（收费项目同 ADMIN） |
| PUT | `/api/{resource}/{id}` | ADMIN |
| DELETE | `/api/{resource}/{id}` | ADMIN |

**下拉选项接口**（表单联动用，返回精简结构）：

| 方法 | 路径 | 返回 `data` |
|---|---|---|
| GET | `/api/communities/options` | `[{ "id": 1, "label": "阳光花园" }]` |
| GET | `/api/buildings/options?communityId=1` | `[{ "id": 1, "label": "1 号楼" }]` |
| GET | `/api/fee-items/options?enabled=true` | `[{ "id": 1, "label": "物业管理费（3.50 元/㎡）" }]` |
| GET | `/api/rooms/options?communityId=1&keyword=1-1` | `[{ "id": 1, "label": "1-101", "extra": { "area": 89.5, "roomType": "RESIDENCE" } }]` |

**房屋字段示例：**

```jsonc
{
  "id": 1, "communityId": 1, "communityName": "阳光花园",
  "buildingId": 1, "buildingName": "1 号楼",
  "unit": "1", "roomNo": "1-101", "floor": 1, "area": 89.5,
  "roomType": "RESIDENCE", "status": "OCCUPIED",
  "residentCount": 2, "remark": null
}
```

**住户新增请求：**

```jsonc
{ "roomId": 1, "name": "张三", "phone": "13800000001", "idCard": "110101199001011234",
  "residentType": "OWNER", "startDate": "2024-01-01", "endDate": null, "status": "LIVING", "remark": null }
```

> 响应中的 `idCard` 必须脱敏为 `110101********1234`。

### 2.3 账单

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/bills` | 全部 | 过滤：`period`、`communityId`、`buildingId`、`roomId`、`feeItemId`、`status`、`keyword`（房号/住户/账单号） |
| GET | `/api/bills/{id}` | 全部 | 账单详情 |
| POST | `/api/bills/generate` | ADMIN、CASHIER | 批量生成 |
| PUT | `/api/bills/{id}` | ADMIN、CASHIER | 调整减免/应缴日 |
| POST | `/api/bills/{id}/void` | ADMIN | 作废 |

```jsonc
// POST /api/bills/generate
// req —— period 必填；communityId/buildingId/feeItemIds 为空表示不限
{ "period": "2026-03", "communityId": 1, "buildingId": null, "feeItemIds": [1, 2], "overwrite": false }
// res.data
{ "generated": 24, "skipped": 2, "totalAmount": 12860.00,
  "skipReasons": [{ "roomNo": "1-101", "feeItem": "水费", "reason": "该账期无抄表记录" }] }

// PUT /api/bills/{id}
{ "discount": 50.00, "dueDate": "2026-03-31", "remark": "困难户减免（主任批准）" }

// POST /api/bills/{id}/void
{ "reason": "重复生成" }
```

**账单返回字段：**

```jsonc
{
  "id": 1, "billNo": "B202603000001", "communityId": 1, "communityName": "阳光花园",
  "roomId": 1, "roomNo": "1-101", "buildingName": "1 号楼",
  "feeItemId": 1, "feeItemName": "物业管理费", "period": "2026-03",
  "chargeMode": "AREA", "quantity": 89.5, "unitPrice": 3.5,
  "amount": 313.25, "discount": 0, "netAmount": 313.25, "paidAmount": 0, "arrears": 313.25,
  "status": "UNPAID", "dueDate": "2026-03-31", "voidReason": null, "remark": null
}
```

### 2.4 收款

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/payments` | 全部 | 过滤：`period`、`communityId`、`roomId`、`method`、`keyword`（收款单号/房号/住户） |
| GET | `/api/payments/{id}` | 全部 | 含核销明细 |
| POST | `/api/payments` | ADMIN、CASHIER | 登记收款并自动核销 |
| GET | `/api/payments/{id}/refund` 之外的退款 | — | 一期不做，见 roadmap |

```jsonc
// POST /api/payments
// req：billIds 为空则按规则自动核销；amount 可为 0 以外正数
{ "roomId": 1, "amount": 500.00, "method": "WECHAT", "paidAt": "2026-03-05 10:20:00",
  "billIds": null, "remark": "3 月物业费" }
// res.data
{ "paymentId": 1, "paymentNo": "P20260305000001", "amount": 500.00,
  "allocatedAmount": 313.25, "advanceAmount": 186.75,
  "allocations": [{ "billId": 1, "billNo": "B202603000001", "period": "2026-03", "amount": 313.25 }],
  "roomArrearsAfter": 0 }
```

> `advanceAmount > 0` 表示形成预收余额；房屋维度预收余额 = Σ(收款金额 − 已核销金额)。

### 2.5 抄表

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/meter-readings` | 全部 | 过滤：`period`、`roomId`、`feeItemId`、`communityId` |
| POST | `/api/meter-readings` | ADMIN、CASHIER | 新增或覆盖同账期记录 |

```jsonc
// POST /api/meter-readings
// prevReading 不传则自动取该房该项目上一账期读数
{ "roomId": 1, "feeItemId": 2, "period": "2026-03", "prevReading": null, "currReading": 1250.5,
  "readingDate": "2026-03-01", "remark": null }
// res.data：返回记录，含 prevReading、usageQty、unitPrice、estimatedAmount（= 用量 × 单价）
```

> 校验：读数不可为负；`currReading < prevReading` 返回 `code=1`，提示"本期读数小于上期读数，请核对"。

### 2.6 工作台与报表

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/dashboard/summary` | 工作台汇总（见下） |
| GET | `/api/reports/arrears` | 欠费报表：`communityId`、`period`、`feeItemId`、`page`、`size` |
| GET | `/api/reports/collection` | 收款汇总：`from`、`to`、`communityId`、`groupBy=day\|month\|method\|feeItem` |
| GET | `/api/reports/daily-close?date=2026-03-05` | 日结：当日各收款方式金额、笔数、合计 |

```jsonc
// GET /api/dashboard/summary?period=2026-03&communityId=1
{
  "period": "2026-03",
  "communityCount": 1, "buildingCount": 3, "roomCount": 12, "residentCount": 9,
  "receivable": 12860.00, "received": 9300.00, "arrears": 3560.00, "collectionRate": 0.7231,
  "unpaidRoomCount": 4, "advanceTotal": 186.75,
  "trend": [{ "period": "2026-01", "receivable": 12000.00, "received": 11800.00 }],
  "topArrears": [{ "roomId": 5, "roomNo": "2-201", "ownerName": "李四", "amount": 1250.00 }]
}

// GET /api/reports/arrears?period=2026-03&page=1&size=10
// data = 分页信封，list 项：
{ "roomId": 5, "roomNo": "2-201", "buildingName": "2 号楼", "ownerName": "李四", "phone": "138****0002",
  "period": "2026-03", "feeItemName": "物业管理费", "netAmount": 313.25, "paidAmount": 0, "arrears": 313.25,
  "daysOverdue": 12 }

// GET /api/reports/collection?from=2026-03-01&to=2026-03-31&groupBy=method
{ "totalAmount": 9300.00, "totalCount": 18,
  "groups": [{ "key": "WECHAT", "label": "微信", "amount": 5200.00, "count": 10 }] }
```

### 2.7 系统管理

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/users` | ADMIN | 用户列表，过滤 `keyword`、`role`、`enabled` |
| POST | `/api/users` | ADMIN | 新增用户（密码必填） |
| PUT | `/api/users/{id}` | ADMIN | 修改（密码为空则不修改） |
| POST | `/api/users/{id}/reset-password` | ADMIN | 重置为 `123456` |
| DELETE | `/api/users/{id}` | ADMIN | 停用（软删除，不物理删除；不可停用自己） |
| GET | `/api/logs` | ADMIN | 操作日志，过滤 `username`、`module`、`from`、`to` |

## 3. 错误提示约定

`message` 必须是可以直接弹给收费员看的中文，例如：

| 场景 | message |
|---|---|
| 用户名或密码错误 | 用户名或密码错误 |
| 账号被停用 | 账号已停用，请联系管理员 |
| 房号重复 | 房号 1-101 已存在 |
| 账单重复生成 | 该账期账单已存在，如需重新生成请勾选"覆盖" |
| 作废有核销的账单 | 该账单已有收款记录，请先处理对应收款单 |
| 减免后低于已收 | 减免后金额不能低于已收金额 313.25 元 |
| 删除被引用的数据 | 该楼栋下仍有房屋，无法删除 |

## 4. 二期接口

统一约定不变：`{code,message,data}` 信封、分页 `{list,total,page,size}`、角色不足 403。二期新增接口全部需要登录（除 `/api/portal/*`）。

### 4.1 账套

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/ledgers` | 全部 | 账套列表 |
| GET | `/api/ledgers/options` | 全部 | 下拉选项 |
| POST | `/api/ledgers` | ADMIN | 新建 |
| PUT | `/api/ledgers/{id}` | ADMIN | 修改 |
| DELETE | `/api/ledgers/{id}` | ADMIN | 删除（有小区归属时禁止） |

所有列表/报表接口支持可选的 `ledgerId` 过滤；不传表示全部账套。

### 4.2 资金账户与流水

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/accounts` | 全部 | 房屋资金账户列表。过滤：`communityId`、`buildingId`、`roomId`、`keyword`（房号/业主），只有余额或欠费非 0 时可用 `nonzero=true` 过滤。返回 `advanceBalance`、`depositBalance`、`arrears`、`roomNo`、`ownerName` |
| GET | `/api/accounts/{roomId}` | 全部 | 账户详情：余额 + 该户最近 50 条资金流水 |
| POST | `/api/accounts/deposit` | ADMIN/CASHIER | 收取押金 `{roomId, amount, method, paidAt?, remark}` → 增加押金余额并写流水 |
| POST | `/api/accounts/advance/use` | ADMIN/CASHIER | 预收抵扣 `{roomId, amount?, billIds?, remark}`。不传 `billIds` 时按应缴日顺序核销该户欠费账单；不传 `amount` 时用余额尽可能抵扣。返回 `usedAmount`、`remainingAdvance`、`allocations` |
| POST | `/api/accounts/refund` | ADMIN | 退款 `{roomId, accountType: 'ADVANCE'\|'DEPOSIT', amount, method, remark}`。**必须携带已通过的审批单** `approvalNo`，否则报错「退款需先提交审批」 |
| GET | `/api/fund-flows` | 全部 | 资金流水。过滤：`roomId`、`accountType`、`bizType`、`from`、`to`、`keyword` |

### 4.3 滞纳金

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/api/bills/late-fee` | ADMIN/CASHIER | 计提滞纳金 `{period, communityId?, buildingId?, feeItemIds?}`。按「逾期天数 − 宽限期」× 净额 × 日费率 计算，覆盖写入 `lateFee`。返回 `{updated, totalLateFee, skipped}` |

账单对象新增字段：`lateFee`、`netAmount`（= amount − discount + lateFee）、`lateFeeAt`。

### 4.4 银行代扣

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/bank-contracts` | 全部 | 签约列表。过滤：`roomId`、`status`、`keyword` |
| POST | `/api/bank-contracts` | ADMIN | 新增签约 `{roomId, bankName, accountName, accountNoMasked, contractNo, signedAt?, remark}` |
| PUT | `/api/bank-contracts/{id}` | ADMIN | 修改（可改 `status`） |
| DELETE | `/api/bank-contracts/{id}` | ADMIN | 解约（置 `CANCELLED`，不物理删除） |
| GET | `/api/bank-batches` | 全部 | 批次列表。过滤：`period`、`status`、`communityId` |
| POST | `/api/bank-batches/generate` | ADMIN/CASHIER | 生成报盘批次 `{period, communityId?, buildingId?, feeItemIds?}`。只取「已签约 + 该账期有欠费」的房屋，返回批次与明细 |
| GET | `/api/bank-batches/{id}` | 全部 | 批次详情（含明细） |
| GET | `/api/bank-batches/{id}/export?format=csv\|txt` | 全部 | 下载报盘文件（`Content-Disposition: attachment`）。列：`房号,户名,账号,金额(元),账期,签约号` |
| POST | `/api/bank-batches/{id}/return` | ADMIN/CASHIER | 回盘 `{fileName?, content}`（CSV 文本：`房号,金额,结果,说明`）。成功项自动登记收款并核销，失败项记原因。返回 `{success, failed, totalAmount}` |
| POST | `/api/bank-batches/{id}/close` | ADMIN | 关闭批次 |

### 4.5 催缴通知

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/notice-templates` | 全部 | 模板列表 |
| POST/PUT/DELETE | `/api/notice-templates[/{id}]` | ADMIN | 模板维护 |
| GET | `/api/notices` | 全部 | 发送记录。过滤：`channel`、`status`、`roomId`、`from`、`to`、`keyword` |
| POST | `/api/notices/send` | ADMIN/CASHIER | 发送 `{channel, templateId, billIds?, roomIds?, period?, dryRun?}`。`dryRun=true` 只返回渲染后的内容不发送。返回 `{sentCount, failedCount, notices[]}` |

未配置短信/邮件通道时走内置模拟通道（`provider = 'mock'`，状态置 `SENT`），接入真实通道实现 `services/notice-channel.js` 即可。

### 4.6 收据与发票

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/receipts` | 全部 | 列表。过滤：`roomId`、`type`、`status`、`from`、`to`、`keyword` |
| POST | `/api/receipts` | ADMIN/CASHIER | 开具 `{paymentId, type: 'RECEIPT'\|'INVOICE', title, taxNo?, amount?, remark?}`。开票金额不得超过该收款单金额，且一张收款单同类型只能开一次 |
| POST | `/api/receipts/{id}/void` | ADMIN | 作废 `{reason}` |
| GET | `/api/receipts/{id}/print` | 全部 | 返回可打印 HTML（`Content-Type: text/html; charset=utf-8`），前端新窗口打开即打印 |

### 4.7 导入导出

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| POST | `/api/import/{type}` | ADMIN | 导入 `{fileName?, content}`，`type` ∈ `rooms`、`residents`、`arrears`、`advances`。逐行校验，返回 `{total, success, failed, errors:[{line, message}]}`，并写 `wye_import_log` |
| GET | `/api/import-logs` | ADMIN | 导入记录 |
| GET | `/api/export/{type}?{filters}` | 全部 | 导出 CSV（UTF-8 带 BOM）。`type` ∈ `rooms`、`residents`、`bills`、`arrears`、`payments`、`fund-flows` |

CSV 列定义（首行表头，导入导出同名）：

- `rooms`：`小区编码,楼栋,单元,房号,楼层,面积,房屋类型,使用状态`
- `residents`：`小区编码,房号,姓名,电话,证件号,住户类型,入住日期`
- `arrears`：`小区编码,房号,收费项目编码,账期,金额,应缴日`
- `advances`：`小区编码,房号,类型,金额,备注`（类型取 `预收`/`押金`）
- `bills`：`账单号,小区,楼栋,房号,收费项目,账期,计费方式,数量,单价,金额,减免,滞纳金,应收,已收,欠费,状态,应缴日`
- `payments`：`收款单号,小区,房号,金额,方式,收款时间,操作人,已核销,预收,备注`

枚举与中文的对应关系见 `docs/data-model.md`；导入时房屋类型/住户类型等既接受中文也接受英文枚举码。

### 4.8 用户数据范围与审批

| 方法 | 路径 | 角色 | 说明 |
|---|---|---|---|
| GET | `/api/users` | ADMIN | 用户列表（新增返回 `dataScope`、`communityIds`） |
| POST/PUT | `/api/users[/{id}]` | ADMIN | 新增/修改，支持 `dataScope` 与 `communityIds: number[]` |
| GET | `/api/approvals` | 全部 | 审批单列表。过滤：`status`、`type`、`roomId`、`keyword` |
| POST | `/api/approvals` | ADMIN/CASHIER | 提交审批 `{type, billId?, roomId?, amount, payload?, reason}`。`type` ∈ `BILL_DISCOUNT`、`ADVANCE_REFUND`、`DEPOSIT_REFUND` |
| POST | `/api/approvals/{id}/approve` | ADMIN | 通过 `{remark?}` → **自动执行**对应动作（改账单减免 / 扣减余额并退款） |
| POST | `/api/approvals/{id}/reject` | ADMIN | 驳回 `{remark}` |

账单调整接口 `/api/bills/{id}` 的 `discount` 逻辑新增校验：减免金额 ≥ 100 元时，必须携带已通过的审批单 `approvalNo`，否则提示「减免 100 元及以上需先审批」。

### 4.9 业主端（免登录，移动 H5）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/portal/login` | `{roomNo, phoneSuffix}`（业主手机号后 4 位）→ `{token, room, ownerName}`，token 有效期 2 小时 |
| GET | `/api/portal/bills` | 本房账单（`Authorization: Bearer <portal token>`） |
| GET | `/api/portal/payments` | 本房缴费记录 |
| GET | `/api/portal/summary` | 汇总：欠费合计、待缴账单数、预收余额 |
| POST | `/api/portal/orders` | 创建在线支付单 `{billIds}` → `{orderNo, amount, payUrl}` |
| POST | `/api/portal/orders/{orderNo}/pay` | 模拟支付成功回调 → 生成收款单（`method=ONLINE`、`channel=PORTAL`）并核销，返回核销明细 |

门户 token 只能访问自己的房屋，越权访问其他房屋返回 403。
