import axios from 'axios'
import { ElMessage } from 'element-plus'

/**
 * 统一 axios 实例。
 *
 * 契约（docs/api.md §1）：
 *  - baseURL = /api，开发环境由 Vite 代理到 http://localhost:8080
 *  - 请求头 Authorization: Bearer <token>
 *  - 响应信封 { code, message, data }
 *      code === 0    -> resolve(data)
 *      code === 401  -> 清 token + 跳登录页 + 提示"登录已失效，请重新登录"
 *      code !== 0    -> ElMessage.error(message) 并 reject
 *  - HTTP 401 同样按未登录处理
 */

export const TOKEN_KEY = 'wye_token'
export const USER_KEY = 'wye_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// 由 main.js 注入，避免 request.js 反向依赖 router（循环引用）
let unauthorizedHandler = null
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

let unauthorizedNotified = false
function handleUnauthorized() {
  clearAuth()
  if (!unauthorizedNotified) {
    unauthorizedNotified = true
    ElMessage.error('登录已失效，请重新登录')
    setTimeout(() => {
      unauthorizedNotified = false
    }, 1000)
  }
  if (typeof unauthorizedHandler === 'function') unauthorizedHandler()
}

/** 去掉空字符串 / null / undefined 的查询参数，避免后端把空串当过滤条件 */
export function cleanParams(params) {
  if (!params || typeof params !== 'object') return params
  const out = {}
  Object.keys(params).forEach((key) => {
    const value = params[key]
    if (value === '' || value === null || value === undefined) return
    out[key] = value
  })
  return out
}

const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

request.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    if (config.params) config.params = cleanParams(config.params)
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    const body = response.data
    // 非信封响应（例如文件流）直接透传
    if (body === null || typeof body !== 'object' || !('code' in body)) return body

    if (body.code === 0) return body.data
    if (body.code === 401) {
      handleUnauthorized()
      return Promise.reject(new Error(body.message || '登录已失效，请重新登录'))
    }
    const message = body.message || '请求失败'
    ElMessage.error(message)
    return Promise.reject(new Error(message))
  },
  (error) => {
    const status = error?.response?.status
    const body = error?.response?.data
    if (status === 401 || (body && body.code === 401)) {
      handleUnauthorized()
      return Promise.reject(new Error((body && body.message) || '登录已失效，请重新登录'))
    }
    let message = (body && body.message) || error?.message || '网络异常，请稍后重试'
    if (status === 403) message = (body && body.message) || '没有权限执行该操作'
    if (status === 404) message = (body && body.message) || '接口不存在（404）'
    if (status >= 500) message = (body && body.message) || '服务端异常，请稍后重试'
    ElMessage.error(message)
    return Promise.reject(new Error(message))
  }
)

export default request
