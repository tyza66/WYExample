<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useLedgerStore } from '@/stores/ledger'
import { dictLabel, dictTag } from '@/utils/dict'
import Breadcrumb from './Breadcrumb.vue'

defineProps({
  collapse: { type: Boolean, default: false }
})
const emit = defineEmits(['toggle'])

const router = useRouter()
const userStore = useUserStore()
const ledgerStore = useLedgerStore()

function handleLedgerChange(value) {
  ledgerStore.setLedger(value)
  ElMessage.success(`已切换账套：${ledgerStore.currentLabel}`)
}

onMounted(() => {
  ledgerStore.loadOptions()
})

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      type: 'warning',
      confirmButtonText: '退出',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  await userStore.logout()
  ElMessage.success('已退出登录')
  router.replace('/login')
}
</script>

<template>
  <div class="navbar">
    <div class="navbar-left">
      <el-icon class="collapse-btn" @click="emit('toggle')">
        <component :is="collapse ? 'Expand' : 'Fold'" />
      </el-icon>
      <Breadcrumb />
    </div>

    <div class="navbar-right">
      <el-select
        v-if="ledgerStore.options.length"
        :model-value="ledgerStore.ledgerId"
        class="navbar-ledger"
        placeholder="全部账套"
        size="small"
        @change="handleLedgerChange"
      >
        <el-option label="全部账套" value="" />
        <el-option v-for="item in ledgerStore.options" :key="item.id" :label="item.label" :value="String(item.id)" />
      </el-select>
      <el-tag :type="dictTag('role', userStore.role)" size="small" effect="light">
        {{ dictLabel('role', userStore.role) }}
      </el-tag>
      <span class="navbar-username">{{ userStore.realName }}</span>
      <el-dropdown @command="handleLogout">
        <el-icon class="navbar-avatar"><UserFilled /></el-icon>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item disabled>账号：{{ userStore.username }}</el-dropdown-item>
            <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped>
.navbar {
  height: var(--wye-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.navbar-left,
.navbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.collapse-btn {
  font-size: 20px;
  cursor: pointer;
  color: #606266;
}

.collapse-btn:hover {
  color: #409eff;
}

.navbar-username {
  font-size: 14px;
  color: #303133;
}

.navbar-ledger {
  width: 150px;
}

.navbar-avatar {
  font-size: 22px;
  color: #409eff;
  cursor: pointer;
  outline: none;
}
</style>
