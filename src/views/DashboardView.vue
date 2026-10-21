<script setup lang="ts">
/**
 * DashboardView —— 首页
 * ---------------------------------------------------------------------------
 * 三块内容：
 *   1. 项目定位（一句话）+ 关键事实（纯浏览器模拟 / 未接入真实集群）；
 *   2. 模块卡片（每个模块显示需求目录里的实验数与已实现数）；
 *   3. 证据等级统计 + 「从 B02 开始」入口 + 最近学习进度。
 */
import { computed } from 'vue'

import { useLabStore } from '@/app/stores/lab'
import { EVIDENCE_STATS, hasFieldVerifiedEvidence } from '@/evidence'
import { CATALOG, CATALOG_STATS, MODULES, getAllExperiments } from '@/experiments/catalog'

const lab = useLabStore()

/* -------------------------------------------------------------------------- */
/* 目录与模块                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 目录（catalog）是模块归属与实验数的唯一权威；
 * getAllExperiments() 返回的实验定义里，moduleId 已按目录编号归一化。
 */
const experiments = getAllExperiments()
const implementedExperiments = computed(() => experiments.length)

interface ModuleCard {
  id: string
  title: string
  shortTitle: string
  description: string
  total: number
  implemented: number
  percent: number
  /** 该模块下已实现、可直接进入的实验 */
  entries: { id: string; title: string; experimentId: string }[]
}

const moduleCards = computed<ModuleCard[]>(() =>
  MODULES.map((m) => {
    const moduleEntries = CATALOG.filter((e) => e.moduleId === m.id)
    // 「已实现数」以目录条目的 implemented 标记为准（与 CATALOG_STATS.implemented 同口径）
    const implemented = moduleEntries.filter((e) => e.implemented).length
    return {
      id: m.id,
      title: m.title,
      shortTitle: m.shortTitle,
      description: m.description,
      total: moduleEntries.length,
      implemented,
      percent: moduleEntries.length
        ? Math.min(100, Math.round((implemented / moduleEntries.length) * 100))
        : 0,
      entries: moduleEntries
        .filter((e) => e.implemented && e.experimentId)
        .map((e) => ({ id: e.id, title: e.title, experimentId: e.experimentId as string })),
    }
  }),
)

/* -------------------------------------------------------------------------- */
/* 证据等级统计                                                                  */
/* -------------------------------------------------------------------------- */

const EVIDENCE_LEVELS: { level: string; label: string; desc: string; color: string }[] = [
  { level: 'E0', label: 'E0 研究笔记', desc: '内部推断 / 待收集', color: 'var(--color-ev-E0,#64748b)' },
  { level: 'E1', label: 'E1 社区文档', desc: 'Apache Hudi 0.15 官方文档', color: 'var(--color-ev-E1,#0ea5e9)' },
  { level: 'E2', label: 'E2 厂商文档', desc: '华为官方文档中心', color: 'var(--color-ev-E2,#a855f7)' },
  { level: 'E3', label: 'E3 制品坐标', desc: 'Maven 制品 / 版本目录已核实', color: 'var(--color-ev-E3,#f59e0b)' },
  { level: 'E4', label: 'E4 集群实测', desc: '在 r26 上真实跑通并留证', color: 'var(--color-ev-E4,#ef4444)' },
]

const evidenceRows = computed(() =>
  EVIDENCE_LEVELS.map((l) => ({
    ...l,
    count: (EVIDENCE_STATS as unknown as Record<string, number>)[l.level] ?? 0,
    percent: EVIDENCE_STATS.total
      ? Math.round(((EVIDENCE_STATS as unknown as Record<string, number>)[l.level] ?? 0) / EVIDENCE_STATS.total * 100)
      : 0,
  })),
)

/* -------------------------------------------------------------------------- */
/* 学习进度                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * store.progress 是 Record<string, {done, visited, quizScore}>。
 * 对象的键顺序即写入顺序，因此「最后一个键」可以近似当成「最近访问的实验」。
 */
const recentProgress = computed(() => {
  const progress = (lab.progress ?? {}) as Record<
    string,
    { done?: boolean; visited?: boolean; quizScore?: number }
  >
  return Object.entries(progress)
    .map(([id, p]) => ({
      id,
      done: Boolean(p?.done),
      visited: Boolean(p?.visited),
      quizScore: typeof p?.quizScore === 'number' ? p.quizScore : 0,
    }))
    .slice(-6)
    .reverse()
})

const visitedCount = computed(() =>
  Object.values((lab.progress ?? {}) as Record<string, { visited?: boolean }>).filter(
    (p) => p?.visited,
  ).length,
)
const doneCount = computed(() =>
  Object.values((lab.progress ?? {}) as Record<string, { done?: boolean }>).filter((p) => p?.done)
    .length,
)
</script>

<template>
  <div class="flex flex-col gap-4 p-4 text-[var(--color-hudi-text,#e2e8f0)]">
    <!-- ============================ 定位 ============================ -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-4"
    >
      <h1 class="text-xl font-semibold">Hudi Lab —— 华为 MRS r26 定制 Hudi 0.15.0 交互式实验室</h1>
      <p class="mt-2 text-sm leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]">
        本项目是一套<b class="text-[var(--color-hudi-text,#e2e8f0)]">纯浏览器模拟</b>的 Hudi 教学实验室：
        在网页里实现一个 mini-Hudi 内核，真实复现 COW / MOR 的文件落点、Compaction / Clean / Archive
        的表服务语义，以及快照读 / 读优化 / 增量读 / 时间旅行四种查询模式。
        所有画面都由同一份内核状态推导，改一个参数，输出立刻跟着变。
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <router-link to="/experiment/B02">
          <el-button type="primary">从 B02 开始（COW vs MOR）</el-button>
        </router-link>
        <router-link to="/evidence">
          <el-button plain>查看证据库</el-button>
        </router-link>
        <router-link to="/progress">
          <el-button plain>我的学习进度</el-button>
        </router-link>
        <el-tag size="small" type="warning">未连接真实集群</el-tag>
        <el-tag size="small" type="info">目标版本 0.15.0-h0.cbu.mrs.350.r26</el-tag>
        <el-tag size="small" type="info">
          目录 {{ CATALOG_STATS.total }} 条 / {{ CATALOG_STATS.modules }} 个模块
        </el-tag>
        <el-tag size="small" type="info">
          已实现 {{ CATALOG_STATS.implemented }} / {{ CATALOG_STATS.total }} 个目录实验
        </el-tag>
        <el-tag size="small" type="info">可交互实验定义 {{ implementedExperiments }} 个</el-tag>
      </div>
    </section>

    <!-- ============================ 模块卡片 ============================ -->
    <section>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-base font-semibold">模块</h2>
        <span class="text-xs text-[var(--color-hudi-muted,#94a3b8)]">
          「实验数」来自需求目录，「已实现数」来自已写完的实验定义
        </span>
      </div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="m in moduleCards"
          :key="m.id"
          class="flex flex-col gap-2 rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <div class="flex items-center gap-2">
            <span class="rounded border border-[var(--color-hudi-accent,#1d4ed8)] px-2 py-0.5 font-mono text-xs">
              {{ m.id }}
            </span>
            <h3 class="text-sm font-semibold">{{ m.title }}</h3>
          </div>
          <p class="min-h-[2.5rem] text-xs leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]">
            {{ m.description }}
          </p>
          <div class="text-xs">
            <div class="mb-1 flex items-center justify-between">
              <span class="text-[var(--color-hudi-muted,#94a3b8)]">已实现 {{ m.implemented }} / {{ m.total }}</span>
              <span>{{ m.percent }}%</span>
            </div>
            <el-progress :percentage="m.percent" :show-text="false" :stroke-width="6" />
          </div>
          <ul v-if="m.entries.length" class="space-y-1 border-t border-[var(--color-hudi-border,#1f2937)] pt-2 text-xs">
            <li v-for="entry in m.entries" :key="entry.id">
              <router-link
                class="text-[var(--color-hudi-accent,#60a5fa)] underline"
                :to="`/experiment/${entry.experimentId}`"
              >
                {{ entry.id }} {{ entry.title }}
              </router-link>
            </li>
          </ul>
        </article>
        <div
          v-if="!moduleCards.length"
          class="col-span-full rounded-lg border border-dashed border-[var(--color-hudi-border,#1f2937)] p-6 text-center text-sm text-[var(--color-hudi-muted,#94a3b8)]"
        >
          尚未从实验目录读取到模块信息。
        </div>
      </div>
    </section>

    <!-- ============================ 证据等级 ============================ -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-4"
    >
      <h2 class="text-base font-semibold">证据等级统计</h2>
      <p class="mt-1 text-xs text-[var(--color-hudi-muted,#94a3b8)]">
        共 {{ EVIDENCE_STATS.total }} 条证据。等级越靠右，证据强度越高：
        E1 = 社区 0.15 文档，E2 = 华为官方文档，E3 = 制品坐标已核实，E4 = 在 r26 集群上真实跑通。
      </p>

      <el-alert
        class="mt-3"
        type="warning"
        :closable="false"
        show-icon
        :title="`当前证据库 E4 数量为 ${EVIDENCE_STATS.E4} —— 本项目全部为本地模拟，未接入真实 r26 集群`"
        :description="
          hasFieldVerifiedEvidence()
            ? '注意：证据库中已存在 E4 条目，请核对其实测环境。'
            : '任何涉及 r26 现场行为（尤其是 MOR 首次写入的文件落点、run clean 在 MRS 3.1.x 的可用性）的结论，界面都会标注「待验证」。'
        "
      />

      <div class="mt-3 space-y-2">
        <div v-for="row in evidenceRows" :key="row.level" class="flex items-center gap-3 text-xs">
          <span class="w-36 shrink-0" :style="{ color: row.color }">{{ row.label }}</span>
          <div class="h-3 flex-1 overflow-hidden rounded bg-black/30">
            <div
              class="h-full rounded"
              :style="{ width: `${row.percent}%`, background: row.color, minWidth: row.count ? '4px' : '0' }"
            />
          </div>
          <span class="w-24 shrink-0 text-right">{{ row.count }} 条</span>
          <span class="hidden w-56 shrink-0 text-[var(--color-hudi-muted,#94a3b8)] md:inline">
            {{ row.desc }}
          </span>
        </div>
      </div>
    </section>

    <!-- ============================ 学习进度 ============================ -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-4"
    >
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-base font-semibold">最近学习进度</h2>
        <span class="text-xs text-[var(--color-hudi-muted,#94a3b8)]">
          已访问 {{ visitedCount }} 个 · 已完成 {{ doneCount }} 个
        </span>
      </div>
      <div v-if="!recentProgress.length" class="text-sm text-[var(--color-hudi-muted,#94a3b8)]">
        还没有学习记录 —— 建议先从
        <router-link class="text-[var(--color-hudi-accent,#60a5fa)] underline" to="/experiment/B02">
          B02（COW vs MOR）
        </router-link>
        开始。
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="item in recentProgress"
          :key="item.id"
          class="flex flex-wrap items-center gap-2 rounded border border-[var(--color-hudi-border,#1f2937)] px-3 py-2 text-xs"
        >
          <router-link class="font-medium underline" :to="`/experiment/${item.id}`">{{ item.id }}</router-link>
          <el-tag size="small" :type="item.done ? 'success' : 'info'">
            {{ item.done ? '已完成' : item.visited ? '进行中' : '未开始' }}
          </el-tag>
          <el-tag size="small" :type="item.quizScore >= 80 ? 'success' : 'warning'">
            练习得分 {{ item.quizScore }}
          </el-tag>
        </li>
      </ul>
    </section>
  </div>
</template>
