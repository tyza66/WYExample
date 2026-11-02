import { defineStore } from 'pinia'
import { ledgerOptions } from '@/api/ledger'
import { LEDGER_KEY } from '@/api/request'

/**
 * 账套状态（二期）：顶栏切换，持久化到 localStorage。
 * 具体请求由 api/request.js 拦截器读取 localStorage 的 LEDGER_KEY 附加 ledgerId，
 * 这样无需在 Pinia 与 axios 实例之间建立循环依赖。
 */
export const useLedgerStore = defineStore('ledger', {
  state: () => ({
    ledgerId: localStorage.getItem(LEDGER_KEY) || '',
    options: [],
    loaded: false
  }),
  getters: {
    currentLabel: (state) => {
      if (!state.ledgerId) return '全部账套'
      const hit = state.options.find((item) => String(item.id) === String(state.ledgerId))
      return hit?.label || '全部账套'
    }
  },
  actions: {
    setLedger(id) {
      this.ledgerId = id === null || id === undefined || id === '' ? '' : String(id)
      if (this.ledgerId) localStorage.setItem(LEDGER_KEY, this.ledgerId)
      else localStorage.removeItem(LEDGER_KEY)
    },
    async loadOptions(force = false) {
      if (this.loaded && !force) return this.options
      try {
        this.options = (await ledgerOptions()) || []
      } catch (e) {
        this.options = []
      }
      this.loaded = true
      // 账套被删除后清理失效的本地选择
      if (this.ledgerId && !this.options.some((item) => String(item.id) === String(this.ledgerId))) {
        this.setLedger('')
      }
      return this.options
    }
  }
})
