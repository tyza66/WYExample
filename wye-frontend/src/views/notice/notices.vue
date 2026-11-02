<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { listNotices, listNoticeTemplates, sendNotices } from '@/api/notice'
import { listBills } from '@/api/bill'
import { communityOptions } from '@/api/community'
import { roomOptions } from '@/api/room'
import { useUserStore } from '@/stores/user'
import { dictLabel, dictOptions, dictTag } from '@/utils/dict'
import { formatAmount, formatDateTime, today, shiftPeriod } from '@/utils/format'

const userStore = useUserStore()

const loading = ref(false)
const submitting = ref(false)

const query = reactive({
  channel: '',
  status: '',
  roomId: '',
  from: '',
  to: '',
  keyword: '',
  page: 1,
  size: 10
})

const list = ref([])
const total = ref(0)
const communities = ref([])
const roomSelect = ref([])
const channelOptions = dictOptions('noticeChannel')
const statusOptions = dictOptions('noticeStatus')

// ---------- 发送 ----------
const sendVisible = ref(false)
const sendForm = reactive({ channel: 'SMS', templateId: null, period: '', communityId: null })
const templates = ref([])
const candidateBills = ref([])
const candidateLoading = ref(false)
const selectedBills = ref([])
const previewNotices = ref([])
const sendResult = ref(null)

async function loadCommunities() {
  try {
    communities.value = (await communityOptions()) || []
  } catch (e) {
    communities.value = []
  }
}

async function loadRoomSelect() {
  try {
    roomSelect.value = (await roomOptions({})) || []
  } catch (e) {
    roomSelect.value = []
  }
}

async function loadData() {
  loading.value = true
  try {
    const data = await listNotices({ ...query })
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
  query.channel = ''
  query.status = ''
  query.roomId = ''
  query.from = ''
  query.to = ''
  query.keyword = ''
  handleSearch()
}

// ---------- 发送逻辑 ----------
async function loadCandidateBills() {
  candidateLoading.value = true
  try {
    const data = await listBills({
      period: sendForm.period || undefined,
      communityId: sendForm.communityId || undefined,
      size: 100
    })
    candidateBills.value = (data?.list || []).filter(
      (bill) => ['UNPAID', 'PARTIAL'].includes(bill.status) && Number(bill.arrears) > 0
    )
  } catch (e) {
    candidateBills.value = []
  } finally {
    candidateLoading.value = false
  }
}

async function handleOpenSend() {
  sendForm.channel = 'SMS'
  sendForm.templateId = null
  sendForm.period = query.from ? query.from.slice(0, 7) : today().slice(0, 7)
  sendForm.communityId = null
  selectedBills.value = []
  previewNotices.value = []
  sendResult.value = null
  sendVisible.value = true
  try {
    templates.value = (await listNoticeTemplates()) || []
  } catch (e) {
    templates.value = []
  }
  loadCandidateBills()
}

async function handlePreview() {
  if (!sendForm.templateId) {
    ElMessage.warning('请先选择通知模板')
    return
  }
  if (!selectedBills.value.length) {
    ElMessage.warning('请至少勾选一张欠费账单')
    return
  }
  submitting.value = true
  try {
    const data = await sendNotices({
      channel: sendForm.channel,
      templateId: sendForm.templateId,
      billIds: selectedBills.value.map((item) => item.id),
      dryRun: true
    })
    previewNotices.value = data?.notices || []
    if (!previewNotices.value.length) ElMessage.warning('没有可预览的通知')
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

async function handleSend() {
  if (!sendForm.templateId) {
    ElMessage.warning('请先选择通知模板')
    return
  }
  if (!selectedBills.value.length) {
    ElMessage.warning('请至少勾选一张欠费账单')
    return
  }
  submitting.value = true
  try {
    const data = await sendNotices({
      channel: sendForm.channel,
      templateId: sendForm.templateId,
      billIds: selectedBills.value.map((item) => item.id)
    })
    sendResult.value = data || null
    ElMessage.success(`发送完成：成功 ${data?.sentCount ?? 0} 条，失败 ${data?.failedCount ?? 0} 条`)
    sendVisible.value = false
    loadData()
  } catch (e) {
    // 拦截器已提示
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  const end = today()
  query.from = shiftPeriod(end.slice(0, 7), -2) + '-01'
  query.to = end
  await Promise.all([loadCommunities(), loadRoomSelect()])
  await loadData()
})
</script>

<template>
  <div class="page-container">
    <div class="page-card">
      <div class="page-header">
        <div>
          <span class="page-title">催缴通知</span>
          <span class="page-subtitle">未配置真实通道时走内置模拟通道（provider = mock，状态置 SENT）</span>
        </div>
        <el-button v-if="userStore.canWrite" type="primary" @click="handleOpenSend">
          <el-icon><Promotion /></el-icon>
          <span>发送通知</span>
        </el-button>
      </div>

      <div class="search-bar">
        <el-select v-model="query.channel" placeholder="通道" clearable>
          <el-option v-for="item in channelOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.status" placeholder="发送状态" clearable>
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <el-select v-model="query.roomId" placeholder="全部房屋" clearable filterable>
          <el-option v-for="item in roomSelect" :key="item.id" :label="item.label" :value="item.id" />
        </el-select>
        <el-date-picker v-model="query.from" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" style="width: 150px" />
        <el-date-picker v-model="query.to" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" style="width: 150px" />
        <el-input v-model="query.keyword" placeholder="接收人 / 房号" clearable @keyup.enter="handleSearch" />
        <div class="search-actions">
          <el-button @click="handleReset">重置</el-button>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" border stripe empty-text="暂无通知记录">
        <el-table-column prop="sentAt" label="发送时间" width="170" align="center">
          <template #default="{ row }">{{ formatDateTime(row.sentAt) }}</template>
        </el-table-column>
        <el-table-column prop="channel" label="通道" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('noticeChannel', row.channel)" size="small" effect="light">
              {{ dictLabel('noticeChannel', row.channel) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="roomNo" label="房号" width="100" />
        <el-table-column prop="receiver" label="接收人" width="140" />
        <el-table-column prop="content" label="通知内容" min-width="260" show-overflow-tooltip />
        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="dictTag('noticeStatus', row.status)" size="small" effect="light">
              {{ dictLabel('noticeStatus', row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="provider" label="通道" width="90" align="center" />
        <el-table-column prop="operator" label="操作人" width="100">
          <template #default="{ row }">{{ row.operator || '-' }}</template>
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

    <!-- 发送通知 -->
    <el-dialog v-model="sendVisible" title="发送催缴通知" width="880px" destroy-on-close top="6vh">
      <el-form :model="sendForm" label-width="100px">
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="通道">
              <el-select v-model="sendForm.channel" style="width: 100%">
                <el-option v-for="item in channelOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="通知模板">
              <el-select v-model="sendForm.templateId" placeholder="选择模板" style="width: 100%">
                <el-option
                  v-for="item in templates"
                  :key="item.id"
                  :label="`${item.name}（${dictLabel('noticeChannel', item.channel)}）`"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="账期">
              <el-date-picker v-model="sendForm.period" type="month" value-format="YYYY-MM" placeholder="全部账期" clearable style="width: 100%" @change="loadCandidateBills" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="小区">
              <el-select v-model="sendForm.communityId" placeholder="全部小区" clearable style="width: 100%" @change="loadCandidateBills">
                <el-option v-for="item in communities" :key="item.id" :label="item.label" :value="item.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="欠费账单">
          <div style="width: 100%">
            <div class="form-tip" style="margin-bottom: 6px">
              勾选需要催缴的账单，已选 {{ selectedBills.length }} 张。
              占位符支持 {业主} {房号} {小区} {账期} {金额} {应缴日}。
            </div>
            <el-table
              v-loading="candidateLoading"
              :data="candidateBills"
              border
              size="small"
              max-height="240"
              empty-text="该筛选条件下暂无欠费账单"
              @selection-change="(rows) => (selectedBills = rows)"
            >
              <el-table-column type="selection" width="46" />
              <el-table-column prop="roomNo" label="房号" width="100" />
              <el-table-column prop="feeItemName" label="收费项目" min-width="120" show-overflow-tooltip />
              <el-table-column prop="period" label="账期" width="90" align="center" />
              <el-table-column prop="arrears" label="欠费" width="110" align="right">
                <template #default="{ row }"><span class="amount-cell text-danger">{{ formatAmount(row.arrears) }}</span></template>
              </el-table-column>
              <el-table-column prop="dueDate" label="应缴日" width="110" align="center" />
            </el-table>
          </div>
        </el-form-item>
      </el-form>

      <template v-if="previewNotices.length">
        <div class="page-title" style="margin: 8px 0">预览</div>
        <el-table :data="previewNotices" border size="small" max-height="200" empty-text="暂无预览">
          <el-table-column prop="receiver" label="接收人" width="140" />
          <el-table-column prop="content" label="渲染后内容" min-width="360" show-overflow-tooltip />
        </el-table>
      </template>

      <el-alert
        v-if="sendResult"
        type="success"
        :closable="false"
        show-icon
        style="margin-top: 8px"
        :title="`发送完成：成功 ${sendResult.sentCount} 条，失败 ${sendResult.failedCount} 条`"
      />

      <template #footer>
        <el-button @click="sendVisible = false">取消</el-button>
        <el-button :loading="submitting" @click="handlePreview">预览</el-button>
        <el-button type="primary" :loading="submitting" @click="handleSend">发送</el-button>
      </template>
    </el-dialog>
  </div>
</template>
