<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  clearPortalAuth,
  createPortalOrder,
  payPortalOrder,
  portalBills,
  portalPayments,
  portalSummary,
  readPortalRoom
} from '@/api/portal'
import { dictLabel, dictTag } from '@/utils/dict'
import { formatAmount, formatDate, formatDateTime } from '@/utils/format'

const router = useRouter()

const room = ref(readPortalRoom())
const loading = ref(false)
const summary = ref(null)
const bills = ref([])
const payments = ref([])
const activeTab = ref('bills')
const selected = ref([])
const paying = ref(false)

const payableBills = computed(() => bills.value.filter((bill) => ['UNPAID', 'PARTIAL'].includes(bill.status) && Number(bill.arrears) > 0))
const selectedAmount = computed(() => selected.value.reduce((sum, bill) => sum + Number(bill.arrears || 0), 0))

async function loadAll() {
  loading.value = true
  try {
    const [summaryData, billData, paymentData] = await Promise.all([
      portalSummary(),
      portalBills({ size: 100 }),
      portalPayments({ size: 100 })
    ])
    summary.value = summaryData || null
    bills.value = billData?.list || billData || []
    payments.value = paymentData?.list || paymentData || []
  } catch (e) {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

function handleSelectionChange(rows) {
  selected.value = rows
}

async function handlePay() {
  if (!selected.value.length) {
    ElMessage.warning('请先勾选要缴费的账单')
    return
  }
  try {
    await ElMessageBox.confirm(`本次需支付 ${formatAmount(selectedAmount.value)} 元，确认创建支付单？`, '在线缴费', {
      type: 'info',
      confirmButtonText: '去支付',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  paying.value = true
  try {
    const order = await createPortalOrder({ billIds: selected.value.map((bill) => bill.id) })
    const result = await payPortalOrder(order.orderNo)
    localStorage.setItem(
      'wye_portal_last_order',
      JSON.stringify({ order, result, amount: selectedAmount.value, room: room.value })
    )
    ElMessage.success('支付成功')
    router.push('/portal/success')
  } catch (e) {
    // 拦截器已提示
  } finally {
    paying.value = false
  }
}

async function handleLogout() {
  clearPortalAuth()
  router.replace('/portal/login')
}

onMounted(() => {
  if (!room.value) {
    router.replace('/portal/login')
    return
  }
  loadAll()
})
</script>

<template>
  <div class="portal">
    <div class="portal__header">
      <div>
        <div class="portal__hello">您好，{{ room?.ownerName || '业主' }}</div>
        <div class="portal__room">{{ room?.communityName || '' }} {{ room?.roomNo || '' }}</div>
      </div>
      <el-button link type="primary" @click="handleLogout">退出</el-button>
    </div>

    <div class="portal__body" v-loading="loading">
      <div class="portal__summary">
        <div class="portal__summary-item">
          <div class="label">待缴金额（元）</div>
          <div class="value is-danger">{{ formatAmount(summary?.arrears ?? summary?.totalArrears) }}</div>
        </div>
        <div class="portal__summary-item">
          <div class="label">待缴账单</div>
          <div class="value">{{ summary?.unpaidCount ?? summary?.billCount ?? payableBills.length }}</div>
        </div>
        <div class="portal__summary-item">
          <div class="label">预收余额（元）</div>
          <div class="value is-success">{{ formatAmount(summary?.advanceBalance) }}</div>
        </div>
      </div>

      <el-tabs v-model="activeTab" stretch>
        <el-tab-pane label="我的账单" name="bills">
          <div v-if="payableBills.length" class="portal__tip">勾选账单后可在线缴费</div>
          <el-table
            :data="bills"
            size="small"
            empty-text="暂无账单"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="42" :selectable="(row) => ['UNPAID', 'PARTIAL'].includes(row.status) && Number(row.arrears) > 0" />
            <el-table-column label="账单" min-width="150">
              <template #default="{ row }">
                <div class="portal__bill-title">{{ row.feeItemName }}</div>
                <div class="portal__bill-sub">{{ row.period }} · {{ row.billNo }}</div>
              </template>
            </el-table-column>
            <el-table-column label="欠费" width="100" align="right">
              <template #default="{ row }">
                <span class="amount-cell" :class="Number(row.arrears) > 0 ? 'text-danger' : ''">
                  {{ formatAmount(row.arrears) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-tag :type="dictTag('billStatus', row.status)" size="small" effect="light">
                  {{ dictLabel('billStatus', row.status) }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="缴费记录" name="payments">
          <el-table :data="payments" size="small" empty-text="暂无缴费记录">
            <el-table-column label="收款单" min-width="150">
              <template #default="{ row }">
                <div class="portal__bill-title">{{ formatAmount(row.amount) }} 元</div>
                <div class="portal__bill-sub">{{ row.paymentNo }}</div>
              </template>
            </el-table-column>
            <el-table-column label="方式" width="90" align="center">
              <template #default="{ row }">{{ dictLabel('paymentMethod', row.method) }}</template>
            </el-table-column>
            <el-table-column label="时间" width="150" align="center">
              <template #default="{ row }">{{ formatDateTime(row.paidAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-if="activeTab === 'bills'" class="portal__footer">
      <div class="portal__footer-amount">
        已选 {{ selected.length }} 张，合计
        <b>{{ formatAmount(selectedAmount) }}</b> 元
      </div>
      <el-button type="primary" size="large" :loading="paying" :disabled="!selected.length" @click="handlePay">
        在线缴费
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.portal {
  min-height: 100vh;
  background: #f0f2f5;
  padding-bottom: 88px;
  max-width: 640px;
  margin: 0 auto;
}

.portal__header {
  background: linear-gradient(135deg, #409eff, #2c6fd1);
  color: #fff;
  padding: 20px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.portal__header :deep(.el-button) {
  color: #fff;
}

.portal__hello {
  font-size: 18px;
  font-weight: 600;
}

.portal__room {
  font-size: 13px;
  opacity: 0.9;
  margin-top: 4px;
}

.portal__body {
  padding: 12px;
}

.portal__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: #fff;
  border-radius: 10px;
  padding: 14px 8px;
  margin-bottom: 10px;
}

.portal__summary-item {
  text-align: center;
}

.portal__summary-item .label {
  font-size: 12px;
  color: #909399;
}

.portal__summary-item .value {
  font-size: 18px;
  font-weight: 600;
  margin-top: 6px;
  font-variant-numeric: tabular-nums;
}

.portal__summary-item .value.is-danger {
  color: #f56c6c;
}

.portal__summary-item .value.is-success {
  color: #67c23a;
}

.portal__tip {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.portal__bill-title {
  font-size: 14px;
  color: #303133;
}

.portal__bill-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.portal__footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: 640px;
  margin: 0 auto;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.portal__footer-amount {
  font-size: 13px;
  color: #606266;
}

.portal__footer-amount b {
  color: #f56c6c;
  font-size: 16px;
}

:deep(.el-tabs__header) {
  background: #fff;
  border-radius: 10px 10px 0 0;
  margin-bottom: 0;
  padding: 0 8px;
}

:deep(.el-tabs__content) {
  background: #fff;
  border-radius: 0 0 10px 10px;
  padding: 10px;
}
</style>
