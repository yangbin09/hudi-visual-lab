<script setup lang="ts">
/**
 * LessonSummary —— 本课小结 + 自测 + 边界声明
 * ---------------------------------------------------------------------------
 * 审计结论：80 个主题里 **0 个** 有「学完该会什么 / 我是否懂了」的收尾，
 * 全站唯一能出题的地方（QuizPanel）挂在没有路由的旧实验页上。
 *
 * 本组件提供三层收尾：
 *   1. 一句话结论（takeaway）与三个关键步骤；
 *   2. 自测：从本课步骤自动生成理解题（也可由内容侧提供 quiz），
 *      答完即判定，并把得分写进学习进度；
 *   3. 本主题边界（limitations）：把「待验证 / 未实现」从讲解正文收拢到这里，
 *      不再打断理解链。
 */
import { computed } from 'vue'
import QuizPanel from '@/components/quiz/QuizPanel.vue'
import type { QuizQuestion } from '@/models/simulation'
import type { VisualLesson } from '@/experiments/visual/types'

const props = defineProps<{
  lesson?: VisualLesson
  /** 主题 id（用于生成题目与统计） */
  lessonId: string
  /** 上一主题 / 下一主题 */
  previousId?: string
  nextId?: string
  /** 内容侧提供的题目（若存在则优先使用） */
  questions?: QuizQuestion[]
  /** 对比类主题（B02/B03）没有 VisualLesson，可直接给结论与边界 */
  takeaway?: string
  limitations?: string[]
}>()

const emit = defineEmits<{ scored: [score: number] }>()

/** 稳定排序：按字符串码点做确定性打散，避免每次渲染顺序抖动 */
function stableShuffle<T>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, key: `${index}-${String(item)}` }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.item)
}

/** 自动生成的理解题：问「第 N 步做了什么」，选项是本课其它步骤的标题 */
const generated = computed<QuizQuestion[]>(() => {
  const steps = props.lesson?.steps ?? []
  if (steps.length < 2) return []
  const picked = steps.slice(0, Math.min(3, steps.length))
  return picked.map((step, index) => {
    const distractors = steps
      .filter((s) => s.title !== step.title)
      .slice(0, 2)
      .map((s) => s.title)
    const options = stableShuffle([step.title, ...distractors]).map((text, i) => ({
      id: `opt-${index}-${i}`,
      text,
    }))
    return {
      id: `auto-${index}`,
      prompt: `第 ${index + 1} 步「${step.title}」之后，发生了什么？`,
      options,
      answerIds: [options.find((o) => o.text === step.title)!.id],
      explanation: step.caption,
    }
  })
})

const questions = computed<QuizQuestion[]>(() =>
  props.questions?.length ? props.questions : generated.value,
)

/** 一句话结论：优先用主题自带的，其次用外部传入的 */
const takeawayText = computed(() => props.lesson?.takeaway ?? props.takeaway ?? '')

/** 本主题边界 */
const limitList = computed<string[]>(() => props.lesson?.limitations ?? props.limitations ?? [])
</script>

<template>
  <section class="lesson-summary" aria-label="本课小结">
    <div class="lesson-summary-head">
      <h2>本课小结</h2>
      <p v-if="takeawayText" class="lesson-takeaway">{{ takeawayText }}</p>
      <p v-else class="lesson-takeaway is-empty">
        本课没有单独写结论——把上面的动画看到最后，就是结论。
      </p>
    </div>

    <ol v-if="lesson?.steps?.length" class="lesson-keypoints">
      <li v-for="(step, i) in lesson.steps" :key="i">
        <span class="lesson-keypoint-index">{{ i + 1 }}</span>
        <span class="lesson-keypoint-title">{{ step.title }}</span>
      </li>
    </ol>

    <details v-if="questions.length" class="lesson-selfcheck">
      <summary>
        <span class="lesson-selfcheck-title">自测：这一步你记住了吗</span>
        <span class="lesson-selfcheck-count">{{ questions.length }} 题 · 60 分以上记为「已掌握」</span>
      </summary>
      <p class="lesson-selfcheck-hint">答完给出得分，结果会写进学习进度。</p>
      <QuizPanel :questions="questions" @submit="(score) => emit('scored', score)" />
    </details>

    <div v-if="limitList.length" class="lesson-limits">
      <h3>本主题边界</h3>
      <ul>
        <li v-for="(item, i) in limitList" :key="i">{{ item }}</li>
      </ul>
    </div>

    <nav class="lesson-summary-nav" aria-label="主题切换">
      <RouterLink v-if="previousId" :to="`/experiment/${previousId}`" class="lesson-nav-prev">← 上一主题</RouterLink>
      <RouterLink v-if="nextId" :to="`/experiment/${nextId}`" class="lesson-nav-next">下一主题 →</RouterLink>
    </nav>
  </section>
</template>

<style scoped>
.lesson-summary {
  margin-top: 18px;
  padding: 20px 22px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 12px;
}
.lesson-summary h2 {
  font-size: var(--vl-fs-lg, 16px);
  margin: 0 0 10px;
}
.lesson-summary h3 {
  font-size: var(--vl-fs-sm, 13px);
  margin: 22px 0 8px;
}
.lesson-takeaway {
  margin: 0 0 14px;
  font-size: var(--vl-fs-md, 14px);
  line-height: 1.8;
  color: var(--vl-ink);
  border-left: 3px solid var(--vl-accent);
  padding-left: 12px;
}
.lesson-takeaway.is-empty {
  color: var(--vl-muted);
  border-left-color: var(--vl-line);
}
.lesson-keypoints {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.lesson-keypoints li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--vl-line);
  border-radius: 8px;
  font-size: var(--vl-fs-sm, 13px);
  color: var(--vl-ink);
}
.lesson-keypoint-index {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--vl-surface-2, var(--vl-line));
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  flex: none;
}
.lesson-selfcheck {
  margin-top: 18px;
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--vl-surface-2, transparent);
}
.lesson-selfcheck summary {
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 10px;
  list-style: none;
}
.lesson-selfcheck summary::-webkit-details-marker {
  display: none;
}
.lesson-selfcheck-title {
  font-size: var(--vl-fs-sm, 13px);
  color: var(--vl-ink);
  font-weight: 600;
}
.lesson-selfcheck-count {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.lesson-selfcheck-hint {
  margin: 10px 0 12px;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.lesson-limits ul {
  margin: 0;
  padding-left: 18px;
  font-size: var(--vl-fs-sm, 13px);
  line-height: 1.8;
  color: var(--vl-muted);
}
.lesson-summary-nav {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding-top: 14px;
  border-top: 1px solid var(--vl-line);
  font-size: var(--vl-fs-sm, 13px);
}
.lesson-summary-nav a {
  color: var(--vl-muted);
  text-decoration: none;
}
.lesson-summary-nav a:hover {
  color: var(--vl-accent);
}
</style>
