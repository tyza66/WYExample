<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { getCollectionReport } from '@/api/report'
import { communityOptions } from '@/api/community'
import { dayjs, formatAmount, periodEnd, periodStart, currentPeriod } from '@/utils/format'
import { moneyFormatter } from '@/utils/echarts'
import { useChart } from '@/utils/chart'

const loading = ref(false)
const chartRef = ref(null)

const query = reactive({
  from: periodStart(currentPeriod()),
  to: periodEnd(currentPeriod()),
  communityId: '',
  groupBy: 'method'
})

const dateRange = ref([query.from, query.to])

const groupByOptions = [
  { value: 'day', label: '按天' },
  { value: 'month', label: '按月' },
  { value: 'method', label: '按收款方式' },
  { value: 'feeItem', label: '按收费项目' }
]

const communities = ref([])
const report = ref({ totalAmount: 0, totalCount: 0, groups: [] })

const isPie = computed(() => query.groupBy === 'method' || query.groupBy === 'feeItem')

const groups = computed(() => report.value.groups || [])

function shareOf(amount) {
  const total = Number(report.value.totalAmount || 0)
  if (!total) return '0.00%'
  return `${((Number(amount || 0) / total) * 100).toFixed(2)}%`
}

const { render: renderChart } = useChart(chartRef, () => {
  const items = groups.value
  if (items.length === 0) return null

  if (isPie.value) {
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => `${params.name}<br/>金额：${moneyFormatter(params.value)}（${params.percent}%）`
      },
      legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20 },
      series: [
        {
          name: '收款金额',
          type: 'pie',
          radius: ['40%', '68%'],
          center: ['38%', '52%'],
          avoidLabelOverlap: true,
          label: { formatter: '{b}\n{d}%' },
          data: items.map((item) => ({ name: item.label || item.key, value: Number(item.amount || 0) }))
        }
      ]
    }
  }

  return {
    tooltip: { trigger: 'axis', valueFormatter: moneyFormatter },
    grid: { left: 16, right: 24, bottom: 8, top: 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: items.map((item) => item.label || item.key),
      axisLabel: { rotate: items.length > 12 ? 40 : 0 }
    },
    yAxis: {
      type: 'value',
      name: '金额（元）',
      axisLabel: { formatter: (value) => Number(value).toLocaleString('zh-CN') }
    },
    series: [
      {
        name: '收款金额',
        type: 'bar',
        barMaxWidth: 32,
        itemStyle: { color: '#409eff', borderRadius: [3, 3, 0, 0] },
        data: items.map((item) => Number(item.amount || 0))
      }
    ]
  }
})

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await getCollectionReport({
      from: query.from || undefined,
      to: query.to || undefined,
      communityId: query.communityId || undefined,
      groupBy: query.groupBy
    })
    report.value = {
      totalAmount: data?.totalAmount ?? 0,
      totalCount: data?.totalCount ?? 0,
      groups: data?.groups || []
    }
    renderChart()
  } catch (e) {
    report.value = { totalAmount: 0, totalCount: 0, groups: [] }
    renderChart()
  } finally {
    loading.value = false
  }
}

function handleDateRangeChange(value) {
  if (!value || value.length !== 2) return
  query.from = value[0]
  query.to = value[1]
  loadData()
}

function handleReset() {
  query.from = periodStart(currentPeriod())
  query.to = periodEnd(currentPeriod())
  dateRange.value = [query.from, query.to]
  query.communityId = ''
  query.groupBy = 'method'
  loadData()
}

const shortcuts = [
  {
    text: '本月',
    value: () => [dayjs().startOf('month').toDate(), dayjs().endOf('month').toDate()]
  },
  {
    text: '上月',
    value: () => [
      dayjs().subtract(1, 'month').startOf('month').toDate(),
      dayjs().subtract(1, 'month').endOf('month').toDate()
    ]
  },
  {
    text: '近 30 天',
    value: () => [dayjs().subtract(29, 'day').toDate(), dayjs().toDate()]
  }
]

watch(() => query.groupBy, () => loadData())

onMounted(async () => {
  await loadCommunities()
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <span class="page-title">收款汇总</span>
      </div>

      <div class="search-bar">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          :shortcuts="shortcuts"
          style="width: 260px"
          @change="handleDateRangeChange"
        />
        <el-select v-model="query.communityId" placeholder="全部小区" clearable @change="loadData">
          <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-radio-group v-model="query.groupBy">
          <el-radio-button v-for="item in groupByOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </el-radio-button>
        </el-radio-group>
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="loadData">查询</el-button>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(auto-fill, minmax(240px, 1fr))">
        <div class="stat-card is-received">
          <div class="stat-label">收款金额合计（元）</div>
          <div class="stat-value">{{ formatAmount(report.totalAmount) }}</div>
        </div>
        <div class="stat-card is-receivable">
          <div class="stat-label">收款笔数</div>
          <div class="stat-value">{{ report.totalCount ?? 0 }}</div>
        </div>
        <div class="stat-card is-count">
          <div class="stat-label">统计区间</div>
          <div class="stat-value" style="font-size: 16px">
            {{ query.from || '-' }} ~ {{ query.to || '-' }}
          </div>
        </div>
      </div>
    </div>

    <div class="page-card">
      <div class="page-header">
        <span class="page-title">{{ isPie ? '收款占比' : '收款趋势' }}</span>
        <span class="page-subtitle">
          {{
            groupByOptions.find((item) => item.value === query.groupBy)?.label || ''
          }}
        </span>
      </div>
      <div v-show="groups.length > 0" ref="chartRef" class="chart-box"></div>
      <el-empty v-if="groups.length === 0" description="暂无可展示的汇总数据" />
    </div>

    <div class="page-card">
      <div class="page-header">
        <span class="page-title">汇总明细</span>
      </div>
      <el-table v-loading="loading" :data="groups" border stripe empty-text="暂无汇总数据">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="key" label="分组键" min-width="140" show-overflow-tooltip />
        <el-table-column prop="label" label="分组名称" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.label || row.key || '-' }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额（元）" min-width="150" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
        </el-table-column>
        <el-table-column prop="count" label="笔数" width="110" align="right">
          <template #default="{ row }">{{ row.count ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="占比" width="110" align="right">
          <template #default="{ row }">{{ shareOf(row.amount) }}</template>
        </el-table-column>
      </el-table>

      <el-table :data="[report]" border style="margin-top: 12px">
        <el-table-column label="合计金额（元）" align="right">
          <template #default="{ row }">
            <span class="amount-cell text-danger">{{ formatAmount(row.totalAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合计笔数" align="right" width="200">
          <template #default="{ row }">{{ row.totalCount ?? 0 }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
