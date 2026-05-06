import type { ApiResponse } from './request'
import request from './request'

export interface BatchQualityBasicInfo {
  batchNo: string
  orderNo?: string
  woNo?: string
  productName?: string
  targetQty?: number
  actualQty?: number
  goodQty?: number
  badQty?: number
  yieldRate?: number
  durationMinutes?: number
  overallCpk?: number
  cpkPassCount?: number
  cpkFailCount?: number
  bestStationCode?: string
  worstStationCode?: string
  batchStatus?: number | string
  batchStatusLabel?: string
  startTime?: string
  endTime?: string
}

export interface BatchStationStat {
  stationNo?: number
  stationName?: string
  deviceCode: string
  deviceName?: string
  equipCode?: string
  equipName?: string
  processType?: string
  parameterName?: string
  unit?: string
  targetValue?: number
  minThreshold?: number
  maxThreshold?: number
  sampleCount?: number
  mean?: number
  stdDev?: number
  min?: number
  max?: number
  minVal?: number
  maxVal?: number
  outOfRangeCount?: number
  outOfSpecRate?: number
  outOfRangeRate?: number
  cpk?: number
  cpkLevel?: string
}

export interface BatchEquipmentStat {
  processName?: string
  equipCode?: string
  equipName?: string
  processType?: string
  cpk?: number
  cpkLevel?: string
  alarmCount?: number
  outOfRangeRate?: number
  healthComment?: string
  qualityImpact?: string
  sensorStatsList?: BatchStationStat[]
}

export interface BatchAlarmDistribution {
  deviceCode?: string
  processType?: string
  alarmType?: string
  alarmLevel?: string
  alarmCount: number
}

export interface BatchAiAssessment {
  grade?: 'A' | 'B' | 'C' | 'D' | string
  score?: number
  summary?: string
  rootCause?: string
  suggestions?: string[]
  riskHighlights?: string[]
}

export interface BatchQualityReport {
  basicInfo?: BatchQualityBasicInfo
  stationStats?: BatchStationStat[]
  equipmentStats?: BatchEquipmentStat[]
  alarmDistribution?: BatchAlarmDistribution[]
  aiAssessment?: BatchAiAssessment
  totalAlarmCount?: number
  cacheTtlSeconds?: number
  generatedAt?: string
}

// 后端当前返回的原始结构（扁平报告体）
export interface BatchQualityReportRaw {
  batchNo?: string
  orderNo?: string
  woNo?: string
  productName?: string
  targetQty?: number
  actualQty?: number
  badQty?: number
  yieldRate?: number
  durationMinutes?: number
  overallCpk?: number
  cpkPassCount?: number
  cpkFailCount?: number
  bestStationCode?: string
  worstStationCode?: string
  batchStatus?: string | number
  startTime?: string
  endTime?: string
  stationStatsList?: BatchStationStat[]
  equipmentStatsList?: BatchEquipmentStat[]
  processQualityList?: BatchEquipmentStat[]
  totalAlarmCount?: number
  alarmDistribution?: BatchAlarmDistribution[]
  qualityGrade?: string
  qualityScore?: number
  aiReportSummary?: string
  aiRootCauseAnalysis?: string
  aiImprovementSuggestion?: string
  aiRiskHighlights?: string | string[]
  reportTime?: string
}

export interface BatchTimeSeriesPoint {
  ts: number
  value: number
  deviceCode?: string
  processType?: string
  batchNo?: string
}

export function getBatchQualityReport(batchNo: string) {
  return request.get<ApiResponse<BatchQualityReportRaw | BatchQualityReport>>(
    `/batch-quality/report/${batchNo}`,
    { timeout: 90000 },
  )
}

export function getBatchQualityTimeSeries(batchNo: string, device: string) {
  return request.get<ApiResponse<BatchTimeSeriesPoint[]>>(
    `/batch-quality/timeseries/${batchNo}/${device}`,
  )
}

export function clearBatchQualityCache(batchNo: string) {
  return request.delete<ApiResponse<null>>(`/batch-quality/cache/${batchNo}`)
}
