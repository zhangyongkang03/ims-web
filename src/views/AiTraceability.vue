<template>
  <div class="container">
    <el-card class="box-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>全流程溯源</span>
        </div>
      </template>

      <el-tabs v-model="activeTab" class="trace-tabs">
        <el-tab-pane label="反向溯源" name="backward">
          <div class="toolbar">
            <el-input
              v-model="backwardForm.batchNo"
              clearable
              placeholder="请输入成品批次号，如 B202605010001"
              class="search-input"
              @keyup.enter="handleSearch('backward')"
            />
            <el-button type="primary" :loading="loading" @click="handleSearch('backward')">
              查询链路
            </el-button>
          </div>
          <div class="toolbar-tip">
            用于追溯某个成品批次的产品、工单、配方、投料批次、质量事件与 AI 风险记录。
          </div>
        </el-tab-pane>

        <el-tab-pane label="正向溯源" name="forward">
          <div class="toolbar">
            <el-input
              v-model="forwardForm.lotNo"
              clearable
              placeholder="请输入原料批次号，如 INM202605010001"
              class="search-input"
              @keyup.enter="handleSearch('forward')"
            />
            <el-button type="primary" :loading="loading" @click="handleSearch('forward')">
              查询链路
            </el-button>
          </div>
          <div class="toolbar-tip">用于追踪某个原料批次流向的受影响生产批次与产品去向。</div>
        </el-tab-pane>
      </el-tabs>

      <el-alert
        v-if="loading"
        type="info"
        show-icon
        :closable="false"
        class="loading-tip"
        title="正在加载溯源链路，请稍候..."
      />

      <el-empty v-if="!hasSearched && !loading" description="输入批次号后开始全链路溯源" />

      <div v-else-if="structuredTrace" class="result-wrap">
        <div class="summary-grid">
          <el-card shadow="never" class="summary-card">
            <div class="summary-label">查询方向</div>
            <div class="summary-value">{{ directionText }}</div>
          </el-card>
          <el-card shadow="never" class="summary-card">
            <div class="summary-label">追溯单号</div>
            <div class="summary-value summary-value-code">
              {{ structuredTrace.traceKey || '-' }}
            </div>
          </el-card>
          <el-card shadow="never" class="summary-card">
            <div class="summary-label">追溯时间</div>
            <div class="summary-value summary-value-time">
              {{ structuredTrace.traceTime || '-' }}
            </div>
          </el-card>
          <el-card shadow="never" class="summary-card">
            <div class="summary-label">异常事件</div>
            <div class="summary-value">{{ structuredTrace.qualityEvents.length }}</div>
          </el-card>
        </div>

        <el-card v-if="isBackwardTrace" shadow="never" class="section-card">
          <template #header>
            <span>链路概览</span>
          </template>
          <div class="overview-tags">
            <el-tag class="overview-tag"
              >原料批次 {{ structuredTrace.consumptionList.length }}</el-tag
            >
            <el-tag class="overview-tag" type="success"
              >工序参数 {{ structuredTrace.processSummaryList.length }}</el-tag
            >
            <el-tag class="overview-tag" type="danger"
              >质量告警 {{ structuredTrace.qualityEvents.length }}</el-tag
            >
            <el-tag class="overview-tag" type="warning"
              >AI 风险 {{ filteredAiRiskRecords.length }}</el-tag
            >
            <el-tag class="overview-tag" type="info">配方物料 {{ recipeItems.length }}</el-tag>
            <el-tag v-if="productDestinations.length" class="overview-tag" effect="plain"
              >成品去向 {{ productDestinations.length }}</el-tag
            >
          </div>
          <el-timeline class="overview-timeline">
            <el-timeline-item type="primary">
              <strong>成品批次</strong>
              <div>{{ structuredTrace.batchInfo?.batchNo || structuredTrace.traceKey || '-' }}</div>
            </el-timeline-item>
            <el-timeline-item type="success">
              <strong>工单 / 配方</strong>
              <div>
                {{ structuredTrace.workOrderInfo?.woNo || '-' }} /
                {{ structuredTrace.recipeInfo?.recipeName || '-' }}
              </div>
            </el-timeline-item>
            <el-timeline-item type="warning">
              <strong>投料批次</strong>
              <div>共 {{ structuredTrace.consumptionList.length }} 个原料批次参与生产</div>
            </el-timeline-item>
            <el-timeline-item type="danger">
              <strong>质量事件与 AI 风险</strong>
              <div>
                告警 {{ structuredTrace.qualityEvents.length }} 条，AI 风险
                {{ filteredAiRiskRecords.length }} 条
              </div>
            </el-timeline-item>
            <el-timeline-item v-if="productDestinations.length" type="info">
              <strong>成品去向</strong>
              <div>共 {{ productDestinations.length }} 条出库流向记录</div>
            </el-timeline-item>
          </el-timeline>
        </el-card>

        <el-row v-if="isBackwardTrace" :gutter="12" class="section-row">
          <el-col :xs="24" :xl="12">
            <el-card shadow="never" class="section-card full-height">
              <template #header>
                <span>产品信息</span>
              </template>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="产品名称">{{
                  structuredTrace.productInfo?.pname || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="产品编码">{{
                  structuredTrace.productInfo?.pcode || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="产品ID">{{
                  structuredTrace.productInfo?.pid || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="规格">{{ productSpecText }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>

          <el-col :xs="24" :xl="12">
            <el-card shadow="never" class="section-card full-height">
              <template #header>
                <div class="section-header-action">
                  <span>批次信息</span>
                  <el-button
                    v-if="currentTraceBatchNo"
                    link
                    type="primary"
                    @click="goBatchQuality(currentTraceBatchNo)"
                  >
                    查看质量报告
                  </el-button>
                </div>
              </template>
              <el-descriptions :column="2" border>
                <el-descriptions-item label="批次号">{{
                  structuredTrace.batchInfo?.batchNo || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag>{{ structuredTrace.batchInfo?.statusLabel || '-' }}</el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="计划产量">{{
                  formatValue(structuredTrace.batchInfo?.targetQty)
                }}</el-descriptions-item>
                <el-descriptions-item label="实际产量">{{
                  formatValue(structuredTrace.batchInfo?.actualQty)
                }}</el-descriptions-item>
                <el-descriptions-item label="不良品">{{
                  formatValue(structuredTrace.batchInfo?.badQty)
                }}</el-descriptions-item>
                <el-descriptions-item label="良率">{{
                  formatPercent(structuredTrace.batchInfo?.yieldRate)
                }}</el-descriptions-item>
                <el-descriptions-item label="开始时间">{{
                  structuredTrace.batchInfo?.startTime || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="结束时间">{{
                  structuredTrace.batchInfo?.endTime || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="生产时长">{{
                  formatDuration(structuredTrace.batchInfo?.durationMinutes)
                }}</el-descriptions-item>
              </el-descriptions>
            </el-card>
          </el-col>
        </el-row>

        <el-card v-if="isBackwardTrace" shadow="never" class="section-card">
          <template #header>
            <span>工单与配方</span>
          </template>
          <el-row :gutter="12">
            <el-col :xs="24" :xl="10">
              <el-descriptions :column="1" border>
                <el-descriptions-item label="工单号">{{
                  structuredTrace.workOrderInfo?.woNo || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="工单状态">{{
                  structuredTrace.workOrderInfo?.statusLabel || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="工单目标产量">{{
                  formatValue(structuredTrace.workOrderInfo?.targetQty)
                }}</el-descriptions-item>
                <el-descriptions-item label="已完成产量">{{
                  formatValue(structuredTrace.workOrderInfo?.completedQty)
                }}</el-descriptions-item>
                <el-descriptions-item label="计划开始">{{
                  structuredTrace.workOrderInfo?.plannedStart || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="计划结束">{{
                  structuredTrace.workOrderInfo?.plannedEnd || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="配方名称">{{
                  structuredTrace.recipeInfo?.recipeName || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="配方编码">{{
                  structuredTrace.recipeInfo?.recipeCode || '-'
                }}</el-descriptions-item>
                <el-descriptions-item label="配方基础单位">{{
                  recipeBaseLabel
                }}</el-descriptions-item>
                <el-descriptions-item label="当前批次目标产量">{{
                  formatValue(structuredTrace.recipeInfo?.batchTargetQty)
                }}</el-descriptions-item>
              </el-descriptions>
            </el-col>
            <el-col :xs="24" :xl="14">
              <el-alert
                type="info"
                show-icon
                :closable="false"
                class="recipe-tip"
                :title="recipeUsageTip"
              />
              <el-table :data="recipeItems" stripe border style="width: 100%">
                <el-table-column prop="materialName" label="物料名称" min-width="140" />
                <el-table-column prop="materialCode" label="物料编码" min-width="140" />
                <el-table-column :label="recipeQtyColumnLabel" width="170">
                  <template #default="{ row }">{{ formatValue(row.standardQty) }}</template>
                </el-table-column>
                <el-table-column prop="unit" label="单位" width="90" />
              </el-table>
            </el-col>
          </el-row>
        </el-card>

        <el-card v-if="isBackwardTrace" shadow="never" class="section-card">
          <template #header>
            <span>投料批次明细</span>
          </template>
          <el-table :data="structuredTrace.consumptionList" stripe border style="width: 100%">
            <el-table-column prop="lotNo" label="原料批次号" min-width="180" />
            <el-table-column prop="materialName" label="物料名称" min-width="120" />
            <el-table-column prop="materialCode" label="物料编码" min-width="120" />
            <el-table-column label="投料数量" width="120">
              <template #default="{ row }">{{ quantityText(row.consumeQty, row.uom) }}</template>
            </el-table-column>
            <el-table-column prop="supplierName" label="供应商" min-width="140" />
            <el-table-column prop="feedTime" label="投料时间" min-width="150" />
            <el-table-column prop="arrivalTime" label="到货时间" min-width="150" />
            <el-table-column prop="expiryDate" label="有效期" min-width="120" />
          </el-table>
        </el-card>

        <el-card
          v-if="isBackwardTrace && productDestinations.length"
          shadow="never"
          class="section-card"
        >
          <template #header>
            <span>成品去向</span>
          </template>
          <el-table :data="productDestinations" stripe border style="width: 100%">
            <el-table-column prop="shipNo" label="出库单号" min-width="180" />
            <el-table-column prop="customerName" label="客户名称" min-width="160" />
            <el-table-column label="出库数量" width="140">
              <template #default="{ row }">{{
                quantityText(row.quantity, structuredTrace.productInfo?.unit)
              }}</template>
            </el-table-column>
            <el-table-column prop="shipTime" label="出库时间" min-width="160" />
          </el-table>
        </el-card>

        <el-row v-if="isBackwardTrace" :gutter="12" class="section-row">
          <el-col :xs="24" :xl="14">
            <el-card shadow="never" class="section-card full-height">
              <template #header>
                <span>工序质量汇总</span>
              </template>
              <el-table
                :data="structuredTrace.processSummaryList"
                stripe
                border
                style="width: 100%"
              >
                <el-table-column prop="processName" label="工序" min-width="110" />
                <el-table-column prop="parameterName" label="参数" min-width="100" />
                <el-table-column label="均值" width="90">
                  <template #default="{ row }">{{ formatValue(row.mean, 4) }}</template>
                </el-table-column>
                <el-table-column label="标准差" width="100">
                  <template #default="{ row }">{{ formatValue(row.stdDev, 4) }}</template>
                </el-table-column>
                <el-table-column label="最小值" width="90">
                  <template #default="{ row }">{{ formatValue(row.minVal, 2) }}</template>
                </el-table-column>
                <el-table-column label="最大值" width="90">
                  <template #default="{ row }">{{ formatValue(row.maxVal, 2) }}</template>
                </el-table-column>
                <el-table-column label="超标率" width="100">
                  <template #default="{ row }">
                    <span :class="outOfRangeClass(row.outOfRangeRate)">{{
                      formatPercent(row.outOfRangeRate)
                    }}</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>

          <el-col :xs="24" :xl="10">
            <el-card shadow="never" class="section-card full-height">
              <template #header>
                <span>AI 风险摘要</span>
              </template>
              <el-empty
                v-if="!filteredAiRiskRecords.length"
                description="暂无 AI 风险记录"
                :image-size="80"
              />
              <el-timeline v-else>
                <el-timeline-item
                  v-for="(item, index) in filteredAiRiskRecords"
                  :key="`${item.deviceCode}-${index}`"
                  :type="riskTimelineType(item.riskScore)"
                >
                  <div class="timeline-head">
                    <strong>{{ item.deviceCode }}</strong>
                    <el-tag :type="riskTagType(item.riskScore)">{{ item.riskLevel || '-' }}</el-tag>
                  </div>
                  <div class="timeline-meta">风险分 {{ formatRiskScore(item.riskScore) }}</div>
                  <div class="timeline-meta">分析时间 {{ item.analysisTime || '-' }}</div>
                  <div class="reason-text">{{ item.reason || '-' }}</div>
                </el-timeline-item>
              </el-timeline>
            </el-card>
          </el-col>
        </el-row>

        <el-row v-if="isBackwardTrace" :gutter="12" class="section-row">
          <el-col :xs="24" :xl="14">
            <el-card shadow="never" class="section-card full-height">
              <template #header>
                <span>质量事件</span>
              </template>
              <el-table
                :data="structuredTrace.qualityEvents"
                stripe
                border
                style="width: 100%"
                max-height="420"
              >
                <el-table-column prop="deviceCode" label="设备编码" min-width="110" />
                <el-table-column label="等级" width="100">
                  <template #default="{ row }">
                    <el-tag :type="alarmTagType(row.alarmLevel)">{{
                      row.alarmLevel || '-'
                    }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="当前值" width="100">
                  <template #default="{ row }">{{ formatValue(row.currentValue, 2) }}</template>
                </el-table-column>
                <el-table-column prop="standardRange" label="标准范围" min-width="160" />
                <el-table-column
                  prop="alarmMsg"
                  label="告警信息"
                  min-width="260"
                  show-overflow-tooltip
                />
                <el-table-column prop="createTime" label="发生时间" min-width="140" />
              </el-table>
            </el-card>
          </el-col>

          <el-col :xs="24" :xl="10">
            <el-card shadow="never" class="section-card full-height">
              <template #header>
                <span>原始响应</span>
              </template>
              <pre class="raw-json">{{ rawPreview }}</pre>
            </el-card>
          </el-col>
        </el-row>

        <el-card v-if="hasForwardSections" shadow="never" class="section-card">
          <template #header>
            <span>正向链路扩展信息</span>
          </template>
          <el-row :gutter="12" class="section-row">
            <el-col :xs="24" :xl="8">
              <el-card shadow="never" class="sub-card full-height">
                <template #header>
                  <span>原料批次信息</span>
                </template>
                <el-descriptions v-if="materialLotInfo" :column="1" border>
                  <el-descriptions-item label="原料批次号">{{
                    materialLotInfo.lotNo || '-'
                  }}</el-descriptions-item>
                  <el-descriptions-item label="物料名称">{{
                    materialLotInfo.materialName || '-'
                  }}</el-descriptions-item>
                  <el-descriptions-item label="物料编码">{{
                    materialLotInfo.materialCode || '-'
                  }}</el-descriptions-item>
                  <el-descriptions-item label="到货数量">{{
                    quantityText(materialLotInfo.arrivalQty, materialLotInfo.unit)
                  }}</el-descriptions-item>
                  <el-descriptions-item label="供应商">{{
                    materialLotInfo.supplierName || '-'
                  }}</el-descriptions-item>
                  <el-descriptions-item label="到货时间">{{
                    materialLotInfo.arrivalTime || '-'
                  }}</el-descriptions-item>
                  <el-descriptions-item label="有效期">{{
                    materialLotInfo.expiryDate || '-'
                  }}</el-descriptions-item>
                </el-descriptions>
                <el-empty v-else description="暂无原料批次信息" :image-size="80" />
              </el-card>
            </el-col>
            <el-col :xs="24" :xl="16">
              <el-card shadow="never" class="sub-card full-height">
                <template #header>
                  <span>受影响批次</span>
                </template>
                <el-table
                  v-if="affectedBatches.length"
                  :data="affectedBatches"
                  stripe
                  border
                  style="width: 100%"
                  max-height="420"
                >
                  <el-table-column prop="batchNo" label="成品批次号" min-width="170" />
                  <el-table-column prop="productName" label="产品名称" min-width="120" />
                  <el-table-column prop="woNo" label="工单号" min-width="150" />
                  <el-table-column label="实际产量" width="110">
                    <template #default="{ row }">{{ formatValue(row.actualQty) }}</template>
                  </el-table-column>
                  <el-table-column label="不良数量" width="110">
                    <template #default="{ row }">{{ formatValue(row.badQty) }}</template>
                  </el-table-column>
                  <el-table-column label="良率" width="100">
                    <template #default="{ row }">{{ formatPercent(row.yieldRate) }}</template>
                  </el-table-column>
                  <el-table-column label="消耗数量" width="130">
                    <template #default="{ row }">{{
                      quantityText(row.consumeQty, row.uom)
                    }}</template>
                  </el-table-column>
                  <el-table-column prop="startTime" label="开始时间" min-width="150" />
                  <el-table-column prop="endTime" label="结束时间" min-width="150" />
                  <el-table-column label="操作" width="120" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="goBatchQuality(row.batchNo)">
                        质量报告
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-else description="暂无受影响批次" :image-size="80" />
              </el-card>
            </el-col>
          </el-row>

          <el-card
            v-if="productDestinations.length"
            shadow="never"
            class="sub-card destinations-card"
          >
            <template #header>
              <span>产品去向</span>
            </template>
            <el-table :data="productDestinations" stripe border style="width: 100%">
              <el-table-column prop="shipNo" label="出库单号" min-width="180" />
              <el-table-column prop="customerName" label="客户名称" min-width="160" />
              <el-table-column label="出库数量" width="140">
                <template #default="{ row }">{{
                  quantityText(row.quantity, structuredTrace.productInfo?.unit)
                }}</template>
              </el-table-column>
              <el-table-column prop="shipTime" label="出库时间" min-width="160" />
            </el-table>
          </el-card>
        </el-card>
      </div>

      <div v-else-if="hasSearched && !loading" class="empty-result">
        <el-empty description="接口已返回，但未识别出结构化溯源数据" />
        <el-card shadow="never" class="section-card raw-card">
          <template #header>
            <span>原始响应</span>
          </template>
          <pre class="raw-json">{{ rawPreview }}</pre>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {
  getBackwardTraceability,
  getForwardTraceability,
  type TraceDirection,
  type TraceabilityAffectedBatch,
  type TraceabilityAiRiskRecord,
  type TraceabilityMaterialLotInfo,
  type TraceabilityProcessSummaryItem,
  type TraceabilityProductDestination,
  type TraceabilityRecipeItem,
  type TraceabilityResponseRaw,
  type TraceabilityStructuredData,
} from '@/api/traceability'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const hasSearched = ref(false)
const activeTab = ref<TraceDirection>('backward')
const activeDirection = ref<TraceDirection>('backward')
const backwardForm = reactive({ batchNo: '' })
const forwardForm = reactive({ lotNo: '' })
const rawResult = ref<TraceabilityResponseRaw>(null)

const structuredTrace = computed<TraceabilityStructuredData | null>(() => {
  const source = rawResult.value
  if (!isRecord(source) || !('traceKey' in source) || !('direction' in source)) {
    return null
  }
  return {
    direction: readString(source.direction),
    traceKey: readString(source.traceKey),
    traceTime: readString(source.traceTime),
    productInfo: asRecord(source.productInfo) as TraceabilityStructuredData['productInfo'],
    batchInfo: asRecord(source.batchInfo) as TraceabilityStructuredData['batchInfo'],
    workOrderInfo: asRecord(source.workOrderInfo) as TraceabilityStructuredData['workOrderInfo'],
    recipeInfo: normalizeRecipeInfo(source.recipeInfo),
    consumptionList: normalizeRecordArray<TraceabilityStructuredData['consumptionList'][number]>(
      source.consumptionList,
    ),
    processSummaryList: normalizeRecordArray<
      TraceabilityStructuredData['processSummaryList'][number]
    >(source.processSummaryList),
    qualityEvents: normalizeRecordArray<TraceabilityStructuredData['qualityEvents'][number]>(
      source.qualityEvents,
    ),
    aiRiskRecords: normalizeRecordArray<TraceabilityStructuredData['aiRiskRecords'][number]>(
      source.aiRiskRecords,
    ),
    productDestinations: normalizeRecordArray<TraceabilityProductDestination>(
      source.productDestinations,
    ),
    materialLotInfo: normalizeMaterialLotInfo(source.materialLotInfo),
    affectedBatches: normalizeRecordArray<TraceabilityAffectedBatch>(source.affectedBatches),
  }
})

const recipeItems = computed<TraceabilityRecipeItem[]>(() => {
  return structuredTrace.value?.recipeInfo?.items || []
})

const productDestinations = computed<TraceabilityProductDestination[]>(() => {
  return structuredTrace.value?.productDestinations || []
})

const materialLotInfo = computed<TraceabilityMaterialLotInfo | null>(() => {
  return structuredTrace.value?.materialLotInfo || null
})

const affectedBatches = computed<TraceabilityAffectedBatch[]>(() => {
  return structuredTrace.value?.affectedBatches || []
})

const currentTraceBatchNo = computed(() => structuredTrace.value?.batchInfo?.batchNo || '')

const filteredAiRiskRecords = computed<TraceabilityAiRiskRecord[]>(() => {
  return (structuredTrace.value?.aiRiskRecords || []).filter((item) => {
    const score = Number(item.riskScore)
    return Number.isFinite(score) && score >= 0.6
  })
})

const productSpecText = computed(() => {
  const spec = structuredTrace.value?.productInfo?.spec?.trim() || ''
  const unit = structuredTrace.value?.productInfo?.unit?.trim() || ''
  if (!spec && !unit) return '-'
  if (!spec) return unit
  if (!unit) return spec
  return `${spec}${unit}`
})

const recipeBaseQty = computed(() => {
  return structuredTrace.value?.recipeInfo?.baseQty
})

const recipeBaseLabel = computed(() => {
  const base = recipeBaseQty.value
  if (base === null || base === undefined || base === '') return '基础单位未提供'
  return `${formatValue(base)}瓶`
})

const recipeUsageTip = computed(() => {
  const base = recipeBaseQty.value
  const target = structuredTrace.value?.recipeInfo?.batchTargetQty
  const baseText =
    base === null || base === undefined || base === '' ? '配方基础单位' : `${formatValue(base)}瓶`
  const targetText =
    target === null || target === undefined || target === '' ? '-' : `${formatValue(target)}瓶`
  return `配方基准值：${baseText}；当前批次目标产量：${targetText}。`
})

const recipeQtyColumnLabel = computed(() => {
  const base = recipeBaseQty.value
  if (base === null || base === undefined || base === '') return '标准用量（配方原始值）'
  return `标准用量（按${formatValue(base)}瓶）`
})

const directionText = computed(() => {
  const direction = structuredTrace.value?.direction || activeDirection.value
  return String(direction).toUpperCase() === 'BACKWARD' || direction === 'backward'
    ? '反向溯源'
    : '正向溯源'
})

const isBackwardTrace = computed(() => {
  const direction = structuredTrace.value?.direction || activeDirection.value
  return String(direction).toUpperCase() === 'BACKWARD' || direction === 'backward'
})

const rawPreview = computed(() => safeStringify(rawResult.value))

const hasForwardSections = computed(() => {
  if (!structuredTrace.value) return false
  return Boolean(
    structuredTrace.value.materialLotInfo ||
    structuredTrace.value.affectedBatches.length ||
    structuredTrace.value.productDestinations.length,
  )
})

const handleSearch = async (direction: TraceDirection) => {
  const keyword = direction === 'backward' ? backwardForm.batchNo.trim() : forwardForm.lotNo.trim()
  if (!keyword) {
    ElMessage.warning(direction === 'backward' ? '请输入成品批次号' : '请输入原料批次号')
    return
  }

  loading.value = true
  hasSearched.value = true
  activeTab.value = direction
  activeDirection.value = direction

  try {
    const res =
      direction === 'backward'
        ? await getBackwardTraceability(keyword)
        : await getForwardTraceability(keyword)
    rawResult.value = res.data
    syncQuery(direction, keyword)
  } catch (error) {
    rawResult.value = null
    console.error('获取溯源链路失败:', error)
  } finally {
    loading.value = false
  }
}

const syncQuery = (direction: TraceDirection, keyword: string) => {
  router.replace({
    path: '/ai/traceability',
    query:
      direction === 'backward'
        ? { mode: direction, batchNo: keyword }
        : { mode: direction, lotNo: keyword },
  })
}

const goBatchQuality = (batchNo: string) => {
  const normalizedBatchNo = String(batchNo || '').trim()
  if (!normalizedBatchNo) {
    ElMessage.warning('当前批次号为空，无法查看质量报告')
    return
  }

  router.push({
    name: 'BatchQualityReport',
    query: { batchNo: normalizedBatchNo },
  })
}

const formatValue = (value: unknown, digits = 0) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof value === 'number') {
    return digits > 0
      ? value.toFixed(digits)
      : Number.isInteger(value)
        ? String(value)
        : value.toFixed(2)
  }
  return String(value)
}

const formatPercent = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  const numeric = Number(value)
  return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : String(value)
}

const formatDuration = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  return `${value} 分钟`
}

const quantityText = (value: unknown, unit: unknown) => {
  const qty = formatValue(value, 2)
  const unitText = unit ? String(unit) : ''
  return qty === '-' ? '-' : `${qty}${unitText ? ` ${unitText}` : ''}`
}

const outOfRangeClass = (value: TraceabilityProcessSummaryItem['outOfRangeRate']) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return ''
  if (numeric >= 10) return 'danger-text'
  if (numeric >= 5) return 'warning-text'
  return 'success-text'
}

const riskTagType = (value: TraceabilityAiRiskRecord['riskScore']) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'info'
  if (numeric >= 0.8) return 'danger'
  if (numeric >= 0.6) return 'warning'
  return 'success'
}

const riskTimelineType = (
  value: TraceabilityAiRiskRecord['riskScore'],
): 'primary' | 'success' | 'warning' | 'danger' | 'info' => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 'info'
  if (numeric >= 0.8) return 'danger'
  if (numeric >= 0.6) return 'warning'
  return 'success'
}

const formatRiskScore = (value: TraceabilityAiRiskRecord['riskScore']) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric.toFixed(2) : '-'
}

const alarmTagType = (level: unknown) => {
  const text = String(level || '').toUpperCase()
  if (text.includes('CRITICAL')) return 'danger'
  if (text.includes('WARNING')) return 'warning'
  return 'info'
}

const normalizeRecipeInfo = (value: unknown) => {
  const recipe = asRecord(value)
  if (!recipe) return null
  return {
    recipeId: readString(recipe.recipeId),
    recipeName: readString(recipe.recipeName),
    recipeCode: readString(recipe.recipeCode),
    baseQty: readNumberLike(recipe.baseQty),
    batchTargetQty: readNumberLike(recipe.batchTargetQty),
    items: normalizeRecordArray<TraceabilityRecipeItem>(recipe.items),
  }
}

const normalizeMaterialLotInfo = (value: unknown): TraceabilityMaterialLotInfo | null => {
  const lot = asRecord(value)
  if (!lot) return null
  return {
    lotNo: readString(lot.lotNo),
    materialName: readString(lot.materialName),
    materialCode: readString(lot.materialCode),
    arrivalQty: readNumberLike(lot.arrivalQty),
    unit: readNullableString(lot.unit),
    supplierName: readNullableString(lot.supplierName),
    arrivalTime: readNullableString(lot.arrivalTime),
    expiryDate: readNullableString(lot.expiryDate),
  }
}

const normalizeRecordArray = <T extends object>(value: unknown): T[] => {
  if (!Array.isArray(value)) return []
  return value.filter(isRecord) as unknown as T[]
}

const asRecord = (value: unknown) => {
  return isRecord(value) ? value : null
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]'
}

const readString = (value: unknown) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const readNullableString = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

const readNumberLike = (value: unknown): number | string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' || typeof value === 'string') return value
  return String(value)
}

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

watch(activeTab, (value) => {
  activeDirection.value = value
})

onMounted(() => {
  const mode = route.query.mode === 'forward' ? 'forward' : 'backward'
  activeTab.value = mode
  activeDirection.value = mode

  const batchNo = typeof route.query.batchNo === 'string' ? route.query.batchNo : ''
  const lotNo = typeof route.query.lotNo === 'string' ? route.query.lotNo : ''

  backwardForm.batchNo = batchNo
  forwardForm.lotNo = lotNo

  if (mode === 'backward' && batchNo) {
    handleSearch('backward')
  }
  if (mode === 'forward' && lotNo) {
    handleSearch('forward')
  }
})
</script>

<style scoped>
.trace-tabs {
  margin-bottom: 8px;
}

.toolbar {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.search-input {
  width: 360px;
  max-width: 100%;
}

.toolbar-tip {
  margin-top: 10px;
  color: #606266;
  font-size: 13px;
}

.loading-tip {
  margin: 12px 0 16px;
}

.result-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.summary-card,
.section-card,
.sub-card {
  border-radius: 12px;
}

.section-header-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.summary-label {
  color: #909399;
  font-size: 13px;
  margin-bottom: 8px;
}

.summary-value {
  color: #1f2937;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
}

.summary-value-code {
  font-size: 18px;
  word-break: break-all;
}

.summary-value-time {
  font-size: 18px;
}

.section-row {
  margin: 0;
}

.overview-tags {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.overview-tag {
  margin-right: 0;
}

.overview-timeline {
  margin-top: 8px;
}

.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.timeline-meta {
  color: #4b5563;
  line-height: 1.7;
}

.reason-text {
  color: #374151;
  line-height: 1.6;
  margin-top: 6px;
}

.empty-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.raw-card {
  margin-bottom: 4px;
}

.raw-json,
.structured-json {
  margin: 0;
  max-height: 360px;
  overflow: auto;
  padding: 12px;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.destinations-card {
  margin-top: 12px;
}

.danger-text {
  color: #dc2626;
  font-weight: 600;
}

.warning-text {
  color: #d97706;
  font-weight: 600;
}

.success-text {
  color: #059669;
  font-weight: 600;
}

.full-height {
  height: 100%;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .summary-value {
    font-size: 20px;
  }
}
</style>
