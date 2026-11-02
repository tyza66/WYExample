<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createReceipt, listReceipts, receiptPrintPath, voidReceipt } from '@/api/receipt'
import { listPayments } from '@/api/payment'
import { roomOptions } from '@/api/room'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatAmount, formatDateTime, today, shiftPeriod } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({
  roomId: '',
  type: '',
  status: '',
  from: '',
  to: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const roomSelect = ref([])
const typeOptions = dictOptions('receiptType')
const statusOptions = dictOptions('receiptStatus')

// ---------- 开具 ----------
const createVisible = ref(false)
const createFormRef = ref(null)
const createForm = reactive({ paymentId: null, type: 'RECEIPT', title: '', taxNo: '', amount: null, remark: '' })
const createRules = {
  paymentId: [{ required: true, message: '请选择收款单', trigger: 'change' }],
  type: [{ required: true, message: '请选择票据类型', trigger: 'change' }],
  title: [{ required: true, message: '请输入抬头', trigger: 'blur' }],
  amount: [{ required: true, message: '请输入开票金额', trigger: 'blur' }]
}
const paymentOptions = ref([])
const paymentLoading = ref(false)
const selectedPayment = ref(null)

// ---------- 作废 ----------
const voidVisible = ref(false)
const voidFormRef = ref(null)
const voidForm = reactive({ id: null, receiptNo: '', reason: '' })
const voidRules = { reason: [{ required: true, message: '请填写作废原因', trigger: 'blur' }] }

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
    const data = await listReceipts({ ...query })
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
  query.type = ''
  query.status = ''
  query.from = ''
  query.to = ''
  query.keyword = ''
  handleSearch()
}

// ---------- 开具 ----------
async function searchPayments(keyword) {
  paymentLoading.value = true
  try {
    const data = await listPayments({ keyword: keyword || undefined, size: 20 })
    paymentOptions.value = data?.list || []
  } catch (e) {
    paymentOptions.value = []
  } finally {
    paymentLoading.value = false
  }
}

function handleOpenCreate() {
  Object.assign(createForm, { paymentId: null, type: 'RECEIPT', title: '', taxNo: '', amount: null, remark: '' })
  selectedPayment.value = null
  createVisible.value = true
  searchPayments('')
  createFormRef.value?.clearValidate()
}

function handlePaymentChange(paymentId) {
  selectedPayment.value = paymentOptions.value.find((item) => item.id === paymentId) || null
  if (selectedPayment.value && (createForm.amount === null || createForm.amount === undefined)) {
    createForm.amount = Number(selectedPayment.value.amount || 0)
  }
}

async function handleCreateSubmit() {
  if (!createFormRef.value) return
  try {
    await createFormRef.value.validate()
  } catch (e) {
    return
  }
  if (selectedPayment.value && Number(createForm.amount) > Number(selectedPayment.value.amount)) {
    ElMessage.warning('开票金额不得超过收款单金额')
    return
  }
  submitting.value = true
  try {
    await createReceipt({
      paymentId: createForm.paymentId,
      type: createForm.type,
      title: createForm.title,
      taxNo: createForm.taxNo || null,
      amount: Number(createForm.amount),
      remark: createForm.remark || null
    })
    ElMessage.success('开具成功')
    createVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------- 作废 ----------
function handleVoid(row) {
  Object.assign(voidForm, { id: row.id, receiptNo: row.receiptNo, reason: '' })
  voidVisible.value = true
}

async function handleVoidSubmit() {
  if (!voidFormRef.value) return
  try {
    await voidFormRef.value.validate()
  } catch (e) {
    return
  }
  submitting.value = true
  try {
    await voidReceipt(voidForm.id, { reason: voidForm.reason })
    ElMessage.success('已作废')
    voidVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------- 打印 ----------
function handlePrint(row) {
  const url = receiptPrintPath(row.id)
  const win = window.open(url, '_blank')
  if (win) return
  // 演示模式 / 弹窗被拦截时，前端兜底生成可打印页
  const printWin = window.open('', '_blank')
  if (!printWin) {
    ElMessage.warning('浏览器拦截了新窗口，请允许弹出窗口后重试')
    return
  }
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${row.receiptNo}</title>
  <style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:32px;color:#303133}
  h1{font-size:20px;text-align:center}table{width:100%;border-collapse:collapse;margin-top:16px}
  td{border:1px solid #dcdfe6;padding:8px 12px;font-size:14px}td:first-child{width:120px;background:#f5f7fa}
  .amt{font-size:18px;font-weight:600}</style></head><body>
  <h1>${row.type === 'INVOICE' ? '发票' : '收据'}</h1>
  <table>
    <tr><td>票据编号</td><td>${row.receiptNo || '-'}</td></tr>
    <tr><td>抬头</td><td>${row.title || '-'}</td></tr>
    <tr><td>税号</td><td>${row.taxNo || '-'}</td></tr>
    <tr><td>房号</td><td>${row.roomNo || '-'}</td></tr>
    <tr><td>金额</td><td class="amt">￥${formatAmount(row.amount)}</td></tr>
    <tr><td>开具时间</td><td>${formatDateTime(row.issuedAt)}</td></tr>
    <tr><td>经办人</td><td>${row.operator || '-'}</td></tr>
  </table>
  <script>window.onload = () => window.print()<\/script>
  </body></html>`
  printWin.document.write(html)
  printWin.document.close()
}

onMounted(async () => {
  const end = today()
  query.from = shiftPeriod(end.slice(0, 7), -2) + '-01'
  query.to = end
  await loadRoomSelect()
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">收据发票</span>
          <span class="page-subtitle">一张收款单同类型只能开具一次，金额不得超过收款单金额</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenCreate">
          <el-icon><Plus /></el-icon>
          <span>开具票据</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.type" placeholder="票据类型" clearable>
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-date-picker v-model="query.from" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="width: 150px" />
        <el-date-picker v-model="query.to" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="width: 150px" />
        <el-input v-model="query.keyword" placeholder="票据号 / 抬头 / 房号" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无票据数据">
        <el-table-column prop="receiptNo" label="票据编号" min-width="170" fixed="left" />
        <el-table-column prop="type" label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('receiptType', row.type)" size="small" effect="light">
              {{ dictLabel('receiptType', row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="100" />
        <el-table-column prop="title" label="抬头" min-width="160" show-overflow-tooltip />
        <el-table-column prop="taxNo" label="税号" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.taxNo || '-' }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="金额" width="120" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('receiptStatus', row.status)" size="small" effect="light">
              {{ dictLabel('receiptStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="issuedAt" label="开具时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.issuedAt) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="经办人" width="100" />
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" size="small" @click="handlePrint(row)">打印</el-button>
              <el-button
                v-if="userStore.isAdmin"
                link
                type="danger"
                size="small"
                :disabled="row.status === 'VOID'"
                @click="handleVoid(row)"
              >
                作废
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

    <!-- 开具票据 -->
    <el-dialog v-model="createVisible" title="开具票据" width="600px" destroy-on-close>
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="收款单" prop="paymentId">
          <el-select
            v-model="createForm.paymentId"
            placeholder="输入收款单号 / 房号搜索"
            filterable
            remote
            clearable
            :remote-method="searchPayments"
            :loading="paymentLoading"
            style="width: 100%"
            @change="handlePaymentChange"
          >
            <el-option
              v-for="item in paymentOptions"
              :key="item.id"
              :label="`${item.paymentNo}（${item.roomNo || '-'} / ${formatAmount(item.amount)} 元）`"
              :value="item.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="票据类型" prop="type">
          <el-radio-group v-model="createForm.type">
            <el-radio-button value="RECEIPT">收据</el-radio-button>
            <el-radio-button value="INVOICE">发票</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="抬头" prop="title">
          <el-input v-model="createForm.title" maxlength="100" placeholder="个人或单位名称" />
        </el-form-item>
        <el-form-item v-if="createForm.type === 'INVOICE'" label="税号">
          <el-input v-model="createForm.taxNo" maxlength="50" />
        </el-form-item>
        <el-form-item label="开票金额" prop="amount">
          <el-input-number
            v-model="createForm.amount"
            :min="0.01"
            :max="selectedPayment ? Number(selectedPayment.amount) : 99999999"
            :precision="2"
            style="width: 100%"
          />
          <span v-if="selectedPayment" class="form-tip" style="margin-left: 8px">
            收款单金额 {{ formatAmount(selectedPayment.amount) }} 元
          </span>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.remark" maxlength="255" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreateSubmit">开具</el-button>
      </template>
    </el-dialog>

    <!-- 作废 -->
    <el-dialog v-model="voidVisible" title="作废票据" width="480px" destroy-on-close>
      <el-form ref="voidFormRef" :model="voidForm" :rules="voidRules" label-width="90px">
        <el-form-item label="票据编号">
          <el-input :model-value="voidForm.receiptNo" disabled />
        </el-form-item>
        <el-form-item label="作废原因" prop="reason">
          <el-input v-model="voidForm.reason" type="textarea" :rows="3" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="voidVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="handleVoidSubmit">确认作废</el-button>
      </template>
    </el-dialog>
  </div>
</template>
