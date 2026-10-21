import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getCatalogEntry } from '@/experiments/catalog'

/**
 * 路由表。
 *
 * 约定：
 *   - 全部视图组件使用 `() => import(...)` 懒加载 —— 视图由多位同学并行开发，
 *     懒加载可以避免视图与实验模块之间的循环依赖，也把首屏体积压到最小；
 *   - `/experiment/:id` 的 id 取的是目录编号（如 'B02'），
 *     实验实现内部若使用了别的 id，注册表会按 catalogIds 兜底解析。
 */

/** Vite 的 base（部署在子路径时需要），dev 默认为 '/' */
const BASE_URL: string = (import.meta.env as unknown as { BASE_URL?: string })?.BASE_URL ?? '/'

/** 站点标题前缀 */
const SITE_TITLE = 'Hudi Lab'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/VisualHomeView.vue'),
    meta: { title: '总览' },
  },
  { path: '/catalog', name: 'catalog', component: () => import('@/views/AnimatedCatalogView.vue'), meta: { title: '全部动画实验' } },
  { path: '/path', name: 'path', component: () => import('@/views/PathView.vue'), meta: { title: '学习路径' } },
  { path: '/glossary', name: 'glossary', component: () => import('@/views/GlossaryView.vue'), meta: { title: '术语表' } },
  // 80 个主题统一走 LessonView：B02 / B03 在其中渲染为「双泳道对比」分支，
  // 不再有第二套页面骨架（整改前它们走独立的 VisualLabView）。
  {
    path: '/experiment/:id',
    name: 'experiment',
    component: () => import('@/views/LessonView.vue'),
    props: true,
    meta: { title: '实验' },
  },
  {
    path: '/evidence',
    name: 'evidence',
    component: () => import('@/views/EvidenceView.vue'),
    meta: { title: '证据库' },
  },
  {
    path: '/progress',
    name: 'progress',
    component: () => import('@/views/ProgressView.vue'),
    meta: { title: '学习进度' },
  },
  {
    // 未匹配到的路径统一回到总览，不额外引入 NotFound 视图依赖
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(BASE_URL),
  routes,
  /**
   * 路由切换后回到顶部。
   *
   * 只有在页面确实滚动过、或存在浏览历史位置时才滚动 —— 返回 false 表示「不滚动」。
   * 这样既避免了「从长页面切到短页面时保留旧滚动位置」的坏体验，
   * 又不会在 jsdom 测试环境里触发 window.scrollTo 的未实现告警。
   */
  scrollBehavior: (_to, _from, savedPosition) => {
    if (savedPosition) return savedPosition
    if (typeof window !== 'undefined' && window.scrollY > 0) return { top: 0 }
    return false
  },
})

router.afterEach((to) => {
  const metaTitle = typeof to.meta?.title === 'string' ? to.meta.title : ''

  // 实验页用目录标题作为页面标题，便于收藏与浏览器历史区分
  if (to.name === 'experiment' && typeof to.params.id === 'string') {
    const entry = getCatalogEntry(to.params.id)
    if (entry) {
      document.title = `${entry.title} · ${SITE_TITLE}`
      return
    }
  }

  document.title = metaTitle ? `${metaTitle} · ${SITE_TITLE}` : SITE_TITLE
})

export default router
