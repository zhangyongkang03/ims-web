<template>
  <div class="container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <div class="title-wrap">
            <span>AI 实时监控大屏</span>
            <el-tag :type="wsConnected ? 'success' : 'danger'" effect="dark">
              {{ wsConnected ? 'WebSocket 已连接' : 'WebSocket 已断开' }}
            </el-tag>
          </div>
          <div class="header-right">
            <el-text type="info">设备数：{{ cardList.length }}</el-text>
            <el-text type="info">报警数：{{ alarmCount }}</el-text>
            <el-button :loading="loading" @click="refreshAll">刷新</el-button>
          </div>
        </div>
      </template>

      <el-row :gutter="16" class="summary-row">
        <el-col :xs="12" :md="8" :xl="4">
          <el-statistic title="高风险设备" :value="highRiskCount" />
        </el-col>
        <el-col :xs="12" :md="8" :xl="4">
          <el-statistic title="中风险设备" :value="midRiskCount" />
        </el-col>
        <el-col :xs="12" :md="8" :xl="4">
          <el-statistic title="低风险设备" :value="lowRiskCount" />
        </el-col>
        <el-col :xs="12" :md="8" :xl="4">
          <el-statistic title="未处理报警" :value="alarmCount" />
        </el-col>
        <el-col :xs="12" :md="8" :xl="4">
          <el-statistic title="总产量" :value="productionStats.totalOutput" />
        </el-col>
        <el-col :xs="12" :md="8" :xl="4">
          <el-statistic title="良品率" :value="productionStats.qualificationRate" suffix="%" />
        </el-col>
      </el-row>

      <div class="stats-time">生产统计更新：{{ productionStats.lastUpdated || '-' }}</div>

      <el-card class="box-card realtime-board" shadow="never">
        <template #header>
          <div class="card-header">
            <span>秒级实时监测</span>
            <el-text type="info">直接展示 WebSocket 实时值</el-text>
          </div>
        </template>

        <el-empty
          v-if="!realtimeMonitorList.length"
          description="暂无秒级实时数据"
          :image-size="80"
        />
        <el-table v-else :data="realtimeMonitorList" stripe style="width: 100%">
          <el-table-column prop="deviceCode" label="设备编码" width="140" />
          <el-table-column label="工序/类别" min-width="140">
            <template #default="{ row }">
              {{ sensorShortLabel(row) || getProcessLabel(row.processType) }}
            </template>
          </el-table-column>
          <el-table-column prop="batchNo" label="批次号" min-width="170" />
          <el-table-column label="实时值" width="120">
            <template #default="{ row }">
              {{ formatRealtimeValue(row.currentValue) }} {{ realtimeUnit(row) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="riskTagType(row.riskFast, row.riskLevel)">
                {{ displayRiskLevelText(row.riskLevel) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="目标区间" min-width="170">
            <template #default="{ row }">
              <span v-if="row.minThreshold !== undefined && row.maxThreshold !== undefined">
                {{ formatRealtimeValue(row.minThreshold) }} -
                {{ formatRealtimeValue(row.maxThreshold) }}
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="进度/风险" width="140">
            <template #default="{ row }">
              <span v-if="isRampRealtime(row)">
                调配进度
                {{
                  rampProgressValue(
                    row.currentValue,
                    row.target,
                    row.minThreshold,
                    row.maxThreshold,
                  )
                }}%
              </span>
              <span v-else>{{ row.riskFast.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="更新时间" width="160">
            <template #default="{ row }">{{ formatDashboardTimestamp(row.timestamp) }}</template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-card
        v-if="mixingWorkshopAnalysis"
        class="box-card workshop-card"
        :class="riskPanelClass(mixingWorkshopAnalysis.riskScore, mixingWorkshopAnalysis.riskLevel)"
        shadow="never"
      >
        <template #header>
          <div class="card-header">
            <div class="title-wrap">
              <span>配液车间综合态势</span>
              <el-tag
                :type="
                  riskTagType(mixingWorkshopAnalysis.riskScore, mixingWorkshopAnalysis.riskLevel)
                "
              >
                {{ mixingWorkshopAnalysis.riskLevel }}
              </el-tag>
            </div>
            <el-text type="info">更新：{{ mixingWorkshopAnalysis.analysisTime || '-' }}</el-text>
          </div>
        </template>

        <div class="workshop-grid">
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

          <div class="workshop-main">
            <div class="sensor-summary">
              <div class="sensor-summary-title">
                三参数实时概况
                <el-tag size="small" type="info"
                  >在线 {{ mixingWorkshopAnalysis.sensorCount || mixingSensorStats.length }}</el-tag
                >
              </div>
              <div class="sensor-chips">
                <div
                  v-for="sensor in mixingSensorStats"
                  :key="sensor.deviceCode"
                  class="sensor-chip"
                >
                  <div class="sensor-chip-name">{{ sensorLabel(sensor.deviceCode) }}</div>
                  <div class="sensor-chip-value">{{ sensor.meanText }}</div>
                </div>
                <div v-if="!mixingSensorStats.length" class="sensor-chip sensor-chip-empty">
                  暂无均值快照
                </div>
              </div>
            </div>

            <div class="line-item">
              <span class="line-label">分析原因：</span>
              <span class="line-content">{{ mixingWorkshopAnalysis.reason || '-' }}</span>
            </div>
            <div class="line-item">
              <span class="line-label">操作建议：</span>
              <span class="line-content">{{ mixingWorkshopAnalysis.suggestion || '-' }}</span>
            </div>
            <div class="line-item">
              <span class="line-label">最终决策：</span>
              <span class="line-content">{{ mixingWorkshopAnalysis.finalDecision || '-' }}</span>
            </div>
          </div>
        </div>
      </el-card>
    </el-card>

    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>最新报警</span>
          <el-text type="info">实时推送命中报警后自动刷新</el-text>
        </div>
      </template>

      <el-table :data="latestAlarms" stripe v-loading="alarmLoading" style="width: 100%">
        <el-table-column prop="deviceCode" label="设备编码" width="140" />
        <el-table-column label="工序" width="140">
          <template #default="{ row }">
            {{ getProcessLabel(row.processType) }}
          </template>
        </el-table-column>
        <el-table-column label="报警级别" width="120">
          <template #default="{ row }">
            <el-tag :type="alarmLevelTagType(row.alarmLevel)">
              {{ row.alarmLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="alarmMsg" label="报警信息" min-width="260" show-overflow-tooltip />
        <el-table-column prop="createTime" label="报警时间" width="180" />
      </el-table>
    </el-card>

    <el-card class="box-card history-card">
      <template #header>
        <div class="card-header">
          <span>分析历史</span>
        </div>
      </template>

      <div class="search-form">
        <el-input
          v-model="searchForm.deviceCode"
          placeholder="设备编码"
          clearable
          class="search-input"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <el-table :data="historyData" stripe v-loading="historyLoading" style="width: 100%">
        <el-table-column prop="deviceCode" label="设备编码" width="140" />
        <el-table-column prop="batchNo" label="批次号" width="160" />
        <el-table-column prop="processType" label="工序" width="140">
          <template #default="{ row }">
            {{ getProcessLabel(row.processType) }}
          </template>
        </el-table-column>
        <el-table-column prop="riskScore" label="风险评分" width="100" />
        <el-table-column prop="riskLevel" label="风险等级" width="130" />
        <el-table-column prop="reason" label="原因" min-width="260" show-overflow-tooltip />
        <el-table-column prop="suggestion" label="建议" min-width="220" show-overflow-tooltip />
        <el-table-column prop="analysisTime" label="时间" width="180" />
      </el-table>

      <el-pagination
        v-model:current-page="historyPagination.pageNum"
        v-model:page-size="historyPagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="historyPagination.total"
        :hide-on-single-page="false"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @change="loadHistory"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { getAiHistory, getAiLatest, type AiAnalysisResult } from '@/api/ai'
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
  type DashboardPushData,
} from '@/utils/alarmWs'
import { ElNotification } from 'element-plus'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

const STATS_REFRESH_INTERVAL = 60000
const MIXING_WORKSHOP_CODE = 'MIXING_WORKSHOP'

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

interface SensorDescriptor {
  title: string
  shortLabel: string
  unit: string
}

const { getLabel: getProcessDictLabel, load: loadProcessDict } = useDictData(DICT_TYPE.PROCESS_TYPE)

const loading = ref(false)
const historyLoading = ref(false)
const alarmLoading = ref(false)
const wsConnected = ref(false)
const alarmCount = ref(0)
const deviceCodes = ref<string[]>([])
const historyData = ref<AiAnalysisResult[]>([])
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

let statsRefreshTimer: number | null = null
let alarmRefreshTimer: number | null = null
let stopDashboardListener: (() => void) | null = null
let stopFastRiskListener: (() => void) | null = null
let stopAiAnalysisListener: (() => void) | null = null
let stopAlarmListener: (() => void) | null = null
let stopWsStatusListener: (() => void) | null = null
const aiLastAppliedAt = new Map<string, number>()
const aiPendingByDevice = new Map<string, AiAnalysisResult>()
const aiThrottleTimerByDevice = new Map<string, number>()

const historyPagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0,
})

const searchForm = reactive({
  deviceCode: '',
})

const compareDeviceCode = (left: string, right: string) =>
  left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })

const mixingWorkshopAnalysis = computed(() => aiCardsMap.value[MIXING_WORKSHOP_CODE])

const mixingSensorStats = computed<SensorMeanStat[]>(() => {
  const snapshot = mixingWorkshopAnalysis.value?.statsSnapshot || ''
  return parseStatsSnapshot(snapshot)
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

const slopeArrow = (slope: number) => {
  if (slope > 0.01) return '↑'
  if (slope < -0.01) return '↓'
  return '→'
}

const trendLabel = (slope: number) => {
  if (slope > 0.01) return '上升'
  if (slope < -0.01) return '下降'
  return '稳定'
}

const formatSlope = (slope: number) => {
  const value = Number(slope || 0)
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`
}

const formatEta = (etaSeconds: number) => {
  const eta = Number(etaSeconds)
  if (eta < 0) return '—（无逼近趋势）'
  if (eta > 60) return '>60s'
  return `${Math.round(eta)}s`
}

const rangeMarkerPosition = (fastRisk: FastRiskPayload) => {
  const minThreshold = Number(fastRisk.minThreshold)
  const maxThreshold = Number(fastRisk.maxThreshold)
  const currentValue = Number(fastRisk.currentValue)

  if (Number.isNaN(minThreshold) || Number.isNaN(maxThreshold) || maxThreshold <= minThreshold) {
    return 50
  }

  return Math.round(clamp01((currentValue - minThreshold) / (maxThreshold - minThreshold)) * 100)
}

const formatRealtimeValue = (value: number) => Number(value || 0).toFixed(2)

const formatDashboardTimestamp = (timestamp?: number) => {
  const value = Number(timestamp || 0)
  if (!value) return '-'
  return new Date(value).toLocaleTimeString()
}

const realtimeUnit = (payload: {
  deviceCode?: string
  processType?: string
  target?: number
  minThreshold?: number
  maxThreshold?: number
}) => getSensorDescriptor(payload).unit

const riskCardClass = (item: DashboardCardItem) => {
  const level = String(item.displayRiskLevel || '').toUpperCase()
  if (level === 'RAMP') return 'risk-ramp'
  if (String(item.displayRiskLevel || '') === '在线') return 'risk-online'
  if (level === 'HIGH' || String(item.displayRiskLevel || '').includes('高')) return 'risk-high'
  if (level === 'MEDIUM' || String(item.displayRiskLevel || '').includes('中')) return 'risk-medium'
  if (item.displayRiskScore >= 0.8) return 'risk-high'
  if (item.displayRiskScore >= 0.6) return 'risk-medium'
  return 'risk-low'
}

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

const decisionSource = (snapshot = '') => {
  if (snapshot.includes('[COMPREHENSIVE]')) return '[COMPREHENSIVE] 综合分析'
  if (snapshot.includes('[RULE]')) return '[RULE] 规则'
  if (snapshot.includes('[AI+RAG]')) return '[AI+RAG] AI分析'
  if (snapshot.includes('[FALLBACK]')) return '[FALLBACK] 降级'
  return '未知来源'
}

const decisionTagType = (snapshot = '') => {
  if (snapshot.includes('[COMPREHENSIVE]')) return 'primary'
  if (snapshot.includes('[RULE]')) return 'warning'
  if (snapshot.includes('[AI+RAG]')) return 'success'
  if (snapshot.includes('[FALLBACK]')) return 'info'
  return 'info'
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

const escapeHtml = (text = '') =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const highlightKb = (text = '') =>
  escapeHtml(text).replace(/(KB-\d+)/g, '<span class="kb-highlight">$1</span>')

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

const upsertDashboardMetrics = (
  items: Record<string, DashboardDevicePayload>,
  productionCount?: number,
) => {
  dashboardMetricMap.value = {
    ...dashboardMetricMap.value,
    ...items,
  }

  if (productionCount !== undefined) {
    productionStats.value = {
      ...productionStats.value,
      totalOutput: Number(productionCount || 0),
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
    productionCount: Number(data.productionCount || 0),
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
  await Promise.allSettled(
    latestTargets.map(async (deviceCode) => {
      const res = await getAiLatest(deviceCode)
      if (res.data) {
        upsertAiCard(res.data)
      }
    }),
  )
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const res = await getAiHistory({
      pageNum: historyPagination.pageNum,
      pageSize: historyPagination.pageSize,
      deviceCode: searchForm.deviceCode || undefined,
    })
    historyData.value = res.data.records
    historyPagination.total = res.data.total
  } finally {
    historyLoading.value = false
  }
}

const loadLatestAlarms = async () => {
  alarmLoading.value = true
  try {
    const res = await getAlarmList({ pageNum: 1, pageSize: 8 })
    latestAlarms.value = res.data.records
  } finally {
    alarmLoading.value = false
  }
}

const loadAlarmCount = async () => {
  const res = await getUnhandledAlarmCount()
  alarmCount.value = res.data
}

const loadProductionStats = async () => {
  const res = await getProductionStats('today')
  const rawRate = Number(res.data.qualificationRate || 0)
  productionStats.value = {
    totalOutput: Number(res.data.totalOutput || 0),
    qualificationRate: Number((rawRate > 1 ? rawRate : rawRate * 100).toFixed(2)),
    lastUpdated: new Date().toLocaleString(),
  }
}

const handleSearch = () => {
  historyPagination.pageNum = 1
  loadHistory()
}

const handleReset = () => {
  searchForm.deviceCode = ''
  historyPagination.pageNum = 1
  loadHistory()
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
      loadHistory(),
      loadLatestAlarms(),
      loadAlarmCount(),
      loadProductionStats(),
    ])

    logLoadFailure('工序字典', results[0])
    logLoadFailure('设备与最新分析', results[1])
    logLoadFailure('分析历史', results[2])
    logLoadFailure('最新报警', results[3])
    logLoadFailure('报警数', results[4])
    logLoadFailure('生产统计', results[5])
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

onMounted(async () => {
  stopWsStatusListener = onAlarmWsStatusChange((connected) => {
    wsConnected.value = connected
  })
  stopDashboardListener = onDashboardPush((data) => {
    const normalized = normalizeDashboardPush(data)
    upsertDashboardMetrics(normalized.metrics, normalized.productionCount)
  })
  stopFastRiskListener = onFastRiskPush((data) => {
    upsertFastRisk(data)
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
    scheduleAlarmRefresh()
  })
  await refreshAll()
  startStatsPolling()
})

onBeforeUnmount(() => {
  stopStatsPolling()
  clearAlarmRefreshTimer()
  clearAiThrottleTimers()
  aiPendingByDevice.clear()
  aiLastAppliedAt.clear()
  fastRiskMap.value = {}
  dashboardMetricMap.value = {}
  if (stopWsStatusListener) stopWsStatusListener()
  if (stopDashboardListener) stopDashboardListener()
  if (stopFastRiskListener) stopFastRiskListener()
  if (stopAiAnalysisListener) stopAiAnalysisListener()
  if (stopAlarmListener) stopAlarmListener()
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
  gap: 12px;
}

.title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.summary-row {
  margin-bottom: 12px;
}

.workshop-card {
  margin-bottom: 16px;
}

.workshop-grid {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 20px;
  align-items: center;
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
  color: #606266;
  text-align: center;
}

.sensor-summary {
  margin-bottom: 12px;
}

.sensor-summary-title {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.sensor-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.sensor-chip {
  min-width: 140px;
  padding: 10px 12px;
  border-radius: 10px;
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

.stats-time {
  margin-bottom: 12px;
  color: #909399;
  font-size: 12px;
}

.device-card {
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
}

.risk-high {
  border-color: #f56c6c;
  box-shadow: 0 0 0 1px rgba(245, 108, 108, 0.25);
}

.risk-medium {
  border-color: #e6a23c;
  box-shadow: 0 0 0 1px rgba(230, 162, 60, 0.25);
}

.risk-low {
  border-color: #67c23a;
}

.risk-ramp {
  border-color: #409eff;
  box-shadow: 0 0 0 1px rgba(64, 158, 255, 0.2);
}

.device-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.device-code {
  font-size: 16px;
  font-weight: 600;
}

.device-process {
  color: #606266;
  margin-top: 2px;
}

.gauge-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}

.realtime-section {
  padding: 10px;
  border-radius: 8px;
  background: #f8fafc;
  margin-bottom: 10px;
}

.realtime-empty {
  margin-bottom: 10px;
  color: #909399;
  font-size: 12px;
}

.ai-divider {
  margin-bottom: 8px;
  color: #909399;
  font-size: 12px;
}

.ramp-range-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  color: #606266;
  font-size: 13px;
}

.ramp-range-track {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #cfe8ff 0%, #409eff 100%);
}

.ramp-range-value {
  min-width: 44px;
  text-align: center;
}

.steady-range-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  color: #606266;
  font-size: 13px;
}

.steady-range-track {
  position: relative;
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #d1d5db 0%, #9ca3af 100%);
}

.steady-range-marker {
  position: absolute;
  top: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #111827;
  border: 2px solid #ffffff;
  box-shadow: 0 1px 4px rgba(17, 24, 39, 0.3);
  transform: translate(-50%, -50%);
}

.steady-range-value {
  min-width: 44px;
  text-align: center;
}

.risk-summary-line {
  margin-bottom: 6px;
}

.risk-summary-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.risk-score-text {
  font-weight: 600;
  color: #111827;
}

.ramp-ai-empty {
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
}

.quick-metrics {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: #606266;
  font-size: 12px;
}

.compact-line {
  margin-bottom: 6px;
}

.risk-number {
  font-size: 18px;
  font-weight: 600;
}

.line-item {
  margin-bottom: 8px;
  display: flex;
  align-items: flex-start;
}

.line-label {
  width: 70px;
  color: #606266;
  flex-shrink: 0;
}

.line-content {
  color: #303133;
  line-height: 1.5;
  word-break: break-word;
}

:deep(.kb-highlight) {
  display: inline-block;
  font-weight: 700;
  color: #d97706;
  background: #fffbeb;
  border-radius: 4px;
  padding: 0 4px;
  margin: 0 2px;
}

.search-form {
  margin-bottom: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
}

.search-input {
  width: 220px;
}

.pagination {
  margin-top: 12px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .workshop-grid {
    grid-template-columns: 1fr;
  }

  .search-form {
    flex-wrap: wrap;
  }

  .search-input {
    width: 100%;
  }
}
</style>
