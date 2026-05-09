import type { ApiResponse } from './request'
import request from './request'

// 登录请求参数
export interface LoginParams {
  username: string
  password: string
}

export type AuthMenuType = 'M' | 'C' | 'F'

export interface AuthMenu {
  id: string | number
  parentId?: string | number
  menuName: string
  path: string
  component?: string | null
  perms?: string | null
  menuType: AuthMenuType
  children?: AuthMenu[] | null
}

export interface AuthInfo {
  userId: string | number
  username: string
  roles: string[]
  permissions: string[]
  menus: AuthMenu[]
}

/**
 * 用户登录
 */
export function login(data: LoginParams) {
  return request<ApiResponse<string>>({
    url: '/auth/login',
    method: 'post',
    data,
  })
}

/**
 * 获取当前登录用户信息（角色/权限/菜单）
 */
export function getAuthInfo() {
  return request<ApiResponse<AuthInfo>>({
    url: '/auth/info',
    method: 'get',
  })
}
