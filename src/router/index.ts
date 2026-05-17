import type { AuthMenu } from '@/api/auth'
import { normalizeMenuPath } from '@/constants/menuPathMap'
import { useUserStore } from '@/stores/user'
import Layout from '@/views/Layout.vue'
import { createRouter, createWebHistory } from 'vue-router'

const hasValidToken = () => {
  const token = localStorage.getItem('token')?.trim()
  return Boolean(token && token !== 'null' && token !== 'undefined')
}

const dynamicRouteNamePrefix = 'DynamicMenuAlias__'
let lastDynamicMenuSignature = ''

const normalizeRouteName = (path: string) =>
  `${dynamicRouteNamePrefix}${path.replace(/[^a-zA-Z0-9]/g, '_')}`

const buildMenuSignature = (menus: AuthMenu[]) => {
  const paths: string[] = []
  const visit = (items: AuthMenu[] = []) => {
    items.forEach((item) => {
      if (!item || typeof item.path !== 'string') return
      paths.push(item.path.trim())
      if (Array.isArray(item.children) && item.children.length > 0) {
        visit(item.children)
      }
    })
  }
  visit(menus)
  return paths.sort().join('|')
}

const registerDynamicMenuRoutes = (menus: AuthMenu[]) => {
  const signature = buildMenuSignature(menus)
  if (signature && signature === lastDynamicMenuSignature) {
    return
  }

  const visit = (items: AuthMenu[] = []) => {
    items.forEach((item) => {
      if (!item || typeof item.path !== 'string') return

      const backendPath = item.path.trim()
      if (!backendPath.startsWith('/')) return

      const frontendPath = normalizeMenuPath(backendPath)
      if (frontendPath && frontendPath !== backendPath) {
        const routeName = normalizeRouteName(backendPath)
        if (!router.hasRoute(routeName)) {
          router.addRoute({
            path: backendPath,
            name: routeName,
            redirect: frontendPath,
          })
        }
      }

      if (Array.isArray(item.children) && item.children.length > 0) {
        visit(item.children)
      }
    })
  }

  visit(menus)
  lastDynamicMenuSignature = signature
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/Login.vue'),
    },
    {
      path: '/ai/settings',
      redirect: '/dashboard',
    },
    {
      path: '/',
      component: Layout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/AiDashboard.vue'),
        },
        {
          path: 'system/user',
          name: 'UserManagement',
          component: () => import('@/views/UserManagement.vue'),
        },
        {
          path: 'system/role',
          name: 'RoleManagement',
          component: () => import('@/views/RoleManagement.vue'),
        },
        {
          path: 'system/menu',
          name: 'MenuManagement',
          component: () => import('@/views/MenuManagement.vue'),
        },
        {
          path: 'material',
          component: () => import('@/views/MaterialManagement.vue'),
        },
        {
          path: 'material-management',
          redirect: '/material',
        },
        {
          path: 'material/supplier',
          component: () => import('@/views/SupplierManagement.vue'),
        },
        {
          path: 'material-management/supplier',
          redirect: '/material/supplier',
        },
        {
          path: 'material/customer',
          component: () => import('@/views/CustomerManagement.vue'),
        },
        {
          path: 'material-management/customer',
          redirect: '/material/customer',
        },
        {
          path: 'material/product',
          component: () => import('@/views/ProductManagement.vue'),
        },
        {
          path: 'material-management/product',
          redirect: '/material/product',
        },
        {
          path: 'stock/material',
          component: () => import('@/views/MaterialStockManagement.vue'),
        },
        {
          path: 'inventory-management/material-stock',
          redirect: '/stock/material',
        },
        {
          path: 'material/stock',
          redirect: '/stock/material',
        },
        {
          path: 'stock/product',
          component: () => import('@/views/ProductStockManagement.vue'),
        },
        {
          path: 'inventory-management/product-stock',
          redirect: '/stock/product',
        },
        {
          path: 'stock/warehouse-location',
          component: () => import('@/views/WmsManagement.vue'),
        },
        {
          path: 'base/wms',
          redirect: '/stock/warehouse-location',
        },
        {
          path: 'inventory-management/warehouse-location',
          redirect: '/stock/warehouse-location',
        },
        {
          path: 'stock/warehouse-location/:whId/locations',
          component: () => import('@/views/WarehouseLocationManagement.vue'),
        },
        {
          path: 'base/wms/:whId/locations',
          redirect: (to) => ({ path: `/stock/warehouse-location/${to.params.whId}/locations` }),
        },
        {
          path: 'inventory-management/warehouse-location/:whId/locations',
          redirect: (to) => ({ path: `/stock/warehouse-location/${to.params.whId}/locations` }),
        },
        {
          path: 'work-order-management/list',
          redirect: '/order/order',
        },
        {
          path: 'work-order-management/craft',
          redirect: '/order/craft',
        },
        {
          path: 'work-order-management/recipe',
          redirect: '/order/recipe',
        },
        {
          path: 'equipment/station',
          component: () => import('@/views/StationManagement.vue'),
        },
        {
          path: 'equipment-management/station',
          redirect: '/equipment/station',
        },
        {
          path: 'equipment/list',
          component: () => import('@/views/EquipmentManagement.vue'),
        },
        {
          path: 'equipment-management/list',
          redirect: '/equipment/list',
        },
        {
          path: 'equipment/sensor/:stationId?',
          component: () => import('@/views/DeviceManagement.vue'),
        },
        {
          path: 'equipment-management/sensor/:stationId?',
          redirect: (to) => ({
            path: `/equipment/sensor/${to.params.stationId ?? ''}`.replace(/\/$/, ''),
          }),
        },
        {
          path: 'equipment/repair-order',
          component: () => import('@/views/RepairOrderManagement.vue'),
        },
        {
          path: 'equipment-management/repair-order',
          redirect: '/equipment/repair-order',
        },
        {
          path: 'ai/chat',
          name: 'AiChat',
          component: () => import('@/views/AiChat.vue'),
        },
        {
          path: 'ai/assistant/chat',
          redirect: '/ai/chat',
        },
        // 物料模块
        {
          path: 'material/material',
          name: 'MaterialManagement',
          component: () => import('@/views/MaterialManagement.vue'),
        },
        {
          path: 'material/supplier',
          name: 'SupplierManagement',
          component: () => import('@/views/SupplierManagement.vue'),
        },
        {
          path: 'material/customer',
          name: 'CustomerManagement',
          component: () => import('@/views/CustomerManagement.vue'),
        },
        {
          path: 'material/lot',
          name: 'MaterialLotManagement',
          component: () => import('@/views/MaterialLotManagement.vue'),
        },
        {
          path: 'material/lot/register',
          name: 'MaterialLotRegister',
          component: () => import('@/views/MaterialLotRegister.vue'),
        },
        {
          path: 'material/product',
          name: 'ProductManagement',
          component: () => import('@/views/ProductManagement.vue'),
        },
        {
          path: 'material/stock/distribution/:itemId',
          name: 'MaterialStockDistribution',
          component: () => import('@/views/MaterialStockDistribution.vue'),
        },
        {
          path: 'stock/product/distribution/:itemId',
          name: 'ProductStockDistribution',
          component: () => import('@/views/ProductStockDistribution.vue'),
        },
        {
          path: 'material/stock',
          name: 'MaterialStockManagementLegacy',
          redirect: '/stock/material',
        },
        {
          path: 'base/wms/:whId/locations',
          name: 'WarehouseLocationManagementLegacy',
          redirect: (to) => ({ path: `/stock/warehouse-location/${to.params.whId}/locations` }),
        },
        // 基础模块
        {
          path: 'base/recipe',
          redirect: '/order/recipe',
        },
        {
          path: 'base/recipe/:recipeId/detail',
          redirect: (to) => ({ path: `/order/recipe/${to.params.recipeId}/detail` }),
        },
        {
          path: 'base/alarm',
          redirect: '/log/alarm',
        },
        {
          path: 'log/alarm',
          name: 'AlarmManagement',
          component: () => import('@/views/AlarmManagement.vue'),
        },
        {
          path: 'ai/decisions',
          redirect: '/log/decisions',
        },
        {
          path: 'log/decisions',
          name: 'AiDecisions',
          component: () => import('@/views/AiDecisions.vue'),
        },
        {
          path: 'ai/knowledge',
          redirect: '/basic/knowledge',
        },
        {
          path: 'basic/knowledge',
          name: 'AiKnowledge',
          component: () => import('@/views/AiKnowledge.vue'),
        },
        {
          path: 'ai/rules',
          redirect: '/basic/rules',
        },
        {
          path: 'basic/rules',
          name: 'AiRules',
          component: () => import('@/views/AiRules.vue'),
        },
        {
          path: 'ai/batch-quality',
          name: 'BatchQualityReport',
          component: () => import('@/views/BatchQualityReport.vue'),
        },
        {
          path: 'ai/assistant/batch-quality',
          redirect: '/ai/batch-quality',
        },
        {
          path: 'ai/production-report',
          name: 'AiProductionReport',
          component: () => import('@/views/AiProductionReport.vue'),
        },
        {
          path: 'ai/assistant/production-report',
          redirect: '/ai/production-report',
        },
        {
          path: 'ai/device-report',
          name: 'AiDeviceReport',
          component: () => import('@/views/AiDeviceReport.vue'),
        },
        {
          path: 'ai/assistant/device-report',
          redirect: '/ai/device-report',
        },
        {
          path: 'ai/failure-prediction',
          name: 'AiFailurePrediction',
          component: () => import('@/views/AiFailurePrediction.vue'),
        },
        {
          path: 'ai/traceability',
          name: 'AiTraceability',
          component: () => import('@/views/AiTraceability.vue'),
        },
        {
          path: 'ai/assistant/traceability',
          redirect: '/ai/traceability',
        },
        {
          path: 'base/wms',
          name: 'WmsManagement',
          component: () => import('@/views/WmsManagement.vue'),
        },
        {
          path: 'base/wms/:whId/locations',
          name: 'WarehouseLocationManagement',
          component: () => import('@/views/WarehouseLocationManagement.vue'),
        },
        // 工艺模块
        {
          path: 'craft/craft',
          redirect: '/order/craft',
        },
        {
          path: 'craft/craft/:craftId/detail',
          redirect: (to) => ({ path: `/order/craft/${to.params.craftId}/detail` }),
        },
        // 工单模块
        {
          path: 'order/order',
          name: 'OrderManagement',
          component: () => import('@/views/WorkOrderManagement.vue'),
        },
        {
          path: 'order/craft',
          name: 'CraftManagement',
          component: () => import('@/views/CraftManagement.vue'),
        },
        {
          path: 'order/craft/:craftId/detail',
          name: 'CraftDetailManagement',
          component: () => import('@/views/CraftDetailManagement.vue'),
        },
        {
          path: 'order/recipe',
          name: 'RecipeManagement',
          component: () => import('@/views/RecipeManagement.vue'),
        },
        {
          path: 'order/recipe/:recipeId/detail',
          name: 'RecipeDetailManagement',
          component: () => import('@/views/RecipeDetailManagement.vue'),
        },
        {
          path: 'order/work-order',
          name: 'WorkOrderManagement',
          component: () => import('@/views/WorkOrderManagement.vue'),
        },
        {
          path: 'order/work-order/:woId',
          name: 'WorkOrderDetail',
          component: () => import('@/views/WorkOrderDetail.vue'),
        },
        // 字典模块
        {
          path: 'system/dict',
          name: 'DictTypeManagement',
          component: () => import('@/views/DictTypeManagement.vue'),
        },
        {
          path: 'system/dict/:dictType/data',
          name: 'DictDataManagement',
          component: () => import('@/views/DictDataManagement.vue'),
        },
        // 设备模块
        {
          path: 'equipment/equipment',
          name: 'EquipmentManagementLegacy',
          redirect: '/equipment/list',
        },
        {
          path: 'equipment/device/:stationId?',
          name: 'DeviceManagementLegacy',
          redirect: (to) => ({
            path: `/equipment/sensor/${to.params.stationId ?? ''}`.replace(/\/$/, ''),
          }),
        },
      ],
    },
  ],
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const authenticated = hasValidToken()
  const userStore = useUserStore()

  // 如果没有token且访问的不是登录页，跳转到登录页
  if (!authenticated && to.path !== '/login') {
    localStorage.removeItem('token')
    userStore.clearUserInfo()
    next('/login')
    return
  }

  if (authenticated && !userStore.authInfoLoaded) {
    try {
      await userStore.loadAuthInfo()
      registerDynamicMenuRoutes(userStore.menus)
    } catch (error) {
      console.error('加载登录信息失败:', error)
      userStore.clearUserInfo()
      if (to.path !== '/login') {
        next('/login')
        return
      }
      next()
      return
    }
  }

  if (authenticated && userStore.authInfoLoaded) {
    registerDynamicMenuRoutes(userStore.menus)
  }

  // 如果有token且访问的是登录页，跳转到首页
  if (authenticated && to.path === '/login') {
    next('/dashboard')
    return
  }

  next()
})

export default router
