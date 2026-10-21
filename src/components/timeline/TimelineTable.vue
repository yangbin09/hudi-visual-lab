<script setup lang="ts">
/**
 * TimelineTable —— Timeline 的表格视图
 * ---------------------------------------------------------------------------
 * 与 TimelineView 互补：时间轴看「节奏」，表格看「细节」（operation / 涉及文件数 / 元信息）。
 */
import { computed } from 'vue'
import type { HudiInstant, InstantState } from '@/models/hudi'
import { prettyInstant } from '@/engine/core/instant'

/* -------------------------------------------------------------------------- */
/* Props / Emits                                                               */
/* -------------------------------------------------------------------------- */

const props = defineProps<{
  timeline: HudiInstant[]
}>()

const emit = defineEmits<{
  (e: 'select', instant: HudiInstant): void
}>()

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

const ACTION_LABEL: Record<string, string> = {
  COMMIT: 'COMMIT',
  DELTA_COMMIT: 'DELTA COMMIT',
  COMPACTION: 'COMPACTION',
  CLEAN: 'CLEAN',
  ARCHIVE: 'ARCHIVE',
  ROLLBACK: 'ROLLBACK',
  REPLACE_COMMIT: 'REPLACE COMMIT',
  CLUSTERING: 'CLUSTERING',
  RESTORE: 'RESTORE',
  TTL: 'TTL',
  SAVEPOINT: 'SAVEPOINT',
}

/** extraMetadata 里值得展示的键，按重要性排序 */
const META_PRIORITY = [
  'recordsChanged',
  'scenarioRule',
  'planFileCount',
  'planInstant',
  'fileGroups',
  'deletedCount',
  'commitsRetained',
  'archivedCount',
  'boundary',
  'rolledBack',
  'removedFiles',
  'targetFileSizeMb',
  'expiredPartitions',
  'spec',
  'failure',
  'executedAt',
]

const MAX_META_CHIPS = 5

/* -------------------------------------------------------------------------- */
/* 数据                                                                        */
/* -------------------------------------------------------------------------- */

const rows = computed<HudiInstant[]>(() =>
  [...(props.timeline ?? [])].filter(Boolean).sort((a, b) => String(a.instantTime).localeCompare(String(b.instantTime))),
)

interface MetaChip {
  key: string
  value: string
}

function formatMetaValue(value: unknown): string {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number' || typeof value === 'string') return String(value)
  return JSON.stringify(value)
}

function metaChips(instant: HudiInstant): MetaChip[] {
  const meta = instant.extraMetadata
  if (!meta || typeof meta !== 'object') return []
  const entries = Object.entries(meta)
  const ordered: MetaChip[] = []
  META_PRIORITY.forEach((k) => {
    if (k in meta) ordered.push({ key: k, value: formatMetaValue(meta[k]) })
  })
  entries.forEach(([k, v]) => {
    if (!ordered.some((c) => c.key === k)) ordered.push({ key: k, value: formatMetaValue(v) })
  })
  return ordered
}

const summary = computed<Record<string, number>>(() => {
  const out: Record<string, number> = {}
  rows.value.forEach((r) => {
    const key = r.action ?? 'UNKNOWN'
    out[key] = (out[key] ?? 0) + 1
  })
  return out
})

/* -------------------------------------------------------------------------- */
/* 样式                                                                        */
/* -------------------------------------------------------------------------- */

function stateClass(state: InstantState): string {
  if (state === 'REQUESTED') return 'st-requested'
  if (state === 'INFLIGHT') return 'st-inflight'
  return 'st-completed'
}

function actionClass(action: string): string {
  switch (action) {
    case 'COMMIT':
      return 'act-commit'
    case 'DELTA_COMMIT':
      return 'act-deltacommit'
    case 'COMPACTION':
      return 'act-compaction'
    case 'CLEAN':
      return 'act-clean'
    case 'ARCHIVE':
      return 'act-archive'
    case 'ROLLBACK':
      return 'act-rollback'
    case 'REPLACE_COMMIT':
      return 'act-replace'
    case 'CLUSTERING':
      return 'act-clustering'
    default:
      return 'act-other'
  }
}

function onRowClick(instant: HudiInstant): void {
  emit('select', instant)
}
</script>

<template>
  <div class="tt-root flex flex-col gap-2 text-xs">
    <!-- ========================= 概览 ========================= -->
    <div v-if="rows.length" class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-hudi-muted)]">
      <span>Timeline instant 总数：<b class="text-[var(--color-hudi-text)]">{{ rows.length }}</b></span>
      <span v-for="(n, action) in summary" :key="action" class="inline-flex items-center gap-1">
        <span :class="actionClass(action)">●</span>
        <span>{{ ACTION_LABEL[action] ?? action }}</span>
        <b class="text-[var(--color-hudi-text)]">{{ n }}</b>
      </span>
    </div>

    <!-- ========================= 空态 ========================= -->
    <div
      v-if="!rows.length"
      class="rounded-md border border-dashed p-4 text-center text-[var(--color-hudi-muted)]"
      style="border-color: var(--color-hudi-border)"
    >
      <p class="font-medium">Timeline 为空。</p>
      <p class="mt-1 leading-relaxed">执行任意一次写入或服务操作后，这里会列出 Timeline 上的每个 instant。</p>
    </div>

    <!-- ========================= 表格 ========================= -->
    <div
      v-else
      class="overflow-x-auto rounded-md border"
      style="border-color: var(--color-hudi-border)"
    >
      <table class="w-full border-collapse text-[11px]">
        <thead>
          <tr class="text-left text-[var(--color-hudi-muted)]">
            <th class="border-b px-2 py-1.5 font-medium" style="border-color: var(--color-hudi-border)">
              Instant Time
            </th>
            <th class="border-b px-2 py-1.5 font-medium" style="border-color: var(--color-hudi-border)">Action</th>
            <th class="border-b px-2 py-1.5 font-medium" style="border-color: var(--color-hudi-border)">State</th>
            <th class="border-b px-2 py-1.5 font-medium" style="border-color: var(--color-hudi-border)">Operation</th>
            <th class="border-b px-2 py-1.5 text-right font-medium" style="border-color: var(--color-hudi-border)">
              涉及文件数
            </th>
            <th class="border-b px-2 py-1.5 font-medium" style="border-color: var(--color-hudi-border)">额外信息</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.instantTime + row.action"
            class="tt-row cursor-pointer"
            @click="onRowClick(row)"
          >
            <td class="border-b px-2 py-1.5 font-mono" style="border-color: var(--color-hudi-border)">
              <div>{{ row.instantTime }}</div>
              <div class="text-[10px] text-[var(--color-hudi-muted)]">{{ prettyInstant(String(row.instantTime ?? '')) }}</div>
            </td>
            <td class="border-b px-2 py-1.5" style="border-color: var(--color-hudi-border)">
              <span class="tt-action" :class="actionClass(row.action)">{{ ACTION_LABEL[row.action] ?? row.action }}</span>
            </td>
            <td class="border-b px-2 py-1.5" style="border-color: var(--color-hudi-border)">
              <span class="tt-state" :class="stateClass(row.state)">{{ row.state }}</span>
            </td>
            <td class="border-b px-2 py-1.5 font-mono" style="border-color: var(--color-hudi-border)">
              {{ row.operation ?? '—' }}
            </td>
            <td class="border-b px-2 py-1.5 text-right font-mono" style="border-color: var(--color-hudi-border)">
              {{ row.files?.length ?? 0 }}
            </td>
            <td class="border-b px-2 py-1.5" style="border-color: var(--color-hudi-border)">
              <div v-if="metaChips(row).length" class="flex flex-wrap gap-1">
                <span
                  v-for="chip in metaChips(row).slice(0, MAX_META_CHIPS)"
                  :key="chip.key"
                  class="tt-chip"
                >
                  <span class="text-[var(--color-hudi-muted)]">{{ chip.key }}</span>
                  <span class="font-mono">{{ chip.value }}</span>
                </span>
                <span
                  v-if="metaChips(row).length > MAX_META_CHIPS"
                  class="tt-chip tt-chip-more"
                  :title="metaChips(row).slice(MAX_META_CHIPS).map((c) => `${c.key}=${c.value}`).join('\n')"
                >
                  +{{ metaChips(row).length - MAX_META_CHIPS }}
                </span>
              </div>
              <span v-else class="text-[var(--color-hudi-muted)]">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.tt-root {
  --st-warn-fg: #fcd34d;
  --st-warn-bg: rgba(245, 158, 11, 0.14);
  --st-warn-bd: rgba(245, 158, 11, 0.45);
  --st-busy-fg: #fdba74;
  --st-ok-fg: #6ee7b7;
  --act-commit-fg: #6ee7b7;
  --act-deltacommit-fg: #7dd3fc;
  --act-compaction-fg: #c4b5fd;
  --act-clean-fg: #5eead4;
  --act-archive-fg: #a5b4fc;
  --act-rollback-fg: #fda4af;
  --act-replace-fg: #f9a8d4;
  --act-clustering-fg: #f0abfc;
  --act-other-fg: #cbd5e1;
}
:global(:root[data-theme='light']) .tt-root {
  --st-warn-fg: #b45309;
  --st-busy-fg: #c2410c;
  --st-ok-fg: #047857;
  --act-commit-fg: #047857;
  --act-deltacommit-fg: #0369a1;
  --act-compaction-fg: #6d28d9;
  --act-clean-fg: #0f766e;
  --act-archive-fg: #4338ca;
  --act-rollback-fg: #be123c;
  --act-replace-fg: #be185d;
  --act-clustering-fg: #a21caf;
  --act-other-fg: #475569;
}

.tt-row:hover {
  background: color-mix(in srgb, var(--color-hudi-accent) 10%, transparent);
}
.tt-action {
  font-weight: 600;
  white-space: nowrap;
}
.tt-state {
  border-radius: 3px;
  border: 1px solid transparent;
  padding: 0 5px;
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
}
.st-completed {
  color: var(--st-ok-fg);
  border-color: color-mix(in srgb, var(--st-ok-fg) 50%, transparent);
  background: color-mix(in srgb, var(--st-ok-fg) 12%, transparent);
}
.st-requested {
  color: var(--st-warn-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.st-inflight {
  color: var(--st-busy-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.tt-chip {
  border-radius: 3px;
  border: 1px solid var(--color-hudi-border);
  padding: 0 4px;
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
}
.tt-chip-more {
  color: var(--color-hudi-muted);
}
.act-commit {
  color: var(--act-commit-fg);
}
.act-deltacommit {
  color: var(--act-deltacommit-fg);
}
.act-compaction {
  color: var(--act-compaction-fg);
}
.act-clean {
  color: var(--act-clean-fg);
}
.act-archive {
  color: var(--act-archive-fg);
}
.act-rollback {
  color: var(--act-rollback-fg);
}
.act-replace {
  color: var(--act-replace-fg);
}
.act-clustering {
  color: var(--act-clustering-fg);
}
.act-other {
  color: var(--act-other-fg);
}
</style>
