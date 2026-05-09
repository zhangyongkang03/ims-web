import type { ApiResponse } from './request'
import request from './request'

export interface RepairOrder {
  repairId: string
  equipId: string
  equipName?: string
  equipCode?: string
  orderNo?: string
  faultDesc?: string
  sourceType?: number
  sourceTypeLabel?: string
  priority?: number
  priorityLabel?: string
  repairUser?: string
  status: number
  statusLabel?: string
  startTime?: string
  endTime?: string
  createTime?: string
}

export interface RepairOrderForm {
  equipId: string
  faultDesc?: string
  sourceType?: number
  priority?: number
  repairUser?: string
}

export interface PageResult<T> {
  total: number
  records: T[]
}

function normalizeRepairOrder(raw: any): RepairOrder {
  return {
    repairId: String(raw?.repairId ?? ''),
    equipId: String(raw?.equipId ?? ''),
    equipName: raw?.equipName ? String(raw.equipName) : '',
    equipCode: raw?.equipCode ? String(raw.equipCode) : '',
    orderNo: raw?.orderNo ? String(raw.orderNo) : '',
    faultDesc: raw?.faultDesc ? String(raw.faultDesc) : '',
    sourceType: raw?.sourceType == null ? undefined : Number(raw.sourceType),
    sourceTypeLabel: raw?.sourceTypeLabel ? String(raw.sourceTypeLabel) : '',
    priority: raw?.priority == null ? undefined : Number(raw.priority),
    priorityLabel: raw?.priorityLabel ? String(raw.priorityLabel) : '',
    repairUser: raw?.repairUser ? String(raw.repairUser) : '',
    status: Number(raw?.status ?? 0),
    statusLabel: raw?.statusLabel ? String(raw.statusLabel) : '',
    startTime: raw?.startTime,
    endTime: raw?.endTime,
    createTime: raw?.createTime,
  }
}

export function getRepairOrderList(params: {
  pageNum?: number
  pageSize?: number
  equipId?: string
  status?: number
  searchKey?: string
}) {
  return request.get<ApiResponse<PageResult<RepairOrder>>>('/repair-orders', { params }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      total: Number(res.data?.total ?? 0),
      records: (res.data?.records || []).map(normalizeRepairOrder),
    },
  }))
}

export function getRepairOrderDetail(repairId: string | number) {
  return request.get<ApiResponse<RepairOrder>>(`/repair-orders/${repairId}`).then((res) => ({
    ...res,
    data: normalizeRepairOrder(res.data),
  }))
}

export function addRepairOrder(data: RepairOrderForm) {
  return request.post<ApiResponse>('/repair-orders', data)
}

export function updateRepairOrder(repairId: string | number, data: Partial<RepairOrderForm>) {
  return request.put<ApiResponse>(`/repair-orders/${repairId}`, data)
}

export function deleteRepairOrder(repairId: string | number) {
  return request.delete<ApiResponse>(`/repair-orders/${repairId}`)
}

export function startRepairOrder(repairId: string | number) {
  return request.post<ApiResponse>(`/repair-orders/${repairId}/start`)
}

export function completeRepairOrder(repairId: string | number) {
  return request.post<ApiResponse>(`/repair-orders/${repairId}/complete`)
}
