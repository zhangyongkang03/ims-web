import type { ApiResponse } from './request'
import request from './request'

export interface PageResult<T> {
  total: number
  records: T[]
  pages?: number
  pageNum?: number
  pageSize?: number
}

export interface StockRequestItem {
  detailId: string
  itemId?: string
  itemCode?: string
  itemName: string
  batchNo?: string
  warehouseName?: string
  locationName?: string
  quantity: number
  unit?: string
}

interface NormalizedStockRequestItemSource {
  detailId: string
  itemId?: string
  itemCode?: string
  itemName: string
  quantity: number
  unit?: string
}

export interface StockRequest {
  requestId: string
  requestNo: string
  status: number
  statusLabel: string
  bizType?: string
  bizTypeLabel: string
  woId?: string
  woNo?: string
  productName?: string
  recipeName?: string
  batchNo?: string
  applicantName?: string
  reason?: string
  createTime?: string
  confirmTime?: string
}

export interface StockRequestDetail extends StockRequest {
  itemList: StockRequestItem[]
}

const normalizeStatusLabel = (status: number, raw: any) => {
  if (raw?.statusLabel) return String(raw.statusLabel)
  const map: Record<number, string> = {
    0: '待确认',
    1: '已确认',
    2: '已驳回',
  }
  return map[status] || '未知'
}

const normalizeBizTypeLabel = (bizType: string | undefined, raw: any) => {
  if (raw?.bizTypeLabel) return String(raw.bizTypeLabel)
  if (raw?.phaseLabel) return String(raw.phaseLabel)
  const map: Record<string, string> = {
    START_MIXING: '启动配液',
    START_FILLING: '启动罐装',
    MIXING: '启动配液',
    FILLING: '启动罐装',
    '1': '启动配液',
    '2': '启动罐装',
  }
  return (bizType && map[bizType]) || '出库申请'
}

function normalizeStockRequest(raw: any): StockRequest {
  const status = Number(raw?.status ?? raw?.requestStatus ?? 0)
  const bizTypeRaw =
    raw?.bizType ?? raw?.requestType ?? raw?.sourceBizType ?? raw?.bizCode ?? raw?.phase
  const bizType = bizTypeRaw !== undefined && bizTypeRaw !== null ? String(bizTypeRaw) : undefined

  return {
    requestId: String(raw?.requestId ?? raw?.id ?? ''),
    requestNo: String(raw?.requestNo ?? raw?.applyNo ?? raw?.orderNo ?? ''),
    status,
    statusLabel: normalizeStatusLabel(status, raw),
    bizType,
    bizTypeLabel: normalizeBizTypeLabel(bizType, raw),
    woId: raw?.woId !== undefined && raw?.woId !== null ? String(raw.woId) : undefined,
    woNo: raw?.woNo ?? raw?.workOrderNo,
    productName: raw?.productName ?? raw?.pName,
    recipeName: raw?.recipeName,
    batchNo: raw?.batchNo,
    applicantName: raw?.applicantName ?? raw?.createByName ?? raw?.createdBy ?? raw?.operatorName,
    reason: raw?.reason ?? raw?.rejectReason,
    createTime: raw?.createTime,
    confirmTime: raw?.confirmTime,
  }
}

function normalizeStockRequestItemBase(raw: any): NormalizedStockRequestItemSource {
  return {
    detailId: String(raw?.detailId ?? raw?.id ?? ''),
    itemId:
      raw?.itemId !== undefined && raw?.itemId !== null
        ? String(raw.itemId)
        : raw?.mid !== undefined && raw?.mid !== null
          ? String(raw.mid)
          : undefined,
    itemCode: raw?.itemCode ?? raw?.mCode ?? raw?.materialCode,
    itemName: String(raw?.itemName ?? raw?.mName ?? raw?.materialName ?? '-'),
    quantity: Number(raw?.quantity ?? raw?.applyQty ?? raw?.requestQty ?? raw?.requiredQty ?? 0),
    unit: raw?.unit ?? raw?.uom,
  }
}

function normalizeStockRequestItems(raw: any): StockRequestItem[] {
  const base = normalizeStockRequestItemBase(raw)
  const lotAllocations = Array.isArray(raw?.lotAllocations) ? raw.lotAllocations : []

  if (lotAllocations.length === 0) {
    return [
      {
        ...base,
        batchNo: raw?.batchNo ?? raw?.lotNo,
        warehouseName: raw?.warehouseName ?? raw?.whName,
        locationName: raw?.locationName ?? raw?.locCode,
      },
    ]
  }

  return lotAllocations.map((allocation: any, index: number) => ({
    ...base,
    detailId: `${base.detailId || base.itemId || base.itemCode || 'detail'}-${index}`,
    batchNo: allocation?.batchNo ?? allocation?.lotNo,
    warehouseName: allocation?.warehouseName ?? allocation?.whName ?? allocation?.whId,
    locationName: allocation?.locationName ?? allocation?.locCode ?? allocation?.locId,
    quantity: Number(allocation?.quantity ?? allocation?.deductQty ?? base.quantity ?? 0),
  }))
}

export function getStockRequestList(params: {
  pageNum?: number
  pageSize?: number
  status?: number
  requestNo?: string
  woNo?: string
}) {
  return request.get<ApiResponse<PageResult<any>>>('/stock-requests', { params }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      total: Number(res.data?.total ?? 0),
      records: (res.data?.records || []).map(normalizeStockRequest),
    } as PageResult<StockRequest>,
  }))
}

export function getStockRequestDetail(requestId: string | number) {
  return request.get<ApiResponse<any>>(`/stock-requests/${requestId}`).then((res) => {
    const raw = res.data || {}
    const itemList = raw.itemList || raw.items || raw.detailList || raw.details || []
    return {
      ...res,
      data: {
        ...normalizeStockRequest(raw),
        itemList: Array.isArray(itemList) ? itemList.flatMap(normalizeStockRequestItems) : [],
      } as StockRequestDetail,
    }
  })
}

export function confirmStockRequest(requestId: string | number) {
  return request.post<ApiResponse>(`/stock-requests/${requestId}/confirm`)
}

export function rejectStockRequest(requestId: string | number, reason: string) {
  return request.post<ApiResponse>(`/stock-requests/${requestId}/reject`, { reason })
}
