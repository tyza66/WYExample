<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createUser, disableUser, listUsers, resetUserPassword, updateUser } from '@/api/user'
import { communityOptions } from '@/api/community'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatDateTime } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增用户')
const formRef = ref(null)

const query = reactive({
  keyword: '',
  role: '',
  enabled: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)

const form = reactive({
  id: null,
  username: '',
  realName: '',
  password: '',
  role: 'CASHIER',
  phone: '',
  enabled: true,
  dataScope: 'ALL',
  communityIds: [],
  remark: ''
})

/** 可见小区选项（dataScope = COMMUNITY 时启用） */
const communityList = ref([])
const dataScopeOptions = dictOptions('dataScope')

const rules = {
  username: [{ required: true, message: '请输入登录名', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [
    {
      validator: (rule, value, callback) => {
        if (!form.id && !value) return callback(new Error('新增用户必须设置密码'))
        if (value && String(value).length < 6) return callback(new Error('密码至少 6 位'))
        callback()
      },
      trigger: 'blur'
    }
  ],
  communityIds: [
    {
      validator: (rule, value, callback) => {
        if (form.dataScope === 'COMMUNITY' && (!value || value.length === 0)) {
          return callback(new Error('数据范围为「指定小区」时，至少选择一个小区'))
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}

const roleOptions = dictOptions('role')
const enabledOptions = [
  { value: '', label: '全部' },
  { value: true, label: '启用' },
  { value: false, label: '停用' }
]

async function loadData() {
  loading.value = true
  try {
    const data = await listUsers({ ...query })
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
  query.keyword = ''
  query.role = ''
  query.enabled = ''
  query.page = 1
  loadData()
}

function resetForm() {
  form.id = null
  form.username = ''
  form.realName = ''
  form.password = ''
  form.role = 'CASHIER'
  form.phone = ''
  form.enabled = true
  form.dataScope = 'ALL'
  form.communityIds = []
  form.remark = ''
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增用户'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    username: row.username ?? '',
    realName: row.realName ?? '',
    password: '',
    role: row.role ?? 'CASHIER',
    phone: row.phone ?? '',
    enabled: !!row.enabled,
    dataScope: row.dataScope ?? 'ALL',
    communityIds: Array.isArray(row.communityIds) ? [...row.communityIds] : [],
    remark: row.remark ?? ''
  })
  dialogTitle.value = '编辑用户'
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  // 密码为空表示不修改（仅编辑时允许）
  const payload = {
    username: form.username,
    realName: form.realName,
    role: form.role,
    phone: form.phone || null,
    enabled: !!form.enabled,
    dataScope: form.dataScope,
    communityIds: form.dataScope === 'COMMUNITY' ? form.communityIds : [],
    remark: form.remark || null
  }
  if (form.password) payload.password = form.password

  submitting.value = true
  try {
    if (form.id) {
      await updateUser(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createUser(payload)
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

async function handleResetPassword(row) {
  try {
    await ElMessageBox.confirm(`确定把用户「${row.username}」的密码重置为 123456 吗？`, '重置密码', {
      type: 'warning',
      confirmButtonText: '重置',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await resetUserPassword(row.id)
    ElMessage.success('密码已重置为 123456')
  } catch (e) {
    // 提示已由拦截器处理
  }
}

/** 停用（软删除，后端不可停用自己） */
async function handleDisable(row) {
  row.enabled = false
  await handleToggleEnabled(row)
}

/** 启用 / 停用切换：开启用 PUT 更新 enabled，关闭走 DELETE 停用接口，失败或取消均回滚 */
async function handleToggleEnabled(row) {
  if (row.enabled) {
    try {
      await updateUser(row.id, {
        username: row.username,
        realName: row.realName,
        role: row.role,
        phone: row.phone || null,
        enabled: true,
        dataScope: row.dataScope || 'ALL',
        communityIds: Array.isArray(row.communityIds) ? row.communityIds : [],
        remark: row.remark || null
      })
      ElMessage.success('已启用')
    } catch (e) {
      row.enabled = false
    }
    return
  }

  if (row.username === userStore.username) {
    row.enabled = true
    ElMessage.warning('不能停用当前登录账号')
    return
  }

  try {
    await ElMessageBox.confirm(`确定停用用户「${row.username}」吗？停用后该账号不可登录。`, '停用确认', {
      type: 'warning',
      confirmButtonText: '停用',
      cancelButtonText: '取消'
    })
  } catch (e) {
    row.enabled = true
    return
  }

  try {
    await disableUser(row.id)
    ElMessage.success('已停用')
    loadData()
  } catch (e) {
    row.enabled = true
  }
}

onMounted(async () => {
  try {
    communityList.value = (await communityOptions()) || []
  } catch (e) {
    communityList.value = []
  }
  loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">用户管理</span>
          <span class="page-subtitle">仅管理员可维护；密码为空表示不修改</span>
        </div>
        <el-button type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          <span>新增用户</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="登录名 / 姓名" clearable @keyup.enter="handleSearch" />
        <el-select v-model="query.role" placeholder="角色" clearable>
          <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.enabled" placeholder="启用状态" clearable>
          <el-option
            v-for="item in enabledOptions"
            :key="String(item.value)"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无用户数据">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="username" label="登录名" min-width="130" />
        <el-table-column prop="realName" label="姓名" min-width="120">
          <template #default="{ row }">{{ row.realName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="role" label="角色" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('role', row.role)" size="small" effect="light">
              {{ dictLabel('role', row.role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" min-width="130">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="dataScope" label="数据范围" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('dataScope', row.dataScope || 'ALL')" size="small" effect="light">
              {{ dictLabel('dataScope', row.dataScope || 'ALL') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="communityIds" label="可见小区" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <template v-if="(row.dataScope || 'ALL') === 'ALL'">全部小区</template>
            <template v-else>
              {{ (row.communityIds || []).map((cid) => communityList.find((c) => c.id === cid)?.label || cid).join('、') || '-' }}
            </template>
          </template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              v-model="row.enabled"
              :disabled="row.username === userStore.username"
              @change="handleToggleEnabled(row)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="210" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="warning" size="small" @click="handleResetPassword(row)">重置密码</el-button>
              <el-button
                link
                type="danger"
                size="small"
                :disabled="row.username === userStore.username"
                @click="handleDisable(row)"
              >
                停用
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="登录名" prop="username">
          <el-input v-model="form.username" maxlength="50" placeholder="登录账号" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="form.realName" maxlength="50" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            maxlength="50"
            :placeholder="form.id ? '留空表示不修改' : '新增用户必填，至少 6 位'"
          />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" style="width: 100%">
            <el-option v-for="item in roleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" maxlength="20" placeholder="可留空" />
        </el-form-item>
        <el-form-item label="启用" prop="enabled">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="数据范围" prop="dataScope">
          <el-radio-group v-model="form.dataScope">
            <el-radio-button v-for="item in dataScopeOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.dataScope === 'COMMUNITY'" label="可见小区" prop="communityIds">
          <el-select v-model="form.communityIds" multiple collapse-tags collapse-tags-tooltip placeholder="选择该用户可见的小区" style="width: 100%">
            <el-option v-for="item in communityList" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
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
