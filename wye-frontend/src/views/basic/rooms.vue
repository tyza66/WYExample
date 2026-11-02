<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createRoom, deleteRoom, listRooms, updateRoom } from '@/api/room'
import { communityOptions } from '@/api/community'
import { buildingOptions } from '@/api/building'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { exportCsv, exportFileName } from '@/utils/export'
import { formatNumber } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增房屋')
const formRef = ref(null)

const query = reactive({
  communityId: '',
  buildingId: '',
  roomType: '',
  status: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const queryBuildings = ref([])
const formBuildings = ref([])

const form = reactive({
  id: null,
  communityId: null,
  buildingId: null,
  unit: '',
  roomNo: '',
  floor: null,
  area: null,
  roomType: 'RESIDENCE',
  status: 'VACANT',
  remark: ''
})

const rules = {
  communityId: [{ required: true, message: '请选择所属小区', trigger: 'change' }],
  buildingId: [{ required: true, message: '请选择所属楼栋', trigger: 'change' }],
  roomNo: [{ required: true, message: '请输入房号', trigger: 'blur' }],
  roomType: [{ required: true, message: '请选择房屋类型', trigger: 'change' }],
  status: [{ required: true, message: '请选择房屋状态', trigger: 'change' }]
}

const roomTypeOptions = dictOptions('roomType')
const statusOptions = dictOptions('roomStatus')

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadQueryBuildings(communityId) {
  if (!communityId) {
    queryBuildings.value = []
    return
  }
  try {
    queryBuildings.value = (await buildingOptions(communityId)) || []
  } catch (e) {
    queryBuildings.value = []
  }
}

async function loadFormBuildings(communityId) {
  if (!communityId) {
    formBuildings.value = []
    return
  }
  try {
    formBuildings.value = (await buildingOptions(communityId)) || []
  } catch (e) {
    formBuildings.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listRooms({ ...query })
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
  query.roomType = ''
  query.status = ''
  query.keyword = ''
  queryBuildings.value = []
  query.page = 1
  loadData()
}

// 搜索栏小区 -> 楼栋联动
watch(
  () => query.communityId,
  (value) => {
    query.buildingId = ''
    loadQueryBuildings(value)
    handleSearch()
  }
)

// 弹窗小区 -> 楼栋联动
watch(
  () => form.communityId,
  (value) => {
    form.buildingId = null
    loadFormBuildings(value)
  }
)

function resetForm() {
  form.id = null
  form.communityId = query.communityId || null
  form.buildingId = query.buildingId || null
  form.unit = ''
  form.roomNo = ''
  form.floor = null
  form.area = null
  form.roomType = 'RESIDENCE'
  form.status = 'VACANT'
  form.remark = ''
  formBuildings.value = queryBuildings.value
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增房屋'
  dialogVisible.value = true
  if (form.communityId) loadFormBuildings(form.communityId)
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    communityId: row.communityId ?? null,
    buildingId: row.buildingId ?? null,
    unit: row.unit ?? '',
    roomNo: row.roomNo ?? '',
    floor: row.floor ?? null,
    area: row.area ?? null,
    roomType: row.roomType ?? 'RESIDENCE',
    status: row.status ?? 'VACANT',
    remark: row.remark ?? ''
  })
  dialogTitle.value = '编辑房屋'
  dialogVisible.value = true
  if (form.communityId) loadFormBuildings(form.communityId)
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  const payload = {
    communityId: form.communityId,
    buildingId: form.buildingId,
    unit: form.unit || null,
    roomNo: form.roomNo,
    floor: form.floor ?? null,
    area: form.area ?? null,
    roomType: form.roomType,
    status: form.status,
    remark: form.remark || null
  }

  submitting.value = true
  try {
    if (form.id) {
      await updateRoom(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createRoom(payload)
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
    await ElMessageBox.confirm(`确定删除房屋「${row.roomNo}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await deleteRoom(row.id)
    ElMessage.success('删除成功')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  }
}

/** 导出当前筛选条件下最多 1000 条房屋数据（前端拼接 CSV，带 BOM） */
async function handleExport() {
  loading.value = true
  try {
    const data = await listRooms({ ...query, page: 1, size: 100 })
    const rows = (data?.list || []).map((row) => [
      row.communityName,
      row.buildingName,
      row.unit,
      row.roomNo,
      row.floor,
      row.area,
      dictLabel('roomType', row.roomType),
      dictLabel('roomStatus', row.status),
      row.residentCount,
      row.remark
    ])
    exportCsv(
      exportFileName('房屋列表', query.communityId ? `小区${query.communityId}` : '全部'),
      ['小区', '楼栋', '单元', '房号', '楼层', '面积(㎡)', '房屋类型', '状态', '住户数', '备注'],
      rows,
      [null, null, null, null, null, (v) => formatNumber(v), null, null, null, null]
    )
    ElMessage.success(`已导出 ${rows.length} 条（单次最多 100 条）`)
  } catch (e) {
    // 提示已由拦截器处理
  } finally {
    loading.value = false
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
        <span class="page-title">房屋管理</span>
        <div class="table-actions">
          <el-button @click="handleExport">
            <el-icon><Download /></el-icon>
            <span>导出 CSV</span>
          </el-button>
          <el-button v-if="userStore.isAdmin" type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            <span>新增房屋</span>
          </el-button>
        </div>
      </div>

      <div class="search-bar">
        <el-select v-model="query.communityId" placeholder="全部小区" clearable>
          <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.buildingId" placeholder="全部楼栋" clearable :disabled="!query.communityId">
          <el-option v-for="item in queryBuildings" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.roomType" placeholder="房屋类型" clearable>
          <el-option v-for="item in roomTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="房屋状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="房号 / 住户名" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无房屋数据">
        <el-table-column prop="communityName" label="小区" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="buildingName" label="楼栋" min-width="110">
          <template #default="{ row }">{{ row.buildingName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="unit" label="单元" width="70" align="center">
          <template #default="{ row }">{{ row.unit || '-' }}</template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" min-width="110" />
        <el-table-column prop="floor" label="楼层" width="70" align="right">
          <template #default="{ row }">{{ row.floor ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="area" label="面积（㎡）" width="110" align="right">
          <template #default="{ row }">{{ formatNumber(row.area) }}</template>
        </el-table-column>
        <el-table-column prop="roomType" label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('roomType', row.roomType)" size="small" effect="light">
              {{ dictLabel('roomType', row.roomType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('roomStatus', row.status)" size="small" effect="light">
              {{ dictLabel('roomStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="residentCount" label="住户数" width="90" align="right">
          <template #default="{ row }">{{ row.residentCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
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
            <el-form-item label="所属楼栋" prop="buildingId">
              <el-select
                v-model="form.buildingId"
                placeholder="请先选择小区"
                filterable
                :disabled="!form.communityId"
                style="width: 100%"
              >
                <el-option v-for="item in formBuildings" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单元" prop="unit">
              <el-input v-model="form.unit" maxlength="20" placeholder="例：1" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房号" prop="roomNo">
              <el-input v-model="form.roomNo" maxlength="50" placeholder="例：1-101（小区内唯一）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="楼层" prop="floor">
              <el-input-number v-model="form.floor" :min="-5" :max="200" :step="1" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="面积（㎡）" prop="area">
              <el-input-number
                v-model="form.area"
                :min="0"
                :max="999999"
                :precision="2"
                :step="1"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房屋类型" prop="roomType">
              <el-select v-model="form.roomType" style="width: 100%">
                <el-option v-for="item in roomTypeOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="房屋状态" prop="status">
              <el-select v-model="form.status" style="width: 100%">
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
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
