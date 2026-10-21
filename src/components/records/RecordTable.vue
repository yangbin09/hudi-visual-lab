<script setup lang="ts">
/**
 * RecordTable —— 逻辑记录视图（业务字段 + _hoodie_* 元字段）
 * ---------------------------------------------------------------------------
 * 教学重点：
 *  1. _hoodie_operation 决定记录在查询中的可见性：D（tombstone）仍在表里，但查询不可见。
 *  2. precombine 字段决定同一主键多个版本中「哪一条生效」。
 *  3. 元字段是 Hudi 注入的隐藏列，排查数据问题时经常需要它们。
 *
 * 契约边界：组件只渲染 props 里的记录，不做任何 Hudi 规则推断。
 */
import { computed } from 'vue'
import type { HudiRecord } from '@/models/hudi'

/* -------------------------------------------------------------------------- */
/* Props / Emits                                                               */
/* -------------------------------------------------------------------------- */

const props = withDefaults(
  defineProps<{
    records: HudiRecord[]
    primaryKey: string | null
    preCombineField: string | null
    showMetaFields?: boolean
  }>(),
  {
    showMetaFields: false,
  },
)

const emit = defineEmits<{
  (e: 'select-record', record: HudiRecord): void
}>()

/* -------------------------------------------------------------------------- */
/* 列定义                                                                      */
/* -------------------------------------------------------------------------- */

const list = computed<HudiRecord[]>(() => (props.records ?? []).filter(Boolean))

/** 业务字段列：以第一条记录的 fields 顺序为准，后面记录出现的新字段追加在末尾 */
const businessColumns = computed<string[]>(() => {
  const cols: string[] = []
  const seen = new Set<string>()
  list.value.forEach((r) => {
    Object.keys(r.fields ?? {}).forEach((k) => {
      if (!seen.has(k)) {
        seen.add(k)
        cols.push(k)
      }
    })
  })
  return cols
})

const META_COLUMNS = [
  '_hoodie_commit_time',
  '_hoodie_commit_seqno',
  '_hoodie_record_key',
  '_hoodie_partition_path',
  '_hoodie_operation',
] as const

const metaColumns = computed<string[]>(() => (props.showMetaFields ? [...META_COLUMNS] : []))

/* -------------------------------------------------------------------------- */
/* precombine：判定「当前生效版本」                                               */
/* -------------------------------------------------------------------------- */

function recordKeyOf(r: HudiRecord): string {
  return `${r.partitionPath ?? ''}::${r.recordKey ?? ''}`
}

function recordIdentity(r: HudiRecord): string {
  return `${recordKeyOf(r)}::${r.commitTime ?? ''}::${r.commitSeqNo ?? ''}`
}

/** 同一 (分区, 主键) 下 precombine 值最大的那条 = 当前生效版本 */
const effectiveIds = computed<Set<string>>(() => {
  const groups = new Map<string, HudiRecord[]>()
  list.value.forEach((r) => {
    const k = recordKeyOf(r)
    const arr = groups.get(k)
    if (arr) arr.push(r)
    else groups.set(k, [r])
  })
  const out = new Set<string>()
  groups.forEach((items) => {
    let best = items[0]
    items.forEach((r) => {
      const bv = r.preCombineValue
      const cv = best.preCombineValue
      if (bv === null || bv === undefined) {
        if (cv !== null && cv !== undefined) best = r
      } else if (cv === null || cv === undefined || bv >= cv) {
        best = r
      }
    })
    out.add(recordIdentity(best))
  })
  return out
})

function hasMultipleVersions(): boolean {
  const keys = new Set(list.value.map(recordKeyOf))
  return list.value.length > keys.size
}

/* -------------------------------------------------------------------------- */
/* 取值                                                                        */
/* -------------------------------------------------------------------------- */

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return '-'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function cellValue(r: HudiRecord, column: string | null | undefined): string {
  if (!column) return '-'
  switch (column) {
    case '_hoodie_commit_time':
      return r.commitTime ?? '-'
    case '_hoodie_commit_seqno':
      return r.commitSeqNo === undefined || r.commitSeqNo === null ? '-' : String(r.commitSeqNo)
    case '_hoodie_record_key':
      return r.recordKey ?? '-'
    case '_hoodie_partition_path':
      return r.partitionPath || '（非分区表）'
    case '_hoodie_operation':
      return r.operation ?? '-'
    default:
      return formatValue((r.fields ?? {})[column])
  }
}

/** 主键列：优先展示业务字段里的主键值，取不到时退回 recordKey */
function pkValue(r: HudiRecord): string {
  const pk = props.primaryKey
  if (pk) {
    const v = (r.fields ?? {})[pk]
    if (v !== undefined && v !== null && v !== '') return formatValue(v)
  }
  return r.recordKey ?? '-'
}

/* -------------------------------------------------------------------------- */
/* 统计                                                                        */
/* -------------------------------------------------------------------------- */

const stats = computed(() => {
  const total = list.value.length
  const tombstones = list.value.filter((r) => r.operation === 'D').length
  return {
    total,
    visible: total - tombstones,
    tombstones,
  }
})

/* -------------------------------------------------------------------------- */
/* 样式                                                                        */
/* -------------------------------------------------------------------------- */

function opClass(op: string): string {
  if (op === 'I') return 'op-insert'
  if (op === 'U') return 'op-update'
  return 'op-delete'
}

function opLabel(op: string): string {
  if (op === 'I') return 'I · 新增'
  if (op === 'U') return 'U · 更新'
  return 'D · 删除'
}

function onRowClick(r: HudiRecord): void {
  emit('select-record', r)
}
</script>

<template>
  <div class="rt-root flex flex-col gap-2 text-xs">
    <!-- ========================= 空态 ========================= -->
    <div
      v-if="!list.length"
      class="rounded-md border border-dashed p-4 text-center text-[var(--color-hudi-muted)]"
      style="border-color: var(--color-hudi-border)"
    >
      <p class="font-medium">当前没有记录。</p>
      <p class="mt-1 leading-relaxed">
        执行一次写入（UPSERT / INSERT / BULK_INSERT）后，引擎会把新记录放入表状态，
        这里会同时展示业务字段与 _hoodie_* 元字段。
      </p>
    </div>

    <template v-else>
      <!-- ========================= 表格 ========================= -->
      <div
        class="overflow-x-auto rounded-md border"
        style="border-color: var(--color-hudi-border)"
      >
        <table class="w-full border-collapse text-[11px]">
          <thead>
            <tr class="text-left text-[var(--color-hudi-muted)]">
              <th class="border-b px-2 py-1.5 font-medium" style="border-color: var(--color-hudi-border)">
                Record Key
                <span class="rt-tag">PK</span>
              </th>
              <th
                v-for="col in businessColumns"
                :key="col"
                class="border-b px-2 py-1.5 font-medium"
                style="border-color: var(--color-hudi-border)"
              >
                {{ col }}
                <span v-if="primaryKey && col === primaryKey" class="rt-tag">PK</span>
              </th>
              <th
                v-if="preCombineField"
                class="border-b px-2 py-1.5 font-medium"
                style="border-color: var(--color-hudi-border)"
              >
                {{ preCombineField }}
                <span class="rt-tag">precombine</span>
              </th>
              <th
                v-for="col in metaColumns"
                :key="col"
                class="border-b px-2 py-1.5 font-medium"
                style="border-color: var(--color-hudi-border)"
              >
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, idx) in list"
              :key="`${r.hoodieKey}-${r.commitTime}-${idx}`"
              class="rt-row cursor-pointer"
              :class="{ 'rt-tombstone': r.operation === 'D' }"
              @click="onRowClick(r)"
            >
              <!-- 主键列 -->
              <td class="border-b px-2 py-1.5 font-mono" style="border-color: var(--color-hudi-border)">
                {{ pkValue(r) }}
              </td>

              <!-- 业务字段 -->
              <td
                v-for="col in businessColumns"
                :key="col"
                class="border-b px-2 py-1.5"
                style="border-color: var(--color-hudi-border)"
              >
                {{ cellValue(r, col) }}
              </td>

              <!-- precombine 列 -->
              <td v-if="preCombineField" class="border-b px-2 py-1.5" style="border-color: var(--color-hudi-border)">
                <div class="font-mono">{{ cellValue(r, preCombineField) }}</div>
                <div v-if="effectiveIds.has(recordIdentity(r))" class="rt-effective">当前生效版本</div>
                <div v-else-if="hasMultipleVersions()" class="rt-stale">历史版本（已被覆盖）</div>
              </td>

              <!-- 元字段 -->
              <template v-for="col in metaColumns" :key="col">
                <td class="border-b px-2 py-1.5 font-mono" style="border-color: var(--color-hudi-border)">
                  <span v-if="col === '_hoodie_operation'" class="rt-op" :class="opClass(cellValue(r, col))">
                    {{ opLabel(cellValue(r, col)) }}
                  </span>
                  <span v-else>{{ cellValue(r, col) }}</span>
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ========================= 底部统计 ========================= -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-hudi-muted)]">
        <span>总记录数：<b class="text-[var(--color-hudi-text)]">{{ stats.total }}</b></span>
        <span>可见记录数：<b class="text-[var(--color-hudi-text)]">{{ stats.visible }}</b></span>
        <span>
          tombstone 数（D）：
          <b :style="{ color: stats.tombstones ? 'var(--st-del-fg)' : undefined }">{{ stats.tombstones }}</b>
        </span>
        <span v-if="stats.tombstones" class="rt-hint">
          tombstone 仍然物理存在于数据文件中，只是查询时被过滤 —— 快照读与读优化的结果因此不同。
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.rt-root {
  --st-ok-fg: #6ee7b7;
  --st-warn-fg: #fcd34d;
  --st-del-fg: #fca5a5;
  --st-del-bg: rgba(239, 68, 68, 0.16);
  --st-del-bd: rgba(239, 68, 68, 0.45);
  --st-upd-fg: #93c5fd;
  --st-upd-bg: rgba(59, 130, 246, 0.16);
  --st-upd-bd: rgba(59, 130, 246, 0.45);
}
:global(:root[data-theme='light']) .rt-root {
  --st-ok-fg: #047857;
  --st-warn-fg: #b45309;
  --st-del-fg: #b91c1c;
  --st-upd-fg: #1d4ed8;
}

.rt-row:hover {
  background: color-mix(in srgb, var(--color-hudi-accent) 10%, transparent);
}
.rt-tombstone {
  opacity: 0.45;
}
.rt-tombstone td {
  text-decoration: line-through;
}
.rt-tombstone td .rt-op,
.rt-tombstone td .rt-effective,
.rt-tombstone td .rt-stale {
  text-decoration: none;
}
.rt-tag {
  border-radius: 3px;
  border: 1px solid var(--color-hudi-border);
  padding: 0 3px;
  font-size: 9px;
  line-height: 13px;
  color: var(--color-hudi-muted);
}
.rt-op {
  border-radius: 3px;
  padding: 0 5px;
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
  border: 1px solid transparent;
}
.op-insert {
  color: var(--st-ok-fg);
  border-color: color-mix(in srgb, var(--st-ok-fg) 50%, transparent);
  background: color-mix(in srgb, var(--st-ok-fg) 12%, transparent);
}
.op-update {
  color: var(--st-upd-fg);
  border-color: var(--st-upd-bd);
  background: var(--st-upd-bg);
}
.op-delete {
  color: var(--st-del-fg);
  border-color: var(--st-del-bd);
  background: var(--st-del-bg);
  text-decoration: none;
}
.rt-effective {
  color: var(--st-ok-fg);
  font-size: 9px;
  white-space: nowrap;
}
.rt-stale {
  color: var(--color-hudi-muted);
  font-size: 9px;
  white-space: nowrap;
}
.rt-hint {
  color: var(--st-warn-fg);
}
</style>
