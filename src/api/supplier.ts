import type { ApiResponse } from './request'
import request from './request'

// 供应商信息
export interface Supplier {
  supId: number
  supCode: string
  supName: string
  supType: string
  contactPerson?: string
  contactPhone?: string
  status: number
  createTime: string
  updateTime?: string
}

// 供应商表单
export interface SupplierForm {
  supId?: number
  supCode?: string
  supName: string
  supType: string
  contactPerson?: string
  contactPhone?: string
  status: number
}

// 分页响应
export interface PageResult<T> {
  total: number
  records: T[]
}

export interface SupplierMaterial {
  mId: number
  mName: string
  mCode: string
}

function normalizeSupplier(raw: any): Supplier {
  return {
    supId: Number(raw?.supId ?? 0),
    supCode: String(raw?.supCode ?? ''),
    supName: String(raw?.supName ?? ''),
    supType: String(raw?.supType ?? ''),
    contactPerson: raw?.contactPerson ?? '',
    contactPhone: raw?.contactPhone ?? '',
    status: Number(raw?.status ?? 1),
    createTime: String(raw?.createTime ?? ''),
    updateTime: raw?.updateTime,
  }
}

/**
 * 分页查询供应商列表
 */
export function getSupplierList(params: {
  pageNum?: number
  pageSize?: number
  searchKey?: string
  searchStatus?: number
}) {
  return request.get<ApiResponse<PageResult<Supplier>>>('/suppliers', { params })
}

/**
 * 查询启用供应商选项
 */
export function getSupplierOptions() {
  return request.get<ApiResponse<any[]>>('/suppliers/options').then((res) => ({
    ...res,
    data: (res.data || []).map(normalizeSupplier),
  }))
}

/**
 * 获取供应商详情
 */
export function getSupplierDetail(supId: number) {
  return request.get<ApiResponse<Supplier>>(`/suppliers/${supId}`)
}

/**
 * 新增供应商
 */
export function addSupplier(data: SupplierForm) {
  return request.post<ApiResponse>('/suppliers', data)
}

/**
 * 修改供应商
 */
export function updateSupplier(supId: number, data: Partial<SupplierForm>) {
  return request.put<ApiResponse>(`/suppliers/${supId}`, data)
}

/**
 * 删除供应商
 */
export function deleteSupplier(supId: number) {
  return request.delete<ApiResponse>(`/suppliers/${supId}`)
}

/**
 * 查询供应商可供应物料列表
 */
export function getSupplierMaterials(supId: number) {
  return request.get<ApiResponse<SupplierMaterial[]>>(`/suppliers/${supId}/materials`)
}

/**
 * 设置供应商可供应物料（提交物料ID列表）
 */
export function setSupplierMaterials(supId: number, materialIds: number[]) {
  return request.post<ApiResponse>(`/suppliers/${supId}/materials`, materialIds)
}

/**
 * 按物料查询可供应供应商
 */
export function getSuppliersByMaterial(materialId: number) {
  return request.get<ApiResponse<Supplier[]>>('/suppliers/by-material', { params: { materialId } })
}
