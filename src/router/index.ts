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
      redirect: '/ai/dashboard',
    },
    {
      path: '/',
      component: Layout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/Dashboard.vue'),
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
          path: 'material/stock',
          name: 'MaterialStockManagement',
          component: () => import('@/views/MaterialStockManagement.vue'),
        },
        {
          path: 'material/stock/distribution/:itemId',
          name: 'MaterialStockDistribution',
          component: () => import('@/views/MaterialStockDistribution.vue'),
        },
        {
          path: 'stock/product',
          name: 'ProductStockManagement',
          component: () => import('@/views/ProductStockManagement.vue'),
        },
        {
          path: 'stock/product/distribution/:itemId',
          name: 'ProductStockDistribution',
          component: () => import('@/views/ProductStockDistribution.vue'),
        },
        // 基础模块
        {
          path: 'base/recipe',
          name: 'RecipeManagement',
          component: () => import('@/views/RecipeManagement.vue'),
        },
        {
          path: 'base/recipe/:recipeId/detail',
          name: 'RecipeDetailManagement',
          component: () => import('@/views/RecipeDetailManagement.vue'),
        },
        {
          path: 'base/alarm',
          name: 'AlarmManagement',
          component: () => import('@/views/AlarmManagement.vue'),
        },
        // AI辅助决策模块
        {
          path: 'ai/dashboard',
          name: 'AiDashboard',
          component: () => import('@/views/AiDashboard.vue'),
        },
        {
          path: 'ai/chat',
          name: 'AiChat',
          component: () => import('@/views/AiChat.vue'),
        },
        {
          path: 'ai/decisions',
          name: 'AiDecisions',
          component: () => import('@/views/AiDecisions.vue'),
        },
        {
          path: 'ai/knowledge',
          name: 'AiKnowledge',
          component: () => import('@/views/AiKnowledge.vue'),
        },
        {
          path: 'ai/rules',
          name: 'AiRules',
          component: () => import('@/views/AiRules.vue'),
        },
        {
          path: 'ai/batch-quality',
          name: 'BatchQualityReport',
          component: () => import('@/views/BatchQualityReport.vue'),
        },
        {
          path: 'ai/production-report',
          name: 'AiProductionReport',
          component: () => import('@/views/AiProductionReport.vue'),
        },
        {
          path: 'ai/device-report',
          name: 'AiDeviceReport',
          component: () => import('@/views/AiDeviceReport.vue'),
        },
        {
          path: 'ai/traceability',
          name: 'AiTraceability',
          component: () => import('@/views/AiTraceability.vue'),
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
          name: 'CraftManagement',
          component: () => import('@/views/CraftManagement.vue'),
        },
        {
          path: 'craft/craft/:craftId/detail',
          name: 'CraftDetailManagement',
          component: () => import('@/views/CraftDetailManagement.vue'),
        },
        // 工单模块
        {
          path: 'order/order',
          name: 'OrderManagement',
          component: () => import('@/views/WorkOrderManagement.vue'),
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
          path: 'system/dict-type',
          name: 'DictTypeManagement',
          component: () => import('@/views/DictTypeManagement.vue'),
        },
        {
          path: 'system/dict-type/:dictType/data',
          name: 'DictDataManagement',
          component: () => import('@/views/DictDataManagement.vue'),
        },
        // 设备模块
        {
          path: 'equipment/station',
          name: 'StationManagement',
          component: () => import('@/views/StationManagement.vue'),
        },
        {
          path: 'equipment/equipment',
          name: 'EquipmentManagement',
          component: () => import('@/views/EquipmentManagement.vue'),
        },
        {
          path: 'equipment/device/:stationId?',
          name: 'DeviceManagement',
          component: () => import('@/views/DeviceManagement.vue'),
        },
        {
          path: 'equipment/repair-order',
          name: 'RepairOrderManagement',
          component: () => import('@/views/RepairOrderManagement.vue'),
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
