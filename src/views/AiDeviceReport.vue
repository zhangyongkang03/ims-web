<template>
  <div class="container">
    <el-card
      class="box-card"
      v-loading="loading"
      element-loading-text="AI 正在分析，请稍候（约5-15秒）..."
    >
      <template #header>
        <div class="card-header">
          <span>设备运行报告 + AI 维保建议</span>
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
        <el-button type="primary" :loading="loading" @click="handleGenerateByDate">
          {{ generateButtonText }}
        </el-button>
      </div>

      <div class="meta-row">
        <el-tag type="primary">周期：{{ reportTypeLabel }}</el-tag>
        <el-tag type="info">报告日期：{{ reportDateText }}</el-tag>
        <el-tag type="success">生成时间：{{ report?.generateTime || '-' }}</el-tag>
      </div>

      <el-empty v-if="!report && !loading" :description="emptyTip" />

      <div v-else-if="report" class="content-wrap">
        <el-card shadow="never" class="section-card">
          <template #header>
            <span>AI 产线全局评估</span>
          </template>
          <div class="overview-text">{{ overviewText }}</div>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>
            <div class="card-header">
              <span>设备故障预测</span>
              <el-text type="info">预测时间：{{ failurePrediction?.generateTime || '-' }}</el-text>
            </div>
          </template>

          <div class="prediction-overview">
            <el-tag type="info">设备总数：{{ failurePrediction?.totalDevices ?? 0 }}</el-tag>
            <el-tag :type="warningDevicesCount > 0 ? 'danger' : 'success'">
              风险设备：{{ warningDevicesCount }}
            </el-tag>
          </div>

          <el-alert
            v-if="failurePrediction?.aiOverview"
            type="info"
            show-icon
            :closable="false"
            class="prediction-alert"
            :title="failurePrediction.aiOverview"
          />

          <el-empty
            v-if="!failurePredictions.length"
            description="当前所选日期没有退化风险设备"
            :image-size="90"
          />

          <el-table v-else :data="failurePredictions" stripe border style="width: 100%">
            <el-table-column prop="deviceCode" label="设备编码" width="120" />
            <el-table-column prop="equipCode" label="所属设备" width="120" />
            <el-table-column prop="equipName" label="设备名称" min-width="140" />
            <el-table-column label="趋势" width="110">
              <template #default="{ row }">
                <span :style="{ color: failureTrendColor(row.trend) }">{{
                  failureTrendLabel(row.trend)
                }}</span>
              </template>
            </el-table-column>
            <el-table-column label="预测风险" width="110">
              <template #default="{ row }">
                <el-tag
                  :type="urgencyTagType(normalizeUrgency(row.urgency || row.predictedRiskLevel))"
                >
                  {{ normalizeUrgency(row.urgency || row.predictedRiskLevel) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="本周/上周报警" width="130">
              <template #default="{ row }">
                {{ row.thisWeekAlarms ?? 0 }} / {{ row.lastWeekAlarms ?? 0 }}
              </template>
            </el-table-column>
            <el-table-column label="报警增长率" width="110">
              <template #default="{ row }">{{ formatPercent(row.alarmGrowthRate) }}</template>
            </el-table-column>
            <el-table-column label="距上次维修(天)" width="130">
              <template #default="{ row }">{{ formatInteger(row.daysSinceLastRepair) }}</template>
            </el-table-column>
            <el-table-column prop="lastRepairDate" label="上次维修" width="120" />
            <el-table-column
              prop="aiRecommendation"
              label="AI 建议"
              min-width="280"
              show-overflow-tooltip
            />
          </el-table>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>
            <span>设备运行概况（{{ equipmentSummaries.length }} 台）</span>
          </template>
          <el-table :data="equipmentSummaries" stripe border style="width: 100%">
            <el-table-column type="expand" width="40">
              <template #default="{ row }">
                <el-table
                  v-if="(row.sensorSummaries || []).length"
                  :data="row.sensorSummaries || []"
                  stripe
                  border
                  style="width: 100%"
                  size="small"
                >
                  <el-table-column prop="deviceCode" label="传感器编码" min-width="120" />
                  <el-table-column prop="deviceType" label="类型" min-width="100" />
                  <el-table-column prop="sampleCount" label="采样数" width="100" />
                  <el-table-column label="均值" width="100">
                    <template #default="{ row: sensor }">{{
                      formatNumber(sensor.mean, 3)
                    }}</template>
                  </el-table-column>
                  <el-table-column label="标准差" width="100">
                    <template #default="{ row: sensor }">{{
                      formatNumber(sensor.stdDev, 3)
                    }}</template>
                  </el-table-column>
                  <el-table-column label="超标率" width="110">
                    <template #default="{ row: sensor }">
                      <span :class="outRateClass(sensor.outOfRangeRate)">{{
                        formatPercent(sensor.outOfRangeRate)
                      }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="告警数" width="90">
                    <template #default="{ row: sensor }">
                      <span :class="{ 'danger-text': Number(sensor.alarmCount) > 0 }">{{
                        sensor.alarmCount
                      }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="健康评分" width="220">
                    <template #default="{ row: sensor }">
                      <div class="health-cell">
                        <el-progress
                          :percentage="normalizeScore(sensor.healthScore)"
                          :stroke-width="14"
                          :color="healthColor(sensor.healthScore)"
                        />
                        <span class="health-value">{{ formatNumber(sensor.healthScore, 1) }}</span>
                      </div>
                    </template>
                  </el-table-column>
                </el-table>
                <el-table
                  v-else-if="getTrendDetailRows(row).length"
                  :data="getTrendDetailRows(row)"
                  stripe
                  border
                  style="width: 100%"
                  size="small"
                >
                  <el-table-column prop="date" label="日期" width="120" />
                  <el-table-column label="健康评分" width="220">
                    <template #default="{ row: item }">
                      <div class="health-cell">
                        <el-progress
                          :percentage="normalizeScore(item.healthScore)"
                          :stroke-width="14"
                          :color="healthColor(item.healthScore)"
                        />
                        <span class="health-value">{{ formatNumber(item.healthScore, 1) }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column label="告警数" width="100">
                    <template #default="{ row: item }">
                      <span :class="{ 'danger-text': Number(item.alarmCount) > 0 }">{{
                        item.alarmCount
                      }}</span>
                    </template>
                  </el-table-column>
                </el-table>
                <el-empty v-else description="暂无设备明细" :image-size="80" />
              </template>
            </el-table-column>
            <el-table-column prop="equipCode" label="设备编码" width="140" />
            <el-table-column prop="equipName" label="设备名称" min-width="140" />
            <el-table-column label="工序" width="130">
              <template #default="{ row }">{{ processTypeLabel(row.processType) }}</template>
            </el-table-column>
            <el-table-column v-if="showSensorCount" label="传感器数" width="100">
              <template #default="{ row }">{{ (row.sensorSummaries || []).length }}</template>
            </el-table-column>
            <el-table-column v-else label="周期点数" width="100">
              <template #default="{ row }">{{ getTrendPointCount(row) }}</template>
            </el-table-column>
            <el-table-column label="告警数" width="90">
              <template #default="{ row }">
                <span :class="{ 'danger-text': Number(row.alarmCount) > 0 }">{{
                  row.alarmCount ?? row.totalAlarmCount ?? 0
                }}</span>
              </template>
            </el-table-column>
            <el-table-column label="健康评分" width="220">
              <template #default="{ row }">
                <div class="health-cell">
                  <el-progress
                    :percentage="normalizeScore(row.healthScore ?? row.avgHealthScore)"
                    :stroke-width="14"
                    :color="healthColor(row.healthScore ?? row.avgHealthScore)"
                  />
                  <span class="health-value">{{
                    formatNumber(row.healthScore ?? row.avgHealthScore, 1)
                  }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="趋势" width="100">
              <template #default="{ row }">
                <span :style="{ color: trendColor(row.trend) }">{{ trendLabel(row.trend) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="runningDays" label="运行天数" width="110" />
          </el-table>
        </el-card>

        <el-row :gutter="12" class="section-row">
          <el-col :xs="24" :lg="14">
            <el-card shadow="never" class="section-card compact">
              <template #header>
                <span>AI 维保建议（{{ sortedSuggestions.length }} 条）</span>
              </template>
              <el-empty
                v-if="!sortedSuggestions.length"
                description="暂无维保建议"
                :image-size="90"
              />
              <div v-else class="suggestion-list">
                <el-collapse>
                  <el-collapse-item
                    v-for="item in sortedSuggestions"
                    :key="`${item.equipCode}-${item.suggestedTime}`"
                    :name="`${item.equipCode}-${item.suggestedTime}`"
                  >
                    <template #title>
                      <div class="suggestion-title">
                        <el-tag :type="urgencyTagType(item.urgency)">
                          {{ urgencyLabel(item.urgency) }}
                        </el-tag>
                        <span>{{ item.equipName }}（{{ item.equipCode }}）</span>
                        <span class="suggest-time">建议时间：{{ item.suggestedTime || '-' }}</span>
                      </div>
                    </template>
                    <div class="suggestion-content">建议：{{ item.suggestion || '-' }}</div>
                    <div class="suggestion-reason">依据：{{ item.reason || '-' }}</div>
                  </el-collapse-item>
                </el-collapse>
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="10">
            <el-card shadow="never" class="section-card compact">
              <template #header>
                <span>告警 TOP 排名</span>
              </template>
              <el-empty
                v-if="!alarmTopDevices.length"
                :description="`${reportTypeLabel}无明显告警`"
                :image-size="90"
              />
              <el-timeline v-else>
                <el-timeline-item
                  v-for="(item, idx) in alarmTopDevices"
                  :key="`${item.equipCode}-${idx}`"
                  :type="idx === 0 ? 'danger' : 'primary'"
                >
                  <div class="alarm-item-head">
                    <strong>{{ item.equipCode }}</strong>
                    <el-tag size="small">{{ item.equipName }}</el-tag>
                    <span class="danger-text">{{ item.alarmCount }}次</span>
                  </div>
                  <div class="alarm-msg">{{ item.topAlarmMsg || '-' }}</div>
                </el-timeline-item>
              </el-timeline>
            </el-card>
          </el-col>
        </el-row>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {
  getDeviceDailyReportByDate,
  getDeviceMonthlyReportByDate,
  getDeviceWeeklyReportByDate,
  getFailurePrediction,
  type DeviceAlarmTopItem,
  type DeviceDailyTrendPoint,
  type DeviceEquipmentSummary,
  type DeviceMaintenanceSuggestion,
  type DeviceReport,
  type DeviceTrend,
  type DeviceUrgency,
  type FailurePredictionItem,
  type FailurePredictionReport,
} from '@/api/ai'
import { ElMessage } from 'element-plus'
import { computed, ref, watch } from 'vue'

type ReportType = 'daily' | 'weekly' | 'monthly'

const loading = ref(false)
const report = ref<DeviceReport | null>(null)
const failurePrediction = ref<FailurePredictionReport | null>(null)
const emptyTip = ref('暂无报告，请选择日期后查询')
const selectedDate = ref(getYesterday())
const reportType = ref<ReportType>('daily')

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

const generateButtonText = computed(() => `查询指定日期${reportTypeLabel.value}`)

const reportDateText = computed(() => {
  if (!report.value) return '-'
  if (report.value.reportDate) return report.value.reportDate
  if (report.value.startDate && report.value.endDate) {
    return `${report.value.startDate} 至 ${report.value.endDate}`
  }
  return report.value.startDate || report.value.endDate || '-'
})

const overviewText = computed(() => {
  return report.value?.aiDailyOverview || report.value?.aiOverview || '暂无AI总评'
})

const showSensorCount = computed(() => {
  return equipmentSummaries.value.some(
    (item) => Array.isArray(item.sensorSummaries) && item.sensorSummaries.length,
  )
})

const equipmentSummaries = computed<DeviceEquipmentSummary[]>(() => {
  const latest = report.value?.equipmentSummaries
  if (Array.isArray(latest) && latest.length) {
    return latest.map((item) => ({
      ...item,
      alarmCount: item.alarmCount ?? item.totalAlarmCount ?? 0,
      healthScore: item.healthScore ?? item.avgHealthScore ?? 0,
    }))
  }

  const legacy = report.value?.deviceSummaries || []
  return legacy.map((item) => ({
    equipCode: item.deviceCode,
    equipName: item.deviceCode,
    processType: '-',
    alarmCount: item.alarmCount,
    healthScore: item.healthScore,
    trend: 'STABLE',
    runningDays: '-',
    sensorSummaries: [item],
  }))
})

const alarmTopDevices = computed<DeviceAlarmTopItem[]>(() => {
  return report.value?.alarmTopDevices || []
})

const failurePredictions = computed<FailurePredictionItem[]>(() => {
  return failurePrediction.value?.predictions || []
})

const warningDevicesCount = computed(
  () => failurePrediction.value?.warningDevices ?? failurePredictions.value.length,
)

const sortedSuggestions = computed<DeviceMaintenanceSuggestion[]>(() => {
  const source = report.value?.maintenanceSuggestions || []
  const order: Record<DeviceUrgency, number> = {
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  }
  return [...source].sort((a, b) => order[a.urgency] - order[b.urgency])
})

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
  min.setDate(min.getDate() - 30)

  return day.getTime() > today.getTime() || day.getTime() < min.getTime()
}

function normalizeScore(score: number | string) {
  const value = Number(score)
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return Number(value.toFixed(1))
}

function healthColor(score: number | string) {
  const value = Number(score)
  if (value >= 90) return '#67c23a'
  if (value >= 70) return '#e6a23c'
  return '#f56c6c'
}

function formatNumber(value: number | string, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toFixed(digits)
}

function formatPercent(value: number | string) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(2)}%`
}

function formatInteger(value: number | string | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Math.round(Number(value))}`
}

function processTypeLabel(processType?: string) {
  const processTypeMap: Record<string, string> = {
    MIXING: '配液',
    STERILIZATION: '杀菌',
    STERILIZING: '杀菌',
    FILLING: '罐装',
    SEALING: '封口',
    LABELING: '贴标',
    PACKAGING: '包装',
  }
  return processTypeMap[processType || ''] || processType || '-'
}

function getTrendPointCount(row: DeviceEquipmentSummary) {
  return Math.max(row.dailyHealthTrend?.length || 0, row.dailyAlarmTrend?.length || 0)
}

function getTrendDetailRows(row: DeviceEquipmentSummary) {
  const healthMap = new Map<string, number | string>()
  const alarmMap = new Map<string, number | string>()

  ;(row.dailyHealthTrend || []).forEach((item: DeviceDailyTrendPoint) => {
    if (item.date) {
      healthMap.set(item.date, item.healthScore ?? '-')
    }
  })
  ;(row.dailyAlarmTrend || []).forEach((item: DeviceDailyTrendPoint) => {
    if (item.date) {
      alarmMap.set(item.date, item.alarmCount ?? 0)
    }
  })

  return Array.from(new Set([...healthMap.keys(), ...alarmMap.keys()]))
    .sort((left, right) => left.localeCompare(right))
    .map((date) => ({
      date,
      healthScore: healthMap.get(date) ?? '-',
      alarmCount: alarmMap.get(date) ?? 0,
    }))
}

function outRateClass(value: number | string) {
  const rate = Number(value)
  if (Number.isNaN(rate)) return ''
  if (rate > 5) return 'danger-text'
  if (rate > 1) return 'warning-text'
  return ''
}

function trendLabel(trend: DeviceTrend) {
  if (trend === 'UP') return '↑ 好转'
  if (trend === 'IMPROVING') return '↑ 好转'
  if (trend === 'DOWN') return '↓ 下降'
  if (trend === 'DECLINING') return '↓ 下降'
  return '→ 稳定'
}

function trendColor(trend: DeviceTrend) {
  if (trend === 'UP') return '#67c23a'
  if (trend === 'IMPROVING') return '#67c23a'
  if (trend === 'DOWN') return '#f56c6c'
  if (trend === 'DECLINING') return '#f56c6c'
  return '#909399'
}

function urgencyTagType(urgency: DeviceUrgency) {
  if (urgency === 'HIGH') return 'danger'
  if (urgency === 'MEDIUM') return 'warning'
  return 'success'
}

function urgencyLabel(urgency: DeviceUrgency) {
  if (urgency === 'HIGH') return '紧急'
  if (urgency === 'MEDIUM') return '中等'
  return '计划保养'
}

function normalizeUrgency(value?: string): DeviceUrgency {
  if (value === 'HIGH') return 'HIGH'
  if (value === 'MEDIUM') return 'MEDIUM'
  return 'LOW'
}

function failureTrendLabel(trend?: string) {
  if (trend === 'DETERIORATING') return '退化中'
  if (trend === 'IMPROVING') return '改善中'
  return trendLabel((trend as DeviceTrend) || 'STABLE')
}

function failureTrendColor(trend?: string) {
  if (trend === 'DETERIORATING') return '#f56c6c'
  if (trend === 'IMPROVING') return '#67c23a'
  return trendColor((trend as DeviceTrend) || 'STABLE')
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '请求失败'
}

async function handleGenerateByDate() {
  loading.value = true
  try {
    const [reportResult, predictionResult] = await Promise.allSettled([
      reportType.value === 'weekly'
        ? getDeviceWeeklyReportByDate(selectedDate.value)
        : reportType.value === 'monthly'
          ? getDeviceMonthlyReportByDate(selectedDate.value)
          : getDeviceDailyReportByDate(selectedDate.value),
      getFailurePrediction(selectedDate.value),
    ])

    report.value = reportResult.status === 'fulfilled' ? reportResult.value.data : null
    failurePrediction.value =
      predictionResult.status === 'fulfilled' ? predictionResult.value.data : null

    if (!report.value && !failurePrediction.value) {
      throw new Error('未获取到设备报告或故障预测数据')
    }

    emptyTip.value = '暂无报告，请选择日期后查询'
    ElMessage.success(`${reportTypeLabel.value}查询成功`)
  } catch (error) {
    report.value = null
    failurePrediction.value = null
    ElMessage.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

watch([reportType, selectedDate], () => {
  report.value = null
  failurePrediction.value = null
  emptyTip.value = '暂无报告，请选择日期后查询'
})
</script>

<style scoped>
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

.section-card {
  border-radius: 8px;
}

.section-row {
  margin-top: 2px;
}

.compact {
  min-height: 320px;
}

.overview-text {
  line-height: 1.8;
  white-space: pre-wrap;
  color: #303133;
}

.health-cell {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
}

.health-value {
  color: #303133;
  font-weight: 600;
}

.warning-text {
  color: #e6a23c;
  font-weight: 600;
}

.danger-text {
  color: #f56c6c;
  font-weight: 700;
}

.suggestion-list {
  max-height: 360px;
  overflow-y: auto;
}

.suggestion-title {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.suggest-time {
  margin-left: auto;
  color: #909399;
  font-size: 12px;
}

.suggestion-content {
  margin-bottom: 8px;
  color: #303133;
}

.suggestion-reason {
  color: #606266;
}

.alarm-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.alarm-msg {
  color: #606266;
}
</style>
