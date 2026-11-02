<script setup>
import { ref } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Navbar from './components/Navbar.vue'

const collapse = ref(false)

function toggleCollapse() {
  collapse.value = !collapse.value
}
</script>

<template>
  <el-container class="app-wrapper">
    <el-aside class="app-aside" :width="collapse ? '64px' : '210px'">
      <Sidebar :collapse="collapse" />
    </el-aside>

    <el-container class="app-body">
      <el-header class="app-header" height="56px">
        <Navbar :collapse="collapse" @toggle="toggleCollapse" />
      </el-header>

      <el-main class="app-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.app-wrapper {
  height: 100vh;
  overflow: hidden;
}

.app-aside {
  transition: width 0.2s;
  overflow: hidden;
}

.app-body {
  min-width: 0;
}

.app-header {
  padding: 0;
  height: 56px;
}

.app-main {
  padding: 0;
  background-color: #f0f2f5;
  overflow-y: auto;
}
</style>
