import type { ApiResponse } from './request'
import request from './request'

// 用户信息
export interface User {
  id: number
  username: string
  nickname: string
  employeeNo: string
  status: boolean
  createTime: string
  updateTime: string
  roles?: Role[]
  permissions?: string[]
}

// 角色信息
export interface Role {
  roleId: number
  roleName: string
  roleKey: string
}

// 分页响应
export interface PageResult<T> {
  total: number
  records: T[]
}

function normalizeUser(raw: any): User {
  return {
    id: Number(raw?.id ?? 0),
    username: String(raw?.username ?? ''),
    nickname: String(raw?.nickname ?? ''),
    employeeNo: String(raw?.employeeNo ?? ''),
    status: Boolean(raw?.status),
    createTime: String(raw?.createTime ?? ''),
    updateTime: String(raw?.updateTime ?? ''),
    roles: Array.isArray(raw?.roles)
      ? raw.roles.map((role: any) => ({
          roleId: Number(role?.roleId ?? 0),
          roleName: String(role?.roleName ?? ''),
          roleKey: String(role?.roleKey ?? ''),
        }))
      : [],
    permissions: Array.isArray(raw?.permissions)
      ? raw.permissions.map((permission: any) => String(permission))
      : [],
  }
}

// 用户表单
export interface UserForm {
  id?: number
  username: string
  password?: string
  nickname: string
  employeeNo: string
  status: boolean
  roleIds: number[]
}

/**
 * 分页查询用户列表
 */
export function getUserList(params: {
  pageNum?: number
  pageSize?: number
  searchKey?: string
  searchStatus?: boolean
}) {
  return request<ApiResponse<PageResult<User>>>({
    url: '/users',
    method: 'get',
    params,
  }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      total: Number(res.data?.total ?? 0),
      records: Array.isArray(res.data?.records) ? res.data.records.map(normalizeUser) : [],
    },
  }))
}

/**
 * 获取用户详情
 */
export function getUserDetail(userId: number) {
  return request<ApiResponse<User>>({
    url: `/users/${userId}`,
    method: 'get',
  }).then((res) => ({
    ...res,
    data: normalizeUser(res.data),
  }))
}

/**
 * 新增用户
 */
export function addUser(data: UserForm) {
  return request<ApiResponse<null>>({
    url: '/users',
    method: 'post',
    data,
  })
}

/**
 * 修改用户
 */
export function updateUser(userId: number, data: UserForm) {
  return request<ApiResponse<null>>({
    url: `/users/${userId}`,
    method: 'put',
    data,
  })
}

/**
 * 删除用户
 */
export function deleteUser(userId: number) {
  return request<ApiResponse<null>>({
    url: `/users/${userId}`,
    method: 'delete',
  })
}
