<script setup lang="ts">
/**
 * TimelineView —— Timeline 横向时间轴（SVG）
 * ---------------------------------------------------------------------------
 * 教学重点：
 *  - Timeline 上每个 instant = 一次提交；颜色区分 action，实心 / 空心区分 state。
 *  - REQUESTED（已请求未提交）与 INFLIGHT（提交中）还没生效，单独放在 Pending 区。
 *  - 已归档（archive）的 instant 不再出现在活跃 Timeline 上。
 *
 * 契约边界：组件只渲染 props，不推断任何 Hudi 规则。
 */
import { computed } from 'vue'
import type { HudiInstant, InstantAction, InstantState } from '@/models/hudi'
import { prettyInstant } from '@/engine/core/instant'

/* -------------------------------------------------------------------------- */
/* Props / Emits                                                               */
/* -------------------------------------------------------------------------- */

const props = withDefaults(
  defineProps<{
    timeline: HudiInstant[]
    pending: HudiInstant[]
    archived?: HudiInstant[]
    selected?: string
  }>(),
  {
    archived: () => [],
    selected: '',
  },
)

const emit = defineEmits<{
  (e: 'select', instant: HudiInstant): void
}>()

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

const PAD = 26
const NODE_GAP = 150
const AXIS_Y = 66
const MAIN_H = 132
const PENDING_TOP = 142
const PENDING_H = 84
const PENDING_NODE_Y = PENDING_TOP + 42

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

const ACTION_STYLE: Record<string, string> = {
  COMMIT: 'act-commit',
  DELTA_COMMIT: 'act-deltacommit',
  COMPACTION: 'act-compaction',
  CLEAN: 'act-clean',
  ARCHIVE: 'act-archive',
  ROLLBACK: 'act-rollback',
  REPLACE_COMMIT: 'act-replace',
  CLUSTERING: 'act-clustering',
  RESTORE: 'act-other',
  TTL: 'act-other',
  SAVEPOINT: 'act-other',
}

/* -------------------------------------------------------------------------- */
/* 数据                                                                        */
/* -------------------------------------------------------------------------- */

function sortByTime(list: HudiInstant[] | undefined): HudiInstant[] {
  return [...(list ?? [])].filter(Boolean).sort((a, b) => String(a.instantTime).localeCompare(String(b.instantTime)))
}

const sortedTimeline = computed<HudiInstant[]>(() => sortByTime(props.timeline))
const sortedPending = computed<HudiInstant[]>(() => sortByTime(props.pending))
const sortedArchived = computed<HudiInstant[]>(() => sortByTime(props.archived))

interface Node {
  instant: HudiInstant
  x: number
  action: InstantAction
  state: InstantState
  date: string
  time: string
  selected: boolean
}

function toNode(instant: HudiInstant, index: number): Node {
  const pretty = prettyInstant(String(instant.instantTime ?? ''))
  const [date, time] = pretty.includes(' ') ? pretty.split(' ') : [pretty, '']
  return {
    instant,
    x: PAD + NODE_GAP / 2 + index * NODE_GAP,
    action: instant.action,
    state: instant.state,
    date,
    time,
    selected: Boolean(props.selected) && props.selected === instant.instantTime,
  }
}

const nodes = computed<Node[]>(() => sortedTimeline.value.map(toNode))
const pendingNodes = computed<Node[]>(() => sortedPending.value.map(toNode))

const svgWidth = computed<number>(() => {
  const count = Math.max(nodes.value.length, pendingNodes.value.length, 1)
  return PAD * 2 + count * NODE_GAP
})

const svgHeight = computed<number>(() => (pendingNodes.value.length ? PENDING_TOP + PENDING_H : MAIN_H))

const isEmpty = computed<boolean>(() => !sortedTimeline.value.length && !sortedPending.value.length)

/* -------------------------------------------------------------------------- */
/* 交互                                                                        */
/* -------------------------------------------------------------------------- */

function onSelect(node: Node): void {
  emit('select', node.instant)
}

function stateClass(state: InstantState): string {
  if (state === 'REQUESTED') return 'st-requested'
  if (state === 'INFLIGHT') return 'st-inflight'
  return 'st-completed'
}
</script>

<template>
  <div class="tv-root flex flex-col gap-2 text-xs">
    <!-- ========================= 图例 ========================= -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-hudi-muted)]">
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-[var(--act-commit-fg)]" aria-hidden="true" />
        <span>COMPLETED（实心）</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span
          class="inline-block h-2.5 w-2.5 rounded-full border border-[var(--st-warn-fg)]"
          aria-hidden="true"
        />
        <span>REQUESTED（空心 + 黄）</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span
          class="inline-block h-2.5 w-2.5 rounded-full border border-[var(--st-busy-fg)]"
          aria-hidden="true"
        />
        <span>INFLIGHT（空心 + 橙 + 闪烁）</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-[var(--act-deltacommit-fg)]" aria-hidden="true" />
        <span>DELTA COMMIT</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-[var(--act-compaction-fg)]" aria-hidden="true" />
        <span>COMPACTION</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-[var(--act-clean-fg)]" aria-hidden="true" />
        <span>CLEAN</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-[var(--act-archive-fg)]" aria-hidden="true" />
        <span>ARCHIVE</span>
      </span>
    </div>

    <!-- ========================= 空态 ========================= -->
    <div
      v-if="isEmpty"
      class="rounded-md border border-dashed p-4 text-center text-[var(--color-hudi-muted)]"
      style="border-color: var(--color-hudi-border)"
    >
      <p class="font-medium">Timeline 上还没有任何 instant。</p>
      <p class="mt-1 leading-relaxed">
        每完成一次写入或服务类操作（compaction / clean / archive / rollback / clustering），
        引擎都会往 Timeline 追加一个 instant。
      </p>
    </div>

    <!-- ========================= 时间轴 ========================= -->
    <div
      v-else
      class="overflow-x-auto rounded-md border p-2"
      style="border-color: var(--color-hudi-border)"
    >
      <svg
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        :width="svgWidth"
        :height="svgHeight"
        class="tv-svg"
        role="img"
        aria-label="Hudi Timeline 时间轴"
      >
        <!-- 主轴 -->
        <line
          :x1="PAD - 8"
          :y1="AXIS_Y"
          :x2="svgWidth - PAD + 8"
          :y2="AXIS_Y"
          stroke="var(--color-hudi-border)"
          stroke-width="1.4"
        />

        <!-- 已完成的 instant -->
        <g
          v-for="(node, i) in nodes"
          :key="`node-${node.instant.instantTime}-${i}`"
          class="tv-node"
          tabindex="0"
          role="button"
          :aria-label="`${node.instant.instantTime} ${node.instant.action}`"
          @click="onSelect(node)"
          @keydown.enter.prevent="onSelect(node)"
        >
          <!-- 选中高亮 -->
          <circle
            v-if="node.selected"
            :cx="node.x"
            :cy="AXIS_Y"
            r="17"
            fill="none"
            stroke="var(--color-hudi-accent)"
            stroke-width="1.4"
            opacity="0.9"
          />
          <!-- action 外环 -->
          <circle
            :cx="node.x"
            :cy="AXIS_Y"
            r="12"
            fill="none"
            stroke="currentColor"
            :class="ACTION_STYLE[node.action] ?? 'act-other'"
            stroke-width="1.6"
            opacity="0.75"
          />
          <!-- state 内核 -->
          <circle
            :cx="node.x"
            :cy="AXIS_Y"
            r="7"
            :class="stateClass(node.state)"
            stroke-width="1.8"
          />
          <!-- 上方：prettyInstant -->
          <text :x="node.x" :y="AXIS_Y - 30" text-anchor="middle" font-size="10" fill="var(--color-hudi-muted)">
            {{ node.date }}
          </text>
          <text
            :x="node.x"
            :y="AXIS_Y - 17"
            text-anchor="middle"
            font-size="10.5"
            font-family="monospace"
            fill="var(--color-hudi-text)"
          >
            {{ node.time }}
          </text>
          <!-- 下方：action + operation -->
          <text
            :x="node.x"
            :y="AXIS_Y + 22"
            text-anchor="middle"
            font-size="10.5"
            font-weight="600"
            :class="ACTION_STYLE[node.action] ?? 'act-other'"
            fill="currentColor"
          >
            {{ ACTION_LABEL[node.action] ?? node.action }}
          </text>
          <text
            :x="node.x"
            :y="AXIS_Y + 35"
            text-anchor="middle"
            font-size="10"
            fill="var(--color-hudi-muted)"
          >
            {{ node.instant.operation ?? '—' }}
          </text>
          <text
            :x="node.x"
            :y="AXIS_Y + 47"
            text-anchor="middle"
            font-size="9"
            font-family="monospace"
            fill="var(--color-hudi-muted)"
            opacity="0.75"
          >
            {{ node.instant.instantTime }}
          </text>
        </g>

        <!-- Pending 区 -->
        <g v-if="pendingNodes.length">
          <rect
            :x="PAD - 14"
            :y="PENDING_TOP"
            :width="svgWidth - (PAD - 14) * 2"
            :height="PENDING_H"
            rx="6"
            fill="color-mix(in srgb, var(--st-warn-fg) 7%, transparent)"
            stroke="var(--st-warn-fg)"
            stroke-width="1.2"
            stroke-dasharray="6 4"
          />
          <text :x="PAD - 4" :y="PENDING_TOP + 14" font-size="10" font-weight="600" fill="var(--st-warn-fg)">
            Pending 区（REQUESTED / INFLIGHT：尚未提交完成，对查询不可见）
          </text>

          <g
            v-for="(node, i) in pendingNodes"
            :key="`pending-${node.instant.instantTime}-${i}`"
            class="tv-node"
            tabindex="0"
            role="button"
            :aria-label="`pending ${node.instant.instantTime} ${node.instant.action}`"
            @click="onSelect(node)"
            @keydown.enter.prevent="onSelect(node)"
          >
            <circle
              :cx="node.x"
              :cy="PENDING_NODE_Y"
              r="12"
              fill="none"
              stroke="currentColor"
              :class="ACTION_STYLE[node.action] ?? 'act-other'"
              stroke-width="1.6"
              opacity="0.6"
            />
            <circle
              :cx="node.x"
              :cy="PENDING_NODE_Y"
              r="7"
              :class="stateClass(node.state)"
              stroke-width="1.8"
            />
            <text
              :x="node.x"
              :y="PENDING_NODE_Y - 22"
              text-anchor="middle"
              font-size="10"
              font-family="monospace"
              fill="var(--color-hudi-muted)"
            >
              {{ node.date }} {{ node.time }}
            </text>
            <text
              :x="node.x"
              :y="PENDING_NODE_Y + 24"
              text-anchor="middle"
              font-size="10"
              font-weight="600"
              :class="ACTION_STYLE[node.action] ?? 'act-other'"
              fill="currentColor"
            >
              {{ ACTION_LABEL[node.action] ?? node.action }}
            </text>
            <text
              :x="node.x"
              :y="PENDING_NODE_Y + 36"
              text-anchor="middle"
              font-size="9.5"
              fill="var(--color-hudi-muted)"
            >
              {{ node.instant.state }}
            </text>
          </g>
        </g>
      </svg>
    </div>

    <!-- ========================= 已归档 ========================= -->
    <div
      v-if="sortedArchived.length"
      class="flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5"
      style="border-color: var(--color-hudi-border)"
    >
      <span class="text-[11px] text-[var(--color-hudi-muted)]">
        已归档（Archive 移到 .hoodie/archive/，不在活跃 Timeline 上）：
      </span>
      <button
        v-for="(i, idx) in sortedArchived"
        :key="`archived-${i.instantTime}-${idx}`"
        class="tv-chip"
        type="button"
        @click="emit('select', i)"
      >
        <span class="font-mono">{{ i.instantTime }}</span>
        <span :class="ACTION_STYLE[i.action] ?? 'act-other'"> {{ ACTION_LABEL[i.action] ?? i.action }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tv-root {
  --st-warn-fg: #fcd34d;
  --st-warn-bg: rgba(245, 158, 11, 0.14);
  --st-warn-bd: rgba(245, 158, 11, 0.45);
  --st-busy-fg: #fdba74;
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
:global(:root[data-theme='light']) .tv-root {
  --st-warn-fg: #b45309;
  --st-busy-fg: #c2410c;
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

.tv-node {
  cursor: pointer;
}
.tv-node:focus {
  outline: none;
}
.tv-node:focus-visible circle {
  filter: drop-shadow(0 0 3px var(--color-hudi-accent));
}
.tv-svg {
  max-width: none;
}

.st-completed {
  fill: var(--color-hudi-accent);
  stroke: var(--color-hudi-accent);
}
.st-requested {
  fill: none;
  stroke: var(--st-warn-fg);
}
.st-inflight {
  fill: none;
  stroke: var(--st-busy-fg);
  animation: tv-blink 1s ease-in-out infinite;
}
@keyframes tv-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.25;
  }
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

.tv-chip {
  border-radius: 3px;
  border: 1px solid var(--color-hudi-border);
  padding: 0 5px;
  font-size: 10px;
  line-height: 16px;
  cursor: pointer;
  background: transparent;
  color: var(--color-hudi-text);
}
.tv-chip:hover {
  border-color: var(--color-hudi-accent);
}
</style>
