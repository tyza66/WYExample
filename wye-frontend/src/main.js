import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import 'element-plus/dist/index.css'
import '@/styles/index.css'

import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from '@/api/request'
import { useUserStore } from '@/stores/user'

const app = createApp(App)

// 全量注册 Element Plus 图标（模板中可直接写 <el-icon><Plus /></el-icon> 或动态 :is）
for (const [name, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(name, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn, size: 'default' })

// 401 统一处理：清空用户态并跳登录页（由 request.js 在响应拦截器中触发）
setUnauthorizedHandler(() => {
  const userStore = useUserStore()
  userStore.resetState()
  const current = router.currentRoute.value
  if (current.path !== '/login') {
    router.replace({ path: '/login', query: { redirect: current.fullPath } })
  }
})

async function bootstrap() {
  // 在线 Demo 模式（VITE_DEMO_MODE=true，Netlify 静态站用）：动态引入内置 mock，
  // 保证在挂载前把 axios adapter 换掉；正常构建不会打包这部分演示数据。
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    const { installMockIfNeeded } = await import('@/mock')
    installMockIfNeeded()
  }
  app.mount('#app')
}

bootstrap()
