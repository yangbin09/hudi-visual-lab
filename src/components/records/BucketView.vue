<script setup lang="ts">
/**
 * BucketView —— BUCKET 索引视图（主键 → 桶 → File Group → 记录）
 * ---------------------------------------------------------------------------
 * 教学重点：
 *  1. BUCKET 索引把主键哈希映射到固定数量的桶，一个桶对应一个 File Group；
 *     同一个主键永远落在同一个 File Group 里 —— 这是它相对全局索引的最大优势。
 *  2. bucketCount 一旦改变，主键到桶的映射全部失效，Hudi 需要重写全表。
 *  3. 分桶哈希算法在 r26 尚未确认，界面上必须显著标注（BUCKET_ALGORITHM_NOTE）。
 */
import { computed } from 'vue'
import type { HudiFileGroup, HudiRecord, HudiTable } from '@/models/hudi'
import { BUCKET_ALGORITHM_NOTE, bucketOf, indexDescription } from '@/engine/indexes/bucket'
import { configName } from '@/engine/versions/HuaweiMRS350R26Profile'

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

const props = defineProps<{
  table: HudiTable
  fileGroups: HudiFileGroup[]
  records: HudiRecord[]
}>()

/* -------------------------------------------------------------------------- */
/* 基础数据                                                                    */
/* -------------------------------------------------------------------------- */

const isBucket = computed<boolean>(() => props.table?.indexType === 'BUCKET')
const tableInfo = computed(() => indexDescription(props.table?.indexType ?? 'SIMPLE'))

const bucketCount = computed<number>(() => {
  const n = props.table?.bucketCount
  if (typeof n === 'number' && n > 0) return n
  const observed = new Set((props.fileGroups ?? []).map((g) => g.bucket).filter((b): b is number => typeof b === 'number'))
  return observed.size ? Math.max(...observed) + 1 : 8
})

function bucketConfigName(): string {
  try {
    return configName('bucket.index.num.buckets')
  } catch {
    return 'hoodie.bucket.index.num.buckets'
  }
}

/* -------------------------------------------------------------------------- */
/* 桶 / File Group / 记录 的映射                                                 */
/* -------------------------------------------------------------------------- */

interface GroupSlot {
  group: HudiFileGroup | null
  records: HudiRecord[]
  label: string
  partition: string
  fileCount: number
  superseded: boolean
}

interface BucketLane {
  bucket: number
  slots: GroupSlot[]
  records: HudiRecord[]
  recordCount: number
  fileCount: number
  skew: boolean
  empty: boolean
}

const lanes = computed<BucketLane[]>(() => {
  const count = bucketCount.value
  const buckets: BucketLane[] = []
  for (let b = 0; b < count; b++) {
    buckets.push({
      bucket: b,
      slots: [],
      records: [],
      recordCount: 0,
      fileCount: 0,
      skew: false,
      empty: true,
    })
  }

  /* 1. 物理文件 → 桶（File Group 上已经记了 bucket 字段） */
  const orphanGroups: HudiFileGroup[] = []
  ;(props.fileGroups ?? []).forEach((g) => {
    const b = g?.bucket
    if (typeof b !== 'number' || b < 0 || b >= count) {
      orphanGroups.push(g)
      return
    }
    buckets[b].slots.push({
      group: g,
      records: [],
      label: g.fileId,
      partition: g.partitionPath || '（非分区表）',
      fileCount: (g.fileSlice?.baseFile ? 1 : 0) + (g.fileSlice?.logFiles?.length ?? 0),
      superseded: Boolean(g.supersededBy),
    })
    buckets[b].fileCount += (g.fileSlice?.baseFile ? 1 : 0) + (g.fileSlice?.logFiles?.length ?? 0)
  })

  /* 2. 记录 → 桶（用引擎的示意哈希，保证与写入口径一致） */
  ;(props.records ?? []).forEach((r) => {
    if (!r) return
    let b = 0
    try {
      b = bucketOf(String(r.recordKey ?? ''), count)
    } catch {
      b = 0
    }
    if (b < 0 || b >= count) b = 0
    buckets[b].records.push(r)
  })

  /* 3. 桶内记录 → File Group（按分区归组：同一分区同桶的记录落在同一 File Group） */
  buckets.forEach((lane) => {
    lane.recordCount = lane.records.length
    const activeSlots = lane.slots.filter((s) => s.group && !s.superseded)
    lane.records.forEach((r) => {
      const matched =
        activeSlots.find((s) => s.partition === (r.partitionPath || '（非分区表）')) ??
        lane.slots.find((s) => s.partition === (r.partitionPath || '（非分区表）'))
      if (matched) matched.records.push(r)
      else {
        const fallback = lane.slots.find((s) => s.group === null)
        if (fallback) fallback.records.push(r)
        else {
          lane.slots.push({
            group: null,
            records: [r],
            label: '（未归入 File Group）',
            partition: r.partitionPath || '（非分区表）',
            fileCount: 0,
            superseded: false,
          })
        }
      }
    })
    lane.empty = lane.recordCount === 0 && lane.slots.length === 0
  })

  /* 4. 未分桶的 File Group 单独归到最后一个通道 */
  if (orphanGroups.length) {
    const lane = buckets[buckets.length - 1]
    orphanGroups.forEach((g) => {
      lane.slots.push({
        group: g,
        records: [],
        label: g.fileId,
        partition: g.partitionPath || '（非分区表）',
        fileCount: (g.fileSlice?.baseFile ? 1 : 0) + (g.fileSlice?.logFiles?.length ?? 0),
        superseded: Boolean(g.supersededBy),
      })
      lane.fileCount += (g.fileSlice?.baseFile ? 1 : 0) + (g.fileSlice?.logFiles?.length ?? 0)
    })
  }

  /* 5. 倾斜判定：记录数显著高于平均值 */
  const total = buckets.reduce((n, l) => n + l.recordCount, 0)
  const avg = buckets.length ? total / buckets.length : 0
  buckets.forEach((l) => {
    l.skew = avg > 0 && l.recordCount > avg * 1.5
  })

  return buckets
})

/* -------------------------------------------------------------------------- */
/* 三层映射图（SVG）                                                            */
/* -------------------------------------------------------------------------- */

const PAD = 16
const L1_Y = 14
const L1_H = 46
const L2_Y = 100
const L2_H = 50
const L3_Y = L2_Y + L2_H + 14
const BOX_W = 168
const GAP = 16
const MAX_RECORD_ROWS = 4

interface BoxGeom {
  x: number
  w: number
  records: HudiRecord[]
  label: string
  partition: string
  fileCount: number
  superseded: boolean
  isPlaceholder: boolean
  recordCount: number
  rowCount: number
}

interface BucketGeom {
  bucket: number
  x: number
  recordCount: number
  fileCount: number
  skew: boolean
  empty: boolean
  boxIndexes: number[]
}

/** 第二层（File Group）盒子的横向排布 */
const groupBoxes = computed<BoxGeom[]>(() => {
  const out: BoxGeom[] = []
  const push = (geom: Omit<BoxGeom, 'x'>): void => {
    out.push({ ...geom, x: PAD + out.length * (BOX_W + GAP) })
  }
  lanes.value.forEach((lane) => {
    if (!lane.slots.length) {
      push({
        w: BOX_W,
        records: [],
        label: '（空桶：暂无 File Group）',
        partition: '—',
        fileCount: 0,
        superseded: false,
        isPlaceholder: true,
        recordCount: 0,
        rowCount: 0,
      })
      return
    }
    lane.slots.forEach((slot) => {
      push({
        w: BOX_W,
        records: slot.records,
        label: slot.label,
        partition: slot.partition,
        fileCount: slot.fileCount,
        superseded: slot.superseded,
        isPlaceholder: false,
        recordCount: slot.records.length,
        rowCount: Math.min(slot.records.length, MAX_RECORD_ROWS),
      })
    })
  })
  return out
})

/** 每个桶对应的第二层盒子区间（用于计算第一层桶节点的位置与连线） */
const bucketGeoms = computed<BucketGeom[]>(() => {
  let cursor = 0
  return lanes.value.map((lane) => {
    const count = Math.max(lane.slots.length, 1)
    const indexes: number[] = []
    for (let i = 0; i < count; i++) indexes.push(cursor + i)
    const first = groupBoxes.value[cursor]
    const last = groupBoxes.value[cursor + count - 1]
    const x = first && last ? (first.x + last.x + last.w) / 2 : PAD + BOX_W / 2
    cursor += count
    return {
      bucket: lane.bucket,
      x,
      recordCount: lane.recordCount,
      fileCount: lane.fileCount,
      skew: lane.skew,
      empty: lane.empty,
      boxIndexes: indexes,
    }
  })
})

const svgWidth = computed<number>(() => {
  const n = groupBoxes.value.length
  return Math.max(360, PAD * 2 + Math.max(n, 1) * (BOX_W + GAP) - GAP)
})

const svgHeight = computed<number>(() => {
  let maxRows = 0
  groupBoxes.value.forEach((b) => {
    maxRows = Math.max(maxRows, b.rowCount)
  })
  const l3H = 22 + Math.max(maxRows, 1) * 15
  return L3_Y + l3H + 16
})

function opClass(op: string): string {
  if (op === 'I') return 'op-insert'
  if (op === 'U') return 'op-update'
  return 'op-delete'
}

/* -------------------------------------------------------------------------- */
/* 负载分布                                                                    */
/* -------------------------------------------------------------------------- */

const maxRecords = computed<number>(() => Math.max(1, ...lanes.value.map((l) => l.recordCount)))

const distribution = computed(() =>
  lanes.value.map((l) => ({
    bucket: l.bucket,
    recordCount: l.recordCount,
    fileCount: l.fileCount,
    skew: l.skew,
    empty: l.empty,
    pct: Math.round((l.recordCount / maxRecords.value) * 100),
  })),
)

const avgRecords = computed<number>(() => {
  const total = lanes.value.reduce((n, l) => n + l.recordCount, 0)
  return lanes.value.length ? total / lanes.value.length : 0
})
</script>

<template>
  <div class="bv-root flex flex-col gap-3 text-xs">
    <!-- ========================= 顶部：算法说明（必须显示） ========================= -->
    <div
      class="rounded-md border px-3 py-2 text-[11px] leading-relaxed"
      style="border-color: var(--st-warn-bd); background: var(--st-warn-bg); color: var(--st-warn-fg)"
    >
      <span class="font-semibold">分桶算法说明：</span>
      <span>{{ BUCKET_ALGORITHM_NOTE }}</span>
    </div>

    <!-- ========================= 非 BUCKET 索引 ========================= -->
    <div
      v-if="!isBucket"
      class="rounded-md border p-3 leading-relaxed"
      style="border-color: var(--color-hudi-border)"
    >
      <p class="font-semibold text-[var(--color-hudi-text)]">当前表未使用 BUCKET 索引</p>
      <p class="mt-1 text-[var(--color-hudi-muted)]">
        本表使用的是 <b class="font-mono">{{ table?.indexType ?? '-' }}</b> 索引（{{ tableInfo.title }}）：
        {{ tableInfo.brief }}
      </p>
      <p class="mt-1 text-[var(--color-hudi-muted)]">
        BUCKET 索引要求在建表时通过 <span class="font-mono">{{ bucketConfigName() }}</span> 固定桶数，
        并在写入时按主键哈希把记录落到固定的 File Group 中；它<b>无法在表创建之后切换</b>，
        换索引类型等价于重建一张表。
      </p>
    </div>

    <template v-else>
      <!-- ========================= 参数条 ========================= -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-hudi-muted)]">
        <span>
          桶数（<span class="font-mono">{{ bucketConfigName() }}</span>）：
          <b class="text-[var(--color-hudi-text)]">{{ bucketCount }}</b>
        </span>
        <span>
          File Group 总数：<b class="text-[var(--color-hudi-text)]">{{ (fileGroups ?? []).length }}</b>
        </span>
        <span>
          记录总数：<b class="text-[var(--color-hudi-text)]">{{ (records ?? []).length }}</b>
        </span>
        <span>
          平均负载：<b class="text-[var(--color-hudi-text)]">{{ avgRecords.toFixed(1) }}</b> 条 / 桶
        </span>
      </div>

      <!-- ========================= 改桶数的警告 ========================= -->
      <div
        class="rounded-md border px-3 py-2 text-[11px] leading-relaxed"
        style="border-color: var(--st-del-bd); background: var(--st-del-bg); color: var(--st-del-fg)"
      >
        <span class="font-semibold">注意：</span>
        桶数是 BUCKET 索引的「固化」配置。修改桶数会让「主键 → 桶」的哈希映射整体改变，
        原有 File Group 无法继续承载对应主键，Hudi 必须<b>全量重写</b>整张表
        （所有记录重新分桶并落盘），同时旧文件在 Clean 之前仍留在 HDFS 上。
        生产环境上通常的做法是新建一张表并迁移数据，而不是改桶数。
      </div>

      <!-- ========================= 三层映射图 ========================= -->
      <section class="rounded-md border p-2" style="border-color: var(--color-hudi-border)">
        <h4 class="mb-1 text-xs font-semibold">主键 → 桶 → File Group → 记录</h4>
        <div class="overflow-x-auto">
          <svg
            :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
            :width="svgWidth"
            :height="svgHeight"
            role="img"
            aria-label="Bucket 索引映射图"
          >
            <!-- 连线：桶 → File Group -->
            <g>
              <template v-for="bg in bucketGeoms" :key="`link-b-${bg.bucket}`">
                <path
                  v-for="bi in bg.boxIndexes"
                  :key="`link-${bg.bucket}-${bi}`"
                  :d="`M ${bg.x} ${L1_Y + L1_H} V ${L2_Y - 14} H ${groupBoxes[bi] ? groupBoxes[bi].x + groupBoxes[bi].w / 2 : bg.x} V ${L2_Y - 2}`"
                  fill="none"
                  stroke="var(--color-hudi-border)"
                  stroke-width="1.2"
                />
              </template>
            </g>

            <!-- 第一层：桶 -->
            <g v-for="bg in bucketGeoms" :key="`bucket-${bg.bucket}`">
              <rect
                :x="bg.x - 58"
                :y="L1_Y"
                width="116"
                :height="L1_H"
                rx="5"
                fill="color-mix(in srgb, var(--color-hudi-accent) 16%, transparent)"
                :stroke="bg.skew ? 'var(--st-warn-fg)' : 'var(--color-hudi-accent)'"
                stroke-width="1.3"
              />
              <text
                :x="bg.x"
                :y="L1_Y + 19"
                text-anchor="middle"
                font-size="11.5"
                font-weight="700"
                fill="var(--color-hudi-accent)"
              >
                桶 #{{ bg.bucket }}
              </text>
              <text :x="bg.x" :y="L1_Y + 33" text-anchor="middle" font-size="9.5" fill="var(--color-hudi-muted)">
                {{ bg.recordCount }} 条记录
              </text>
              <text :x="bg.x" :y="L1_Y + 43" text-anchor="middle" font-size="9.5" fill="var(--color-hudi-muted)">
                {{ bg.fileCount }} 个文件
              </text>
            </g>

            <!-- 第二层：File Group -->
            <g v-for="(gb, gi) in groupBoxes" :key="`group-${gi}`">
              <rect
                :x="gb.x"
                :y="L2_Y"
                :width="gb.w"
                :height="L2_H"
                rx="4"
                fill="color-mix(in srgb, var(--st-busy-fg) 12%, transparent)"
                stroke="var(--st-busy-fg)"
                stroke-width="1.2"
                :stroke-dasharray="gb.isPlaceholder ? '4 3' : undefined"
                opacity="gb.superseded ? 0.55 : 1"
              />
              <text :x="gb.x + 9" :y="L2_Y + 15" font-size="10" font-weight="600" fill="var(--st-busy-fg)">
                File Group
              </text>
              <text :x="gb.x + 9" :y="L2_Y + 29" font-size="9.5" font-family="monospace" fill="var(--color-hudi-text)">
                {{ gb.label.length > 24 ? `${gb.label.slice(0, 23)}…` : gb.label }}
              </text>
              <text :x="gb.x + 9" :y="L2_Y + 42" font-size="9" fill="var(--color-hudi-muted)">
                分区 {{ gb.partition }} ｜ {{ gb.fileCount }} 文件
                <tspan v-if="gb.superseded">（已被取代）</tspan>
              </text>
            </g>

            <!-- 第三层：记录 -->
            <g v-for="(gb, gi) in groupBoxes" :key="`rec-${gi}`">
              <line
                :x1="gb.x + gb.w / 2"
                :y1="L2_Y + L2_H"
                :x2="gb.x + gb.w / 2"
                :y2="L3_Y - 2"
                stroke="var(--color-hudi-border)"
                stroke-width="1.2"
              />
              <rect
                :x="gb.x"
                :y="L3_Y"
                :width="gb.w"
                :height="22 + Math.max(gb.rowCount, 1) * 15"
                rx="4"
                fill="transparent"
                stroke="var(--color-hudi-border)"
                stroke-width="1"
                stroke-dasharray="3 2"
              />
              <text :x="gb.x + 9" :y="L3_Y + 14" font-size="9.5" fill="var(--color-hudi-muted)">
                记录（{{ gb.recordCount }}）
              </text>
              <text
                v-for="(r, ri) in gb.records.slice(0, MAX_RECORD_ROWS)"
                :key="`rec-${gi}-${ri}`"
                :x="gb.x + 9"
                :y="L3_Y + 28 + ri * 15"
                font-size="9.5"
                font-family="monospace"
                fill="var(--color-hudi-text)"
              >
                {{ r.recordKey }}
                <tspan :class="opClass(r.operation)" font-size="9"> {{ r.operation }}</tspan>
              </text>
              <text
                v-if="gb.recordCount > MAX_RECORD_ROWS"
                :x="gb.x + 9"
                :y="L3_Y + 28 + MAX_RECORD_ROWS * 15"
                font-size="9"
                fill="var(--color-hudi-muted)"
              >
                还有 {{ gb.recordCount - MAX_RECORD_ROWS }} 条…
              </text>
            </g>
          </svg>
        </div>
        <p class="mt-1 text-[10px] leading-relaxed text-[var(--color-hudi-muted)]">
          图中「主键 → 桶」使用引擎的示意哈希（与写入口径一致）；「记录 → File Group」按「分区 + 桶号」归组，
          用于说明映射关系，实际落盘由引擎决定。
        </p>
      </section>

      <!-- ========================= 负载分布 ========================= -->
      <section class="rounded-md border p-2" style="border-color: var(--color-hudi-border)">
        <h4 class="mb-1 text-xs font-semibold">桶负载分布</h4>
        <div class="flex flex-col gap-1">
          <div v-for="d in distribution" :key="d.bucket" class="flex items-center gap-2">
            <span class="w-14 shrink-0 font-mono text-[10px] text-[var(--color-hudi-muted)]">
              桶 #{{ d.bucket }}
            </span>
            <div
              class="h-2.5 flex-1 overflow-hidden rounded"
              style="background: color-mix(in srgb, var(--color-hudi-border) 60%, transparent)"
            >
              <div
                class="h-2.5 rounded"
                :style="{
                  width: `${d.pct}%`,
                  background: d.skew ? 'var(--st-warn-fg)' : 'var(--color-hudi-accent)',
                }"
              />
            </div>
            <span class="w-32 shrink-0 text-right text-[10px] text-[var(--color-hudi-muted)]">
              {{ d.recordCount }} 条 / {{ d.fileCount }} 文件
            </span>
            <span v-if="d.skew" class="shrink-0 text-[10px]" style="color: var(--st-warn-fg)">数据倾斜</span>
            <span v-else-if="d.empty" class="shrink-0 text-[10px] text-[var(--color-hudi-muted)]">空桶</span>
          </div>
        </div>
        <p class="mt-1 text-[10px] leading-relaxed text-[var(--color-hudi-muted)]">
          倾斜（数据 skew）会让热点桶的 File Group 变大、写入并发下降。哈希分桶本身是随机的，
          明显的倾斜通常来自主键分布本身（例如自增 ID 或带前缀的编码）。
        </p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.bv-root {
  --st-warn-fg: #fcd34d;
  --st-warn-bg: rgba(245, 158, 11, 0.14);
  --st-warn-bd: rgba(245, 158, 11, 0.45);
  --st-busy-fg: #fdba74;
  --st-del-fg: #fca5a5;
  --st-del-bg: rgba(239, 68, 68, 0.14);
  --st-del-bd: rgba(239, 68, 68, 0.45);
  --st-ok-fg: #6ee7b7;
  --st-upd-fg: #93c5fd;
}
:global(:root[data-theme='light']) .bv-root {
  --st-warn-fg: #b45309;
  --st-busy-fg: #c2410c;
  --st-del-fg: #b91c1c;
  --st-ok-fg: #047857;
  --st-upd-fg: #1d4ed8;
}

.op-insert {
  fill: var(--st-ok-fg);
}
.op-update {
  fill: var(--st-upd-fg);
}
.op-delete {
  fill: var(--st-del-fg);
}
</style>
