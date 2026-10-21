<script setup lang="ts">
/**
 * CompareLesson —— COW ↔ MOR 双泳道对比画布
 * ---------------------------------------------------------------------------
 * 这两个主题（B02 / B03）天生就是「并排比较」：左边 COW、右边 MOR，
 * 同一份数据、同一个动作、同一个时间点，看两边怎么落盘。
 *
 * 它保留自己的一套交互（可点的操作条：Upsert / Snapshot / Schedule /
 * Compaction / Cleaner），但**页面骨架**由 LessonView 统一提供。
 *
 * 对外接口：
 *   · emit('inspect', title, value) —— 点击文件时把物理文件交给外层检查器
 *   · emit('state', state)          —— 当前 MOR 泳道的表状态（供详情区使用）
 *   · emit('watched')               —— 一次演示完整播完
 *   · emit('caption', text)         —— 当前这一步的旁白（交给统一讲解条）
 */
import { computed, ref, watch } from 'vue'

import { useVisualTimeline, type Operation } from '@/animation/useVisualTimeline'
import { buildTeachingTrace } from '@/engine/visual/teachingTrace'
import type { TeachingTrace } from '@/engine/visual/teachingTrace'
import { runQuery } from '@/engine/queries'
import FileGlyph from '@/components/visual/FileGlyph.vue'
import type { HudiPhysicalFile, HudiRecord, HudiTableState } from '@/models/hudi'

const props = defineProps<{
  /** 主题 id（B02 / B03） */
  topicId: string
  /** 画布上的问题 */
  question: string
  /** 副标题 */
  subtitle: string
  /** 更新金额（由外层参数面板控制） */
  amount: number
  /** 工程师模式：显示「模拟失败」 */
  engineer: boolean
}>()

const emit = defineEmits<{
  inspect: [title: string, value: unknown]
  state: [state: HudiTableState]
  watched: []
  caption: [text: string]
}>()

const tl = useVisualTimeline()
const { scene, sequence, position, duration, step, settled, playing, speed, reduced, caption } = tl

const busy = computed(() => !!sequence.value && !settled.value)
const phaseProgress = computed(() => position.value % 1)
const lanes = computed(() => [
  { key: 'cow' as const, title: 'COW', subtitle: 'Copy On Write', state: scene.value.cow },
  { key: 'mor' as const, title: 'MOR', subtitle: 'Merge On Read', state: scene.value.mor },
])
const hasLogs = computed(() => scene.value.mor.fileGroups.some((g) => !g.supersededBy && g.fileSlice.logFiles.length))
const hasPlan = computed(() => scene.value.mor.compactionPlans.some((p) => p.state === 'PLANNED'))
const sequenceAmount = computed(() => sequence.value?.amount ?? props.amount)

const teaching = computed<Partial<Record<'cow' | 'mor', TeachingTrace>>>(() => {
  if (!sequence.value) return {}
  const seq = sequence.value
  return Object.fromEntries(
    (['cow', 'mor'] as const).map((side) => [
      side,
      buildTeachingTrace({
        before: seq.before[side],
        after: seq.after[side],
        action: seq.actions[side],
        operation:
          seq.kind === 'update' ? 'upsert' : seq.kind === 'snapshot' ? 'snapshot' : seq.kind === 'failure' ? 'fail' : seq.kind,
        parameters: {
          recordKey: '1001',
          amount: seq.amount,
          bucketCount: 4,
          partition: '2024-01-01',
          retention: 1,
          failureAt: -1,
          tableType: seq.before[side].table.tableType,
        },
      }),
    ]),
  )
})

function annotations(side: 'cow' | 'mor') {
  return Object.fromEntries(
    (teaching.value[side]?.outputRecords ?? []).map((r) => [
      r.recordKey,
      teaching.value[side]?.copiedKeys.includes(r.recordKey) ? '复制' : r.recordKey === '1001' ? '更新' : '保留',
    ]),
  )
}

function previewRows(side: 'cow' | 'mor') {
  return teaching.value[side]?.outputRecords ?? []
}

function copyProgress(n: number) {
  return Math.max(0, Math.min(1, phaseProgress.value * 1.45 - n * 0.14))
}

/** 当前画布里可读的文件（保留 ACTIVE 与最后一个被取代的 Base） */
function files(state: HudiTableState) {
  const all = state.physicalFiles
  const active = all.filter((f) => f.status === 'ACTIVE')
  const old = all.filter((f) => f.status === 'SUPERSEDED' && f.type === 'BASE').slice(-1)
  return [...old, ...active].slice(-4)
}

/** 取物理文件自己的记录（旧版本不会被替换成最新查询结果） */
function recordsFor(state: HudiTableState, file: HudiPhysicalFile): HudiRecord[] {
  for (const snapshot of [state, ...state.checkpoints.map((c) => c.state).reverse()]) {
    for (const group of snapshot.fileGroups) {
      const list = [group.fileSlice.baseFile, ...group.fileSlice.logFiles]
      const match = list.find((f) => f?.fileName === file.fileName)
      if (match) return match.records
    }
  }
  return []
}

function output(state: HudiTableState, mode: 'snapshot' | 'read-optimized') {
  return runQuery(state, { mode }).rows.find((r) => Number(r.id) === 1001)?.amount
}

function isNewFile(lane: 'cow' | 'mor', fileName: string) {
  if (!sequence.value) return false
  return !sequence.value.before[lane].physicalFiles.some((f) => f.fileName === fileName)
}

function packetX() {
  if (step.value === 0) return 90 + phaseProgress.value * 130
  if (step.value === 1) return 220 + phaseProgress.value * 160
  return 380
}

function start(kind: Operation) {
  tl.run(kind, props.amount)
}

function selectFile(state: HudiTableState, file: HudiPhysicalFile) {
  emit('inspect', file.fileName, { ...file, records: recordsFor(state, file) })
}

/* 状态与旁白同步给外层（详情区 / 统一讲解条） */
watch(
  () => scene.value.mor,
  (state) => emit('state', state),
  { immediate: true },
)
watch(caption, (text) => emit('caption', text), { immediate: true })
watch(
  () => settled.value && !!sequence.value,
  (done) => {
    if (done) emit('watched')
  },
)
</script>

<template>
  <section class="cmp-stage vl-stage" aria-label="COW 与 MOR 交互动画画布">
    <header class="cmp-stage-head">
      <div>
        <h2 class="cmp-question">{{ question }}</h2>
        <p class="cmp-subtitle">{{ subtitle }}</p>
      </div>
      <span class="cmp-status"><i class="vl-dot"></i>{{ busy ? '正在演示' : '交互画布' }}</span>
    </header>

    <div class="cmp-canvas-wrap">
      <svg viewBox="0 0 1120 290" class="vl-canvas" role="img" aria-label="COW 重写 Base，MOR 追加 Log 的双路径动画">
        <defs>
          <pattern id="cmp-grid" width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".09" />
          </pattern>
          <marker id="cmp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10" fill="none" stroke="currentColor" />
          </marker>
        </defs>
        <rect width="1120" height="290" fill="url(#cmp-grid)" />
        <path d="M560 12V280" class="vl-divider" />

        <g v-for="(lane, laneIndex) in lanes" :key="lane.key" :transform="`translate(${laneIndex * 560},0)`">
          <text x="28" y="30" class="vl-lane-title">{{ lane.title }}</text>
          <text x="105" y="28" class="vl-svg-muted">{{ lane.subtitle }}</text>
          <rect x="408" y="9" width="124" height="28" rx="14" class="vl-strategy" />
          <text x="470" y="28" text-anchor="middle" class="vl-strategy-text">
            {{ lane.key === 'cow' ? '写入时合并' : '读取时合并' }}
          </text>

          <path d="M100 75H220 M320 75H475V125" class="vl-flow-path" marker-end="url(#cmp-arrow)" />
          <rect x="28" y="53" width="128" height="44" rx="8" class="vl-input" />
          <text x="42" y="70" class="vl-small-label">UPDATE · 1001</text>
          <text x="42" y="87" class="vl-svg-code">
            ¥ {{ (sequence?.before[lane.key] ?? scene[lane.key]).records.find((r) => r.recordKey === '1001')?.fields.amount }}
            → {{ sequenceAmount }}
          </text>

          <rect x="220" y="51" width="102" height="46" rx="10" class="vl-writer" :class="{ working: busy && step < 3 }" />
          <text x="271" y="72" text-anchor="middle" class="vl-writer-text">
            {{ sequence?.kind === 'compact' && lane.key === 'mor' ? 'Merger' : 'Writer' }}
          </text>
          <text x="271" y="88" text-anchor="middle" class="vl-small-label">Hudi Engine</text>
          <text x="365" y="65" class="vl-small-label">
            {{ sequence?.kind === 'schedule' && lane.key === 'mor' ? 'COMPACTION PLAN' : 'INDEX → FILE GROUP' }}
          </text>

          <g
            v-if="busy && sequence?.kind === 'update' && step < 3"
            :transform="`translate(${packetX()},${step >= 2 ? 80 + phaseProgress * 43 : 60})`"
          >
            <rect width="67" height="29" rx="6" class="vl-packet" />
            <text x="33" y="19" text-anchor="middle" class="vl-packet-text">1001 · {{ sequenceAmount }}</text>
          </g>

          <rect x="20" y="115" width="520" height="135" rx="14" class="vl-group" />
          <text x="34" y="132" class="vl-small-label">FILE GROUP · dt=2024-01-01</text>

          <g
            v-for="(file, fileIndex) in files(lane.state)"
            :key="file.fileName"
            :transform="`translate(${34 + fileIndex * (files(lane.state).length > 2 ? 124 : 235)},138) scale(${files(lane.state).length > 2 ? 0.72 : 1})`"
          >
            <g
              :opacity="sequence && isNewFile(lane.key, file.fileName) && !settled ? Math.min(1, phaseProgress * 3) : 1"
              :transform="`translate(0,${sequence && isNewFile(lane.key, file.fileName) && !settled ? (1 - phaseProgress) * 22 : 0})`"
            >
              <FileGlyph
                :file="file"
                :records="recordsFor(lane.state, file)"
                :x="0"
                :y="0"
                :fresh="!!sequence && isNewFile(lane.key, file.fileName)"
                :highlight="!!sequence && step >= 2"
                :annotations="sequence?.kind === 'update' && isNewFile(lane.key, file.fileName) ? annotations(lane.key) : undefined"
                @select="selectFile(lane.state, file)"
              />
            </g>
          </g>

          <g v-if="busy && sequence?.kind === 'compact' && lane.key === 'mor' && step > 0 && step < 4">
            <path d="M100 200Q250 90 420 200 M340 200Q380 140 420 200" class="vl-merge-path" />
            <circle :cx="100 + phaseProgress * 320" :cy="200 - Math.sin(phaseProgress * Math.PI) * 65" r="9" class="vl-packet" />
            <rect x="405" y="177" width="104" height="50" rx="8" class="vl-writer" />
            <text x="457" y="205" text-anchor="middle" class="vl-writer-text">MERGE</text>
          </g>

          <g
            v-if="busy && (sequence?.kind === 'update' || (sequence?.kind === 'compact' && lane.key === 'mor')) && step === 3"
            data-detail="cow-mor-row-copy"
          >
            <FileGlyph
              v-if="teaching[lane.key]?.outputFile"
              :file="teaching[lane.key]!.outputFile!"
              :records="previewRows(lane.key)"
              :x="270"
              :y="138"
              :disabled="true"
              :reveal-count="Math.floor(phaseProgress * previewRows(lane.key).length * 1.6)"
              :annotations="annotations(lane.key)"
              :fresh="true"
            />
            <g
              v-for="(row, n) in previewRows(lane.key)"
              :key="row.recordKey"
              :transform="`translate(${teaching[lane.key]?.copiedKeys.includes(row.recordKey) ? 126 + copyProgress(n) * 235 : 271 + copyProgress(n) * 90},${teaching[lane.key]?.copiedKeys.includes(row.recordKey) ? 195 + n * 17 : 85 + copyProgress(n) * (110 + n * 17)})`"
              :opacity="copyProgress(n) < 1 ? 1 : 0"
            >
              <rect
                x="-48"
                y="-11"
                width="96"
                height="21"
                rx="4"
                :fill="teaching[lane.key]?.copiedKeys.includes(row.recordKey) ? '#bed8ed' : '#bfe7b1'"
              />
              <text y="4" text-anchor="middle" class="vl-packet-text">{{ row.recordKey }} · {{ row.fields.amount }}</text>
            </g>
          </g>

          <text v-if="sequence?.kind === 'update' && step >= 2" x="28" y="110" class="vl-teaching-note">
            {{
              lane.key === 'cow'
                ? '更新 1001；' + (teaching.cow?.copiedKeys.join('、') || '其余记录') + ' 原样复制'
                : 'Base 不改写；只把 1001 的新版本写入 Log'
            }}
          </text>

          <text x="30" y="270" class="vl-query-label">
            SNAPSHOT <tspan class="vl-query-value">¥ {{ output(lane.state, 'snapshot') }}</tspan>
          </text>
          <text x="290" y="270" class="vl-query-label">
            READ OPTIMIZED <tspan class="vl-query-value">¥ {{ output(lane.state, 'read-optimized') }}</tspan>
          </text>
          <path
            v-if="busy && sequence?.kind === 'snapshot' && step === 1"
            :d="`M90 230L${90 + phaseProgress * 150} ${230 + phaseProgress * 35}`"
            class="vl-merge-path"
          />
          <text x="30" y="286" class="vl-small-label">
            {{
              sequence?.kind === 'update'
                ? lane.key === 'cow'
                  ? `本次写 ${teaching.cow?.outputRecords.length ?? 0} 条到新 Base；旧文件等待 Cleaner`
                  : `本次写 ${teaching.mor?.outputRecords.length ?? 0} 条到 Log；读优化仍读旧 Base`
                : lane.key === 'cow'
                  ? '重写受影响文件，读取直接得到最新值'
                  : '追加更新日志，快照读取时归并最新值'
            }}
          </text>
        </g>
      </svg>
    </div>

    <div class="vl-caption" aria-live="polite">
      <span class="vl-step-number">{{ String(sequence ? step + 1 : 0).padStart(2, '0') }}</span>
      <div>
        <small>{{ sequence ? '观察正在发生的变化' : '从这里开始 · 约 1 分钟' }}</small>
        <p>{{ caption }}</p>
      </div>
      <span class="vl-caption-count">{{ sequence ? `${step + 1} / ${duration}` : 'COW ↔ MOR' }}</span>
    </div>

    <div class="vl-controls" aria-label="动画播放控件">
      <div class="vl-playback">
        <button aria-label="上一步" :disabled="!sequence || position === 0" @click="tl.back">|◀</button>
        <button
          class="vl-play"
          :aria-label="playing ? '暂停' : '播放'"
          @click="!sequence ? start('update') : playing ? tl.pause() : tl.play()"
        >
          {{ playing ? 'Ⅱ' : '▶' }}
        </button>
        <button aria-label="下一步" :disabled="!sequence || settled" @click="tl.next">▶|</button>
        <button aria-label="重放" :disabled="!sequence" @click="tl.pause(); position = 0; tl.play()">↺</button>
        <select v-model.number="speed" aria-label="播放速度">
          <option :value="0.5">0.5×</option>
          <option :value="1">1×</option>
          <option :value="2">2×</option>
        </select>
      </div>
      <div class="vl-progress">
        <input
          v-model.number="position"
          type="range"
          min="0"
          :max="duration"
          step="0.01"
          aria-label="动画进度"
          :disabled="!sequence"
          @input="tl.pause()"
        />
        <button :disabled="!busy" @click="tl.skip">跳过动画</button>
      </div>
      <button class="vl-reset" @click="tl.reset">重置实验</button>
    </div>

    <div class="vl-action-bar">
      <span>现在试试看</span>
      <button class="vl-primary" :disabled="busy" @click="start('update')">↑ Upsert 更新记录</button>
      <button :disabled="busy" @click="start('snapshot')">Snapshot 读取</button>
      <span class="vl-action-divider"></span>
      <button :disabled="busy || !hasLogs || hasPlan" @click="start('schedule')">① Schedule</button>
      <button :disabled="busy || !hasPlan" @click="start('compact')">② Compaction</button>
      <button :disabled="busy" @click="start('clean')">Cleaner</button>
      <button v-if="engineer" :disabled="busy || !hasPlan" @click="start('failure')">模拟失败</button>
    </div>
  </section>
</template>

<style scoped>
.cmp-stage {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vl-line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vl-panel);
}
.cmp-stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--vl-line);
}
.cmp-question {
  margin: 0;
  font-size: var(--vl-fs-lg, 16px);
  color: var(--vl-ink);
}
.cmp-subtitle {
  margin: 4px 0 0;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.cmp-status {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  white-space: nowrap;
}
.cmp-canvas-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0;
}
.cmp-canvas-wrap .vl-canvas {
  width: 100%;
  height: auto;
  max-height: 320px;
}
.vl-teaching-note {
  font: 12px 'PingFang SC', sans-serif;
  fill: var(--vl-ink);
}
@media (max-width: 550px) {
  .cmp-canvas-wrap {
    justify-content: flex-start;
    overflow-x: auto;
  }
  .cmp-canvas-wrap .vl-canvas {
    width: 900px;
    min-width: 900px;
    flex: none;
  }
}
</style>
