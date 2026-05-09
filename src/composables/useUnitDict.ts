import { getDictDataList, type DictData } from '@/api/dict'
import { DICT_TYPE } from '@/constants/dict'
import { ref } from 'vue'

export function useUnitDict() {
  const unitOptions = ref<DictData[]>([])
  const unitLabelMap = ref<Record<string, string>>({})

  const loadUnitsByCategory = async (categoryDictType?: string) => {
    unitOptions.value = []
    if (!categoryDictType) return

    try {
      const res = await getDictDataList(categoryDictType)
      unitOptions.value = (res.data || []) as DictData[]
    } catch (error) {
      console.error(`加载单位字典 [${categoryDictType}] 失败:`, error)
    }
  }

  const loadUnitLabelMap = async (categories?: DictData[]) => {
    try {
      let categoryValues = (categories || [])
        .map((item) => item.dictValue)
        .filter((item): item is string => Boolean(item))

      if (categoryValues.length === 0) {
        const categoryRes = await getDictDataList(DICT_TYPE.UNIT_CATEGORY)
        categoryValues = ((categoryRes.data || []) as DictData[])
          .map((item) => item.dictValue)
          .filter((item): item is string => Boolean(item))
      }

      const uniqueCategoryValues = Array.from(new Set(categoryValues))
      const unitListByCategory = await Promise.all(
        uniqueCategoryValues.map((dictType) =>
          getDictDataList(dictType)
            .then((res) => (res.data || []) as DictData[])
            .catch((error) => {
              console.error(`加载单位字典 [${dictType}] 失败:`, error)
              return []
            }),
        ),
      )

      const map: Record<string, string> = {}
      unitListByCategory.flat().forEach((item) => {
        if (!item.dictValue) return
        map[item.dictValue] = item.dictLabel || item.dictValue
      })
      unitLabelMap.value = map
    } catch (error) {
      console.error('加载单位显示映射失败:', error)
    }
  }

  const getUnitLabel = (value: string | number | undefined | null): string => {
    if (value === undefined || value === null) return ''
    const normalized = String(value)
    return unitLabelMap.value[normalized] || normalized
  }

  return {
    unitOptions,
    unitLabelMap,
    loadUnitsByCategory,
    loadUnitLabelMap,
    getUnitLabel,
  }
}
