import type { ApiResponse } from './request'
import request from './request'

export type ProductionReportType = 'DAILY' | 'WEEKLY' | 'MONTHLY'

export interface ProductionOverview {
  totalTargetQty?: number
  totalOutput?: number
  qualifiedOutput?: number
  badQty?: number
  qualificationRate?: number
  badRate?: number
  batchCount?: number
  workOrderCount?: number
}

export interface ProductionProductItem {
  productId?: string | number
  productCode?: string
  productName?: string
  targetQty?: number
  actualQty?: number
  qualifiedQty?: number
  badQty?: number
  qualificationRate?: number
}

export interface ProductionDefectItem {
  processName?: string
  processType?: string
  badQty?: number
  defectRate?: number
}

export interface ProductionTrendItem {
  date?: string
  label?: string
  totalOutput?: number
  qualifiedOutput?: number
  qualificationRate?: number
  badQty?: number
  batchCount?: number
}

export interface ProductionBatchDetailItem {
  batchNo?: string
  woNo?: string
  productName?: string
  targetQty?: number
  actualQty?: number
  badQty?: number
  qualificationRate?: number
  startTime?: string
  endTime?: string
  durationMinutes?: number
}

export interface ProductionAiSummary {
  summary?: string
  improvementSuggestion?: string
  riskHighlights?: string[] | string
}

export interface ProductionReportRaw {
  reportType?: ProductionReportType
  reportDate?: string
  startDate?: string
  endDate?: string
  generateTime?: string
  totalTargetQty?: number
  totalActualQty?: number
  totalBadQty?: number
  totalGoodQty?: number
  yieldRate?: number
  totalOutput?: number
  qualifiedOutput?: number
  badQty?: number
  qualificationRate?: number
  badRate?: number
  batchCount?: number
  workOrderCount?: number
  overview?: ProductionOverview
  productStats?: ProductionProductItem[]
  productBreakdowns?: ProductionProductItem[]
  productSummaryList?: ProductionProductItem[]
  productReportList?: ProductionProductItem[]
  defectDistribution?: ProductionDefectItem[]
  defectDistributions?: ProductionDefectItem[]
  processDefectDistribution?: ProductionDefectItem[]
  dailyTrend?: ProductionTrendItem[]
  dailyTrends?: ProductionTrendItem[]
  trendList?: ProductionTrendItem[]
  batchDetails?: ProductionBatchDetailItem[]
  aiSummary?: string
  aiSuggestion?: string
  aiOverview?: string
  aiImprovementSuggestion?: string
  improvementSuggestion?: string
  aiRiskHighlights?: string[] | string
}

export interface ProductionReport {
  reportDate?: string
  startDate?: string
  endDate?: string
  generateTime?: string
  overview?: ProductionOverview
  productStats: ProductionProductItem[]
  defectDistribution: ProductionDefectItem[]
  dailyTrend: ProductionTrendItem[]
  batchDetails: ProductionBatchDetailItem[]
  aiSummary?: ProductionAiSummary
}

export function getProductionReport(type: ProductionReportType, date?: string) {
  return request.get<ApiResponse<ProductionReportRaw | ProductionReport>>('/production-report', {
    params: {
      type,
      ...(date ? { date } : {}),
    },
  })
}
