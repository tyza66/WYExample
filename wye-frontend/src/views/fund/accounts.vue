<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { communityOptions } from '@/api/community'
import { buildingOptions } from '@/api/building'
import { roomOptions } from '@/api/room'
import { listBills } from '@/api/bill'
import { deposit, getAccount, listAccounts, listApprovals, refund, useAdvance } from '@/api/fund'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatAmount, formatDate, formatDateTime, now } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({
  communityId: '',
  buildingId: '',
  roomId: '',
  keyword: '',
  nonzero: false,
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const buildings = ref([])
const roomSelect = ref([])
const methodOptions = dictOptions('paymentMethod').filter((item) => item.value !== 'ONLINE')

// ---------- 收押金 ----------
const depositVisible = ref(false)
const depositFormRef = ref(null)
const depositForm = reactive({ roomId: null, amount: null, method: 'CASH', paidAt: now(), remark: '' })
const depositRules = {
  roomId: [{ required: true, message: '请选择房屋', trigger: 'change' }],
  amount: [{ required: true, message: '请输入押金金额', trigger: 'blur' }],
  method: [{ required: true, message: '请选择收款方式', trigger: 'change' }]
}
const depositRooms = ref([])

// ---------- 预收抵扣 ----------
const useVisible = ref(false)
const useFormRef = ref(null)
const useForm = reactive({ roomId: null, accountType: 'ADVANCE', amount: null, remark: '' })
const useBills = ref([])
const useSelected = ref([])
const useBillsLoading = ref(false)
const useRooms = ref([])
const useResult = ref(null)

// ---------- 申请退款 ----------
const refundVisible = ref(false)
const refundFormRef = ref(null)
const refundForm = reactive({ roomId: null, accountType: 'ADVANCE', amount: null, method: 'BANK_TRANSFER', remark: '', approvalNo: '' })
const refundRules = {
  roomId: [{ required: true, message: '请选择房屋', trigger: 'change' }],
  amount: [{ required: true, message: '请输入退款金额', trigger: 'blur' }],
  approvalNo: [{ required: true, message: '退款必须选择已通过的审批单', trigger: 'change' }]
}
const refundRooms = ref([])
const refundApprovals = ref([])

// ---------- 账户明细 ----------
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadBuildings(communityId, target) {
  if (!communityId) {
    target.value = []
    return
  }
  try {
    target.value = (await buildingOptions(communityId)) || []
  } catch (e) {
    target.value = []
  }
}

async function loadRoomSelect() {
  try {
    roomSelect.value = (await roomOptions({ communityId: query.communityId || undefined })) || []
  } catch (e) {
    roomSelect.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listAccounts({ ...query })
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
  query.communityId = ''
  query.buildingId = ''
  query.roomId = ''
  query.keyword = ''
  query.nonzero = false
  buildings.value = []
  roomSelect.value = []
  handleSearch()
}

watch(
  () => query.communityId,
  (value) => {
    query.buildingId = ''
    query.roomId = ''
    loadBuildings(value, buildings)
    loadRoomSelect()
    handleSearch()
  }
)
watch(
  () => query.buildingId,
  (value) => {
    query.roomId = ''
    loadRoomSelect()
    handleSearch()
  }
)
watch(() => query.nonzero, handleSearch)

// ---------- 收押金 ----------
async function searchDepositRooms(keyword) {
  try {
    depositRooms.value = (await roomOptions({ communityId: query.communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    depositRooms.value = []
  }
}

function handleOpenDeposit(row) {
  Object.assign(depositForm, {
    roomId: row?.roomId || null,
    amount: null,
    method: 'CASH',
    paidAt: now(),
    remark: ''
  })
  searchDepositRooms('')
  depositVisible.value = true
  depositFormRef.value?.clearValidate()
}

async function handleDepositSubmit() {
  if (!depositFormRef.value) return
  try {
    await depositFormRef.value.validate()
  } catch (e) {
    return
  }
  submitting.value = true
  try {
    await deposit(depositForm)
    ElMessage.success('押金收取成功')
    depositVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------- 预收抵扣 ----------
async function searchUseRooms(keyword) {
  try {
    useRooms.value = (await roomOptions({ communityId: query.communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    useRooms.value = []
  }
}

async function loadUseBills(roomId) {
  if (!roomId) {
    useBills.value = []
    return
  }
  useBillsLoading.value = true
  try {
    const data = await listBills({ roomId, size: 100 })
    useBills.value = (data?.list || []).filter((bill) => ['UNPAID', 'PARTIAL'].includes(bill.status) && Number(bill.arrears) > 0)
  } catch (e) {
    useBills.value = []
  } finally {
    useBillsLoading.value = false
  }
}

function handleOpenUse(row) {
  Object.assign(useForm, { roomId: row?.roomId || null, accountType: 'ADVANCE', amount: null, remark: '' })
  useSelected.value = []
  useResult.value = null
  searchUseRooms('')
  loadUseBills(useForm.roomId)
  useVisible.value = true
}

watch(() => useForm.roomId, (value) => { useSelected.value = []; loadUseBills(value) })

async function handleUseSubmit() {
  if (!useForm.roomId) {
    ElMessage.warning('请选择房屋')
    return
  }
  submitting.value = true
  try {
    const data = await useAdvance({
      roomId: useForm.roomId,
      amount: useForm.amount ? Number(useForm.amount) : null,
      billIds: useSelected.value.length ? useSelected.value.map((item) => item.id) : null,
      remark: useForm.remark || null
    })
    useResult.value = data || null
    ElMessage.success(`抵扣成功，已抵扣 ${formatAmount(data?.usedAmount)} 元`)
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------- 申请退款 ----------
async function searchRefundRooms(keyword) {
  try {
    refundRooms.value = (await roomOptions({ communityId: query.communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    refundRooms.value = []
  }
}

async function loadRefundApprovals(roomId, accountType) {
  refundForm.approvalNo = ''
  if (!roomId) {
    refundApprovals.value = []
    return
  }
  try {
    const data = await listApprovals({ roomId, status: 'APPROVED', size: 100 })
    const wanted = accountType === 'DEPOSIT' ? 'DEPOSIT_REFUND' : 'ADVANCE_REFUND'
    refundApprovals.value = (data?.list || []).filter((item) => item.type === wanted)
  } catch (e) {
    refundApprovals.value = []
  }
}

function handleOpenRefund(row) {
  Object.assign(refundForm, {
    roomId: row?.roomId || null,
    accountType: 'ADVANCE',
    amount: null,
    method: 'BANK_TRANSFER',
    remark: '',
    approvalNo: ''
  })
  searchRefundRooms('')
  loadRefundApprovals(refundForm.roomId, refundForm.accountType)
  refundVisible.value = true
  refundFormRef.value?.clearValidate()
}

watch(() => refundForm.roomId, (value) => loadRefundApprovals(value, refundForm.accountType))
watch(() => refundForm.accountType, (value) => loadRefundApprovals(refundForm.roomId, value))

async function handleRefundSubmit() {
  if (!refundFormRef.value) return
  try {
    await refundFormRef.value.validate()
  } catch (e) {
    return
  }
  submitting.value = true
  try {
    await refund({
      roomId: refundForm.roomId,
      accountType: refundForm.accountType,
      amount: Number(refundForm.amount),
      method: refundForm.method,
      remark: refundForm.remark || null,
      approvalNo: refundForm.approvalNo
    })
    ElMessage.success('退款成功')
    refundVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------- 明细 ----------
async function handleViewDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getAccount(row.roomId)
  } catch (e) {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCommunities()])
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">资金账户</span>
          <span class="page-subtitle">房屋维度的预收 / 押金余额与欠费；余额只能由资金流水推导</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenDeposit(null)">
          <el-icon><Plus /></el-icon>
          <span>收押金</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.communityId" placeholder="全部小区" clearable>
          <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.buildingId" placeholder="全部楼栋" clearable :disabled="!query.communityId">
          <el-option v-for="item in buildings" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="房号 / 业主" clearable @keyup.enter="handleSearch" />
        <el-checkbox v-model="query.nonzero" label="仅看有余额或欠费" border />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无资金账户数据">
        <el-table-column prop="roomNo" label="房号" width="110" fixed="left" />
        <el-table-column prop="communityName" label="小区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="buildingName" label="楼栋" width="100">
          <template #default="{ row }">{{ row.buildingName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="ownerName" label="业主" width="110">
          <template #default="{ row }">{{ row.ownerName || '未登记' }}</template>
        </el-table-column>
        <el-table-column prop="advanceBalance" label="预收余额" width="130" align="right">
          <template #default="{ row }">
            <span class="amount-cell text-success">{{ formatAmount(row.advanceBalance) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="depositBalance" label="押金余额" width="130" align="right">
          <template #default="{ row }">
            <span class="amount-cell">{{ formatAmount(row.depositBalance) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="arrears" label="欠费" width="130" align="right">
          <template #default="{ row }">
            <span class="amount-cell" :class="Number(row.arrears) > 0 ? 'text-danger' : ''">
              {{ formatAmount(row.arrears) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" size="small" @click="handleViewDetail(row)">明细</el-button>
              <el-button v-if="userStore.canWrite" link type="primary" size="small" @click="handleOpenUse(row)">
                预收抵扣
              </el-button>
              <el-button v-if="userStore.isAdmin" link type="warning" size="small" @click="handleOpenRefund(row)">
                申请退款
              </el-button>
            </div>
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

    <!-- 收押金 -->
    <el-dialog v-model="depositVisible" title="收取押金" width="520px" destroy-on-close>
      <el-form ref="depositFormRef" :model="depositForm" :rules="depositRules" label-width="100px">
        <el-form-item label="房屋" prop="roomId">
          <el-select v-model="depositForm.roomId" placeholder="输入房号搜索" filterable remote clearable :remote-method="searchDepositRooms" style="width: 100%">
            <el-option v-for="item in depositRooms" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="押金金额" prop="amount">
          <el-input-number v-model="depositForm.amount" :min="0.01" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收款方式" prop="method">
          <el-select v-model="depositForm.method" style="width: 100%">
            <el-option v-for="item in methodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款时间">
          <el-date-picker v-model="depositForm.paidAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="depositForm.remark" type="textarea" :rows="2" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="depositVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleDepositSubmit">确认收取</el-button>
      </template>
    </el-dialog>

    <!-- 预收抵扣 -->
    <el-dialog v-model="useVisible" title="预收抵扣" width="760px" destroy-on-close top="6vh">
      <el-form ref="useFormRef" :model="useForm" label-width="100px">
        <el-form-item label="房屋">
          <el-select v-model="useForm.roomId" placeholder="输入房号搜索" filterable remote clearable :remote-method="searchUseRooms" style="width: 100%">
            <el-option v-for="item in useRooms" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="抵扣金额">
          <el-input-number v-model="useForm.amount" :min="0.01" :precision="2" placeholder="留空表示用余额尽可能抵扣" style="width: 100%" />
        </el-form-item>
        <el-form-item label="指定账单">
          <div style="width: 100%">
            <div class="form-tip" style="margin-bottom: 6px">不勾选则按应缴日顺序抵扣该户欠费账单。</div>
            <el-table
              v-loading="useBillsLoading"
              :data="useBills"
              border
              size="small"
              max-height="220"
              empty-text="该房屋暂无欠费账单"
              @selection-change="(rows) => (useSelected = rows)"
            >
              <el-table-column type="selection" width="46" />
              <el-table-column prop="billNo" label="账单号" min-width="150" />
              <el-table-column prop="period" label="账期" width="90" align="center" />
              <el-table-column prop="feeItemName" label="收费项目" min-width="120" show-overflow-tooltip />
              <el-table-column prop="arrears" label="欠费" width="100" align="right">
                <template #default="{ row }"><span class="amount-cell text-danger">{{ formatAmount(row.arrears) }}</span></template>
              </el-table-column>
              <el-table-column prop="dueDate" label="应缴日" width="110" align="center">
                <template #default="{ row }">{{ formatDate(row.dueDate) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="useForm.remark" maxlength="255" />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="useResult"
        type="success"
        :closable="false"
        show-icon
        :title="`已抵扣 ${formatAmount(useResult.usedAmount)} 元，剩余预收 ${formatAmount(useResult.remainingAdvance)} 元`"
      />

      <template #footer>
        <el-button @click="useVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleUseSubmit">确认抵扣</el-button>
      </template>
    </el-dialog>

    <!-- 申请退款 -->
    <el-dialog v-model="refundVisible" title="申请退款" width="540px" destroy-on-close>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="退款必须先有已通过的审批单，否则后端会提示「退款需先提交审批」。"
        style="margin-bottom: 14px"
      />
      <el-form ref="refundFormRef" :model="refundForm" :rules="refundRules" label-width="110px">
        <el-form-item label="房屋" prop="roomId">
          <el-select v-model="refundForm.roomId" placeholder="输入房号搜索" filterable remote clearable :remote-method="searchRefundRooms" style="width: 100%">
            <el-option v-for="item in refundRooms" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="退款类型">
          <el-radio-group v-model="refundForm.accountType">
            <el-radio-button value="ADVANCE">预收退款</el-radio-button>
            <el-radio-button value="DEPOSIT">押金退还</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="已通过审批单" prop="approvalNo">
          <el-select v-model="refundForm.approvalNo" placeholder="选择审批单" style="width: 100%">
            <el-option
              v-for="item in refundApprovals"
              :key="item.id"
              :label="`${item.approvalNo}（${formatAmount(item.amount)} 元）`"
              :value="item.approvalNo"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="退款金额" prop="amount">
          <el-input-number v-model="refundForm.amount" :min="0.01" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="退款方式">
          <el-select v-model="refundForm.method" style="width: 100%">
            <el-option v-for="item in methodOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="refundForm.remark" type="textarea" :rows="2" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="refundVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleRefundSubmit">确认退款</el-button>
      </template>
    </el-dialog>

    <!-- 账户明细 -->
    <el-drawer v-model="detailVisible" title="账户明细" size="680px">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="房号">{{ detail.roomNo || '-' }}</el-descriptions-item>
            <el-descriptions-item label="业主">{{ detail.ownerName || '未登记' }}</el-descriptions-item>
            <el-descriptions-item label="预收余额">
              <span class="amount-cell text-success">{{ formatAmount(detail.advanceBalance) }} 元</span>
            </el-descriptions-item>
            <el-descriptions-item label="押金余额">
              <span class="amount-cell">{{ formatAmount(detail.depositBalance) }} 元</span>
            </el-descriptions-item>
            <el-descriptions-item label="欠费">
              <span class="amount-cell text-danger">{{ formatAmount(detail.arrears) }} 元</span>
            </el-descriptions-item>
          </el-descriptions>

          <div class="page-title" style="margin: 16px 0 8px">最近资金流水</div>
          <el-table :data="detail.flows || []" border size="small" max-height="420" empty-text="暂无资金流水">
            <el-table-column prop="occurredAt" label="时间" width="160" align="center">
              <template #default="{ row }">{{ formatDateTime(row.occurredAt) }}</template>
            </el-table-column>
            <el-table-column prop="accountType" label="账户" width="80" align="center">
              <template #default="{ row }">{{ dictLabel('accountType', row.accountType) }}</template>
            </el-table-column>
            <el-table-column prop="bizType" label="业务" width="110" align="center">
              <template #default="{ row }">{{ dictLabel('fundBizType', row.bizType) }}</template>
            </el-table-column>
            <el-table-column prop="direction" label="方向" width="70" align="center">
              <template #default="{ row }">
                <el-tag :type="dictTag('flowDirection', row.direction)" size="small" effect="plain">
                  {{ dictLabel('flowDirection', row.direction) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="amount" label="金额" width="110" align="right">
              <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column prop="balanceAfter" label="余额" width="110" align="right">
              <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.balanceAfter) }}</span></template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.remark || '-' }}</template>
            </el-table-column>
          </el-table>
        </template>
        <el-empty v-else-if="!detailLoading" description="未获取到账户明细" />
      </div>
    </el-drawer>
  </div>
</template>
