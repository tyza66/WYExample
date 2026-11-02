<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getArrearsReport } from '@/api/report'
import { getDashboardSummary } from '@/api/dashboard'
import { listFeeItems } from '@/api/feeItem'
import { communityOptions } from '@/api/community'
import { currentPeriod, formatAmount } from '@/utils/format'
import { exportBackend } from '@/utils/export'

const loading = ref(false)
const exporting = ref(false)

const query = reactive({
  period: currentPeriod(),
  communityId: '',
  feeItemId: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const feeItems = ref([])
const summary = ref({ arrears: 0, unpaidRoomCount: 0 })

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadFeeItems() {
  try {
    const data = await listFeeItems({ page: 1, size: 100 })
    feeItems.value = data?.list || []
  } catch (e) {
    feeItems.value = []
  }
}

/** 汇总卡片：口径来自工作台汇总（同一账期 + 小区），与账单列表同源 */
async function loadSummary() {
  try {
    const data = await getDashboardSummary({
      period: query.period || undefined,
      communityId: query.communityId || undefined
    })
    summary.value = {
      arrears: data?.arrears ?? 0,
      unpaidRoomCount: data?.unpaidRoomCount ?? 0
    }
  } catch (e) {
    summary.value = { arrears: 0, unpaidRoomCount: 0 }
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await getArrearsReport({ ...query })
    list.value = data?.list || []
    total.value = data?.total || 0
  } catch (e) {
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  loadData()
  loadSummary()
}

function handleReset() {
  query.period = currentPeriod()
  query.communityId = ''
  query.feeItemId = ''
  query.page = 1
  handleSearch()
}

const CSV_HEADERS = [
  '小区',
  '楼栋',
  '房号',
  '业主',
  '电话',
  '账期',
  '收费项目',
  '应收净额',
  '已收金额',
  '欠费金额',
  '逾期天数'
]

function toCsvRow(row) {
  return [
    row.communityName || '',
    row.buildingName || '',
    row.roomNo || '',
    row.ownerName || '',
    row.phone || '',
    row.period || '',
    row.feeItemName || '',
    Number(row.netAmount || 0).toFixed(2),
    Number(row.paidAmount || 0).toFixed(2),
    Number(row.arrears || 0).toFixed(2),
    row.daysOverdue ?? ''
  ]
}

/** 导出当前筛选条件下的欠费明细（后端 CSV，/api/export/arrears） */
async function handleExport() {
  exporting.value = true
  try {
    await exportBackend('arrears', { ...query, page: undefined, size: undefined }, '欠费报表')
    ElMessage.success('已开始下载欠费 CSV')
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCommunities(), loadFeeItems()])
  await loadData()
  await loadSummary()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">欠费报表</span>
          <span class="page-subtitle">汇总结算卡片口径：账期 + 小区（不含收费项目筛选）</span>
        </div>
        <el-button type="primary" :loading="exporting" @click="handleExport">
          <el-icon><Download /></el-icon>
          <span>导出 CSV</span>
        </el-button>
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))">
        <div class="stat-card is-arrears">
          <div class="stat-label">总欠费金额（元）</div>
          <div class="stat-value">{{ formatAmount(summary.arrears) }}</div>
        </div>
        <div class="stat-card is-count">
          <div class="stat-label">欠费户数</div>
          <div class="stat-value">{{ summary.unpaidRoomCount ?? 0 }}</div>
        </div>
        <div class="stat-card is-receivable">
          <div class="stat-label">明细条数（当前筛选）</div>
          <div class="stat-value">{{ total }}</div>
        </div>
      </div>

      <div class="search-bar">
        <el-date-picker
          v-model="query.period"
          type="month"
          value-format="YYYY-MM"
          placeholder="账期"
          clearable
          style="width: 150px"
        />
        <el-select v-model="query.communityId" placeholder="全部小区" clearable>
          <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.feeItemId" placeholder="收费项目" clearable>
          <el-option v-for="item in feeItems" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无欠费数据">
        <el-table-column prop="communityName" label="小区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="buildingName" label="楼栋" width="100">
          <template #default="{ row }">{{ row.buildingName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="110" />
        <el-table-column prop="ownerName" label="业主" width="100">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="联系电话" width="130">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="period" label="账期" width="90" align="center" />
        <el-table-column prop="feeItemName" label="收费项目" min-width="130" show-overflow-tooltip />
        <el-table-column prop="netAmount" label="应收净额" width="120" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.netAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="已收金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount-cell text-success">{{ formatAmount(row.paidAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="arrears" label="欠费金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount-cell text-danger">{{ formatAmount(row.arrears) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="daysOverdue" label="逾期天数" width="100" align="right">
          <template #default="{ row }">{{ row.daysOverdue ?? '-' }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSearch"
          @current-change="loadData"
        />
      </div>
    </div>
  </div>
</template>
