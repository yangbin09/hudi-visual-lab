<script setup lang="ts">
/**
 * VisualNav —— 视觉实验室的统一顶栏
 * ---------------------------------------------------------------------------
 * 整改前：首页、目录页、动画页各自复制了一份导航（4 份重复实现），
 * 而且**没有任何入口**指向 /progress 与 /evidence（这两页只能手输 URL）。
 * 本组件是唯一的一份导航实现，所有视觉页面共用。
 */
import { useLessonStore } from '@/app/stores/lesson'
import { useLabStore } from '@/app/stores/lab'

defineProps<{
  /** 面包屑（可选）：数组为 [文本, 链接?]，最后一段作为当前页 */
  crumbs?: { text: string; to?: string }[]
  /** 是否显示模式切换（基础模式 ↔ 工程师模式） */
  showMode?: boolean
  /** 右侧额外操作插槽 */
  showParams?: boolean
}>()

const emit = defineEmits<{ params: [] }>()

const lab = useLabStore()
const lesson = useLessonStore()
</script>

<template>
  <header class="vl-nav">
    <RouterLink to="/" class="vl-brand">
      <span class="vl-logo">h.</span> Hudi <b>Visual Lab</b>
    </RouterLink>

    <nav class="vl-nav-links" aria-label="主导航">
      <RouterLink to="/" class="vl-nav-link">总览</RouterLink>
      <RouterLink to="/catalog" class="vl-nav-link">全部主题</RouterLink>
      <RouterLink to="/path" class="vl-nav-link">学习路径</RouterLink>
      <RouterLink to="/glossary" class="vl-nav-link">术语表</RouterLink>
      <RouterLink to="/progress" class="vl-nav-link">学习进度</RouterLink>
      <RouterLink to="/evidence" class="vl-nav-link">证据库</RouterLink>
    </nav>

    <nav v-if="crumbs?.length" class="vl-breadcrumb" aria-label="当前位置">
      <template v-for="(crumb, i) in crumbs" :key="i">
        <RouterLink v-if="crumb.to" :to="crumb.to" class="vl-crumb-link">{{ crumb.text }}</RouterLink>
        <span v-else>{{ crumb.text }}</span>
      </template>
    </nav>

    <div class="vl-nav-actions">
      <button
        v-if="showMode"
        class="vl-mode-toggle"
        :class="{ active: lesson.engineerMode }"
        :aria-pressed="lesson.engineerMode"
        :title="lesson.engineerMode
          ? '工程师模式：显示数据表、SQL、时间轴与源码映射'
          : '基础模式：只讲原理，看实现请切到工程师模式'"
        @click="lesson.toggleMode()"
      >
        {{ lesson.engineerMode ? '工程师模式' : '基础模式' }}
      </button>
      <button aria-label="切换深浅主题" @click="lab.toggleTheme()">{{ lab.darkMode ? '☀' : '☾' }}</button>
      <button v-if="showParams" @click="emit('params')">⚙ 参数</button>
    </div>
  </header>
</template>

<style scoped>
.vl-nav-links {
  display: flex;
  align-items: center;
  gap: 4px;
}
.vl-nav-link {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  text-decoration: none;
  padding: 8px 10px;
  border-radius: 6px;
  white-space: nowrap;
}
.vl-nav-link:hover {
  color: var(--vl-ink);
  background: var(--vl-line);
}
.vl-nav-link.router-link-exact-active {
  color: var(--vl-ink);
  background: var(--vl-surface-2, var(--vl-line));
}
.vl-crumb-link {
  color: var(--vl-muted);
  text-decoration: none;
}
.vl-crumb-link:hover {
  color: var(--vl-ink);
}
.vl-mode-toggle.active {
  background: var(--vl-accent);
  color: var(--vl-bg);
  border-color: transparent;
}
@media (max-width: 900px) {
  .vl-nav-links {
    order: 3;
    width: 100%;
    overflow-x: auto;
    padding-bottom: 6px;
  }
}
/* 触屏：导航项不小于 44×44 */
@media (pointer: coarse) {
  .vl-nav-link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .vl-brand {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .vl-nav-actions button {
    min-height: 44px;
    min-width: 44px;
  }
}
</style>
