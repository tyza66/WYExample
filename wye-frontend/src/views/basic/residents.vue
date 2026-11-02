<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createResident, deleteResident, listResidents, updateResident } from '@/api/resident'
import { communityOptions } from '@/api/community'
import { roomOptions } from '@/api/room'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatDate, today } from '@/utils/format'
import { exportBackend } from '@/utils/export'

const userStore = useUserStore()

const loading = ref(false)
const exporting = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增住户')
const formRef = ref(null)

const query = reactive({
  communityId: '',
  roomId: '',
  residentType: '',
  status: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const queryRooms = ref([])
const formRooms = ref([])

const form = reactive({
  id: null,
  communityId: null,
  roomId: null,
  name: '',
  phone: '',
  idCard: '',
  residentType: 'OWNER',
  startDate: today(),
  endDate: null,
  status: 'LIVING',
  remark: ''
})

const rules = {
  communityId: [{ required: true, message: '请选择所属小区', trigger: 'change' }],
  roomId: [{ required: true, message: '请选择所属房屋', trigger: 'change' }],
  name: [{ required: true, message: '请输入住户姓名', trigger: 'blur' }],
  residentType: [{ required: true, message: '请选择住户类型', trigger: 'change' }],
  status: [{ required: true, message: '请选择住户状态', trigger: 'change' }]
}

const residentTypeOptions = dictOptions('residentType')
const statusOptions = dictOptions('residentStatus')

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadQueryRooms(communityId, keyword) {
  try {
    queryRooms.value = (await roomOptions({ communityId: communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    queryRooms.value = []
  }
}

async function loadFormRooms(communityId, keyword) {
  try {
    formRooms.value = (await roomOptions({ communityId: communityId || undefined, keyword: keyword || undefined })) || []
  } catch (e) {
    formRooms.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listResidents({ ...query })
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
  query.roomId = ''
  query.residentType = ''
  query.status = ''
  query.keyword = ''
  queryRooms.value = []
  query.page = 1
  loadData()
}

// 搜索栏：小区 -> 房屋联动
watch(
  () => query.communityId,
  (value) => {
    query.roomId = ''
    loadQueryRooms(value)
    handleSearch()
  }
)

// 弹窗：小区 -> 房屋联动
watch(
  () => form.communityId,
  (value) => {
    form.roomId = null
    loadFormRooms(value)
  }
)

function resetForm() {
  form.id = null
  form.communityId = query.communityId || null
  form.roomId = query.roomId || null
  form.name = ''
  form.phone = ''
  form.idCard = ''
  form.residentType = 'OWNER'
  form.startDate = today()
  form.endDate = null
  form.status = 'LIVING'
  form.remark = ''
  formRooms.value = queryRooms.value
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增住户'
  dialogVisible.value = true
  if (form.communityId) loadFormRooms(form.communityId)
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    communityId: row.communityId ?? null,
    roomId: row.roomId ?? null,
    name: row.name ?? '',
    phone: row.phone ?? '',
    // 列表返回的是脱敏值，编辑时留空表示不修改（由用户重新填写才提交）
    idCard: '',
    residentType: row.residentType ?? 'OWNER',
    startDate: row.startDate || today(),
    endDate: row.endDate || null,
    status: row.status ?? 'LIVING',
    remark: row.remark ?? ''
  })
  dialogTitle.value = '编辑住户'
  dialogVisible.value = true
  // 编辑时若已知小区，加载可选的房屋列表；同时把当前房屋塞进去避免显示成 id
  const communityId = form.communityId
  loadFormRooms(communityId).then(() => {
    if (row.roomId && !formRooms.value.some((item) => item.id === row.roomId)) {
      formRooms.value = [{ id: row.roomId, label: row.roomNo || `房屋#${row.roomId}` }, ...formRooms.value]
    }
  })
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  const payload = {
    roomId: form.roomId,
    name: form.name,
    phone: form.phone || null,
    residentType: form.residentType,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    status: form.status,
    remark: form.remark || null
  }
  // 证件号仅在填写时提交；不填则不覆盖后端已有值
  if (form.idCard) payload.idCard = form.idCard

  submitting.value = true
  try {
    if (form.id) {
      await updateResident(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createResident(payload)
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

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除住户「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await deleteResident(row.id)
    ElMessage.success('删除成功')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  }
}

/** 导出当前筛选条件下的住户（后端 CSV，/api/export/residents） */
async function handleExport() {
  exporting.value = true
  try {
    await exportBackend('residents', { ...query, page: undefined, size: undefined }, '住户')
    ElMessage.success('已开始下载住户 CSV')
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    exporting.value = false
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
          <span class="page-title">住户管理</span>
          <span class="page-subtitle">证件号为后端脱敏返回值（保留前 6 后 4）</span>
        </div>
        <div class="table-actions">
          <el-button :loading="exporting" @click="handleExport">
            <el-icon><Download /></el-icon>
            <span>导出 CSV</span>
          </el-button>
          <el-button v-if="userStore.isAdmin" type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            <span>新增住户</span>
          </el-button>
        </div>
      </div>

      <div class="search-bar">
        <el-select v-model="query.communityId" placeholder="全部小区" clearable>
          <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select
          v-model="query.roomId"
          placeholder="全部房屋"
          clearable
          filterable
          remote
          :remote-method="(kw) => loadQueryRooms(query.communityId, kw)"
          :disabled="!query.communityId"
        >
          <el-option v-for="item in queryRooms" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.residentType" placeholder="住户类型" clearable>
          <el-option
            v-for="item in residentTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-select v-model="query.status" placeholder="住户状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="姓名 / 电话" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无住户数据">
        <el-table-column prop="communityName" label="小区" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" min-width="110">
          <template #default="{ row }">{{ row.roomNo || '-' }}</template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="phone" label="联系电话" min-width="130">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="idCard" label="证件号（脱敏）" min-width="170">
          <template #default="{ row }">
            <span class="text-muted">{{ row.idCard || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="residentType" label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('residentType', row.residentType)" size="small" effect="light">
              {{ dictLabel('residentType', row.residentType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="startDate" label="入住日期" width="110" align="center">
          <template #default="{ row }">{{ formatDate(row.startDate) }}</template>
        </el-table-column>
        <el-table-column prop="endDate" label="迁出日期" width="110" align="center">
          <template #default="{ row }">{{ formatDate(row.endDate) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('residentStatus', row.status)" size="small" effect="light">
              {{ dictLabel('residentStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="userStore.isAdmin" label="操作" width="150" fixed="right" align="center">
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="620px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="所属小区" prop="communityId">
              <el-select v-model="form.communityId" placeholder="请选择小区" filterable style="width: 100%">
                <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="所属房屋" prop="roomId">
              <el-select
                v-model="form.roomId"
                placeholder="请先选择小区"
                filterable
                remote
                :remote-method="(kw) => loadFormRooms(form.communityId, kw)"
                :disabled="!form.communityId"
                style="width: 100%"
              >
                <el-option v-for="item in formRooms" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" maxlength="50" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" maxlength="20" placeholder="请输入手机号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="证件号" prop="idCard">
              <el-input v-model="form.idCard" maxlength="50" placeholder="不填则不修改" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="住户类型" prop="residentType">
              <el-select v-model="form.residentType" style="width: 100%">
                <el-option
                  v-for="item in residentTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入住日期" prop="startDate">
              <el-date-picker
                v-model="form.startDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="迁出日期" prop="endDate">
              <el-date-picker
                v-model="form.endDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="在住可留空"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="住户状态" prop="status">
              <el-select v-model="form.status" style="width: 100%">
                <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="3" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
