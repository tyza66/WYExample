<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { cancelBankContract, createBankContract, listBankContracts, updateBankContract } from '@/api/bank'
import { roomOptions } from '@/api/room'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatDate } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({ roomId: '', status: '', keyword: '', page: 1, size: 10 })
const list = ref([])
const total = ref(0)
const roomSelect = ref([])
const statusOptions = dictOptions('bankContractStatus')

const dialogVisible = ref(false)
const dialogTitle = ref('新增签约')
const formRef = ref(null)
const form = reactive({
  id: null,
  roomId: null,
  bankName: '',
  accountName: '',
  accountNoMasked: '',
  contractNo: '',
  signedAt: '',
  status: 'ACTIVE',
  remark: ''
})
const formRooms = ref([])

const rules = {
  roomId: [{ required: true, message: '请选择房屋', trigger: 'change' }],
  bankName: [{ required: true, message: '请输入银行名称', trigger: 'blur' }],
  accountName: [{ required: true, message: '请输入账户名', trigger: 'blur' }],
  contractNo: [{ required: true, message: '请输入签约号', trigger: 'blur' }],
  accountNoMasked: [
    { required: true, message: '请输入掩码账号', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (!/^\d{4}\*{4}\d{4}$/.test(String(value || ''))) {
          return callback(new Error('掩码格式如 6222****1234（前 4 位 + 4 个 * + 后 4 位）'))
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

async function loadRoomSelect() {
  try {
    roomSelect.value = (await roomOptions({})) || []
  } catch (e) {
    roomSelect.value = []
  }
}

async function searchFormRooms(keyword) {
  try {
    formRooms.value = (await roomOptions({ keyword: keyword || undefined })) || []
  } catch (e) {
    formRooms.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listBankContracts({ ...query })
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
  query.status = ''
  query.keyword = ''
  handleSearch()
}

function resetForm() {
  Object.assign(form, {
    id: null,
    roomId: null,
    bankName: '',
    accountName: '',
    accountNoMasked: '',
    contractNo: '',
    signedAt: '',
    status: 'ACTIVE',
    remark: ''
  })
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增签约'
  searchFormRooms('')
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    roomId: row.roomId,
    bankName: row.bankName ?? '',
    accountName: row.accountName ?? '',
    accountNoMasked: row.accountNoMasked ?? '',
    contractNo: row.contractNo ?? '',
    signedAt: row.signedAt ?? '',
    status: row.status ?? 'ACTIVE',
    remark: row.remark ?? ''
  })
  dialogTitle.value = '编辑签约'
  searchFormRooms('')
  dialogVisible.value = true
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
    bankName: form.bankName,
    accountName: form.accountName,
    accountNoMasked: form.accountNoMasked,
    contractNo: form.contractNo,
    signedAt: form.signedAt || null,
    status: form.status,
    remark: form.remark || null
  }
  submitting.value = true
  try {
    if (form.id) {
      await updateBankContract(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createBankContract(payload)
      ElMessage.success('签约成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

async function handleCancel(row) {
  try {
    await ElMessageBox.confirm(`确定与「${row.accountName}」解约吗？解约后不再参与代扣。`, '解约确认', {
      type: 'warning',
      confirmButtonText: '解约',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await cancelBankContract(row.id)
    ElMessage.success('已解约')
    loadData()
  } catch (e) {
    // 拦截器已提示
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
          <span class="page-title">代扣签约</span>
          <span class="page-subtitle">只保存掩码账号（如 6222****1234），禁止录入完整卡号</span>
        </div>
        <el-button v-if="userStore.isAdmin" type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          <span>新增签约</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-select v-model="query.status" placeholder="签约状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="房号 / 户名 / 签约号" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无签约记录">
        <el-table-column prop="roomNo" label="房号" width="110" fixed="left" />
        <el-table-column prop="ownerName" label="业主" width="110">
          <template #default="{ row }">{{ row.ownerName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="bankName" label="银行" min-width="130" />
        <el-table-column prop="accountName" label="户名" min-width="110" />
        <el-table-column prop="accountNoMasked" label="账号（掩码）" width="150" />
        <el-table-column prop="contractNo" label="签约号" min-width="150" />
        <el-table-column prop="signedAt" label="签约日期" width="120" align="center">
          <template #default="{ row }">{{ formatDate(row.signedAt) }}</template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('bankContractStatus', row.status)" size="small" effect="light">
              {{ dictLabel('bankContractStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="userStore.isAdmin" label="操作" width="130" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" :disabled="row.status === 'CANCELLED'" @click="handleCancel(row)">
                解约
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="基于隐私与合规要求，本系统只保存掩码账号，不落库完整银行卡号。"
        style="margin-bottom: 14px"
      />
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="房屋" prop="roomId">
          <el-select v-model="form.roomId" placeholder="输入房号搜索" filterable remote clearable :remote-method="searchFormRooms" style="width: 100%">
            <el-option v-for="item in formRooms" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="银行名称" prop="bankName">
          <el-input v-model="form.bankName" maxlength="50" placeholder="例：中国工商银行" />
        </el-form-item>
        <el-form-item label="账户名" prop="accountName">
          <el-input v-model="form.accountName" maxlength="50" />
        </el-form-item>
        <el-form-item label="账号掩码" prop="accountNoMasked">
          <el-input v-model="form.accountNoMasked" maxlength="20" placeholder="6222****1234" />
        </el-form-item>
        <el-form-item label="签约号" prop="contractNo">
          <el-input v-model="form.contractNo" maxlength="50" />
        </el-form-item>
        <el-form-item label="签约日期">
          <el-date-picker v-model="form.signedAt" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="form.id" label="状态">
          <el-select v-model="form.status" style="width: 100%">
            <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="255" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
