import type { ApiResponse } from './request'
import request from './request'

export type TraceDirection = 'backward' | 'forward'

export interface TraceabilityProductInfo {
  spec: string | null
  unit: string | null
  pid: string
  pname: string
  pcode: string
}

export interface TraceabilityBatchInfo {
  batchNo: string
  targetQty: number | string | null
  actualQty: number | string | null
  badQty: number | string | null
  yieldRate: number | string | null
  batchStatus: number | string | null
  statusLabel: string | null
  startTime: string | null
  endTime: string | null
  durationMinutes: number | string | null
}

export interface TraceabilityWorkOrderInfo {
  woNo: string
  woId: string
  targetQty: number | string | null
  completedQty: number | string | null
  status: number | string | null
  statusLabel: string | null
  plannedStart: string | null
  plannedEnd: string | null
}

export interface TraceabilityRecipeItem {
  materialName: string
  materialCode: string
  standardQty: number | string | null
  unit: string | null
}

export interface TraceabilityRecipeInfo {
  recipeId: string
  recipeName: string
  recipeCode: string
  baseQty: number | string | null
  batchTargetQty: number | string | null
  items: TraceabilityRecipeItem[]
}

export interface TraceabilityConsumptionItem {
  lotNo: string
  materialName: string
  materialCode: string
  consumeQty: number | string | null
  uom: string | null
  feedTime: string | null
  supplierName: string | null
  expiryDate: string | null
  arrivalTime: string | null
}

export interface TraceabilityProcessSummaryItem {
  processType: string
  processName: string
  equipName: string | null
  parameterName: string
  mean: number | string | null
  stdDev: number | string | null
  minVal: number | string | null
  maxVal: number | string | null
  sampleCount: number | string | null
  outOfRangeRate: number | string | null
}

export interface TraceabilityQualityEvent {
  deviceCode: string
  alarmLevel: string
  currentValue: number | string | null
  standardRange: string | null
  alarmMsg: string | null
  createTime: string | null
}

export interface TraceabilityAiRiskRecord {
  deviceCode: string
  riskScore: number | string | null
  riskLevel: string | null
  reason: string | null
  analysisTime: string | null
}

export interface TraceabilityProductDestination {
  shipNo: string
  customerName: string | null
  quantity: number | string | null
  shipTime: string | null
}

export interface TraceabilityMaterialLotInfo {
  lotNo: string
  materialName: string
  materialCode: string
  arrivalQty: number | string | null
  unit: string | null
  supplierName: string | null
  arrivalTime: string | null
  expiryDate: string | null
}

export interface TraceabilityAffectedBatch {
  batchNo: string
  productName: string | null
  woNo: string | null
  actualQty: number | string | null
  badQty: number | string | null
  yieldRate: number | string | null
  consumeQty: number | string | null
  uom: string | null
  startTime: string | null
  endTime: string | null
}

export interface TraceabilityStructuredData {
  direction: string | null
  traceKey: string | null
  traceTime: string | null
  productInfo: TraceabilityProductInfo | null
  batchInfo: TraceabilityBatchInfo | null
  workOrderInfo: TraceabilityWorkOrderInfo | null
  recipeInfo: TraceabilityRecipeInfo | null
  consumptionList: TraceabilityConsumptionItem[]
  processSummaryList: TraceabilityProcessSummaryItem[]
  qualityEvents: TraceabilityQualityEvent[]
  aiRiskRecords: TraceabilityAiRiskRecord[]
  productDestinations: TraceabilityProductDestination[]
  materialLotInfo: TraceabilityMaterialLotInfo | null
  affectedBatches: TraceabilityAffectedBatch[]
}

export type TraceabilityResponseRaw =
  | TraceabilityStructuredData
  | Record<string, unknown>
  | Array<Record<string, unknown>>
  | null

export function getBackwardTraceability(batchNo: string) {
  return request.get<ApiResponse<TraceabilityResponseRaw>>('/traceability/backward', {
    params: { batchNo },
  })
}

export function getForwardTraceability(lotNo: string) {
  return request.get<ApiResponse<TraceabilityResponseRaw>>('/traceability/forward', {
    params: { lotNo },
  })
}
