<script setup lang="ts">
/**
 * LessonObjectiveBar —— 动画页的「课程头」
 * ---------------------------------------------------------------------------
 * 整改前的动画页：标题下面直接就是画布，学生看不到
 *   · 这节课要解决什么问题（目标）
 *   · 需要先知道什么（前置）
 *   · 大概要花多久、难度如何、结论有没有被实测过（元信息）
 * 本组件把这三件事放到首屏最上方，并让它们可点击（前置 → 术语表）。
 */
import { computed } from 'vue'
import type { CatalogEntry } from '@/experiments/catalog'
import type { VisualLesson } from '@/experiments/visual/types'

const props = defineProps<{
  entry?: CatalogEntry
  lesson?: VisualLesson
  /** 对比类主题（B02/B03）没有 VisualLesson，可直接给目标与前置 */
  objective?: string
  prerequisites?: string[]
}>()

defineEmits<{ glossary: [term: string] }>()

/** 目标：优先用主题自带的，其次用外部传入的，最后回退到目录 summary */
const objectiveText = computed(() => {
  if (props.lesson?.objective) return props.lesson.objective
  if (props.objective) return props.objective
  return props.entry?.summary || '理解这一步在 Hudi 里发生了什么。'
})

/** 前置：主题自带优先 */
const prereqList = computed(() => props.lesson?.prerequisites?.length ? props.lesson.prerequisites : (props.prerequisites ?? []))

/** 难度文案：没有标注时按模块兜底 */
const DIFFICULTY_LABEL: Record<string, string> = {
  L1: '入门',
  L2: '进阶',
  L3: '高级',
}

function difficultyOf(): string {
  const level = props.entry?.difficulty
  if (level) return `${level} · ${DIFFICULTY_LABEL[level] ?? level}`
  return '难度未标注'
}
</script>

<template>
  <section v-if="entry" class="vl-objective-bar" aria-label="本课信息">
    <div class="vl-objective-main">
      <p class="vl-objective-text">
        <span class="vl-objective-tag">学完你能</span>
        {{ objectiveText }}
      </p>

      <div class="vl-objective-meta">
        <span class="vl-chip">{{ entry.id }}</span>
        <span class="vl-chip">{{ difficultyOf() }}</span>
        <span v-if="entry.minutes" class="vl-chip">约 {{ entry.minutes }} 分钟</span>
        <span
          class="vl-chip"
          :class="entry.supportState === 'unverified' || entry.evidenceLevel === 'E0' ? 'is-warn' : 'is-ok'"
        >
          {{ entry.supportState === 'unverified' || entry.evidenceLevel === 'E0' ? 'r26 待验证' : '教学模型' }}
        </span>
      </div>

      <div v-if="prereqList.length" class="vl-prerequisites">
        <span class="vl-prerequisites-label">先修</span>
        <button
          v-for="item in prereqList"
          :key="item"
          class="vl-chip vl-chip-link"
          type="button"
          @click="$emit('glossary', item)"
        >
          {{ item }} ↗
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.vl-objective-bar {
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-left: 3px solid var(--vl-accent);
  border-radius: 10px;
  padding: 14px 18px;
}
.vl-objective-text {
  margin: 0;
  font-size: var(--vl-fs-md, 14px);
  line-height: 1.75;
  color: var(--vl-ink);
}
.vl-objective-tag {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--vl-accent);
  color: var(--vl-bg);
  font-size: var(--vl-fs-xs, 12px);
  font-weight: 600;
}
.vl-objective-meta,
.vl-prerequisites {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.vl-prerequisites-label {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.vl-chip {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  border: 1px solid var(--vl-line);
  border-radius: 999px;
  padding: 3px 10px;
  line-height: 1.6;
}
.vl-chip.is-ok {
  color: var(--vl-ink);
}
.vl-chip.is-warn {
  color: var(--vl-warn, #d9a441);
  border-color: currentColor;
}
.vl-chip-link {
  cursor: pointer;
  color: var(--vl-ink);
}
.vl-chip-link:hover {
  border-color: var(--vl-accent);
}
</style>
