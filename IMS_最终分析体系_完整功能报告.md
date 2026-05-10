# IMS 最终分析体系 — 完整功能报告

> 生成时间：2026-05-10  
> 版本：v3.0（全部7大分析模块完成）

---

## 📊 分析体系总览

| # | 触发时机 | 分析内容 | 范围 | 状态 |
|---|---------|---------|------|------|
| 1 | 实时/秒 | Flink 单传感器趋势预测 | 配液车间 | ✅ 已有 |
| 2 | 10 秒 | AI 综合态势分析（BRIX+PH+TEMP 打包） | 配液车间 | ✅ 已完成 |
| 3 | 批次完成 | 批次质量报告 + 两车间设备精度诊断 | 全局 | ✅ 已完成 |
| 4 | 日/周/月 | 产品生产报告 | 全局 | ✅ 已完成 |
| 5 | 日/周/月 | 设备运行报告 | 全局 | ✅ 已完成 |
| 6 | 按需 | 全流程溯源 | 全局 | ✅ 已有 |
| 7 | 实时 | 异常报警 | 全局 | ✅ 已有 |

---

## 1. 实时/秒级：Flink 单传感器趋势预测 ✅

**触发方式**：Flink 1分钟滑动窗口（10秒滑动步长），对每个传感器的原始 IoT 数据做窗口聚合  
**范围**：配液车间（BRIX 糖度 / PH 酸碱度 / TEMP 温度）  
**输出**：秒级风险预警，通过 WebSocket 实时推送前端

**关键文件**：
- `ims-analysis/src/.../IotDataProcessingJob.java` — Flink 作业
- `ims-analysis/src/.../FastRiskFunction.java` — 秒级风险评分函数（仅 PROCESS 类传感器）

---

## 2. 10秒级：AI 综合态势分析（BRIX+PH+TEMP 打包）✅ 本次改造

### 改造前
- 每个传感器独立调用 AI（10秒一次 × 3个传感器 = 3次 LLM 调用）
- AI 只看单传感器数据，无法发现跨参数关联异常

### 改造后
- **缓冲机制**：`DeviceHealthStatsConsumer` 使用 `ConcurrentHashMap` 缓冲同批次的 PROCESS 传感器数据
- **触发条件**：凑齐 ≥2 个不同类型传感器（BRIX/PH/TEMP）后一次性触发
- **综合分析**：调用 `AiDecisionService.analyzeComprehensive(List<DeviceHealthStats>)` 
- **AI 能力增强**：
  - 看到 3 个参数的【同时态势】
  - 发现跨参数关联异常（如温度升高+pH下降 = 微生物污染信号）
  - 综合评估整体工艺稳定性
- **罐装车间**：不再做 10 秒实时分析，改为批次完成后统一诊断（见 #3）

### WebSocket 推送
```json
{
  "type": "ai_comprehensive_analysis",
  "deviceCode": "MIXING_WORKSHOP",
  "processType": "MIXING_COMPREHENSIVE",
  "riskScore": 0.35,
  "riskLevel": "低风险 🟢",
  "reason": "糖度/pH/温度三参数均在正常范围内...",
  "suggestion": "配液工艺运行正常...",
  "sensorCount": 3
}
```

**修改的文件**：
| 文件 | 修改内容 |
|------|---------|
| `AiDecisionService.java` | 新增 `analyzeComprehensive(List)` 接口 |
| `AiDecisionServiceImpl.java` | 实现综合 Prompt 构建 + LLM 调用 + 兜底 |
| `DeviceHealthStatsConsumer.java` | 重写：PROCESS 缓冲+综合分析，PER_BOTTLE 跳过实时 |

---

## 3. 批次完成：自动触发质量报告 + 设备精度诊断 ✅ 本次新增

### 触发时机
`BizWorkOrderServiceImpl.completeBatch()` 执行成功后，自动异步触发

### 执行内容

#### 任务1：批次质量报告生成
- 调用已有 `BatchQualityService.generateReport(batchNo)`
- 整合 ClickHouse IoT 数据 + MySQL 工艺参数 + 报警记录
- 计算 CPK 等质量指标
- AI 生成质量摘要
- 结果缓存到 Redis（供日报钻取使用）

#### 任务2：两车间设备精度诊断
- **配液车间**：收集 BRIX/PH/TEMP 传感器，调用 `analyzeComprehensive()` 做综合诊断
- **罐装车间**：VOLUME/WEIGHT/TORQUE/PRESSURE/VISION 逐设备调用 `analyze()` 做精度评估
- 高风险(≥0.8) 自动创建维修工单

### 异步机制
- 使用 Spring `@Async` 注解
- 应用入口添加 `@EnableAsync`
- 不阻塞 `completeBatch` 主事务流程

**新建/修改的文件**：
| 文件 | 内容 |
|------|------|
| `BatchCompletionPostProcessor.java` | 接口定义 |
| `BatchCompletionPostProcessorImpl.java` | `@Async` 实现：质量报告 + 设备诊断 |
| `BizWorkOrderServiceImpl.java` | `completeBatch()` 末尾追加异步触发调用 |
| `ImsServerApplication.java` | 添加 `@EnableAsync` + `@EnableScheduling` |

---

## 4. 日/周/月：产品生产报告 ✅ 已完成

**API 端点**：
- `GET /production-report?type=DAILY&date=2026-05-09`
- `GET /production-report?type=WEEKLY&date=2026-05-09`
- `GET /production-report?type=MONTHLY&date=2026-05-09`

**报告内容**：
- 总体指标（产量/良率/不良品率）
- 产品维度分解
- 不良品工序分布
- 日趋势曲线
- 批次明细（可钻取到批次质量报告）
- AI 生成摘要和改善建议

**相关文件**：
- `ProductionReportVO.java` / `ProductionReportService.java` / `ProductionReportServiceImpl.java` / `ProductionReportController.java`

---

## 5. 日/周/月：设备运行报告 ✅ 已完成

**API 端点**：
- `GET /device-report/daily?date=2026-05-09`
- `GET /device-report/weekly?date=2026-05-09`
- `GET /device-report/monthly?date=2026-05-09`

**报告内容**：
- 日报：各设备 IoT 聚合指标 + AI 维保建议
- 周报/月报：跨天趋势 + 报警分布 + 维修统计 + AI 总结

**相关文件**：
- `DeviceDailyReportVO.java` / `DeviceReportVO.java` / `DeviceDailyReportService.java` / `DeviceDailyReportServiceImpl.java` / `DeviceDailyReportController.java`

---

## 6. 按需：全流程溯源 ✅ 已有

**API 端点**：`GET /traceability/{batchNo}/full-chain`  
**功能**：从批次号出发，追溯完整生产链路（原料批次 → 工艺参数 → 生产数据 → 质量检测 → 成品入库 → 发货）

---

## 7. 实时：异常报警 ✅ 已有

**触发方式**：Flink 秒级检测 → Kafka `ims_alarm_events` → `AlarmEventConsumer` → WebSocket 推送  
**逻辑**：
- PROCESS 传感器：纯报警通知
- PER_BOTTLE 传感器：同时累加批次不良品计数

---

## 🏗️ 架构数据流

```
传感器 IoT 数据流
    │
    ▼
[Flink] 1分钟滑动窗口(10s步长)
    │                          │
    ▼                          ▼
秒级风险预测               ims_device_health_stats (Kafka)
(仅配液PROCESS)                │
    │                          ▼
    ▼               DeviceHealthStatsConsumer
WebSocket                     │
推送前端            ┌─────────┴─────────┐
                   │                     │
              PROCESS传感器          PER_BOTTLE传感器
              (BRIX/PH/TEMP)        (VOLUME/WEIGHT/...)
                   │                     │
              缓冲凑齐≥2个           跳过实时分析
                   │                     │
                   ▼                     │
          analyzeComprehensive()         │
          (综合态势分析)                  │
                   │                     │
                   ▼                     │
              WebSocket推送              │
              ai_comprehensive_analysis  │
                                         │
                   ┌─────────────────────┘
                   ▼
            批次完成 completeBatch()
                   │
                   ▼ (@Async)
         BatchCompletionPostProcessor
                   │
          ┌────────┴────────┐
          │                  │
    批次质量报告         设备精度诊断
    (ClickHouse+AI)     (两车间全设备)
          │                  │
          ▼                  ▼
     Redis缓存          AI分析记录
     (供日报钻取)        (高风险自动建单)
```

---

## 📁 本次改造涉及的文件清单

### 新建文件
| 文件 | 说明 |
|------|------|
| `service/biz/BatchCompletionPostProcessor.java` | 批次完成后处理器接口 |
| `service/impl/biz/BatchCompletionPostProcessorImpl.java` | 异步实现：质量报告 + 设备诊断 |
| `entity/MesReport.java` | 报告持久化实体（对应 `mes_report` 表） |
| `mapper/MesReportMapper.java` | 报告 Mapper |
| `service/base/MesReportService.java` | 报告基础 Service |
| `service/impl/base/MesReportServiceImpl.java` | 报告基础 Service 实现 |
| `service/biz/ReportPersistService.java` | 报告持久化业务接口 |
| `service/impl/biz/ReportPersistServiceImpl.java` | 报告持久化实现（Redis缓存 + MySQL永久存储） |
| `sql/create_mes_report.sql` | 建表 SQL |

### 修改文件
| 文件 | 修改点 |
|------|--------|
| `ImsServerApplication.java` | 添加 `@EnableAsync` + `@EnableScheduling` |
| `service/biz/AiDecisionService.java` | 新增 `analyzeComprehensive(List)` 方法 |
| `service/impl/biz/AiDecisionServiceImpl.java` | 实现综合态势分析（~150行代码） |
| `kafka/DeviceHealthStatsConsumer.java` | 重写：PROCESS 缓冲+综合分析，PER_BOTTLE 跳过 |
| `service/impl/biz/BizWorkOrderServiceImpl.java` | `completeBatch()` 追加异步后处理触发 |
| `service/impl/biz/BatchQualityServiceImpl.java` | 增加 DB 持久化读写 |
| `service/impl/biz/ProductionReportServiceImpl.java` | 增加 DB 持久化读写 |
| `service/impl/biz/DeviceDailyReportServiceImpl.java` | 增加 DB 持久化读写（日报/周报/月报） |

---

## 💾 报告存储策略

所有报告采用 **双层存储**：Redis 快速缓存 + MySQL 永久持久化。

### `mes_report` 表结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `report_id` | BIGINT AUTO_INCREMENT | 主键 |
| `report_type` | VARCHAR(32) | 报告类型 |
| `report_key` | VARCHAR(64) | 唯一键(批次号/日期) |
| `report_title` | VARCHAR(200) | 报告标题 |
| `report_data` | JSON | 完整报告数据 |
| `ai_summary` | TEXT | AI 摘要(便于搜索) |
| `generate_time` | DATETIME | 生成时间 |
| `create_time` | DATETIME | 创建时间 |

唯一索引: `(report_type, report_key)`

### 存储的报告类型

| report_type | report_key 示例 | 说明 |
|-------------|----------------|------|
| `BATCH_QUALITY` | `B20260510001` | 批次质量报告 |
| `PRODUCTION_DAILY` | `2026-05-10` | 生产日报 |
| `PRODUCTION_WEEKLY` | `2026-05-04` | 生产周报(周一日期) |
| `PRODUCTION_MONTHLY` | `2026-05-01` | 生产月报(月初日期) |
| `DEVICE_DAILY` | `2026-05-10` | 设备日报 |
| `DEVICE_WEEKLY` | `2026-05-04` | 设备周报(周一日期) |
| `DEVICE_MONTHLY` | `2026-05-01` | 设备月报(月初日期) |

### AI 分析记录存储（已有）

| 表 | 内容 |
|----|------|
| `mes_ai_analysis_record` | 10s综合分析 + 批次完成设备诊断结果 |
| `mes_decision_log` | 决策日志（含规则/AI/兜底决策详情） |

### 读取优先级

```
Redis 缓存 → MySQL mes_report → 重新生成(并存入两层)
```

