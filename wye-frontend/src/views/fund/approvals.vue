<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { approveApproval, createApproval, listApprovals, rejectApproval } from '@/api/fund'
import { listBills } from '@/api/bill'
import { roomOptions } from '@/api/room'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatAmount, formatDate, formatDateTime } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({ status: '', type: '', roomId: '', keyword: '', page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const roomSelect = ref([])
const statusOptions = dictOptions('approvalStatus')
const typeOptions = dictOptions('approvalType')

// ---------- 提交审批 ----------
const formVisible = ref(false)
const formRef = ref(null)
const form = reactive({ type: 'BILL_DISCOUNT', roomId: null, billId: null, amount: null, reason: '' })
const formRules = {
  type: [{ required: true, message: '请选择审批类型', trigger: 'change' }],
  roomId: [{ required: true, message: '请选择房屋', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  reason: [{ required: true, message: '请填写申请理由', trigger: 'blur' }]
}
const formRooms = ref([])
const formBills = ref([])
const formBillsLoading = ref(false)

// ---------- 审批操作 ----------
const decideVisible = ref(false)
const decideMode = ref('approve')
const decideForm = reactive({ id: null, approvalNo: '', remark: '' })

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
    const data = await listApprovals({ ...query })
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
  query.status = ''
  query.type = ''
  query.roomId = ''
  query.keyword = ''
  handleSearch()
}

// ---------- 提交审批 ----------
async function searchFormRooms(keyword) {
  try {
    formRooms.value = (await roomOptions({ keyword: keyword || undefined })) || []
  } catch (e) {
    formRooms.value = []
  }
}

async function loadFormBills(roomId) {
  form.billId = null
  if (!roomId) {
    formBills.value = []
    return
  }
  formBillsLoading.value = true
  try {
    const data = await listBills({ roomId, size: 100 })
    formBills.value = (data?.list || []).filter((bill) => ['UNPAID', 'PARTIAL'].includes(bill.status))
  } catch (e) {
    formBills.value = []
  } finally {
    formBillsLoading.value = false
  }
}

function handleOpenForm(row) {
  Object.assign(form, {
    type: row?.pendingType || 'BILL_DISCOUNT',
    roomId: row?.roomId || null,
    billId: null,
    amount: row?.amount || null,
    reason: ''
  })
  searchFormRooms('')
  loadFormBills(form.roomId)
  formVisible.value = true
  formRef.value?.clearValidate()
}

watch(() => form.roomId, (value) => loadFormBills(value))

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }
  submitting.value = true
  try {
    await createApproval({
      type: form.type,
      roomId: form.roomId,
      billId: form.type === 'BILL_DISCOUNT' ? form.billId : null,
      amount: Number(form.amount),
      payload: form.type === 'BILL_DISCOUNT' ? { billId: form.billId } : { accountType: form.type === 'DEPOSIT_REFUND' ? 'DEPOSIT' : 'ADVANCE' },
      reason: form.reason
    })
    ElMessage.success('审批单已提交')
    formVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------- 通过 / 驳回 ----------
function handleDecide(row, mode) {
  decideMode.value = mode
  decideForm.id = row.id
  decideForm.approvalNo = row.approvalNo
  decideForm.remark = ''
  decideVisible.value = true
}

async function handleDecideSubmit() {
  if (decideMode.value === 'reject' && !decideForm.remark) {
    ElMessage.warning('驳回必须填写意见')
    return
  }
  submitting.value = true
  try {
    if (decideMode.value === 'approve') {
      await approveApproval(decideForm.id, { remark: decideForm.remark || null })
      ElMessage.success('已通过并执行对应动作')
    } else {
      await rejectApproval(decideForm.id, { remark: decideForm.remark })
      ElMessage.success('已驳回')
    }
    decideVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await loadRoomSelect()
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">审批中心</span>
          <span class="page-subtitle">减免 ≥ 100 元与全部退款必须先审批，通过后自动执行</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenForm(null)">
          <el-icon><Plus /></el-icon>
          <span>提交审批</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.status" placeholder="审批状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.type" placeholder="审批类型" clearable>
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="审批单号 / 房号 / 申请人" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无审批单">
        <el-table-column prop="approvalNo" label="审批单号" min-width="160" fixed="left" />
        <el-table-column prop="type" label="类型" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('approvalType', row.type)" size="small" effect="light">
              {{ dictLabel('approvalType', row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="100" />
        <el-table-column prop="ownerName" label="业主" width="100">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
        </el-table-column>
        <el-table-column prop="reason" label="申请理由" min-width="160" show-overflow-tooltip />
        <el-table-column prop="applicant" label="申请人" width="100" />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('approvalStatus', row.status)" size="small" effect="light">
              {{ dictLabel('approvalStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="approver" label="审批人" width="100">
          <template #default="{ row }">{{ row.approver || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="提交时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="approveRemark" label="审批意见" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.approveRemark || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="userStore.isAdmin" label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="success" size="small" :disabled="row.status !== 'PENDING'" @click="handleDecide(row, 'approve')">
                通过
              </el-button>
              <el-button link type="danger" size="small" :disabled="row.status !== 'PENDING'" @click="handleDecide(row, 'reject')">
                驳回
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

    <!-- 提交审批 -->
    <el-dialog v-model="formVisible" title="提交审批" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="审批类型" prop="type">
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="房屋" prop="roomId">
          <el-select v-model="form.roomId" placeholder="输入房号搜索" filterable remote clearable :remote-method="searchFormRooms" style="width: 100%">
            <el-option v-for="item in formRooms" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.type === 'BILL_DISCOUNT'" label="关联账单">
          <el-select v-model="form.billId" placeholder="选择待减免账单" clearable :loading="formBillsLoading" style="width: 100%">
            <el-option
              v-for="item in formBills"
              :key="item.id"
              :label="`${item.billNo}（${item.period} 应收 ${formatAmount(item.arrears)} 元）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0.01" :precision="2" :step="100" style="width: 100%" />
        </el-form-item>
        <el-form-item label="申请理由" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="255" show-word-limit placeholder="例：困难户减免（主任批准）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">提交</el-button>
      </template>
    </el-dialog>

    <!-- 通过 / 驳回 -->
    <el-dialog v-model="decideVisible" :title="decideMode === 'approve' ? '通过审批' : '驳回审批'" width="480px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="审批单">
          <el-input :model-value="decideForm.approvalNo" disabled />
        </el-form-item>
        <el-form-item :label="decideMode === 'approve' ? '审批意见' : '驳回原因'" :required="decideMode === 'reject'">
          <el-input v-model="decideForm.remark" type="textarea" :rows="3" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="decideVisible = false">取消</el-button>
        <el-button :type="decideMode === 'approve' ? 'primary' : 'danger'" :loading="submitting" @click="handleDecideSubmit">
          确认{{ decideMode === 'approve' ? '通过' : '驳回' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
