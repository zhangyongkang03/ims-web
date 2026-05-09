import type { Device } from './device'
import type { ApiResponse } from './request'
import request from './request'

export interface Equipment {
  equipId: string
  equipCode: string
  equipName: string
  model?: string
  stationId: number
  stationName?: string
  status: number
  statusLabel?: string
  installDate?: string
  expiryDate?: string
  createTime?: string
  sensorCount?: number
}

export interface EquipmentForm {
  equipCode: string
  equipName: string
  model?: string
  stationId: number
  status: number
  installDate?: string
  expiryDate?: string
}

export interface EquipmentDetail {
  equipment: Equipment
  sensors: Device[]
}

export interface PageResult<T> {
  total: number
  records: T[]
}

function normalizeEquipment(raw: any): Equipment {
  return {
    equipId: String(raw?.equipId ?? ''),
    equipCode: String(raw?.equipCode ?? ''),
    equipName: String(raw?.equipName ?? ''),
    model: raw?.model ? String(raw.model) : '',
    stationId: Number(raw?.stationId ?? 0),
    stationName: raw?.stationName ? String(raw.stationName) : '',
    status: Number(raw?.status ?? 0),
    statusLabel: raw?.statusLabel ? String(raw.statusLabel) : '',
    installDate: raw?.installDate,
    expiryDate: raw?.expiryDate,
    createTime: raw?.createTime,
    sensorCount: raw?.sensorCount == null ? 0 : Number(raw.sensorCount),
  }
}

export function getEquipmentList(params: {
  pageNum?: number
  pageSize?: number
  searchKey?: string
  stationId?: number
  status?: number
}) {
  return request.get<ApiResponse<PageResult<Equipment>>>('/equipments', { params }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      total: Number(res.data?.total ?? 0),
      records: (res.data?.records || []).map(normalizeEquipment),
    },
  }))
}

export function getEquipmentDetail(equipId: string | number) {
  return request.get<ApiResponse<EquipmentDetail>>(`/equipments/${equipId}`).then((res) => ({
    ...res,
    data: {
      ...res.data,
      equipment: normalizeEquipment(res.data?.equipment),
      sensors: res.data?.sensors || [],
    },
  }))
}

export function addEquipment(data: EquipmentForm) {
  return request.post<ApiResponse>('/equipments', data)
}

export function updateEquipment(equipId: string | number, data: Partial<EquipmentForm>) {
  return request.put<ApiResponse>(`/equipments/${equipId}`, data)
}

export function deleteEquipment(equipId: string | number) {
  return request.delete<ApiResponse>(`/equipments/${equipId}`)
}

export function updateEquipmentStatus(equipId: string | number, status: number) {
  return request.put<ApiResponse>(`/equipments/${equipId}/status`, null, { params: { status } })
}
