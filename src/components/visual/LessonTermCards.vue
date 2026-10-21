<script setup lang="ts">
/**
 * LessonTermCards —— 术语卡
 * ---------------------------------------------------------------------------
 * 审计结论：24 个核心术语在 315 条旁白里的定义数是 **0**，
 * 「MOR 的 Log File 是什么」要跨 2 个页面、点 4–5 次仍拿不到答案。
 * 本组件把本课要用到的关键术语直接摆在画布旁边，一句话定义，可展开全文。
 */
import { computed, ref } from 'vue'
import type { VisualLesson } from '@/experiments/visual/types'

const props = defineProps<{
  lesson?: VisualLesson
  /** 兜底术语：当主题没有自带术语卡时，至少给出这组通用词 */
  fallback?: { term: string; def: string }[]
}>()

const expanded = ref<string>('')

const terms = computed<{ term: string; def: string }[]>(() => {
  const own = props.lesson?.glossary ?? []
  if (own.length) return own
  return props.fallback ?? []
})

function toggle(term: string): void {
  expanded.value = expanded.value === term ? '' : term
}
</script>

<template>
  <section v-if="terms.length" class="vl-term-list" aria-label="本课术语">
    <h2 class="vl-side-title">本课术语</h2>
    <ul>
      <li v-for="item in terms" :key="item.term" class="vl-term-card">
        <button
          type="button"
          class="vl-term-head"
          :aria-expanded="expanded === item.term"
          @click="toggle(item.term)"
        >
          <span class="vl-term-name">{{ item.term }}</span>
          <span class="vl-term-toggle" aria-hidden="true">{{ expanded === item.term ? '收起' : '定义' }}</span>
        </button>
        <p v-if="expanded === item.term" class="vl-term-def">{{ item.def }}</p>
        <p v-else class="vl-term-preview">{{ item.def }}</p>
      </li>
    </ul>
    <RouterLink to="/glossary" class="vl-term-more">全部术语与定义 →</RouterLink>
  </section>
</template>

<style scoped>
/* 全局基线把 .vl-term-list 定义成 flex 容器，这里改回块级，避免标题被拉伸 */
.vl-term-list {
  display: block;
}
/* 全局基线给 .vl-term-card 设了 flex-basis:240px，纵向排列时会把卡片拉成 240px 高 */
.vl-term-card {
  flex: none;
}
.vl-side-title {
  font-size: var(--vl-fs-xs, 12px);
  letter-spacing: 1px;
  color: var(--vl-muted);
  margin: 0 0 10px;
  text-transform: uppercase;
}
.vl-term-list ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vl-term-card {
  background: var(--vl-term-bg, var(--vl-panel));
  border: 1px solid var(--vl-line);
  border-radius: 8px;
  padding: 10px 12px;
}
.vl-term-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
  text-align: left;
}
.vl-term-name {
  font-size: var(--vl-fs-sm, 13px);
  font-weight: 600;
  color: var(--vl-ink);
}
.vl-term-toggle {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-accent);
  white-space: nowrap;
}
.vl-term-preview,
.vl-term-def {
  margin: 6px 0 0;
  font-size: var(--vl-fs-xs, 12px);
  line-height: 1.7;
  color: var(--vl-muted);
}
.vl-term-def {
  color: var(--vl-ink);
}
.vl-term-more {
  display: inline-block;
  margin-top: 10px;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-accent);
  text-decoration: none;
}
.vl-term-more:hover {
  text-decoration: underline;
}
/* 触屏：术语卡入口不小于 44×44 */
@media (pointer: coarse) {
  .vl-term-head,
  .vl-term-more {
    min-height: 44px;
  }
  .vl-term-more {
    display: inline-flex;
    align-items: center;
  }
}
</style>
