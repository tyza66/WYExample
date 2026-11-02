<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createBuilding, deleteBuilding, listBuildings, updateBuilding } from '@/api/building'
import { communityOptions } from '@/api/community'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('新增楼栋')
const formRef = ref(null)

const query = reactive({
  communityId: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])

const form = reactive({
  id: null,
  communityId: null,
  name: '',
  unitCount: 1,
  remark: ''
})

const rules = {
  communityId: [{ required: true, message: '请选择所属小区', trigger: 'change' }],
  name: [{ required: true, message: '请输入楼栋名称', trigger: 'blur' }]
}

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
    const data = await listBuildings({ ...query })
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
  query.keyword = ''
  query.page = 1
  loadData()
}

function resetForm() {
  form.id = null
  form.communityId = query.communityId || null
  form.name = ''
  form.unitCount = 1
  form.remark = ''
  formRef.value?.clearValidate()
}

function handleCreate() {
  resetForm()
  dialogTitle.value = '新增楼栋'
  dialogVisible.value = true
}

function handleEdit(row) {
  resetForm()
  Object.assign(form, {
    id: row.id,
    communityId: row.communityId ?? null,
    name: row.name ?? '',
    unitCount: row.unitCount ?? 1,
    remark: row.remark ?? ''
  })
  dialogTitle.value = '编辑楼栋'
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
    communityId: form.communityId,
    name: form.name,
    unitCount: form.unitCount ?? 1,
    remark: form.remark || null
  }

  submitting.value = true
  try {
    if (form.id) {
      await updateBuilding(form.id, payload)
      ElMessage.success('修改成功')
    } else {
      await createBuilding(payload)
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
    await ElMessageBox.confirm(`确定删除楼栋「${row.name}」吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    await deleteBuilding(row.id)
    ElMessage.success('删除成功')
    if (list.value.length === 1 && query.page > 1) query.page -= 1
    loadData()
  } catch (e) {
    // 提示已由拦截器处理
  }
}

// 打开弹窗时若小区下拉尚未加载，补一次
watch(dialogVisible, (visible) => {
  if (visible && communities.value.length === 0) loadCommunities()
})

onMounted(async () => {
  await loadCommunities()
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <span class="page-title">楼栋管理</span>
        <el-button v-if="userStore.isAdmin" type="primary" @click="handleCreate">
          <el-icon><Plus /></el-icon>
          <span>新增楼栋</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.communityId" placeholder="全部小区" clearable>
          <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-input v-model="query.keyword" placeholder="楼栋名称" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无楼栋数据">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="communityName" label="所属小区" min-width="150">
          <template #default="{ row }">{{ row.communityName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="name" label="楼栋名称" min-width="140" />
        <el-table-column prop="unitCount" label="单元数" width="100" align="right">
          <template #default="{ row }">{{ row.unitCount ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" show-overflow-tooltip>
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
        <el-form-item label="所属小区" prop="communityId">
          <el-select v-model="form.communityId" placeholder="请选择小区" filterable style="width: 100%">
            <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="楼栋名称" prop="name">
          <el-input v-model="form.name" maxlength="50" placeholder="例：1 号楼" />
        </el-form-item>
        <el-form-item label="单元数" prop="unitCount">
          <el-input-number v-model="form.unitCount" :min="1" :max="999" :step="1" style="width: 100%" />
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
