<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { listFundFlows } from '@/api/fund'
import { communityOptions } from '@/api/community'
import { roomOptions } from '@/api/room'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatAmount, formatDateTime, today, shiftPeriod } from '@/utils/format'
import { exportBackend } from '@/utils/export'

const loading = ref(false)
const exporting = ref(false)

const query = reactive({
  roomId: '',
  accountType: '',
  bizType: '',
  from: '',
  to: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const roomSelect = ref([])
const accountTypeOptions = dictOptions('accountType')
const bizTypeOptions = dictOptions('fundBizType')

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadRoomSelect() {
  try {
    roomSelect.value = (await roomOptions({})) || []
  } catch (e) {
    roomSelect.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listFundFlows({ ...query })
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
}

function handleReset() {
  query.roomId = ''
  query.accountType = ''
  query.bizType = ''
  query.from = ''
  query.to = ''
  query.keyword = ''
  handleSearch()
}

async function handleExport() {
  exporting.value = true
  try {
    await exportBackend('fund-flows', { ...query, page: undefined, size: undefined }, '资金流水')
    ElMessage.success('已开始下载资金流水 CSV')
  } catch (e) {
    // 拦截器已提示
  } finally {
    exporting.value = false
  }
}

watch(
  () => query.accountType,
  () => handleSearch()
)

onMounted(async () => {
  const end = today()
  query.from = shiftPeriod(end.slice(0, 7), -2) + '-01'
  query.to = end
  await Promise.all([loadCommunities(), loadRoomSelect()])
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">资金流水</span>
          <span class="page-subtitle">预收 / 押金的每一次变动都留痕，含变动后余额</span>
        </div>
        <el-button :loading="exporting" @click="handleExport">
          <el-icon><Download /></el-icon>
          <span>导出 CSV</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.accountType" placeholder="账户类型" clearable>
          <el-option v-for="item in accountTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.bizType" placeholder="业务类型" clearable>
          <el-option v-for="item in bizTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-date-picker v-model="query.from" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="width: 150px" />
        <el-date-picker v-model="query.to" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="width: 150px" />
        <el-input v-model="query.keyword" placeholder="房号 / 备注" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无资金流水">
        <el-table-column prop="occurredAt" label="发生时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.occurredAt) }}</template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="110" />
        <el-table-column prop="ownerName" label="业主" width="110">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="accountType" label="账户" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('accountType', row.accountType)" size="small" effect="light">
              {{ dictLabel('accountType', row.accountType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="bizType" label="业务类型" min-width="130">
          <template #default="{ row }">{{ dictLabel('fundBizType', row.bizType) }}</template>
        </el-table-column>
        <el-table-column prop="direction" label="方向" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('flowDirection', row.direction)" size="small" effect="plain">
              {{ dictLabel('flowDirection', row.direction) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount-cell" :class="row.direction === 'IN' ? 'text-success' : 'text-danger'">
              {{ formatAmount(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balanceAfter" label="变动后余额" width="130" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.balanceAfter) }}</span></template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100">
          <template #default="{ row }">{{ row.operator || '-' }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
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
