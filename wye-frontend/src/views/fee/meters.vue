<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createMeterReading, listMeterReadings } from '@/api/meterReading'
import { listFeeItems } from '@/api/feeItem'
import { communityOptions } from '@/api/community'
import { roomOptions } from '@/api/room'
import { useUserStore } from '@/stores/user'
import { currentPeriod, formatAmount, formatDate, formatNumber, formatPrice, today } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)

const query = reactive({
  period: '',
  communityId: '',
  roomId: '',
  feeItemId: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const roomSelect = ref([])
const meterFeeItems = ref([])

const formRef = ref(null)
const form = reactive({
  communityId: null,
  roomId: null,
  feeItemId: null,
  period: currentPeriod(),
  prevReading: null,
  currReading: null,
  readingDate: today(),
  remark: ''
})

const rules = {
  roomId: [{ required: true, message: '请选择房屋', trigger: 'change' }],
  feeItemId: [{ required: true, message: '请选择抄表项目', trigger: 'change' }],
  period: [{ required: true, message: '请选择账期', trigger: 'change' }],
  currReading: [
    {
      required: true,
      validator: (rule, value, callback) => {
        if (value === null || value === undefined || value === '') return callback(new Error('请输入本期读数'))
        if (Number(value) < 0) return callback(new Error('读数不可为负'))
        const prev = Number(form.prevReading)
        if (form.prevReading !== null && form.prevReading !== undefined && form.prevReading !== '' && Number(value) < prev) {
          return callback(new Error('本期读数小于上期读数，请核对'))
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

const formRooms = ref([])
const prevLoading = ref(false)

const selectedFeeItem = computed(() => meterFeeItems.value.find((item) => item.id === form.feeItemId) || null)

/** 实时用量 = 本期 - 上期（仅展示，账单以后端计算为准） */
const usageQty = computed(() => {
  const curr = Number(form.currReading)
  const prev = Number(form.prevReading)
  if (form.currReading === null || form.currReading === undefined || form.currReading === '') return null
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return null
  const usage = curr - prev
  return usage < 0 ? null : usage
})

/** 实时预估金额 = 用量 × 单价 */
const estimatedAmount = computed(() => {
  if (usageQty.value === null) return null
  const unitPrice = Number(selectedFeeItem.value?.unitPrice ?? 0)
  return usageQty.value * unitPrice
})

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

/** 抄表项目：只取「按用量」且启用的收费项目 */
async function loadMeterFeeItems() {
  try {
    const data = await listFeeItems({ chargeMode: 'METER', enabled: true, page: 1, size: 100 })
    meterFeeItems.value = data?.list || []
  } catch (e) {
    meterFeeItems.value = []
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
    const data = await listMeterReadings({ ...query })
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
  query.feeItemId = ''
  roomSelect.value = []
  query.page = 1
  loadData()
}

watch(
  () => query.communityId,
  () => {
    query.roomId = ''
    loadRoomSelect()
    handleSearch()
  }
)

// ---------- 录入 ----------
async function searchFormRooms(keyword) {
  try {
    formRooms.value = (await roomOptions({ communityId: form.communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    formRooms.value = []
  }
}

/**
 * 上期读数：取该房该项目在当前账期之前最近一条记录的本期读数；
 * 若当前账期已有记录（覆盖场景），则回填该记录。
 */
async function loadPrevReading() {
  if (!form.roomId || !form.feeItemId || !form.period) return
  prevLoading.value = true
  try {
    const data = await listMeterReadings({
      roomId: form.roomId,
      feeItemId: form.feeItemId,
      page: 1,
      size: 100
    })
    const records = data?.list || []
    const samePeriod = records.find((item) => item.period === form.period)
    if (samePeriod) {
      form.prevReading = samePeriod.prevReading ?? 0
      form.currReading = samePeriod.currReading ?? null
      ElMessage.info('该账期已有抄表记录，保存将覆盖原记录')
      return
    }
    const before = records
      .filter((item) => item.period && item.period < form.period)
      .sort((a, b) => (a.period < b.period ? 1 : -1))
    if (before.length > 0) {
      form.prevReading = before[0].currReading ?? 0
    } else if (form.prevReading === null || form.prevReading === undefined) {
      form.prevReading = 0
    }
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    prevLoading.value = false
  }
}

function handleOpenCreate() {
  form.communityId = query.communityId || null
  form.roomId = query.roomId || null
  form.feeItemId = query.feeItemId || null
  form.period = query.period || currentPeriod()
  form.prevReading = null
  form.currReading = null
  form.readingDate = today()
  form.remark = ''
  formRooms.value = roomSelect.value.length ? [...roomSelect.value] : []
  dialogVisible.value = true
  formRef.value?.clearValidate()
  if (form.communityId) searchFormRooms('')
  if (form.roomId && form.feeItemId) loadPrevReading()
}

watch(
  () => form.communityId,
  () => {
    form.roomId = null
    searchFormRooms('')
  }
)

watch(
  () => [form.roomId, form.feeItemId, form.period],
  () => {
    if (dialogVisible.value) loadPrevReading()
  }
)

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  submitting.value = true
  try {
    await createMeterReading({
      roomId: form.roomId,
      feeItemId: form.feeItemId,
      period: form.period,
      prevReading: form.prevReading === null || form.prevReading === '' ? null : Number(form.prevReading),
      currReading: Number(form.currReading),
      readingDate: form.readingDate || null,
      remark: form.remark || null
    })
    ElMessage.success('抄表记录已保存')
    dialogVisible.value = false
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCommunities(), loadMeterFeeItems()])
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">抄表录入</span>
          <span class="page-subtitle">仅「按用量」计费的收费项目需要抄表；同房同项目同账期只保留一条记录</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenCreate">
          <el-icon><Plus /></el-icon>
          <span>录入抄表</span>
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
        <el-select v-model="query.feeItemId" placeholder="抄表项目" clearable>
          <el-option v-for="item in meterFeeItems" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无抄表记录">
        <el-table-column prop="period" label="账期" width="90" align="center">
          <template #default="{ row }">{{ row.period || '-' }}</template>
        </el-table-column>
        <el-table-column prop="communityName" label="小区" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="110">
          <template #default="{ row }">{{ row.roomNo || '-' }}</template>
        </el-table-column>
        <el-table-column prop="feeItemName" label="收费项目" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.feeItemName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="prevReading" label="上期读数" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.prevReading) }}</template>
        </el-table-column>
        <el-table-column prop="currReading" label="本期读数" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.currReading) }}</template>
        </el-table-column>
        <el-table-column prop="usageQty" label="用量" width="100" align="right">
          <template #default="{ row }">{{ formatNumber(row.usageQty) }}</template>
        </el-table-column>
        <el-table-column prop="unitPrice" label="单价" width="100" align="right">
          <template #default="{ row }">{{ formatPrice(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column prop="estimatedAmount" label="预估金额（元）" width="130" align="right">
          <template #default="{ row }">
            <span class="amount-cell">{{ formatAmount(row.estimatedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="readingDate" label="抄表日期" width="110" align="center">
          <template #default="{ row }">{{ formatDate(row.readingDate) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="抄表人" width="100">
          <template #default="{ row }">{{ row.operator || '-' }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
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

    <el-dialog v-model="dialogVisible" title="录入抄表" width="620px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="小区">
              <el-select v-model="form.communityId" placeholder="全部小区" clearable filterable style="width: 100%">
                <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房屋" prop="roomId">
              <el-select
                v-model="form.roomId"
                placeholder="输入房号搜索"
                filterable
                remote
                clearable
                :remote-method="searchFormRooms"
                style="width: 100%"
              >
                <el-option v-for="item in formRooms" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="抄表项目" prop="feeItemId">
              <el-select v-model="form.feeItemId" placeholder="仅按用量项目" clearable style="width: 100%">
                <el-option v-for="item in meterFeeItems" :key="item.id" :label="item.name" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="账期" prop="period">
              <el-date-picker
                v-model="form.period"
                type="month"
                value-format="YYYY-MM"
                placeholder="选择账期"
                :clearable="false"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="上期读数" prop="prevReading">
              <el-input-number
                v-model="form.prevReading"
                :min="0"
                :precision="2"
                :step="10"
                :disabled="prevLoading"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="本期读数" prop="currReading">
              <el-input-number v-model="form.currReading" :min="0" :precision="2" :step="10" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="抄表日期" prop="readingDate">
              <el-date-picker
                v-model="form.readingDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" maxlength="255" placeholder="可留空" />
            </el-form-item>
          </el-col>
        </el-row>

        <div class="calc-preview">
          <div>
            上期读数自动带出（可手工修正）：<b>{{ form.prevReading ?? '-' }}</b>
            <span v-if="prevLoading" class="text-muted">（读取中…）</span>
          </div>
          <div>
            用量 = 本期 − 上期：<b>{{ usageQty === null ? '-' : formatNumber(usageQty) }}</b>
          </div>
          <div>
            预估金额 = 用量 × 单价（{{ formatPrice(selectedFeeItem?.unitPrice) }} 元）：
            <b>{{ estimatedAmount === null ? '-' : formatAmount(estimatedAmount) }} 元</b>
          </div>
          <div class="text-muted">预估金额仅用于录入时参考，账单金额以后端生成结果为准。</div>
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
