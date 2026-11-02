<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { IMPORT_COLUMNS, IMPORT_TYPE_LABELS, importData, listImportLogs } from '@/api/data'
import { dictLabel, dictOptions } from '@/utils/dict'
import { formatDateTime } from '@/utils/format'

const activeType = ref('rooms')
const typeOptions = Object.keys(IMPORT_TYPE_LABELS)
const fileInput = ref(null)
const fileName = ref('')
const content = ref('')
const importing = ref(false)
const result = ref(null)

const logsLoading = ref(false)
const logs = ref([])
const logsTotal = ref(0)
const logsQuery = reactive({ type: '', page: 1, size: 10 })

const columns = ref(IMPORT_COLUMNS.rooms || [])

function handleTypeChange(value) {
  activeType.value = value
  columns.value = IMPORT_COLUMNS[value] || []
  content.value = ''
  fileName.value = ''
  result.value = null
}

function handlePickFile() {
  fileInput.value?.click()
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  fileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    content.value = String(reader.result || '')
  }
  reader.readAsText(file, 'utf-8')
  event.target.value = ''
}

function handleClear() {
  content.value = ''
  fileName.value = ''
  result.value = null
}

async function handleImport() {
  if (!content.value.trim()) {
    ElMessage.warning('请粘贴 CSV 内容或选择文件')
    return
  }
  importing.value = true
  try {
    const data = await importData(activeType.value, { fileName: fileName.value || null, content: content.value })
    result.value = data || null
    ElMessage.success(`导入完成：成功 ${data?.success ?? 0} 行，失败 ${data?.failed ?? 0} 行`)
    loadLogs()
  } catch (e) {
    // 拦截器已提示
  } finally {
    importing.value = false
  }
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const data = await listImportLogs({ ...logsQuery })
    logs.value = data?.list || []
    logsTotal.value = data?.total || 0
  } catch (e) {
    logs.value = []
    logsTotal.value = 0
  } finally {
    logsLoading.value = false
  }
}

function handleLogsSearch() {
  logsQuery.page = 1
  loadLogs()
}

onMounted(() => {
  columns.value = IMPORT_COLUMNS[activeType.value] || []
  loadLogs()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">数据导入</span>
          <span class="page-subtitle">支持粘贴文本或选择 CSV 文件；逐行校验，失败行给出原因</span>
        </div>
      </div>

      <el-radio-group :model-value="activeType" @change="handleTypeChange">
        <el-radio-button v-for="type in typeOptions" :key="type" :value="type">
          {{ IMPORT_TYPE_LABELS[type] }}
        </el-radio-button>
      </el-radio-group>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin: 14px 0"
        :title="`CSV 表头：${columns.join(',')}`"
      />

      <el-form label-width="90px">
        <el-form-item label="CSV 内容">
          <el-input
            v-model="content"
            type="textarea"
            :rows="10"
            :placeholder="`首行为表头：${columns.join(',')}\n示例数据另起一行`"
          />
        </el-form-item>
        <el-form-item label="选择文件">
          <input ref="fileInput" type="file" accept=".csv,.txt" style="display: none" @change="handleFileChange" />
          <el-space>
            <el-button @click="handlePickFile">
              <el-icon><Upload /></el-icon>
              <span>选择 CSV 文件</span>
            </el-button>
            <span v-if="fileName" class="form-tip">已选择：{{ fileName }}</span>
            <el-button @click="handleClear">清空</el-button>
          </el-space>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="importing" @click="handleImport">开始导入</el-button>
        </el-form-item>
      </el-form>

      <template v-if="result">
        <div class="stat-grid" style="grid-template-columns: repeat(3, 1fr)">
          <div class="stat-card is-count">
            <div class="stat-label">总行数</div>
            <div class="stat-value">{{ result.total ?? 0 }}</div>
          </div>
          <div class="stat-card is-received">
            <div class="stat-label">成功</div>
            <div class="stat-value">{{ result.success ?? 0 }}</div>
          </div>
          <div class="stat-card is-arrears">
            <div class="stat-label">失败</div>
            <div class="stat-value">{{ result.failed ?? 0 }}</div>
          </div>
        </div>

        <div class="page-title" style="margin: 10px 0 8px">失败明细</div>
        <el-table :data="result.errors || []" border size="small" max-height="280" empty-text="没有失败行">
          <el-table-column prop="line" label="行号" width="90" align="center" />
          <el-table-column prop="message" label="错误原因" min-width="320" show-overflow-tooltip />
        </el-table>
      </template>
    </div>

    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">导入记录</span>
        </div>
      </div>

      <div class="search-bar">
        <el-select v-model="logsQuery.type" placeholder="导入类型" clearable @change="handleLogsSearch">
          <el-option
            v-for="item in dictOptions('importType')"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <div class="search-actions">
          <el-button type="primary" @click="handleLogsSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="logsLoading" :data="logs" border stripe empty-text="暂无导入记录">
        <el-table-column prop="type" label="类型" width="120" align="center">
          <template #default="{ row }">{{ dictLabel('importType', row.type) }}</template>
        </el-table-column>
        <el-table-column prop="fileName" label="文件名" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.fileName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="totalCount" label="总行数" width="90" align="right" />
        <el-table-column prop="successCount" label="成功" width="90" align="right">
          <template #default="{ row }"><span class="text-success">{{ row.successCount ?? 0 }}</span></template>
        </el-table-column>
        <el-table-column prop="failCount" label="失败" width="90" align="right">
          <template #default="{ row }"><span class="text-danger">{{ row.failCount ?? 0 }}</span></template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="110" />
        <el-table-column prop="createdAt" label="导入时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-bar">
        <el-pagination
          v-model:current-page="logsQuery.page"
          v-model:page-size="logsQuery.size"
          :total="logsTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleLogsSearch"
          @current-change="loadLogs"
        />
      </div>
    </div>
  </div>
</template>
