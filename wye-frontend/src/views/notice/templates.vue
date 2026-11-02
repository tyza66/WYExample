<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createNoticeTemplate, deleteNoticeTemplate, listNoticeTemplates, updateNoticeTemplate } from '@/api/notice'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const keyword = ref('')

const list = ref([])
const channelOptions = dictOptions('noticeChannel')

const dialogVisible = ref(false)
const dialogTitle = ref('新增模板')
const formRef = ref(null)
const form = reactive({ id: null, name: '', channel: 'SMS', title: '', content: '', enabled: true })

const rules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  channel: [{ required: true, message: '请选择通道', trigger: 'change' }],
  content: [{ required: true, message: '请输入模板内容', trigger: 'blur' }]
}

const placeholderTip = '可用占位符：{业主} {房号} {小区} {账期} {金额} {应缴日}'

async function loadData() {
  loading.value = true
  try {
    const data = await listNoticeTemplates({ keyword: keyword.value || undefined })
    list.value = data?.list || data || []
  } catch (e) {
    list.value = []
  } finally {
    loading.value = false
  }
}

function handleReset() {
  keyword.value = ''
  loadData()
}

function resetForm() {
  Object.assign(form, { id: null, name: '', channel: 'SMS', title: '', content: '', enabled: true })
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增模板'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    name: row.name ?? '',
    channel: row.channel ?? 'SMS',
    title: row.title ?? '',
    content: row.content ?? '',
    enabled: row.enabled !== false
  })
  dialogTitle.value = '编辑模板'
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
    channel: form.channel,
    title: form.title || null,
    content: form.content,
    enabled: !!form.enabled
  }
  submitting.value = true
  try {
    if (form.id) {
      await updateNoticeTemplate(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createNoticeTemplate(payload)
      ElMessage.success('新增成功')
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
    await ElMessageBox.confirm(`确定删除模板「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await deleteNoticeTemplate(row.id)
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
          <span class="page-title">通知模板</span>
          <span class="page-subtitle">{{ placeholderTip }}</span>
        </div>
        <el-button v-if="userStore.isAdmin" type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          <span>新增模板</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-input v-model="keyword" placeholder="模板名称" clearable @keyup.enter="loadData" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="loadData">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无通知模板">
        <el-table-column prop="name" label="模板名称" min-width="160" />
        <el-table-column prop="channel" label="通道" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('noticeChannel', row.channel)" size="small" effect="light">
              {{ dictLabel('noticeChannel', row.channel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.title || '-' }}</template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="300" show-overflow-tooltip />
        <el-table-column prop="enabled" label="启用" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small" effect="plain">
              {{ row.enabled ? '启用' : '停用' }}
            </el-tag>
          </template>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="模板名称" prop="name">
          <el-input v-model="form.name" maxlength="50" />
        </el-form-item>
        <el-form-item label="通道" prop="channel">
          <el-select v-model="form.channel" style="width: 100%">
            <el-option v-for="item in channelOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="form.title" maxlength="100" placeholder="邮件标题，短信可留空" />
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="5" maxlength="1000" show-word-limit :placeholder="placeholderTip" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>
