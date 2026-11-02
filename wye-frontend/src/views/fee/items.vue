<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createFeeItem, deleteFeeItem, listFeeItems, updateFeeItem } from '@/api/feeItem'
import { communityOptions } from '@/api/community'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatPrice } from '@/utils/format'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增收费项目')
const formRef = ref(null)

const query = reactive({
  type: '',
  chargeMode: '',
  enabled: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])

const form = reactive({
  id: null,
  name: '',
  code: '',
  type: 'PROPERTY',
  chargeMode: 'AREA',
  unitPrice: 0,
  priceUnit: '元/㎡',
  period: 'MONTHLY',
  communityId: null,
  enabled: true,
  sortNo: 0
})

const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择项目类型', trigger: 'change' }],
  chargeMode: [{ required: true, message: '请选择计费方式', trigger: 'change' }],
  unitPrice: [{ required: true, message: '请输入单价', trigger: 'blur' }],
  period: [{ required: true, message: '请选择收费周期', trigger: 'change' }]
}

const typeOptions = dictOptions('feeType')
const chargeModeOptions = dictOptions('chargeMode')
const periodOptions = dictOptions('period')
const enabledOptions = [
  { value: '', label: '全部' },
  { value: true, label: '启用' },
  { value: false, label: '停用' }
]
const priceUnitOptions = ['元/㎡', '元/户', '元/度', '元/月']

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listFeeItems({ ...query })
    list.value = (data?.list || []).map((row) => ({ ...row, enabled: !!row.enabled }))
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
  query.type = ''
  query.chargeMode = ''
  query.enabled = ''
  query.keyword = ''
  query.page = 1
  loadData()
}

function resetForm() {
  form.id = null
  form.name = ''
  form.code = ''
  form.type = 'PROPERTY'
  form.chargeMode = 'AREA'
  form.unitPrice = 0
  form.priceUnit = '元/㎡'
  form.period = 'MONTHLY'
  form.communityId = null
  form.enabled = true
  form.sortNo = 0
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增收费项目'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    name: row.name ?? '',
    code: row.code ?? '',
    type: row.type ?? 'PROPERTY',
    chargeMode: row.chargeMode ?? 'AREA',
    unitPrice: row.unitPrice ?? 0,
    priceUnit: row.priceUnit ?? '',
    period: row.period ?? 'MONTHLY',
    communityId: row.communityId ?? null,
    enabled: !!row.enabled,
    sortNo: row.sortNo ?? 0
  })
  dialogTitle.value = '编辑收费项目'
  dialogVisible.value = true
}

function buildPayload(source, enabled) {
  return {
    name: source.name,
    code: source.code || null,
    type: source.type,
    chargeMode: source.chargeMode,
    unitPrice: source.unitPrice,
    priceUnit: source.priceUnit || null,
    period: source.period,
    communityId: source.communityId ?? null,
    enabled: enabled ?? !!source.enabled,
    sortNo: source.sortNo ?? 0
  }
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  submitting.value = true
  try {
    if (form.id) {
      await updateFeeItem(form.id, buildPayload(form))
      ElMessage.success('修改成功')
    } else {
      await createFeeItem(buildPayload(form))
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    submitting.value = false
  }
}

/** 启用 / 停用（el-switch 已改值，失败时回滚） */
async function handleToggleEnabled(row) {
  const next = !!row.enabled
  try {
    await updateFeeItem(row.id, buildPayload(row, next))
    ElMessage.success(next ? '已启用' : '已停用')
  } catch (e) {
    row.enabled = !next
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除收费项目「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await deleteFeeItem(row.id)
    ElMessage.success('删除成功')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
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
          <span class="page-title">收费项目配置</span>
          <span class="page-subtitle">仅管理员可维护；停用后不参与账单生成</span>
        </div>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          <span>新增项目</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.type" placeholder="项目类型" clearable>
          <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.chargeMode" placeholder="计费方式" clearable>
          <el-option
            v-for="item in chargeModeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="query.enabled" placeholder="启用状态" clearable>
          <el-option v-for="item in enabledOptions" :key="String(item.value)" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="项目名称 / 编码" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无收费项目">
        <el-table-column prop="name" label="项目名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="code" label="编码" min-width="110">
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>
        <el-table-column prop="type" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('feeType', row.type)" size="small" effect="light">
              {{ dictLabel('feeType', row.type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="chargeMode" label="计费方式" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('chargeMode', row.chargeMode)" size="small" effect="plain">
              {{ dictLabel('chargeMode', row.chargeMode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="unitPrice" label="单价" width="110" align="right">
          <template #default="{ row }">
            <span class="amount-cell">{{ formatPrice(row.unitPrice) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="priceUnit" label="单位" width="90" align="center">
          <template #default="{ row }">{{ row.priceUnit || '-' }}</template>
        </el-table-column>
        <el-table-column prop="period" label="收费周期" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('period', row.period)" size="small" effect="plain">
              {{ dictLabel('period', row.period) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="communityName" label="适用小区" min-width="130">
          <template #default="{ row }">{{ row.communityName || '全局' }}</template>
        </el-table-column>
        <el-table-column prop="sortNo" label="排序" width="80" align="right">
          <template #default="{ row }">{{ row.sortNo ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch v-model="row.enabled" @change="handleToggleEnabled(row)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="项目名称" prop="name">
              <el-input v-model="form.name" maxlength="50" placeholder="例：物业管理费" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="项目编码" prop="code">
              <el-input v-model="form.code" maxlength="50" placeholder="唯一编码，可留空" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="项目类型" prop="type">
              <el-select v-model="form.type" style="width: 100%">
                <el-option v-for="item in typeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计费方式" prop="chargeMode">
              <el-select v-model="form.chargeMode" style="width: 100%">
                <el-option
                  v-for="item in chargeModeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单价" prop="unitPrice">
              <el-input-number
                v-model="form.unitPrice"
                :min="0"
                :max="999999"
                :precision="4"
                :step="0.5"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="计价单位" prop="priceUnit">
              <el-select
                v-model="form.priceUnit"
                filterable
                allow-create
                default-first-option
                clearable
                placeholder="例：元/㎡"
                style="width: 100%"
              >
                <el-option v-for="unit in priceUnitOptions" :key="unit" :label="unit" :value="unit" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="收费周期" prop="period">
              <el-select v-model="form.period" style="width: 100%">
                <el-option v-for="item in periodOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用小区" prop="communityId">
              <el-select v-model="form.communityId" placeholder="留空表示全局项目" clearable filterable style="width: 100%">
                <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="排序号" prop="sortNo">
              <el-input-number v-model="form.sortNo" :min="0" :max="9999" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="启用" prop="enabled">
              <el-switch v-model="form.enabled" />
            </el-form-item>
          </el-col>
        </el-row>
        <div class="form-tip">
          按用量（METER）项目需要先抄表，账单生成时取该房该账期抄表用量；无抄表记录会跳过并计入生成结果的跳过原因。
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
