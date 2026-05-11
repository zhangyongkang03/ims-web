import type { ApiRequestConfig, ApiResponse } from './request'
import request from './request'

export type ProcessType =
  | 'MIXING'
  | 'STERILIZING'
  | 'FILLING'
  | 'SEALING'
  | 'LABELING'
  | 'PACKAGING'

export type DecisionType = 'RULE' | 'AI' | 'FALLBACK'

export interface AiAnalysisResult {
  deviceCode: string
  batchNo: string
  processType: string
  riskScore: number
  riskLevel: string
  reason: string
  suggestion: string
  finalDecision: string
  statsSnapshot: string
  analysisTime: string
  sensorCount?: number
}

export interface AiAnalyzeRequest {
  batchNo: string
  deviceCode: string
  processType: string
  mean: number
  variance: number
  maxVal: number
  minVal: number
  sampleCount: number
  windowStartTime: number
  windowEndTime: number
}

export interface AiChatRequest {
  question: string
}

export interface AiChatResponse {
  question: string
  generatedSql: string
  queryResult: Array<Record<string, unknown>>
  answer: string
  timestamp: string
}

export interface AiHistoryPageResult {
  records: AiAnalysisResult[]
  total: number
  pages: number
  pageNum: number
  pageSize: number
}

export interface PageResult<T> {
  records: T[]
  total: number
  pages?: number
  pageNum?: number
  pageSize?: number
}

export interface AiDecisionRecord {
  decisionId: number
  refDeviceCode: string
  decisionType: DecisionType
  riskLevel: string
  suggestionContent: string
  isAdopted: 0 | 1 | 2
  createTime: string
}

export interface AiDecisionFeedbackForm {
  isAdopted: 1 | 2
  handleUser: string
}

export interface AiKnowledgeItem {
  kbId: number
  symptomKeyword: string
  processType: ProcessType
  possibleCause: string
  solutionSuggestion: string
  expertLevel: number
  hitCount: number
  source: 'MANUAL' | 'AI_FEEDBACK'
}

export interface AiKnowledgeForm {
  symptomKeyword: string
  processType: ProcessType
  possibleCause: string
  solutionSuggestion: string
  expertLevel: number
}

export interface AiRuleItem {
  ruleId: number
  ruleName: string
  metricName: 'fill_std' | 'speed' | 'temp' | string
  operator: '>' | '<' | '>=' | '<='
  thresholdValue: number
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  action: string
  skipLlm: 0 | 1
  priority: number
  isActive: 0 | 1
}

export interface AiRuleForm {
  ruleName: string
  metricName: 'fill_std' | 'speed' | 'temp' | string
  operator: '>' | '<' | '>=' | '<='
  thresholdValue: number
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY'
  action: string
  skipLlm: 0 | 1
  priority: number
  isActive: 0 | 1
}

export interface AiModelConfig {
  configId: number
  configName: string
  modelName: string
  temperature: number
  isActive: 0 | 1
}

export interface AiModelConfigForm {
  configId?: number
  configName: string
  modelName: string
  temperature: number
}

export type DeviceTrend = 'UP' | 'DOWN' | 'STABLE' | 'IMPROVING' | 'DECLINING'
export type DeviceUrgency = 'HIGH' | 'MEDIUM' | 'LOW'

export interface DeviceDailyTrendPoint {
  date: string
  healthScore?: number | string
  alarmCount?: number | string
}

export interface DeviceSensorSummary {
  deviceCode: string
  deviceType: string
  sampleCount: number | string
  mean: number | string
  stdDev: number | string
  outOfRangeRate: number | string
  alarmCount: number | string
  healthScore: number | string
}

export interface DeviceEquipmentSummary {
  equipCode: string
  equipName: string
  processType: string
  alarmCount?: number | string
  totalAlarmCount?: number | string
  healthScore?: number | string
  avgHealthScore?: number | string
  trend: DeviceTrend
  runningDays: number | string
  sensorSummaries?: DeviceSensorSummary[]
  dailyHealthTrend?: DeviceDailyTrendPoint[]
  dailyAlarmTrend?: DeviceDailyTrendPoint[]
}

export interface DeviceAlarmTopItem {
  equipCode: string
  equipName: string
  alarmCount: number
  topAlarmMsg: string
}

export interface DeviceMaintenanceSuggestion {
  equipCode: string
  equipName: string
  urgency: DeviceUrgency
  suggestion: string
  suggestedTime: string
  reason: string
}

export type FailureTrend = 'DETERIORATING' | 'STABLE' | 'IMPROVING' | string
export type FailureRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | string

export interface FailurePredictionItem {
  deviceCode: string
  deviceType?: string
  equipCode?: string
  equipName?: string
  trend?: FailureTrend
  riskScoreTrend?: number[]
  alarmCountTrend?: number[]
  thisWeekAlarms?: number
  lastWeekAlarms?: number
  alarmGrowthRate?: number
  daysSinceLastRepair?: number
  lastRepairDate?: string
  predictedRiskLevel?: FailureRiskLevel
  aiRecommendation?: string
  urgency?: DeviceUrgency | FailureRiskLevel
}

export interface FailurePredictionReport {
  predictionDate?: string
  generateTime?: string
  totalDevices?: number
  warningDevices?: number
  predictions: FailurePredictionItem[]
  aiOverview?: string
}

export interface DeviceDailyReport {
  reportType?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  reportDate?: string
  startDate?: string
  endDate?: string
  generateTime: string
  equipmentSummaries?: DeviceEquipmentSummary[]
  // backward compatibility
  deviceSummaries?: DeviceSensorSummary[]
  alarmTopDevices: DeviceAlarmTopItem[]
  aiDailyOverview?: string
  aiOverview?: string
  maintenanceSuggestions: DeviceMaintenanceSuggestion[]
}

export type DeviceReport = DeviceDailyReport

async function getWithFallback<T>(urls: string[], config?: ApiRequestConfig) {
  let lastError: unknown

  for (const [index, url] of urls.entries()) {
    try {
      return await request.get<T>(url, {
        ...config,
        skipErrorLog: index < urls.length - 1,
        skipErrorMessage: index < urls.length - 1,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError
}

export function triggerAiAnalyze(data: AiAnalyzeRequest) {
  return request.post<ApiResponse<AiAnalysisResult>>('/ai/analyze', data)
}

export function getAiLatest(deviceCode: string) {
  return getWithFallback<ApiResponse<AiAnalysisResult>>([
    `/ai-decision/latest/${deviceCode}`,
    `/ai/latest/${deviceCode}`,
  ])
}

export function getAiHistory(params: {
  pageNum?: number
  pageSize?: number
  deviceCode?: string
  riskLevel?: string
}) {
  return getWithFallback<ApiResponse<AiHistoryPageResult>>(
    ['/ai-decision/history', '/ai/history'],
    {
      params,
    },
  )
}

export function getAiDecisions(params: {
  pageNum?: number
  pageSize?: number
  deviceCode?: string
  decisionType?: DecisionType
}) {
  return request.get<ApiResponse<PageResult<AiDecisionRecord>>>('/ai/decisions', { params })
}

export function submitAiDecisionFeedback(decisionId: number, data: AiDecisionFeedbackForm) {
  return request.post<ApiResponse<null>>(`/ai/decisions/${decisionId}/feedback`, data)
}

export function getAiKnowledgeList(params: {
  pageNum?: number
  pageSize?: number
  keyword?: string
  processType?: ProcessType
}) {
  return request.get<ApiResponse<PageResult<AiKnowledgeItem>>>('/ai/knowledge', { params })
}

export function createAiKnowledge(data: AiKnowledgeForm) {
  return request.post<ApiResponse<null>>('/ai/knowledge', data)
}

export function updateAiKnowledge(kbId: number, data: AiKnowledgeForm) {
  return request.put<ApiResponse<null>>(`/ai/knowledge/${kbId}`, data)
}

export function deleteAiKnowledge(kbId: number) {
  return request.delete<ApiResponse<null>>(`/ai/knowledge/${kbId}`)
}

export function searchAiKnowledge(params: { keyword: string; processType?: ProcessType }) {
  return request.get<ApiResponse<AiKnowledgeItem[]>>('/ai/knowledge/search', { params })
}

export function getAiRules() {
  return request.get<ApiResponse<AiRuleItem[]>>('/ai/rules')
}

export function createAiRule(data: AiRuleForm) {
  return request.post<ApiResponse<null>>('/ai/rules', data)
}

export function updateAiRule(ruleId: number, data: AiRuleForm) {
  return request.put<ApiResponse<null>>(`/ai/rules/${ruleId}`, data)
}

export function deleteAiRule(ruleId: number) {
  return request.delete<ApiResponse<null>>(`/ai/rules/${ruleId}`)
}

export function getAiModelConfigs() {
  return request.get<ApiResponse<AiModelConfig[]>>('/ai/model-configs')
}

export function saveAiModelConfig(data: AiModelConfigForm) {
  return request.post<ApiResponse<null>>('/ai/model-configs', data)
}

export function activateAiModelConfig(configId: number) {
  return request.post<ApiResponse<null>>(`/ai/model-configs/${configId}/activate`)
}

export function getFailurePrediction(date?: string) {
  return request.get<ApiResponse<FailurePredictionReport>>('/failure-prediction', {
    params: date ? { date } : undefined,
  })
}

export function chatWithAi(data: AiChatRequest) {
  return request.post<ApiResponse<AiChatResponse>>('/ai/chat', data)
}

export function getLatestDeviceDailyReport() {
  return request.get<ApiResponse<DeviceDailyReport>>('/device-report/daily/latest')
}

export function getDeviceDailyReportByDate(date?: string) {
  return request.get<ApiResponse<DeviceDailyReport>>('/device-report/daily', {
    params: date ? { date } : undefined,
  })
}

export function getTodayDeviceDailyReport() {
  return request.get<ApiResponse<DeviceDailyReport>>('/device-report/daily/today')
}

export function getDeviceWeeklyReportByDate(date?: string) {
  return request.get<ApiResponse<DeviceReport>>('/device-report/weekly', {
    params: date ? { date } : undefined,
  })
}

export function getDeviceMonthlyReportByDate(date?: string) {
  return request.get<ApiResponse<DeviceReport>>('/device-report/monthly', {
    params: date ? { date } : undefined,
  })
}
