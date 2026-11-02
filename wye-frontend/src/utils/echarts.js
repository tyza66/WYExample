/**
 * ECharts 按需引入：只注册本项目用到的图表与组件，避免首屏打进整个 echarts。
 */
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  DatasetComponent,
  MarkLineComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { LabelLayout } from 'echarts/features'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  DatasetComponent,
  MarkLineComponent,
  LabelLayout,
  CanvasRenderer
])

export default echarts

/** 统一的货币 tooltip 格式化 */
export function moneyFormatter(value) {
  const num = Number(value)
  if (Number.isNaN(num)) return value
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
