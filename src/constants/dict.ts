/** 字典编码常量 —— 业务页面引用入口 */
export const DICT_TYPE = {
  PROCESS_TYPE: 'process_type',
  ORDER_STATUS: 'order_status',
  DEVICE_STATUS: 'device_status',
  MATERIAL_TYPE: 'material_type',
  UNIT_CATEGORY: 'unit_category',
  UNIT_TYPE: 'unit_type',
  SUPPLIER_TYPE: 'supplier_type',
} as const

/** 字典类型编码的联合类型 */
export type DictTypeCode = (typeof DICT_TYPE)[keyof typeof DICT_TYPE]
