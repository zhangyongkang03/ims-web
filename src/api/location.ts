import type { ApiResponse } from './request'
import request from './request'

export interface Location {
  locId: string
  whId: string
  whCode?: string
  whName?: string
  locCode: string
  locType?: number
  maxCapacity?: number
  currentLoad?: number
  isActive: number
  status: number
  createTime?: string
  updateTime?: string
}

export interface LocationForm {
  locId?: string
  whId?: string
  locCode: string
  locType?: number
  maxCapacity?: number
  currentLoad?: number
  isActive: number
  status: number
}

export interface PageResult<T> {
  total: number
  records: T[]
}

function normalizeLocation(raw: any): Location {
  return {
    locId: String(raw?.locId ?? ''),
    whId: String(raw?.whId ?? ''),
    whCode: raw?.whCode ? String(raw.whCode) : '',
    whName: raw?.whName ? String(raw.whName) : '',
    locCode: String(raw?.locCode ?? ''),
    locType: raw?.locType == null ? undefined : Number(raw.locType),
    maxCapacity: raw?.maxCapacity == null ? undefined : Number(raw.maxCapacity),
    currentLoad: raw?.currentLoad == null ? undefined : Number(raw.currentLoad),
    isActive: Number(raw?.isActive ?? 0),
    status: Number(raw?.status ?? 0),
    createTime: raw?.createTime,
    updateTime: raw?.updateTime,
  }
}

/**
 * 分页查询库位列表
 */
export function getLocationList(params: {
  pageNum?: number
  pageSize?: number
  whId?: string
  searchKey?: string
  locType?: number
  isActive?: number
  status?: number
}) {
  return request.get<ApiResponse<PageResult<Location>>>('/locations', { params }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      total: Number(res.data?.total ?? 0),
      records: Array.isArray(res.data?.records) ? res.data.records.map(normalizeLocation) : [],
    },
  }))
}

/**
 * 获取库位详情
 */
export function getLocationDetail(locId: string) {
  return request.get<ApiResponse<Location>>(`/locations/${locId}`).then((res) => ({
    ...res,
    data: normalizeLocation(res.data),
  }))
}

/**
 * 新增库位
 */
export function addLocation(data: LocationForm) {
  return request.post<ApiResponse>('/locations', data)
}

/**
 * 修改库位
 */
export function updateLocation(locId: string, data: Partial<LocationForm>) {
  return request.put<ApiResponse>(`/locations/${locId}`, data)
}

/**
 * 删除库位
 */
export function deleteLocation(locId: string) {
  return request.delete<ApiResponse>(`/locations/${locId}`)
}
