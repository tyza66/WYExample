<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { generateBills, listBills, updateBill, voidBill } from '@/api/bill'
import { communityOptions } from '@/api/community'
import { buildingOptions } from '@/api/building'
import { roomOptions, listRooms } from '@/api/room'
import { feeItemOptions } from '@/api/feeItem'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { currentPeriod, formatAmount, formatDate, formatNumber, formatPrice } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({
  period: '',
  communityId: '',
  buildingId: '',
  roomId: '',
  feeItemId: '',
  status: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const buildings = ref([])
const roomSelect = ref([])
const feeItemSelect = ref([])

const statusOptions = dictOptions('billStatus')

// ---------- 生成账单 ----------
const generateVisible = ref(false)
const generateFormRef = ref(null)
const generateResult = ref(null)
const generateResultVisible = ref(false)
const generateForm = reactive({
  period: currentPeriod(),
  communityId: null,
  buildingId: null,
  feeItemIds: [],
  overwrite: false
})
const generateBuildings = ref([])
const generateFeeItems = ref([])

// ---------- 调整 ----------
const adjustVisible = ref(false)
const adjustFormRef = ref(null)
const adjustForm = reactive({
  id: null,
  billNo: '',
  amount: 0,
  paidAmount: 0,
  discount: 0,
  dueDate: null,
  remark: ''
})
const adjustRules = {
  discount: [{ required: true, message: '请输入减免金额', trigger: 'blur' }],
  remark: [{ required: true, message: '调整必须填写备注', trigger: 'blur' }]
}
const adjustNetAmount = computed(() => {
  const net = Number(adjustForm.amount || 0) - Number(adjustForm.discount || 0)
  return net < 0 ? 0 : net
})

// ---------- 作废 ----------
const voidVisible = ref(false)
const voidFormRef = ref(null)
const voidForm = reactive({ id: null, billNo: '', reason: '' })
const voidRules = { reason: [{ required: true, message: '请填写作废原因', trigger: 'blur' }] }

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadFeeItems() {
  try {
    feeItemSelect.value = (await feeItemOptions(true)) || []
  } catch (e) {
    feeItemSelect.value = []
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
    if (query.buildingId) {
      const data = await listRooms({
        communityId: query.communityId || undefined,
        buildingId: query.buildingId,
        size: 100
      })
      roomSelect.value = (data?.list || []).map((row) => ({ id: row.id, label: row.roomNo }))
    } else {
      roomSelect.value = (await roomOptions({ communityId: query.communityId || undefined })) || []
    }
  } catch (e) {
    roomSelect.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listBills({ ...query })
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
  query.buildingId = ''
  query.roomId = ''
  query.feeItemId = ''
  query.status = ''
  query.keyword = ''
  buildings.value = []
  roomSelect.value = []
  query.page = 1
  loadData()
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
  () => {
    query.roomId = ''
    loadRoomSelect()
    handleSearch()
  }
)

// ---------- 生成账单 ----------
async function handleOpenGenerate() {
  generateResult.value = null
  generateForm.period = query.period || currentPeriod()
  generateForm.communityId = query.communityId || null
  generateForm.buildingId = null
  generateForm.feeItemIds = []
  generateForm.overwrite = false
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
    const data = await generateBills({
      period: generateForm.period,
      communityId: generateForm.communityId || null,
      buildingId: generateForm.buildingId || null,
      feeItemIds: generateForm.feeItemIds.length ? generateForm.feeItemIds : null,
      overwrite: !!generateForm.overwrite
    })
    generateResult.value = data || { generated: 0, skipped: 0, totalAmount: 0, skipReasons: [] }
    generateVisible.value = false
    generateResultVisible.value = true
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    submitting.value = false
  }
}

// ---------- 调整 ----------
function handleAdjust(row) {
  Object.assign(adjustForm, {
    id: row.id,
    billNo: row.billNo,
    amount: Number(row.amount || 0),
    paidAmount: Number(row.paidAmount || 0),
    discount: Number(row.discount || 0),
    dueDate: row.dueDate || null,
    remark: row.remark || ''
  })
  adjustVisible.value = true
}

async function handleAdjustSubmit() {
  if (!adjustFormRef.value) return
  try {
    await adjustFormRef.value.validate()
  } catch (e) {
    return
  }
  if (Number(adjustForm.discount) > Number(adjustForm.amount)) {
    ElMessage.warning('减免金额不能大于应收金额')
    return
  }

  submitting.value = true
  try {
    await updateBill(adjustForm.id, {
      discount: Number(adjustForm.discount || 0),
      dueDate: adjustForm.dueDate || null,
      remark: adjustForm.remark
    })
    ElMessage.success('调整成功')
    adjustVisible.value = false
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    submitting.value = false
  }
}

// ---------- 作废 ----------
function handleVoid(row) {
  voidForm.id = row.id
  voidForm.billNo = row.billNo
  voidForm.reason = ''
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
    await voidBill(voidForm.id, { reason: voidForm.reason })
    ElMessage.success('作废成功')
    voidVisible.value = false
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadCommunities(), loadFeeItems()])
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">账单管理</span>
          <span class="page-subtitle">同一（房屋 × 项目 × 账期）只允许一张有效账单</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenGenerate">
          <el-icon><MagicStick /></el-icon>
          <span>生成账单</span>
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
        <el-select v-model="query.buildingId" placeholder="全部楼栋" clearable :disabled="!query.communityId">
          <el-option v-for="item in buildings" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.feeItemId" placeholder="收费项目" clearable filterable>
          <el-option v-for="item in feeItemSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.status" placeholder="账单状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="账单号 / 房号 / 住户" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无账单数据">
        <el-table-column prop="billNo" label="账单号" min-width="150" fixed="left" />
        <el-table-column prop="period" label="账期" width="90" align="center" />
        <el-table-column prop="communityName" label="小区" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="buildingName" label="楼栋" width="100">
          <template #default="{ row }">{{ row.buildingName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="100" />
        <el-table-column prop="feeItemName" label="收费项目" min-width="130" show-overflow-tooltip />
        <el-table-column prop="chargeMode" label="计费方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('chargeMode', row.chargeMode)" size="small" effect="plain">
              {{ dictLabel('chargeMode', row.chargeMode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" width="90" align="right">
          <template #default="{ row }">{{ formatNumber(row.quantity) }}</template>
        </el-table-column>
        <el-table-column prop="unitPrice" label="单价" width="90" align="right">
          <template #default="{ row }">{{ formatPrice(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column prop="amount" label="应收金额" width="110" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.amount) }}</span></template>
        </el-table-column>
        <el-table-column prop="discount" label="减免" width="100" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.discount) }}</span></template>
        </el-table-column>
        <el-table-column prop="netAmount" label="应收净额" width="110" align="right">
          <template #default="{ row }"><span class="amount-cell">{{ formatAmount(row.netAmount) }}</span></template>
        </el-table-column>
        <el-table-column prop="paidAmount" label="已收" width="110" align="right">
          <template #default="{ row }">
            <span class="amount-cell text-success">{{ formatAmount(row.paidAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="arrears" label="欠费" width="110" align="right">
          <template #default="{ row }">
            <span class="amount-cell" :class="Number(row.arrears) > 0 ? 'text-danger' : ''">
              {{ formatAmount(row.arrears) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('billStatus', row.status)" size="small" effect="light">
              {{ dictLabel('billStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="dueDate" label="应缴日" width="110" align="center">
          <template #default="{ row }">{{ formatDate(row.dueDate) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.voidReason" class="text-danger">作废原因：{{ row.voidReason }}</span>
            <span v-else>{{ row.remark || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="userStore.canWrite" label="操作" width="130" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                link
                type="primary"
                size="small"
                :disabled="row.status === 'VOID'"
                @click="handleAdjust(row)"
              >
                调整
              </el-button>
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

    <!-- 生成账单 -->
    <el-dialog v-model="generateVisible" title="生成账单" width="560px" destroy-on-close>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="按「小区 + 楼栋 + 账期 + 收费项目」范围内每个房屋生成账单；按用量项目需先有抄表记录。"
        style="margin-bottom: 14px"
      />
      <el-form :model="generateForm" label-width="110px">
        <el-form-item label="账期" required>
          <el-date-picker
            v-model="generateForm.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择账期"
            :clearable="false"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="小区">
          <el-select v-model="generateForm.communityId" placeholder="全部小区" clearable filterable style="width: 100%">
            <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="楼栋">
          <el-select
            v-model="generateForm.buildingId"
            placeholder="全部楼栋"
            clearable
            filterable
            :disabled="!generateForm.communityId"
            style="width: 100%"
          >
            <el-option v-for="item in generateBuildings" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="收费项目">
          <el-select
            v-model="generateForm.feeItemIds"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="留空表示全部启用项目"
            style="width: 100%"
          >
            <el-option v-for="item in generateFeeItems" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="覆盖已存在">
          <el-switch v-model="generateForm.overwrite" />
          <span class="form-tip" style="margin-left: 10px">开启后会先作废同账期同项目旧账单再重新生成</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="generateVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleGenerate">开始生成</el-button>
      </template>
    </el-dialog>

    <!-- 生成结果 -->
    <el-dialog v-model="generateResultVisible" title="账单生成结果" width="720px">
      <template v-if="generateResult">
        <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="stat-card is-received">
            <div class="stat-label">生成成功</div>
            <div class="stat-value">{{ generateResult.generated ?? 0 }}</div>
          </div>
          <div class="stat-card is-count">
            <div class="stat-label">跳过</div>
            <div class="stat-value">{{ generateResult.skipped ?? 0 }}</div>
          </div>
          <div class="stat-card is-receivable">
            <div class="stat-label">生成金额合计（元）</div>
            <div class="stat-value">{{ formatAmount(generateResult.totalAmount) }}</div>
          </div>
        </div>

        <div class="page-title" style="margin: 10px 0 8px">跳过明细</div>
        <el-table
          :data="generateResult.skipReasons || []"
          border
          size="small"
          max-height="280"
          empty-text="没有跳过记录"
        >
          <el-table-column type="index" label="序号" width="70" align="center" />
          <el-table-column prop="roomNo" label="房号" min-width="110" />
          <el-table-column prop="feeItem" label="收费项目" min-width="140" />
          <el-table-column prop="reason" label="跳过原因" min-width="220" show-overflow-tooltip />
        </el-table>
      </template>

      <template #footer>
        <el-button type="primary" @click="generateResultVisible = false">知道了</el-button>
      </template>
    </el-dialog>

    <!-- 调整账单 -->
    <el-dialog v-model="adjustVisible" title="调整账单" width="520px" destroy-on-close>
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="110px">
        <el-form-item label="账单号">
          <el-input :model-value="adjustForm.billNo" disabled />
        </el-form-item>
        <el-form-item label="应收金额">
          <el-input :model-value="formatAmount(adjustForm.amount)" disabled />
        </el-form-item>
        <el-form-item label="已收金额">
          <el-input :model-value="formatAmount(adjustForm.paidAmount)" disabled />
        </el-form-item>
        <el-form-item label="减免金额" prop="discount">
          <el-input-number
            v-model="adjustForm.discount"
            :min="0"
            :max="adjustForm.amount"
            :precision="2"
            :step="10"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整后净额">
          <span class="amount-cell" :class="adjustNetAmount < adjustForm.paidAmount ? 'text-danger' : ''">
            {{ formatAmount(adjustNetAmount) }}
          </span>
          <span v-if="adjustNetAmount < adjustForm.paidAmount" class="form-tip" style="margin-left: 8px">
            净额不得低于已收金额 {{ formatAmount(adjustForm.paidAmount) }}
          </span>
        </el-form-item>
        <el-form-item label="应缴截止日" prop="dueDate">
          <el-date-picker
            v-model="adjustForm.dueDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择应缴日"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整备注" prop="remark">
          <el-input
            v-model="adjustForm.remark"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="例：困难户减免（主任批准）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="adjustVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleAdjustSubmit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 作废账单 -->
    <el-dialog v-model="voidVisible" title="作废账单" width="480px" destroy-on-close>
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="作废后该账单不再计入应收、不参与核销；已有收款记录的账单不允许作废。"
        style="margin-bottom: 14px"
      />
      <el-form ref="voidFormRef" :model="voidForm" :rules="voidRules" label-width="90px">
        <el-form-item label="账单号">
          <el-input :model-value="voidForm.billNo" disabled />
        </el-form-item>
        <el-form-item label="作废原因" prop="reason">
          <el-input
            v-model="voidForm.reason"
            type="textarea"
            :rows="3"
            maxlength="255"
            show-word-limit
            placeholder="例：重复生成"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="voidVisible = false">取消</el-button>
        <el-button type="danger" :loading="submitting" @click="handleVoidSubmit">确认作废</el-button>
      </template>
    </el-dialog>
  </div>
</template>
