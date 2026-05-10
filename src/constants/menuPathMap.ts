export const backendToFrontendPathMap: Record<string, string> = {
  '/dashboard': '/dashboard',
  '/work-order/list': '/order/order',
  '/work-order/recipe': '/base/recipe',
  '/work-order/craft': '/craft/craft',
  '/material/list': '/material/material',
  '/material/supplier': '/material/supplier',
  '/material/customer': '/material/customer',
  '/material/product': '/material/product',
  '/stock/material': '/material/stock',
  '/stock/product': '/stock/product',
  '/basic/alarm': '/base/alarm',
  '/basic/warehouse': '/base/wms',
  '/ai/chat': '/ai/chat',
  '/ai/monitor': '/ai/dashboard',
  '/ai/decision-log': '/ai/decisions',
  '/ai/knowledge': '/ai/knowledge',
  '/ai/rules': '/ai/rules',
  '/ai/quality': '/ai/batch-quality',
  '/ai/trace': '/ai/traceability',
  '/ai/daily-report': '/ai/device-report',
  '/equipment/list': '/equipment/equipment',
  '/equipment/station': '/equipment/station',
  '/equipment/sensor': '/equipment/device',
  '/equipment/repair': '/equipment/repair-order',
  '/system/user': '/system/user',
  '/system/role': '/system/role',
  '/system/menu': '/system/menu',
  '/system/dict': '/system/dict-type',
}

export const normalizeMenuPath = (path?: string | null) => {
  if (!path || typeof path !== 'string') return ''
  return backendToFrontendPathMap[path] || path
}
