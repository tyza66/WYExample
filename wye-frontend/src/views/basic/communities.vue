<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createCommunity,
  deleteCommunity,
  listCommunities,
  updateCommunity
} from '@/api/community'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增小区')
const formRef = ref(null)

const query = reactive({
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)

const form = reactive({
  id: null,
  name: '',
  code: '',
  address: '',
  manager: '',
  phone: '',
  remark: ''
})

const rules = {
  name: [{ required: true, message: '请输入小区名称', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const data = await listCommunities({ ...query })
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
  query.keyword = ''
  query.page = 1
  loadData()
}

function resetForm() {
  form.id = null
  form.name = ''
  form.code = ''
  form.address = ''
  form.manager = ''
  form.phone = ''
  form.remark = ''
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增小区'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    name: row.name ?? '',
    code: row.code ?? '',
    address: row.address ?? '',
    manager: row.manager ?? '',
    phone: row.phone ?? '',
    remark: row.remark ?? ''
  })
  dialogTitle.value = '编辑小区'
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
    code: form.code || null,
    address: form.address || null,
    manager: form.manager || null,
    phone: form.phone || null,
    remark: form.remark || null
  }

  submitting.value = true
  try {
    if (form.id) {
      await updateCommunity(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createCommunity(payload)
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
    await ElMessageBox.confirm(`确定删除小区「${row.name}」吗？该小区下的楼栋、房屋需先处理。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await deleteCommunity(row.id)
    ElMessage.success('删除成功')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  }
}

onMounted(loadData)
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <span class="page-title">小区管理</span>
        <el-button v-if="userStore.isAdmin" type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          <span>新增小区</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-input v-model="query.keyword" placeholder="小区名称 / 编码" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无小区数据">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="name" label="小区名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="code" label="小区编码" min-width="120">
          <template #default="{ row }">{{ row.code || '-' }}</template>
        </el-table-column>
        <el-table-column prop="address" label="地址" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.address || '-' }}</template>
        </el-table-column>
        <el-table-column prop="manager" label="物业负责人" min-width="110">
          <template #default="{ row }">{{ row.manager || '-' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="联系电话" min-width="130">
          <template #default="{ row }">{{ row.phone || '-' }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="小区名称" prop="name">
          <el-input v-model="form.name" maxlength="100" placeholder="请输入小区名称" />
        </el-form-item>
        <el-form-item label="小区编码" prop="code">
          <el-input v-model="form.code" maxlength="50" placeholder="唯一编码，可留空" />
        </el-form-item>
        <el-form-item label="地址" prop="address">
          <el-input v-model="form.address" maxlength="255" placeholder="请输入地址" />
        </el-form-item>
        <el-form-item label="物业负责人" prop="manager">
          <el-input v-model="form.manager" maxlength="50" placeholder="请输入负责人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" maxlength="20" placeholder="请输入联系电话" />
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
