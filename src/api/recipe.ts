import type { ApiResponse } from './request'
import request from './request'

// 配方信息
export interface Recipe {
  recipeId: number
  pid: number
  pname?: string
  recipeCode: string
  recipeName: string
  baseQty: number
  baseUnit?: string
  baseUnitName?: string
  isActive: number
  isActiveLabel?: string
  createTime: string
  updateTime?: string
}

// 配方表单
export interface RecipeForm {
  recipeId?: number
  pId?: number
  recipeCode?: string
  recipeName: string
  baseQty: number
  baseUnit?: string
  isActive: number
}

// 配方明细信息
export interface RecipeDetail {
  detailId: number
  recipeId: number
  mid: number
  mname?: string
  standardQty: number
  unit: string
  inputUnit?: string
  createTime?: string
  updateTime?: string
}

// 配方明细表单
export interface RecipeDetailForm {
  detailId?: number
  recipeId: number
  mId: number
  standardQty: number
  unit: string
  inputUnit?: string
}

// 分页响应
export interface PageResult<T> {
  total: number
  records: T[]
}

function normalizeRecipe(raw: any): Recipe {
  const recipeId = Number(raw?.recipeId ?? 0)
  const pid = Number(raw?.pid ?? raw?.pId ?? 0)
  const baseQty = Number(raw?.baseQty ?? 0)
  const isActive = Number(raw?.isActive ?? 0)
  const baseUnit = raw?.baseUnit ?? raw?.base_unit ?? ''
  const baseUnitName = raw?.baseUnitName ?? raw?.baseUnitLabel ?? baseUnit

  return {
    ...raw,
    recipeId,
    pid,
    pId: pid,
    recipeCode: raw?.recipeCode ?? '',
    recipeName: raw?.recipeName ?? '',
    baseQty,
    baseUnit,
    baseUnitName,
    isActive,
  }
}

/**
 * 分页查询配方列表
 */
export function getRecipeList(params: {
  pageNum?: number
  pageSize?: number
  recipeCode?: string
  searchKey?: string
  pId?: number
  isActive?: number
}) {
  return request.get<ApiResponse<PageResult<any>>>('/recipes', { params }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      total: Number(res.data.total || 0),
      records: (res.data.records || []).map(normalizeRecipe),
    },
  }))
}

/**
 * 获取配方详情
 */
export function getRecipeDetail(recipeId: number) {
  return request.get<ApiResponse<any>>(`/recipes/${recipeId}`).then((res) => ({
    ...res,
    data: normalizeRecipe(res.data),
  }))
}

/**
 * 新增配方
 */
export function addRecipe(data: RecipeForm) {
  return request.post<ApiResponse>('/recipes', data)
}

/**
 * 修改配方
 */
export function updateRecipe(recipeId: number, data: Partial<RecipeForm>) {
  return request.put<ApiResponse>(`/recipes/${recipeId}`, data)
}

/**
 * 删除配方
 */
export function deleteRecipe(recipeId: number) {
  return request.delete<ApiResponse>(`/recipes/${recipeId}`)
}

/**
 * 分页查询配方明细列表
 */
export function getRecipeDetailList(params: {
  pageNum?: number
  pageSize?: number
  recipeId?: number
  mId?: number
}) {
  return request.get<ApiResponse<PageResult<RecipeDetail>>>('/recipe-details', { params })
}

/**
 * 获取配方明细详情
 */
export function getRecipeDetailInfo(detailId: number) {
  return request.get<ApiResponse<RecipeDetail>>(`/recipe-details/${detailId}`)
}

/**
 * 新增配方明细
 */
export function addRecipeDetail(data: RecipeDetailForm) {
  return request.post<ApiResponse>('/recipe-details', {
    ...data,
    ...(data.inputUnit ? { inputUnit: data.inputUnit } : {}),
  })
}

/**
 * 修改配方明细
 */
export function updateRecipeDetail(detailId: number, data: Partial<RecipeDetailForm>) {
  return request.put<ApiResponse>(`/recipe-details/${detailId}`, {
    ...data,
    ...(data.inputUnit ? { inputUnit: data.inputUnit } : {}),
  })
}

/**
 * 删除配方明细
 */
export function deleteRecipeDetail(detailId: number) {
  return request.delete<ApiResponse>(`/recipe-details/${detailId}`)
}
