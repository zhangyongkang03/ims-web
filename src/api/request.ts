import type { AxiosInstance, AxiosRequestConfig } from 'axios'
import axios from 'axios'
import { ElMessage } from 'element-plus'

export interface ApiRequestConfig extends AxiosRequestConfig {
  skipErrorMessage?: boolean
  skipErrorLog?: boolean
}

// API响应数据结构
export interface ApiResponse<T = any> {
  code: number
  msg: string | null
  data: T
}

// 创建axios实例
const service: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

const messageThrottleMap = new Map<string, number>()
const showMessageWithThrottle = (key: string, message: string, duration = 1500) => {
  const now = Date.now()
  const last = messageThrottleMap.get(key) || 0
  if (now - last < duration) {
    return
  }
  messageThrottleMap.set(key, now)
  ElMessage.error(message)
}

const getValidToken = () => {
  const token = localStorage.getItem('token')?.trim()
  if (!token || token === 'null' || token === 'undefined') {
    return ''
  }
  return token
}

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    // 从localStorage获取token
    const token = getValidToken()
    if (token) {
      config.headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  },
)

// 响应拦截器
service.interceptors.response.use(
  (response: any) => {
    const res = response.data
    const config = (response.config || {}) as ApiRequestConfig

    // code为1表示成功
    if (res.code === 1) {
      return res
    } else {
      if (!config.skipErrorMessage) {
        ElMessage.error(res.msg || '请求失败')
      }
      return Promise.reject(new Error(res.msg || '请求失败'))
    }
  },
  (error) => {
    const config = (error.config || {}) as ApiRequestConfig

    if (!config.skipErrorLog) {
      console.error('响应错误:', error)
    }

    const status = error.response?.status
    const hasToken = Boolean(getValidToken())

    // 401 表示未登录或令牌失效，统一回登录页
    if (status === 401) {
      showMessageWithThrottle('401-expired', '登录已过期，请重新登录')
      localStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // 403：无token时按未登录处理；有token时按无权限处理，不强制登出
    if (status === 403) {
      if (!hasToken) {
        showMessageWithThrottle('403-login', '请先登录')
        localStorage.removeItem('token')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      } else {
        showMessageWithThrottle('403-no-permission', '无权限访问该资源')
      }
      return Promise.reject(error)
    }

    if (!config.skipErrorMessage) {
      ElMessage.error(error.message || '网络错误')
    }
    return Promise.reject(error)
  },
)

interface RequestInstance {
  <T = any>(config: ApiRequestConfig): Promise<T>
  get<T = any>(url: string, config?: ApiRequestConfig): Promise<T>
  post<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<T>
  put<T = any>(url: string, data?: any, config?: ApiRequestConfig): Promise<T>
  delete<T = any>(url: string, config?: ApiRequestConfig): Promise<T>
}

const request = (<T = any>(config: ApiRequestConfig) =>
  service.request<any, T>(config)) as RequestInstance

request.get = <T = any>(url: string, config?: ApiRequestConfig) => service.get<any, T>(url, config)
request.post = <T = any>(url: string, data?: any, config?: ApiRequestConfig) =>
  service.post<any, T>(url, data, config)
request.put = <T = any>(url: string, data?: any, config?: ApiRequestConfig) =>
  service.put<any, T>(url, data, config)
request.delete = <T = any>(url: string, config?: ApiRequestConfig) =>
  service.delete<any, T>(url, config)

export default request
