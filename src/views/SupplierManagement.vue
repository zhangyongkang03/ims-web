<template>
  <div class="container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>供应商管理</span>
          <el-button type="primary" @click="openDialog('add')">新增供应商</el-button>
        </div>
      </template>

      <!-- 搜索表单 -->
      <div class="search-form">
        <el-input
          v-model="searchForm.searchKey"
          placeholder="搜索供应商名称"
          clearable
          class="search-input"
        />
        <el-select
          v-model="searchForm.searchStatus"
          placeholder="选择状态"
          clearable
          class="search-select"
        >
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <!-- 数据表格 -->
      <el-table :data="tableData" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="supCode" label="供应商编码" width="120" />
        <el-table-column prop="supName" label="供应商名称" width="150" />
        <el-table-column prop="supType" label="供应商类型" width="120">
          <template #default="scope">
            {{ getSupplierTypeLabel(scope.row.supType) }}
          </template>
        </el-table-column>
        <el-table-column prop="contactPerson" label="联系人" width="120" />
        <el-table-column prop="contactPhone" label="联系电话" width="130" />
        <el-table-column
          prop="status"
          label="状态"
          width="80"
          :formatter="(row) => (row.status === 1 ? '启用' : '禁用')"
        />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="openMaterialDialog(scope.row)">
              配置物料
            </el-button>
            <el-button link type="primary" size="small" @click="handleEdit(scope.row)"
              >编辑</el-button
            >
            <el-button link type="danger" size="small" @click="handleDelete(scope.row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-model:current-page="pagination.pageNum"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        :hide-on-single-page="false"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="handleCurrentPageChange"
        @size-change="handlePageSizeChange"
        class="pagination"
      />
    </el-card>

    <!-- 编辑/新增对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="40%">
      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-width="100px"
        label-position="right"
        scroll-to-error
      >
        <el-form-item v-if="dialogType === 'edit'" label="供应商编码">
          <el-input v-model="formData.supCode" disabled />
        </el-form-item>
        <el-form-item label="供应商名称" prop="supName">
          <el-input v-model="formData.supName" @blur="validateFieldIfNeeded('supName')" />
        </el-form-item>
        <el-form-item label="供应商类型" prop="supType">
          <el-select
            v-model="formData.supType"
            placeholder="请选择供应商类型"
            @change="validateFieldIfNeeded('supType')"
          >
            <el-option
              v-for="item in supplierTypeOptions"
              :key="item.dictValue"
              :label="item.dictLabel"
              :value="item.dictValue"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="联系人" prop="contactPerson">
          <el-input v-model="formData.contactPerson" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="formData.contactPhone" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="formData.status" @change="validateFieldIfNeeded('status')">
            <el-option label="启用" :value="1" />
            <el-option label="禁用" :value="0" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="materialDialogVisible" :title="materialDialogTitle" width="40%">
      <el-form label-width="100px" label-position="right">
        <el-form-item label="可供应物料">
          <el-select
            v-model="selectedMaterialIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择可供应物料"
            style="width: 100%"
            :loading="materialLoading"
          >
            <el-option
              v-for="item in materialOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="materialDialogVisible = false">取消</el-button>
          <el-button
            type="primary"
            :loading="materialSubmitting"
            @click="handleSaveSupplierMaterials"
          >
            保存
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { getMaterialOptions } from '@/api/material'
import {
  addSupplier,
  deleteSupplier,
  getSupplierList,
  getSupplierMaterials,
  setSupplierMaterials,
  updateSupplier,
  type Supplier,
  type SupplierForm,
} from '@/api/supplier'
import { useDeferredFormValidation } from '@/composables/useDeferredFormValidation'
import { useDictData } from '@/composables/useDictData'
import { DICT_TYPE } from '@/constants/dict'
import type { FormInstance } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, reactive, ref } from 'vue'

const loading = ref(false)
const dialogVisible = ref(false)
const materialDialogVisible = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const formRef = ref<FormInstance>()
const { enableInteractionValidation, resetInteractionValidation, validateFieldIfNeeded } =
  useDeferredFormValidation(formRef)
const tableData = ref<Supplier[]>([])
const materialLoading = ref(false)
const materialSubmitting = ref(false)
const selectedMaterialIds = ref<number[]>([])
const allMaterials = ref<Array<{ mid: number; mname: string; mcode: string }>>([])
const currentSupplier = ref<Supplier | null>(null)

const {
  options: supplierTypeOptions,
  getLabel: getSupplierTypeLabel,
  load: loadSupplierTypeDict,
} = useDictData(DICT_TYPE.SUPPLIER_TYPE)

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0,
})

const searchForm = reactive({
  searchKey: '',
  searchStatus: 1,
})

const formData = reactive<SupplierForm>({
  supCode: '',
  supName: '',
  supType: '',
  contactPerson: '',
  contactPhone: '',
  status: 1,
})

const rules = {
  supName: [{ required: true, message: '供应商名称不能为空' }],
  supType: [{ required: true, message: '供应商类型不能为空' }],
  status: [{ required: true, message: '状态不能为空' }],
}

const dialogTitle = ref('新增供应商')
const materialDialogTitle = computed(() =>
  currentSupplier.value ? `配置供应物料 - ${currentSupplier.value.supName}` : '配置供应物料',
)

const materialOptions = computed(() =>
  allMaterials.value.map((item) => ({
    value: item.mid,
    label: `${item.mname} (${item.mcode})`,
  })),
)

const loadAllMaterials = async () => {
  if (allMaterials.value.length > 0) return

  const res = await getMaterialOptions()
  allMaterials.value = (res.data || []).map((item) => ({
    mid: item.mid,
    mname: item.mname,
    mcode: item.mcode,
  }))
}

const openMaterialDialog = async (row: Supplier) => {
  try {
    materialLoading.value = true
    currentSupplier.value = row
    materialDialogVisible.value = true
    await loadAllMaterials()
    const res = await getSupplierMaterials(row.supId)
    selectedMaterialIds.value = (res.data || []).map((item) => Number(item.mId)).filter(Boolean)
  } catch (error) {
    console.error('加载供应商可供物料失败:', error)
  } finally {
    materialLoading.value = false
  }
}

const handleSaveSupplierMaterials = async () => {
  if (!currentSupplier.value) return

  try {
    materialSubmitting.value = true
    await setSupplierMaterials(currentSupplier.value.supId, selectedMaterialIds.value)
    ElMessage.success('保存成功')
    materialDialogVisible.value = false
  } catch (error) {
    console.error('保存供应商物料失败:', error)
  } finally {
    materialSubmitting.value = false
  }
}

const getList = async () => {
  loading.value = true
  try {
    const res = await getSupplierList({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      searchKey: searchForm.searchKey,
      searchStatus: searchForm.searchStatus,
    })
    tableData.value = res.data.records || []
    pagination.total = Number(res.data.total || 0)
  } catch (error) {
    console.error('获取供应商列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  getList()
}

const handleCurrentPageChange = (pageNum: number) => {
  pagination.pageNum = pageNum
  getList()
}

const handlePageSizeChange = (pageSize: number) => {
  pagination.pageSize = pageSize
  pagination.pageNum = 1
  getList()
}

const handleReset = () => {
  searchForm.searchKey = ''
  searchForm.searchStatus = 1
  pagination.pageNum = 1
  getList()
}

const openDialog = (type: 'add' | 'edit') => {
  resetInteractionValidation()
  dialogType.value = type
  dialogTitle.value = type === 'add' ? '新增供应商' : '编辑供应商'
  dialogVisible.value = true

  if (type === 'add') {
    formData.supName = ''
    formData.supType = ''
    formData.contactPerson = ''
    formData.contactPhone = ''
    formData.status = 1
  }
}

const handleEdit = (row: Supplier) => {
  resetInteractionValidation()
  dialogType.value = 'edit'
  dialogTitle.value = '编辑供应商'
  dialogVisible.value = true

  formData.supId = row.supId
  formData.supCode = row.supCode
  formData.supName = row.supName
  formData.supType = String(row.supType ?? '')
  formData.contactPerson = row.contactPerson || ''
  formData.contactPhone = row.contactPhone || ''
  formData.status = row.status
}

const handleSubmit = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) {
      enableInteractionValidation()
      return
    }

    try {
      if (dialogType.value === 'add') {
        await addSupplier(formData)
        ElMessage.success('新增成功')
      } else {
        await updateSupplier(formData.supId!, formData)
        ElMessage.success('修改成功')
      }

      dialogVisible.value = false
      getList()
    } catch (error) {
      console.error('操作失败:', error)
    }
  })
}

const handleDelete = (row: Supplier) => {
  ElMessageBox.confirm(`确定删除供应商 "${row.supName}" 吗?`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await deleteSupplier(row.supId)
        ElMessage.success('删除成功')
        getList()
      } catch (error) {
        console.error('删除失败:', error)
      }
    })
    .catch(() => {
      ElMessage.info('已取消删除')
    })
}

getList()
loadSupplierTypeDict()
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
  width: 200px;
}

.search-select {
  width: 150px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.dialog-footer {
  text-align: right;
}
</style>
