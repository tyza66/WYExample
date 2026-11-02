<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { buildMenus, filterMenusByRole } from '../menu'

defineProps({
  collapse: { type: Boolean, default: false }
})

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 直接读取 router.options.routes，避免 layout <-/-> router 的循环 import
const menus = computed(() => {
  const all = buildMenus(router.options.routes)
  return filterMenusByRole(all, (roles) => userStore.hasRole(roles))
})

const activeMenu = computed(() => route.path)
</script>

<template>
  <div class="app-sidebar">
    <div class="sidebar-logo">
      <span v-if="!collapse">WYE 物业收费</span>
      <span v-else>WYE</span>
    </div>

    <el-scrollbar class="sidebar-scroll">
      <el-menu
        :default-active="activeMenu"
        :collapse="collapse"
        :collapse-transition="false"
        router
        background-color="#1f2d3d"
        text-color="#c0c4cc"
        active-text-color="#ffffff"
      >
        <template v-for="item in menus" :key="item.path">
          <el-sub-menu v-if="item.children && item.children.length" :index="item.path">
            <template #title>
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.title }}</span>
            </template>
            <el-menu-item v-for="child in item.children" :key="child.path" :index="child.path">
              <el-icon><component :is="child.icon" /></el-icon>
              <template #title>{{ child.title }}</template>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item v-else :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </template>
      </el-menu>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.app-sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #1f2d3d;
  overflow: hidden;
}

.sidebar-logo {
  height: var(--wye-header-height);
  line-height: var(--wye-header-height);
  text-align: center;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 1px;
  background-color: #18222e;
  flex-shrink: 0;
}

.sidebar-scroll {
  flex: 1;
  min-height: 0;
}

.el-menu {
  border-right: none;
}

:deep(.el-menu-item.is-active) {
  background-color: #409eff !important;
}

:deep(.el-menu--collapse) {
  width: 64px;
}
</style>
