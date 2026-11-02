<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatAmount, formatDateTime } from '@/utils/format'

const router = useRouter()
const order = ref(null)
const result = ref(null)
const amount = ref(0)
const room = ref(null)

function goHome() {
  router.replace('/portal/home')
}

onMounted(() => {
  try {
    const raw = localStorage.getItem('wye_portal_last_order')
    const data = raw ? JSON.parse(raw) : null
    if (data) {
      order.value = data.order
      result.value = data.result
      amount.value = data.amount
      room.value = data.room
    }
  } catch (e) {
    // 忽略解析失败
  }
})
</script>

<template>
  <div class="portal-success">
    <div class="portal-success__card">
      <div class="portal-success__icon">✓</div>
      <div class="portal-success__title">支付成功</div>
      <div class="portal-success__amount">￥{{ formatAmount(amount || order?.amount) }}</div>

      <div class="portal-success__info">
        <div class="row"><span>房号</span><span>{{ room?.roomNo || '-' }}</span></div>
        <div class="row"><span>支付单号</span><span>{{ order?.orderNo || '-' }}</span></div>
        <div class="row"><span>支付方式</span><span>在线支付（模拟）</span></div>
        <div class="row">
          <span>核销账单</span>
          <span>{{ result?.allocations?.length ?? 0 }} 张</span>
        </div>
        <div class="row"><span>支付时间</span><span>{{ formatDateTime(new Date()) }}</span></div>
      </div>

      <el-table v-if="result?.allocations?.length" :data="result.allocations" size="small" border style="margin-top: 14px">
        <el-table-column prop="billNo" label="账单号" min-width="140" />
        <el-table-column prop="period" label="账期" width="80" align="center" />
        <el-table-column prop="amount" label="核销金额" width="110" align="right">
          <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
        </el-table-column>
      </el-table>

      <el-button type="primary" size="large" style="width: 100%; margin-top: 18px" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<style scoped>
.portal-success {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 24px 16px;
  display: flex;
  justify-content: center;
}

.portal-success__card {
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-radius: 12px;
  padding: 28px 20px 22px;
  text-align: center;
  height: fit-content;
}

.portal-success__icon {
  width: 64px;
  height: 64px;
  margin: 0 auto;
  border-radius: 50%;
  background: #67c23a;
  color: #fff;
  font-size: 32px;
  line-height: 64px;
}

.portal-success__title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-top: 14px;
}

.portal-success__amount {
  font-size: 30px;
  font-weight: 700;
  color: #f56c6c;
  margin-top: 8px;
  font-variant-numeric: tabular-nums;
}

.portal-success__info {
  margin-top: 18px;
  border-top: 1px dashed #e4e7ed;
  padding-top: 12px;
  text-align: left;
  font-size: 13px;
  color: #606266;
}

.portal-success__info .row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  gap: 12px;
}

.portal-success__info .row span:last-child {
  color: #303133;
  word-break: break-all;
  text-align: right;
}
</style>
