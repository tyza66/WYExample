# WYE 数据模型

> 所有表以 `wye_` 为前缀。实现见 [`wye-server/prisma/schema.prisma`](../wye-server/prisma/schema.prisma)，本文档描述逻辑模型
> （下方表格里的 `varchar` / `bigint` / `decimal` 等为逻辑类型，SQLite 下的实际映射以 schema 为准）。
> 金额字段一律用 Prisma `Decimal` 存储与运算，禁止用浮点累加；公共字段 `id` 自增主键、`created_at`、`updated_at`（`updated_at` 由 `@updatedAt` 自动维护）。

## 1. 表清单

| 表 | 说明 | 一期 |
|---|---|---|
| `wye_user` | 系统用户 | ✅ |
| `wye_community` | 小区 | ✅ |
| `wye_building` | 楼栋 | ✅ |
| `wye_room` | 房屋 / 商铺 / 车位 | ✅ |
| `wye_resident` | 住户 | ✅ |
| `wye_fee_item` | 收费项目 | ✅ |
| `wye_bill` | 应收账单 | ✅ |
| `wye_payment` | 收款单 | ✅ |
| `wye_payment_allocation` | 收款核销明细 | ✅ |
| `wye_meter_reading` | 水电抄表 | ✅ |
| `wye_operation_log` | 操作日志 | ✅ |
| `wye_sequence` | 单据号序列（账单号/收款单号） | ✅ |

**不建表的派生数据：** 欠费、预收余额、收缴率均由账单与收款实时计算，避免对账口径分叉。

## 2. 字段定义

### 2.1 wye_user 用户

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| username | varchar(50) | 唯一，非空 | 登录名 |
| password | varchar(100) | 非空 | BCrypt 哈希，禁止明文 |
| real_name | varchar(50) | 非空 | 姓名 |
| role | varchar(20) | 非空 | `ADMIN` 管理员 / `CASHIER` 收费员 / `VIEWER` 只读 |
| phone | varchar(20) | | 手机号 |
| enabled | tinyint(1) | 默认 1 | 停用后不可登录 |
| remark | varchar(255) | | |

### 2.2 wye_community 小区

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| name | varchar(100) | 非空 | 小区名称 |
| code | varchar(50) | 唯一 | 小区编码 |
| address | varchar(255) | | 地址 |
| manager | varchar(50) | | 物业负责人 |
| phone | varchar(20) | | 联系电话 |
| remark | varchar(255) | | |

### 2.3 wye_building 楼栋

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| community_id | bigint | 非空，外键 | 所属小区 |
| name | varchar(50) | 非空 | 例：1 号楼 |
| unit_count | int | 默认 1 | 单元数 |
| remark | varchar(255) | | |

### 2.4 wye_room 房屋

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| community_id | bigint | 非空，外键 | 所属小区 |
| building_id | bigint | 非空，外键 | 所属楼栋 |
| unit | varchar(20) | | 单元，如 `1` |
| room_no | varchar(50) | 非空 | 房号，如 `1-101`；**同一小区内唯一** |
| floor | int | | 楼层 |
| area | decimal(10,2) | | 建筑面积，车位可为 0 |
| room_type | varchar(20) | 非空 | `RESIDENCE` 住宅 / `SHOP` 商铺 / `OFFICE` 办公 / `PARKING` 车位 |
| status | varchar(20) | 非空 | `VACANT` 空置 / `OCCUPIED` 自住 / `RENTED` 出租 |
| remark | varchar(255) | | |

### 2.5 wye_resident 住户

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| room_id | bigint | 非空，外键 | 所属房屋 |
| name | varchar(50) | 非空 | 姓名 |
| phone | varchar(20) | | 联系电话 |
| id_card | varchar(50) | | 证件号，**接口返回时脱敏**（保留前 6 后 4） |
| resident_type | varchar(20) | 非空 | `OWNER` 业主 / `TENANT` 租户 / `FAMILY` 家属 |
| start_date / end_date | date | | 居住起止 |
| status | varchar(20) | 非空 | `LIVING` 在住 / `MOVED_OUT` 已迁出 |
| remark | varchar(255) | | |

### 2.6 wye_fee_item 收费项目

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| name | varchar(50) | 非空 | 例：物业管理费 |
| code | varchar(50) | 唯一 | 项目编码 |
| type | varchar(20) | 非空 | `PROPERTY` 物业费 / `WATER` 水费 / `ELECTRIC` 电费 / `PARKING` 车位费 / `OTHER` 其他 |
| charge_mode | varchar(20) | 非空 | `AREA` 按面积 / `UNIT` 按户 / `METER` 按用量 / `FIXED` 固定金额 |
| unit_price | decimal(12,4) | 非空 | 单价，`METER` 时水/电按用量单价 |
| price_unit | varchar(20) | | 展示单位：`元/㎡`、`元/户`、`元/度`、`元/月` |
| period | varchar(20) | 非空 | `MONTHLY` 月 / `QUARTERLY` 季 / `YEARLY` 年 / `ONCE` 一次性 |
| community_id | bigint | 可空 | 为空表示全局项目，否则仅该小区可用 |
| enabled | tinyint(1) | 默认 1 | 停用后不参与账单生成 |
| sort_no | int | 默认 0 | 排序 |

### 2.7 wye_bill 账单

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| bill_no | varchar(40) | 唯一，非空 | 账单号，规则 `B + yyyyMM + 6 位流水` |
| community_id / room_id / fee_item_id | bigint | 非空 | 关联 |
| period | varchar(10) | 非空 | 账期 `yyyy-MM` |
| charge_mode | varchar(20) | 非空 | 生成时快照，便于追溯 |
| quantity | decimal(12,2) | 非空 | 计费数量（面积/用量/1） |
| unit_price | decimal(12,4) | 非空 | 单价快照 |
| amount | decimal(12,2) | 非空 | 应收金额 = quantity × unit_price |
| discount | decimal(12,2) | 默认 0 | 减免金额 |
| paid_amount | decimal(12,2) | 默认 0 | 已核销金额 |
| status | varchar(20) | 非空 | `UNPAID` / `PARTIAL` / `PAID` / `VOID` |
| due_date | date | | 应缴截止日，**核销顺序按它升序** |
| generated_at | datetime | | 生成时间 |
| remark / void_reason | varchar(255) | | 作废必须填原因 |

**唯一性约束：** 同一 `(房屋, 收费项目, 账期)` 最多只能有一条**非作废**账单。这条由应用层校验（`services/billing.js`），
不在数据库上建唯一索引——否则作废的账单会一直占着位置，导致该账期无法重新生成。`bill_no` 本身是唯一索引。

### 2.8 wye_payment 收款单

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| payment_no | varchar(40) | 唯一，非空 | 收款单号 `P + yyyyMMdd + 6 位流水` |
| community_id / room_id | bigint | 非空 | 关联 |
| amount | decimal(12,2) | 非空，> 0 | 收款总额 |
| method | varchar(20) | 非空 | `CASH` / `WECHAT` / `ALIPAY` / `BANK_TRANSFER` / `POS` / `BANK_DEDUCT` |
| paid_at | datetime | 非空 | 收款时间 |
| operator | varchar(50) | 非空 | 经办人（登录用户名） |
| remark | varchar(255) | | |

### 2.9 wye_payment_allocation 核销明细

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| payment_id | bigint | 非空，外键 | 收款单 |
| bill_id | bigint | 非空，外键 | 被核销账单 |
| amount | decimal(12,2) | 非空，> 0 | 本次核销金额 |

### 2.10 wye_meter_reading 抄表

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| room_id | bigint | 非空 | 房屋 |
| fee_item_id | bigint | 非空 | 水/电项目 |
| period | varchar(10) | 非空 | 账期 |
| prev_reading / curr_reading | decimal(12,2) | 非空 | 上期/本期读数，均不可为负 |
| usage_qty | decimal(12,2) | 非空 | 用量 = 本期 − 上期，**不可为负** |
| reading_date | date | | 抄表日期 |
| operator | varchar(50) | | 抄表人 |
| remark | varchar(255) | | |

**唯一性约束：** `(room_id, fee_item_id, period)` 唯一。

### 2.11 wye_operation_log 操作日志

| 字段 | 类型 | 说明 |
|---|---|---|
| username | varchar(50) | 操作人 |
| module | varchar(50) | 模块，如 `账单` |
| action | varchar(50) | 动作，如 `作废` |
| target | varchar(100) | 对象标识，如账单号 |
| detail | varchar(1000) | 变更内容摘要 |
| ip | varchar(50) | 来源 IP |

## 3. 业务规则

1. **账单生成**：给定 `小区(可选) + 楼栋(可选) + 账期 + 收费项目(可多选，默认全部启用项目)`，对范围内每个房屋 × 每个适用收费项目生成账单。
   - `AREA` → 数量 = 房屋面积；`UNIT` → 1；`FIXED` → 1；`METER` → 取该房该账期的抄表用量，**无抄表记录则跳过并计入 `skipped` 原因**。
   - 金额 = 数量 × 单价，四舍五入保留 2 位。
   - 已存在同 `(房屋, 项目, 账期)` 的有效账单则跳过；`overwrite=true` 时先作废旧账单再生成。
   - 返回 `{generated, skipped, totalAmount}`。
2. **收款核销**：收款金额按顺序核销该房屋的未结清账单（`UNPAID`、`PARTIAL`）。
   - 顺序：`due_date` 升序，`due_date` 为空排在最后，其次按 `id` 升序。
   - `billIds` 非空时只核销指定账单，按传入顺序。
   - 单张账单本次核销额 = min(剩余欠费, 剩余可核销金额)。
   - 核销后更新账单 `paid_amount` 与 `status`；金额未用完的部分作为**预收余额**挂在该收款单上（不建表，实时计算）。
3. **账单作废**：`status = VOID`，必须填 `void_reason`，作废账单不再计入应收、不参与核销；其已核销金额需先冲销（一期限制：**有核销记录的账单不允许作废**，提示先处理收款）。
4. **账单调整**：仅允许修改 `discount`（减免）与 `due_date`，修改须填 `remark`；应收净额 = `amount − discount`，不得低于 `paid_amount`。
5. **金额口径**：某账期 **应收 = Σ(amount − discount)**，**实收 = Σ(paid_amount)**，**欠费 = 应收 − 实收**，**收缴率 = 实收 ÷ 应收**（应收为 0 时按 100% 处理）。所有报表口径必须与账单列表一致。
6. **数据权限**：`ADMIN` 全部；`CASHIER` 可读全部基础资料、可生成账单、可收款、可抄表，不可删基础资料、不可管理用户；`VIEWER` 只读。写操作全部记 `wye_operation_log`。
