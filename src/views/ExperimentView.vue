<script setup lang="ts">
/**
 * ExperimentView —— 实验主视图（三栏 + 底部 Tab）
 * ---------------------------------------------------------------------------
 * 设计约束（来自 CONTRACT.md 铁律）：
 *   - UI **不实现 Hudi 业务规则**，所有文件 / Timeline 变化都来自 store.state；
 *   - 组件 props 严格按契约 §6 的签名调用；
 *   - 任何按钮都只做一件事：把一个 SimulationAction 派发给 store。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

import { useLabStore } from '@/app/stores/lab'
import type { ActionType, InputRecord, SimulationAction } from '@/models/actions'
import type { EvidenceLevel } from '@/models/evidence'
import type { HudiInstant, HudiPhysicalFile, HudiRecord, HudiTable, HudiTableState, IndexType } from '@/models/hudi'
import type { ExperimentDefinition, ExperimentStep, SimulationEvent } from '@/models/simulation'
import type { SqlBlock, TemplateContext } from '@/engine/templates'
import { TEMPLATES, buildSql, createTemplateContext } from '@/engine/templates'

import FileTreeView from '@/components/filesystem/FileTreeView.vue'
import TimelineView from '@/components/timeline/TimelineView.vue'
import TimelineTable from '@/components/timeline/TimelineTable.vue'
import RecordTable from '@/components/records/RecordTable.vue'
import ControlPanel from '@/components/experiment/ControlPanel.vue'
import StepRunner from '@/components/experiment/StepRunner.vue'
import EdgeCasePanel from '@/components/experiment/EdgeCasePanel.vue'
import SqlPanel from '@/components/sql/SqlPanel.vue'
import EvidencePanel from '@/components/evidence/EvidencePanel.vue'
import QuizPanel from '@/components/quiz/QuizPanel.vue'
import LogPanel from '@/components/common/LogPanel.vue'

import { B02, B02_STATE_FACTORIES, buildB02Table } from '@/experiments/basics/B02CowVsMor'
import { getCatalogEntry, getExperimentById } from '@/experiments/catalog'

/* -------------------------------------------------------------------------- */
/* Store 与路由                                                                  */
/* -------------------------------------------------------------------------- */

const lab = useLabStore()
const route = useRoute()

const experimentId = computed<string>(() => {
  const id = (route?.params?.id as string | undefined) ?? ''
  return id || 'B02'
})

const experiment = computed<ExperimentDefinition | undefined>(() => {
  return getExperimentById(experimentId.value) ?? (experimentId.value === 'B02' ? B02 : undefined)
})

/** 目录条目是「这个实验要讲什么」的权威口径（标题 / 证据等级 / 支持状态） */
const catalogEntry = computed(() => getCatalogEntry(experimentId.value))

/** 表格在未加载时也要有合法形状，否则子组件的 props 类型不成立 */
const FALLBACK_TABLE: HudiTable = buildB02Table()

const table = computed<HudiTable>(() => lab.table ?? FALLBACK_TABLE)
const hasState = computed<boolean>(() => Boolean(lab.state))

/** 证据等级色：与设计 token --color-ev-E0..E4 对应 */
function evidenceColor(level?: EvidenceLevel): string {
  return `var(--color-ev-${level ?? 'E0'}, #64748b)`
}

/* -------------------------------------------------------------------------- */
/* 控制项                                                                        */
/* -------------------------------------------------------------------------- */

const controlValues = ref<Record<string, unknown>>({})

/** 这些控制项参与表定义，改动后必须重建实验状态 */
const REBUILD_KEYS = new Set([
  'tableType',
  'partitionValue',
  'preCombineEnabled',
  'indexType',
  'bucketCount',
])

function defaultControlValues(): Record<string, unknown> {
  const values: Record<string, unknown> = {}
  ;(experiment.value?.controls ?? []).forEach((c) => {
    values[c.key] = c.defaultValue
  })
  return values
}

const tableType = computed<string>(() => String(controlValues.value.tableType ?? 'COPY_ON_WRITE'))
const isMor = computed<boolean>(() => tableType.value === 'MERGE_ON_READ')

/* -------------------------------------------------------------------------- */
/* 动作派发                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 把步骤里形如 {{partitionValue}} 的占位符替换成当前控制项的值。
 * 这只是参数替换，不涉及任何 Hudi 语义。
 * 用递归替换而不是「先 JSON 序列化再字符串替换」，避免控制项值里出现引号时把 JSON 弄坏。
 */
function substitute(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
      const v = controlValues.value[key]
      return v === undefined || v === null ? '' : String(v)
    })
  }
  if (Array.isArray(value)) return value.map(substitute)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      out[k] = substitute(v)
    })
    return out
  }
  return value
}

function materializeAction(action: unknown): Record<string, unknown> {
  return (substitute(action ?? {}) ?? {}) as Record<string, unknown>
}

function toInputRecord(record: HudiRecord): InputRecord {
  return {
    recordKey: record.recordKey,
    partitionPath: record.partitionPath,
    fields: { ...record.fields },
  }
}

function dispatchAction(action: unknown): void {
  if (!lab.state) return
  const materialized = materializeAction(action)
  const type = materialized.type as ActionType
  if (type === 'RESET_EXPERIMENT') {
    // 重置不是引擎行为：applyAction 对它返回原状态，真正恢复由 store.reset() 完成
    lab.reset()
    return
  }
  lab.dispatch(materialized as unknown as SimulationAction)
}

/**
 * 按当前控制项重建实验状态。
 *
 * 走的是引擎的标准动作通道（CREATE_TABLE + UPSERT_RECORDS），
 * 因此重建后的文件布局、Timeline 与工厂产出的状态完全一致。
 */
function rebuildState(): void {
  if (!lab.state) return
  const factory = B02_STATE_FACTORIES[tableType.value]
  if (!factory) return
  const next = factory({
    partitionValue: String(controlValues.value.partitionValue ?? ''),
    preCombineEnabled: Boolean(controlValues.value.preCombineEnabled),
    indexType: String(controlValues.value.indexType ?? 'SIMPLE') as IndexType,
    bucketCount: Number(controlValues.value.bucketCount ?? 4),
  })
  lab.dispatch({ type: 'CREATE_TABLE', table: next.table } as unknown as SimulationAction)
  lab.dispatch({
    type: 'UPSERT_RECORDS',
    records: next.records.map(toInputRecord),
  } as unknown as SimulationAction)
}

let rebuildTimer: number | undefined

/** 防抖重建：文本类控制项每敲一个字都会触发 update */
function scheduleRebuild(): void {
  if (rebuildTimer !== undefined) window.clearTimeout(rebuildTimer)
  rebuildTimer = window.setTimeout(() => {
    rebuildTimer = undefined
    rebuildState()
  }, 350)
}

function onControlUpdate(key: string, value: unknown): void {
  const control = (experiment.value?.controls ?? []).find((c) => c.key === key)
  let next: unknown = value
  if (control?.kind === 'number') next = Number(value)
  if (control?.kind === 'switch') next = Boolean(value)
  controlValues.value = { ...controlValues.value, [key]: next }
  if (REBUILD_KEYS.has(key)) {
    // 文本类控制项是逐字符触发的，这里做一次防抖，避免每敲一个字就重建一次状态
    scheduleRebuild()
  }
}

/* -------------------------------------------------------------------------- */
/* 步骤与演示控制                                                                */
/* -------------------------------------------------------------------------- */

const steps = computed<ExperimentStep[]>(() => experiment.value?.steps ?? [])
const currentStepIndex = ref(0)
const playing = ref(false)
let playTimer: number | undefined

function runStep(index: number): void {
  const step = steps.value[index]
  if (!step?.action) return
  currentStepIndex.value = index
  dispatchAction(step.action)
}

function onStepRun(step: ExperimentStep, index: number): void {
  currentStepIndex.value = index
  dispatchAction(step.action)
}

function onGoto(index: number): void {
  currentStepIndex.value = index
}

function stopAutoPlay(): void {
  playing.value = false
  if (playTimer !== undefined) {
    window.clearInterval(playTimer)
    playTimer = undefined
  }
}

function toggleAutoPlay(): void {
  if (playing.value) {
    stopAutoPlay()
    return
  }
  playing.value = true
  playTimer = window.setInterval(() => {
    if (currentStepIndex.value >= steps.value.length - 1) {
      stopAutoPlay()
      return
    }
    const next = currentStepIndex.value + 1
    currentStepIndex.value = next
    runStep(next)
  }, 2600)
}

/** 控制项是否被改过（改过之后 store 里的 initialState 与当前控制项就不一致了） */
function controlsDifferFromDefault(): boolean {
  const defaults = defaultControlValues()
  return Object.keys(defaults).some((key) => defaults[key] !== controlValues.value[key])
}

function onReset(): void {
  stopAutoPlay()
  currentStepIndex.value = 0
  lab.reset()
  // store 的 initialState 是按实验默认控制项建的；若用户改过表类型等参数，需要按当前控制项重建
  if (controlsDifferFromDefault()) rebuildState()
}

/** 恢复初始状态：重新加载实验定义（连同控制项默认值一起复位） */
function restoreInitial(): void {
  stopAutoPlay()
  currentStepIndex.value = 0
  controlValues.value = defaultControlValues()
  loadExperiment()
}

function loadExperiment(): void {
  try {
    lab.loadExperiment(experimentId.value)
  } catch (err) {
    // 目录里没有登记该实验时，store 不会有任何状态；界面据此给出明确提示
    console.error('[ExperimentView] 加载实验失败', err)
  }
}

onMounted(() => {
  controlValues.value = defaultControlValues()
  loadExperiment()
})

onBeforeUnmount(() => {
  stopAutoPlay()
  if (rebuildTimer !== undefined) {
    window.clearTimeout(rebuildTimer)
    rebuildTimer = undefined
  }
})

watch(experimentId, () => {
  stopAutoPlay()
  currentStepIndex.value = 0
  controlValues.value = defaultControlValues()
  loadExperiment()
})

/* -------------------------------------------------------------------------- */
/* 手动操作按钮                                                                  */
/* -------------------------------------------------------------------------- */

const MANUAL_ACTIONS: { label: string; action: Record<string, unknown>; hint?: string }[] = [
  {
    label: '插入（主键 1004）',
    action: {
      type: 'UPSERT_RECORDS',
      records: [
        {
          recordKey: '1004',
          fields: { id: 1004, name: '新增订单D', amount: 400.75, ts: 20240101130000, dt: '{{partitionValue}}' },
        },
      ],
    },
  },
  {
    label: '更新（主键 1001）',
    action: {
      type: 'UPSERT_RECORDS',
      records: [
        {
          recordKey: '1001',
          fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: '{{partitionValue}}' },
        },
      ],
    },
  },
  { label: '删除（主键 1002）', action: { type: 'DELETE_RECORDS', recordKeys: ['1002'] } },
  {
    label: '同批次重复主键（验证 precombine）',
    action: {
      type: 'UPSERT_RECORDS',
      records: [
        {
          recordKey: '1005',
          fields: { id: 1005, name: '订单E-旧', amount: 500, ts: 20240101150000, dt: '{{partitionValue}}' },
        },
        {
          recordKey: '1005',
          fields: { id: 1005, name: '订单E-新', amount: 505, ts: 20240101160000, dt: '{{partitionValue}}' },
        },
      ],
    },
    hint: '同一批次里出现两次主键 1005：precombine 值大者胜，期望只新增 1 条记录。',
  },
  { label: '生成 Compaction Plan', action: { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 } },
  { label: '执行 Compaction', action: { type: 'RUN_COMPACTION' } },
  { label: '执行 Clean', action: { type: 'RUN_CLEAN', commitsRetained: 1 } },
  { label: '重置', action: { type: 'RESET_EXPERIMENT' } },
]

function runManualAction(action: Record<string, unknown>): void {
  dispatchAction(action)
}

/* -------------------------------------------------------------------------- */
/* 展示数据                                                                      */
/* -------------------------------------------------------------------------- */

const showTombstone = ref(true)
const recordRows = computed<HudiRecord[]>(() => {
  if (showTombstone.value) return lab.records
  return lab.visibleRecords
})

const selectedFile = ref<string>('')
const selectedInstant = ref<string>('')

function onFileSelect(file: HudiPhysicalFile): void {
  selectedFile.value = file.fileName
}

function onInstantSelect(instant: HudiInstant): void {
  selectedInstant.value = instant.instantTime
}

const lastEvent = computed(() => lab.history[lab.history.length - 1] ?? null)
const allLogs = computed<string[]>(() => lab.history.flatMap((e: SimulationEvent) => e.logs))
const currentExplanation = computed<string>(() => lastEvent.value?.explanation ?? '尚未执行任何动作。')

const evidenceIds = computed<string[]>(() => {
  const ids = new Set<string>(experiment.value?.evidenceIds ?? [])
  lastEvent.value?.evidenceIds?.forEach((id: string) => ids.add(id))
  return [...ids]
})

/* -------------------------------------------------------------------------- */
/* SQL 面板                                                                      */
/* -------------------------------------------------------------------------- */

const SQL_TEMPLATE_IDS = [
  'spark-create-table-cow',
  'spark-create-table-mor',
  'spark-insert',
  'spark-upsert',
  'spark-delete',
  'spark-query-snapshot',
  'spark-query-read-optimized',
  'spark-compaction-plan-only',
  'spark-compaction-inline',
  'spark-clean',
]

const templateContext = computed<TemplateContext>(() => {
  const t = table.value
  const instants = lab.timeline.map((i: HudiInstant) => i.instantTime)
  return createTemplateContext({
    database: t.databaseName,
    table: t.tableName,
    qualifiedTable: `${t.databaseName}.${t.tableName}`,
    tablePath: t.tablePath,
    tableType: t.tableType === 'MERGE_ON_READ' ? 'mor' : 'cow',
    primaryKey: t.primaryKey ?? 'id',
    preCombineField: t.preCombineField ?? '',
    partitionFields: t.partitionFields.join(','),
    partitionKey: t.partitionFields[0] ?? 'dt',
    partitionValue: String(controlValues.value.partitionValue ?? ''),
    indexType: t.indexType,
    columns: t.fields.map((f) => f.name).join(','),
    recordKey: '1001',
    beginInstantTime: instants[0] ?? '20240101120000',
    endInstantTime: instants[instants.length - 1] ?? '20240101130000',
    asOfInstant: instants[instants.length - 1] ?? '20240101120000',
  })
})

const sqlBlocks = computed<SqlBlock[]>(() => {
  const ctx = templateContext.value
  return TEMPLATES['spark-sql']
    .filter((b) => SQL_TEMPLATE_IDS.includes(b.id))
    .filter((b) => b.id !== 'spark-create-table-cow' || table.value.tableType === 'COPY_ON_WRITE')
    .filter((b) => b.id !== 'spark-create-table-mor' || table.value.tableType === 'MERGE_ON_READ')
    .map((b) => {
      try {
        return { ...b, code: buildSql('spark-sql', b.id, ctx) }
      } catch (err) {
        return {
          ...b,
          code: `/* 模板渲染失败：${err instanceof Error ? err.message : String(err)} */`,
        }
      }
    })
})

async function onCopy(code: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('当前浏览器不允许访问剪贴板，请手动复制。')
  }
}

/* -------------------------------------------------------------------------- */
/* 状态对比（前后 diff）                                                          */
/* -------------------------------------------------------------------------- */

/** checkpoint 的结构：{ instantTime, state } —— 每次成功提交都会打一个 */
type Checkpoint = HudiTableState['checkpoints'][number]

const beforeInstant = ref<string>('')
const afterInstant = ref<string>('__current__')

const checkpointOptions = computed<{ label: string; value: string }[]>(() => {
  const checkpoints: Checkpoint[] = lab.state?.checkpoints ?? []
  const timeline: HudiInstant[] = lab.state?.timeline ?? []
  return [
    ...checkpoints.map((c) => {
      const action = timeline.find((i) => i.instantTime === c.instantTime)?.action ?? 'COMMIT'
      return { label: `${c.instantTime}（${action}）`, value: c.instantTime }
    }),
    { label: '当前状态', value: '__current__' },
  ]
})

watch(
  checkpointOptions,
  (options) => {
    if (!options.length) return
    if (!beforeInstant.value || !options.some((o) => o.value === beforeInstant.value)) {
      // 默认基准 = 最早的 checkpoint（还没有 checkpoint 时退化为当前状态）
      const firstCheckpoint = options.find((o) => o.value !== '__current__')
      beforeInstant.value = firstCheckpoint?.value ?? '__current__'
    }
    if (!afterInstant.value || !options.some((o) => o.value === afterInstant.value)) {
      afterInstant.value = '__current__'
    }
  },
  { immediate: true },
)

function stateAt(value: string): HudiTableState | null {
  const state = lab.state
  if (!state) return null
  if (value === '__current__') return state
  return state.checkpoints.find((c: Checkpoint) => c.instantTime === value)?.state ?? null
}

function metricsOf(state: HudiTableState | null): Record<string, number> {
  if (!state) return {}
  const active = state.fileGroups.filter((g) => !g.supersededBy)
  return {
    '有效 File Group': active.length,
    '被取代的 File Group': state.fileGroups.length - active.length,
    'base 文件（有效）': active.filter((g) => g.fileSlice.baseFile).length,
    'log 文件（有效）': active.reduce((n, g) => n + g.fileSlice.logFiles.length, 0),
    'HDFS 物理文件数': state.physicalFiles.length,
    '其中待 Clean（SUPERSEDED）': state.physicalFiles.filter((f) => f.status === 'SUPERSEDED').length,
    '可见记录数': state.records.filter((r) => r.operation !== 'D').length,
    'tombstone 数': state.records.filter((r) => r.operation === 'D').length,
    'Timeline instant 数': state.timeline.length,
    'pending instant 数': state.pendingInstants.length,
    'Compaction Plan 数': state.compactionPlans.length,
  }
}

const diffRows = computed(() => {
  const before = metricsOf(stateAt(beforeInstant.value))
  const after = metricsOf(stateAt(afterInstant.value))
  return Object.keys(after).map((key) => ({
    key,
    before: before[key] ?? 0,
    after: after[key] ?? 0,
    delta: (after[key] ?? 0) - (before[key] ?? 0),
  }))
})

/* -------------------------------------------------------------------------- */
/* 历史回看                                                                      */
/* -------------------------------------------------------------------------- */

const historyVisible = ref(false)
const historyIndex = ref(-1)

const historyDetail = computed(() => {
  if (historyIndex.value < 0) return null
  return lab.history[historyIndex.value] ?? null
})

function openHistory(index: number): void {
  historyIndex.value = index
  historyVisible.value = true
}

/* -------------------------------------------------------------------------- */
/* 练习                                                                          */
/* -------------------------------------------------------------------------- */

function onQuizSubmit(score: number): void {
  lab.setQuizScore(experimentId.value, score)
}

/* -------------------------------------------------------------------------- */
/* 全屏                                                                          */
/* -------------------------------------------------------------------------- */

const isFullscreen = ref(false)

async function toggleFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    ElMessage.warning('当前环境不允许进入全屏演示。')
  }
}

function syncFullscreen(): void {
  isFullscreen.value = Boolean(document.fullscreenElement)
}

onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreen)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
})

/* -------------------------------------------------------------------------- */
/* 标签页                                                                        */
/* -------------------------------------------------------------------------- */

const activeTab = ref('sql')
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-3 text-[var(--color-hudi-text,#e2e8f0)]">
    <!-- ============================ 顶部 ============================ -->
    <header
      class="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] px-4 py-3"
    >
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-lg font-semibold">{{ experiment?.title ?? catalogEntry?.title ?? '实验未加载' }}</h1>
          <el-tag size="small" type="info">{{ experimentId }}</el-tag>
          <el-tag size="small" type="warning">难度：{{ experiment?.difficulty ?? '-' }}</el-tag>
          <el-tag
            size="small"
            :style="{ background: evidenceColor(catalogEntry?.evidenceLevel ?? experiment?.evidenceLevel), color: '#f8fafc', border: 'none' }"
          >
            证据等级 {{ catalogEntry?.evidenceLevel ?? experiment?.evidenceLevel ?? '-' }}（社区 0.15 文档）
          </el-tag>
          <el-tag size="small" type="info">
            {{
              (catalogEntry?.supportState ?? experiment?.supportState) === 'conditional'
                ? '有条件支持：MOR 首写落点待 r26 实测'
                : `支持状态：${catalogEntry?.supportState ?? experiment?.supportState ?? '-'}`
            }}
          </el-tag>
        </div>
        <p
          v-if="catalogEntry?.summary"
          class="mt-1 max-w-3xl text-xs leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]"
        >
          {{ catalogEntry.summary }}
        </p>
        <div class="mt-1 text-xs text-[var(--color-hudi-muted,#94a3b8)]">
          目标版本：{{ experiment?.targetVersion ?? '-' }} ｜ 预计用时 {{ experiment?.estimatedMinutes ?? '-' }} 分钟
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <el-button size="small" @click="toggleAutoPlay">
          {{ playing ? '暂停自动播放' : '自动播放' }}
        </el-button>
        <el-button size="small" @click="onReset">重置</el-button>
        <el-button size="small" @click="restoreInitial">恢复初始状态</el-button>
        <el-button size="small" @click="lab.stepBack()">回退一步</el-button>
        <el-button size="small" @click="historyVisible = true">回看历史（{{ lab.history.length }}）</el-button>
        <el-button size="small" @click="toggleFullscreen">
          {{ isFullscreen ? '退出全屏' : '全屏演示' }}
        </el-button>
      </div>
    </header>

    <!-- 全局警示 -->
    <el-alert
      class="shrink-0"
      type="warning"
      :closable="false"
      show-icon
      title="纯浏览器模拟，未连接真实集群"
      description="本页所有文件、Timeline、instant 变化均由本仓库的 mini-Hudi 内核在浏览器内计算得出，未提交任何 Spark / Flink 作业，也未连接华为 MRS r26 集群。凡是 r26 未实测的行为，界面均标注「待验证」。"
    />

    <el-alert
      class="shrink-0"
      v-if="!hasState"
      type="error"
      :closable="false"
      show-icon
      title="实验状态为空"
      description="实验目录（src/experiments/catalog.ts）里还没有登记该实验，或加载失败。请确认目录已注册该 id 后刷新页面。"
    />

    <el-alert
      class="shrink-0"
      v-if="lab.lastError"
      type="error"
      :closable="false"
      show-icon
      :title="`最近一次动作失败：${lab.lastError}`"
      description="失败的动作不会产生任何状态变更 —— 引擎会原样返回操作前的状态。"
    />

    <!-- ============================ 三栏 ============================ -->
    <!--
      宽屏（xl ≥1280px）：12 栅格三栏并排，每栏内部独立滚动。
      窄屏：降级为纵向单列，此时「整块网格」整体滚动，
      各栏必须用自然高度（不能带 min-h-0），否则行会被压扁成 0。
    -->
    <div
      class="grid flex-none auto-rows-min grid-cols-1 gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-12 xl:grid-rows-1 xl:auto-rows-auto xl:overflow-hidden"
    >
      <!-- ---------------------------- 左栏 ---------------------------- -->
      <aside class="flex flex-col gap-3 xl:col-span-3 xl:min-h-0 xl:overflow-y-auto">
        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">学习目标</h2>
          <ul class="list-disc space-y-1 pl-4 text-xs leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]">
            <li v-for="(item, idx) in experiment?.learningObjectives ?? []" :key="idx">{{ item }}</li>
          </ul>
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">实验步骤</h2>
          <StepRunner
            :steps="steps"
            :current-index="currentStepIndex"
            @run="onStepRun"
            @reset="onReset"
            @goto="onGoto"
          />
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">边界场景</h2>
          <EdgeCasePanel :edge-cases="experiment?.edgeCases ?? []" />
        </section>
      </aside>

      <!-- ---------------------------- 中栏 ---------------------------- -->
      <main class="flex flex-col gap-3 xl:col-span-6 xl:min-h-0 xl:overflow-y-auto">
        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold">操作</h2>
            <el-tag size="small" type="info">表类型：{{ isMor ? 'MOR' : 'COW' }}</el-tag>
            <el-tag size="small" type="info">分区：{{ controlValues.partitionValue ?? '-' }}</el-tag>
            <el-tag size="small" type="info">索引：{{ controlValues.indexType ?? '-' }}</el-tag>
            <span class="text-xs text-[var(--color-hudi-muted,#94a3b8)]">
              每个按钮只做一件事：派发一个 SimulationAction 给引擎。
            </span>
          </div>
          <div class="flex flex-wrap gap-2">
            <el-button
              v-for="item in MANUAL_ACTIONS"
              :key="item.label"
              size="small"
              :type="item.label === '重置' ? 'warning' : 'primary'"
              plain
              @click="runManualAction(item.action)"
            >
              {{ item.label }}
            </el-button>
          </div>
          <p class="mt-2 text-xs text-[var(--color-hudi-muted,#94a3b8)]">
            「同批次重复主键」用于复现边界场景 3：同一次写入里出现两次主键 1005，期望只新增 1 条记录，
            precombine 值大的那条胜出。
          </p>
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">HDFS 目录树（File Group → File Slice → Base / Log）</h2>
          <FileTreeView
            :table="table"
            :physical-files="lab.physicalFiles"
            :file-groups="lab.fileGroups"
            :selected-file="selectedFile"
            @select="onFileSelect"
          />
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">Timeline</h2>
          <TimelineView
            :timeline="lab.timeline"
            :pending="lab.pendingInstants"
            :archived="lab.state?.archivedInstants ?? []"
            :selected="selectedInstant"
            @select="onInstantSelect"
          />
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <div class="mb-2 flex items-center justify-between">
            <h2 class="text-sm font-semibold">数据快照（逻辑记录视图）</h2>
            <el-switch
              v-model="showTombstone"
              size="small"
              active-text="显示 tombstone"
              inactive-text="只看可见记录"
            />
          </div>
          <RecordTable
            :records="recordRows"
            :primary-key="table.primaryKey"
            :pre-combine-field="table.preCombineField || null"
            show-meta-fields
          />
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">执行前后状态对比</h2>
          <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span>基准</span>
            <el-select v-model="beforeInstant" size="small" class="w-56">
              <el-option v-for="o in checkpointOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span>对比</span>
            <el-select v-model="afterInstant" size="small" class="w-56">
              <el-option v-for="o in checkpointOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <span class="text-[var(--color-hudi-muted,#94a3b8)]">
              基准来自 state.checkpoints（每次成功提交都会打一个快照）
            </span>
          </div>
          <el-table :data="diffRows" size="small" border>
            <el-table-column prop="key" label="指标" />
            <el-table-column prop="before" label="执行前" width="90" />
            <el-table-column prop="after" label="执行后" width="90" />
            <el-table-column label="变化" width="90">
              <template #default="{ row }">
                <span :class="row.delta > 0 ? 'text-emerald-400' : row.delta < 0 ? 'text-rose-400' : ''">
                  {{ row.delta > 0 ? '+' : '' }}{{ row.delta }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </main>

      <!-- ---------------------------- 右栏 ---------------------------- -->
      <aside class="flex flex-col gap-3 xl:col-span-3 xl:min-h-0 xl:overflow-y-auto">
        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">参数</h2>
          <ControlPanel
            :controls="experiment?.controls ?? []"
            :values="controlValues"
            @update="onControlUpdate"
          />
          <p class="mt-2 text-xs text-[var(--color-hudi-muted,#94a3b8)]">
            修改「表类型 / 分区值 / precombine / 索引 / Bucket 数」会重建实验状态（清空当前执行结果并重新写入 3 条种子记录）。
          </p>
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">当前步骤的原理解释</h2>
          <div class="mb-2 text-xs text-[var(--color-hudi-muted,#94a3b8)]">
            <span v-if="lastEvent">
              {{ lastEvent.title }}
              <span v-if="lastEvent.instantTime"> · instant {{ lastEvent.instantTime }}</span>
            </span>
            <span v-else>尚未执行任何动作</span>
          </div>
          <p class="whitespace-pre-wrap text-xs leading-relaxed">{{ currentExplanation }}</p>
          <div v-if="lastEvent?.warnings?.length" class="mt-2 space-y-1">
            <el-alert
              v-for="(w, idx) in lastEvent.warnings"
              :key="idx"
              class="shrink-0"
              type="warning"
              :closable="false"
              :title="w"
            />
          </div>
        </section>

        <section
          class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
        >
          <h2 class="mb-2 text-sm font-semibold">版本证据</h2>
          <el-alert
            v-if="catalogEntry?.note"
            class="mb-2 shrink-0"
            type="warning"
            :closable="false"
            :title="`证据缺口：${catalogEntry.note}`"
          />
          <EvidencePanel :evidence-ids="evidenceIds" />
        </section>
      </aside>
    </div>

    <!-- ============================ 底部 Tab ============================ -->
    <section
      class="flex flex-col rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-2 xl:min-h-0 xl:flex-1"
    >
      <el-tabs v-model="activeTab" class="xl:min-h-0 xl:flex-1">
        <el-tab-pane label="SQL" name="sql">
          <div class="overflow-y-auto">
            <SqlPanel :blocks="sqlBlocks" @copy="onCopy" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="HDFS" name="hdfs">
          <div class="overflow-y-auto">
            <FileTreeView
              :table="table"
              :physical-files="lab.physicalFiles"
              :file-groups="lab.fileGroups"
              :selected-file="selectedFile"
              @select="onFileSelect"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="Timeline" name="timeline">
          <div class="space-y-3 overflow-y-auto">
            <TimelineView
              :timeline="lab.timeline"
              :pending="lab.pendingInstants"
              :archived="lab.state?.archivedInstants ?? []"
              :selected="selectedInstant"
              @select="onInstantSelect"
            />
            <TimelineTable :timeline="lab.timeline" @select="onInstantSelect" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="日志" name="logs">
          <div class="overflow-y-auto">
            <LogPanel :logs="allLogs" title="模拟执行日志" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="版本证据" name="evidence">
          <div class="overflow-y-auto">
            <EvidencePanel :evidence-ids="evidenceIds" />
          </div>
        </el-tab-pane>

        <el-tab-pane label="练习" name="quiz">
          <div class="overflow-y-auto">
            <QuizPanel :questions="experiment?.quiz ?? []" @submit="onQuizSubmit" />
          </div>
        </el-tab-pane>
      </el-tabs>
    </section>

    <!-- ============================ 历史回看 ============================ -->
    <el-drawer v-model="historyVisible" title="执行历史回看" size="520px">
      <div v-if="!lab.history.length" class="text-sm text-[var(--color-hudi-muted,#94a3b8)]">
        还没有任何执行记录。
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="(event, idx) in lab.history"
          :key="event.eventId + idx"
          class="cursor-pointer rounded border border-[var(--color-hudi-border,#1f2937)] p-2 text-xs"
          :class="idx === historyIndex ? 'bg-slate-700/50' : ''"
          @click="openHistory(idx)"
        >
          <div class="flex items-center gap-2">
            <el-tag size="small" :type="event.success ? 'success' : 'danger'">
              {{ event.success ? '成功' : '失败' }}
            </el-tag>
            <span class="font-medium">{{ event.title }}</span>
            <span class="text-[var(--color-hudi-muted,#94a3b8)]">{{ event.instantTime ?? '—' }}</span>
          </div>
          <div class="mt-1 text-[var(--color-hudi-muted,#94a3b8)]">
            {{ event.explanation.split('\n')[0] }}
          </div>
        </div>
      </div>
      <template v-if="historyDetail">
        <el-divider content-position="left">事件详情</el-divider>
        <pre
          class="whitespace-pre-wrap break-all rounded bg-black/40 p-2 font-mono text-[11px] leading-relaxed"
        >{{ historyDetail.logs.join('\n') }}</pre>
        <p class="mt-2 whitespace-pre-wrap text-xs leading-relaxed">{{ historyDetail.explanation }}</p>
      </template>
    </el-drawer>
  </div>
</template>
