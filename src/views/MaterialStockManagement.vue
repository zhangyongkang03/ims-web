<template>
  <div class="container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>库存查询</span>
        </div>
      </template>

      <el-tabs :model-value="activeTab" @tab-change="handleTabChange" class="page-tabs">
        <el-tab-pane label="库存查询" name="stock" />
        <el-tab-pane label="材料入库" name="lot" />
      </el-tabs>

      <div class="search-form">
        <el-input
          v-model="searchForm.materialNameKeyword"
          placeholder="输入物料编码或名称"
          clearable
          class="search-select"
        />
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </div>

      <el-table :data="tableData" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="materialId" label="物料编码" width="140" />
        <el-table-column prop="materialName" label="物料名称" width="180" />
        <el-table-column prop="totalQuantity" label="库存数量" width="140" />
        <el-table-column prop="unitName" label="单位" width="100" />
        <el-table-column prop="lastPurchaseDate" label="最近采购时间" width="180" />
        <el-table-column prop="updateTime" label="更新时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="handleViewDistribution(scope.row)">
              查看分布
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.pageNum"
        v-model:page-size="pagination.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        :hide-on-single-page="false"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @change="getList"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { getMaterialStockList, type MaterialStock } from '@/api/materialStock'
import { ElMessage } from 'element-plus'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const loading = ref(false)
const tableData = ref<MaterialStock[]>([])
const route = useRoute()
const router = useRouter()

const searchForm = reactive<{ materialNameKeyword: string }>({
  materialNameKeyword: '',
})

const pagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0,
})

const getList = async () => {
  const materialNameKeyword = searchForm.materialNameKeyword.trim()

  loading.value = true
  try {
    const res = await getMaterialStockList({
      pageNum: pagination.pageNum,
      pageSize: pagination.pageSize,
      searchKey: materialNameKeyword || undefined,
    })
    tableData.value = res.data.records || []
    pagination.total = res.data.total || 0
  } catch (error) {
    console.error('获取库存列表失败:', error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.pageNum = 1
  getList()
}

const handleReset = () => {
  searchForm.materialNameKeyword = ''
  pagination.pageNum = 1
  getList()
}

const activeTab = computed(() => (route.path.startsWith('/material/lot') ? 'lot' : 'stock'))

const handleTabChange = (name: string | number) => {
  if (name === 'lot') {
    router.push('/material/lot')
    return
  }
  router.push('/material/stock')
}

const handleViewDistribution = async (row: MaterialStock) => {
  const rawItemId =
    (row as any).materialId ?? (row as any).itemId ?? (row as any).mId ?? (row as any).mid
  const itemId = rawItemId !== undefined && rawItemId !== null ? String(rawItemId) : ''
  if (!itemId) {
    ElMessage.error('未获取到物料ID，无法查询仓库分布')
    return
  }

  const itemName =
    (row as any).materialName ??
    (row as any).itemName ??
    (row as any).mName ??
    (row as any).mname ??
    ''

  router.push({
    name: 'MaterialStockDistribution',
    params: { itemId },
    query: { itemName },
  })
}

onMounted(() => {
  getList()
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

.page-tabs {
  margin-bottom: 12px;
}

.search-select {
  width: 220px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
