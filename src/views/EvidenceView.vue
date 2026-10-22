<script setup lang="ts">
/**
 * EvidenceView —— 证据库总览
 * ---------------------------------------------------------------------------
 * 这一页的作用是「让证据强度可见」：
 *   - 任何一条结论都能追到它的来源（社区文档 / 华为文档 / 制品坐标 / 实测）；
 *   - 等级分布一眼可见，尤其要能看到 E4 为 0 —— 提醒使用者：本项目全部是本地模拟。
 */
import { computed, ref } from 'vue'

import { EVIDENCE_REPOSITORY, EVIDENCE_STATS, hasFieldVerifiedEvidence } from '@/evidence'
import type { Evidence, EvidenceLevel } from '@/models/evidence'
import VisualNav from '@/components/visual/VisualNav.vue'

const keyword = ref('')
const levelFilter = ref<string>('')
const sourceFilter = ref<string>('')
const componentFilter = ref<string>('')

const LEVEL_LABEL: Record<EvidenceLevel, string> = {
  E0: 'E0 研究笔记',
  E1: 'E1 社区文档',
  E2: 'E2 厂商文档',
  E3: 'E3 制品坐标',
  E4: 'E4 集群实测',
}

const SOURCE_LABEL: Record<string, string> = {
  'community-doc': '社区文档',
  'huawei-doc': '华为文档',
  'maven-artifact': 'Maven 制品',
  'research-note': '研究笔记',
  'source-analysis': '源码分析',
  bytecode: '字节码分析',
  'spark-sql-test': 'Spark SQL 实测',
  'flink-sql-test': 'Flink SQL 实测',
  'hdfs-snapshot': 'HDFS 快照',
  'timeline-metadata': 'Timeline 元数据',
  'error-log': '错误日志',
}

function levelColor(level: EvidenceLevel): string {
  return `var(--color-ev-${level}, #64748b)`
}

const EVIDENCE_LEVEL_KEYS: EvidenceLevel[] = ['E0', 'E1', 'E2', 'E3', 'E4']

/** 模板里不能写 TS 断言，统计取值统一走这个函数 */
function statsOf(level: EvidenceLevel): number {
  return (EVIDENCE_STATS as unknown as Record<string, number>)[level] ?? 0
}

const levelOptions = computed(() =>
  (Object.keys(LEVEL_LABEL) as EvidenceLevel[]).map((l) => ({
    value: l,
    label: `${LEVEL_LABEL[l]}（${statsOf(l)}）`,
  })),
)

const sourceOptions = computed(() => {
  const set = new Set(EVIDENCE_REPOSITORY.map((e) => e.sourceType))
  return [...set].sort().map((s) => ({ value: s, label: SOURCE_LABEL[s] ?? s }))
})

const componentOptions = computed(() => {
  const set = new Set(EVIDENCE_REPOSITORY.map((e) => e.component))
  return [...set].sort().map((c) => ({ value: c, label: c }))
})

const filtered = computed<Evidence[]>(() => {
  const kw = keyword.value.trim().toLowerCase()
  return EVIDENCE_REPOSITORY.filter((e) => {
    if (levelFilter.value && e.evidenceLevel !== levelFilter.value) return false
    if (sourceFilter.value && e.sourceType !== sourceFilter.value) return false
    if (componentFilter.value && e.component !== componentFilter.value) return false
    if (!kw) return true
    const haystack = [
      e.evidenceId,
      e.title,
      e.component,
      e.version,
      e.sourceType,
      e.documentUrl ?? '',
      e.artifactCoordinate ?? '',
      e.actualResult ?? '',
      e.expectedResult ?? '',
      e.notes ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(kw)
  })
})

function resetFilters(): void {
  keyword.value = ''
  levelFilter.value = ''
  sourceFilter.value = ''
  componentFilter.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4 text-[var(--color-hudi-text,#e2e8f0)]">
    <VisualNav :crumbs="[{ text: '证据库' }]" />
    <main class="flex flex-col gap-4">
    <header class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 class="text-xl font-semibold">证据库</h1>
        <p class="mt-1 text-sm text-[var(--color-hudi-muted,#94a3b8)]">
          每条结论都要挂靠一条可追溯的证据。等级越高，证据越接近「在 r26 上真的跑过」。
        </p>
      </div>
      <router-link to="/experiment/B02">
        <span class="evidence-button">回到 B02 实验</span>
      </router-link>
    </header>

    <!-- 显著位置：E4 = 0 的提醒 -->
    <aside class="evidence-notice" role="note">
      <strong>当前证据库 E4 数量为 {{ EVIDENCE_STATS.E4 }} · 全部为本地模拟，未接入真实 r26 集群</strong>
      <p>{{ hasFieldVerifiedEvidence() ? '请核对 E4 条目的实测环境与命令。' : 'E0：待收集；E1：社区文档；E2：华为文档；E3：制品坐标；E4：r26 集群实测。' }}</p>
    </aside>

    <!-- 等级分布 -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-4"
    >
      <div class="mb-2 flex items-center gap-2">
        <h2 class="text-base font-semibold">等级分布</h2>
        <span class="text-xs text-[var(--color-hudi-muted,#94a3b8)]">共 {{ EVIDENCE_STATS.total }} 条</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="level in EVIDENCE_LEVEL_KEYS"
          :key="level"
          class="flex min-w-[7.5rem] flex-1 flex-col gap-1 rounded border border-[var(--color-hudi-border,#1f2937)] p-2"
        >
          <span class="text-xs font-medium" :style="{ color: levelColor(level) }">
            {{ LEVEL_LABEL[level] }}
          </span>
          <span class="text-lg font-semibold">
            {{ statsOf(level) }}
          </span>
        </div>
      </div>
    </section>

    <!-- 筛选 -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <input v-model="keyword" type="search" aria-label="搜索证据" placeholder="搜索 id / 标题 / 版本 / 制品坐标 / 实测结果" class="evidence-input" />
        <select v-model="levelFilter" aria-label="证据等级"><option value="">全部等级</option><option v-for="o in levelOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select>
        <select v-model="sourceFilter" aria-label="来源类型"><option value="">全部来源</option><option v-for="o in sourceOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select>
        <select v-model="componentFilter" aria-label="组件"><option value="">全部组件</option><option v-for="o in componentOptions" :key="o.value" :value="o.value">{{ o.label }}</option></select>
        <button class="evidence-button" @click="resetFilters">重置筛选</button>
        <span class="ml-auto text-xs text-[var(--color-hudi-muted,#94a3b8)]">
          命中 {{ filtered.length }} / {{ EVIDENCE_REPOSITORY.length }} 条
        </span>
      </div>
    </section>

    <!-- 证据表 -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
    >
      <div class="evidence-table-scroll" tabindex="0" aria-label="证据表，可横向滚动">
        <table class="evidence-table"><caption class="sr-only">可追溯的版本与实现依据</caption>
          <thead><tr><th v-for="label in ['证据 ID','标题','等级','组件','版本','来源类型','文档链接','制品坐标','实测结果']" :key="label" scope="col">{{ label }}</th></tr></thead>
          <tbody><tr v-for="row in filtered" :key="row.evidenceId"><td>{{ row.evidenceId }}</td><td>{{ row.title }}</td><td><span :style="{color:levelColor(row.evidenceLevel)}">{{ row.evidenceLevel }}</span></td><td>{{ row.component }}</td><td>{{ row.version }}</td><td>{{ SOURCE_LABEL[row.sourceType] ?? row.sourceType }}</td><td><a v-if="row.documentUrl" :href="row.documentUrl" target="_blank" rel="noopener noreferrer">查看文档 ↗</a><span v-else>暂无</span></td><td>{{ row.artifactCoordinate || '—' }}</td><td>{{ row.actualResult || '未实测' }}</td></tr><tr v-if="!filtered.length"><td colspan="9">没有匹配的证据，请调整筛选条件。</td></tr></tbody>
        </table>
      </div>
    </section>
    </main>
  </div>
</template>

<style scoped>
.evidence-notice{padding:16px;border:1px solid var(--color-hudi-border);border-radius:8px;background:var(--color-hudi-panel)}
.evidence-notice p{font-size:13px;margin-top:8px}.evidence-input,select,.evidence-button{border:1px solid var(--color-hudi-border);border-radius:6px;padding:7px 10px;background:var(--color-hudi-panel);color:var(--color-hudi-text);font-size:13px}.evidence-input{width:min(360px,100%)}.evidence-table-scroll{max-width:100%;overflow:auto}.evidence-table{border-collapse:collapse;min-width:1200px;width:100%;font-size:13px}.evidence-table th,.evidence-table td{border-bottom:1px solid var(--color-hudi-border);padding:12px;text-align:left;vertical-align:top;max-width:320px;overflow-wrap:anywhere}.evidence-table a{color:var(--color-hudi-primary,#86b990)}
</style>
