<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

const formRef = ref(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

// 演示账号（docs/architecture.md §5.3），方便开源用户开箱试用
const demoAccounts = [
  { username: 'admin', password: 'admin123', role: '管理员' },
  { username: 'cashier', password: '123456', role: '收费员' },
  { username: 'viewer', password: '123456', role: '只读' }
]

function fillDemo(account) {
  form.username = account.username
  form.password = account.password
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch (e) {
    return
  }

  loading.value = true
  try {
    await userStore.login({ username: form.username, password: form.password })
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    router.replace(redirect)
  } catch (e) {
    // 错误提示已由 axios 响应拦截器统一弹出
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-title">WYE 物业收费管理系统</div>
      <div class="login-subtitle">房户资料 · 账单生成 · 收款核销 · 欠费催缴 · 报表对账</div>

      <el-form ref="formRef" :model="form" :rules="rules" size="large" @keyup.enter="handleSubmit">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="请输入用户名" clearable>
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password clearable>
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" class="login-button" :loading="loading" @click="handleSubmit">
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-demo">
        <div class="login-demo-title">演示账号（点击自动填充）</div>
        <div v-for="account in demoAccounts" :key="account.username" class="login-demo-item">
          <span>
            <code @click="fillDemo(account)">{{ account.username }}</code>
            /
            <code @click="fillDemo(account)">{{ account.password }}</code>
          </span>
          <span class="text-muted">{{ account.role }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-button {
  width: 100%;
}
</style>
