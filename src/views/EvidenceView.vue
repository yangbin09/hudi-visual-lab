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
        <el-button size="small" type="primary" plain>回到 B02 实验</el-button>
      </router-link>
    </header>

    <!-- 显著位置：E4 = 0 的提醒 -->
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      :title="`当前证据库 E4 数量为 ${EVIDENCE_STATS.E4} —— 本项目全部为本地模拟，未接入真实 r26 集群`"
      :description="
        hasFieldVerifiedEvidence()
          ? '证据库中存在 E4 条目，请核对其实测环境与命令。'
          : 'E0 = 研究笔记 / 待收集；E1 = 社区 0.15 文档；E2 = 华为官方文档；E3 = Maven 制品坐标已核实；E4 = r26 集群实测（本项目暂无）。' +
            '凡是 r26 未实测的行为，实验页都会标注「待验证」。'
      "
    />

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
        <el-input
          v-model="keyword"
          size="small"
          clearable
          placeholder="搜索 id / 标题 / 版本 / 制品坐标 / 实测结果"
          class="w-72"
        />
        <el-select v-model="levelFilter" size="small" clearable placeholder="证据等级" class="w-44">
          <el-option v-for="o in levelOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="sourceFilter" size="small" clearable placeholder="来源类型" class="w-40">
          <el-option v-for="o in sourceOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-select v-model="componentFilter" size="small" clearable placeholder="组件" class="w-44">
          <el-option v-for="o in componentOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button size="small" @click="resetFilters">重置筛选</el-button>
        <span class="ml-auto text-xs text-[var(--color-hudi-muted,#94a3b8)]">
          命中 {{ filtered.length }} / {{ EVIDENCE_REPOSITORY.length }} 条
        </span>
      </div>
    </section>

    <!-- 证据表 -->
    <section
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
    >
      <el-table :data="filtered" size="small" border stripe class="w-full">
        <el-table-column prop="evidenceId" label="证据 ID" width="200" show-overflow-tooltip />
        <el-table-column prop="title" label="标题" min-width="260" show-overflow-tooltip />
        <el-table-column label="等级" width="110">
          <template #default="{ row }">
            <el-tag size="small" :style="{ background: levelColor(row.evidenceLevel), color: '#0b1120', border: 'none' }">
              {{ row.evidenceLevel }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="component" label="组件" width="140" show-overflow-tooltip />
        <el-table-column prop="version" label="版本" width="190" show-overflow-tooltip />
        <el-table-column label="来源类型" width="120">
          <template #default="{ row }">{{ SOURCE_LABEL[row.sourceType] ?? row.sourceType }}</template>
        </el-table-column>
        <el-table-column label="文档链接" width="110">
          <template #default="{ row }">
            <el-link v-if="row.documentUrl" :href="row.documentUrl" target="_blank" type="primary">
              打开
            </el-link>
            <span v-else class="text-[var(--color-hudi-muted,#94a3b8)]">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="artifactCoordinate" label="制品坐标" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.artifactCoordinate" class="font-mono text-[11px]">{{ row.artifactCoordinate }}</span>
            <span v-else class="text-[var(--color-hudi-muted,#94a3b8)]">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="actualResult" label="实测结果" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.actualResult">{{ row.actualResult }}</span>
            <span v-else class="text-[var(--color-hudi-muted,#94a3b8)]">
              {{ row.notes ?? '（暂无实测结果）' }}
            </span>
          </template>
        </el-table-column>
      </el-table>
    </section>
    </main>
  </div>
</template>

<style scoped>
/* 触屏：Element Plus 的小按钮与链接也要达到 44×44 */
@media (pointer: coarse) {
  :deep(.el-button) {
    min-height: 44px;
  }
  :deep(.el-link) {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
}
</style>
