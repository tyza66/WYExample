/**
 * 由路由表推导菜单树（不依赖 router 实例，避免与 Layout 形成循环引用）。
 */

function joinPath(base, path) {
  if (!path) return base || '/'
  if (path.startsWith('/')) return path
  if (!base || base === '/') return `/${path}`
  return `${base.replace(/\/+$/, '')}/${path}`
}

/** 把路由记录转换成菜单项 */
export function buildMenus(routeRecords, parentPath = '') {
  const result = []
  ;(routeRecords || []).forEach((record) => {
    if (!record || record.meta?.hidden) return

    if (record.children && record.children.length > 0) {
      const fullPath = joinPath(parentPath, record.path)
      const children = buildMenus(record.children, fullPath)
      if (children.length === 0) return
      result.push({
        path: record.redirect && typeof record.redirect === 'string' ? record.redirect : fullPath,
        title: record.meta?.title || '',
        icon: record.meta?.icon || 'Menu',
        roles: record.meta?.roles,
        children
      })
      return
    }

    // 叶子：必须有 title 与 component（过滤掉 catch-all / redirect 记录）
    if (!record.meta?.title || !record.component) return
    result.push({
      path: joinPath(parentPath, record.path),
      title: record.meta.title,
      icon: record.meta.icon || 'Menu',
      roles: record.meta.roles
    })
  })
  return result
}

/** 按角色过滤，并丢弃过滤后为空的父级 */
export function filterMenusByRole(menus, hasRole) {
  const result = []
  ;(menus || []).forEach((item) => {
    if (Array.isArray(item.roles) && item.roles.length > 0 && !hasRole(item.roles)) return
    if (item.children && item.children.length > 0) {
      const children = filterMenusByRole(item.children, hasRole)
      if (children.length === 0) return
      result.push({ ...item, children })
      return
    }
    result.push(item)
  })
  return result
}
