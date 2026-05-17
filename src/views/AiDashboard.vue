<template>
  <div class="console-page">
    <section class="console-toolbar">
      <div class="toolbar-title">智能生产监控控制台</div>
      <div class="toolbar-meta">
        <el-tag :type="wsConnected ? 'success' : 'danger'" effect="dark">
          {{ wsConnected ? 'WebSocket 已连接' : 'WebSocket 已断开' }}
        </el-tag>
        <span>监控设备 {{ cardList.length }}</span>
        <span>高风险 {{ highRiskCount }}</span>
        <span>更新 {{ productionStats.lastUpdated || '-' }}</span>
        <el-button :loading="loading" @click="refreshAll">刷新</el-button>
      </div>
    </section>

    <section class="summary-grid">
      <article class="summary-card warm-card">
        <div class="summary-label">今日累计产量</div>
        <div class="summary-value">{{ dashboardSummary.todayTotalQty }}</div>
        <div class="summary-sub">今日良品率 {{ dashboardSummary.todayYieldRate }}%</div>
      </article>
      <article class="summary-card danger-card">
        <div class="summary-label">未处理告警</div>
        <div class="summary-value">{{ dashboardSummary.unhandledAlarms }}</div>
        <div class="summary-sub">最新告警 {{ latestAlarms.length }} 条已同步</div>
      </article>
      <article class="summary-card neutral-card">
        <div class="summary-label">当前生产状态</div>
        <div class="summary-value">{{ dashboardSummary.currentStatus }}</div>
        <div class="summary-sub">批次号 {{ dashboardSummary.currentBatchNo }}</div>
      </article>
      <article class="summary-card success-card">
        <div class="summary-label">今日批次数</div>
        <div class="summary-value">{{ dashboardSummary.todayBatchCount }}</div>
        <div class="summary-sub">今日已完成/进行中的生产批次数</div>
      </article>
    </section>

    <section class="console-grid">
      <el-card class="panel-card realtime-panel" shadow="never">
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">实时传感器曲线</div>
              <div class="panel-desc">展示最近 60 秒的现场变化，并保留阈值区间辅助判断波动。</div>
            </div>
            <el-tag type="info">{{ realtimeCurveCards.length }} 路传感器</el-tag>
          </div>
        </template>

        <el-empty
          v-if="isIdleStatus"
          description="当前生产状态为空闲，暂无实时传感器曲线"
          :image-size="80"
        />

        <el-empty
          v-else-if="!realtimeCurveCards.length"
          description="暂无可绘制的实时曲线"
          :image-size="80"
        />

        <div v-else class="curve-grid">
          <div v-for="item in realtimeCurveCards" :key="item.deviceCode" class="curve-card">
            <div class="curve-card-head">
              <div>
                <div class="curve-title">{{ sensorTitle(item) }}</div>
                <div class="curve-subtitle">
                  {{ item.deviceCode }}
                  <span v-if="item.batchNo"> | {{ item.batchNo }}</span>
                </div>
              </div>
              <el-tag size="small" :type="riskTagType(item.riskFast, item.riskLevel)">
                {{ displayRiskLevelText(item.riskLevel) }}
              </el-tag>
            </div>

            <div class="curve-metrics">
              <div class="curve-metric">
                <span class="curve-metric-label">当前值</span>
                <strong class="curve-metric-value">
                  {{ formatRealtimeValue(item.currentValue) }} {{ realtimeUnit(item) }}
                </strong>
              </div>
              <div class="curve-metric">
                <span class="curve-metric-label">窗口范围</span>
                <strong class="curve-metric-value">
                  {{ formatRealtimeValue(item.minObserved) }} -
                  {{ formatRealtimeValue(item.maxObserved) }}
                </strong>
              </div>
            </div>

            <div class="curve-chart-wrap">
              <div class="curve-axis curve-axis-top">{{ formatRealtimeValue(item.scaleMax) }}</div>
              <svg
                class="curve-svg"
                :viewBox="`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`"
                preserveAspectRatio="none"
              >
                <line
                  class="curve-grid-line"
                  :x1="CURVE_PADDING_X"
                  :y1="CURVE_HEIGHT / 2"
                  :x2="CURVE_WIDTH - CURVE_PADDING_X"
                  :y2="CURVE_HEIGHT / 2"
                />
                <line
                  v-if="item.minThreshold !== undefined"
                  class="curve-threshold-line"
                  :x1="CURVE_PADDING_X"
                  :y1="curveReferenceY(item.minThreshold, item.scaleMin, item.scaleMax)"
                  :x2="CURVE_WIDTH - CURVE_PADDING_X"
                  :y2="curveReferenceY(item.minThreshold, item.scaleMin, item.scaleMax)"
                />
                <line
                  v-if="item.maxThreshold !== undefined"
                  class="curve-threshold-line"
                  :x1="CURVE_PADDING_X"
                  :y1="curveReferenceY(item.maxThreshold, item.scaleMin, item.scaleMax)"
                  :x2="CURVE_WIDTH - CURVE_PADDING_X"
                  :y2="curveReferenceY(item.maxThreshold, item.scaleMin, item.scaleMax)"
                />
                <polyline
                  class="curve-line"
                  fill="none"
                  :points="curvePolylinePoints(item.points, item.scaleMin, item.scaleMax)"
                />
                <circle
                  v-if="item.points.length"
                  class="curve-last-dot"
                  :cx="curveLastPoint(item.points, item.scaleMin, item.scaleMax).x"
                  :cy="curveLastPoint(item.points, item.scaleMin, item.scaleMax).y"
                  r="4"
                />
              </svg>
              <div class="curve-axis curve-axis-bottom">
                {{ formatRealtimeValue(item.scaleMin) }}
              </div>
            </div>

            <div class="curve-footer">
              <span>{{ curveWindowLabel }} {{ item.pointCount }} 个点</span>
              <span>更新于 {{ formatDashboardTimestamp(item.timestamp) }}</span>
            </div>
          </div>
        </div>
      </el-card>

      <el-card
        v-if="showAiAnalysisPanel && mixingWorkshopAnalysis"
        class="panel-card ai-panel"
        :class="riskPanelClass(mixingWorkshopAnalysis.riskScore, mixingWorkshopAnalysis.riskLevel)"
        shadow="never"
      >
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">AI 综合态势分析</div>
              <div class="panel-desc">告警与实时波动发生时，同屏给出风险评估和建议动作。</div>
            </div>
            <el-tag
              :type="
                riskTagType(mixingWorkshopAnalysis.riskScore, mixingWorkshopAnalysis.riskLevel)
              "
            >
              {{ overallRiskLevelText }}
            </el-tag>
          </div>
        </template>

        <div class="ai-panel-top">
          <div class="workshop-gauge">
            <el-progress
              type="dashboard"
              :percentage="Math.round(mixingWorkshopAnalysis.riskScore * 100)"
              :color="riskColor(mixingWorkshopAnalysis.riskScore)"
            >
              <template #default>
                <div class="workshop-risk-number">
                  {{ mixingWorkshopAnalysis.riskScore.toFixed(2) }}
                </div>
                <div class="workshop-risk-label">综合风险评分</div>
              </template>
            </el-progress>
          </div>

          <div class="ai-key-metrics">
            <div class="ai-key-metric">
              <span>分析时间</span>
              <strong>{{ formatAnalysisTime(mixingWorkshopAnalysis.analysisTime) }}</strong>
            </div>
            <div class="ai-key-metric">
              <span>在线传感器</span>
              <strong>{{ mixingWorkshopAnalysis.sensorCount || mixingSensorStats.length }}</strong>
            </div>
            <div class="ai-key-metric">
              <span>高风险设备</span>
              <strong>{{ highRiskCount }}</strong>
            </div>
            <div class="ai-key-metric">
              <span>未处理告警</span>
              <strong>{{ alarmCount }}</strong>
            </div>
          </div>
        </div>

        <div class="sensor-summary">
          <div class="sensor-summary-title">三参数实时概况</div>
          <div class="sensor-chips">
            <div v-for="sensor in mixingSensorStats" :key="sensor.deviceCode" class="sensor-chip">
              <div class="sensor-chip-name">{{ sensorLabel(sensor.deviceCode) }}</div>
              <div class="sensor-chip-value">{{ sensor.meanText }}</div>
            </div>
            <div v-if="!mixingSensorStats.length" class="sensor-chip sensor-chip-empty">
              暂无均值快照
            </div>
          </div>
        </div>

        <div class="line-item emphasis-line">
          <span class="line-label">分析原因</span>
          <span class="line-content">{{ mixingWorkshopAnalysis.reason || '-' }}</span>
        </div>
        <div class="line-item emphasis-line">
          <span class="line-label">操作建议</span>
          <span class="line-content">{{ mixingWorkshopAnalysis.suggestion || '-' }}</span>
        </div>
        <div class="line-item emphasis-line">
          <span class="line-label">最终决策</span>
          <span class="line-content">{{ mixingWorkshopAnalysis.finalDecision || '-' }}</span>
        </div>
      </el-card>

      <el-card
        v-else-if="showActiveBatchPanel && activeBatch"
        class="panel-card ai-panel batch-overview-panel"
        shadow="never"
      >
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">当前批次生产概况</div>
              <div class="panel-desc">
                AI 综合分析未触发时，展示当前在产批次的进度、良品率和工单完成情况。
              </div>
            </div>
            <el-tag type="warning">{{ dashboardSummary.currentStatus }}</el-tag>
          </div>
        </template>

        <div class="batch-overview-head">
          <div class="batch-overview-item">
            <span>批次号</span>
            <strong>{{ activeBatch.batchNo }}</strong>
          </div>
          <div class="batch-overview-item">
            <span>工单号</span>
            <strong>{{ activeBatch.woNo }}</strong>
          </div>
        </div>

        <div class="batch-progress-panel">
          <div class="batch-progress-header">
            <span>生产进度</span>
            <strong>{{ activeBatchProgressText }}%</strong>
          </div>
          <el-progress
            :percentage="Number(activeBatchProgressText)"
            :stroke-width="14"
            :color="'#2563eb'"
          />
          <div class="batch-progress-qty">{{ activeBatchQtyText }}</div>
        </div>

        <div class="batch-overview-metrics">
          <div class="batch-overview-metric">
            <span>良品率</span>
            <strong>{{ activeBatch.yieldRate.toFixed(2) }}%</strong>
          </div>
          <div class="batch-overview-metric">
            <span>不良品</span>
            <strong>{{ activeBatch.badQty }}</strong>
          </div>
          <div class="batch-overview-metric">
            <span>运行时长</span>
            <strong>{{ activeBatchDurationText }}</strong>
          </div>
        </div>

        <div class="batch-order-progress">
          <div class="batch-order-row">
            <span>工单总进度</span>
            <strong
              >{{ activeBatch.woCompletedQty }}/{{ activeBatch.woTargetQty }} ({{
                activeBatchOrderProgress.toFixed(1)
              }}%)</strong
            >
          </div>
          <el-progress
            :percentage="activeBatchOrderProgress"
            :stroke-width="10"
            :color="'#14b8a6'"
          />
        </div>
      </el-card>

      <el-card v-else class="panel-card ai-panel ai-panel-empty" shadow="never">
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">当前批次生产概况</div>
              <div class="panel-desc">当前没有 AI 综合态势数据，也没有正在生产的批次。</div>
            </div>
          </div>
        </template>
        <el-empty description="暂无生产中批次" :image-size="90" />
      </el-card>
    </section>

    <section class="lower-grid">
      <el-card class="panel-card alarm-panel" shadow="never">
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">告警列表</div>
              <div class="panel-desc">命中报警后自动刷新，便于值班时快速定位异常设备。</div>
            </div>
            <el-tag type="danger">未处理 {{ alarmCount }}</el-tag>
          </div>
        </template>

        <el-table :data="latestAlarms" stripe v-loading="alarmLoading" style="width: 100%">
          <el-table-column prop="deviceCode" label="设备编码" width="132" />
          <el-table-column label="工序" width="120">
            <template #default="{ row }">
              {{ getProcessLabel(row.processType) }}
            </template>
          </el-table-column>
          <el-table-column label="级别" width="100">
            <template #default="{ row }">
              <el-tag :type="alarmLevelTagType(row.alarmLevel)">
                {{ row.alarmLevel }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="alarmMsg" label="报警信息" min-width="220" show-overflow-tooltip />
          <el-table-column prop="createTime" label="时间" width="170" />
        </el-table>
      </el-card>

      <el-card class="panel-card batch-panel" shadow="never">
        <template #header>
          <div class="panel-head">
            <div>
              <div class="panel-title">生产进度与批次状态</div>
              <div class="panel-desc">按当前批次汇总监控覆盖、调配进度和风险状态。</div>
            </div>
            <el-tag type="info">{{ batchProgressList.length }} 个批次</el-tag>
          </div>
        </template>

        <el-empty
          v-if="!batchProgressList.length"
          description="暂无批次状态数据"
          :image-size="80"
        />

        <div v-else class="batch-list">
          <div v-for="batch in batchProgressList" :key="batch.batchNo" class="batch-card">
            <div class="batch-card-head">
              <div>
                <div class="batch-title">{{ batch.batchNo }}</div>
                <div class="batch-meta">
                  当前工序 {{ batch.processLabel }}
                  <span> | 设备 {{ batch.deviceCount }}</span>
                </div>
              </div>
              <el-tag :type="riskTagType(batch.riskScore, batch.riskLevel)">
                {{ batch.statusText }}
              </el-tag>
            </div>

            <div class="batch-progress-meta">
              <span>高风险设备 {{ batch.highRiskCount }}</span>
              <span>更新时间 {{ formatDashboardTimestamp(batch.latestTimestamp) }}</span>
            </div>

            <div v-if="batch.progressPercent !== null" class="batch-progress-wrap">
              <div class="batch-progress-label">调配进度 {{ batch.progressPercent }}%</div>
              <el-progress
                :percentage="batch.progressPercent"
                :stroke-width="10"
                :color="riskColor(batch.riskScore)"
              />
            </div>

            <div v-else class="batch-progress-placeholder">
              当前批次处于稳定监控阶段，重点关注风险等级与告警联动结果。
            </div>
          </div>
        </div>
      </el-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { getAiLatest, type AiAnalysisResult } from '@/api/ai'
import { getAlarmList, getUnhandledAlarmCount, type AlarmRecord } from '@/api/alarm'
import { getProductionStats } from '@/api/dashboard'
import { getDeviceList, type Device } from '@/api/device'
import { useDictData } from '@/composables/useDictData'
import { DICT_TYPE } from '@/constants/dict'
import {
  onAiAnalysisPush,
  onAlarmPush,
  onAlarmWsStatusChange,
  onDashboardPush,
  onFastRiskPush,
  type DashboardActiveBatch,
  type DashboardPushData,
} from '@/utils/alarmWs'
import { ElNotification } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const STATS_REFRESH_INTERVAL = 60000
const MIXING_WORKSHOP_CODE = 'MIXING_WORKSHOP'
const REALTIME_HISTORY_WINDOW_MS = 60000
const REALTIME_HISTORY_MAX_POINTS = 120
const CURVE_WIDTH = 320
const CURVE_HEIGHT = 120
const CURVE_PADDING_X = 8
const CURVE_PADDING_Y = 10

interface FastRiskPayload {
  deviceCode: string
  batchNo: string
  processType: string
  currentValue: number
  riskFast: number
  riskLevel: string
  deviation: number
  slope: number
  volatility: number
  etaSeconds: number
  target: number
  minThreshold: number
  maxThreshold: number
  timestamp: number
}

interface DashboardDevicePayload {
  deviceCode: string
  processType: string
  value: number
  batchNo: string
  ts: number
}

interface DashboardCardItem {
  deviceCode: string
  processType: string
  batchNo: string
  aiAnalysis?: AiAnalysisResult
  fastRisk?: FastRiskPayload
  dashboardMetric?: DashboardDevicePayload
  displayRiskScore: number
  displayRiskLevel: string
}

interface RealtimeMonitorItem {
  deviceCode: string
  processType: string
  batchNo: string
  currentValue: number
  riskFast: number
  riskLevel: string
  minThreshold?: number
  maxThreshold?: number
  target?: number
  timestamp: number
}

interface RealtimeHistoryPoint {
  timestamp: number
  value: number
  minThreshold?: number
  maxThreshold?: number
}

interface RealtimeCurveCard extends RealtimeMonitorItem {
  points: RealtimeHistoryPoint[]
  minObserved: number
  maxObserved: number
  scaleMin: number
  scaleMax: number
  pointCount: number
}

interface SensorMeanStat {
  deviceCode: string
  mean: number
  meanText: string
}

interface DeviceMetaItem {
  deviceCode: string
  deviceName: string
  deviceType: string
}

interface DashboardSummaryState {
  todayTotalQty: number
  todayBadQty: number
  todayYieldRate: number
  todayBatchCount: number
  currentStatus: string
  currentBatchNo: string
  unhandledAlarms: number
}

interface ActiveBatchState {
  batchNo: string
  targetQty: number
  actualQty: number
  badQty: number
  progress: number
  yieldRate: number
  duration: string
  durationSec: number
  woNo: string
  woTargetQty: number
  woCompletedQty: number
}

interface BatchProgressItem {
  batchNo: string
  processLabel: string
  deviceCount: number
  highRiskCount: number
  riskScore: number
  riskLevel: string
  statusText: string
  progressPercent: number | null
  latestTimestamp: number
}

interface SensorDescriptor {
  title: string
  shortLabel: string
  unit: string
}

const { getLabel: getProcessDictLabel, load: loadProcessDict } = useDictData(DICT_TYPE.PROCESS_TYPE)

const loading = ref(false)
const alarmLoading = ref(false)
const wsConnected = ref(false)
const alarmCount = ref(0)
const deviceCodes = ref<string[]>([])
const realtimeHistoryMap = ref<Record<string, RealtimeHistoryPoint[]>>({})
const realtimeWindowClock = ref(Date.now())
const latestAlarms = ref<AlarmRecord[]>([])
const aiCardsMap = ref<Record<string, AiAnalysisResult>>({})
const fastRiskMap = ref<Record<string, FastRiskPayload>>({})
const dashboardMetricMap = ref<Record<string, DashboardDevicePayload>>({})
const deviceMetaMap = ref<Record<string, DeviceMetaItem>>({})
const productionStats = ref({
  totalOutput: 0,
  qualificationRate: 0,
  lastUpdated: '',
})
const dashboardSummary = ref<DashboardSummaryState>({
  todayTotalQty: 0,
  todayBadQty: 0,
  todayYieldRate: 0,
  todayBatchCount: 0,
  currentStatus: '待同步',
  currentBatchNo: '—',
  unhandledAlarms: 0,
})
const activeBatch = ref<ActiveBatchState | null>(null)

let statsRefreshTimer: number | null = null
let alarmRefreshTimer: number | null = null
let realtimeWindowTimer: number | null = null
let stopDashboardListener: (() => void) | null = null
let stopFastRiskListener: (() => void) | null = null
let stopAiAnalysisListener: (() => void) | null = null
let stopAlarmListener: (() => void) | null = null
let stopWsStatusListener: (() => void) | null = null
const aiLastAppliedAt = new Map<string, number>()
const aiPendingByDevice = new Map<string, AiAnalysisResult>()
const aiThrottleTimerByDevice = new Map<string, number>()

const compareDeviceCode = (left: string, right: string) =>
  left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })

const mixingWorkshopAnalysis = computed(() => aiCardsMap.value[MIXING_WORKSHOP_CODE])
const showAiAnalysisPanel = computed(() => Boolean(mixingWorkshopAnalysis.value))
const showActiveBatchPanel = computed(
  () => !showAiAnalysisPanel.value && Boolean(activeBatch.value),
)
const isIdleStatus = computed(() => dashboardSummary.value.currentStatus.includes('空闲'))
const freezeRealtimeCurves = computed(() => !showAiAnalysisPanel.value && !activeBatch.value)
const curveWindowLabel = computed(() =>
  freezeRealtimeCurves.value ? '最近一批次窗口' : '最近 60 秒',
)

const mixingSensorStats = computed<SensorMeanStat[]>(() => {
  const snapshot = mixingWorkshopAnalysis.value?.statsSnapshot || ''
  return parseStatsSnapshot(snapshot)
})

const activeBatchProgressText = computed(() => {
  if (!activeBatch.value) return '0.0'
  return Number(activeBatch.value.progress || 0).toFixed(1)
})

const activeBatchQtyText = computed(() => {
  if (!activeBatch.value) return '0 / 0'
  return `${activeBatch.value.actualQty} / ${activeBatch.value.targetQty}`
})

const activeBatchOrderProgress = computed(() => {
  if (!activeBatch.value) return 0
  const target = Number(activeBatch.value.woTargetQty || 0)
  if (!target) return 0
  return Number(((Number(activeBatch.value.woCompletedQty || 0) / target) * 100).toFixed(1))
})

const activeBatchDurationText = computed(() => {
  if (!activeBatch.value) return '—'
  const duration = String(activeBatch.value.duration || '').trim()
  if (!duration) return '—'
  return duration.startsWith('00:') ? duration.slice(3) : duration
})

const realtimeMonitorList = computed<RealtimeMonitorItem[]>(() => {
  const deviceOrder = new Map(deviceCodes.value.map((code, index) => [code, index]))
  const fastRiskItems = Object.values(fastRiskMap.value).map((item) => ({
    deviceCode: item.deviceCode,
    processType: item.processType,
    batchNo: item.batchNo,
    currentValue: item.currentValue,
    riskFast: item.riskFast,
    riskLevel: item.riskLevel,
    minThreshold: item.minThreshold,
    maxThreshold: item.maxThreshold,
    target: item.target,
    timestamp: item.timestamp,
  }))

  const fastRiskCodes = new Set(fastRiskItems.map((item) => item.deviceCode))
  const dashboardItems = Object.values(dashboardMetricMap.value)
    .filter((item) => !fastRiskCodes.has(item.deviceCode))
    .map((item) => ({
      deviceCode: item.deviceCode,
      processType: item.processType,
      batchNo: item.batchNo,
      currentValue: item.value,
      riskFast: 0,
      riskLevel: '在线',
      timestamp: item.ts,
    }))

  return [...fastRiskItems, ...dashboardItems].sort((a, b) => {
    const aOrder = deviceOrder.get(a.deviceCode)
    const bOrder = deviceOrder.get(b.deviceCode)

    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder
    }
    if (aOrder !== undefined) return -1
    if (bOrder !== undefined) return 1

    return compareDeviceCode(a.deviceCode, b.deviceCode)
  })
})

const realtimeCurveCards = computed<RealtimeCurveCard[]>(() => {
  const cutoff = realtimeWindowClock.value - REALTIME_HISTORY_WINDOW_MS

  return realtimeMonitorList.value
    .map((item) => {
      const historyPoints = realtimeHistoryMap.value[item.deviceCode] || []
      const points = freezeRealtimeCurves.value
        ? historyPoints
        : historyPoints.filter((point) => point.timestamp >= cutoff)

      if (!points.length) return null

      const values = points.map((point) => point.value)
      let minObserved = Math.min(...values)
      let maxObserved = Math.max(...values)

      if (item.minThreshold !== undefined) {
        minObserved = Math.min(minObserved, Number(item.minThreshold))
      }
      if (item.maxThreshold !== undefined) {
        maxObserved = Math.max(maxObserved, Number(item.maxThreshold))
      }

      if (minObserved === maxObserved) {
        const padding = Math.max(Math.abs(minObserved) * 0.05, 1)
        minObserved -= padding
        maxObserved += padding
      }

      const displayRange = Math.max(maxObserved - minObserved, 1)
      const midpoint = (minObserved + maxObserved) / 2
      const scalePadding = Math.max(displayRange * 0.25, Math.abs(midpoint) * 0.02)
      const scaleMin = minObserved - scalePadding
      const scaleMax = maxObserved + scalePadding

      return {
        ...item,
        points,
        minObserved,
        maxObserved,
        scaleMin,
        scaleMax,
        pointCount: points.length,
      } as RealtimeCurveCard
    })
    .filter((item): item is RealtimeCurveCard => !!item)
})

const cardList = computed<DashboardCardItem[]>(() => {
  const deviceOrder = new Map(deviceCodes.value.map((code, index) => [code, index]))
  const codes = new Set<string>([
    ...Object.keys(aiCardsMap.value),
    ...Object.keys(fastRiskMap.value),
    ...Object.keys(dashboardMetricMap.value),
    ...deviceCodes.value,
  ])

  return Array.from(codes)
    .filter((code) => code !== MIXING_WORKSHOP_CODE)
    .map((code) => {
      const aiAnalysis = aiCardsMap.value[code]
      const fastRisk = fastRiskMap.value[code]
      const dashboardMetric = dashboardMetricMap.value[code]
      const displayRiskScore = fastRisk?.riskFast ?? Number(aiAnalysis?.riskScore || 0)
      const displayRiskLevel =
        fastRisk?.riskLevel || aiAnalysis?.riskLevel || (dashboardMetric ? '在线' : 'LOW')

      return {
        deviceCode: code,
        processType:
          fastRisk?.processType || dashboardMetric?.processType || aiAnalysis?.processType || '',
        batchNo: fastRisk?.batchNo || dashboardMetric?.batchNo || aiAnalysis?.batchNo || '',
        aiAnalysis,
        fastRisk,
        dashboardMetric,
        displayRiskScore,
        displayRiskLevel,
      }
    })
    .filter((item) => item.aiAnalysis || item.fastRisk || item.dashboardMetric)
    .sort((a, b) => {
      const aOrder = deviceOrder.get(a.deviceCode)
      const bOrder = deviceOrder.get(b.deviceCode)

      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder
      }
      if (aOrder !== undefined) return -1
      if (bOrder !== undefined) return 1

      return a.deviceCode.localeCompare(b.deviceCode)
    })
})

const riskCountCards = computed(() => cardList.value.filter((item) => !isRampRisk(item.fastRisk)))

const highRiskCount = computed(
  () => riskCountCards.value.filter((item) => item.displayRiskScore >= 0.8).length,
)
const midRiskCount = computed(
  () =>
    riskCountCards.value.filter(
      (item) => item.displayRiskScore >= 0.6 && item.displayRiskScore < 0.8,
    ).length,
)
const lowRiskCount = computed(
  () => riskCountCards.value.filter((item) => item.displayRiskScore < 0.6).length,
)

const overallRiskScore = computed(() => {
  if (mixingWorkshopAnalysis.value) return Number(mixingWorkshopAnalysis.value.riskScore || 0)
  if (!riskCountCards.value.length) return 0
  const totalScore = riskCountCards.value.reduce(
    (sum, item) => sum + Number(item.displayRiskScore || 0),
    0,
  )
  return totalScore / riskCountCards.value.length
})

const overallRiskScoreText = computed(() => overallRiskScore.value.toFixed(2))

const overallRiskLevelText = computed(() => {
  if (mixingWorkshopAnalysis.value?.riskLevel) {
    return displayRiskLevelText(mixingWorkshopAnalysis.value.riskLevel)
  }
  if (overallRiskScore.value >= 0.8) return '高风险'
  if (overallRiskScore.value >= 0.6) return '中风险'
  return '低风险'
})

const batchProgressList = computed<BatchProgressItem[]>(() => {
  const groups = new Map<
    string,
    {
      batchNo: string
      processType: string
      deviceCount: number
      highRiskCount: number
      riskScore: number
      riskLevel: string
      progressValues: number[]
      latestTimestamp: number
    }
  >()

  cardList.value.forEach((item) => {
    const batchNo = item.batchNo || '未绑定批次'
    const current = groups.get(batchNo) || {
      batchNo,
      processType: item.processType,
      deviceCount: 0,
      highRiskCount: 0,
      riskScore: 0,
      riskLevel: '',
      progressValues: [],
      latestTimestamp: 0,
    }

    current.deviceCount += 1
    current.processType = current.processType || item.processType
    current.riskScore = Math.max(current.riskScore, Number(item.displayRiskScore || 0))

    const normalizedLevel = String(item.displayRiskLevel || '').toUpperCase()
    if (normalizedLevel === 'HIGH' || Number(item.displayRiskScore || 0) >= 0.8) {
      current.highRiskCount += 1
      current.riskLevel = 'HIGH'
    } else if (
      current.riskLevel !== 'HIGH' &&
      (normalizedLevel === 'MEDIUM' || Number(item.displayRiskScore || 0) >= 0.6)
    ) {
      current.riskLevel = 'MEDIUM'
    } else if (!current.riskLevel) {
      current.riskLevel = normalizedLevel || 'LOW'
    }

    if (item.fastRisk && isRampRisk(item.fastRisk)) {
      current.progressValues.push(rampProgress(item.fastRisk))
    }

    current.latestTimestamp = Math.max(
      current.latestTimestamp,
      Number(item.fastRisk?.timestamp || item.dashboardMetric?.ts || 0),
    )

    groups.set(batchNo, current)
  })

  return Array.from(groups.values())
    .map((item) => {
      const progressPercent = item.progressValues.length
        ? Math.round(
            item.progressValues.reduce((sum, value) => sum + value, 0) / item.progressValues.length,
          )
        : null

      let statusText = '平稳'
      if (item.riskLevel === 'HIGH' || item.riskScore >= 0.8) statusText = '重点关注'
      else if (item.riskLevel === 'MEDIUM' || item.riskScore >= 0.6) statusText = '波动预警'
      else if (progressPercent !== null) statusText = '调配进行中'

      return {
        batchNo: item.batchNo,
        processLabel: getProcessLabel(item.processType) || '综合监控',
        deviceCount: item.deviceCount,
        highRiskCount: item.highRiskCount,
        riskScore: item.riskScore,
        riskLevel: item.riskLevel || 'LOW',
        statusText,
        progressPercent,
        latestTimestamp: item.latestTimestamp,
      }
    })
    .sort((left, right) => right.latestTimestamp - left.latestTimestamp)
    .slice(0, 6)
})

const clamp01 = (num: number) => Math.min(1, Math.max(0, Number(num || 0)))

const riskColor = (score: number) => {
  if (score >= 0.8) return '#F56C6C'
  if (score >= 0.6) return '#E6A23C'
  return '#67C23A'
}

const riskTagType = (score: number, level?: string) => {
  const normalizedLevel = String(level || '').toUpperCase()
  if (normalizedLevel === 'RAMP') return 'info'
  if (normalizedLevel === '在线') return 'info'
  if (normalizedLevel === 'HIGH') return 'danger'
  if (normalizedLevel === 'MEDIUM') return 'warning'
  if (normalizedLevel === 'LOW') return 'success'

  if (score >= 0.8) return 'danger'
  if (score >= 0.6) return 'warning'
  return 'success'
}

const displayRiskLevelText = (level?: string) => {
  const normalizedLevel = String(level || '').toUpperCase()
  if (normalizedLevel === 'RAMP') return '调配中'
  if (String(level || '') === '在线') return '在线'
  if (normalizedLevel === 'HIGH') return '高风险'
  if (normalizedLevel === 'MEDIUM') return '中风险'
  if (normalizedLevel === 'LOW') return '低风险'
  return String(level || 'LOW')
}

const inferSensorKind = (payload: {
  deviceCode?: string
  deviceType?: string
  deviceName?: string
  processType?: string
  target?: number
  minThreshold?: number
  maxThreshold?: number
}) => {
  const normalizedDeviceType = String(payload.deviceType || '').toUpperCase()
  const normalizedDeviceName = String(payload.deviceName || '').toUpperCase()
  const normalizedProcessType = String(payload.processType || '').toUpperCase()
  const minThreshold = Number(payload.minThreshold ?? Number.NaN)
  const maxThreshold = Number(payload.maxThreshold ?? Number.NaN)
  const target = Number(payload.target ?? Number.NaN)

  if (normalizedDeviceType.includes('BRIX') || normalizedDeviceName.includes('糖')) return 'BRIX'
  if (normalizedDeviceType.includes('TEMP') || normalizedDeviceName.includes('温')) return 'TEMP'
  if (normalizedDeviceType.includes('PH') || normalizedDeviceName.includes('PH')) return 'PH'

  if (normalizedProcessType.includes('BRIX')) return 'BRIX'
  if (normalizedProcessType.includes('TEMP')) return 'TEMP'
  if (normalizedProcessType.includes('PH')) return 'PH'

  if (!Number.isNaN(maxThreshold) && maxThreshold <= 6) return 'PH'
  if (!Number.isNaN(maxThreshold) && maxThreshold >= 40) return 'TEMP'
  if (
    !Number.isNaN(target) &&
    !Number.isNaN(minThreshold) &&
    !Number.isNaN(maxThreshold) &&
    target >= 6 &&
    maxThreshold <= 20
  ) {
    return 'BRIX'
  }

  return ''
}

const getSensorDescriptor = (payload: {
  deviceCode?: string
  processType?: string
  deviceType?: string
  deviceName?: string
  target?: number
  minThreshold?: number
  maxThreshold?: number
}): SensorDescriptor => {
  const deviceCode = String(payload.deviceCode || '')
  const meta = deviceMetaMap.value[deviceCode]
  const sensorKind = inferSensorKind({
    ...payload,
    deviceType: payload.deviceType || meta?.deviceType,
    deviceName: payload.deviceName || meta?.deviceName,
  })

  if (sensorKind === 'BRIX') {
    return {
      title: '糖度传感器',
      shortLabel: '糖度',
      unit: '°Bx',
    }
  }

  if (sensorKind === 'TEMP') {
    return {
      title: '温度传感器',
      shortLabel: '温度',
      unit: '℃',
    }
  }

  if (sensorKind === 'PH') {
    return {
      title: 'pH 传感器',
      shortLabel: 'pH',
      unit: 'pH',
    }
  }

  return {
    title: meta?.deviceName || getProcessLabel(payload.processType) || '传感器',
    shortLabel: meta?.deviceName || getProcessLabel(payload.processType) || '监测值',
    unit: '',
  }
}

const sensorTitle = (payload: {
  deviceCode?: string
  processType?: string
  target?: number
  minThreshold?: number
  maxThreshold?: number
}) => getSensorDescriptor(payload).title

const sensorShortLabel = (payload: {
  deviceCode?: string
  processType?: string
  target?: number
  minThreshold?: number
  maxThreshold?: number
}) => getSensorDescriptor(payload).shortLabel

const isRampRisk = (fastRisk?: FastRiskPayload | null) =>
  String(fastRisk?.riskLevel || '').toUpperCase() === 'RAMP'

const isRampRealtime = (item: RealtimeMonitorItem) =>
  String(item.riskLevel || '').toUpperCase() === 'RAMP'

const rampProgressValue = (
  currentValue?: number,
  target?: number,
  minThreshold?: number,
  maxThreshold?: number,
) => {
  const normalizedTarget = Number(target || 0)
  const normalizedCurrentValue = Number(currentValue || 0)

  const normalizedMinThreshold = Number(minThreshold)
  const normalizedMaxThreshold = Number(maxThreshold)
  const hasValidRange =
    !Number.isNaN(normalizedMinThreshold) &&
    !Number.isNaN(normalizedMaxThreshold) &&
    normalizedMaxThreshold > normalizedMinThreshold

  if (hasValidRange) {
    const distanceToRange =
      normalizedCurrentValue < normalizedMinThreshold
        ? normalizedMinThreshold - normalizedCurrentValue
        : normalizedCurrentValue > normalizedMaxThreshold
          ? normalizedCurrentValue - normalizedMaxThreshold
          : 0

    const baselineDistance = Math.max(
      Math.abs(normalizedTarget || 0),
      Math.abs(normalizedMaxThreshold - normalizedMinThreshold),
      1,
    )

    return Math.round(clamp01(1 - distanceToRange / baselineDistance) * 100)
  }

  if (normalizedTarget === 0) return 0
  return Math.round(clamp01(Math.abs(normalizedCurrentValue) / Math.abs(normalizedTarget)) * 100)
}

const rampProgress = (fastRisk: FastRiskPayload) => {
  return rampProgressValue(
    fastRisk.currentValue,
    fastRisk.target,
    fastRisk.minThreshold,
    fastRisk.maxThreshold,
  )
}

const fastRiskProgress = (fastRisk: FastRiskPayload) => {
  if (isRampRisk(fastRisk)) {
    return rampProgress(fastRisk)
  }
  return Math.round(clamp01(fastRisk.riskFast) * 100)
}

const formatRealtimeValue = (value: number) => Number(value || 0).toFixed(2)

const formatDashboardTimestamp = (timestamp?: number) => {
  const value = Number(timestamp || 0)
  if (!value) return '-'
  return new Date(value).toLocaleTimeString()
}

const formatAnalysisTime = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '-'

  if (typeof value === 'number') {
    return new Date(value).toLocaleString()
  }

  const normalized = String(value).trim()
  if (!normalized) return '-'

  const sanitized = normalized
    .replace('T', ' ')
    .replace(/(\.\d{3})\d+/, '$1')
    .replace(/\.0+$/, '')

  const date = new Date(normalized)
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString()
  }

  return sanitized
}

const normalizeActiveBatch = (payload?: DashboardActiveBatch | null): ActiveBatchState | null => {
  if (!payload || !payload.batchNo) return null

  return {
    batchNo: String(payload.batchNo || ''),
    targetQty: Number(payload.targetQty || 0),
    actualQty: Number(payload.actualQty || 0),
    badQty: Number(payload.badQty || 0),
    progress: Number(payload.progress || 0),
    yieldRate: Number(payload.yieldRate || 0),
    duration: String(payload.duration || ''),
    durationSec: Number(payload.durationSec || 0),
    woNo: String(payload.woNo || '—'),
    woTargetQty: Number(payload.woTargetQty || 0),
    woCompletedQty: Number(payload.woCompletedQty || 0),
  }
}

const curveY = (value: number, minObserved: number, maxObserved: number) => {
  const range = Math.max(maxObserved - minObserved, 1)
  const ratio = (value - minObserved) / range
  return CURVE_HEIGHT - CURVE_PADDING_Y - ratio * (CURVE_HEIGHT - CURVE_PADDING_Y * 2)
}

const curveX = (index: number, total: number) => {
  if (total <= 1) return CURVE_WIDTH / 2
  return CURVE_PADDING_X + (index / (total - 1)) * (CURVE_WIDTH - CURVE_PADDING_X * 2)
}

const curvePolylinePoints = (
  points: RealtimeHistoryPoint[],
  minObserved: number,
  maxObserved: number,
) => {
  return points
    .map(
      (point, index) =>
        `${curveX(index, points.length)},${curveY(point.value, minObserved, maxObserved)}`,
    )
    .join(' ')
}

const curveLastPoint = (
  points: RealtimeHistoryPoint[],
  minObserved: number,
  maxObserved: number,
) => {
  const lastIndex = Math.max(points.length - 1, 0)
  const lastPoint = points[lastIndex]

  return {
    x: curveX(lastIndex, points.length),
    y: curveY(Number(lastPoint?.value || 0), minObserved, maxObserved),
  }
}

const curveReferenceY = (value: number, minObserved: number, maxObserved: number) => {
  return curveY(Number(value || 0), minObserved, maxObserved)
}

const realtimeUnit = (payload: {
  deviceCode?: string
  processType?: string
  target?: number
  minThreshold?: number
  maxThreshold?: number
}) => getSensorDescriptor(payload).unit

const riskPanelClass = (score: number, level?: string) => {
  const normalizedLevel = String(level || '').toUpperCase()
  if (normalizedLevel === 'HIGH' || String(level || '').includes('高') || score >= 0.8) {
    return 'risk-high'
  }
  if (normalizedLevel === 'MEDIUM' || String(level || '').includes('中') || score >= 0.6) {
    return 'risk-medium'
  }
  return 'risk-low'
}

const alarmLevelTagType = (level?: string) => {
  const normalizedLevel = String(level || '').toUpperCase()
  if (normalizedLevel === 'CRITICAL') return 'danger'
  if (normalizedLevel === 'WARNING') return 'warning'
  return 'info'
}

const parseStatsSnapshot = (snapshot = ''): SensorMeanStat[] => {
  if (!snapshot) return []

  return snapshot
    .replace(' [COMPREHENSIVE]', '')
    .split(' | ')
    .map((part) => {
      const [deviceCode, meanPart] = part.split(': mean=')
      const mean = Number.parseFloat(meanPart || '')
      return {
        deviceCode: String(deviceCode || '').trim(),
        mean,
        meanText: Number.isNaN(mean) ? '-' : String(mean),
      }
    })
    .filter((item) => item.deviceCode && !Number.isNaN(item.mean))
}

const sensorLabel = (deviceCode: string) => {
  const descriptor = getSensorDescriptor({ deviceCode })
  return descriptor.unit ? `${descriptor.shortLabel}(${descriptor.unit})` : descriptor.shortLabel
}

const processLabelOverrides: Record<string, string> = {
  MIXING_COMPREHENSIVE: '配液综合分析',
  BRIX: '糖度',
  PH: 'pH',
  TEMP: '温度',
  TEMPERATURE: '温度',
  VOLUME: '容量',
  WEIGHT: '重量',
  TORQUE: '扭矩',
}

const originalGetProcessLabel = getProcessDictLabel
const getProcessLabel = (value?: string | number) => {
  const key = String(value || '')
  return processLabelOverrides[key] || originalGetProcessLabel(value)
}

const upsertAiCard = (item: AiAnalysisResult) => {
  aiCardsMap.value = {
    ...aiCardsMap.value,
    [item.deviceCode]: item,
  }
}

const upsertFastRisk = (item: FastRiskPayload) => {
  fastRiskMap.value = {
    ...fastRiskMap.value,
    [item.deviceCode]: item,
  }
}

const appendRealtimeHistory = (deviceCode: string, point: RealtimeHistoryPoint) => {
  if (!deviceCode) return

  const cutoff = realtimeWindowClock.value - REALTIME_HISTORY_WINDOW_MS
  const next = [...(realtimeHistoryMap.value[deviceCode] || []), point]
    .filter((item) => item.timestamp >= cutoff)
    .slice(-REALTIME_HISTORY_MAX_POINTS)

  realtimeHistoryMap.value = {
    ...realtimeHistoryMap.value,
    [deviceCode]: next,
  }
}

const upsertDashboardMetrics = (
  items: Record<string, DashboardDevicePayload>,
  summary?: Partial<DashboardSummaryState>,
  batch?: ActiveBatchState | null,
) => {
  dashboardMetricMap.value = {
    ...dashboardMetricMap.value,
    ...items,
  }

  if (summary) {
    dashboardSummary.value = {
      ...dashboardSummary.value,
      ...summary,
    }
  }

  activeBatch.value = batch || null

  if (summary?.todayTotalQty !== undefined || summary?.todayYieldRate !== undefined) {
    productionStats.value = {
      ...productionStats.value,
      totalOutput: Number(summary?.todayTotalQty ?? productionStats.value.totalOutput ?? 0),
      qualificationRate: Number(
        summary?.todayYieldRate ?? productionStats.value.qualificationRate ?? 0,
      ),
      lastUpdated: new Date().toLocaleString(),
    }
  }
}

const normalizeDashboardPush = (data: DashboardPushData) => {
  const rawDevices = data.devices || {}
  const metrics = Object.fromEntries(
    Object.entries(rawDevices).map(([deviceCode, item]) => {
      const record = typeof item === 'number' ? { value: item } : (item as Record<string, unknown>)
      return [
        deviceCode,
        {
          deviceCode: String(record.deviceCode || deviceCode),
          processType: String(record.processType || ''),
          value: Number(record.value || 0),
          batchNo: String(record.batchNo || ''),
          ts: Number(record.ts || data.timestamp || Date.now()),
        } as DashboardDevicePayload,
      ]
    }),
  )

  return {
    metrics,
    summary: {
      todayTotalQty: Number(data.todayTotalQty ?? data.productionCount ?? 0),
      todayBadQty: Number(data.todayBadQty ?? 0),
      todayYieldRate: Number(data.todayYieldRate ?? 0),
      todayBatchCount: Number(data.todayBatchCount ?? 0),
      currentStatus: String(data.currentStatus || '待同步'),
      currentBatchNo: String(data.currentBatchNo || '—'),
      unhandledAlarms: Number(data.unhandledAlarms ?? 0),
    },
    activeBatch: normalizeActiveBatch(data.activeBatch),
  }
}

const clearAiThrottleTimers = () => {
  aiThrottleTimerByDevice.forEach((timer) => window.clearTimeout(timer))
  aiThrottleTimerByDevice.clear()
}

const applyAiUpdateThrottled = (item: AiAnalysisResult) => {
  const now = Date.now()
  const lastAppliedAt = aiLastAppliedAt.get(item.deviceCode) || 0
  const elapsed = now - lastAppliedAt
  const throttleMs = 10000

  if (elapsed >= throttleMs) {
    upsertAiCard(item)
    aiLastAppliedAt.set(item.deviceCode, now)
    return
  }

  aiPendingByDevice.set(item.deviceCode, item)
  if (aiThrottleTimerByDevice.has(item.deviceCode)) return

  const remainMs = throttleMs - elapsed
  const timer = window.setTimeout(() => {
    aiThrottleTimerByDevice.delete(item.deviceCode)
    const pending = aiPendingByDevice.get(item.deviceCode)
    if (!pending) return
    aiPendingByDevice.delete(item.deviceCode)
    upsertAiCard(pending)
    aiLastAppliedAt.set(item.deviceCode, Date.now())
  }, remainMs)
  aiThrottleTimerByDevice.set(item.deviceCode, timer)
}

const normalizeDeviceMeta = (device: Device): DeviceMetaItem => ({
  deviceCode: device.deviceCode,
  deviceName: String(device.deviceName || ''),
  deviceType: String(device.deviceType || ''),
})

const loadDeviceCodes = async () => {
  const res = await getDeviceList({ pageNum: 1, pageSize: 200 })
  deviceCodes.value = res.data.records
    .map((d) => d.deviceCode)
    .filter(Boolean)
    .sort(compareDeviceCode)
  deviceMetaMap.value = Object.fromEntries(
    res.data.records
      .filter((device) => device.deviceCode)
      .map((device) => {
        const normalized = normalizeDeviceMeta(device)
        return [normalized.deviceCode, normalized]
      }),
  )
}

const loadLatestForDevices = async () => {
  const latestTargets = [MIXING_WORKSHOP_CODE]
  if (!latestTargets.length) return
  await Promise.all(
    latestTargets.map(async (deviceCode) => {
      try {
        const res = await getAiLatest(deviceCode, {
          skipErrorMessage: true,
          skipErrorLog: true,
        })
        if (res.data) {
          upsertAiCard(res.data)
        }
      } catch {
        // 配液车间首次接入或尚无分析记录时，控制台按空态展示即可。
      }
    }),
  )
}

const loadLatestAlarms = async () => {
  alarmLoading.value = true
  try {
    const res = await getAlarmList({ pageNum: 1, pageSize: 6 })
    latestAlarms.value = res.data.records
  } finally {
    alarmLoading.value = false
  }
}

const loadAlarmCount = async () => {
  const res = await getUnhandledAlarmCount()
  alarmCount.value = res.data
  dashboardSummary.value = {
    ...dashboardSummary.value,
    unhandledAlarms: Number(res.data || 0),
  }
}

const loadProductionStats = async () => {
  const res = await getProductionStats('today')
  const rawRate = Number(res.data.qualificationRate || 0)
  const totalOutput = Number(res.data.totalOutput || 0)
  const qualificationRate = Number((rawRate > 1 ? rawRate : rawRate * 100).toFixed(2))
  productionStats.value = {
    totalOutput,
    qualificationRate,
    lastUpdated: new Date().toLocaleString(),
  }
  dashboardSummary.value = {
    ...dashboardSummary.value,
    todayTotalQty: totalOutput,
    todayYieldRate: qualificationRate,
  }
}

const logLoadFailure = (scope: string, result: PromiseSettledResult<unknown>) => {
  if (result.status === 'rejected') {
    console.error(`[AiDashboard] ${scope} 加载失败:`, result.reason)
  }
}

const refreshAll = async () => {
  loading.value = true
  try {
    const results = await Promise.allSettled([
      loadProcessDict(),
      (async () => {
        await loadDeviceCodes()
        await loadLatestForDevices()
      })(),
      loadLatestAlarms(),
      loadAlarmCount(),
      loadProductionStats(),
    ])

    logLoadFailure('工序字典', results[0])
    logLoadFailure('设备与最新分析', results[1])
    logLoadFailure('最新报警', results[2])
    logLoadFailure('报警数', results[3])
    logLoadFailure('生产统计', results[4])
  } finally {
    loading.value = false
  }
}

const scheduleAlarmRefresh = () => {
  if (alarmRefreshTimer) return
  alarmRefreshTimer = window.setTimeout(() => {
    alarmRefreshTimer = null
    void loadLatestAlarms()
  }, 300)
}

const startStatsPolling = () => {
  statsRefreshTimer = window.setInterval(() => {
    void loadProductionStats()
  }, STATS_REFRESH_INTERVAL)
}

const stopStatsPolling = () => {
  if (statsRefreshTimer) {
    window.clearInterval(statsRefreshTimer)
    statsRefreshTimer = null
  }
}

const clearAlarmRefreshTimer = () => {
  if (alarmRefreshTimer) {
    window.clearTimeout(alarmRefreshTimer)
    alarmRefreshTimer = null
  }
}

const startRealtimeWindowClock = () => {
  realtimeWindowTimer = window.setInterval(() => {
    realtimeWindowClock.value = Date.now()
  }, 1000)
}

const stopRealtimeWindowClock = () => {
  if (realtimeWindowTimer) {
    window.clearInterval(realtimeWindowTimer)
    realtimeWindowTimer = null
  }
}

onMounted(async () => {
  startRealtimeWindowClock()
  stopWsStatusListener = onAlarmWsStatusChange((connected) => {
    wsConnected.value = connected
  })
  stopDashboardListener = onDashboardPush((data) => {
    const normalized = normalizeDashboardPush(data)
    upsertDashboardMetrics(normalized.metrics, normalized.summary, normalized.activeBatch)
    Object.values(normalized.metrics).forEach((item) => {
      appendRealtimeHistory(item.deviceCode, {
        timestamp: Number(item.ts || Date.now()),
        value: Number(item.value || 0),
      })
    })
  })
  stopFastRiskListener = onFastRiskPush((data) => {
    upsertFastRisk(data)
    appendRealtimeHistory(data.deviceCode, {
      timestamp: Number(data.timestamp || Date.now()),
      value: Number(data.currentValue || 0),
      minThreshold: Number.isFinite(Number(data.minThreshold))
        ? Number(data.minThreshold)
        : undefined,
      maxThreshold: Number.isFinite(Number(data.maxThreshold))
        ? Number(data.maxThreshold)
        : undefined,
    })
  })
  stopAiAnalysisListener = onAiAnalysisPush((data) => {
    applyAiUpdateThrottled(data)
    if (data.deviceCode === MIXING_WORKSHOP_CODE && Number(data.riskScore || 0) >= 0.6) {
      ElNotification({
        title: '配液车间综合预警',
        message: data.reason || data.finalDecision || '综合风险升高，请尽快关注',
        type: 'warning',
        duration: 5000,
      })
    }
  })
  stopAlarmListener = onAlarmPush(() => {
    alarmCount.value += 1
    dashboardSummary.value = {
      ...dashboardSummary.value,
      unhandledAlarms: dashboardSummary.value.unhandledAlarms + 1,
    }
    scheduleAlarmRefresh()
  })
  await refreshAll()
  startStatsPolling()
})

onBeforeUnmount(() => {
  stopStatsPolling()
  stopRealtimeWindowClock()
  clearAlarmRefreshTimer()
  clearAiThrottleTimers()
  aiPendingByDevice.clear()
  aiLastAppliedAt.clear()
  fastRiskMap.value = {}
  dashboardMetricMap.value = {}
  realtimeHistoryMap.value = {}
  if (stopWsStatusListener) stopWsStatusListener()
  if (stopDashboardListener) stopDashboardListener()
  if (stopFastRiskListener) stopFastRiskListener()
  if (stopAiAnalysisListener) stopAiAnalysisListener()
  if (stopAlarmListener) stopAlarmListener()
})
</script>

<style scoped>
.console-page {
  padding: 20px;
  background:
    radial-gradient(circle at top left, rgba(245, 158, 11, 0.14), transparent 22%),
    linear-gradient(180deg, #fff9f2 0%, #f8fbff 38%, #ffffff 100%);
}

.console-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 14px 18px;
  border-radius: 18px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.toolbar-title {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.toolbar-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #475569;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.summary-card {
  min-height: 140px;
  padding: 20px;
  border-radius: 22px;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
}

.summary-label {
  color: #475569;
  font-size: 14px;
}

.summary-value {
  margin-top: 14px;
  font-size: 34px;
  font-weight: 700;
  color: #0f172a;
}

.summary-sub {
  margin-top: 10px;
  color: #64748b;
  font-size: 13px;
}

.danger-card {
  background: linear-gradient(180deg, #fff1f2 0%, #ffffff 100%);
}

.success-card {
  background: linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%);
}

.neutral-card {
  background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
}

.warm-card {
  background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
}

.console-grid,
.lower-grid {
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
}

.console-grid {
  grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.95fr);
}

.lower-grid {
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
}

.panel-card {
  border: none;
  border-radius: 24px;
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.08);
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.panel-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.panel-desc {
  margin-top: 6px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.curve-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.curve-card {
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 16px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.curve-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.curve-title {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.curve-subtitle {
  margin-top: 4px;
  color: #6b7280;
  font-size: 12px;
}

.curve-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.curve-metric {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid #e5e7eb;
}

.curve-metric-label {
  display: block;
  color: #6b7280;
  font-size: 12px;
  margin-bottom: 4px;
}

.curve-metric-value {
  color: #111827;
  font-size: 15px;
}

.curve-chart-wrap {
  display: grid;
  grid-template-columns: 52px 1fr 52px;
  align-items: stretch;
  gap: 8px;
}

.curve-axis {
  color: #6b7280;
  font-size: 12px;
  display: flex;
  align-items: center;
}

.curve-axis-top {
  justify-content: flex-start;
}

.curve-axis-bottom {
  justify-content: flex-end;
}

.curve-svg {
  width: 100%;
  height: 120px;
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.06) 0%, rgba(37, 99, 235, 0.01) 100%);
}

.curve-grid-line {
  stroke: #dbeafe;
  stroke-width: 1;
  stroke-dasharray: 4 4;
}

.curve-threshold-line {
  stroke: #f59e0b;
  stroke-width: 1;
  stroke-dasharray: 5 4;
  opacity: 0.8;
}

.curve-line {
  stroke: #2563eb;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.curve-last-dot {
  fill: #2563eb;
  stroke: #ffffff;
  stroke-width: 2;
}

.curve-footer {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #6b7280;
  font-size: 12px;
}

.ai-panel {
  background:
    radial-gradient(circle at top right, rgba(14, 165, 233, 0.12), transparent 30%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.ai-panel-empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.batch-overview-panel {
  background:
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 34%),
    linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}

.ai-panel-top {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 16px;
  align-items: center;
  margin-bottom: 16px;
}

.workshop-gauge {
  display: flex;
  justify-content: center;
}

.workshop-risk-number {
  font-size: 22px;
  font-weight: 700;
  text-align: center;
}

.workshop-risk-label {
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

.ai-key-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-key-metric {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #e2e8f0;
}

.ai-key-metric span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.ai-key-metric strong {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  color: #0f172a;
}

.batch-overview-head {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.batch-overview-item,
.batch-overview-metric {
  padding: 14px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #e2e8f0;
}

.batch-overview-item span,
.batch-overview-metric span,
.batch-progress-header span,
.batch-order-row span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.batch-overview-item strong,
.batch-overview-metric strong,
.batch-progress-header strong,
.batch-order-row strong {
  display: block;
  margin-top: 8px;
  font-size: 18px;
  color: #0f172a;
}

.batch-progress-panel,
.batch-order-progress {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #e2e8f0;
}

.batch-progress-panel {
  margin-bottom: 16px;
}

.batch-progress-header,
.batch-order-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.batch-progress-qty {
  margin-top: 10px;
  color: #334155;
  font-size: 14px;
  font-weight: 600;
}

.batch-overview-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.sensor-summary {
  margin-bottom: 16px;
}

.sensor-summary-title {
  margin-bottom: 10px;
  font-weight: 600;
  color: #0f172a;
}

.sensor-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.sensor-chip {
  min-width: 140px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
}

.sensor-chip-empty {
  color: #909399;
}

.sensor-chip-name {
  margin-bottom: 4px;
  color: #606266;
  font-size: 12px;
}

.sensor-chip-value {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.line-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.emphasis-line {
  padding: 14px 16px;
  margin-bottom: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid #e2e8f0;
}

.line-label {
  width: 72px;
  color: #475569;
  font-weight: 600;
  flex-shrink: 0;
}

.line-content {
  color: #0f172a;
  line-height: 1.7;
  word-break: break-word;
}

.batch-list {
  display: grid;
  gap: 12px;
}

.batch-card {
  padding: 16px;
  border-radius: 18px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
  border: 1px solid #e2e8f0;
}

.batch-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.batch-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.batch-meta,
.batch-progress-meta {
  color: #64748b;
  font-size: 12px;
}

.batch-meta {
  margin-top: 4px;
}

.batch-progress-meta {
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.batch-progress-wrap {
  margin-top: 12px;
}

.batch-progress-label {
  margin-bottom: 8px;
  color: #334155;
  font-size: 13px;
}

.batch-progress-placeholder {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.risk-high {
  box-shadow: 0 0 0 1px rgba(245, 108, 108, 0.28);
}

.risk-medium {
  box-shadow: 0 0 0 1px rgba(230, 162, 60, 0.28);
}

.risk-low {
  box-shadow: 0 0 0 1px rgba(103, 194, 58, 0.18);
}

@media (max-width: 1280px) {
  .summary-grid,
  .console-grid,
  .lower-grid,
  .ai-panel-top,
  .batch-overview-head,
  .batch-overview-metrics {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 960px) {
  .console-toolbar,
  .panel-head,
  .batch-card-head,
  .batch-progress-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .summary-grid,
  .console-grid,
  .lower-grid,
  .ai-panel-top,
  .batch-overview-head,
  .batch-overview-metrics,
  .curve-metrics {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .console-page {
    padding: 14px;
  }

  .console-toolbar {
    padding: 12px 14px;
  }

  .curve-chart-wrap {
    grid-template-columns: 1fr;
  }

  .curve-axis-top,
  .curve-axis-bottom {
    justify-content: flex-start;
  }

  .curve-footer {
    flex-direction: column;
  }
}
</style>
