import { defineStore } from 'pinia'
import { login as loginApi, logout as logoutApi, getProfile } from '@/api/auth'
import { getToken, setToken, clearAuth, TOKEN_KEY, USER_KEY } from '@/api/request'

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    return null
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken(),
    user: readUser()
  }),
  getters: {
    isLogin: (state) => !!state.token,
    username: (state) => state.user?.username || '',
    realName: (state) => state.user?.realName || state.user?.username || '',
    role: (state) => state.user?.role || '',
    isAdmin: (state) => state.user?.role === 'ADMIN',
    /** ADMIN / CASHIER 可执行业务写操作（基础资料除外，基础资料写操作仅 ADMIN） */
    canWrite: (state) => state.user?.role === 'ADMIN' || state.user?.role === 'CASHIER'
  },
  actions: {
    /** 是否拥有指定角色，支持字符串或数组（任一命中即可） */
    hasRole(roles) {
      if (!roles) return true
      const list = Array.isArray(roles) ? roles : [roles]
      if (list.length === 0) return true
      return list.includes(this.user?.role)
    },
    setUser(user) {
      this.user = user || null
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
      else localStorage.removeItem(USER_KEY)
    },
    async login(payload) {
      const data = await loginApi(payload)
      this.token = data?.token || ''
      setToken(this.token)
      this.setUser(data?.user || null)
      return data
    },
    async fetchProfile() {
      const data = await getProfile()
      if (data) this.setUser(data)
      return data
    },
    async logout() {
      try {
        await logoutApi()
      } catch (e) {
        // 后端 token 已失效时忽略错误，前端照常清理
      }
      this.resetState()
    },
    resetState() {
      this.token = ''
      this.user = null
      clearAuth()
    }
  }
})

export { TOKEN_KEY, USER_KEY }
