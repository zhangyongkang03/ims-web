# 工单管理 API 文档（两阶段：配液 → 罐装）

> 基于 `mes_work_order`（工单计划表）+ `mes_production_batch`（生产执行批次表）两表模型。  
> 工单流程分两个阶段：**第一阶段配液**（一次性消耗全部原料） → **第二阶段罐装**（支持分批次灌装）。  
> 客户下单时选产品+数量，配方由产品自动确定（一套配方覆盖配液和罐装），无需手动选配方。

---

## 一、数据模型

### mes_recipe_detail 配方明细表（新增 phase 字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| phase | tinyint | 所属阶段：1-配液阶段（液体原料），2-罐装阶段（包材），默认1 |

> 一套配方，通过 `phase` 字段区分物料属于哪个阶段。  
> 配液阶段物料（phase=1）：水、糖浆、香精等液体原料 → 开始配液时一次性全量扣减  
> 罐装阶段物料（phase=2）：瓶子、瓶盖、标签、纸箱等包材 → 启动罐装批次时按批次数量扣减

### mes_work_order 工单计划表

| 字段 | 类型 | 说明 |
|------|------|------|
| wo_id | bigint | 主键 |
| wo_no | varchar(50) | 工单号，自动生成（WO+yyyyMMdd+4位流水） |
| p_id | bigint | 产品ID |
| customer_id | bigint | 客户ID |
| recipe_id | bigint | 关联配方ID（自动从产品默认配方获取） |
| target_qty | int | 计划生产总数量 |
| completed_qty | int | 已累计完工合格数 |
| status | tinyint | 0-待生产, 1-配液中, 2-待罐装, 3-罐装中, 4-已完成, 5-已关闭 |
| planned_start | datetime | 计划开始时间 |
| planned_end | datetime | 计划结束时间 |
| mixing_start_time | datetime | 配液开始时间 |
| mixing_end_time | datetime | 配液完成时间 |
| create_time | datetime | 创建时间 |

### mes_production_batch 罐装执行批次表

| 字段 | 类型 | 说明 |
|------|------|------|
| batch_id | bigint | 主键 |
| batch_no | varchar(50) | 批次号（唯一，自动生成） |
| wo_id | bigint | 关联工单ID |
| operator_id | bigint | 当班操作员ID |
| target_qty | int | 本批次计划灌装数量 |
| actual_qty | int | 本批次实际产出数（含不良品） |
| bad_qty | int | 本批次不良品数 |
| start_time | datetime | 本批次实际开始时间 |
| end_time | datetime | 本批次实际结束时间 |
| batch_status | tinyint | 1-运行中, 2-已停止 |
| create_time | datetime | 创建时间 |

---

## 二、工单生命周期

```
创建工单(0-待生产)
    │
    ▼
开始配液(1-配液中)  ← 一次性FEFO扣减配液原料（phase=1的物料）
    │
    ▼
完成配液(2-待罐装)
    │
    ▼
启动罐装批次(3-罐装中)  ← 按批次数量FEFO扣减包材（phase=2的物料）
    │
    ├── 报工(累加产量)
    │
    ▼
完成批次 → 全部完成?(4-已完成) / 未完成?(继续开批次)
    │
    ▼
关闭工单(5-已关闭)
```

---

## 三、API 接口

### 3.1 创建工单

```
POST /work-orders
Content-Type: application/json

{
  "pId": 1,              // 必填：产品ID
  "customerId": 5,       // 可选：客户ID
  "targetQty": 1000,     // 必填：计划产量（如1000瓶）
  "plannedStart": "2026-05-10 08:00:00",  // 可选
  "plannedEnd": "2026-05-11 18:00:00"     // 可选
}
```

> **配方自动确定**：系统自动查找该产品的默认启用配方（`mes_recipe.is_active=1`），无需手动传 `recipeId`。  
> 如果产品没有启用配方，会返回错误提示。

**响应：**
```json
{ "code": 1, "msg": "success" }
```

### 3.2 查询工单列表

```
GET /work-orders?pageNum=1&pageSize=10&searchKey=&pId=&status=
```

**响应字段说明：**
- `status`: 0-待生产, 1-配液中, 2-待罐装, 3-罐装中, 4-已完成, 5-已关闭
- `mixingStartTime` / `mixingEndTime`: 配液阶段的起止时间

### 3.3 查询工单详情

```
GET /work-orders/{woId}
```

**响应包含：**
- 工单基本信息（含产品名、客户名、配方名）
- `mixingConsumptionList`: 配液阶段的投料记录（哪些原料批次被消耗了多少）
- `batchList`: 罐装批次列表（每批次的计划/实际产量、状态等）

### 3.4 修改工单

```
PUT /work-orders
Content-Type: application/json

{
  "woId": 1,
  "pId": 2,
  "targetQty": 2000
}
```

> 仅限 **待生产(status=0)** 状态的工单可修改。

### 3.5 删除工单

```
DELETE /work-orders/{woId}
```

> 仅限 **待生产(status=0)** 状态的工单可删除。

---

## 四、第一阶段：配液

### 4.1 开始配液

```
POST /work-orders/{woId}/start-mixing
```

**业务逻辑：**
1. 校验工单状态必须为 **0-待生产**
2. 按配方筛选 **phase=1（配液阶段）** 的物料，计算全部目标产量所需的原料用量
3. 预检库存是否充足
4. **FEFO一次性投料**：按过期日期升序消耗库位库存，同步写入：
   - `mes_batch_consumption`（投料记录，batchNo = `MIX-{woNo}`）
   - `wms_inventory_transaction`（库存流水）
   - 扣减 `wms_stock_lot` 和 `mes_material_stock`
5. 工单状态变为 **1-配液中**，记录 `mixing_start_time`

> **注意**：此阶段只扣减液体原料（phase=1），包材（瓶子、瓶盖等phase=2）不在此阶段扣减。

### 4.2 完成配液

```
POST /work-orders/{woId}/complete-mixing
```

**业务逻辑：**
1. 校验工单状态必须为 **1-配液中**
2. 工单状态变为 **2-待罐装**，记录 `mixing_end_time`

---

## 五、第二阶段：罐装

### 5.1 启动罐装批次

```
POST /work-orders/{woId}/start-filling?operatorId=&batchTargetQty=
```

| 参数 | 必填 | 说明 |
|------|------|------|
| operatorId | 否 | 操作员ID，不传则取当前登录用户 |
| batchTargetQty | 否 | 本批次计划灌装数量，不传则默认剩余全部 |

**业务逻辑：**
1. 校验工单已完成配液（status=2或3）
2. 检查无运行中批次
3. 按配方筛选 **phase=2（罐装阶段）** 的包材，按本批次计划数量 **FEFO扣减包材库存**
4. 创建罐装批次记录
5. 工单状态变为 **3-罐装中**
6. 写入 Redis 生产配置（供设备监控/Flink使用）

> **注意**：每启动一个罐装批次，按该批次的 `batchTargetQty` 扣减包材（phase=2的物料），而非一次性扣完。

**响应：**
```json
{ "code": 1, "data": "B20260510143025123", "msg": "success" }
```

### 5.2 罐装批次报工

```
POST /work-orders/batches/{batchId}/report?actualQty=200&badQty=5
```

| 参数 | 必填 | 说明 |
|------|------|------|
| actualQty | 是 | 本次产出数量（含不良品） |
| badQty | 否 | 本次不良品数量，默认0 |

### 5.3 完成罐装批次

```
POST /work-orders/batches/{batchId}/complete
```

**业务逻辑：**
1. 校验实际产量 ≥ 批次计划
2. 完成批次，累加到工单 `completed_qty`
3. 若 `completed_qty ≥ target_qty` → 工单状态变为 **4-已完成**
4. 自动生成产品待入库记录
5. 清除 Redis 生产配置

---

## 六、关闭工单

```
POST /work-orders/{woId}/close
```

> 将工单状态设为 **5-已关闭**。需确保无运行中的批次。

---

## 七、典型使用流程示例

**场景：客户下单要1000瓶产品A**

```bash
# 1. 创建工单（选产品A，填1000瓶，配方自动确定）
POST /work-orders
{"pId": 1, "customerId": 5, "targetQty": 1000}

# 2. 开始配液（一次性消耗所有原料）
POST /work-orders/1/start-mixing

# 3. 配液完成
POST /work-orders/1/complete-mixing

# 4. 启动罐装（一次灌装全部1000瓶）
POST /work-orders/1/start-filling

# 5. 每灌装一批就报工
POST /work-orders/batches/1/report?actualQty=500&badQty=2
POST /work-orders/batches/1/report?actualQty=500&badQty=1

# 6. 完成罐装批次
POST /work-orders/batches/1/complete

# 7. 工单自动变为"已完成"，关闭归档
POST /work-orders/1/close
```

---

## 八、数据库迁移

执行 SQL 文件 `sql/add_work_order_phase.sql`：

```sql
-- 配方明细增加 phase 字段
ALTER TABLE mes_recipe_detail
    ADD COLUMN phase TINYINT NOT NULL DEFAULT 1 COMMENT '所属阶段：1-配液阶段, 2-罐装阶段' AFTER unit;

-- 工单增加配液时间字段
ALTER TABLE mes_work_order
    ADD COLUMN mixing_start_time DATETIME NULL COMMENT '配液开始时间' AFTER planned_end,
    ADD COLUMN mixing_end_time   DATETIME NULL COMMENT '配液完成时间' AFTER mixing_start_time;

-- 迁移已有状态数据
UPDATE mes_work_order SET status = 5 WHERE status = 3;  -- 已关闭
UPDATE mes_work_order SET status = 4 WHERE status = 2;  -- 已完成
```

