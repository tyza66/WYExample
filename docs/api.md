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
