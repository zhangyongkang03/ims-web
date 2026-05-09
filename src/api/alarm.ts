import type { ApiResponse } from './request'
import request from './request'

export interface AlarmRecord {
  alarmId: number
  batchNo: string
  deviceCode: string
  processType: string
  alarmLevel: 'INFO' | 'WARNING' | 'CRITICAL' | string
  currentValue: number
  standardRange: string
  alarmMsg: string
  isHandled: number
  handleUser: string | null
  handleTime: string | null
  handleRemark: string | null
  createTime: string
}

export interface AlarmPageResult {
  records: AlarmRecord[]
  total: number
  pages: number
  pageNum: number
  pageSize: number
}

export interface AlarmQueryParams {
  pageNum?: number
  pageSize?: number
  deviceCode?: string
  processType?: string
  isHandled?: number
}

export interface HandleAlarmForm {
  alarmId: number
  handleUser?: string
  handleRemark: string
}

export interface AlarmPushData {
  alarmId: number | null
  batchNo: string
  deviceCode: string
  processType: string
  alarmLevel: 'INFO' | 'WARNING' | 'CRITICAL' | string
  currentValue: number
  standardRange: string
  alarmMsg: string
  createTime: string
}

export interface AlarmPushMessage {
  type: string
  data?: AlarmPushData
  timestamp?: number
}

function normalizeAlarmRecord(raw: any): AlarmRecord {
  return {
    alarmId: Number(raw?.alarmId ?? raw?.id ?? 0),
    batchNo: raw?.batchNo ?? '',
    deviceCode: raw?.deviceCode ?? '',
    processType: raw?.processType ?? '',
    alarmLevel: raw?.alarmLevel ?? 'INFO',
    currentValue: Number(raw?.currentValue ?? 0),
    standardRange: raw?.standardRange ?? '',
    alarmMsg: raw?.alarmMsg ?? '',
    isHandled: Number(raw?.isHandled ?? 0),
    handleUser: raw?.handleUser ?? null,
    handleTime: raw?.handleTime ?? null,
    handleRemark: raw?.handleRemark ?? null,
    createTime: raw?.createTime ?? '',
  }
}

/**
 * 兼容后端 websocket 推送结构，补齐页面表格字段
 */
export function normalizeAlarmPushData(data: AlarmPushData): AlarmRecord {
  return {
    alarmId: data.alarmId ?? 0,
    batchNo: data.batchNo,
    deviceCode: data.deviceCode,
    processType: data.processType,
    alarmLevel: data.alarmLevel,
    currentValue: data.currentValue,
    standardRange: data.standardRange,
    alarmMsg: data.alarmMsg,
    isHandled: 0,
    handleUser: null,
    handleTime: null,
    handleRemark: null,
    createTime: data.createTime,
  }
}

/**
 * 分页查询报警列表
 */
export function getAlarmList(params: AlarmQueryParams) {
  return request.get<ApiResponse<AlarmPageResult>>('/alarm/list', { params }).then((res) => ({
    ...res,
    data: {
      ...res.data,
      records: (res.data.records || []).map(normalizeAlarmRecord),
      total: Number(res.data.total || 0),
      pages: Number(res.data.pages || 0),
      pageNum: Number(res.data.pageNum || params.pageNum || 1),
      pageSize: Number(res.data.pageSize || params.pageSize || 10),
    },
  }))
}

/**
 * 处理报警
 */
export function handleAlarm(data: HandleAlarmForm) {
  return request.post<ApiResponse<null>>('/alarm/handle', data)
}

/**
 * 获取未处理报警数量
 */
export function getUnhandledAlarmCount() {
  return request.get<ApiResponse<number>>('/alarm/count-unhandled')
}
