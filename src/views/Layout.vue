<template>
  <div class="layout-container">
    <el-container class="layout-shell">
      <!-- 侧边栏 -->
      <el-aside width="200px" class="aside-menu">
        <div class="logo">
          <h2>IMS系统</h2>
        </div>
        <el-menu
          :default-active="activeMenu"
          router
          background-color="#304156"
          text-color="#bfcbd9"
          active-text-color="#409EFF"
        >
          <template v-for="menu in sidebarMenus" :key="String(menu.id)">
            <el-sub-menu v-if="isGroupMenu(menu)" :index="menu.path">
              <template #title>
                <el-icon><Menu /></el-icon>
                <span>{{ menu.menuName }}</span>
              </template>
              <template v-for="child in getVisibleChildren(menu)" :key="String(child.id)">
                <el-sub-menu v-if="isGroupMenu(child)" :index="child.path">
                  <template #title>
                    <span>{{ child.menuName }}</span>
                  </template>
                  <el-menu-item
                    v-for="grandChild in getVisibleChildren(child)"
                    :key="String(grandChild.id)"
                    :index="toFrontendPath(grandChild.path)"
                  >
                    <span>{{ grandChild.menuName }}</span>
                  </el-menu-item>
                </el-sub-menu>
                <el-menu-item v-else :index="toFrontendPath(child.path)">
                  <span>{{ child.menuName }}</span>
                </el-menu-item>
              </template>
            </el-sub-menu>
            <el-menu-item v-else :index="resolveMenuPath(menu)">
              <el-icon><Monitor /></el-icon>
              <span>{{ menu.menuName }}</span>
            </el-menu-item>
          </template>
        </el-menu>
      </el-aside>

      <!-- 主体内容 -->
      <el-container class="content-shell">
        <!-- 顶部导航 -->
        <el-header class="header">
          <div class="header-content">
            <div class="breadcrumb">
              <el-breadcrumb separator="/">
                <el-breadcrumb-item :to="{ path: '/dashboard' }">首页</el-breadcrumb-item>
                <el-breadcrumb-item v-if="currentRoute">{{ currentRoute }}</el-breadcrumb-item>
              </el-breadcrumb>
            </div>
            <div class="user-info">
              <el-dropdown @command="handleCommand">
                <span class="user-name">
                  <el-icon><Avatar /></el-icon>
                  {{ userStore.userInfo?.username || '管理员' }}
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="logout">退出登录</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </el-header>

        <!-- 主内容区 -->
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import type { AuthMenu } from '@/api/auth'
import { normalizeMenuPath } from '@/constants/menuPathMap'
import { useUserStore } from '@/stores/user'
import { ArrowDown, Avatar, Menu, Monitor } from '@element-plus/icons-vue'
import { ElMessageBox } from 'element-plus'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const BASIC_MENU_PATH = '/basic'
const STOCK_MENU_PATH = '/stock'
const AI_MENU_PATH = '/ai'
const SHIFT_MENU_PATH = '/basic/shift'
const WAREHOUSE_MENU_PATH = '/basic/warehouse'
const ALARM_MENU_PATH = '/basic/alarm'
const BASIC_MANAGEMENT_MENU_PATH = '/management/basic'
const LOG_MANAGEMENT_MENU_PATH = '/management/log'
const AI_PRODUCTION_REPORT_PATH = '/ai/production-report'
const AI_KNOWLEDGE_PATH = '/ai/knowledge'
const AI_RULES_PATH = '/ai/rules'
const AI_DECISION_LOG_MENU_PATH = '/ai/decision-log'
const AI_DECISIONS_PATH = '/ai/decisions'
const HIDDEN_MENU_PATHS = new Set(['/ai/quality'])

const toFrontendPath = (path: string) => normalizeMenuPath(path)

const hasMenuPermission = (menu: AuthMenu) => {
  if (!menu.perms) {
    return true
  }
  return userStore.hasPermission(menu.perms)
}

const reorderEquipmentChildren = (menu: AuthMenu, children: AuthMenu[]) => {
  if (menu.path !== '/equipment' || children.length < 2) {
    return children
  }

  const orderWeight: Record<string, number> = {
    '/equipment/station': 0,
    '/equipment/equipment': 1,
  }

  return [...children].sort((left, right) => {
    const leftWeight = orderWeight[left.path] ?? Number.MAX_SAFE_INTEGER
    const rightWeight = orderWeight[right.path] ?? Number.MAX_SAFE_INTEGER
    return leftWeight - rightWeight
  })
}

const reorderVirtualGroupChildren = (menuName: string, children: AuthMenu[]) => {
  if (children.length < 2) {
    return children
  }

  const orderWeightByGroup: Record<string, Record<string, number>> = {
    基础管理: {
      [AI_KNOWLEDGE_PATH]: 0,
      [AI_RULES_PATH]: 1,
    },
    日志管理: {
      [ALARM_MENU_PATH]: 0,
      [AI_DECISION_LOG_MENU_PATH]: 1,
      [AI_DECISIONS_PATH]: 1,
    },
  }

  const orderWeight = orderWeightByGroup[menuName]
  if (!orderWeight) {
    return children
  }

  return [...children].sort((left, right) => {
    const leftWeight = orderWeight[left.path] ?? Number.MAX_SAFE_INTEGER
    const rightWeight = orderWeight[right.path] ?? Number.MAX_SAFE_INTEGER
    return leftWeight - rightWeight
  })
}

const cloneMenuTree = (menus: AuthMenu[]): AuthMenu[] => {
  return menus.map((menu) => ({
    ...menu,
    children: Array.isArray(menu.children) ? cloneMenuTree(menu.children) : [],
  }))
}

const appendChildIfMissing = (menu: AuthMenu | undefined, child: AuthMenu | undefined) => {
  if (!menu || !child) return
  const children = Array.isArray(menu.children) ? menu.children : []
  if (children.some((item) => item.path === child.path)) return
  menu.children = [...children, child]
}

const createVirtualTopMenu = (
  id: string,
  menuName: string,
  path: string,
  children: AuthMenu[],
) => ({
  id,
  parentId: '0',
  menuName,
  path,
  menuType: 'M' as const,
  children: reorderVirtualGroupChildren(menuName, children),
})

const createVirtualChildMenu = (
  id: string,
  parentId: string,
  menuName: string,
  path: string,
): AuthMenu => ({
  id,
  parentId,
  menuName,
  path,
  menuType: 'C',
  children: [],
})

const regroupTopLevelMenus = (menus: AuthMenu[]) => {
  const clonedMenus = cloneMenuTree(menus)
  const basicMenu = clonedMenus.find((menu) => menu.path === BASIC_MENU_PATH)
  if (!basicMenu || !Array.isArray(basicMenu.children)) {
    return clonedMenus
  }

  const stockMenu = clonedMenus.find((menu) => menu.path === STOCK_MENU_PATH)
  const aiMenu = clonedMenus.find((menu) => menu.path === AI_MENU_PATH)
  const warehouseMenu = basicMenu.children.find((menu) => menu.path === WAREHOUSE_MENU_PATH)
  const alarmMenu = basicMenu.children.find((menu) => menu.path === ALARM_MENU_PATH)

  appendChildIfMissing(stockMenu, warehouseMenu)
  appendChildIfMissing(aiMenu, alarmMenu)
  appendChildIfMissing(
    aiMenu,
    createVirtualChildMenu(
      'virtual-ai-production-report',
      AI_MENU_PATH,
      '产品生产报告',
      AI_PRODUCTION_REPORT_PATH,
    ),
  )

  const aiChildren = Array.isArray(aiMenu?.children) ? aiMenu.children : []
  const basicManagementChildren = aiChildren.filter(
    (menu) => menu.path === AI_KNOWLEDGE_PATH || menu.path === AI_RULES_PATH,
  )
  const logManagementChildren = aiChildren.filter(
    (menu) =>
      menu.path === AI_DECISION_LOG_MENU_PATH ||
      menu.path === AI_DECISIONS_PATH ||
      menu.path === ALARM_MENU_PATH,
  )

  if (aiMenu) {
    aiMenu.children = aiChildren.filter(
      (menu) =>
        menu.path !== AI_KNOWLEDGE_PATH &&
        menu.path !== AI_RULES_PATH &&
        menu.path !== AI_DECISION_LOG_MENU_PATH &&
        menu.path !== AI_DECISIONS_PATH &&
        menu.path !== ALARM_MENU_PATH,
    )
  }

  basicMenu.children = basicMenu.children.filter((menu) => {
    if (menu.path === SHIFT_MENU_PATH) return false
    if (menu.path === WAREHOUSE_MENU_PATH && stockMenu) return false
    if (menu.path === ALARM_MENU_PATH && aiMenu) return false
    return true
  })

  const normalizedMenus = clonedMenus.filter((menu) => {
    if (menu.path !== BASIC_MENU_PATH) return true
    return Array.isArray(menu.children) && menu.children.length > 0
  })

  if (basicManagementChildren.length) {
    normalizedMenus.push(
      createVirtualTopMenu(
        'virtual-basic-management',
        '基础管理',
        BASIC_MANAGEMENT_MENU_PATH,
        basicManagementChildren,
      ),
    )
  }

  if (logManagementChildren.length) {
    normalizedMenus.push(
      createVirtualTopMenu(
        'virtual-log-management',
        '日志管理',
        LOG_MANAGEMENT_MENU_PATH,
        logManagementChildren,
      ),
    )
  }

  return normalizedMenus
}

const filterMenus = (menus: AuthMenu[]): AuthMenu[] => {
  return menus
    .filter((menu) => menu && menu.path)
    .filter((menu) => menu.path !== SHIFT_MENU_PATH)
    .filter((menu) => !HIDDEN_MENU_PATHS.has(menu.path))
    .map((menu) => {
      const children = Array.isArray(menu.children)
        ? reorderEquipmentChildren(menu, filterMenus(menu.children))
        : []
      return {
        ...menu,
        children,
      }
    })
    .filter((menu) => {
      if (!hasMenuPermission(menu)) return false
      if (menu.menuType === 'M') {
        return Array.isArray(menu.children) && menu.children.length > 0
      }
      return menu.menuType === 'C'
    })
}

const sidebarMenus = computed(() => {
  if (!userStore.authInfoLoaded) {
    return []
  }
  return filterMenus(regroupTopLevelMenus(userStore.menus))
})

const getVisibleChildren = (menu: AuthMenu) => (Array.isArray(menu.children) ? menu.children : [])

const isGroupMenu = (menu: AuthMenu) => menu.menuType === 'M' && getVisibleChildren(menu).length > 1

const resolveMenuPath = (menu: AuthMenu) => {
  if (menu.menuType === 'M') {
    const children = getVisibleChildren(menu)
    if (children.length === 1) {
      return toFrontendPath(children[0]?.path || menu.path)
    }
  }
  return toFrontendPath(menu.path)
}

const activeMenu = computed(() => {
  if (route.path.startsWith('/base/wms/')) {
    return '/base/wms'
  }
  if (route.path.startsWith('/material/stock/distribution/')) {
    return '/material/stock'
  }
  if (route.path.startsWith('/stock/product/distribution/')) {
    return '/stock/product'
  }
  if (route.path.startsWith('/equipment/device/')) {
    return '/equipment/device'
  }
  if (route.path.startsWith('/material/lot') || route.path.startsWith('/material/stock')) {
    return '/material/stock'
  }
  return route.path
})

const currentRoute = computed(() => {
  const routeMap: Record<string, string> = {
    '/dashboard': '控制台',
    '/system/user': '用户管理',
    '/system/role': '角色管理',
    '/system/menu': '菜单管理',
    '/system/dict-type': '字典管理',
    '/material/material': '物料信息',
    '/material/supplier': '供应商管理',
    '/material/customer': '客户管理',
    '/material/lot': '材料入库',
    '/material/lot/register': '材料登记',
    '/material/product': '产品管理',
    '/material/stock': '材料库存',
    '/stock/product': '产成品库存',
    '/base/recipe': '配方管理',
    '/base/alarm': '异常报警',
    '/base/wms': '仓库与库位管理',
    '/order/order': '工单管理',
    '/equipment/equipment': '生产设备管理',
    '/equipment/station': '工位管理',
    '/equipment/device': '传感器管理',
    '/equipment/repair-order': '维修工单管理',
    '/ai/chat': 'AI智能问答',
    '/ai/dashboard': 'AI实时监控大屏',
    '/ai/decisions': '决策日志',
    '/ai/knowledge': '知识库管理',
    '/ai/rules': '规则配置',
    '/ai/batch-quality': '批次质量报告',
    '/ai/production-report': '产品生产报告',
    '/ai/traceability': '全流程溯源',
    '/ai/device-report': '设备运行日报',
  }
  if (route.path.startsWith('/base/wms/')) {
    return '库位管理'
  }
  if (route.path.startsWith('/material/stock/distribution/')) {
    return '材料库存分布'
  }
  if (route.path.startsWith('/stock/product/distribution/')) {
    return '产成品库存分布'
  }
  if (route.path.startsWith('/equipment/device/')) {
    return '传感器管理'
  }

  return routeMap[route.path] || ''
})

const handleCommand = (command: string) => {
  if (command === 'logout') {
    ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(() => {
      userStore.clearUserInfo()
      router.push('/login')
    })
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
  overflow: hidden;
}

.layout-shell {
  height: 100%;
}

.aside-menu {
  background-color: #304156;
  height: 100%;
  overflow-y: auto;
}

.content-shell {
  height: 100%;
  min-width: 0;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #2b3a4a;
}

.logo h2 {
  color: #fff;
  font-size: 20px;
  margin: 0;
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  padding: 0 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-name {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.main-content {
  background-color: #f0f2f5;
  height: calc(100vh - 60px);
  overflow-y: auto;
}
</style>
