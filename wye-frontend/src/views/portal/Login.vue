<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { portalLogin, savePortalRoom, setPortalToken } from '@/api/portal'

const router = useRouter()
const formRef = ref(null)
const loading = ref(false)
const form = reactive({ roomNo: '', phoneSuffix: '' })

const rules = {
  roomNo: [{ required: true, message: '请输入房号', trigger: 'blur' }],
  phoneSuffix: [
    { required: true, message: '请输入手机号后 4 位', trigger: 'blur' },
    { pattern: /^\d{4}$/, message: '请输入 4 位数字', trigger: 'blur' }
  ]
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
    const data = await portalLogin({ roomNo: form.roomNo.trim(), phoneSuffix: form.phoneSuffix.trim() })
    setPortalToken(data?.token || '')
    savePortalRoom(data?.room || null)
    ElMessage.success(`欢迎，${data?.ownerName || '业主'}`)
    router.replace('/portal/home')
  } catch (e) {
    // 拦截器已提示
  } finally {
    loading.value = false
  }
}

function useDemo(roomNo, suffix) {
  form.roomNo = roomNo
  form.phoneSuffix = suffix
}

onMounted(() => {
  form.roomNo = ''
  form.phoneSuffix = ''
})
</script>

<template>
  <div class="portal-login">
    <div class="portal-login__card">
      <div class="portal-login__logo">WYE</div>
      <div class="portal-login__title">业主缴费服务</div>
      <div class="portal-login__subtitle">输入房号与业主手机号后 4 位查询账单</div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
        <el-form-item label="房号" prop="roomNo">
          <el-input v-model="form.roomNo" size="large" placeholder="例：1-101" clearable @keyup.enter="handleSubmit" />
        </el-form-item>
        <el-form-item label="手机号后 4 位" prop="phoneSuffix">
          <el-input v-model="form.phoneSuffix" size="large" maxlength="4" placeholder="例：0001" clearable @keyup.enter="handleSubmit" />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="handleSubmit">
          查询我的账单
        </el-button>
      </el-form>

      <div class="portal-login__demo">
        <div class="portal-login__demo-title">演示账号（点击填入）</div>
        <div class="portal-login__demo-item" @click="useDemo('1-101', '0001')">
          <span>1-101 · 张三</span><code>0001</code>
        </div>
        <div class="portal-login__demo-item" @click="useDemo('2-201', '0006')">
          <span>2-201 · 孙八</span><code>0006</code>
        </div>
      </div>

      <div class="portal-login__footer">登录凭证有效期 2 小时，仅可查看本房屋账单与缴费记录</div>
    </div>
  </div>
</template>

<style scoped>
.portal-login {
  min-height: 100vh;
  background: linear-gradient(160deg, #1f2d3d 0%, #2c4a6b 55%, #409eff 100%);
  padding: 24px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.portal-login__card {
  width: 100%;
  max-width: 400px;
  background: #fff;
  border-radius: 14px;
  padding: 28px 22px 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
}

.portal-login__logo {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 14px;
  background: #409eff;
  color: #fff;
  font-weight: 700;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 1px;
}

.portal-login__title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: #1f2d3d;
}

.portal-login__subtitle {
  text-align: center;
  color: #909399;
  font-size: 13px;
  margin: 6px 0 18px;
}

.portal-login__demo {
  margin-top: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  color: #606266;
}

.portal-login__demo-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: #303133;
}

.portal-login__demo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  cursor: pointer;
}

.portal-login__demo-item code {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 1px 8px;
  color: #409eff;
}

.portal-login__footer {
  margin-top: 14px;
  font-size: 12px;
  color: #c0c4cc;
  text-align: center;
  line-height: 1.6;
}
</style>
