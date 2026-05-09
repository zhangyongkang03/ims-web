import { getAuthInfo, type AuthInfo, type AuthMenu } from '@/api/auth'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(localStorage.getItem('token') || '')
  const userInfo = ref<AuthInfo | null>(null)
  const roles = ref<string[]>([])
  const permissions = ref<string[]>([])
  const permissionSet = ref<Set<string>>(new Set())
  const menus = ref<AuthMenu[]>([])
  const authInfoLoaded = ref(false)

  // 设置token
  function setToken(newToken: string) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  // 设置用户信息
  function setUserInfo(info: AuthInfo) {
    const normalizedRoles = Array.from(
      new Set((Array.isArray(info.roles) ? info.roles : []).filter((v) => typeof v === 'string')),
    )
    const normalizedPermissions = Array.from(
      new Set(
        (Array.isArray(info.permissions) ? info.permissions : [])
          .filter((v) => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean),
      ),
    )
    userInfo.value = {
      ...info,
      roles: normalizedRoles,
      permissions: normalizedPermissions,
      menus: Array.isArray(info.menus) ? info.menus : [],
    }
    roles.value = normalizedRoles
    permissions.value = normalizedPermissions
    permissionSet.value = new Set(normalizedPermissions.map((p) => p.toLowerCase()))
    menus.value = Array.isArray(info.menus) ? info.menus : []
    authInfoLoaded.value = true
  }

  async function loadAuthInfo(force = false) {
    if (!token.value) return
    if (authInfoLoaded.value && !force) return

    const res = await getAuthInfo()
    setUserInfo(res.data)
  }

  function hasPermission(permission: string) {
    if (!permission) return true
    const normalized = permission.trim().toLowerCase()
    if (permissionSet.value.has('*') || permissionSet.value.has('*:*:*')) {
      return true
    }
    return permissionSet.value.has(normalized)
  }

  // 清除用户信息
  function clearUserInfo() {
    token.value = ''
    userInfo.value = null
    roles.value = []
    permissions.value = []
    permissionSet.value.clear()
    menus.value = []
    authInfoLoaded.value = false
    localStorage.removeItem('token')
  }

  return {
    token,
    userInfo,
    roles,
    permissions,
    menus,
    authInfoLoaded,
    setToken,
    setUserInfo,
    loadAuthInfo,
    hasPermission,
    clearUserInfo,
  }
})
