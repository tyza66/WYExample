<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { getDashboardSummary } from '@/api/dashboard'
import { communityOptions } from '@/api/community'
import { currentPeriod, formatAmount, formatRate } from '@/utils/format'
import { moneyFormatter } from '@/utils/echarts'
import { useChart } from '@/utils/chart'

const loading = ref(false)
const chartRef = ref(null)

const query = reactive({
  period: currentPeriod(),
  communityId: ''
})

const summary = ref({
  period: '',
  communityCount: 0,
  buildingCount: 0,
  roomCount: 0,
  residentCount: 0,
  receivable: 0,
  received: 0,
  arrears: 0,
  collectionRate: 0,
  unpaidRoomCount: 0,
  advanceTotal: 0,
  trend: [],
  topArrears: []
})

const communities = ref([])

const cards = computed(() => [
  { label: '本期应收', value: formatAmount(summary.value.receivable), className: 'is-receivable' },
  { label: '本期实收', value: formatAmount(summary.value.received), className: 'is-received' },
  { label: '欠费金额', value: formatAmount(summary.value.arrears), className: 'is-arrears' },
  { label: '收缴率', value: formatRate(summary.value.collectionRate), className: 'is-rate' },
  { label: '未缴户数', value: `${summary.value.unpaidRoomCount ?? 0} 户`, className: 'is-count' },
  { label: '预收余额', value: formatAmount(summary.value.advanceTotal), className: 'is-advance' }
])

const baseInfo = computed(() => [
  { label: '小区数', value: summary.value.communityCount ?? 0 },
  { label: '楼栋数', value: summary.value.buildingCount ?? 0 },
  { label: '房屋数', value: summary.value.roomCount ?? 0 },
  { label: '住户数', value: summary.value.residentCount ?? 0 }
])

const { render: renderChart } = useChart(chartRef, () => {
  const trend = summary.value.trend || []
  if (trend.length === 0) return null
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: moneyFormatter
    },
    legend: { data: ['应收', '实收'], right: 10, top: 0 },
    grid: { left: 16, right: 24, bottom: 8, top: 44, containLabel: true },
    xAxis: {
      type: 'category',
      data: trend.map((item) => item.period),
      axisTick: { alignWithLabel: true }
    },
    yAxis: {
      type: 'value',
      name: '金额（元）',
      axisLabel: { formatter: (value) => Number(value).toLocaleString('zh-CN') }
    },
    series: [
      {
        name: '应收',
        type: 'bar',
        barMaxWidth: 28,
        itemStyle: { color: '#409eff', borderRadius: [3, 3, 0, 0] },
        data: trend.map((item) => Number(item.receivable ?? 0))
      },
      {
        name: '实收',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: '#67c23a' },
        itemStyle: { color: '#67c23a' },
        data: trend.map((item) => Number(item.received ?? 0))
      }
    ]
  }
})

async function loadData() {
  loading.value = true
  try {
    const data = await getDashboardSummary({
      period: query.period,
      communityId: query.communityId || undefined
    })
    summary.value = { ...summary.value, ...(data || {}) }
    renderChart()
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    loading.value = false
  }
}

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

function handleReset() {
  query.period = currentPeriod()
  query.communityId = ''
  loadData()
}

onMounted(async () => {
  await loadCommunities()
  await loadData()
})
</script>

<template>
  <div class="page-container" v-loading="loading">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">工作台</span>
          <span class="page-subtitle">数据口径与账单列表一致，均以后端返回为准</span>
        </div>
        <div class="search-actions">
          <el-date-picker
            v-model="query.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择账期"
            :clearable="false"
            style="width: 150px"
            @change="loadData"
          />
          <el-select
            v-model="query.communityId"
            placeholder="全部小区"
            clearable
            style="width: 160px"
            @change="loadData"
          >
            <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="loadData">查询</el-button>
        </div>
      </div>

      <div class="stat-grid">
        <div v-for="card in cards" :key="card.label" class="stat-card" :class="card.className">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value">{{ card.value }}</div>
        </div>
      </div>

      <el-descriptions :column="4" border size="small" style="margin-top: 4px">
        <el-descriptions-item v-for="item in baseInfo" :key="item.label" :label="item.label">
          {{ item.value }}
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <div class="page-card">
      <div class="page-header">
        <span class="page-title">应收 / 实收趋势</span>
        <span class="page-subtitle">账期：{{ summary.period || query.period }}</span>
      </div>
      <div v-show="(summary.trend || []).length > 0" ref="chartRef" class="chart-box"></div>
      <el-empty v-if="(summary.trend || []).length === 0" description="暂无趋势数据" />
    </div>

    <div class="page-card">
      <div class="page-header">
        <span class="page-title">欠费 TOP</span>
      </div>
      <el-table :data="summary.topArrears || []" border stripe empty-text="暂无欠费数据">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="roomNo" label="房号" min-width="120" />
        <el-table-column prop="ownerName" label="业主" min-width="120">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="欠费金额（元）" min-width="150" align="right">
          <template #default="{ row }">
            <span class="amount-cell text-danger">{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
