import type { ApiResponse } from './request'
import request from './request'

export interface MaterialStock {
  id: number
  materialId: string
  materialCode: string
  materialName: string
  totalQuantity: number
  unit: string
  unitName?: string
  lastPurchaseDate: string
  createTime: string
  updateTime: string
}

export interface PageResult<T> {
  total: number
  records: T[]
  pages?: number
  pageNum?: number
  pageSize?: number
}

function normalizeMaterialStock(raw: any): MaterialStock {
  const materialId = raw?.materialId ?? raw?.mId ?? raw?.mid ?? raw?.itemId ?? ''
  const materialCode = raw?.materialCode ?? raw?.mCode ?? raw?.mcode ?? raw?.itemCode ?? ''

  return {
    id: Number(raw?.id ?? 0),
    materialId: String(materialId),
    materialCode: String(materialCode),
    materialName: String(
      raw?.materialName ?? raw?.mName ?? raw?.mname ?? raw?.itemName ?? raw?.name ?? '',
    ),
    totalQuantity: Number(raw?.totalQuantity ?? raw?.quantity ?? raw?.totalQty ?? 0),
    unit: String(raw?.unit ?? ''),
    unitName: String(raw?.unitName ?? raw?.unit_label ?? raw?.unit ?? ''),
    lastPurchaseDate: String(raw?.lastPurchaseDate ?? raw?.productionDate ?? ''),
    createTime: String(raw?.createTime ?? ''),
    updateTime: String(raw?.updateTime ?? ''),
  }
}

/**
 * 查询库存（可按物料ID过滤）
 */
export function getMaterialStockList(params?: {
  pageNum?: number
  pageSize?: number
  mId?: number
  searchKey?: string
}) {
  return request.get<ApiResponse<any>>('/material-stocks', { params }).then((res) => {
    const rawData = res.data

    if (Array.isArray(rawData)) {
      return {
        ...res,
        data: {
          total: rawData.length,
          records: rawData.map(normalizeMaterialStock),
          pageNum: params?.pageNum,
          pageSize: params?.pageSize,
        } as PageResult<MaterialStock>,
      }
    }

    return {
      ...res,
      data: {
        ...rawData,
        total: Number(rawData?.total ?? 0),
        records: (rawData?.records || []).map(normalizeMaterialStock),
      } as PageResult<MaterialStock>,
    }
  })
}
