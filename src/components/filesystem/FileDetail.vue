<script setup lang="ts">
/**
 * FileDetail —— 单个物理文件的详情 + File Slice 结构图
 * ---------------------------------------------------------------------------
 * 教学重点：
 *  - 一个 File Slice = Base File（可选）+ 若干 Log File，由 delta commit 引用。
 *  - COW 的旧文件在 Clean 之前仍留在 HDFS 上（status = SUPERSEDED）。
 *  - tombstone（operation = D）依然物理存在于文件里，只是不再出现在查询结果中。
 *
 * 契约边界：所有数据来自 props（引擎算好的结果），组件不做任何 Hudi 规则推断。
 */
import { computed } from 'vue'
import type { HudiFileGroup, HudiPhysicalFile, HudiRecord } from '@/models/hudi'
import { prettyInstant } from '@/engine/core/instant'

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

const props = defineProps<{
  file?: HudiPhysicalFile
  fileGroup?: HudiFileGroup
}>()

/* -------------------------------------------------------------------------- */
/* 工具                                                                        */
/* -------------------------------------------------------------------------- */

function formatSize(bytes: number | undefined | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function truncate(text: string, n: number): string {
  if (!text) return ''
  return text.length <= n ? text : `${text.slice(0, n - 1)}…`
}

const TYPE_LABEL: Record<string, string> = {
  BASE: 'Base File（parquet）',
  LOG: 'Log File（行式日志块）',
}

/* -------------------------------------------------------------------------- */
/* 基本信息                                                                    */
/* -------------------------------------------------------------------------- */

const file = computed<HudiPhysicalFile | null>(() => props.file ?? null)
const group = computed<HudiFileGroup | null>(() => props.fileGroup ?? null)

const slice = computed(() => group.value?.fileSlice ?? null)
const baseFile = computed(() => slice.value?.baseFile ?? null)
const logFiles = computed(() => slice.value?.logFiles ?? [])
const deltaCommits = computed<string[]>(() => slice.value?.deltaCommits ?? [])

const statusText = computed<string>(() => {
  if (!file.value) return '-'
  return file.value.status === 'SUPERSEDED' ? '已被取代，待 Clean' : 'ACTIVE（当前被 File Slice 引用）'
})

/* -------------------------------------------------------------------------- */
/* 该文件内含的记录                                                            */
/* -------------------------------------------------------------------------- */

const fileRecords = computed<HudiRecord[]>(() => {
  const f = file.value
  const g = group.value
  if (!f || !g) return []
  if (f.type === 'BASE') {
    const base = g.fileSlice.baseFile
    if (base && base.fileName === f.fileName) return base.records ?? []
    return []
  }
  const lf = g.fileSlice.logFiles.find((l) => l.fileName === f.fileName)
  return lf?.records ?? []
})

/** 文件与所给 File Group 是否匹配（防止父组件传错 group） */
const groupMismatch = computed<boolean>(() => {
  const f = file.value
  const g = group.value
  if (!f || !g) return false
  if (f.type === 'BASE') return g.fileSlice.baseFile?.fileName !== f.fileName
  return !g.fileSlice.logFiles.some((l) => l.fileName === f.fileName)
})

function recordSummary(r: HudiRecord): string {
  const entries = Object.entries(r.fields ?? {}).slice(0, 4)
  if (!entries.length) return '—'
  return entries.map(([k, v]) => `${k}=${v === null || v === undefined ? 'null' : String(v)}`).join('，')
}

/* -------------------------------------------------------------------------- */
/* File Slice 结构图（SVG）                                                     */
/* -------------------------------------------------------------------------- */

interface SliceBox {
  y: number
  h: number
  kind: 'base' | 'log' | 'none'
  title: string
  name: string
  meta: string
}

interface SliceChip {
  y: number
  text: string
}

const SVG_W = 380
const BOX_X = 10
const BOX_W = 226
const CHIP_X = 246
const CHIP_W = 124

const sliceBoxes = computed<SliceBox[]>(() => {
  const out: SliceBox[] = []
  let y = 6
  const base = baseFile.value
  if (base) {
    out.push({
      y,
      h: 56,
      kind: 'base',
      title: 'Base File',
      name: truncate(base.fileName, 26),
      meta: `base instant: ${base.instantTime}`,
    })
    y += 56 + 20
  } else {
    out.push({
      y,
      h: 40,
      kind: 'none',
      title: '（无 Base File）',
      name: 'log-only File Slice',
      meta: 'MOR 非 bulk_insert 首写 / 新主键落点',
    })
    y += 40 + 18
  }
  logFiles.value.forEach((l) => {
    out.push({
      y,
      h: 52,
      kind: 'log',
      title: `Log File v${l.version}`,
      name: truncate(l.fileName, 26),
      meta: `instant: ${l.instantTime}`,
    })
    y += 52 + 20
  })
  return out
})

const sliceChips = computed<SliceChip[]>(() => {
  return deltaCommits.value.map((t) => ({ y: 0, text: t }))
})

const svgHeight = computed<number>(() => {
  const boxes = sliceBoxes.value
  const last = boxes.length ? boxes[boxes.length - 1] : { y: 0, h: 0 }
  const chipsBottom = sliceChips.value.length ? 6 + sliceChips.value.length * 22 : 0
  return Math.max(last.y + last.h + 8, chipsBottom, 60)
})

/** delta commit 徽标在右侧的纵向位置 */
const chipPositions = computed<SliceChip[]>(() =>
  sliceChips.value.map((c, i) => ({ ...c, y: 8 + i * 22 })),
)

/* -------------------------------------------------------------------------- */
/* 状态徽标样式                                                                */
/* -------------------------------------------------------------------------- */

function opClass(op: string): string {
  if (op === 'I') return 'op-insert'
  if (op === 'U') return 'op-update'
  return 'op-delete'
}

function opLabel(op: string): string {
  if (op === 'I') return 'I · 新增'
  if (op === 'U') return 'U · 更新'
  return 'D · 删除（tombstone）'
}
</script>

<template>
  <div class="fd-root flex flex-col gap-3 text-xs">
    <!-- ========================= 空态 ========================= -->
    <div
      v-if="!file"
      class="rounded-md border border-dashed p-4 text-center text-[var(--color-hudi-muted)]"
      style="border-color: var(--color-hudi-border)"
    >
      <p class="font-medium">未选中任何文件。</p>
      <p class="mt-1 leading-relaxed">
        在左侧 / 上方的 HDFS 目录树里点击一个 base 或 log 文件，这里会展示它的属性、所属 File Slice
        结构，以及文件内含的记录。
      </p>
    </div>

    <template v-else>
      <!-- ========================= 文件头 ========================= -->
      <header class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="fv-badge" :class="file.type === 'BASE' ? 'fv-badge-base' : 'fv-badge-log'">
            {{ file.type }}
          </span>
          <h3 class="break-all font-mono text-sm font-semibold text-[var(--color-hudi-text)]">
            {{ file.fileName }}
          </h3>
          <span v-if="file.status === 'SUPERSEDED'" class="fv-badge fv-badge-superseded">
            已被取代，待 Clean
          </span>
        </div>
        <p class="text-[11px] leading-relaxed text-[var(--color-hudi-muted)]">
          {{ TYPE_LABEL[file.type] ?? file.type }} ｜ 创建于 instant
          <b class="font-mono">{{ file.createdInstant }}</b>
          （{{ prettyInstant(file.createdInstant) }}）
        </p>
      </header>

      <!-- ========================= 属性表 ========================= -->
      <section class="overflow-hidden rounded-md border" style="border-color: var(--color-hudi-border)">
        <table class="w-full border-collapse text-[11px]">
          <tbody>
            <tr>
              <th class="w-28 px-2 py-1 text-left font-medium text-[var(--color-hudi-muted)]">类型</th>
              <td class="px-2 py-1">{{ TYPE_LABEL[file.type] ?? file.type }}</td>
            </tr>
            <tr style="background: color-mix(in srgb, var(--color-hudi-bg) 45%, transparent)">
              <th class="px-2 py-1 text-left font-medium text-[var(--color-hudi-muted)]">所在分区</th>
              <td class="px-2 py-1 font-mono">{{ file.partitionPath || '（非分区表）' }}</td>
            </tr>
            <tr>
              <th class="px-2 py-1 text-left font-medium text-[var(--color-hudi-muted)]">大小</th>
              <td class="px-2 py-1">{{ formatSize(file.sizeBytes) }}</td>
            </tr>
            <tr style="background: color-mix(in srgb, var(--color-hudi-bg) 45%, transparent)">
              <th class="px-2 py-1 text-left font-medium text-[var(--color-hudi-muted)]">记录数</th>
              <td class="px-2 py-1">{{ file.recordCount }} 条</td>
            </tr>
            <tr>
              <th class="px-2 py-1 text-left font-medium text-[var(--color-hudi-muted)]">创建 instant</th>
              <td class="px-2 py-1 font-mono">
                {{ file.createdInstant }} <span class="text-[var(--color-hudi-muted)]">（{{ prettyInstant(file.createdInstant) }}）</span>
              </td>
            </tr>
            <tr style="background: color-mix(in srgb, var(--color-hudi-bg) 45%, transparent)">
              <th class="px-2 py-1 text-left font-medium text-[var(--color-hudi-muted)]">状态</th>
              <td class="px-2 py-1">
                <span :style="{ color: file.status === 'SUPERSEDED' ? 'var(--st-warn-fg)' : 'var(--st-ok-fg)' }">
                  {{ statusText }}
                </span>
                <div v-if="file.status === 'SUPERSEDED'" class="mt-0.5 text-[10px] text-[var(--color-hudi-muted)]">
                  被取代于 <span class="font-mono">{{ file.supersededAt ?? '-' }}</span>
                  <template v-if="file.supersededBy">
                    ，取代者 <span class="font-mono">{{ file.supersededBy }}</span>
                  </template>
                  <template v-if="file.supersededBy && !file.supersededBy.includes('.')">
                    （旧文件在 Clean 执行前仍物理存在于 HDFS 上）
                  </template>
                </div>
              </td>
            </tr>
            <tr v-if="group">
              <th class="px-2 py-1 text-left font-medium text-[var(--color-hudi-muted)]">所属 File Group</th>
              <td class="px-2 py-1 font-mono">{{ group.fileId }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- ========================= File Slice 结构图 ========================= -->
      <section v-if="group && slice" class="rounded-md border p-2" style="border-color: var(--color-hudi-border)">
        <div class="mb-1 flex flex-wrap items-center gap-2">
          <h4 class="text-xs font-semibold">File Slice 结构图</h4>
          <span class="fv-badge fv-badge-version">File Group: {{ group.fileId }}</span>
          <span v-if="slice.compactionRequested" class="fv-badge fv-badge-pending">已请求 Compaction</span>
          <span v-if="group.supersededBy" class="fv-badge fv-badge-superseded">该 File Group 已被取代</span>
        </div>

        <div class="overflow-x-auto">
          <svg
            :viewBox="`0 0 ${SVG_W} ${svgHeight}`"
            :width="SVG_W"
            :height="svgHeight"
            class="fd-slice"
            role="img"
            aria-label="File Slice 结构图"
          >
            <defs>
              <marker id="fd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" fill="var(--color-hudi-muted)" />
              </marker>
            </defs>

            <!-- 连接线 -->
            <g>
              <template v-for="(b, i) in sliceBoxes" :key="`link-${i}`">
                <line
                  v-if="i > 0"
                  :x1="BOX_X + BOX_W / 2"
                  :y1="(sliceBoxes[i - 1]?.y ?? 0) + (sliceBoxes[i - 1]?.h ?? 0)"
                  :x2="BOX_X + BOX_W / 2"
                  :y2="b.y - 2"
                  stroke="var(--color-hudi-muted)"
                  stroke-width="1.1"
                  marker-end="url(#fd-arrow)"
                />
              </template>
            </g>

            <!-- Base / Log 框 -->
            <g v-for="(b, i) in sliceBoxes" :key="`box-${i}`">
              <rect
                :x="BOX_X"
                :y="b.y"
                :width="BOX_W"
                :height="b.h"
                rx="4"
                :fill="
                  b.kind === 'base'
                    ? 'color-mix(in srgb, var(--color-hudi-accent) 16%, transparent)'
                    : b.kind === 'log'
                      ? 'color-mix(in srgb, var(--st-busy-fg) 16%, transparent)'
                      : 'transparent'
                "
                :stroke="
                  b.kind === 'base'
                    ? 'var(--color-hudi-accent)'
                    : b.kind === 'log'
                      ? 'var(--st-busy-fg)'
                      : 'var(--color-hudi-border)'
                "
                :stroke-dasharray="b.kind === 'none' ? '4 3' : undefined"
                stroke-width="1.2"
              />
              <text
                :x="BOX_X + 10"
                :y="b.y + 16"
                font-size="11"
                font-weight="600"
                :fill="b.kind === 'base' ? 'var(--color-hudi-accent)' : b.kind === 'log' ? 'var(--st-busy-fg)' : 'var(--color-hudi-muted)'"
              >
                {{ b.title }}
              </text>
              <text :x="BOX_X + 10" :y="b.y + 31" font-size="10" fill="var(--color-hudi-text)" font-family="monospace">
                {{ b.name }}
              </text>
              <text :x="BOX_X + 10" :y="b.y + 45" font-size="9.5" fill="var(--color-hudi-muted)">
                {{ b.meta }}
              </text>
            </g>

            <!-- 引用该 slice 的 delta commit -->
            <g v-if="chipPositions.length">
              <text :x="CHIP_X" :y="2" font-size="9.5" fill="var(--color-hudi-muted)">
                引用它的 delta commit
              </text>
              <g v-for="(c, i) in chipPositions" :key="`chip-${i}`">
                <rect
                  :x="CHIP_X"
                  :y="c.y"
                  :width="CHIP_W"
                  height="18"
                  rx="3"
                  fill="color-mix(in srgb, var(--act-deltacommit-fg) 14%, transparent)"
                  stroke="var(--act-deltacommit-fg)"
                  stroke-width="1"
                  stroke-dasharray="3 2"
                />
                <text :x="CHIP_X + 6" :y="c.y + 13" font-size="9.5" fill="var(--act-deltacommit-fg)" font-family="monospace">
                  {{ c.text }}
                </text>
                <line
                  :x1="BOX_X + BOX_W"
                  :y1="c.y + 9"
                  :x2="CHIP_X - 3"
                  :y2="c.y + 9"
                  stroke="var(--act-deltacommit-fg)"
                  stroke-width="1"
                  stroke-dasharray="3 2"
                  opacity="0.8"
                />
              </g>
            </g>
          </svg>
        </div>

        <p class="mt-1 text-[10px] leading-relaxed text-[var(--color-hudi-muted)]">
          读路径上，Base File 先读，随后按版本号依次回放 Log File；写路径上，新的 delta commit
          追加 Log File 而不改动 Base File（MOR）。COW 则相反：直接重写整个 File Group。
        </p>
      </section>

      <section v-else-if="groupMismatch" class="rounded-md border p-2 text-[11px]" style="border-color: var(--color-hudi-border)">
        该文件不在所给 File Group 中，无法展示 File Slice 结构。
      </section>

      <!-- ========================= 文件内含的记录 ========================= -->
      <section class="rounded-md border p-2" style="border-color: var(--color-hudi-border)">
        <h4 class="mb-1 text-xs font-semibold">
          文件内含的记录
          <span class="ml-1 font-normal text-[var(--color-hudi-muted)]">
            （共 {{ fileRecords.length }} 条）
          </span>
        </h4>

        <div v-if="!fileRecords.length" class="py-3 text-center text-[11px] text-[var(--color-hudi-muted)]">
          该文件内没有可展示的记录明细。
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full border-collapse text-[11px]">
            <thead>
              <tr class="text-left text-[var(--color-hudi-muted)]">
                <th class="border-b px-2 py-1 font-medium" style="border-color: var(--color-hudi-border)">Record Key</th>
                <th class="border-b px-2 py-1 font-medium" style="border-color: var(--color-hudi-border)">_hoodie_operation</th>
                <th class="border-b px-2 py-1 font-medium" style="border-color: var(--color-hudi-border)">commit time</th>
                <th class="border-b px-2 py-1 font-medium" style="border-color: var(--color-hudi-border)">字段摘要</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, idx) in fileRecords"
                :key="`${r.hoodieKey}-${idx}`"
                :class="{ 'fd-tombstone': r.operation === 'D' }"
              >
                <td class="border-b px-2 py-1 font-mono" style="border-color: var(--color-hudi-border)">
                  {{ r.recordKey }}
                </td>
                <td class="border-b px-2 py-1" style="border-color: var(--color-hudi-border)">
                  <span class="fd-badge" :class="opClass(r.operation)">{{ opLabel(r.operation) }}</span>
                </td>
                <td class="border-b px-2 py-1 font-mono" style="border-color: var(--color-hudi-border)">
                  {{ r.commitTime }}
                </td>
                <td class="border-b px-2 py-1" style="border-color: var(--color-hudi-border)">
                  {{ recordSummary(r) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="mt-1 text-[10px] leading-relaxed text-[var(--color-hudi-muted)]">
          _hoodie_operation = D 的记录是 tombstone：它仍然物理存在于数据文件里，
          只是查询时被过滤掉 —— 这也是「读优化（Read Optimized）」与「快照读（Snapshot）」结果不同的原因。
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.fd-root {
  --st-ok-fg: #6ee7b7;
  --st-warn-fg: #fcd34d;
  --st-warn-bg: rgba(245, 158, 11, 0.14);
  --st-warn-bd: rgba(245, 158, 11, 0.45);
  --st-busy-fg: #fdba74;
  --st-del-fg: #fca5a5;
  --st-del-bg: rgba(239, 68, 68, 0.16);
  --st-del-bd: rgba(239, 68, 68, 0.45);
  --st-upd-fg: #93c5fd;
  --st-upd-bg: rgba(59, 130, 246, 0.16);
  --st-upd-bd: rgba(59, 130, 246, 0.45);
  --act-deltacommit-fg: #7dd3fc;
}
:global(:root[data-theme='light']) .fd-root {
  --st-ok-fg: #047857;
  --st-warn-fg: #b45309;
  --st-busy-fg: #c2410c;
  --st-del-fg: #b91c1c;
  --st-upd-fg: #1d4ed8;
  --act-deltacommit-fg: #0369a1;
}

.fv-badge {
  border-radius: 3px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
  border: 1px solid transparent;
}
.fv-badge-base {
  color: var(--color-hudi-accent);
  border-color: color-mix(in srgb, var(--color-hudi-accent) 55%, transparent);
  background: color-mix(in srgb, var(--color-hudi-accent) 12%, transparent);
}
.fv-badge-log {
  color: var(--st-busy-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.fv-badge-version {
  color: var(--color-hudi-muted);
  border-color: var(--color-hudi-border);
}
.fv-badge-superseded {
  color: var(--st-warn-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.fv-badge-pending {
  color: var(--st-warn-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.fd-badge {
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
}
.fd-tombstone {
  opacity: 0.45;
}
.fd-tombstone td {
  text-decoration: line-through;
}
</style>
