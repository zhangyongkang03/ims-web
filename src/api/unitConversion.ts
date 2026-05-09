import type { ApiResponse } from './request'
import request from './request'

export interface CompatibleUnitOption {
  unit: string
  label: string
}

const isCanonicalUnitCode = (value: string) => /^[A-Za-z]+$/.test(value)

function normalizeCompatibleUnit(raw: any): CompatibleUnitOption {
  if (typeof raw === 'string') {
    return {
      unit: raw,
      label: raw,
    }
  }

  const unit = String(raw?.unit ?? raw?.dictValue ?? raw?.value ?? '')
  return {
    unit,
    label: String(raw?.name ?? raw?.label ?? raw?.unitName ?? raw?.dictLabel ?? unit),
  }
}

export function getCompatibleUnits(unit: string) {
  return request
    .get<ApiResponse<any[]>>('/unit-conversion/compatible', { params: { unit } })
    .then((res) => ({
      ...res,
      data: (res.data || [])
        .map(normalizeCompatibleUnit)
        .filter((item) => item.unit)
        .reduce<CompatibleUnitOption[]>((list, item) => {
          const existingIndex = list.findIndex((current) => current.label === item.label)
          if (existingIndex === -1) {
            list.push(item)
            return list
          }

          const existing = list[existingIndex]
          if (!existing) {
            list.push(item)
            return list
          }

          if (!isCanonicalUnitCode(existing.unit) && isCanonicalUnitCode(item.unit)) {
            list[existingIndex] = item
          }

          return list
        }, []),
    }))
}
