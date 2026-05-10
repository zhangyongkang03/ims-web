<template>
  <div class="container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>传感器管理</span>
          <el-button type="primary" @click="openDialog('add')">新增传感器</el-button>
        </div>
      </template>

      <div class="search-form">
        <el-input
          v-model="searchForm.searchKey"
          placeholder="搜索传感器编码/名称"
          clearable
          class="search-input"
        />
        <el-select
          v-model="searchForm.stationId"
          placeholder="工位"
          clearable
          class="search-select"
          @change="handleSearchStationChange"
        >
          <el-option
            v-for="s in stationList"
            :key="s.stationId"
            :label="s.stationName"
            :value="s.stationId"
          />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <el-table :data="tableData" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="deviceCode" label="传感器编码" width="180" />
        <el-table-column prop="deviceName" label="传感器名称" min-width="160" />
        <el-table-column prop="deviceType" label="类型" width="100" />
        <el-table-column label="分析类别" min-width="180">
          <template #default="{ row }">
            {{ row.sensorCategoryLabel || getSensorCategoryLabel(row.sensorCategory) }}
          </template>
        </el-table-column>
        <el-table-column prop="stationName" label="工位" width="140" />
        <el-table-column prop="equipName" label="挂载设备" width="160" />
        <el-table-column prop="statusLabel" label="状态" width="90">
          <template #default="{ row }">{{
            row.statusLabel || (row.status === 1 ? '启用' : '停用')
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.pageNum"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          :hide-on-single-page="false"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="getList"
          @size-change="getList"
          class="pagination"
        />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="100px"
        label-position="right"
        scroll-to-error
      >
        <el-form-item label="工位" prop="stationId">
          <el-select
            v-model="formData.stationId"
            placeholder="选择工位"
            @change="handleFormStationChange"
          >
            <el-option
              v-for="s in stationList"
              :key="s.stationId"
              :label="s.stationName"
              :value="s.stationId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="挂载设备">
          <el-select v-model="formData.equipId" placeholder="选择设备（可选）" clearable filterable>
            <el-option
              v-for="e in filteredEquipmentList"
              :key="e.equipId"
              :label="`${e.equipName}(${e.equipCode})`"
              :value="e.equipId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="传感器编码" prop="deviceCode">
          <el-input v-model="formData.deviceCode" />
        </el-form-item>
        <el-form-item label="传感器名称" prop="deviceName">
          <el-input v-model="formData.deviceName" />
        </el-form-item>
        <el-form-item label="传感器类型" prop="deviceType">
          <el-input v-model="formData.deviceType" placeholder="请输入传感器类型" />
        </el-form-item>
        <el-form-item label="分析类别">
          <el-select
            v-model="formData.sensorCategory"
            placeholder="请选择分析类别（可选）"
            clearable
          >
            <el-option
              v-for="item in sensorCategoryOptions"
              :key="item.id"
              :label="item.dictLabel"
              :value="item.dictValue"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="formData.status">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  addDevice,
  deleteDevice,
  getDeviceList,
  updateDevice,
  type Device,
  type DeviceForm,
} from '@/api/device'
import { getDictDataList, type DictData } from '@/api/dict'
import { getEquipmentList, type Equipment } from '@/api/equipment'
import { getStationOptions, type Station } from '@/api/station'
import type { FormInstance } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

type DeviceDialogForm = Omit<DeviceForm, 'stationId'> & {
  stationId?: number
}

const route = useRoute()
const loading = ref(false)
const dialogVisible = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const formRef = ref<FormInstance>()
const tableData = ref<Device[]>([])
const stationList = ref<Station[]>([])
const equipmentList = ref<Equipment[]>([])
const sensorCategoryOptions = ref<DictData[]>([])
const dialogTitle = ref('新增传感器')

const pagination = reactive({ pageNum: 1, pageSize: 10, total: 0 })
const searchForm = reactive<{ searchKey: string; stationId?: number }>({
  searchKey: '',
  stationId: undefined,
})

const formData = reactive<DeviceDialogForm>({
  stationId: undefined,
  equipId: undefined,
  deviceCode: '',
  deviceName: '',
  deviceType: '',
  sensorCategory: undefined,
  kafkaTopic: '',
  redisKey: '',
  status: 1,
})

const getSensorCategoryLabel = (sensorCategory?: 'PROCESS' | 'PER_BOTTLE' | null) => {
  if (!sensorCategory) return '—'
  return (
    sensorCategoryOptions.value.find((item) => item.dictValue === sensorCategory)?.dictLabel || '—'
  )
}

const rules = {
  stationId: [{ required: true, message: '工位不能为空' }],
  deviceCode: [{ required: true, message: '传感器编码不能为空' }],
  deviceName: [{ required: true, message: '传感器名称不能为空' }],
  deviceType: [{ required: true, message: '传感器类型不能为空' }],
}

const filteredEquipmentList = computed(() => {
  if (!formData.stationId) return equipmentList.value
  return equipmentList.value.filter((e) => e.stationId === formData.stationId)
})

const getList = async () => {
  loading.value = true
  try {
    const res = await getDeviceList({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      searchKey: searchForm.searchKey || undefined,
      deviceName: searchForm.searchKey || undefined,
      stationId: searchForm.stationId,
    })
    tableData.value = res.data.records
    pagination.total = res.data.total
  } finally {
    loading.value = false
  }
}

const loadStationList = async () => {
  const res = await getStationOptions()
  stationList.value = res.data
}

const loadEquipmentList = async () => {
  const res = await getEquipmentList({ pageSize: 1000 })
  equipmentList.value = res.data.records
}

const loadSensorCategoryOptions = async () => {
  const res = await getDictDataList('device_type')
  sensorCategoryOptions.value = (res.data || []).filter((item) => item.status)
}

const handleSearch = () => {
  pagination.pageNum = 1
  getList()
}

const handleReset = () => {
  searchForm.searchKey = ''
  searchForm.stationId = undefined
  pagination.pageNum = 1
  getList()
}

const handleSearchStationChange = () => {
  pagination.pageNum = 1
}

const handleFormStationChange = () => {
  formData.equipId = undefined
}

const openDialog = (type: 'add' | 'edit') => {
  dialogType.value = type
  dialogTitle.value = type === 'add' ? '新增传感器' : '编辑传感器'
  if (type === 'add') {
    formData.deviceId = undefined
    formData.stationId = searchForm.stationId
    formData.equipId = undefined
    formData.deviceCode = ''
    formData.deviceName = ''
    formData.deviceType = ''
    formData.sensorCategory = undefined
    formData.kafkaTopic = ''
    formData.redisKey = ''
    formData.status = 1
  }
  dialogVisible.value = true
}

const handleEdit = (row: Device) => {
  dialogType.value = 'edit'
  dialogTitle.value = '编辑传感器'
  formData.deviceId = row.deviceId
  formData.stationId = row.stationId
  formData.equipId = row.equipId
  formData.deviceCode = row.deviceCode
  formData.deviceName = row.deviceName || ''
  formData.deviceType = row.deviceType
  formData.sensorCategory = row.sensorCategory || undefined
  formData.kafkaTopic = row.kafkaTopic || ''
  formData.redisKey = row.redisKey || ''
  formData.status = row.status
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (dialogType.value === 'add') {
      await addDevice(formData as DeviceForm)
      ElMessage.success('新增成功')
    } else {
      await updateDevice(formData.deviceId!, formData as DeviceForm)
      ElMessage.success('修改成功')
    }
    dialogVisible.value = false
    getList()
  })
}

const handleDelete = (row: Device) => {
  ElMessageBox.confirm(
    `确定删除传感器「${row.deviceName || row.deviceCode}（${row.deviceCode}）」吗？`,
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )
    .then(async () => {
      await deleteDevice(row.deviceId)
      ElMessage.success('删除成功')
      getList()
    })
    .catch(() => {})
}

onMounted(() => {
  const stationIdFromRoute = Number(route.params.stationId || 0)
  if (stationIdFromRoute) {
    searchForm.stationId = stationIdFromRoute
  }
  getList()
  loadStationList()
  loadEquipmentList()
  loadSensorCategoryOptions()
})
</script>

<style scoped>
.container {
  padding: 20px;
}
.box-card {
  margin-bottom: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.search-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.search-input {
  width: 220px;
}
.search-select {
  width: 180px;
}
.pagination-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
