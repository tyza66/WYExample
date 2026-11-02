import { createRouter, createWebHistory, RouterView } from 'vue-router'
import { h } from 'vue'
import { ElMessage } from 'element-plus'
import Layout from '@/layout/index.vue'
import { useUserStore } from '@/stores/user'

/**
 * 分组路由的中转组件：让 /basic/communities 这类三级路由能渲染到 Layout 的 router-view。
 * 使用 render 函数而非 template，避免依赖 Vue 运行时编译器。
 */
const Passthrough = {
  name: 'RoutePassthrough',
  render: () => h(RouterView)
}

/**
 * 路由表（docs/architecture.md §4）
 * meta: { title 菜单/面包屑文案, icon 菜单图标, roles 可访问角色（缺省=全部）, hidden 不在菜单显示 }
 */
export const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', public: true, hidden: true }
  },
  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/index.vue'),
        meta: { title: '工作台', icon: 'Odometer' }
      },
      {
        path: 'basic',
        name: 'Basic',
        component: Passthrough,
        redirect: '/basic/communities',
        meta: { title: '基础资料', icon: 'OfficeBuilding' },
        children: [
          {
            path: 'communities',
            name: 'BasicCommunities',
            component: () => import('@/views/basic/communities.vue'),
            meta: { title: '小区管理', icon: 'School' }
          },
          {
            path: 'buildings',
            name: 'BasicBuildings',
            component: () => import('@/views/basic/buildings.vue'),
            meta: { title: '楼栋管理', icon: 'House' }
          },
          {
            path: 'rooms',
            name: 'BasicRooms',
            component: () => import('@/views/basic/rooms.vue'),
            meta: { title: '房屋管理', icon: 'HomeFilled' }
          },
          {
            path: 'residents',
            name: 'BasicResidents',
            component: () => import('@/views/basic/residents.vue'),
            meta: { title: '住户管理', icon: 'User' }
          }
        ]
      },
      {
        path: 'fee',
        name: 'Fee',
        component: Passthrough,
        redirect: '/fee/bills',
        meta: { title: '收费管理', icon: 'Money' },
        children: [
          {
            path: 'items',
            name: 'FeeItems',
            component: () => import('@/views/fee/items.vue'),
            meta: { title: '收费项目', icon: 'Tickets', roles: ['ADMIN'] }
          },
          {
            path: 'bills',
            name: 'FeeBills',
            component: () => import('@/views/fee/bills.vue'),
            meta: { title: '账单管理', icon: 'Document' }
          },
          {
            path: 'payments',
            name: 'FeePayments',
            component: () => import('@/views/fee/payments.vue'),
            meta: { title: '收款登记', icon: 'Wallet' }
          },
          {
            path: 'meters',
            name: 'FeeMeters',
            component: () => import('@/views/fee/meters.vue'),
            meta: { title: '抄表录入', icon: 'Stopwatch' }
          }
        ]
      },
      {
        path: 'report',
        name: 'Report',
        component: Passthrough,
        redirect: '/report/arrears',
        meta: { title: '报表统计', icon: 'DataLine' },
        children: [
          {
            path: 'arrears',
            name: 'ReportArrears',
            component: () => import('@/views/report/arrears.vue'),
            meta: { title: '欠费报表', icon: 'Warning' }
          },
          {
            path: 'collection',
            name: 'ReportCollection',
            component: () => import('@/views/report/collection.vue'),
            meta: { title: '收款汇总', icon: 'PieChart' }
          },
          {
            path: 'daily-close',
            name: 'ReportDailyClose',
            component: () => import('@/views/report/dailyClose.vue'),
            meta: { title: '日结', icon: 'Calendar' }
          }
        ]
      },
      {
        path: 'fund',
        name: 'Fund',
        component: Passthrough,
        redirect: '/fund/accounts',
        meta: { title: '资金管理', icon: 'Coin' },
        children: [
          {
            path: 'accounts',
            name: 'FundAccounts',
            component: () => import('@/views/fund/accounts.vue'),
            meta: { title: '资金账户', icon: 'Wallet' }
          },
          {
            path: 'flows',
            name: 'FundFlows',
            component: () => import('@/views/fund/flows.vue'),
            meta: { title: '资金流水', icon: 'Tickets' }
          },
          {
            path: 'approvals',
            name: 'FundApprovals',
            component: () => import('@/views/fund/approvals.vue'),
            meta: { title: '审批中心', icon: 'Finished' }
          }
        ]
      },
      {
        path: 'bank',
        name: 'Bank',
        component: Passthrough,
        redirect: '/bank/contracts',
        meta: { title: '银行代扣', icon: 'CreditCard' },
        children: [
          {
            path: 'contracts',
            name: 'BankContracts',
            component: () => import('@/views/bank/contracts.vue'),
            meta: { title: '代扣签约', icon: 'Postcard' }
          },
          {
            path: 'batches',
            name: 'BankBatches',
            component: () => import('@/views/bank/batches.vue'),
            meta: { title: '代扣批次', icon: 'Files' }
          }
        ]
      },
      {
        path: 'notice',
        name: 'Notice',
        component: Passthrough,
        redirect: '/notice/notices',
        meta: { title: '催缴通知', icon: 'Bell' },
        children: [
          {
            path: 'notices',
            name: 'NoticeRecords',
            component: () => import('@/views/notice/notices.vue'),
            meta: { title: '催缴通知', icon: 'Promotion' }
          },
          {
            path: 'templates',
            name: 'NoticeTemplates',
            component: () => import('@/views/notice/templates.vue'),
            meta: { title: '通知模板', icon: 'Memo', roles: ['ADMIN'] }
          }
        ]
      },
      {
        path: 'receipt',
        name: 'Receipt',
        component: Passthrough,
        redirect: '/receipt/receipts',
        meta: { title: '票据管理', icon: 'Document' },
        children: [
          {
            path: 'receipts',
            name: 'ReceiptList',
            component: () => import('@/views/receipt/receipts.vue'),
            meta: { title: '收据发票', icon: 'Receipt' }
          }
        ]
      },
      {
        path: 'system',
        name: 'System',
        component: Passthrough,
        redirect: '/system/users',
        meta: { title: '系统管理', icon: 'Setting', roles: ['ADMIN'] },
        children: [
          {
            path: 'users',
            name: 'SystemUsers',
            component: () => import('@/views/system/users.vue'),
            meta: { title: '用户管理', icon: 'UserFilled', roles: ['ADMIN'] }
          },
          {
            path: 'logs',
            name: 'SystemLogs',
            component: () => import('@/views/system/logs.vue'),
            meta: { title: '操作日志', icon: 'List', roles: ['ADMIN'] }
          },
          {
            path: 'ledgers',
            name: 'SystemLedgers',
            component: () => import('@/views/system/ledgers.vue'),
            meta: { title: '账套管理', icon: 'Collection', roles: ['ADMIN'] }
          },
          {
            path: 'import',
            name: 'SystemImport',
            component: () => import('@/views/system/import.vue'),
            meta: { title: '数据导入', icon: 'Upload', roles: ['ADMIN'] }
          }
        ]
      }
    ]
  },
  // ---------- 业主端 H5（免登录，独立布局，不复用后台侧边栏） ----------
  {
    path: '/portal',
    redirect: '/portal/login',
    meta: { public: true, hidden: true }
  },
  {
    path: '/portal/login',
    name: 'PortalLogin',
    component: () => import('@/views/portal/Login.vue'),
    meta: { title: '业主登录', public: true, hidden: true }
  },
  {
    path: '/portal/home',
    name: 'PortalHome',
    component: () => import('@/views/portal/Home.vue'),
    meta: { title: '我的账单', public: true, hidden: true }
  },
  {
    path: '/portal/success',
    name: 'PortalSuccess',
    component: () => import('@/views/portal/Success.vue'),
    meta: { title: '缴费成功', public: true, hidden: true }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    redirect: '/dashboard',
    meta: { hidden: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// 不依赖 Pinia 实例是否已安装：在守卫里才调用 useUserStore（此时 app.use(pinia) 已完成）
router.beforeEach((to) => {
  const userStore = useUserStore()

  const appTitle = 'WYE 物业收费管理系统'
  document.title = to.meta?.title ? `${to.meta.title} · ${appTitle}` : appTitle

  if (to.path === '/login') {
    if (userStore.isLogin) return { path: '/dashboard' }
    return true
  }

  // 业主端与其它公开页（含 /portal/*）免登录放行
  if (to.meta?.public) return true

  if (!userStore.isLogin) {
    return { path: '/login', query: to.fullPath && to.fullPath !== '/' ? { redirect: to.fullPath } : undefined }
  }

  const roles = to.meta?.roles
  if (Array.isArray(roles) && roles.length > 0 && !userStore.hasRole(roles)) {
    ElMessage.warning('当前角色无权访问该页面')
    return { path: '/dashboard' }
  }

  return true
})

export default router
