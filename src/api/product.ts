import type { ApiResponse } from './request'
import request from './request'

// 产品信息
export interface Product {
  pId: number
  pCode: string
  pName: string
  pSpec: string
  pUnit: string
  spec_value?: number | string
  spec_unit?: string
  pid: number
  pcode: string
  pname: string
  pspec: string
  punit: string
  shelfLife?: number
  storageCondition?: string
  status: number
  createTime: string
  updateTime?: string
}

// 产品表单
export interface ProductForm {
  pId?: number
  pCode?: string
  pName: string
  pUnit: string
  spec_value?: number | string
  spec_unit?: string
  shelfLife?: number
  storageCondition?: string
  status: number
}

// 分页响应
export interface PageResult<T> {
  total: number
  records: T[]
}

function normalizeProduct(raw: any): Product {
  const pId = raw?.pId ?? raw?.pid ?? 0
  const pCode = raw?.pCode ?? raw?.pcode ?? ''
  const pName = raw?.pName ?? raw?.pname ?? ''
  const pUnit = raw?.pUnit ?? raw?.punit ?? ''
  const spec_value = raw?.spec_value ?? raw?.specValue ?? ''
  const spec_unit = raw?.spec_unit ?? raw?.specUnit ?? ''
  const formattedSpecValue =
    spec_value === undefined || spec_value === null ? '' : String(spec_value)
  const pSpec = [formattedSpecValue, spec_unit].filter(Boolean).join('')
  const displaySpec = [pSpec, pUnit].filter(Boolean).join('/')

  return {
    ...raw,
    pId,
    pCode,
    pName,
    pSpec: displaySpec,
    pUnit,
    spec_value,
    spec_unit,
    pid: pId,
    pcode: pCode,
    pname: pName,
    pspec: displaySpec,
    punit: pUnit,
  }
}

/**
 * 分页查询产品列表
 */
export function getProductList(params: {
  pageNum?: number
  pageSize?: number
  searchKey?: string
  searchStatus?: number
}) {
  return request.get<ApiResponse<PageResult<any>>>('/products', { params }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      records: (res.data.records || []).map(normalizeProduct),
    },
  }))
}

/**
 * 查询启用产品选项
 */
export function getProductOptions() {
  return request.get<ApiResponse<any[]>>('/products/options').then((res) => ({
    ...res,
    data: (res.data || []).map(normalizeProduct),
  }))
}

/**
 * 获取产品详情
 */
export function getProductDetail(pId: number) {
  return request.get<ApiResponse<any>>(`/products/${pId}`).then((res) => ({
    ...res,
    data: normalizeProduct(res.data),
  }))
}

/**
 * 新增产品
 */
export function addProduct(data: ProductForm) {
  return request.post<ApiResponse>('/products', data)
}

/**
 * 修改产品
 */
export function updateProduct(pId: number, data: Partial<ProductForm>) {
  return request.put<ApiResponse>(`/products/${pId}`, data)
}

/**
 * 删除产品
 */
export function deleteProduct(pId: number) {
  return request.delete<ApiResponse>(`/products/${pId}`)
}
