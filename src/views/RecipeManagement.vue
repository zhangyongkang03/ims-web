<template>
  <div class="container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>配方管理</span>
          <el-button type="primary" @click="openDialog('add')">新增配方</el-button>
        </div>
      </template>

      <!-- 搜索表单 -->
      <div class="search-form">
        <el-input
          v-model="searchForm.recipeCode"
          placeholder="搜索配方编码"
          clearable
          class="search-input"
        />
        <el-input
          v-model="searchForm.searchKey"
          placeholder="搜索配方名称"
          clearable
          class="search-input"
        />
        <el-select
          v-model="searchForm.isActive"
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
        <el-table-column prop="recipeCode" label="配方编码" width="120" />
        <el-table-column prop="recipeName" label="配方名称" width="150" />
        <el-table-column prop="pname" label="关联产品" width="150" />
        <el-table-column prop="baseQty" label="基础产量" width="100" />
        <el-table-column prop="baseUnitName" label="基准单位" width="100">
          <template #default="scope">
            {{ scope.row.baseUnitName || scope.row.baseUnit }}
          </template>
        </el-table-column>
        <el-table-column
          prop="isActive"
          label="状态"
          width="80"
          :formatter="(row) => (row.isActive === 1 ? '启用' : '禁用')"
        />
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="handleEdit(scope.row)"
              >编辑</el-button
            >
            <el-button link type="warning" size="small" @click="handleDetail(scope.row)"
              >配方明细</el-button
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
        <el-form-item v-if="dialogType === 'edit'" label="配方编码">
          <el-input v-model="formData.recipeCode" disabled />
        </el-form-item>
        <el-form-item label="配方名称" prop="recipeName">
          <el-input v-model="formData.recipeName" @blur="validateFieldIfNeeded('recipeName')" />
        </el-form-item>
        <el-form-item label="关联产品" prop="pId">
          <el-select v-model="formData.pId" placeholder="选择产品" @change="handleProductChange">
            <el-option v-for="p in productList" :key="p.pid" :label="p.pname" :value="p.pid" />
          </el-select>
        </el-form-item>
        <el-form-item label="基础产量" prop="baseQty">
          <el-input-number
            v-model="formData.baseQty"
            :min="0"
            @change="validateFieldIfNeeded('baseQty')"
          />
        </el-form-item>
        <el-form-item label="状态" prop="isActive">
          <el-select v-model="formData.isActive" @change="validateFieldIfNeeded('isActive')">
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
  </div>
</template>

<script setup lang="ts">
import { getProductOptions, type Product } from '@/api/product'
import {
  addRecipe,
  deleteRecipe,
  getRecipeList,
  updateRecipe,
  type Recipe,
  type RecipeForm,
} from '@/api/recipe'
import { useDeferredFormValidation } from '@/composables/useDeferredFormValidation'
import type { FormInstance } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const dialogVisible = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const formRef = ref<FormInstance>()
const { enableInteractionValidation, resetInteractionValidation, validateFieldIfNeeded } =
  useDeferredFormValidation(formRef)
const tableData = ref<Recipe[]>([])
const productList = ref<Product[]>([])

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0,
})

const searchForm = reactive({
  recipeCode: '',
  searchKey: '',
  isActive: undefined,
})

const formData = reactive<RecipeForm>({
  pId: undefined,
  recipeCode: '',
  recipeName: '',
  baseQty: 1000,
  baseUnit: '',
  isActive: 1,
})

const rules = {
  recipeName: [{ required: true, message: '配方名称不能为空' }],
  pId: [{ required: true, message: '关联产品不能为空' }],
  baseQty: [{ required: true, message: '基础产量不能为空' }],
  baseUnit: [{ required: true, message: '基准单位不能为空' }],
}

const dialogTitle = ref('新增配方')

const syncBaseUnitByProduct = (productId?: number) => {
  const product = productList.value.find((item) => item.pid === productId)
  formData.baseUnit = product?.punit || ''
}

const handleProductChange = (value?: number) => {
  syncBaseUnitByProduct(value)
  validateFieldIfNeeded('pId')
}

const getList = async () => {
  loading.value = true
  try {
    const res = await getRecipeList({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      recipeCode: searchForm.recipeCode,
      searchKey: searchForm.searchKey,
      isActive: searchForm.isActive,
    })
    tableData.value = res.data.records || []
    pagination.total = Number(res.data.total || 0)
  } catch (error) {
    console.error('获取配方列表失败:', error)
  } finally {
    loading.value = false
  }
}

const loadProductList = async () => {
  try {
    const res = await getProductOptions()
    productList.value = res.data
  } catch (error) {
    console.error('加载产品列表失败:', error)
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
  searchForm.recipeCode = ''
  searchForm.searchKey = ''
  searchForm.isActive = undefined
  pagination.pageNum = 1
  getList()
}

const openDialog = (type: 'add' | 'edit') => {
  resetInteractionValidation()
  dialogType.value = type
  dialogTitle.value = type === 'add' ? '新增配方' : '编辑配方'
  dialogVisible.value = true

  if (type === 'add') {
    formData.recipeName = ''
    formData.pId = undefined
    formData.baseQty = 1000
    formData.baseUnit = ''
    formData.isActive = 1
  }
}

const handleEdit = (row: Recipe) => {
  resetInteractionValidation()
  dialogType.value = 'edit'
  dialogTitle.value = '编辑配方'
  dialogVisible.value = true

  formData.recipeId = row.recipeId
  formData.recipeCode = row.recipeCode
  formData.recipeName = row.recipeName
  formData.pId = row.pid
  formData.baseQty = row.baseQty
  formData.baseUnit = row.baseUnit || ''
  formData.isActive = row.isActive
}

const handleDetail = (row: Recipe) => {
  router.push({
    name: 'RecipeDetailManagement',
    params: { recipeId: row.recipeId },
  })
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
        await addRecipe(formData)
        ElMessage.success('新增成功')
      } else {
        await updateRecipe(formData.recipeId!, formData)
        ElMessage.success('修改成功')
      }

      dialogVisible.value = false
      getList()
    } catch (error) {
      console.error('操作失败:', error)
    }
  })
}

const handleDelete = (row: Recipe) => {
  ElMessageBox.confirm(`确定删除配方 "${row.recipeName}" 吗?`, '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await deleteRecipe(row.recipeId)
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

onMounted(() => {
  getList()
  loadProductList()
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
