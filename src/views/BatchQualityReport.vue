<template>
  <div class="container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>批次质量分析报告</span>
        </div>
      </template>

      <div class="search-form">
        <el-input
          v-model="searchForm.batchNo"
          placeholder="请输入批次号（如 B202605010001）"
          clearable
          class="search-input"
        />
        <el-button type="primary" :loading="loading" @click="handleGenerate">
          {{ loading ? '正在生成...' : '生成报告' }}
        </el-button>
        <el-button :disabled="!searchForm.batchNo || loading" @click="handleClearCache">清除缓存</el-button>
      </div>

      <el-alert
        v-if="loading"
        type="info"
        show-icon
        :closable="false"
        class="loading-tip"
        title="正在生成 AI 质量报告，请稍候（约 30 秒）..."
      />

      <el-empty v-if="!report" description="输入批次号后生成质量报告" />

      <div v-else class="report-wrapper">
        <el-alert
          type="info"
          show-icon
          :closable="false"
          class="report-meta"
          :title="`报告生成时间：${report.generatedAt || '-'}，缓存TTL：${report.cacheTtlSeconds ?? 1800}秒`"
        />

        <el-card shadow="never" class="section-card">
          <template #header>
            <span>批次概览</span>
          </template>
          <el-descriptions :column="3" border>
            <el-descriptions-item label="批次号">{{ basicInfo.batchNo || searchForm.batchNo }}</el-descriptions-item>
            <el-descriptions-item label="工单号">{{ basicInfo.orderNo || basicInfo.woNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="产品">{{ basicInfo.productName || '-' }}</el-descriptions-item>
            <el-descriptions-item label="计划产量">{{ formatNumber(basicInfo.targetQty) }}</el-descriptions-item>
            <el-descriptions-item label="产量">{{ formatNumber(basicInfo.actualQty) }}</el-descriptions-item>
            <el-descriptions-item label="良品">{{ formatNumber(basicInfo.goodQty) }}</el-descriptions-item>
            <el-descriptions-item label="不良品">{{ formatNumber(basicInfo.badQty) }}</el-descriptions-item>
            <el-descriptions-item label="生产时长">
              {{ formatDuration(basicInfo.durationMinutes) }}
            </el-descriptions-item>
            <el-descriptions-item label="良率">
              {{ formatPercent(basicInfo.yieldRate) }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag>{{ basicInfo.batchStatusLabel || basicInfo.batchStatus || '-' }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="综合CPK">{{ formatNumber(basicInfo.overallCpk) }}</el-descriptions-item>
            <el-descriptions-item label="CPK达标/不达标">
              {{ formatNumber(basicInfo.cpkPassCount) }} / {{ formatNumber(basicInfo.cpkFailCount) }}
            </el-descriptions-item>
            <el-descriptions-item label="最佳/最差设备">
              {{ basicInfo.bestStationCode || '-' }} / {{ basicInfo.worstStationCode || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="时间区间">
              {{ basicInfo.startTime || '-' }} ~ {{ basicInfo.endTime || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header>
            <span>关键风险点</span>
          </template>
          <div v-if="riskHighlights.length" class="risk-highlight-list">
            <el-tag
              v-for="(item, index) in riskHighlights"
              :key="`${item}-${index}`"
              type="danger"
              effect="dark"
              class="risk-tag"
            >
              {{ item }}
            </el-tag>
          </div>
          <el-empty v-else description="暂无关键风险点" :image-size="50" />
        </el-card>

        <el-row :gutter="12" class="section-row">
          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="section-card compact">
              <template #header>
                <div class="section-header-row">
                  <span>告警次数分布</span>
                  <el-tag type="danger">总告警 {{ totalAlarmCount }}</el-tag>
                </div>
              </template>
              <el-table :data="alarmDistribution" stripe border style="width: 100%">
                <el-table-column prop="deviceCode" label="传感器编码" min-width="130" />
                <el-table-column prop="processType" label="工序" min-width="130" />
                <el-table-column label="告警等级" min-width="120">
                  <template #default="{ row }">
                    <el-tag :type="row.alarmLevel === 'CRITICAL' ? 'danger' : 'warning'">
                      {{ row.alarmLevel || '-' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="alarmCount" label="次数" width="90" />
              </el-table>
            </el-card>
          </el-col>

          <el-col :xs="24" :lg="12">
            <el-card shadow="never" class="section-card compact">
              <template #header>
                <span>AI质量评级</span>
              </template>
              <div class="ai-panel">
                <div class="ai-score-row">
                  <el-tag :type="gradeTagType(aiAssessment.grade)" size="large">
                    评级 {{ aiAssessment.grade || '-' }}
                  </el-tag>
                  <div class="ai-score-text">综合评分 {{ formatNumber(aiAssessment.score) }}/100</div>
                </div>
                <el-progress
                  :percentage="normalizeScore(aiAssessment.score)"
                  :status="progressStatus(aiAssessment.grade)"
                />
                <el-divider />
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="质量摘要">
                    {{ aiAssessment.summary || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="异常归因">
                    {{ aiAssessment.rootCause || '-' }}
                  </el-descriptions-item>
                  <el-descriptions-item label="改善建议">
                    <ul class="suggestion-list">
                      <li v-for="(item, index) in aiAssessment.suggestions" :key="`${item}-${index}`">
                        {{ item }}
                      </li>
                      <li v-if="!aiAssessment.suggestions?.length">-</li>
                    </ul>
                  </el-descriptions-item>
                </el-descriptions>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <el-card shadow="never" class="section-card">
          <template #header>
            <span>按设备分组的质量统计（{{ equipmentStats.length }}台设备）</span>
          </template>

          <el-alert
            v-if="!hasQualityDetails"
            type="warning"
            show-icon
            :closable="false"
            class="equipment-comment"
            title="当前接口未返回设备分组明细（equipmentStatsList/processQualityList）。"
          />

          <div v-if="equipmentStats.length" class="equipment-group-list">
            <el-card
              v-for="(equip, equipIndex) in equipmentStats"
              :key="`${equip.equipCode || equip.equipName || 'equip'}-${equipIndex}`"
              shadow="never"
              class="equipment-item"
            >
              <template #header>
                <div class="equipment-header">
                  <div class="equipment-title">
                    {{ equip.equipName || '-' }}
                    <span class="equipment-code">{{ equip.equipCode || '-' }}</span>
                  </div>
                  <div class="equipment-tags">
                    <el-tag>工序 {{ equip.processName || equip.processType || '-' }}</el-tag>
                    <el-tag :type="cpkLevelTagType(equip.cpkLevel)">
                      综合CPK {{ formatNumber(equip.cpk) }} / {{ equip.cpkLevel || '-' }}
                    </el-tag>
                    <el-tag :type="Number(equip.alarmCount || 0) > 0 ? 'danger' : 'success'">
                      报警 {{ formatNumber(equip.alarmCount) }}
                    </el-tag>
                    <el-tag type="warning">超标率 {{ formatPercent(equip.outOfRangeRate) }}</el-tag>
                  </div>
                </div>
              </template>

              <el-alert
                v-if="equip.healthComment"
                type="info"
                show-icon
                :closable="false"
                class="equipment-comment"
                :title="`健康评语：${equip.healthComment}`"
              />

              <el-alert
                v-if="equip.qualityImpact"
                type="warning"
                show-icon
                :closable="false"
                class="equipment-comment"
                :title="`质量影响：${equip.qualityImpact}`"
              />
            </el-card>
          </div>

          <el-empty v-else description="暂无设备分组统计数据" :image-size="50" />
        </el-card>
      </div>
    </el-card>

    <el-drawer
      v-model="timeSeriesVisible"
      title="原始时序数据"
      size="52%"
      :destroy-on-close="true"
    >
      <div class="drawer-top">
        <div>批次：{{ searchForm.batchNo }}</div>
        <div>设备：{{ currentDevice }}</div>
      </div>

      <el-table :data="timeSeriesList" stripe border v-loading="timeSeriesLoading" style="width: 100%">
        <el-table-column prop="ts" label="时间戳" min-width="170">
          <template #default="{ row }">{{ formatTimestamp(row.ts) }}</template>
        </el-table-column>
        <el-table-column prop="value" label="value" min-width="120" />
        <el-table-column prop="processType" label="工艺参数" min-width="120" />
      </el-table>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import {
  clearBatchQualityCache,
  getBatchQualityReport,
  getBatchQualityTimeSeries,
  type BatchAiAssessment,
  type BatchAlarmDistribution,
  type BatchEquipmentStat,
  type BatchQualityBasicInfo,
  type BatchQualityReport,
  type BatchQualityReportRaw,
  type BatchStationStat,
  type BatchTimeSeriesPoint,
} from '@/api/batchQuality'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref } from 'vue'

const loading = ref(false)
const report = ref<BatchQualityReport | null>(null)

const timeSeriesVisible = ref(false)
const timeSeriesLoading = ref(false)
const currentDevice = ref('')
const timeSeriesList = ref<BatchTimeSeriesPoint[]>([])

const searchForm = reactive({
  batchNo: '',
})

const basicInfo = computed<BatchQualityBasicInfo>(() => {
  const source = (report.value?.basicInfo || {}) as BatchQualityBasicInfo
  return {
    batchNo: source.batchNo || searchForm.batchNo,
    orderNo: source.orderNo,
    woNo: source.woNo,
    productName: source.productName,
    targetQty: source.targetQty,
    actualQty: source.actualQty,
    goodQty: source.goodQty,
    badQty: source.badQty,
    yieldRate: source.yieldRate,
    durationMinutes: source.durationMinutes,
    overallCpk: source.overallCpk,
    cpkPassCount: source.cpkPassCount,
    cpkFailCount: source.cpkFailCount,
    bestStationCode: source.bestStationCode,
    worstStationCode: source.worstStationCode,
    batchStatus: source.batchStatus,
    batchStatusLabel: source.batchStatusLabel,
    startTime: source.startTime,
    endTime: source.endTime,
  }
})

const equipmentStats = computed<BatchEquipmentStat[]>(() => {
  const list = report.value?.equipmentStats || []
  return list.map((item) => ({
    ...item,
    sensorStatsList: (item.sensorStatsList || []).map((sensor, index) => ({
      ...sensor,
      stationNo: sensor.stationNo ?? index + 1,
    })),
  }))
})

const hasQualityDetails = computed(() => {
  return equipmentStats.value.length > 0
})

const alarmDistribution = computed<BatchAlarmDistribution[]>(() => {
  const list = report.value?.alarmDistribution || []
  return [...list].sort((a, b) => Number(b.alarmCount || 0) - Number(a.alarmCount || 0))
})

const totalAlarmCount = computed(() => {
  const value = report.value?.totalAlarmCount
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  return alarmDistribution.value.reduce((sum, item) => sum + Number(item.alarmCount || 0), 0)
})

const aiAssessment = computed<BatchAiAssessment>(() => {
  return {
    grade: report.value?.aiAssessment?.grade,
    score: report.value?.aiAssessment?.score,
    summary: report.value?.aiAssessment?.summary,
    rootCause: report.value?.aiAssessment?.rootCause,
    suggestions: report.value?.aiAssessment?.suggestions || [],
    riskHighlights: report.value?.aiAssessment?.riskHighlights || [],
  }
})

const riskHighlights = computed<string[]>(() => {
  return aiAssessment.value.riskHighlights || []
})

const normalizeScore = (score?: number) => {
  if (typeof score !== 'number' || Number.isNaN(score)) return 0
  if (score < 0) return 0
  if (score > 100) return 100
  return Number(score.toFixed(2))
}

const gradeTagType = (grade?: string) => {
  if (grade === 'A') return 'success'
  if (grade === 'B') return 'primary'
  if (grade === 'C') return 'warning'
  return 'danger'
}

const progressStatus = (grade?: string) => {
  if (grade === 'A' || grade === 'B') return 'success'
  if (grade === 'C') return 'warning'
  return 'exception'
}

const cpkLevelTagType = (level?: string) => {
  if (level === '优秀') return 'success'
  if (level === '良好') return 'primary'
  if (level === '待改善') return 'warning'
  if (level === '不合格') return 'danger'
  return 'info'
}

const formatNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'
  return Number.isInteger(num) ? `${num}` : num.toFixed(4)
}

const formatPercent = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (Number.isNaN(num)) return '-'

  if (num <= 1) {
    return `${(num * 100).toFixed(2)}%`
  }

  return `${num.toFixed(2)}%`
}

const formatDuration = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '-'
  const minutes = Number(value)
  if (Number.isNaN(minutes) || minutes < 0) return '-'

  const totalMinutes = Math.floor(minutes)
  const hours = Math.floor(totalMinutes / 60)
  const remainMinutes = totalMinutes % 60
  if (hours <= 0) return `${remainMinutes}分钟`
  if (remainMinutes === 0) return `${hours}小时`
  return `${hours}小时${remainMinutes}分`
}

const formatTimestamp = (ts: unknown) => {
  const num = Number(ts)
  if (Number.isNaN(num)) return '-'
  const date = new Date(num)
  if (Number.isNaN(date.getTime())) return '-'

  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  const hh = `${date.getHours()}`.padStart(2, '0')
  const mm = `${date.getMinutes()}`.padStart(2, '0')
  const ss = `${date.getSeconds()}`.padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`
}

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  return Number.isNaN(num) ? undefined : num
}

const splitToList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter((item) => item.length > 0)
  }
  if (typeof value !== 'string') return []
  return value
    .split(/[;；\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const sanitizeStationStats = (source: unknown): BatchStationStat[] => {
  if (!Array.isArray(source)) return []

  return source.map((raw, index) => {
    const row = raw as Record<string, unknown>
    return {
      stationNo: toNumber(row.stationNo) ?? index + 1,
      stationName:
        (row.stationName as string) ||
        (row.equipName as string) ||
        (row.deviceName as string) ||
        undefined,
      deviceCode: String(row.deviceCode || ''),
      deviceName: (row.deviceName as string) || undefined,
      equipCode: (row.equipCode as string) || undefined,
      equipName: (row.equipName as string) || undefined,
      processType: (row.processType as string) || undefined,
      parameterName: (row.parameterName as string) || undefined,
      unit: (row.unit as string) || undefined,
      targetValue: toNumber(row.targetValue),
      minThreshold: toNumber(row.minThreshold),
      maxThreshold: toNumber(row.maxThreshold),
      sampleCount: toNumber(row.sampleCount),
      mean: toNumber(row.mean),
      stdDev: toNumber(row.stdDev),
      min: toNumber(row.min ?? row.minVal),
      max: toNumber(row.max ?? row.maxVal),
      minVal: toNumber(row.minVal ?? row.min),
      maxVal: toNumber(row.maxVal ?? row.max),
      outOfRangeCount: toNumber(row.outOfRangeCount),
      outOfSpecRate: toNumber(row.outOfSpecRate ?? row.outOfRangeRate),
      outOfRangeRate: toNumber(row.outOfRangeRate ?? row.outOfSpecRate),
      cpk: toNumber(row.cpk),
      cpkLevel: (row.cpkLevel as string) || undefined,
    }
  })
}

const sanitizeEquipmentSensorStats = (source: unknown): BatchStationStat[] => {
  if (!Array.isArray(source)) return []

  const rows: BatchStationStat[] = []

  source.forEach((equipment) => {
    const equip = equipment as Record<string, unknown>
    const sensorList = Array.isArray(equip.sensorStatsList) ? equip.sensorStatsList : []

    sensorList.forEach((sensor) => {
      const normalized = sanitizeStationStats([sensor])[0]
      if (!normalized) return

      rows.push({
        ...normalized,
        stationNo: rows.length + 1,
        equipCode: normalized.equipCode || (equip.equipCode as string) || undefined,
        equipName: normalized.equipName || (equip.equipName as string) || undefined,
        processType: normalized.processType || (equip.processType as string) || undefined,
      })
    })
  })

  return rows
}

const sanitizeEquipmentStats = (source: unknown): BatchEquipmentStat[] => {
  if (!Array.isArray(source)) return []

  return source.map((raw) => {
    const row = raw as Record<string, unknown>
    const sensorStats = sanitizeStationStats(row.sensorStatsList)

    return {
      processName: (row.processName as string) || undefined,
      equipCode: (row.equipCode as string) || undefined,
      equipName: (row.equipName as string) || undefined,
      processType: (row.processType as string) || undefined,
      cpk: toNumber(row.cpk),
      cpkLevel: (row.cpkLevel as string) || undefined,
      alarmCount: toNumber(row.alarmCount),
      outOfRangeRate: toNumber(row.outOfRangeRate),
      healthComment: (row.healthComment as string) || undefined,
      qualityImpact: (row.qualityImpact as string) || undefined,
      sensorStatsList: sensorStats,
    }
  })
}

const sanitizeAlarmDistribution = (source: unknown): BatchAlarmDistribution[] => {
  if (!Array.isArray(source)) return []

  return source.map((raw) => {
    const row = raw as Record<string, unknown>
    return {
      deviceCode: (row.deviceCode as string) || undefined,
      processType: (row.processType as string) || undefined,
      alarmType: (row.alarmType as string) || (row.processType as string) || undefined,
      alarmLevel: (row.alarmLevel as string) || undefined,
      alarmCount: toNumber(row.alarmCount) ?? 0,
    }
  })
}

const sanitizeReport = (raw: BatchQualityReportRaw | BatchQualityReport): BatchQualityReport => {
  const reportRaw = raw as BatchQualityReportRaw
  const normalizedFromFlat = Boolean(
    reportRaw.batchNo || reportRaw.stationStatsList || reportRaw.equipmentStatsList || reportRaw.processQualityList,
  )

  if (normalizedFromFlat) {
    const targetQty = toNumber(reportRaw.targetQty)
    const actualQty = toNumber(reportRaw.actualQty)
    const badQty = toNumber(reportRaw.badQty)
    const groupedStatsSource = reportRaw.equipmentStatsList || reportRaw.processQualityList
    const equipmentStats = sanitizeEquipmentStats(groupedStatsSource)
    const sensorStats = sanitizeEquipmentSensorStats(groupedStatsSource)
    const legacyStationStats = sanitizeStationStats(reportRaw.stationStatsList)
    const suggestion = reportRaw.aiImprovementSuggestion

    return {
      basicInfo: {
        batchNo: reportRaw.batchNo || searchForm.batchNo,
        orderNo: reportRaw.orderNo || reportRaw.woNo,
        woNo: reportRaw.woNo,
        productName: reportRaw.productName,
        targetQty,
        actualQty,
        goodQty:
          typeof actualQty === 'number' && typeof badQty === 'number'
            ? actualQty - badQty
            : undefined,
        badQty,
        yieldRate: toNumber(reportRaw.yieldRate),
        durationMinutes: toNumber(reportRaw.durationMinutes),
        overallCpk: toNumber(reportRaw.overallCpk),
        cpkPassCount: toNumber(reportRaw.cpkPassCount),
        cpkFailCount: toNumber(reportRaw.cpkFailCount),
        bestStationCode: reportRaw.bestStationCode,
        worstStationCode: reportRaw.worstStationCode,
        batchStatus: reportRaw.batchStatus,
        batchStatusLabel:
          typeof reportRaw.batchStatus === 'string' ? reportRaw.batchStatus : undefined,
        startTime: reportRaw.startTime,
        endTime: reportRaw.endTime,
      },
      stationStats: sensorStats.length ? sensorStats : legacyStationStats,
      equipmentStats,
      alarmDistribution: sanitizeAlarmDistribution(reportRaw.alarmDistribution),
      aiAssessment: {
        grade: reportRaw.qualityGrade,
        score: reportRaw.qualityScore,
        summary: reportRaw.aiReportSummary,
        rootCause: reportRaw.aiRootCauseAnalysis,
        suggestions: splitToList(suggestion),
        riskHighlights: splitToList(reportRaw.aiRiskHighlights),
      },
      totalAlarmCount: toNumber(reportRaw.totalAlarmCount),
      generatedAt: reportRaw.reportTime,
      cacheTtlSeconds: 1800,
    }
  }

  const old = raw as BatchQualityReport
  const basic = (old.basicInfo || {}) as BatchQualityBasicInfo
  const aiRaw = (old.aiAssessment || {}) as BatchAiAssessment
  const normalizedSuggestions = Array.isArray(aiRaw.suggestions) ? aiRaw.suggestions : []

  return {
    ...old,
    basicInfo: {
      batchNo: basic.batchNo || searchForm.batchNo,
      orderNo: basic.orderNo,
      woNo: basic.woNo,
      productName: basic.productName,
      targetQty: basic.targetQty,
      actualQty: basic.actualQty,
      goodQty: basic.goodQty,
      badQty: basic.badQty,
      yieldRate: basic.yieldRate,
      durationMinutes: basic.durationMinutes,
      overallCpk: basic.overallCpk,
      cpkPassCount: basic.cpkPassCount,
      cpkFailCount: basic.cpkFailCount,
      bestStationCode: basic.bestStationCode,
      worstStationCode: basic.worstStationCode,
      batchStatus: basic.batchStatus,
      batchStatusLabel: basic.batchStatusLabel,
      startTime: basic.startTime,
      endTime: basic.endTime,
    },
    stationStats: sanitizeStationStats(old.stationStats),
    equipmentStats: sanitizeEquipmentStats(old.equipmentStats),
    alarmDistribution: sanitizeAlarmDistribution(old.alarmDistribution),
    aiAssessment: {
      grade: aiRaw.grade,
      score: aiRaw.score,
      summary: aiRaw.summary,
      rootCause: aiRaw.rootCause,
      suggestions: normalizedSuggestions,
      riskHighlights: splitToList(aiRaw.riskHighlights),
    },
    totalAlarmCount: toNumber(old.totalAlarmCount),
    cacheTtlSeconds: old.cacheTtlSeconds,
    generatedAt: old.generatedAt,
  }
}

const handleGenerate = async () => {
  if (!searchForm.batchNo.trim()) {
    ElMessage.warning('请先输入批次号')
    return
  }

  loading.value = true
  try {
    const res = await getBatchQualityReport(searchForm.batchNo.trim())
    report.value = sanitizeReport(res.data || {})
    ElMessage.success('质量报告生成成功')
  } finally {
    loading.value = false
  }
}

const handleClearCache = async () => {
  if (!searchForm.batchNo.trim()) {
    ElMessage.warning('请先输入批次号')
    return
  }

  await ElMessageBox.confirm(`确认清除批次 ${searchForm.batchNo} 的缓存？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })

  await clearBatchQualityCache(searchForm.batchNo.trim())
  ElMessage.success('缓存已清除')
}

const openTimeSeries = async (row: BatchStationStat) => {
  if (!searchForm.batchNo.trim()) {
    ElMessage.warning('请先输入批次号')
    return
  }
  if (!row.deviceCode) {
    ElMessage.warning('当前传感器缺少编码，无法查询时序数据')
    return
  }

  currentDevice.value = row.deviceCode
  timeSeriesVisible.value = true
  timeSeriesLoading.value = true
  try {
    const res = await getBatchQualityTimeSeries(searchForm.batchNo.trim(), row.deviceCode)
    timeSeriesList.value = Array.isArray(res.data) ? res.data : []
  } finally {
    timeSeriesLoading.value = false
  }
}
</script>

<style scoped>
.container {
  padding: 20px;
}

.box-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.search-input {
  width: 320px;
}

.loading-tip {
  margin-bottom: 12px;
}

.report-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-meta {
  margin-bottom: 4px;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-card {
  margin-bottom: 0;
}

.section-card.compact {
  height: 100%;
}

.section-row {
  margin-top: 0;
}

.equipment-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.equipment-item {
  border: 1px solid var(--el-border-color-lighter);
}

.equipment-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.equipment-title {
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.equipment-code {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.equipment-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.equipment-comment {
  margin-bottom: 10px;
}

.ai-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-score-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.ai-score-text {
  font-weight: 600;
}

.suggestion-list {
  margin: 0;
  padding-left: 18px;
}

.risk-highlight-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.risk-tag {
  white-space: normal;
  height: auto;
  line-height: 1.5;
  max-width: 100%;
}

.drawer-top {
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .search-input {
    width: 100%;
  }

  .ai-score-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
