<script setup lang="ts">
/**
 * ProgressView —— 学习进度
 * ---------------------------------------------------------------------------
 * 数据全部来自 store 的 progress（Record<实验 id, {done, visited, quizScore}>）。
 * 页面只做统计与展示，不产生任何学习行为；「重做」通过跳回实验页完成。
 */
import { computed } from 'vue'

import { useLabStore } from '@/app/stores/lab'
import type { ExperimentDefinition, QuizQuestion } from '@/models/simulation'
import { CATALOG, MODULES, getAllExperiments, getCatalogEntry } from '@/experiments/catalog'

const lab = useLabStore()

/* -------------------------------------------------------------------------- */
/* 目录                                                                          */
/* -------------------------------------------------------------------------- */

/**
 * getAllExperiments() 返回的实验定义里，moduleId 已按目录编号归一化，
 * 因此这里可以直接按 moduleId 归组统计。
 */
const experiments = computed<ExperimentDefinition[]>(() => getAllExperiments())
const modules = computed(() => MODULES)
const experimentById = computed(() => {
  const map = new Map<string, ExperimentDefinition>()
  experiments.value.forEach((e) => map.set(e.id, e))
  return map
})

/* -------------------------------------------------------------------------- */
/* 统计                                                                          */
/* -------------------------------------------------------------------------- */

interface ProgressEntry {
  id: string
  title: string
  moduleId: string
  difficulty: string
  done: boolean
  visited: boolean
  quizScore: number
}

const entries = computed<ProgressEntry[]>(() => {
  const progress = (lab.progress ?? {}) as Record<
    string,
    { done?: boolean; visited?: boolean; quizScore?: number }
  >
  return Object.entries(progress).map(([id, p]) => {
    const def = experimentById.value.get(id)
    const catalogEntry = getCatalogEntry(id)
    return {
      id,
      title: def?.title ?? catalogEntry?.title ?? id,
      moduleId: def?.moduleId ?? catalogEntry?.moduleId ?? '—',
      difficulty: def?.difficulty ?? '—',
      done: Boolean(p?.done),
      visited: Boolean(p?.visited),
      quizScore: typeof p?.quizScore === 'number' ? p.quizScore : 0,
    }
  })
})

const visitedCount = computed(() => entries.value.filter((e) => e.visited).length)
const doneCount = computed(() => entries.value.filter((e) => e.done).length)
const attempted = computed(() => entries.value.filter((e) => e.visited && e.quizScore > 0))
const averageScore = computed(() => {
  if (!attempted.value.length) return 0
  return Math.round(attempted.value.reduce((n, e) => n + e.quizScore, 0) / attempted.value.length)
})
const perfectCount = computed(() => attempted.value.filter((e) => e.quizScore >= 100).length)

interface ModuleProgress {
  id: string
  title: string
  total: number
  done: number
  percent: number
}

const moduleProgress = computed<ModuleProgress[]>(() => {
  const byModule = new Map<string, ModuleProgress>()
  const touch = (moduleId: string): ModuleProgress => {
    let item = byModule.get(moduleId)
    if (!item) {
      const def = modules.value.find((m) => m.id === moduleId)
      item = { id: moduleId, title: def?.title ?? moduleId, total: 0, done: 0, percent: 0 }
      byModule.set(moduleId, item)
    }
    return item
  }

  // 分母：需求目录里该模块的全部实验条目；分子：progress 里标记为 done 的实验
  CATALOG.forEach((e) => {
    touch(e.moduleId).total += 1
    const p = lab.progress?.[e.id]
    if (p?.done) touch(e.moduleId).done += 1
  })
  // 只在 progress 里出现、但目录里还没有的实验（实验 id 与目录编号可能不同）
  entries.value.forEach((e) => {
    if (CATALOG.some((c) => c.id === e.id)) return
    touch(e.moduleId).total += 1
    if (e.done) touch(e.moduleId).done += 1
  })
  // 目录里还没有条目的模块：分母取已实现的实验数
  experiments.value.forEach((e) => {
    const item = byModule.get(e.moduleId)
    if (item) return
    touch(e.moduleId).total += 1
    if (lab.progress?.[e.id]?.done) touch(e.moduleId).done += 1
  })

  return [...byModule.values()]
    .map((m) => ({ ...m, percent: m.total ? Math.round((m.done / m.total) * 100) : 0 }))
    .sort((a, b) => a.id.localeCompare(b.id))
})

/* -------------------------------------------------------------------------- */
/* 错题回顾                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * store 只记录「每个实验的练习得分」，不记录逐题正确率。
 * 因此这里的「错题回顾」= 练习得分 < 100 的实验里需要重做的题目，
 * 并给出正确答案与解析。
 */
interface ReviewItem {
  experimentId: string
  question: QuizQuestion
  correctText: string
}

const reviewItems = computed<ReviewItem[]>(() => {
  const items: ReviewItem[] = []
  entries.value
    .filter((e) => e.visited && e.quizScore > 0 && e.quizScore < 100)
    .forEach((entry) => {
      const def = experimentById.value.get(entry.id)
      ;(def?.quiz ?? []).forEach((q) => {
        const correct = q.options.filter((o) => q.answerIds.includes(o.id)).map((o) => o.text)
        items.push({
          experimentId: entry.id,
          question: q,
          correctText: correct.join('；') || '（见解析）',
        })
      })
    })
  return items
})

const pendingExperiments = computed(() => entries.value.filter((e) => e.visited && !e.done))
</script>

<template>
  <div class="flex flex-col gap-4 p-4 text-[var(--color-hudi-text,#e2e8f0)]">
    <header>
      <h1 class="text-xl font-semibold">学习进度</h1>
      <p class="mt-1 text-sm text-[var(--color-hudi-muted,#94a3b8)]">
        进度数据保存在浏览器本地（store.progress），不依赖任何后端。
      </p>
    </header>

    <!-- ============================ 概览 ============================ -->
    <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div
        v-for="card in [
          { label: '已访问实验', value: visitedCount, suffix: '个' },
          { label: '已完成实验', value: doneCount, suffix: '个' },
          { label: '平均练习得分', value: averageScore, suffix: '分' },
          { label: '练习满分实验', value: perfectCount, suffix: '个' },
        ]"
        :key="card.label"
        class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
      >
        <div class="text-xs text-[var(--color-hudi-muted,#94a3b8)]">{{ card.label }}</div>
        <div class="mt-1 text-2xl font-semibold">
          {{ card.value }}<span class="ml-1 text-xs font-normal text-[var(--color-hudi-muted,#94a3b8)]">{{ card.suffix }}</span>
        </div>
      </div>
    </section>

    <!-- ============================ 模块完成率 ============================ -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-4"
    >
      <h2 class="mb-3 text-base font-semibold">各模块完成率</h2>
      <div v-if="!moduleProgress.length" class="text-sm text-[var(--color-hudi-muted,#94a3b8)]">
        还没有任何学习记录。
      </div>
      <div v-else class="space-y-3">
        <div v-for="m in moduleProgress" :key="m.id">
          <div class="mb-1 flex items-center justify-between text-xs">
            <span>
              <span class="mr-2 font-mono text-[var(--color-hudi-muted,#94a3b8)]">{{ m.id }}</span>
              {{ m.title }}
            </span>
            <span class="text-[var(--color-hudi-muted,#94a3b8)]">{{ m.done }} / {{ m.total }}</span>
          </div>
          <el-progress :percentage="m.percent" :stroke-width="8" />
        </div>
      </div>
    </section>

    <!-- ============================ 实验列表 ============================ -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-4"
    >
      <h2 class="mb-3 text-base font-semibold">实验清单与练习得分</h2>
      <el-table :data="entries" size="small" border stripe class="w-full">
        <el-table-column prop="id" label="实验" width="90">
          <template #default="{ row }">
            <router-link class="underline" :to="`/experiment/${row.id}`">{{ row.id }}</router-link>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="260" show-overflow-tooltip />
        <el-table-column prop="moduleId" label="模块" width="90" />
        <el-table-column prop="difficulty" label="难度" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.done ? 'success' : row.visited ? 'warning' : 'info'">
              {{ row.done ? '已完成' : row.visited ? '进行中' : '未开始' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="练习得分" width="120">
          <template #default="{ row }">
            <span :class="row.quizScore >= 100 ? 'text-emerald-400' : row.quizScore > 0 ? 'text-amber-400' : ''">
              {{ row.quizScore > 0 ? `${row.quizScore} 分` : '未作答' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="110">
          <template #default="{ row }">
            <router-link :to="`/experiment/${row.id}`">
              <el-button size="small" plain>{{ row.done ? '复习' : '继续' }}</el-button>
            </router-link>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!entries.length" class="mt-2 text-sm text-[var(--color-hudi-muted,#94a3b8)]">
        还没有任何学习记录 —— 先去
        <router-link class="underline" to="/experiment/B02">B02（COW vs MOR）</router-link>
        走一遍。
      </p>
    </section>

    <!-- ============================ 错题回顾 ============================ -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-4"
    >
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-semibold">错题回顾</h2>
        <span class="text-xs text-[var(--color-hudi-muted,#94a3b8)]">
          练习得分未满分的实验需要重做；store 只记录实验级得分，因此这里列出这些实验的全部题目与解析
        </span>
      </div>

      <div v-if="!reviewItems.length" class="text-sm text-[var(--color-hudi-muted,#94a3b8)]">
        暂无需要重做的题目（要么还没作答，要么都已满分）。
      </div>

      <div v-else class="space-y-3">
        <article
          v-for="(item, idx) in reviewItems"
          :key="`${item.experimentId}-${item.question.id}-${idx}`"
          class="rounded border border-[var(--color-hudi-border,#1f2937)] p-3"
        >
          <div class="mb-1 flex flex-wrap items-center gap-2 text-xs">
            <router-link class="font-mono underline" :to="`/experiment/${item.experimentId}`">
              {{ item.experimentId }}
            </router-link>
            <el-tag size="small" :type="item.question.multiple ? 'warning' : 'info'">
              {{ item.question.multiple ? '多选题' : '单选题' }}
            </el-tag>
          </div>
          <p class="text-sm">{{ item.question.prompt }}</p>
          <p class="mt-1 text-xs text-emerald-400">正确答案：{{ item.correctText }}</p>
          <p class="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]">
            {{ item.question.explanation }}
          </p>
        </article>
      </div>

      <div v-if="pendingExperiments.length" class="mt-4 border-t border-[var(--color-hudi-border,#1f2937)] pt-3">
        <h3 class="mb-2 text-sm font-semibold">进行中的实验</h3>
        <div class="flex flex-wrap gap-2">
          <router-link v-for="e in pendingExperiments" :key="e.id" :to="`/experiment/${e.id}`">
            <el-button size="small" plain>{{ e.id }} {{ e.title }}</el-button>
          </router-link>
        </div>
      </div>
    </section>
  </div>
</template>
