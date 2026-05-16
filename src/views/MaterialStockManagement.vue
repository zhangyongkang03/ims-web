<template>
  <div class="container">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>材料库存管理</span>
          <span class="tips">材料入库与出库申请确认统一在此处理</span>
        </div>
      </template>

      <el-tabs :model-value="activeTab" @tab-change="handleTabChange" class="page-tabs">
        <el-tab-pane label="库存查询" name="stock">
          <div class="search-form">
            <el-input
              v-model="stockSearch.materialNameKeyword"
              placeholder="输入物料编码或名称"
              clearable
              class="search-select"
            />
            <el-button type="primary" @click="handleStockSearch">查询</el-button>
            <el-button @click="handleStockReset">重置</el-button>
          </div>

          <el-table :data="stockTableData" stripe style="width: 100%" v-loading="stockLoading">
            <el-table-column prop="materialId" label="物料编码" width="140" />
            <el-table-column prop="materialName" label="物料名称" width="180" />
            <el-table-column prop="totalQuantity" label="库存数量" width="140" />
            <el-table-column prop="unitName" label="单位" width="100" />
            <el-table-column prop="lastPurchaseDate" label="最近采购时间" width="180" />
            <el-table-column prop="updateTime" label="更新时间" width="180" />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="scope">
                <el-button
                  link
                  type="primary"
                  size="small"
                  @click="handleViewDistribution(scope.row)"
                >
                  查看分布
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="stockPagination.pageNum"
            v-model:page-size="stockPagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="stockPagination.total"
            :hide-on-single-page="false"
            layout="total, sizes, prev, pager, next, jumper"
            class="pagination"
            @current-change="handleStockPageChange"
            @size-change="handleStockPageSizeChange"
          />
        </el-tab-pane>

        <el-tab-pane label="材料入库" name="lot" />

        <el-tab-pane label="材料出库申请" name="request">
          <div class="search-form">
            <el-input
              v-model="requestSearch.requestNo"
              placeholder="申请单号"
              clearable
              class="search-input"
            />
            <el-input
              v-model="requestSearch.woNo"
              placeholder="工单号"
              clearable
              class="search-input"
            />
            <el-select
              v-model="requestSearch.status"
              placeholder="申请状态"
              clearable
              class="search-select"
            >
              <el-option label="待确认" :value="0" />
              <el-option label="已确认" :value="1" />
              <el-option label="已驳回" :value="2" />
            </el-select>
            <el-button type="primary" @click="handleRequestSearch">查询</el-button>
            <el-button @click="handleRequestReset">重置</el-button>
          </div>

          <el-table :data="requestTableData" stripe style="width: 100%" v-loading="requestLoading">
            <el-table-column prop="requestNo" label="申请单号" width="200" />
            <el-table-column prop="bizTypeLabel" label="业务类型" width="120" />
            <el-table-column prop="woNo" label="工单号" width="160">
              <template #default="scope">{{ scope.row.woNo || '-' }}</template>
            </el-table-column>
            <el-table-column prop="productName" label="产品" width="160">
              <template #default="scope">{{ scope.row.productName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="batchNo" label="预分配批次号" width="180">
              <template #default="scope">{{ scope.row.batchNo || '-' }}</template>
            </el-table-column>
            <el-table-column prop="statusLabel" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="requestStatusTagType(scope.row.status)">{{
                  scope.row.statusLabel
                }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="applicantName" label="申请人" width="120">
              <template #default="scope">{{ scope.row.applicantName || '-' }}</template>
            </el-table-column>
            <el-table-column prop="createTime" label="申请时间" min-width="180" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="scope">
                <el-button link type="info" size="small" @click="openRequestDetail(scope.row)">
                  详情
                </el-button>
                <el-button
                  link
                  type="primary"
                  size="small"
                  :disabled="scope.row.status !== 0"
                  @click="handleConfirmRequest(scope.row)"
                >
                  确认
                </el-button>
                <el-button
                  link
                  type="danger"
                  size="small"
                  :disabled="scope.row.status !== 0"
                  @click="handleRejectRequest(scope.row)"
                >
                  驳回
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-pagination
            v-model:current-page="requestPagination.pageNum"
            v-model:page-size="requestPagination.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="requestPagination.total"
            :hide-on-single-page="false"
            layout="total, sizes, prev, pager, next, jumper"
            class="pagination"
            @current-change="handleRequestPageChange"
            @size-change="handleRequestPageSizeChange"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="requestDetailVisible" title="出库申请详情" width="900px">
      <template v-if="requestDetail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="申请单号">{{
            requestDetail.requestNo
          }}</el-descriptions-item>
          <el-descriptions-item label="业务类型">{{
            requestDetail.bizTypeLabel
          }}</el-descriptions-item>
          <el-descriptions-item label="工单号">{{
            requestDetail.woNo || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="产品">{{
            requestDetail.productName || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="预分配批次号">{{
            requestDetail.batchNo || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="requestStatusTagType(requestDetail.status)">
              {{ requestDetail.statusLabel }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="申请人">{{
            requestDetail.applicantName || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="申请时间">{{
            requestDetail.createTime || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="确认时间">{{
            requestDetail.confirmTime || '-'
          }}</el-descriptions-item>
          <el-descriptions-item label="驳回原因" :span="2">
            {{ requestDetail.reason || '-' }}
          </el-descriptions-item>
        </el-descriptions>

        <el-table :data="requestDetail.itemList" stripe style="width: 100%; margin-top: 16px">
          <el-table-column prop="itemCode" label="物料编码" width="140">
            <template #default="scope">{{ scope.row.itemCode || '-' }}</template>
          </el-table-column>
          <el-table-column prop="itemName" label="物料名称" width="180" />
          <el-table-column prop="batchNo" label="批次号" width="180">
            <template #default="scope">{{ scope.row.batchNo || '-' }}</template>
          </el-table-column>
          <el-table-column prop="warehouseName" label="仓库" width="140">
            <template #default="scope">{{ scope.row.warehouseName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="locationName" label="库位" width="140">
            <template #default="scope">{{ scope.row.locationName || '-' }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="申请数量" width="120" />
          <el-table-column prop="unit" label="单位" width="100">
            <template #default="scope">{{ scope.row.unit || '-' }}</template>
          </el-table-column>
        </el-table>
      </template>

      <template #footer>
        <el-button @click="requestDetailVisible = false">关闭</el-button>
        <el-button
          v-if="requestDetail?.status === 0"
          type="danger"
          @click="requestDetail && handleRejectRequest(requestDetail)"
        >
          驳回
        </el-button>
        <el-button
          v-if="requestDetail?.status === 0"
          type="primary"
          @click="requestDetail && handleConfirmRequest(requestDetail)"
        >
          确认执行扣减
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { getMaterialStockList, type MaterialStock } from '@/api/materialStock'
import {
  confirmStockRequest,
  getStockRequestDetail,
  getStockRequestList,
  rejectStockRequest,
  type StockRequest,
  type StockRequestDetail,
} from '@/api/stockRequest'
import { ElMessage, ElMessageBox } from 'element-plus'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const stockLoading = ref(false)
const stockTableData = ref<MaterialStock[]>([])
const stockSearch = reactive<{ materialNameKeyword: string }>({
  materialNameKeyword: '',
})
const stockPagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0,
})

const requestLoading = ref(false)
const requestTableData = ref<StockRequest[]>([])
const requestSearch = reactive<{ requestNo: string; woNo: string; status?: number }>({
  requestNo: '',
  woNo: '',
  status: 0,
})
const requestPagination = reactive({
  pageNum: 1,
  pageSize: 10,
  total: 0,
})
const requestDetailVisible = ref(false)
const requestDetail = ref<StockRequestDetail | null>(null)

const activeTab = computed(() => {
  const tab = typeof route.query.tab === 'string' ? route.query.tab : ''
  return tab === 'request' ? 'request' : 'stock'
})

const syncRequestSearchFromRoute = () => {
  const queryStatus = route.query.status
  requestSearch.requestNo = typeof route.query.requestNo === 'string' ? route.query.requestNo : ''
  requestSearch.woNo = typeof route.query.woNo === 'string' ? route.query.woNo : ''
  requestSearch.status =
    typeof queryStatus === 'string' && queryStatus !== ''
      ? Number(queryStatus)
      : requestSearch.status
}

const getStockList = async () => {
  const materialNameKeyword = stockSearch.materialNameKeyword.trim()

  stockLoading.value = true
  try {
    const res = await getMaterialStockList({
      pageNum: stockPagination.pageNum,
      pageSize: stockPagination.pageSize,
      searchKey: materialNameKeyword || undefined,
    })
    stockTableData.value = res.data.records || []
    stockPagination.total = res.data.total || 0
  } catch (error) {
    console.error('获取库存列表失败:', error)
  } finally {
    stockLoading.value = false
  }
}

const getRequestList = async () => {
  requestLoading.value = true
  try {
    const res = await getStockRequestList({
      pageNum: requestPagination.pageNum,
      pageSize: requestPagination.pageSize,
      requestNo: requestSearch.requestNo.trim() || undefined,
      woNo: requestSearch.woNo.trim() || undefined,
      status: requestSearch.status,
    })
    requestTableData.value = res.data.records || []
    requestPagination.total = res.data.total || 0
  } catch (error) {
    console.error('获取出库申请列表失败:', error)
  } finally {
    requestLoading.value = false
  }
}

const handleStockSearch = () => {
  stockPagination.pageNum = 1
  getStockList()
}

const handleStockReset = () => {
  stockSearch.materialNameKeyword = ''
  stockPagination.pageNum = 1
  getStockList()
}

const handleStockPageChange = (pageNum: number) => {
  stockPagination.pageNum = pageNum
  getStockList()
}

const handleStockPageSizeChange = (pageSize: number) => {
  stockPagination.pageSize = pageSize
  stockPagination.pageNum = 1
  getStockList()
}

const handleRequestSearch = () => {
  requestPagination.pageNum = 1
  getRequestList()
}

const handleRequestReset = () => {
  requestSearch.requestNo = ''
  requestSearch.woNo = ''
  requestSearch.status = 0
  requestPagination.pageNum = 1
  getRequestList()
}

const handleRequestPageChange = (pageNum: number) => {
  requestPagination.pageNum = pageNum
  getRequestList()
}

const handleRequestPageSizeChange = (pageSize: number) => {
  requestPagination.pageSize = pageSize
  requestPagination.pageNum = 1
  getRequestList()
}

const handleTabChange = (name: string | number) => {
  if (name === 'lot') {
    router.push('/material/lot')
    return
  }

  if (name === 'request') {
    router.replace({
      path: '/material/stock',
      query: {
        tab: 'request',
        ...(requestSearch.woNo ? { woNo: requestSearch.woNo } : {}),
        ...(requestSearch.requestNo ? { requestNo: requestSearch.requestNo } : {}),
        ...(requestSearch.status !== undefined ? { status: String(requestSearch.status) } : {}),
      },
    })
    return
  }

  router.replace({ path: '/material/stock' })
}

const requestStatusTagType = (status: number): 'warning' | 'success' | 'danger' | 'info' => {
  const map: Record<number, 'warning' | 'success' | 'danger' | 'info'> = {
    0: 'warning',
    1: 'success',
    2: 'danger',
  }
  return map[status] ?? 'info'
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

const openRequestDetail = async (row: StockRequest) => {
  try {
    const res = await getStockRequestDetail(row.requestId)
    requestDetail.value = res.data
    requestDetailVisible.value = true
  } catch (error) {
    console.error('获取申请单详情失败:', error)
  }
}

const refreshRequestData = async () => {
  await Promise.all([getRequestList(), getStockList()])
  if (requestDetailVisible.value && requestDetail.value?.requestId) {
    const res = await getStockRequestDetail(requestDetail.value.requestId)
    requestDetail.value = res.data
  }
}

const handleConfirmRequest = (row: StockRequest) => {
  ElMessageBox.confirm('确认后将执行 FEFO 扣减，并推动工单进入下一生产状态。', '确认申请单', {
    confirmButtonText: '确认',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      await confirmStockRequest(row.requestId)
      ElMessage.success('申请单已确认并执行扣减')
      await refreshRequestData()
    })
    .catch(() => {})
}

const handleRejectRequest = (row: StockRequest) => {
  ElMessageBox.prompt('请输入驳回原因', '驳回申请单', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPlaceholder: '请输入驳回原因',
    inputValidator: (value) => (value.trim() ? true : '驳回原因不能为空'),
  })
    .then(async (value) => {
      await rejectStockRequest(row.requestId, String(value).trim())
      ElMessage.success('申请单已驳回')
      await refreshRequestData()
    })
    .catch(() => {})
}

watch(
  () => route.query,
  () => {
    syncRequestSearchFromRoute()
    if (activeTab.value === 'request') {
      requestPagination.pageNum = 1
      getRequestList()
    }
  },
)

onMounted(() => {
  syncRequestSearchFromRoute()
  getStockList()
  if (activeTab.value === 'request') {
    getRequestList()
  }
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
  gap: 12px;
}

.tips {
  color: #909399;
  font-size: 13px;
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

.search-input,
.search-select {
  width: 220px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
