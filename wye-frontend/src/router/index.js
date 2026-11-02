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
          }
        ]
      }
    ]
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
