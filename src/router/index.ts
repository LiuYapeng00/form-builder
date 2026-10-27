import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

/**
 * GitHub Pages 是纯静态托管，没有服务端 rewrite，
 * 所以只能使用 hash 路由（/#/f?d=...）。改 history 模式会导致刷新 404。
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'designer',
    component: () => import('@/views/Designer/DesignerPage.vue'),
  },
  {
    path: '/f',
    name: 'preview',
    component: () => import('@/views/Preview/PreviewPage.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export default createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})
