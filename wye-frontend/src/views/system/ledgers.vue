<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createLedger, deleteLedger, listLedgers, updateLedger } from '@/api/ledger'
import { useUserStore } from '@/stores/user'
import { formatDateTime } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')

const list = ref([])

const dialogVisible = ref(false)
const dialogTitle = ref('新建账套')
const formRef = ref(null)
const form = reactive({ id: null, name: '', code: '', company: '', enabled: true, remark: '' })

const rules = {
  name: [{ required: true, message: '请输入账套名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入账套编码', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const data = await listLedgers({ keyword: keyword.value || undefined })
    list.value = data?.list || data || []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function resetForm() {
  Object.assign(form, { id: null, name: '', code: '', company: '', enabled: true, remark: '' })
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新建账套'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    name: row.name ?? '',
    code: row.code ?? '',
    company: row.company ?? '',
    enabled: row.enabled !== false,
    remark: row.remark ?? ''
  })
  dialogTitle.value = '修改账套'
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
    name: form.name,
    code: form.code,
    company: form.company || null,
    enabled: !!form.enabled,
    remark: form.remark || null
  }
  submitting.value = true
  try {
    if (form.id) {
      await updateLedger(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createLedger(payload)
      ElMessage.success('新建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除账套「${row.name}」吗？有小区归属时不可删除。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await deleteLedger(row.id)
    ElMessage.success('已删除')
    loadData()
  } catch (e) {
    // 拦截器已提示
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">账套管理</span>
          <span class="page-subtitle">小区归属账套，为空归默认账套；列表/报表可按账套过滤</span>
        </div>
        <el-button v-if="userStore.isAdmin" type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          <span>新建账套</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-input v-model="keyword" placeholder="账套名称 / 编码" clearable @keyup.enter="loadData" />
        <div class="search-actions">
          <el-button @click="keyword = ''; loadData()">重置</el-button>
          <el-button type="primary" @click="loadData">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无账套">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="name" label="账套名称" min-width="160" />
        <el-table-column prop="code" label="编码" min-width="120" />
        <el-table-column prop="company" label="主体公司" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.company || '-' }}</template>
        </el-table-column>
        <el-table-column prop="communityCount" label="小区数" width="90" align="right">
          <template #default="{ row }">{{ row.communityCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column prop="enabled" label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="plain">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.remark || '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column v-if="userStore.isAdmin" label="操作" width="130" fixed="right" align="center">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="账套名称" prop="name">
          <el-input v-model="form.name" maxlength="50" />
        </el-form-item>
        <el-form-item label="编码" prop="code">
          <el-input v-model="form.code" maxlength="50" />
        </el-form-item>
        <el-form-item label="主体公司">
          <el-input v-model="form.company" maxlength="100" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
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
