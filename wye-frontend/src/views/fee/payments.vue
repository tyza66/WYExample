<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createPayment, getPayment, listPayments } from '@/api/payment'
import { listBills } from '@/api/bill'
import { communityOptions } from '@/api/community'
import { roomOptions } from '@/api/room'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatAmount, formatDate, formatDateTime, now } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({
  period: '',
  communityId: '',
  roomId: '',
  method: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const roomSelect = ref([])
const methodOptions = dictOptions('paymentMethod')

// ---------- 登记收款 ----------
const payVisible = ref(false)
const payFormRef = ref(null)
const payForm = reactive({
  communityId: null,
  roomId: null,
  amount: null,
  method: 'CASH',
  paidAt: now(),
  remark: ''
})
const payRules = {
  roomId: [{ required: true, message: '请选择房屋', trigger: 'change' }],
  method: [{ required: true, message: '请选择收款方式', trigger: 'change' }],
  paidAt: [{ required: true, message: '请选择收款时间', trigger: 'change' }],
  amount: [
    {
      required: true,
      validator: (rule, value, callback) => {
        if (value === null || value === undefined || value === '') return callback(new Error('请输入收款金额'))
        if (Number(value) <= 0) return callback(new Error('收款金额必须大于 0'))
        callback()
      },
      trigger: 'blur'
    }
  ]
}
const payRooms = ref([])
const candidateBills = ref([])
const selectedBills = ref([])
const billsLoading = ref(false)

// ---------- 收款结果 ----------
const resultVisible = ref(false)
const payResult = ref(null)

// ---------- 明细抽屉 ----------
const drawerVisible = ref(false)
const drawerLoading = ref(false)
const paymentDetail = ref(null)

const selectedBillSummary = computed(() => {
  const amount = selectedBills.value.reduce((sum, item) => sum + Number(item.arrears || 0), 0)
  return { count: selectedBills.value.length, arrears: amount }
})

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadRoomSelect(keyword) {
  try {
    roomSelect.value = (await roomOptions({ communityId: query.communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    roomSelect.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listPayments({ ...query })
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
  query.period = ''
  query.communityId = ''
  query.roomId = ''
  query.method = ''
  query.keyword = ''
  roomSelect.value = []
  query.page = 1
  loadData()
}

watch(
  () => query.communityId,
  (value) => {
    query.roomId = ''
    loadRoomSelect()
    handleSearch()
  }
)

// ---------- 登记收款逻辑 ----------

/** 弹窗内房屋远程搜索：支持按房号或住户名 */
async function searchPayRooms(keyword) {
  try {
    payRooms.value = (await roomOptions({ communityId: payForm.communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    payRooms.value = []
  }
}

/** 选中房屋后拉取可核销账单（未缴 / 部分缴纳），供"指定账单"用 */
async function loadCandidateBills(roomId) {
  if (!roomId) {
    candidateBills.value = []
    return
  }
  billsLoading.value = true
  try {
    const [unpaid, partial] = await Promise.all([
      listBills({ roomId, status: 'UNPAID', size: 100 }),
      listBills({ roomId, status: 'PARTIAL', size: 100 })
    ])
    candidateBills.value = [...(unpaid?.list || []), ...(partial?.list || [])]
  } catch (e) {
    candidateBills.value = []
  } finally {
    billsLoading.value = false
  }
}

function handleOpenPay() {
  payForm.communityId = query.communityId || null
  payForm.roomId = query.roomId || null
  payForm.amount = null
  payForm.method = 'CASH'
  payForm.paidAt = now()
  payForm.remark = ''
  payRooms.value = roomSelect.value.length ? [...roomSelect.value] : []
  selectedBills.value = []
  candidateBills.value = []
  payVisible.value = true
  payFormRef.value?.clearValidate()
  if (payForm.communityId) searchPayRooms('')
  if (payForm.roomId) loadCandidateBills(payForm.roomId)
}

watch(
  () => payForm.communityId,
  () => {
    payForm.roomId = null
    candidateBills.value = []
    searchPayRooms('')
  }
)

watch(
  () => payForm.roomId,
  (value) => {
    selectedBills.value = []
    loadCandidateBills(value)
  }
)

function handleBillSelectionChange(rows) {
  selectedBills.value = rows
}

async function handlePaySubmit() {
  if (!payFormRef.value) return
  try {
    await payFormRef.value.validate()
  } catch (e) {
    return
  }

  submitting.value = true
  try {
    const data = await createPayment({
      roomId: payForm.roomId,
      amount: Number(payForm.amount),
      method: payForm.method,
      paidAt: payForm.paidAt,
      billIds: selectedBills.value.length ? selectedBills.value.map((item) => item.id) : null,
      remark: payForm.remark || null
    })
    payResult.value = data || null
    payVisible.value = false
    resultVisible.value = true
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    submitting.value = false
  }
}

async function handleViewDetail(row) {
  drawerVisible.value = true
  drawerLoading.value = true
  paymentDetail.value = null
  try {
    paymentDetail.value = await getPayment(row.id)
  } catch (e) {
    paymentDetail.value = null
  } finally {
    drawerLoading.value = false
  }
}

onMounted(async () => {
  await loadCommunities()
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">收款登记与流水</span>
          <span class="page-subtitle">收款按应缴日升序自动核销未结清账单，未用完部分形成预收余额</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenPay">
          <el-icon><Plus /></el-icon>
          <span>登记收款</span>
        </el-button>
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
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.method" placeholder="收款方式" clearable>
          <el-option v-for="item in methodOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="收款单号 / 房号 / 住户" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无收款流水">
        <el-table-column prop="paymentNo" label="收款单号" min-width="160" />
        <el-table-column prop="period" label="账期" width="90" align="center">
          <template #default="{ row }">{{ row.period || '-' }}</template>
        </el-table-column>
        <el-table-column prop="communityName" label="小区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="100">
          <template #default="{ row }">{{ row.roomNo || '-' }}</template>
        </el-table-column>
        <el-table-column prop="ownerName" label="住户" width="100">
          <template #default="{ row }">{{ row.ownerName || row.residentName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="收款金额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount-cell text-success">{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="allocatedAmount" label="已核销" width="120" align="right">
          <template #default="{ row }">
            <span class="amount-cell">{{ formatAmount(row.allocatedAmount ?? row.paidAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="advanceAmount" label="预收余额" width="120" align="right">
          <template #default="{ row }">
            <span class="amount-cell" :class="Number(row.advanceAmount) > 0 ? 'text-danger' : ''">
              {{ formatAmount(row.advanceAmount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="method" label="收款方式" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('paymentMethod', row.method)" size="small" effect="light">
              {{ dictLabel('paymentMethod', row.method) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="paidAt" label="收款时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.paidAt) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="经办人" width="110">
          <template #default="{ row }">{{ row.operator || '-' }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="110" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleViewDetail(row)">查看明细</el-button>
          </template>
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

    <!-- 登记收款 -->
    <el-dialog v-model="payVisible" title="登记收款" width="820px" destroy-on-close top="6vh">
      <el-form ref="payFormRef" :model="payForm" :rules="payRules" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="小区">
              <el-select v-model="payForm.communityId" placeholder="全部小区" clearable filterable style="width: 100%">
                <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房屋" prop="roomId">
              <el-select
                v-model="payForm.roomId"
                placeholder="输入房号或住户名搜索"
                filterable
                remote
                clearable
                :remote-method="searchPayRooms"
                style="width: 100%"
              >
                <el-option v-for="item in payRooms" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="收款金额" prop="amount">
              <el-input-number
                v-model="payForm.amount"
                :min="0.01"
                :max="99999999"
                :precision="2"
                :step="100"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="收款方式" prop="method">
              <el-select v-model="payForm.method" style="width: 100%">
                <el-option v-for="item in methodOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="收款时间" prop="paidAt">
              <el-date-picker
                v-model="payForm.paidAt"
                type="datetime"
                value-format="YYYY-MM-DD HH:mm:ss"
                placeholder="选择收款时间"
                :default-time="new Date(2000, 0, 1, 0, 0, 0)"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="备注">
              <el-input v-model="payForm.remark" maxlength="255" placeholder="例：3 月物业费" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="指定账单">
          <div style="width: 100%">
            <div class="form-tip" style="margin-bottom: 6px">
              不勾选则按规则自动核销（应缴日升序）；勾选后只核销指定账单，顺序按勾选顺序。
              <span v-if="selectedBillSummary.count > 0">
                已选 {{ selectedBillSummary.count }} 张，欠费合计
                <b>{{ formatAmount(selectedBillSummary.arrears) }}</b> 元。
              </span>
            </div>
            <el-table
              v-loading="billsLoading"
              :data="candidateBills"
              border
              size="small"
              max-height="240"
              empty-text="请先选择房屋（该房屋暂无未结清账单）"
              @selection-change="handleBillSelectionChange"
            >
              <el-table-column type="selection" width="46" />
              <el-table-column prop="billNo" label="账单号" min-width="150" />
              <el-table-column prop="period" label="账期" width="90" align="center" />
              <el-table-column prop="feeItemName" label="收费项目" min-width="120" show-overflow-tooltip />
              <el-table-column prop="netAmount" label="应收净额" width="110" align="right">
                <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.netAmount) }}</span></template>
              </el-table-column>
              <el-table-column prop="paidAmount" label="已收" width="100" align="right">
                <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.paidAmount) }}</span></template>
              </el-table-column>
              <el-table-column prop="arrears" label="欠费" width="100" align="right">
                <template #default="{ row }">
                  <span class="amount-cell text-danger">{{ formatAmount(row.arrears) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="dueDate" label="应缴日" width="110" align="center">
                <template #default="{ row }">{{ formatDate(row.dueDate) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="payVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handlePaySubmit">确认收款</el-button>
      </template>
    </el-dialog>

    <!-- 收款结果（核销明细 + 预收余额） -->
    <el-dialog v-model="resultVisible" title="收款成功" width="680px">
      <template v-if="payResult">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="收款单号">{{ payResult.paymentNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="收款金额">
            <span class="amount-cell">{{ formatAmount(payResult.amount) }} 元</span>
          </el-descriptions-item>
          <el-descriptions-item label="本次核销">
            <span class="amount-cell text-success">{{ formatAmount(payResult.allocatedAmount) }} 元</span>
          </el-descriptions-item>
          <el-descriptions-item label="形成预收余额">
            <span class="amount-cell" :class="Number(payResult.advanceAmount) > 0 ? 'text-danger' : ''">
              {{ formatAmount(payResult.advanceAmount) }} 元
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="房屋剩余欠费">
            <span class="amount-cell">{{ formatAmount(payResult.roomArrearsAfter) }} 元</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-alert
          v-if="Number(payResult.advanceAmount) > 0"
          type="warning"
          :closable="false"
          show-icon
          style="margin: 12px 0"
          :title="`预收余额 ${formatAmount(payResult.advanceAmount)} 元已挂在该房屋上，后续生成账单可继续核销`"
        />

        <div class="page-title" style="margin: 12px 0 8px">核销明细</div>
        <el-table :data="payResult.allocations || []" border size="small" empty-text="本次收款没有核销任何账单">
          <el-table-column type="index" label="序号" width="70" align="center" />
          <el-table-column prop="billNo" label="账单号" min-width="150" />
          <el-table-column prop="period" label="账期" width="90" align="center" />
          <el-table-column prop="amount" label="核销金额（元）" min-width="130" align="right">
            <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
          </el-table-column>
        </el-table>
      </template>

      <template #footer>
        <el-button type="primary" @click="resultVisible = false">知道了</el-button>
      </template>
    </el-dialog>

    <!-- 收款明细抽屉 -->
    <el-drawer v-model="drawerVisible" title="收款单明细" size="620px">
      <div v-loading="drawerLoading">
        <template v-if="paymentDetail">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="收款单号">{{ paymentDetail.paymentNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="小区 / 房号">
              {{ paymentDetail.communityName || '-' }} / {{ paymentDetail.roomNo || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="住户">
              {{ paymentDetail.ownerName || paymentDetail.residentName || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="收款金额">
              <span class="amount-cell">{{ formatAmount(paymentDetail.amount) }} 元</span>
            </el-descriptions-item>
            <el-descriptions-item label="收款方式">
              <el-tag :type="dictTag('paymentMethod', paymentDetail.method)" size="small" effect="light">
                {{ dictLabel('paymentMethod', paymentDetail.method) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="收款时间">{{ formatDateTime(paymentDetail.paidAt) }}</el-descriptions-item>
            <el-descriptions-item label="经办人">{{ paymentDetail.operator || '-' }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ paymentDetail.remark || '-' }}</el-descriptions-item>
          </el-descriptions>

          <div class="page-title" style="margin: 16px 0 8px">核销明细</div>
          <el-table
            :data="paymentDetail.allocations || []"
            border
            size="small"
            empty-text="该收款单未核销任何账单（全部为预收）"
          >
            <el-table-column type="index" label="序号" width="70" align="center" />
            <el-table-column prop="billNo" label="账单号" min-width="150" />
            <el-table-column prop="period" label="账期" width="90" align="center" />
            <el-table-column prop="amount" label="核销金额（元）" min-width="130" align="right">
              <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
            </el-table-column>
          </el-table>
        </template>
        <el-empty v-else-if="!drawerLoading" description="未获取到收款单明细" />
      </div>
    </el-drawer>
  </div>
</template>
