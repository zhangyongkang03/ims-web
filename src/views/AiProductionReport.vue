<template>
  <div class="container">
    <el-card class="box-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>产品生产报告</span>
        </div>
      </template>

      <div class="toolbar">
        <el-segmented v-model="reportType" :options="reportTypeOptions" class="type-switch" />
        <el-date-picker
          v-model="selectedDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          :placeholder="datePickerPlaceholder"
          :disabled-date="disabledDate"
          :clearable="false"
          class="date-picker"
        />
        <el-button type="primary" :loading="loading" @click="handleLoadReport">
          {{ loadButtonText }}
        </el-button>
      </div>

      <div class="meta-row">
        <el-tag type="primary">周期：{{ reportTypeLabel }}</el-tag>
        <el-tag type="info">报告日期：{{ reportDateText }}</el-tag>
        <el-tag type="success">生成时间：{{ activeGenerateTime }}</el-tag>
      </div>

      <el-empty v-if="!report && !oeeReport && !loading" :description="emptyTip" />

      <el-tabs v-else v-model="activeTab">
        <el-tab-pane label="生产报告" name="production">
          <div v-if="report" class="content-wrap">
            <el-row :gutter="12" class="summary-grid">
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="计划产量" :value="numberOrZero(overview.totalTargetQty)" />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="实际产量" :value="numberOrZero(overview.totalOutput)" />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="良品产量" :value="numberOrZero(overview.qualifiedOutput)" />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="不良数量" :value="numberOrZero(overview.badQty)" />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="良率"
                  :value="numberOrZero(percentValue(overview.qualificationRate))"
                  suffix="%"
                />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="批次数" :value="numberOrZero(overview.batchCount)" />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="工单数" :value="numberOrZero(overview.workOrderCount)" />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="OEE"
                  :value="numberOrZero(percentValue(overview.oeeOverall))"
                  suffix="%"
                />
              </el-col>
            </el-row>

            <el-row :gutter="12" class="section-row">
              <el-col :xs="24" :xl="14">
                <el-card shadow="never" class="section-card full-height">
                  <template #header>
                    <span>产品维度分解</span>
                  </template>
                  <el-table :data="productStats" stripe border style="width: 100%" max-height="420">
                    <el-table-column prop="productCode" label="产品编码" min-width="120" />
                    <el-table-column prop="productName" label="产品名称" min-width="140" />
                    <el-table-column label="计划产量" width="100">
                      <template #default="{ row }">{{ formatNumber(row.targetQty) }}</template>
                    </el-table-column>
                    <el-table-column label="实际产量" width="100">
                      <template #default="{ row }">{{ formatNumber(row.actualQty) }}</template>
                    </el-table-column>
                    <el-table-column label="良品" width="100">
                      <template #default="{ row }">{{ formatNumber(row.qualifiedQty) }}</template>
                    </el-table-column>
                    <el-table-column label="不良品" width="100">
                      <template #default="{ row }">{{ formatNumber(row.badQty) }}</template>
                    </el-table-column>
                    <el-table-column label="良率" width="100">
                      <template #default="{ row }">{{
                        formatPercent(row.qualificationRate)
                      }}</template>
                    </el-table-column>
                  </el-table>
                </el-card>
              </el-col>

              <el-col :xs="24" :xl="10">
                <el-card shadow="never" class="section-card full-height">
                  <template #header>
                    <span>报警工序分布</span>
                  </template>
                  <el-empty
                    v-if="!defectDistribution.length"
                    description="暂无报警工序分布"
                    :image-size="80"
                  />
                  <el-table
                    v-else
                    :data="defectDistribution"
                    stripe
                    border
                    style="width: 100%"
                    max-height="420"
                  >
                    <el-table-column label="工序名称" min-width="120">
                      <template #default="{ row }">{{
                        row.processName || processTypeLabel(row.processType)
                      }}</template>
                    </el-table-column>
                    <el-table-column prop="processType" label="工序类型" min-width="120" />
                    <el-table-column label="报警次数" width="100">
                      <template #default="{ row }">{{ formatNumber(row.badQty) }}</template>
                    </el-table-column>
                    <el-table-column label="占比" width="100">
                      <template #default="{ row }">{{
                        formatNormalizedPercent(row.defectRate)
                      }}</template>
                    </el-table-column>
                  </el-table>
                </el-card>
              </el-col>
            </el-row>

            <el-row :gutter="12" class="section-row">
              <el-col v-if="showTrendSection" :xs="24" :xl="12">
                <el-card shadow="never" class="section-card full-height">
                  <template #header>
                    <span>{{ trendSectionTitle }}</span>
                  </template>
                  <el-empty v-if="!dailyTrend.length" description="暂无趋势数据" :image-size="80" />
                  <div v-else class="trend-chart-wrap">
                    <div class="trend-legend">
                      <span class="legend-item">
                        <i class="legend-dot legend-output"></i>
                        总产量
                      </span>
                      <span class="legend-item">
                        <i class="legend-dot legend-bad"></i>
                        不良数量
                      </span>
                      <span class="legend-item">
                        <i class="legend-dot legend-yield"></i>
                        良率
                      </span>
                    </div>

                    <svg
                      class="trend-chart"
                      viewBox="0 0 720 220"
                      role="img"
                      aria-label="生产日报趋势图"
                    >
                      <line
                        v-for="line in dailyTrendChart.gridLines"
                        :key="`grid-${line.value}`"
                        :x1="line.x1"
                        :y1="line.y"
                        :x2="line.x2"
                        :y2="line.y"
                        class="chart-grid"
                      />

                      <text
                        v-for="line in dailyTrendChart.gridLines"
                        :key="`left-${line.value}`"
                        :x="52"
                        :y="line.y + 4"
                        class="axis-label"
                      >
                        {{ line.value }}
                      </text>

                      <text
                        v-for="tick in dailyTrendChart.rightAxisTicks"
                        :key="`right-${tick.value}`"
                        :x="670"
                        :y="tick.y + 4"
                        class="axis-label axis-label-right"
                      >
                        {{ tick.value }}%
                      </text>

                      <polyline
                        :points="dailyTrendChart.outputPoints"
                        class="chart-line chart-line-output"
                      />
                      <polyline
                        :points="dailyTrendChart.badPoints"
                        class="chart-line chart-line-bad"
                      />
                      <polyline
                        :points="dailyTrendChart.yieldPoints"
                        class="chart-line chart-line-yield"
                      />

                      <g v-for="item in dailyTrendChart.points" :key="item.label">
                        <circle
                          :cx="item.x"
                          :cy="item.outputY"
                          r="4"
                          class="chart-point chart-point-output"
                        />
                        <circle
                          :cx="item.x"
                          :cy="item.badY"
                          r="4"
                          class="chart-point chart-point-bad"
                        />
                        <circle
                          :cx="item.x"
                          :cy="item.yieldY"
                          r="4"
                          class="chart-point chart-point-yield"
                        />
                        <text
                          v-if="item.showLabel"
                          :x="item.x"
                          y="202"
                          text-anchor="middle"
                          class="axis-label axis-label-x"
                        >
                          {{ item.shortLabel }}
                        </text>
                      </g>
                    </svg>
                  </div>
                </el-card>
              </el-col>

              <el-col :xs="24" :xl="12">
                <el-card shadow="never" class="section-card full-height">
                  <template #header>
                    <span>AI 总结与改善建议</span>
                  </template>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="AI 总结">
                      {{ aiSummary.summary || '-' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="改善建议">
                      {{ aiSummary.improvementSuggestion || '-' }}
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
            </el-row>

            <el-card shadow="never" class="section-card">
              <template #header>
                <span>批次明细</span>
              </template>
              <el-table :data="batchDetails" stripe border style="width: 100%" max-height="480">
                <el-table-column label="批次号" min-width="170">
                  <template #default="{ row }">
                    <el-button
                      v-if="row.batchNo"
                      link
                      type="primary"
                      @click="goBatchQuality(row.batchNo)"
                    >
                      {{ row.batchNo }}
                    </el-button>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <el-table-column prop="woNo" label="工单号" min-width="150" />
                <el-table-column prop="productName" label="产品名称" min-width="140" />
                <el-table-column label="计划产量" width="100">
                  <template #default="{ row }">{{ formatNumber(row.targetQty) }}</template>
                </el-table-column>
                <el-table-column label="实际产量" width="100">
                  <template #default="{ row }">{{ formatNumber(row.actualQty) }}</template>
                </el-table-column>
                <el-table-column label="不良品" width="100">
                  <template #default="{ row }">{{ formatNumber(row.badQty) }}</template>
                </el-table-column>
                <el-table-column label="良率" width="100">
                  <template #default="{ row }">{{ formatPercent(row.qualificationRate) }}</template>
                </el-table-column>
                <el-table-column prop="startTime" label="开始时间" min-width="150" />
                <el-table-column prop="endTime" label="结束时间" min-width="150" />
              </el-table>
            </el-card>
          </div>
          <el-empty v-else :description="emptyTip" />
        </el-tab-pane>

        <el-tab-pane label="OEE 报告" name="oee">
          <div v-if="oeeReport" class="content-wrap">
            <el-row :gutter="12" class="summary-grid">
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="可用率"
                  :value="numberOrZero(oeePercent(oeeReport.availability))"
                  suffix="%"
                />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="性能率"
                  :value="numberOrZero(oeePercent(oeeReport.performance))"
                  suffix="%"
                />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="良品率"
                  :value="numberOrZero(oeePercent(oeeReport.quality))"
                  suffix="%"
                />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="综合OEE"
                  :value="numberOrZero(oeePercent(oeeReport.oee))"
                  suffix="%"
                />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="计划时长(min)"
                  :value="numberOrZero(oeeReport.plannedMinutes)"
                />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic
                  title="实际运行(min)"
                  :value="numberOrZero(oeeReport.actualMinutes)"
                />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="理论产量" :value="numberOrZero(oeeReport.theoreticalOutput)" />
              </el-col>
              <el-col :xs="12" :md="8" :xl="3">
                <el-statistic title="批次数" :value="numberOrZero(oeeReport.batchCount)" />
              </el-col>
            </el-row>

            <el-row :gutter="12" class="section-row">
              <el-col :xs="24" :xl="12">
                <el-card shadow="never" class="section-card full-height">
                  <template #header>
                    <span>OEE 趋势</span>
                  </template>
                  <el-empty
                    v-if="!oeeDailyTrends.length"
                    description="暂无 OEE 趋势数据"
                    :image-size="80"
                  />
                  <el-table
                    v-else
                    :data="oeeDailyTrends"
                    stripe
                    border
                    style="width: 100%"
                    max-height="420"
                  >
                    <el-table-column prop="date" label="日期" min-width="120" />
                    <el-table-column label="可用率" width="100">
                      <template #default="{ row }">{{ formatPercent(row.availability) }}</template>
                    </el-table-column>
                    <el-table-column label="性能率" width="100">
                      <template #default="{ row }">{{ formatPercent(row.performance) }}</template>
                    </el-table-column>
                    <el-table-column label="良品率" width="100">
                      <template #default="{ row }">{{ formatPercent(row.quality) }}</template>
                    </el-table-column>
                    <el-table-column label="OEE" width="100">
                      <template #default="{ row }">{{ formatPercent(row.oee) }}</template>
                    </el-table-column>
                    <el-table-column label="批次数" width="90">
                      <template #default="{ row }">{{ formatNumber(row.batchCount) }}</template>
                    </el-table-column>
                  </el-table>
                </el-card>
              </el-col>

              <el-col :xs="24" :xl="12">
                <el-card shadow="never" class="section-card full-height">
                  <template #header>
                    <span>OEE AI 总结</span>
                  </template>
                  <el-descriptions :column="1" border>
                    <el-descriptions-item label="AI 总结">
                      {{ oeeReport.aiSummary || '-' }}
                    </el-descriptions-item>
                    <el-descriptions-item label="产量概况">
                      实际产量 {{ formatNumber(oeeReport.actualOutput) }}，良品
                      {{ formatNumber(oeeReport.goodQty) }}，不良
                      {{ formatNumber(oeeReport.badQty) }}
                    </el-descriptions-item>
                  </el-descriptions>
                </el-card>
              </el-col>
            </el-row>

            <el-card shadow="never" class="section-card">
              <template #header>
                <span>批次 OEE 明细</span>
              </template>
              <el-table :data="oeeBatchDetails" stripe border style="width: 100%" max-height="480">
                <el-table-column prop="batchNo" label="批次号" min-width="170" />
                <el-table-column prop="productName" label="产品名称" min-width="140" />
                <el-table-column label="可用率" width="100">
                  <template #default="{ row }">{{ formatPercent(row.availability) }}</template>
                </el-table-column>
                <el-table-column label="性能率" width="100">
                  <template #default="{ row }">{{ formatPercent(row.performance) }}</template>
                </el-table-column>
                <el-table-column label="良品率" width="100">
                  <template #default="{ row }">{{ formatPercent(row.quality) }}</template>
                </el-table-column>
                <el-table-column label="OEE" width="100">
                  <template #default="{ row }">{{ formatPercent(row.oee) }}</template>
                </el-table-column>
                <el-table-column label="产量" width="100">
                  <template #default="{ row }">{{ formatNumber(row.actualQty) }}</template>
                </el-table-column>
                <el-table-column label="良品" width="100">
                  <template #default="{ row }">{{ formatNumber(row.goodQty) }}</template>
                </el-table-column>
                <el-table-column label="运行时长" width="100">
                  <template #default="{ row }">{{ formatNumber(row.runMinutes) }}</template>
                </el-table-column>
                <el-table-column prop="startTime" label="开始时间" min-width="150" />
                <el-table-column prop="endTime" label="结束时间" min-width="150" />
              </el-table>
            </el-card>
          </div>
          <el-empty v-else description="暂无 OEE 报告" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {
  getOeeReport,
  getProductionReport,
  type OeeBatchDetailItem,
  type OeeReport,
  type OeeReportRaw,
  type OeeTrendItem,
  type ProductionAiSummary,
  type ProductionBatchDetailItem,
  type ProductionDefectItem,
  type ProductionOverview,
  type ProductionProductItem,
  type ProductionReport,
  type ProductionReportRaw,
  type ProductionReportType,
  type ProductionTrendItem,
} from '@/api/productionReport'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

type ReportType = 'daily' | 'weekly' | 'monthly'

const loading = ref(false)
const report = ref<ProductionReport | null>(null)
const oeeReport = ref<OeeReport | null>(null)
const emptyTip = ref('暂无生产报告，请选择日期后查询')
const selectedDate = ref(getYesterday())
const reportType = ref<ReportType>('daily')
const activeTab = ref<'production' | 'oee'>('production')

const reportTypeOptions = [
  { label: '日报', value: 'daily' },
  { label: '周报', value: 'weekly' },
  { label: '月报', value: 'monthly' },
]

const reportTypeLabel = computed(() => {
  if (reportType.value === 'weekly') return '周报'
  if (reportType.value === 'monthly') return '月报'
  return '日报'
})

const datePickerPlaceholder = computed(() => `选择${reportTypeLabel.value}日期`)
const loadButtonText = computed(() => `查询${reportTypeLabel.value}`)
const reportDateText = computed(() => {
  const source = report.value || oeeReport.value
  if (!source) return '-'
  if ('reportDate' in source && source.reportDate) return source.reportDate
  if (source.startDate && source.endDate) {
    return `${source.startDate} 至 ${source.endDate}`
  }
  return source.startDate || source.endDate || '-'
})

const activeGenerateTime = computed(
  () => report.value?.generateTime || oeeReport.value?.generateTime || '-',
)

const overview = computed<ProductionOverview>(() => report.value?.overview || {})
const productStats = computed<ProductionProductItem[]>(() => report.value?.productStats || [])
const defectDistribution = computed<ProductionDefectItem[]>(
  () => report.value?.defectDistribution || [],
)
const dailyTrend = computed<ProductionTrendItem[]>(() => report.value?.dailyTrend || [])
const trendSectionTitle = computed(() => {
  if (reportType.value === 'monthly') return '月趋势图'
  if (reportType.value === 'weekly') return '周趋势图'
  return '日趋势曲线数据'
})
const showTrendSection = computed(() => reportType.value !== 'daily')
const dailyTrendChart = computed(() => {
  const chartWidth = 720
  const chartHeight = 220
  const left = 72
  const right = 64
  const top = 18
  const bottom = 32
  const plotWidth = chartWidth - left - right
  const plotHeight = chartHeight - top - bottom
  const points = dailyTrend.value

  const outputValues = points.map((item) => toNumber(item.totalOutput) ?? 0)
  const badValues = points.map((item) => toNumber(item.badQty) ?? 0)
  const yieldValues = points.map((item) => toNumber(item.qualificationRate) ?? 0)
  const leftMax = Math.max(1, ...outputValues, ...badValues)
  const rightMax = 100
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0
  const labelStep = points.length > 20 ? 5 : points.length > 14 ? 3 : 1

  const projectLeft = (value: number) => top + plotHeight - (value / leftMax) * plotHeight
  const projectRight = (value: number) => top + plotHeight - (value / rightMax) * plotHeight

  const normalizedPoints = points.map((item, index) => {
    const x = left + stepX * index
    const label = String(item.label || item.date || '-')
    return {
      label,
      shortLabel: label.slice(5),
      showLabel: index === 0 || index === points.length - 1 || index % labelStep === 0,
      x,
      outputY: projectLeft(toNumber(item.totalOutput) ?? 0),
      badY: projectLeft(toNumber(item.badQty) ?? 0),
      yieldY: projectRight(toNumber(item.qualificationRate) ?? 0),
    }
  })

  const leftTicks = 4
  const gridLines = Array.from({ length: leftTicks + 1 }, (_, index) => {
    const value = Number(((leftMax / leftTicks) * (leftTicks - index)).toFixed(0))
    const y = top + (plotHeight / leftTicks) * index
    return {
      value,
      x1: left,
      x2: left + plotWidth,
      y,
    }
  })

  const rightAxisTicks = [100, 75, 50, 25, 0].map((value) => ({
    value,
    y: projectRight(value),
  }))

  return {
    gridLines,
    rightAxisTicks,
    points: normalizedPoints,
    outputPoints: normalizedPoints.map((item) => `${item.x},${item.outputY}`).join(' '),
    badPoints: normalizedPoints.map((item) => `${item.x},${item.badY}`).join(' '),
    yieldPoints: normalizedPoints.map((item) => `${item.x},${item.yieldY}`).join(' '),
  }
})
const batchDetails = computed<ProductionBatchDetailItem[]>(() => report.value?.batchDetails || [])
const aiSummary = computed<ProductionAiSummary>(() => report.value?.aiSummary || {})
const oeeDailyTrends = computed<OeeTrendItem[]>(() => oeeReport.value?.dailyTrends || [])
const oeeBatchDetails = computed<OeeBatchDetailItem[]>(() => oeeReport.value?.batchDetails || [])

function getYesterday() {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return formatDate(date)
}

function formatDate(date: Date) {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

function disabledDate(time: Date) {
  const day = new Date(time)
  day.setHours(0, 0, 0, 0)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const min = new Date(today)
  min.setDate(min.getDate() - 90)

  return day.getTime() > today.getTime() || day.getTime() < min.getTime()
}

function normalizeType(type: ReportType): ProductionReportType {
  if (type === 'weekly') return 'WEEKLY'
  if (type === 'monthly') return 'MONTHLY'
  return 'DAILY'
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return Number.isNaN(num) ? undefined : num
}

function deriveGoodQty(actualQty: unknown, badQty: unknown) {
  const normalizedActualQty = toNumber(actualQty)
  const normalizedBadQty = toNumber(badQty) ?? 0
  if (normalizedActualQty === undefined) return undefined
  return Math.max(0, normalizedActualQty - normalizedBadQty)
}

function deriveYieldRate(actualQty: unknown, goodQty: unknown) {
  const normalizedActualQty = toNumber(actualQty)
  const normalizedGoodQty = toNumber(goodQty)
  if (
    normalizedActualQty === undefined ||
    normalizedActualQty <= 0 ||
    normalizedGoodQty === undefined
  ) {
    return undefined
  }
  return (normalizedGoodQty / normalizedActualQty) * 100
}

function percentValue(value: unknown) {
  const num = toNumber(value)
  if (num === undefined) return undefined
  return num > 1 ? num : num * 100
}

function oeePercent(value: unknown) {
  return percentValue(value)
}

function numberOrZero(value: unknown) {
  return toNumber(value) ?? 0
}

function formatNumber(value: unknown, digits = 0) {
  const num = toNumber(value)
  if (num === undefined) return '-'
  return digits > 0 ? num.toFixed(digits) : Number.isInteger(num) ? String(num) : num.toFixed(2)
}

function formatPercent(value: unknown) {
  const num = percentValue(value)
  if (num === undefined) return '-'
  return `${num.toFixed(2)}%`
}

function formatNormalizedPercent(value: unknown) {
  const num = toNumber(value)
  if (num === undefined) return '-'
  return `${num.toFixed(2)}%`
}

function processTypeLabel(processType: unknown) {
  const processTypeMap: Record<string, string> = {
    MIXING: '配液',
    STERILIZATION: '杀菌',
    STERILIZING: '杀菌',
    FILLING: '罐装',
    SEALING: '封口',
    LABELING: '贴标',
    PACKAGING: '包装',
  }
  const normalizedType = String(processType || '')
  return processTypeMap[normalizedType] || normalizedType || '-'
}

function sanitizeOverview(raw: ProductionReportRaw | ProductionReport): ProductionOverview {
  const source = (raw as ProductionReportRaw).overview || raw
  const row = source as Record<string, unknown>
  const totalOutput = toNumber(row.totalOutput ?? row.totalActualQty ?? row.actualQty)
  const qualifiedOutput =
    toNumber(row.qualifiedOutput ?? row.totalGoodQty ?? row.goodQty) ??
    deriveGoodQty(totalOutput, row.badQty ?? row.totalBadQty)

  return {
    totalTargetQty: toNumber(row.totalTargetQty ?? row.targetQty),
    totalOutput,
    qualifiedOutput,
    badQty: toNumber(row.badQty ?? row.totalBadQty),
    qualificationRate:
      percentValue(row.qualificationRate ?? row.yieldRate) ??
      deriveYieldRate(totalOutput, qualifiedOutput),
    badRate: percentValue(row.badRate),
    batchCount: toNumber(row.batchCount),
    workOrderCount: toNumber(row.workOrderCount),
    oeeAvailability: percentValue(row.oeeAvailability),
    oeePerformance: percentValue(row.oeePerformance),
    oeeQuality: percentValue(row.oeeQuality),
    oeeOverall: percentValue(row.oeeOverall),
  }
}

function sanitizeOeeTrend(source: unknown): OeeTrendItem[] {
  if (!Array.isArray(source)) return []
  return source.map((item) => {
    const row = item as Record<string, unknown>
    return {
      date: String(row.date || ''),
      availability: percentValue(row.availability),
      performance: percentValue(row.performance),
      quality: percentValue(row.quality),
      oee: percentValue(row.oee),
      batchCount: toNumber(row.batchCount),
    }
  })
}

function sanitizeOeeBatchDetails(source: unknown): OeeBatchDetailItem[] {
  if (!Array.isArray(source)) return []
  return source.map((item) => {
    const row = item as Record<string, unknown>
    return {
      batchNo: String(row.batchNo || ''),
      productName: String(row.productName || ''),
      availability: percentValue(row.availability),
      performance: percentValue(row.performance),
      quality: percentValue(row.quality),
      oee: percentValue(row.oee),
      actualQty: toNumber(row.actualQty),
      goodQty: toNumber(row.goodQty),
      runMinutes: toNumber(row.runMinutes),
      startTime: String(row.startTime || ''),
      endTime: String(row.endTime || ''),
    }
  })
}

function sanitizeOeeReport(raw: OeeReportRaw | OeeReport): OeeReport {
  const source = raw as OeeReportRaw
  return {
    reportType: source.reportType || (raw as OeeReport).reportType,
    startDate: source.startDate || (raw as OeeReport).startDate,
    endDate: source.endDate || (raw as OeeReport).endDate,
    generateTime: source.generateTime || (raw as OeeReport).generateTime,
    availability: percentValue(source.availability ?? (raw as OeeReport).availability),
    performance: percentValue(source.performance ?? (raw as OeeReport).performance),
    quality: percentValue(source.quality ?? (raw as OeeReport).quality),
    oee: percentValue(source.oee ?? (raw as OeeReport).oee),
    plannedMinutes: toNumber(source.plannedMinutes ?? (raw as OeeReport).plannedMinutes),
    actualMinutes: toNumber(source.actualMinutes ?? (raw as OeeReport).actualMinutes),
    theoreticalOutput: toNumber(source.theoreticalOutput ?? (raw as OeeReport).theoreticalOutput),
    actualOutput: toNumber(source.actualOutput ?? (raw as OeeReport).actualOutput),
    goodQty: toNumber(source.goodQty ?? (raw as OeeReport).goodQty),
    badQty: toNumber(source.badQty ?? (raw as OeeReport).badQty),
    batchCount: toNumber(source.batchCount ?? (raw as OeeReport).batchCount),
    dailyTrends: sanitizeOeeTrend(source.dailyTrends || (raw as OeeReport).dailyTrends),
    batchDetails: sanitizeOeeBatchDetails(source.batchDetails || (raw as OeeReport).batchDetails),
    aiSummary: source.aiSummary || (raw as OeeReport).aiSummary,
  }
}

function sanitizeProductStats(source: unknown): ProductionProductItem[] {
  if (!Array.isArray(source)) return []
  return source.map((item) => {
    const row = item as Record<string, unknown>
    const actualQty = toNumber(row.actualQty)
    const qualifiedQty =
      toNumber(row.qualifiedQty ?? row.goodQty) ?? deriveGoodQty(actualQty, row.badQty)

    return {
      productId: (row.productId ?? row.pid) as string | number | undefined,
      productCode: String(row.productCode || row.pcode || row.pid || ''),
      productName: String(row.productName || row.pname || ''),
      targetQty: toNumber(row.targetQty),
      actualQty,
      qualifiedQty,
      badQty: toNumber(row.badQty),
      qualificationRate:
        percentValue(row.qualificationRate ?? row.yieldRate) ??
        deriveYieldRate(actualQty, qualifiedQty),
    }
  })
}

function sanitizeDefectDistribution(source: unknown): ProductionDefectItem[] {
  if (!Array.isArray(source)) return []
  return source.map((item) => {
    const row = item as Record<string, unknown>
    const directPercentage = toNumber(row.percentage)
    return {
      processName: String(row.processName || processTypeLabel(row.processType)),
      processType: String(row.processType || ''),
      badQty: toNumber(row.badQty ?? row.alarmCount),
      defectRate: directPercentage ?? percentValue(row.defectRate ?? row.badRate),
    }
  })
}

function sanitizeTrend(source: unknown): ProductionTrendItem[] {
  if (!Array.isArray(source)) return []
  return source.map((item) => {
    const row = item as Record<string, unknown>
    const totalOutput = toNumber(row.totalOutput ?? row.actualQty ?? row.value ?? row.total)
    const badQty = toNumber(row.badQty)
    const qualifiedOutput =
      toNumber(row.qualifiedOutput ?? row.qualifiedCount ?? row.goodQty) ??
      deriveGoodQty(totalOutput, badQty)

    return {
      date: String(row.date || row.day || ''),
      label: String(row.label || row.date || row.day || ''),
      totalOutput,
      qualifiedOutput,
      qualificationRate:
        percentValue(row.qualificationRate ?? row.yieldRate) ??
        deriveYieldRate(totalOutput, qualifiedOutput),
      badQty,
      batchCount: toNumber(row.batchCount),
    }
  })
}

function sanitizeBatchDetails(source: unknown): ProductionBatchDetailItem[] {
  if (!Array.isArray(source)) return []
  return source.map((item) => {
    const row = item as Record<string, unknown>
    return {
      batchNo: String(row.batchNo || ''),
      woNo: String(row.woNo || row.orderNo || ''),
      productName: String(row.productName || ''),
      targetQty: toNumber(row.targetQty),
      actualQty: toNumber(row.actualQty),
      badQty: toNumber(row.badQty),
      qualificationRate: percentValue(row.qualificationRate ?? row.yieldRate),
      startTime: String(row.startTime || ''),
      endTime: String(row.endTime || ''),
      durationMinutes: toNumber(row.durationMinutes),
    }
  })
}

function sanitizeAiSummary(raw: ProductionReportRaw | ProductionReport): ProductionAiSummary {
  const old = (raw as ProductionReport).aiSummary
  if (old && typeof old === 'object') {
    return {
      summary: old.summary,
      improvementSuggestion: old.improvementSuggestion,
      riskHighlights: old.riskHighlights,
    }
  }

  const row = raw as ProductionReportRaw
  return {
    summary: row.aiSummary || row.aiOverview,
    improvementSuggestion:
      row.aiSuggestion || row.aiImprovementSuggestion || row.improvementSuggestion,
    riskHighlights: row.aiRiskHighlights,
  }
}

function sanitizeReport(raw: ProductionReportRaw | ProductionReport): ProductionReport {
  const source = raw as ProductionReportRaw
  return {
    reportDate: source.reportDate || (raw as ProductionReport).reportDate,
    startDate: source.startDate || (raw as ProductionReport).startDate,
    endDate: source.endDate || (raw as ProductionReport).endDate,
    generateTime: source.generateTime || (raw as ProductionReport).generateTime,
    overview: sanitizeOverview(raw),
    productStats: sanitizeProductStats(
      source.productStats ||
        source.productBreakdowns ||
        source.productSummaryList ||
        source.productReportList ||
        (raw as ProductionReport).productStats,
    ),
    defectDistribution: sanitizeDefectDistribution(
      source.defectDistribution ||
        source.defectDistributions ||
        source.processDefectDistribution ||
        (raw as ProductionReport).defectDistribution,
    ),
    dailyTrend: sanitizeTrend(
      source.dailyTrend ||
        source.dailyTrends ||
        source.trendList ||
        (raw as ProductionReport).dailyTrend,
    ),
    batchDetails: sanitizeBatchDetails(
      source.batchDetails || (raw as ProductionReport).batchDetails,
    ),
    aiSummary: sanitizeAiSummary(raw),
  }
}

async function handleLoadReport() {
  loading.value = true
  try {
    const [productionResult, oeeResult] = await Promise.allSettled([
      getProductionReport(normalizeType(reportType.value), selectedDate.value),
      getOeeReport(reportType.value, selectedDate.value),
    ])

    if (productionResult.status === 'fulfilled') {
      report.value = sanitizeReport(productionResult.value.data || {})
    } else {
      report.value = null
    }

    if (oeeResult.status === 'fulfilled') {
      oeeReport.value = sanitizeOeeReport(oeeResult.value.data || {})
    } else {
      oeeReport.value = null
    }

    emptyTip.value = '暂无生产报告，请选择日期后查询'
    if (report.value || oeeReport.value) {
      ElMessage.success(`${reportTypeLabel.value}查询成功`)
    } else {
      throw new Error('未获取到可展示的报告数据')
    }
  } catch (error) {
    report.value = null
    oeeReport.value = null
    ElMessage.error(error instanceof Error ? error.message : '获取生产报告失败')
  } finally {
    loading.value = false
  }
}

function goBatchQuality(batchNo: string) {
  const normalizedBatchNo = String(batchNo || '').trim()
  if (!normalizedBatchNo) {
    ElMessage.warning('当前批次号为空，无法查看质量报告')
    return
  }

  router.push({
    name: 'BatchQualityReport',
    query: { batchNo: normalizedBatchNo, from: 'production-report' },
  })
}

onMounted(() => {
  handleLoadReport()
})
</script>

<style scoped>
.container {
  padding: 20px;
}

.box-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.type-switch {
  flex-shrink: 0;
}

.date-picker {
  width: 220px;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 14px;
}

.content-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-grid {
  margin-bottom: 0;
}

.section-card {
  border-radius: 8px;
}

.section-row {
  margin-top: 2px;
}

.full-height {
  height: 100%;
}

.trend-chart-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.trend-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #606266;
  font-size: 13px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.legend-output {
  background: #2563eb;
}

.legend-bad {
  background: #f97316;
}

.legend-yield {
  background: #16a34a;
}

.trend-chart {
  width: 100%;
  height: auto;
  max-height: 220px;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  background: linear-gradient(180deg, #fbfdff 0%, #f5f9ff 100%);
}

.chart-grid {
  stroke: #dbe5f1;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.chart-line {
  fill: none;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chart-line-output {
  stroke: #2563eb;
}

.chart-line-bad {
  stroke: #f97316;
}

.chart-line-yield {
  stroke: #16a34a;
}

.chart-point {
  stroke: #ffffff;
  stroke-width: 2;
}

.chart-point-output {
  fill: #2563eb;
}

.chart-point-bad {
  fill: #f97316;
}

.chart-point-yield {
  fill: #16a34a;
}

.axis-label {
  fill: #6b7280;
  font-size: 12px;
}

.axis-label-right {
  text-anchor: start;
}

.axis-label-x {
  fill: #4b5563;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .date-picker {
    width: 100%;
  }
}
</style>
