import type { ApiResponse } from './request'
import request from './request'

// 工位信息
export interface Station {
  stationId: number
  stationCode: string
  stationName: string
  processType: string
  sortOrder: number
  status: number
  createTime?: string
  updateTime?: string
}

// 工位表单
export interface StationForm {
  stationId?: number
  stationCode?: string
  stationName: string
  processType: string
  sortOrder: number
  status: number
}

// 分页响应
export interface PageResult<T> {
  total: number
  records: T[]
}

function normalizeStationPage(raw: any): PageResult<Station> {
  return {
    total: Number(raw?.total ?? 0),
    records: Array.isArray(raw?.records) ? raw.records.map(normalizeStation) : [],
  }
}

function normalizeStation(raw: any): Station {
  return {
    stationId: Number(raw?.stationId ?? 0),
    stationCode: String(raw?.stationCode ?? ''),
    stationName: String(raw?.stationName ?? ''),
    processType: String(raw?.processType ?? ''),
    sortOrder: Number(raw?.sortOrder ?? 0),
    status: Number(raw?.status ?? 1),
    createTime: raw?.createTime,
    updateTime: raw?.updateTime,
  }
}

/**
 * 分页查询工位列表
 */
export function getStationList(params: {
  pageNum?: number
  pageSize?: number
  searchKey?: string
  searchStatus?: number
}) {
  return request.get<ApiResponse<PageResult<Station>>>('/stations', { params }).then((res) => ({
    ...res,
    data: normalizeStationPage(res.data),
  }))
}

/**
 * 查询启用工位选项
 */
export function getStationOptions() {
  return request.get<ApiResponse<any[]>>('/stations/options').then((res) => ({
    ...res,
    data: (res.data || []).map(normalizeStation),
  }))
}

/**
 * 获取工位详情
 */
export function getStationDetail(stationId: number) {
  return request.get<ApiResponse<Station>>(`/stations/${stationId}`)
}

/**
 * 新增工位
 */
export function addStation(data: StationForm) {
  return request.post<ApiResponse>('/stations', data)
}

/**
 * 修改工位
 */
export function updateStation(stationId: number, data: Partial<StationForm>) {
  return request.put<ApiResponse>(`/stations/${stationId}`, data)
}

/**
 * 删除工位
 */
export function deleteStation(stationId: number) {
  return request.delete<ApiResponse>(`/stations/${stationId}`)
}
