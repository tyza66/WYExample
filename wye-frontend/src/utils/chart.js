import { nextTick, onBeforeUnmount, onMounted, unref } from 'vue'
import echarts from './echarts'

/**
 * ECharts 生命周期封装。
 *
 * 按需求：窗口 resize 时**销毁重建**实例（而不是仅调用 resize()），
 * 并做防抖，避免连续 resize 造成实例堆积 / 内存泄漏。
 *
 * @param {import('vue').Ref<HTMLElement|null>} elRef 图表容器 ref
 * @param {() => object|null|undefined} optionBuilder 返回 ECharts option 的函数
 */
export function useChart(elRef, optionBuilder) {
  let chart = null
  let resizeTimer = null

  function destroy() {
    if (chart) {
      chart.dispose()
      chart = null
    }
  }

  /** 销毁旧实例并按当前数据重建 */
  function render() {
    const el = unref(elRef)
    if (!el) return
    destroy()
    const option = typeof optionBuilder === 'function' ? optionBuilder() : optionBuilder
    if (!option) return
    chart = echarts.init(el)
    chart.setOption(option)
  }

  function handleResize() {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      render()
    }, 200)
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
    nextTick(() => render())
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    if (resizeTimer) clearTimeout(resizeTimer)
    destroy()
  })

  return { render, destroy }
}

export default useChart
