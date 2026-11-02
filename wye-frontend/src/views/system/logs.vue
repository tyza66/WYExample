<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { listLogs } from '@/api/log'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)

const query = reactive({
  username: '',
  module: '',
  from: '',
  to: '',
  page: 1,
  size: 10
})

const dateRange = ref([])
const list = ref([])
const total = ref(0)

async function loadData() {
  loading.value = true
  try {
    const data = await listLogs({ ...query })
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
  query.username = ''
  query.module = ''
  query.from = ''
  query.to = ''
  dateRange.value = []
  query.page = 1
  loadData()
}

watch(dateRange, (value) => {
  if (value && value.length === 2) {
    query.from = value[0]
    query.to = value[1]
  } else {
    query.from = ''
    query.to = ''
  }
})

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">操作日志</span>
          <span class="page-subtitle">写操作留痕：模块、动作、对象、摘要、操作人、IP</span>
        </div>
      </div>

      <div class="search-bar">
        <el-input v-model="query.username" placeholder="操作人" clearable @keyup.enter="handleSearch" />
        <el-input v-model="query.module" placeholder="模块（如：账单）" clearable @keyup.enter="handleSearch" />
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 260px"
        />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无操作日志">
        <el-table-column prop="id" label="ID" width="80" align="center" />
        <el-table-column prop="username" label="操作人" width="120">
          <template #default="{ row }">{{ row.username || '-' }}</template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.module || '-' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="动作" width="110">
          <template #default="{ row }">{{ row.action || '-' }}</template>
        </el-table-column>
        <el-table-column prop="target" label="对象" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.target || '-' }}</template>
        </el-table-column>
        <el-table-column prop="detail" label="变更摘要" min-width="260" show-overflow-tooltip>
          <template #default="{ row }">{{ row.detail || '-' }}</template>
        </el-table-column>
        <el-table-column prop="ip" label="来源 IP" width="140">
          <template #default="{ row }">{{ row.ip || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="操作时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
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
