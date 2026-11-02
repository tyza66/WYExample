<script setup>
import { computed, onMounted, ref } from 'vue'
import { getDailyClose } from '@/api/report'
import { dictLabel, dictTag } from '@/utils/dict'
import { dayjs, formatAmount, formatDateTime, today } from '@/utils/format'

const loading = ref(false)
const date = ref(today())
const raw = ref(null)

/** 兼容后端可能返回 items / groups 两种明细字段名 */
const rows = computed(() => {
  const data = raw.value
  if (!data) return []
  const items = data.items || data.groups || data.methods || []
  return items.map((item) => ({
    method: item.method ?? item.key ?? '',
    label: item.label || dictLabel('paymentMethod', item.method ?? item.key),
    amount: Number(item.amount ?? 0),
    count: Number(item.count ?? item.countNum ?? 0)
  }))
})

const totalAmount = computed(() => {
  if (raw.value && raw.value.totalAmount !== undefined && raw.value.totalAmount !== null) {
    return Number(raw.value.totalAmount)
  }
  return rows.value.reduce((sum, item) => sum + item.amount, 0)
})

const totalCount = computed(() => {
  if (raw.value && raw.value.totalCount !== undefined && raw.value.totalCount !== null) {
    return Number(raw.value.totalCount)
  }
  return rows.value.reduce((sum, item) => sum + item.count, 0)
})

const printedAt = ref(formatDateTime(new Date()))

async function loadData() {
  loading.value = true
  printedAt.value = formatDateTime(new Date())
  try {
    raw.value = await getDailyClose({ date: date.value })
  } catch (e) {
    raw.value = null
  } finally {
    loading.value = false
  }
}

function handlePrint() {
  window.print()
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="no-print page-card">
      <div class="page-header">
        <div>
          <span class="page-title">日结</span>
          <span class="page-subtitle">按日期统计各收款方式的金额、笔数与合计</span>
        </div>
        <div class="table-actions">
          <el-date-picker
            v-model="date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            :clearable="false"
            style="width: 160px"
            @change="loadData"
          />
          <el-button type="primary" :loading="loading" @click="loadData">查询</el-button>
          <el-button @click="handlePrint">
            <el-icon><Printer /></el-icon>
            <span>打印</span>
          </el-button>
        </div>
      </div>
    </div>

    <div class="page-card print-area" v-loading="loading">
      <div class="print-header print-only">
        <h2>WYE 物业收费日结表</h2>
      </div>

      <div class="page-header">
        <span class="page-title">收款日结表</span>
        <span class="page-subtitle">
          日期：{{ date }} ｜ 打印时间：{{ printedAt }} ｜ 星期{{ '日一二三四五六'[dayjs(date).day()] }}
        </span>
      </div>

      <el-table :data="rows" border stripe empty-text="当日没有收款记录">
        <el-table-column type="index" label="序号" width="70" align="center" />
        <el-table-column prop="method" label="收款方式编码" min-width="140">
          <template #default="{ row }">{{ row.method || '-' }}</template>
        </el-table-column>
        <el-table-column prop="label" label="收款方式" min-width="140">
          <template #default="{ row }">
            <el-tag :type="dictTag('paymentMethod', row.method)" size="small" effect="light">
              {{ row.label || '-' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="count" label="笔数" width="120" align="right">
          <template #default="{ row }">{{ row.count ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额（元）" min-width="160" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
        </el-table-column>
      </el-table>

      <div class="daily-total">
        <span>合计笔数：<b>{{ totalCount ?? 0 }}</b></span>
        <span>
          合计金额：<b class="text-danger">{{ formatAmount(totalAmount) }}</b> 元
        </span>
      </div>

      <div class="print-footer print-only">
        <div class="print-sign">
          <span>交款人签字：____________________</span>
          <span>收款人签字：____________________</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.daily-total {
  display: flex;
  justify-content: flex-end;
  gap: 32px;
  margin-top: 16px;
  font-size: 15px;
}

.print-only {
  display: none;
}

.print-header h2 {
  text-align: center;
  margin: 0 0 12px;
}

.print-sign {
  display: flex;
  justify-content: space-between;
  margin-top: 48px;
  font-size: 13px;
}

@media print {
  .print-only {
    display: block !important;
  }

  .daily-total {
    margin-top: 10px;
    font-size: 13px;
  }
}
</style>
