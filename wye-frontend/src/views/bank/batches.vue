<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  bankBatchExportPath,
  closeBankBatch,
  generateBankBatch,
  getBankBatch,
  listBankBatches,
  returnBankBatch
} from '@/api/bank'
import { communityOptions } from '@/api/community'
import { buildingOptions } from '@/api/building'
import { feeItemOptions } from '@/api/feeItem'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { currentPeriod, formatAmount, formatDateTime } from '@/utils/format'
import { downloadBackendCsv } from '@/utils/export'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({ period: '', status: '', communityId: '', page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const communities = ref([])
const statusOptions = dictOptions('bankBatchStatus')

// ---------- 生成批次 ----------
const generateVisible = ref(false)
const generateFormRef = ref(null)
const generateForm = reactive({ period: currentPeriod(), communityId: null, buildingId: null, feeItemIds: [] })
const generateBuildings = ref([])
const generateFeeItems = ref([])
const generateResult = ref(null)

// ---------- 批次明细 ----------
const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref(null)

// ---------- 回盘 ----------
const returnVisible = ref(false)
const returnFormRef = ref(null)
const returnForm = reactive({ id: null, batchNo: '', fileName: '', content: '' })
const returnRules = { content: [{ required: true, message: '请粘贴回盘 CSV 内容或选择文件', trigger: 'blur' }] }
const returnFileInput = ref(null)

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

async function loadData() {
  loading.value = true
  try {
    const data = await listBankBatches({ ...query })
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
  query.status = ''
  query.communityId = ''
  handleSearch()
}

watch(
  () => query.communityId,
  () => handleSearch()
)

// ---------- 生成 ----------
async function handleOpenGenerate() {
  Object.assign(generateForm, {
    period: query.period || currentPeriod(),
    communityId: query.communityId || null,
    buildingId: null,
    feeItemIds: []
  })
  generateResult.value = null
  generateBuildings.value = []
  generateVisible.value = true
  try {
    generateFeeItems.value = (await feeItemOptions(true)) || []
  } catch (e) {
    generateFeeItems.value = []
  }
  if (generateForm.communityId) loadBuildings(generateForm.communityId, generateBuildings)
}

watch(
  () => generateForm.communityId,
  (value) => {
    generateForm.buildingId = null
    loadBuildings(value, generateBuildings)
  }
)

async function handleGenerate() {
  if (!generateForm.period) {
    ElMessage.warning('请选择账期')
    return
  }
  submitting.value = true
  try {
    const data = await generateBankBatch({
      period: generateForm.period,
      communityId: generateForm.communityId || null,
      buildingId: generateForm.buildingId || null,
      feeItemIds: generateForm.feeItemIds.length ? generateForm.feeItemIds : null
    })
    generateResult.value = data || null
    ElMessage.success(`批次已生成，共 ${data?.totalCount ?? 0} 户`)
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

// ---------- 明细 / 下载 ----------
async function handleViewDetail(row) {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getBankBatch(row.id)
  } catch (e) {
    detail.value = null
  } finally {
    detailLoading.value = false
  }
}

async function handleDownload(row, format = 'csv') {
  try {
    const { url, params } = bankBatchExportPath(row.id, format)
    await downloadBackendCsv(url, params, `报盘_${row.batchNo}`)
    ElMessage.success('已开始下载报盘文件')
  } catch (e) {
    // 拦截器已提示
  }
}

// ---------- 回盘 ----------
function handleOpenReturn(row) {
  Object.assign(returnForm, { id: row.id, batchNo: row.batchNo, fileName: '', content: '' })
  returnVisible.value = true
  returnFormRef.value?.clearValidate()
}

function handlePickReturnFile() {
  returnFileInput.value?.click()
}

function handleReturnFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  returnForm.fileName = file.name
  const reader = new FileReader()
  reader.onload = () => {
    returnForm.content = String(reader.result || '')
  }
  reader.readAsText(file, 'utf-8')
  event.target.value = ''
}

async function handleReturnSubmit() {
  if (!returnFormRef.value) return
  try {
    await returnFormRef.value.validate()
  } catch (e) {
    return
  }
  submitting.value = true
  try {
    const data = await returnBankBatch(returnForm.id, { fileName: returnForm.fileName || null, content: returnForm.content })
    ElMessage.success(`回盘完成：成功 ${data?.success ?? 0} 笔，失败 ${data?.failed ?? 0} 笔`)
    returnVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

async function handleClose(row) {
  try {
    await ElMessageBox.confirm(`确定关闭批次「${row.batchNo}」吗？关闭后不可再回盘。`, '关闭批次', {
      type: 'warning',
      confirmButtonText: '关闭',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await closeBankBatch(row.id)
    ElMessage.success('批次已关闭')
    loadData()
  } catch (e) {
    // 拦截器已提示
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
          <span class="page-title">代扣批次</span>
          <span class="page-subtitle">只取「已签约 + 该账期有欠费」的房屋生成报盘，回盘成功自动登记收款</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenGenerate">
          <el-icon><MagicStick /></el-icon>
          <span>生成批次</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-date-picker v-model="query.period" type="month" value-format="YYYY-MM" placeholder="账期" clearable style="width: 150px" />
        <el-select v-model="query.communityId" placeholder="全部小区" clearable>
          <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.status" placeholder="批次状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无代扣批次">
        <el-table-column prop="batchNo" label="批次号" min-width="170" fixed="left" />
        <el-table-column prop="period" label="账期" width="90" align="center" />
        <el-table-column prop="communityName" label="小区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="totalCount" label="总户数" width="90" align="right" />
        <el-table-column prop="totalAmount" label="代扣总金额" width="130" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.totalAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="successCount" label="成功" width="80" align="right">
          <template #default="{ row }"><span class="text-success">{{ row.successCount ?? 0 }}</span></template>
        </el-table-column>
        <el-table-column prop="failCount" label="失败" width="80" align="right">
          <template #default="{ row }"><span class="text-danger">{{ row.failCount ?? 0 }}</span></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('bankBatchStatus', row.status)" size="small" effect="light">
              {{ dictLabel('bankBatchStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="100">
          <template #default="{ row }">{{ row.operator || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="生成时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" size="small" @click="handleViewDetail(row)">明细</el-button>
              <el-button link type="primary" size="small" @click="handleDownload(row, 'csv')">下载报盘</el-button>
              <el-button
                v-if="userStore.canWrite"
                link
                type="warning"
                size="small"
                :disabled="row.status === 'CLOSED'"
                @click="handleOpenReturn(row)"
              >
                回盘
              </el-button>
              <el-button
                v-if="userStore.isAdmin"
                link
                type="danger"
                size="small"
                :disabled="row.status === 'CLOSED'"
                @click="handleClose(row)"
              >
                关闭
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

    <!-- 生成批次 -->
    <el-dialog v-model="generateVisible" title="生成代扣批次" width="560px" destroy-on-close>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="系统只挑选「已签约且该账期有欠费」的房屋，每户一行生成报盘明细。"
        style="margin-bottom: 14px"
      />
      <el-form ref="generateFormRef" :model="generateForm" label-width="110px">
        <el-form-item label="账期" required>
          <el-date-picker v-model="generateForm.period" type="month" value-format="YYYY-MM" :clearable="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="小区">
          <el-select v-model="generateForm.communityId" placeholder="全部小区" clearable filterable style="width: 100%">
            <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="楼栋">
          <el-select v-model="generateForm.buildingId" placeholder="全部楼栋" clearable :disabled="!generateForm.communityId" style="width: 100%">
            <el-option v-for="item in generateBuildings" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="收费项目">
          <el-select v-model="generateForm.feeItemIds" multiple collapse-tags collapse-tags-tooltip placeholder="留空表示全部项目" style="width: 100%">
            <el-option v-for="item in generateFeeItems" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="generateResult"
        type="success"
        :closable="false"
        show-icon
        style="margin-top: 8px"
        :title="`批次 ${generateResult.batchNo} 生成成功：${generateResult.totalCount} 户，合计 ${formatAmount(generateResult.totalAmount)} 元`"
      />

      <template #footer>
        <el-button @click="generateVisible = false">关闭</el-button>
        <el-button type="primary" :loading="submitting" @click="handleGenerate">生成</el-button>
      </template>
    </el-dialog>

    <!-- 批次明细 -->
    <el-drawer v-model="detailVisible" title="批次明细" size="720px">
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="批次号">{{ detail.batchNo }}</el-descriptions-item>
            <el-descriptions-item label="账期">{{ detail.period }}</el-descriptions-item>
            <el-descriptions-item label="总户数">{{ detail.totalCount }}</el-descriptions-item>
            <el-descriptions-item label="总金额">{{ formatAmount(detail.totalAmount) }} 元</el-descriptions-item>
            <el-descriptions-item label="成功 / 失败">
              <span class="text-success">{{ detail.successCount ?? 0 }}</span> /
              <span class="text-danger">{{ detail.failCount ?? 0 }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag :type="dictTag('bankBatchStatus', detail.status)" size="small" effect="light">
                {{ dictLabel('bankBatchStatus', detail.status) }}
              </el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div class="page-title" style="margin: 16px 0 8px">明细</div>
          <el-table :data="detail.items || []" border size="small" max-height="440" empty-text="暂无明细">
            <el-table-column type="index" label="序号" width="60" align="center" />
            <el-table-column prop="roomNo" label="房号" width="100" />
            <el-table-column prop="accountName" label="户名" width="100" />
            <el-table-column prop="accountNoMasked" label="账号（掩码）" width="140" />
            <el-table-column prop="amount" label="金额" width="110" align="right">
              <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
            </el-table-column>
            <el-table-column prop="result" label="结果" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="dictTag('batchItemResult', row.result)" size="small" effect="light">
                  {{ dictLabel('batchItemResult', row.result) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="failReason" label="失败原因" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ row.failReason || '-' }}</template>
            </el-table-column>
          </el-table>
        </template>
        <el-empty v-else-if="!detailLoading" description="未获取到批次明细" />
      </div>
    </el-drawer>

    <!-- 回盘 -->
    <el-dialog v-model="returnVisible" title="粘贴 / 上传回盘文件" width="640px" destroy-on-close>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="CSV 格式：房号,金额,结果,说明（结果取「成功」或「失败」）。成功项自动登记 BANK_DEDUCT 收款并核销。"
        style="margin-bottom: 14px"
      />
      <el-form ref="returnFormRef" :model="returnForm" :rules="returnRules" label-width="90px">
        <el-form-item label="批次号">
          <el-input :model-value="returnForm.batchNo" disabled />
        </el-form-item>
        <el-form-item label="文件名">
          <el-input v-model="returnForm.fileName" placeholder="可选，例：return_202603.csv" />
        </el-form-item>
        <el-form-item label="回盘内容" prop="content">
          <el-input v-model="returnForm.content" type="textarea" :rows="10" placeholder="房号,金额,结果,说明&#10;1-101,313.25,成功,&#10;2-201,250.00,失败,余额不足" />
        </el-form-item>
        <el-form-item label="选择文件">
          <input ref="returnFileInput" type="file" accept=".csv,.txt" style="display: none" @change="handleReturnFileChange" />
          <el-button @click="handlePickReturnFile">
            <el-icon><Upload /></el-icon>
            <span>选择 CSV 文件</span>
          </el-button>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleReturnSubmit">提交回盘</el-button>
      </template>
    </el-dialog>
  </div>
</template>
