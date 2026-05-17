<template>
  <div class="container">
    <el-card class="box-card" v-loading="loading">
      <template #header>
        <div class="card-header">
          <span>设备故障预测</span>
          <div class="header-actions">
            <el-button v-if="showBackButton" plain @click="handleBack">
              {{ backButtonText }}
            </el-button>
          </div>
        </div>
      </template>

      <div class="toolbar">
        <el-date-picker
          v-model="selectedDate"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          placeholder="选择预测日期"
          :disabled-date="disabledDate"
          :clearable="false"
          class="date-picker"
        />
        <el-button type="primary" :loading="loading" @click="handleGenerateByDate">
          查询故障预测
        </el-button>
      </div>

      <div class="meta-row">
        <el-tag type="info"
          >预测日期：{{ failurePrediction?.predictionDate || selectedDate }}</el-tag
        >
        <el-tag type="success">生成时间：{{ failurePrediction?.generateTime || '-' }}</el-tag>
      </div>

      <el-empty v-if="!failurePrediction && !loading" :description="emptyTip" />

      <div v-else-if="failurePrediction" class="content-wrap">
        <el-card shadow="never" class="section-card">
          <template #header>
            <div class="card-header">
              <span>预测概览</span>
              <el-text type="info">近7天趋势预测结果</el-text>
            </div>
          </template>

          <div class="prediction-overview">
            <el-tag type="info">设备总数：{{ totalEquipmentsCount }}</el-tag>
            <el-tag :type="warningDevicesCount > 0 ? 'danger' : 'success'">
              风险设备：{{ warningDevicesCount }}
            </el-tag>
          </div>

          <el-alert
            v-if="failurePrediction.aiOverview"
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
            <el-table-column prop="equipCode" label="设备编码" width="140" />
            <el-table-column prop="equipName" label="设备名称" min-width="140" />
            <el-table-column label="预测风险" width="110">
              <template #default="{ row }">
                <el-tag :type="urgencyTagType(normalizeRiskLevel(row.predictedRiskLevel))">
                  {{ normalizeRiskLevel(row.predictedRiskLevel) }}
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
              <template #default="{ row }">{{
                formatRepairDays(row.daysSinceLastRepair)
              }}</template>
            </el-table-column>
            <el-table-column label="上次维修" width="120">
              <template #default="{ row }">{{ formatRepairDate(row.lastRepairDate) }}</template>
            </el-table-column>
            <el-table-column
              prop="aiRecommendation"
              label="AI 建议"
              min-width="280"
              show-overflow-tooltip
            />
          </el-table>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {
  getFailurePrediction,
  type DeviceUrgency,
  type FailurePredictionItem,
  type FailurePredictionReport,
} from '@/api/ai'
import { ElMessage } from 'element-plus'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const failurePrediction = ref<FailurePredictionReport | null>(null)
const emptyTip = ref('暂无故障预测数据，请选择日期后查询')
const selectedDate = ref(resolveInitialDate())
const fromDeviceReport = computed(() => String(route.query.from || '') === 'device-report')
const showBackButton = computed(() => fromDeviceReport.value || window.history.length > 1)
const backButtonText = computed(() => (fromDeviceReport.value ? '返回设备运行报告' : '返回上一页'))

const failurePredictions = computed<FailurePredictionItem[]>(() => {
  return failurePrediction.value?.predictions || []
})

const totalEquipmentsCount = computed(
  () => failurePrediction.value?.totalEquipments ?? failurePrediction.value?.totalDevices ?? 0,
)

const warningDevicesCount = computed(
  () =>
    failurePrediction.value?.warningEquipments ??
    failurePrediction.value?.warningDevices ??
    failurePredictions.value.filter((item) => normalizeRiskLevel(item.predictedRiskLevel) !== 'LOW')
      .length,
)

function resolveInitialDate() {
  const queryDate = String(route.query.date || '').trim()
  return queryDate || formatDate(new Date())
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

function urgencyTagType(urgency: DeviceUrgency) {
  if (urgency === 'HIGH') return 'danger'
  if (urgency === 'MEDIUM') return 'warning'
  return 'success'
}

function normalizeRiskLevel(value?: string): DeviceUrgency {
  if (value === 'HIGH') return 'HIGH'
  if (value === 'MEDIUM') return 'MEDIUM'
  return 'LOW'
}

function formatPercent(value: number | string | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `${Number(value).toFixed(2)}%`
}

function formatRepairDays(value: number | string | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '无记录'
  const normalized = Math.round(Number(value))
  return normalized < 0 ? '无记录' : `${normalized}`
}

function formatRepairDate(value?: string | null) {
  return value ? value : '无记录'
}

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '请求失败'
}

function handleBack() {
  if (fromDeviceReport.value) {
    router.push({ name: 'AiDeviceReport' })
    return
  }

  if (window.history.length > 1) {
    router.back()
    return
  }

  router.push({ name: 'AiDeviceReport' })
}

async function handleGenerateByDate() {
  loading.value = true
  try {
    const res = await getFailurePrediction(selectedDate.value)
    failurePrediction.value = res.data || null
    emptyTip.value = '暂无故障预测数据，请选择日期后查询'
    router.replace({
      path: '/ai/failure-prediction',
      query: { date: selectedDate.value },
    })
  } catch (error) {
    failurePrediction.value = null
    ElMessage.error(errorMessage(error))
  } finally {
    loading.value = false
  }
}

watch(selectedDate, () => {
  failurePrediction.value = null
  emptyTip.value = '暂无故障预测数据，请选择日期后查询'
})

watch(
  () => route.query.date,
  async (value) => {
    const nextDate = String(value || '').trim()
    if (!nextDate || nextDate === selectedDate.value) return
    selectedDate.value = nextDate
    await handleGenerateByDate()
  },
)

onMounted(async () => {
  await handleGenerateByDate()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
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

.prediction-overview {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.prediction-alert {
  margin-bottom: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
