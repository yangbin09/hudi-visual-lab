<script setup lang="ts">
/**
 * QuizPanel —— 实验练习题
 * ---------------------------------------------------------------------------
 * 判分口径：得分 = 答对题数 / 总题数（百分制，四舍五入取整）。
 * 多选题必须**完全匹配**才算答对（少选、多选都算错）—— 这是刻意的严格口径，
 * 界面上必须写清楚，否则使用者会以为「选对几个算几个分」。
 */
import { computed, ref } from 'vue'

import type { QuizQuestion } from '@/models/simulation'

const props = defineProps<{ questions: QuizQuestion[] }>()
const emit = defineEmits<{ (e: 'submit', score: number): void }>()

const questions = computed<QuizQuestion[]>(() => props.questions ?? [])

/** questionId → 已选 optionId 列表 */
const answers = ref<Record<string, string[]>>({})
const submitted = ref(false)

function selectedOf(questionId: string): string[] {
  return answers.value[questionId] ?? []
}

function isSelected(questionId: string, optionId: string): boolean {
  return selectedOf(questionId).includes(optionId)
}

function toggle(question: QuizQuestion, optionId: string): void {
  if (submitted.value) return
  const current = selectedOf(question.id)
  if (question.multiple) {
    const next = current.includes(optionId)
      ? current.filter((id) => id !== optionId)
      : [...current, optionId]
    answers.value = { ...answers.value, [question.id]: next }
    return
  }
  answers.value = { ...answers.value, [question.id]: [optionId] }
}

/** 多选：集合必须完全一致；单选：答案唯一 */
function isCorrect(question: QuizQuestion): boolean {
  const picked = [...selectedOf(question.id)].sort()
  const expected = [...(question.answerIds ?? [])].sort()
  if (picked.length !== expected.length) return false
  return picked.every((id, idx) => id === expected[idx])
}

const answeredCount = computed<number>(
  () => questions.value.filter((q) => selectedOf(q.id).length > 0).length,
)

const correctCount = computed<number>(() => questions.value.filter((q) => isCorrect(q)).length)

/** 百分制整数得分 */
const score = computed<number>(() => {
  if (!questions.value.length) return 0
  return Math.round((correctCount.value / questions.value.length) * 100)
})

function submit(): void {
  if (submitted.value) return
  submitted.value = true
  emit('submit', score.value)
}

function reset(): void {
  answers.value = {}
  submitted.value = false
}

/** 某个选项在批改后的状态 */
type OptionMark = 'correct' | 'wrong-pick' | 'missed' | 'normal'

function markOf(question: QuizQuestion, optionId: string): OptionMark {
  if (!submitted.value) return 'normal'
  const isAnswer = (question.answerIds ?? []).includes(optionId)
  const picked = isSelected(question.id, optionId)
  if (isAnswer && picked) return 'correct'
  if (isAnswer && !picked) return 'missed'
  if (!isAnswer && picked) return 'wrong-pick'
  return 'normal'
}

const MARK_TEXT: Record<OptionMark, string> = {
  correct: '正确',
  'wrong-pick': '你的选择（错误）',
  missed: '正确答案',
  normal: '',
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 工具条 -->
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-[var(--color-hudi-muted,#94a3b8)]">
        共 {{ questions.length }} 题，已作答 {{ answeredCount }} 题
        <template v-if="questions.some((q) => q.multiple)">
          ｜ 含多选题（多选必须完全选对才算答对）
        </template>
      </span>
      <button
        type="button"
        class="rounded border border-[var(--color-hudi-border,#1f2937)] px-2 py-1 hover:bg-slate-700/60"
        :disabled="submitted"
        :class="submitted ? 'cursor-not-allowed opacity-50' : ''"
        @click="submit"
      >
        提交答案
      </button>
      <button
        type="button"
        class="rounded border border-[var(--color-hudi-border,#1f2937)] px-2 py-1 hover:bg-slate-700/60"
        @click="reset"
      >
        重做
      </button>
      <span
        v-if="submitted"
        class="rounded px-2 py-0.5 text-[11px] font-semibold"
        :style="{
          background: score >= 60 ? 'var(--color-ev-E4, #22c55e)' : 'var(--color-ev-E1, #3b82f6)',
          color: '#0b1120',
        }"
      >
        得分 {{ score }} 分（{{ correctCount }} / {{ questions.length }}）
      </span>
    </div>

    <!-- 空态 -->
    <div
      v-if="!questions.length"
      class="rounded-lg border border-dashed border-[var(--color-hudi-border,#1f2937)] px-4 py-6 text-center text-sm text-[var(--color-hudi-muted,#94a3b8)]"
    >
      本实验暂未配置练习题。
    </div>

    <!-- 题目 -->
    <section
      v-for="(question, qIdx) in questions"
      :key="question.id"
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
      :data-question-id="question.id"
    >
      <header class="mb-2 flex items-start gap-2">
        <span class="mt-0.5 text-[11px] font-semibold text-[var(--color-hudi-muted,#94a3b8)]">
          第 {{ qIdx + 1 }} 题
        </span>
        <h3 class="min-w-0 flex-1 text-sm font-medium leading-relaxed">{{ question.prompt }}</h3>
        <span
          class="rounded border border-[var(--color-hudi-border,#1f2937)] px-1.5 py-0.5 text-[11px] text-[var(--color-hudi-muted,#94a3b8)]"
        >
          {{ question.multiple ? '多选' : '单选' }}
        </span>
        <span
          v-if="submitted"
          class="rounded px-1.5 py-0.5 text-[11px] font-semibold text-slate-900"
          :style="{
            background: isCorrect(question) ? 'var(--color-ev-E4, #22c55e)' : 'var(--color-ev-E1, #3b82f6)',
          }"
        >
          {{ isCorrect(question) ? '答对' : '答错' }}
        </span>
      </header>

      <!-- 选项 -->
      <ul class="flex flex-col gap-1.5">
        <li v-for="option in question.options" :key="option.id">
          <button
            type="button"
            class="flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left text-xs leading-relaxed"
            :class="[
              markOf(question, option.id) === 'correct'
                ? 'border-emerald-500/60 bg-emerald-500/15'
                : markOf(question, option.id) === 'wrong-pick'
                  ? 'border-rose-500/60 bg-rose-500/15'
                  : markOf(question, option.id) === 'missed'
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : 'border-[var(--color-hudi-border,#1f2937)]',
              submitted ? 'cursor-default' : 'hover:bg-slate-700/40',
            ]"
            @click="toggle(question, option.id)"
          >
            <span
              class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]"
              :class="
                isSelected(question.id, option.id)
                  ? 'border-[var(--color-hudi-accent,#60a5fa)] bg-[var(--color-hudi-accent,#60a5fa)] text-slate-900'
                  : 'border-slate-500'
              "
            >
              {{ isSelected(question.id, option.id) ? '✓' : '' }}
            </span>
            <span class="min-w-0 flex-1">
              <b class="mr-1 font-mono">{{ option.id }}</b>{{ option.text }}
            </span>
            <span
              v-if="submitted && markOf(question, option.id) !== 'normal'"
              class="shrink-0 text-[11px]"
              :class="
                markOf(question, option.id) === 'wrong-pick' ? 'text-rose-300' : 'text-emerald-300'
              "
            >
              {{ MARK_TEXT[markOf(question, option.id)] }}
            </span>
          </button>
        </li>
      </ul>

      <!-- 批改结果 + 解析 -->
      <div v-if="submitted" class="mt-2 rounded border border-[var(--color-hudi-border,#1f2937)] bg-black/25 p-2">
        <div class="mb-1 flex flex-wrap items-center gap-3 text-[11px]">
          <span class="text-emerald-300">
            正确答案：{{ (question.answerIds ?? []).join('、') || '—' }}
          </span>
          <span class="text-[var(--color-hudi-muted,#94a3b8)]">
            你的选择：{{ selectedOf(question.id).join('、') || '未作答' }}
          </span>
        </div>
        <p class="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
          {{ question.explanation }}
        </p>
        <p v-if="question.multiple" class="mt-1 text-[11px] text-amber-300/90">
          提示：多选题必须与正确答案完全一致（不多选、不少选）才算答对。
        </p>
      </div>
    </section>
  </div>
</template>
