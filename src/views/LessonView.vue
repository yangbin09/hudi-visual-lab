<script setup lang="ts">
/**
 * LessonView —— 80 个动画主题的统一页面
 * ---------------------------------------------------------------------------
 * 整改说明（2026-10-21）：
 *   整改前这个文件是 142 行的「压缩模板」：最长的一行 1522 字符，
 *   画布占首屏 70%、讲解只有 70px 高的 13px 文字，术语/目标/结论全部没有，
 *   进度也从不写入。本文件按下面的结构重写：
 *
 *   [导航]  → [课程头：标题 + 目标条] → [两栏主体：画布 | 术语栏]
 *   → [播放条] → [章节条] → [本课小结 + 自测 + 边界] → [上一/下一主题]
 *
 * 关键行为：
 *   · 打开主题即写入访问进度，播放到末尾记为「看完」，自测 ≥60 分记为「掌握」；
 *   · 「基础模式 / 工程师模式」是**真开关**：它同时改变讲解、画布、参数、详情默认页与失败模拟；
 *   · 详细的 HDFS / Timeline / 记录 / SQL / 证据从抽屉搬进页内 dock（见 LessonDock）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { CATALOG, getCatalogEntry, getExperimentById, MODULES } from '@/experiments/catalog'
import { MODEL_LABEL, visualLesson } from '@/experiments/visual/lessons'
import { compareLesson } from '@/experiments/visual/compareLessons'
import { buildLessonRun, defaultParameters, fileRecords, stateMetrics } from '@/engine/visual/scenarios'
import { useLessonPlayer } from '@/animation/useLessonPlayer'
import { useLabStore } from '@/app/stores/lab'
import { useLessonStore } from '@/app/stores/lesson'
import { buildSql, createTemplateContext, findTemplate } from '@/engine/templates'
import type { SqlBlock } from '@/engine/templates/types'

import VisualNav from '@/components/visual/VisualNav.vue'
import LessonObjectiveBar from '@/components/visual/LessonObjectiveBar.vue'
import LessonTermCards from '@/components/visual/LessonTermCards.vue'
import LessonLegend from '@/components/visual/LessonLegend.vue'
import LessonSummary from '@/components/visual/LessonSummary.vue'
import LessonDock from '@/components/lesson/LessonDock.vue'
import type { DockTab } from '@/components/lesson/types'
import LessonCanvas from '@/components/visual/LessonCanvas.vue'
import CompareLesson from '@/components/visual/CompareLesson.vue'
import IndexConfigWalkthrough from '@/components/visual/IndexConfigWalkthrough.vue'
import TeachingInspector from '@/components/visual/TeachingInspector.vue'
import EvidencePanel from '@/components/evidence/EvidencePanel.vue'

import type { HudiTableState } from '@/models/hudi'
import type { LessonParameters } from '@/experiments/visual/types'

const route = useRoute()
const router = useRouter()
const lab = useLabStore()
const lessonStore = useLessonStore()

const id = String(route.params.id)
const entry = getCatalogEntry(id)
const lesson = visualLesson(id)
/** B02 / B03 是双泳道对比主题：没有 VisualLesson，但有自己的一套交互 */
const compare = compareLesson(id)
const isCompare = computed(() => !!compare)

/** 场景快照（可被参数重置重建） */
const run = shallowRef(lesson ? buildLessonRun(lesson, defaultParameters(lesson)) : undefined)
const player = run.value ? useLessonPlayer(() => run.value!) : undefined
const params = ref<LessonParameters | undefined>(run.value?.parameters)
const draft = ref<LessonParameters | undefined>(params.value ? { ...params.value } : undefined)

/** 对比主题的状态与旁白（由 CompareLesson 回传，供详情区与统一讲解条使用） */
const compareState = ref<HudiTableState | null>(null)
const compareCaption = ref('')
const compareAmount = ref(compare?.amount ?? 200)
/** 对比主题的自测题沿用旧实验定义里已写好的 5 题 */
const compareQuiz = computed(() => (id === 'B02' ? (getExperimentById('B02')?.quiz ?? []) : []))
const compareObjectives = computed(() => (id === 'B02' ? (getExperimentById('B02')?.learningObjectives ?? []) : []))

const notice = ref('')
const drawer = ref('')
const inspection = ref<{ title: string; value: unknown }>()
const dialog = ref<HTMLDialogElement>()
const errorMessage = ref('')
const jobIndex = ref<'SIMPLE' | 'BUCKET'>('SIMPLE')
/** 页内详情区（dock）的当前分区与展开状态——写进 URL，便于分享与回退 */
const dockTab = ref<DockTab>((route.query.tab as DockTab) || 'explain')
const dockOpen = ref(true)
const dockEl = ref<HTMLElement>()
const canvasArea = ref<HTMLElement>()
let focusBefore: HTMLElement | null = null

/* -------------------------------------------------------------------------- */
/* 派生状态                                                                    */
/* -------------------------------------------------------------------------- */

const current = computed(() => player?.current.value ?? 0)
const frame = computed(() => player?.frame.value)
const state = computed(() => player?.state.value)
const stats = computed(() => (state.value ? stateMetrics(state.value) : undefined))
const moduleName = computed(() => MODULES.find((m) => m.id === entry?.moduleId)?.shortTitle ?? '实验')
const listIndex = CATALOG.findIndex((e) => e.id === id)
const previousLesson = CATALOG[listIndex - 1]
const nextLesson = CATALOG[listIndex + 1]

const visibleQuery = computed(() => {
  if (!run.value || !player) return undefined
  const available = run.value.frames.slice(0, current.value + (player.committed.value ? 1 : 0))
  return available.filter((f) => f.query).at(-1)?.query
})

const visibleQueryTrace = computed(() => {
  if (!run.value || !player) return undefined
  if (frame.value?.teaching?.kind === 'query') return frame.value.teaching
  return run.value.frames
    .slice(0, current.value + (player.committed.value ? 1 : 0))
    .filter((f) => f.teaching?.kind === 'query')
    .at(-1)?.teaching
})

const teachingMoment = computed(() => {
  if (!player?.started.value) return undefined
  const moments = player.moments.value
  return moments?.filter((m) => m.at <= player.fraction.value).at(-1) ?? moments?.[0]
})

/** 阶段条上的状态文字 */
const statusText = computed(() => {
  if (!player) return '准备就绪'
  if (player.playing.value) return '正在演示'
  if (player.done.value) return '演示完成'
  if (player.started.value) return '已暂停 · 可单步操作'
  return '准备就绪'
})

/** 阶段条上的操作提示 */
const hintText = computed(() => {
  if (id === 'E01') return '修改作业选项，重演并比较两种策略'
  if (lesson?.kind === 'flow' || lesson?.model === 'concept') return '点击组件查看解释'
  return '点击图形查看数据'
})

/** 讲解标题：教学要点优先，其次步骤标题 */
const explanationTitle = computed(() => {
  if (!player?.started.value) return '先看见变化，再展开原理'
  return teachingMoment.value?.title ?? frame.value?.step.title ?? ''
})

/** 讲解正文：教学要点优先 */
const stepCaption = computed(() => {
  if (isCompare.value) return compareCaption.value
  if (!player) return ''
  if (!player.started.value) return `点击「${lesson?.actionLabel ?? '开始演示'}」，先观察${lesson?.steps[0]?.title ?? '第一步'}。`
  if (id === 'E01') return configCaption.value
  if (frame.value?.error) return `本次被引擎拒绝：${frame.value.error}`
  return teachingMoment.value?.explanation ?? frame.value?.step.caption ?? ''
})

/** E01 的对照讲解（两种索引策略的差异） */
const configCaption = computed(() => {
  if (current.value === 3 && player && player.fraction.value < 0.86) {
    if (player.fraction.value < 0.36) {
      return `输入相同的主键 ${params.value?.recordKey}；先看当前作业采用哪种定位策略。`
    }
    if (player.fraction.value < 0.6) {
      return jobIndex.value === 'BUCKET'
        ? '当前采用 BUCKET：主键进入哈希计算，而不是匹配已有键的位置。'
        : '当前采用 SIMPLE：主键进入已有键与文件位置的匹配过程。'
    }
    return jobIndex.value === 'BUCKET'
      ? '教学算法对哈希值取模，余数就是桶号；点击公式可逐字符查看计算。'
      : '在示意的已有键列表中匹配相同 key，得到文件 B 的位置；这里不计算桶号。'
  }
  return [
    '表定义是 BUCKET：预期按主键计算桶，再定位该桶的 File Group。',
    `本案例假设作业采用手动选择的 ${jobIndex.value}；沿来源检查，不能仅凭报错文字判断表索引。`,
    jobIndex.value === 'BUCKET'
      ? '两份配置都是 BUCKET，已排除这个案例里的类型差异。'
      : '表定义 BUCKET，作业选项 SIMPLE：定位策略不一致，这是需要验证的线索。',
    jobIndex.value === 'BUCKET'
      ? '配置已对齐；观察主键计算桶号的路径。真实作业是否恢复，仍要重跑验证。'
      : 'SIMPLE 按键匹配位置，BUCKET 计算桶号。点击「对齐为 BUCKET 并重演」，观察策略如何改变。',
  ][current.value]
})

const evidenceIds = computed(() => [
  ...new Set([
    ...(entry?.evidenceIds ?? []),
    ...(isCompare.value ? ['EV-COMM-MOR', 'EV-R26-ART-SPARK3'] : []),
    ...(frame.value?.events.flatMap((e) => e.evidenceIds) ?? []),
  ]),
])

/** 对比主题的表状态（来自 CompareLesson 回传） */
const pageState = computed<HudiTableState | null>(() =>
  isCompare.value ? compareState.value : (state.value ?? null),
)

/** 主题对应的 SQL / Scala / Flink 模板 */
const templates = computed<SqlBlock[]>(() => {
  if (isCompare.value) {
    const t = pageState.value?.table
    if (!t) return []
    const ctx = createTemplateContext({
      qualifiedTable: `${t.databaseName}.${t.tableName}`,
      table: t.tableName,
      tablePath: t.tablePath,
      partitionValue: '2024-01-01',
    })
    return ['spark-create-table-mor', 'spark-upsert', 'spark-query-snapshot', 'spark-compaction-plan-only', 'spark-compaction-inline']
      .map((templateId) => {
        const template = findTemplate(templateId)
        return template ? { ...template, code: buildSql(template.language, templateId, ctx) } : undefined
      })
      .filter((item): item is SqlBlock => Boolean(item))
  }

  if (!lesson || !state.value || !params.value) return []
  const ids: string[] = lesson.templateIds?.length
    ? lesson.templateIds
    : lesson.kind === 'query'
      ? ['spark-query-snapshot', 'spark-query-read-optimized', 'spark-query-incremental', 'spark-query-time-travel']
      : lesson.kind === 'index'
        ? ['spark-create-table-cow', 'spark-upsert']
        : ['spark-create-table-cow', 'spark-upsert', 'spark-compaction-plan-only', 'spark-compaction-inline', 'spark-clean']

  const t = state.value.table
  const ctx = createTemplateContext({
    database: t.databaseName,
    table: t.tableName,
    qualifiedTable: `${t.databaseName}.${t.tableName}`,
    tablePath: t.tablePath,
    tableType: t.tableType === 'COPY_ON_WRITE' ? 'cow' : 'mor',
    primaryKey: t.primaryKey ?? '',
    preCombineField: t.preCombineField ?? '',
    partitionFields: t.partitionFields.join(','),
    partitionKey: t.partitionFields[0] ?? '',
    partitionValue: params.value.partition,
    recordKey: params.value.recordKey,
    indexType: t.indexType,
    beginInstantTime: run.value?.initial.timeline[0]?.instantTime ?? '',
    asOfInstant: run.value?.initial.checkpoints[0]?.instantTime ?? '',
  })
  return ids
    .map((templateId) => {
      const template = findTemplate(templateId)
      return template ? { ...template, code: buildSql(template.language, templateId, ctx) } : undefined
    })
    .filter((t): t is SqlBlock => Boolean(t))
})

/** 没有自带术语卡时，至少给出这组通用词 */
const fallbackTerms = [
  { term: 'File Group', def: '同一 File ID 下的一组文件版本。' },
  { term: 'File Slice', def: '一个 Base 加上若干 Log 的组合。' },
  { term: 'Base File', def: '列式存储的基准文件，读取时最完整。' },
  { term: 'Log File', def: '追加写的增量文件，记录本次更新。' },
  { term: 'Instant', def: '一次事务提交，Hudi 用时间戳标识。' },
  { term: 'Timeline', def: '记录所有事务的文件，是 Hudi 的元数据核心。' },
]

/* -------------------------------------------------------------------------- */
/* 交互                                                                        */
/* -------------------------------------------------------------------------- */

function changeJobIndex(index: 'SIMPLE' | 'BUCKET'): void {
  notice.value = ''
  jobIndex.value = index
  player?.reset()
  player?.play()
}

async function open(name: string): Promise<void> {
  player?.pause()
  if (!drawer.value) focusBefore = document.activeElement as HTMLElement
  drawer.value = name
  if (name === '参数') {
    draft.value = params.value ? { ...params.value } : undefined
    errorMessage.value = ''
  }
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
}

function close(): void {
  drawer.value = ''
  dialog.value?.close()
  focusBefore?.focus()
}

function inspect(title: string, value: unknown): void {
  inspection.value = { title, value }
  void open('查看对象')
}

function applyParameters(): void {
  if (!draft.value || !lesson || !player) return
  const p = draft.value
  const invalid =
    !p.recordKey.trim() ||
    p.recordKey.length > 40 ||
    !p.partition.trim() ||
    p.partition.length > 80 ||
    !Number.isFinite(p.amount) ||
    p.amount < 0 ||
    !Number.isInteger(p.bucketCount) ||
    p.bucketCount < 1 ||
    p.bucketCount > 12 ||
    !Number.isInteger(p.retention) ||
    p.retention < 1 ||
    p.retention > 10
  if (invalid) {
    errorMessage.value = '请输入有效参数：主键不能为空，金额不能为负，桶数 1–12，保留数 1–10。'
    return
  }
  try {
    const updated = buildLessonRun(lesson, {
      ...p,
      recordKey: p.recordKey.trim(),
      partition: p.partition.trim(),
    })
    player.reset()
    run.value = updated
    params.value = updated.parameters
    notice.value = '参数已应用，已重置到新的初始状态。'
    close()
  } catch (e) {
    errorMessage.value = `无法建立该场景：${e instanceof Error ? e.message : String(e)}`
  }
}

function applyCompareParameters(): void {
  const amount = Number(compareAmount.value)
  if (!Number.isFinite(amount) || amount < 0 || amount > 999999) {
    errorMessage.value = '请输入有效金额：0 – 999999。'
    compareAmount.value = compare?.amount ?? 200
    return
  }
  errorMessage.value = ''
  notice.value = `更新金额已改为 ${amount}，下一次「Upsert 更新记录」生效。`
  close()
}

function toggle(): void {
  notice.value = ''
  if (player?.playing.value) player.pause()
  else player?.play()
}

/** 工程师模式：模拟一次失败（仅对支持 failureAt 的机制示意主题有效） */
function simulateFailure(): void {
  if (!lesson || !player || !params.value) return
  if (!lesson.controls.includes('failureAt')) {
    notice.value = '本主题没有可阻断的关口，失败模拟不可用。'
    return
  }
  const next = { ...params.value, failureAt: Math.min(lesson.nodes.length - 1, params.value.failureAt + 1) }
  try {
    const updated = buildLessonRun(lesson, next)
    player.reset()
    run.value = updated
    params.value = updated.parameters
    player.play()
    notice.value = `已在「${lesson.nodes[next.failureAt]}」处设置阻断，重演中。`
  } catch (e) {
    errorMessage.value = `无法建立失败场景：${e instanceof Error ? e.message : String(e)}`
  }
}

function keyboard(e: KeyboardEvent): void {
  const target = e.target as HTMLElement
  if (drawer.value || target.closest('button,a,input,select,textarea,[role="button"]')) return
  if (e.code === 'Space') {
    e.preventDefault()
    toggle()
  }
  if (e.code === 'ArrowRight') {
    e.preventDefault()
    player?.next()
  }
  if (e.code === 'ArrowLeft') {
    e.preventDefault()
    player?.back()
  }
}

function goGlossary(term: string): void {
  void router.push(`/glossary?term=${encodeURIComponent(term)}`)
}

/** 打开页内详情区并滚到它 */
function openDock(tab: DockTab = 'explain'): void {
  dockTab.value = tab
  dockOpen.value = true
  void nextTick(() => dockEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

/** dock 分区写回 URL（?tab=data） */
watch(dockTab, (tab) => {
  if (route.query.tab === tab) return
  void router.replace({ query: { ...route.query, tab } })
})

/** 自测得分 → 进度 */
function onScored(score: number): void {
  lessonStore.setQuizScore(id, score)
  notice.value = score >= 60 ? `自测 ${score} 分，本主题已记为「已掌握」。` : `自测 ${score} 分，再看一遍要点就能过。`
}

/* -------------------------------------------------------------------------- */
/* 进度写入                                                                    */
/* -------------------------------------------------------------------------- */

onMounted(() => {
  window.addEventListener('keydown', keyboard)
  if (isCompare.value) {
    // 对比类主题同样写入访问进度
    lessonStore.markVisited(id)
    return
  }
  if (lesson) {
    lessonStore.markVisited(id)
    const saved = lessonStore.entry(id)
    // 有上次进度时恢复到那一步（不自动播放）
    if (saved.step > 0 && saved.step < (player?.total.value ?? 0)) {
      player?.seek(saved.step + 0.99)
    }
  }
  // 移动端画布是 900px 宽的横向滚动容器：默认停在画布中部（内容最密集的地方）
  void nextTick(() => {
    const area = canvasArea.value
    if (!area || window.innerWidth > 550) return
    area.scrollLeft = Math.max(0, (area.scrollWidth - area.clientWidth) / 2)
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', keyboard)
  if (lesson && player) {
    lessonStore.savePosition(id, player.position.value, player.current.value)
  }
})

// 播放到末尾 → 记为「看完」
watch(
  () => player?.done.value,
  (done) => {
    if (done && lesson) lessonStore.markWatched(id)
  },
)
</script>

<template>
  <div class="visual-lab lesson-page" :class="{ 'vl-light': !lab.darkMode, 'vl-reduced': player?.reduced.value }">
    <VisualNav
      :crumbs="[
        { text: '全部主题', to: '/catalog' },
        { text: `${moduleName} / ${id}` },
      ]"
      show-mode
      :show-params="!!lesson || isCompare"
      @params="open('参数')"
    />

    <!-- 对比类主题（B02 / B03）：没有 VisualLesson，但共用同一套页面骨架 -->
    <main v-if="isCompare && compare" class="lesson-main">
      <div class="lesson-heading">
        <div>
          <span class="vl-eyebrow">{{ id }} · {{ moduleName }}</span>
          <h1>{{ entry?.title }}</h1>
        </div>
        <button class="lesson-model" @click="openDock('data')">数据 / 代码 / 依据 ↗</button>
      </div>

      <LessonObjectiveBar :entry="entry" :objective="compare.objective" :prerequisites="compare.prerequisites" @glossary="goGlossary" />

      <div class="lesson-body">
        <div class="lesson-stage-col">
          <CompareLesson
            :topic-id="id"
            :question="compare.question"
            :subtitle="compare.subtitle"
            :amount="compareAmount"
            :engineer="lessonStore.engineerMode"
            @inspect="inspect"
            @state="compareState = $event"
            @caption="compareCaption = $event"
            @watched="lessonStore.markWatched(id)"
          />
          <LessonLegend class="lesson-legend" />
        </div>

        <aside class="lesson-side">
          <LessonTermCards :fallback="compare.glossary" />

          <section v-if="compareObjectives.length" class="vl-side-block">
            <h2 class="vl-side-title">学完你能</h2>
            <ol class="vl-objectives">
              <li v-for="(item, i) in compareObjectives" :key="i">{{ item }}</li>
            </ol>
          </section>

          <section v-if="lessonStore.engineerMode" class="vl-side-block">
            <h2 class="vl-side-title">当前状态</h2>
            <p class="vl-side-text">
              物理文件 {{ pageState?.physicalFiles.length ?? 0 }} 个 ·
              Timeline Instant {{ pageState?.timeline.length ?? 0 }} 条<br />
              数据分区展示 MOR 泳道；COW 泳道在画布左侧并列对照。
            </p>
          </section>
        </aside>
      </div>

      <section ref="dockEl" class="lesson-dock-wrap" aria-label="详情区">
        <LessonDock
          v-model:active-tab="dockTab"
          v-model:open="dockOpen"
          :state="pageState"
          :lesson="undefined"
          :lesson-id="id"
          :templates="templates"
          :evidence-ids="evidenceIds"
          :model-label="'双路径对比'"
          :evidence-level="entry?.evidenceLevel"
          :support-state="entry?.supportState"
          :note="entry?.note"
          :limitations="compare.limitations"
        />
      </section>

      <LessonSummary
        :lesson-id="id"
        :previous-id="previousLesson?.id"
        :next-id="nextLesson?.id"
        :takeaway="compare.takeaway"
        :limitations="compare.limitations"
        :questions="compareQuiz"
        @scored="onScored"
      />

      <div class="lesson-bottom">
        <span v-if="notice" role="status" data-testid="lesson-notice">{{ notice }}</span>
        <span v-else>双路径对比 · 同一份数据、同一动作，看 COW 与 MOR 怎么落盘</span>
        <div>
          <RouterLink v-if="previousLesson" :to="`/experiment/${previousLesson.id}`">← 上一主题</RouterLink>
          <RouterLink v-if="nextLesson" :to="`/experiment/${nextLesson.id}`">下一主题 →</RouterLink>
        </div>
      </div>
    </main>

    <main v-else-if="lesson && player && frame && state && params && stats" class="lesson-main">
      <div class="lesson-heading">
        <div>
          <span class="vl-eyebrow">{{ id }} · {{ moduleName }}</span>
          <h1>{{ entry?.title }}</h1>
        </div>
        <button class="lesson-model" @click="openDock('explain')">{{ MODEL_LABEL[lesson.model] }} ↗</button>
      </div>

      <LessonObjectiveBar :entry="entry" :lesson="lesson" @glossary="goGlossary" />

      <div class="lesson-body">
        <div class="lesson-stage-col">
        <section class="lesson-stage" aria-label="交互动画画布">
          <div class="lesson-stage-bar">
            <span><i class="vl-dot"></i>{{ statusText }}</span>
            <span>{{ hintText }}</span>
            <button @click="openDock('data')">数据 / 代码 / 依据 ↗</button>
          </div>

          <div ref="canvasArea" class="lesson-canvas-area">
            <IndexConfigWalkthrough
              v-if="id === 'E01'"
              :job-index="jobIndex"
              :current="current"
              :progress="player.fraction.value"
              :started="player.started.value"
              :parameters="params"
              @change="changeJobIndex"
              @inspect="inspect"
            />
            <LessonCanvas
              v-else
              :lesson="lesson"
              :frame="frame"
              :state="state"
              :query="visibleQuery"
              :query-trace="visibleQueryTrace"
              :progress="player.fraction.value"
              :current="current"
              :started="player.started.value"
              :parameters="params"
              @inspect="inspect"
            />
          </div>

          <div class="lesson-explanation" aria-live="polite">
            <span class="lesson-step">{{ String(current + 1).padStart(2, '0') }}</span>
            <div class="lesson-explanation-text">
              <small>{{ explanationTitle }}</small>
              <p>{{ stepCaption }}</p>
            </div>
            <ul class="lesson-metrics">
              <li><b>{{ stats.records }}</b><span>可见记录</span></li>
              <li><b>{{ stats.active }}</b><span>有效文件</span></li>
              <li><b>{{ stats.logs }}</b><span>Log</span></li>
            </ul>
          </div>
        </section>
        <p class="vl-canvas-hint">← 左右滑动查看完整画布 →</p>
        <LessonLegend class="lesson-legend" />
        </div>

        <aside class="lesson-side">
          <LessonTermCards :lesson="lesson" :fallback="fallbackTerms" />

          <section v-if="lessonStore.engineerMode" class="vl-side-block">
            <h2 class="vl-side-title">本步引擎动作</h2>
            <p class="vl-side-text">
              动作：{{ frame.step.operation ?? '机制观察' }}<br />
              新增文件：{{ frame.added.map((f) => f.fileName).join('、') || '无' }}<br />
              淘汰文件：{{ frame.removed.map((f) => f.fileName).join('、') || '无' }}
            </p>
          </section>
        </aside>
      </div>

      <div class="lesson-playbar" aria-label="动画播放控件">
        <button class="lesson-primary" :aria-label="player.playing.value ? '暂停演示' : '播放演示'" @click="toggle">
          {{ player.playing.value ? 'Ⅱ 暂停' : !player.started.value ? '▶ ' + lesson.actionLabel : player.done.value ? '↺ 重放演示' : '▶ 继续播放' }}
        </button>
        <button aria-label="上一步" :disabled="player.position.value === 0" @click="player.back">|◀</button>
        <button aria-label="下一步" :disabled="player.done.value" @click="player.next">▶|</button>
        <input
          type="range"
          min="0"
          :max="player.total.value"
          :value="player.position.value"
          step=".01"
          aria-label="动画进度"
          @input="player.seek(Number(($event.target as HTMLInputElement).value))"
        />
        <select v-model.number="player.speed.value" aria-label="播放速度">
          <option :value="0.5">0.5×</option>
          <option :value="1">1×</option>
          <option :value="2">2×</option>
        </select>
        <button @click="player.reset(); notice = ''">重置</button>
        <button :disabled="player.done.value" @click="player.finish">跳到结果</button>
        <button v-if="lessonStore.engineerMode" class="lesson-failure" @click="simulateFailure">模拟失败</button>
      </div>

      <nav class="lesson-chapters" :class="{ compact: false }" aria-label="动画步骤">
        <button
          v-for="(item, i) in lesson.steps"
          :key="i"
          :class="{ active: current === i && player.started.value }"
          :aria-current="current === i ? 'step' : undefined"
          @click="player.seek(i === lesson.steps.length - 1 ? player.total.value : i + 0.99)"
        >
          <span>{{ i + 1 }}</span>{{ item.title }}
        </button>
      </nav>

      <section ref="dockEl" class="lesson-dock-wrap" aria-label="详情区">
        <LessonDock
          v-model:active-tab="dockTab"
          v-model:open="dockOpen"
          :state="state"
          :frame="frame"
          :lesson="lesson"
          :lesson-id="id"
          :templates="templates"
          :evidence-ids="evidenceIds"
          :progress="player.fraction.value"
          :model-label="MODEL_LABEL[lesson.model]"
          :evidence-level="entry?.evidenceLevel"
          :support-state="entry?.supportState"
          :note="entry?.note"
          :limitations="lesson.limitations"
        />
      </section>

      <LessonSummary
        :lesson="lesson"
        :lesson-id="id"
        :previous-id="previousLesson?.id"
        :next-id="nextLesson?.id"
        @scored="onScored"
      />

      <div class="lesson-bottom">
        <span v-if="notice" role="status" data-testid="lesson-notice">{{ notice }}</span>
        <span v-else-if="lesson.model === 'concept'">机制示意 · 图形节点不代表真实服务的执行状态</span>
        <span v-else>可见记录 {{ stats.records }} · 有效文件 {{ stats.active }} · Log {{ stats.logs }}</span>
        <div>
          <RouterLink v-if="previousLesson" :to="`/experiment/${previousLesson.id}`">← 上一主题</RouterLink>
          <RouterLink v-if="nextLesson" :to="`/experiment/${nextLesson.id}`">下一主题 →</RouterLink>
        </div>
      </div>
    </main>

    <main v-else class="lesson-not-found">
      <h1>没有找到这个动画实验</h1>
      <RouterLink to="/catalog">返回全部动画</RouterLink>
    </main>

    <footer class="vl-footer">
      <span>HUAWEI MRS r26 · 纯浏览器模拟</span>
      <button @click="openDock('evidence')">
        {{ entry?.supportState === 'unverified' || entry?.evidenceLevel === 'E0' ? '待验证 · 查看依据 ↗' : '教学模型 · r26 行为边界 ↗' }}
      </button>
      <span>空格播放 / 暂停 · ← → 单步</span>
    </footer>

    <dialog ref="dialog" class="vl-dialog lesson-dialog" @cancel.prevent="close" @click="(e) => { if (e.target === dialog) close() }">
      <div class="vl-drawer">
        <header>
          <h2>{{ drawer === '查看对象' ? inspection?.title : drawer }}</h2>
          <button aria-label="关闭详情" @click="close">✕</button>
        </header>

        <!-- 参数面板：对比类主题只有「更新后的金额」一个参数 -->
        <form v-if="drawer === '参数' && isCompare" class="lesson-settings" @submit.prevent="applyCompareParameters">
          <p>应用后立即用新的金额重放一次更新；不改变其它模型参数。</p>
          <label>
            更新后的金额
            <input v-model.number="compareAmount" type="number" min="0" max="999999" required />
          </label>
          <p class="lesson-error" v-if="errorMessage" role="alert">{{ errorMessage }}</p>
          <button class="lesson-primary" type="submit">应用参数并重置</button>
        </form>

        <!-- 参数面板 -->
        <form v-else-if="drawer === '参数' && draft && lesson" class="lesson-settings" @submit.prevent="applyParameters">
          <p>应用后重新建立场景并重置演示，不会在播放中途替换数据。</p>
          <template v-for="control in lesson.controls" :key="control">
            <label v-if="control === 'recordKey'">
              记录主键
              <input v-model="draft.recordKey" maxlength="40" required />
            </label>
            <label v-else-if="control === 'amount'">
              更新金额
              <input v-model.number="draft.amount" type="number" min="0" max="999999" required />
            </label>
            <label v-else-if="control === 'bucketCount'">
              Bucket 数量
              <input v-model.number="draft.bucketCount" type="number" min="1" max="12" required />
            </label>
            <label v-else-if="control === 'partition'">
              分区值
              <input v-model="draft.partition" maxlength="80" required />
            </label>
            <label v-else-if="control === 'retention'">
              保留提交数量
              <input v-model.number="draft.retention" type="number" min="1" max="10" required />
            </label>
            <label v-else-if="control === 'tableType'">
              表类型
              <select v-model="draft.tableType">
                <option value="COPY_ON_WRITE">COW</option>
                <option value="MERGE_ON_READ">MOR</option>
              </select>
            </label>
            <label v-else-if="control === 'failureAt'">
              机制示意的阻断关口
              <select v-model.number="draft.failureAt">
                <option :value="-1">不设置阻断</option>
                <option v-for="(node, i) in lesson.nodes" :key="i" :value="i">{{ node }}</option>
              </select>
            </label>
          </template>
          <label class="lesson-checkbox">
            <input v-model="player!.reduced.value" type="checkbox" @change="player?.pause" />减少动态效果，改用单步观察
          </label>
          <p v-if="errorMessage" role="alert" class="lesson-error">{{ errorMessage }}</p>
          <button class="lesson-primary" type="submit">应用参数并重置</button>
        </form>

        <TeachingInspector v-else-if="drawer === '查看对象'" :value="inspection?.value" />

        <!-- 补充信息：详细视图已搬到页内 dock，这里只留日志与原始查询结果 -->
        <template v-else-if="lesson && state && frame">
          <h3>运行日志</h3>
          <p>以下是截至当前展示位置的本地模拟日志，未连接真实集群。</p>
          <article v-for="(item, i) in run!.frames.slice(0, current + (player!.committed.value ? 1 : 0))" :key="i">
            <h4>{{ i + 1 }} · {{ item.step.title }}</h4>
            <pre>{{ item.logs.join('\n') || '机制观察，无执行日志。' }}</pre>
          </article>
          <h3 v-if="visibleQuery">查询结果（原始）</h3>
          <pre v-if="visibleQuery">{{ JSON.stringify(visibleQuery, null, 2) }}</pre>
          <p class="lesson-hint">
            HDFS 文件清单、Timeline、SQL 与源码映射请看页面下方的
            <button type="button" class="lesson-link" @click="close(); openDock('data')">详情区</button>。
          </p>
        </template>
      </div>
    </dialog>
  </div>
</template>

<style src="../styles/visual-lab.css"></style>
<style src="../styles/lessons.css"></style>

<style scoped>
.lesson-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}
.lesson-stage-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.lesson-legend {
  margin-top: 10px;
}
/* 画布必须完整落在舞台里：绝对定位铺满画布区，SVG 自身按 viewBox 等比缩放，不会被裁切 */
.lesson-canvas-area {
  position: relative;
}
.lesson-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
@media (max-width: 550px) {
  .lesson-canvas-area {
    position: static;
  }
  .lesson-canvas {
    position: static;
    inset: auto;
    width: 900px;
    min-width: 900px;
    height: auto;
    flex: 0 0 900px;
  }
}
.lesson-side {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.vl-side-block {
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  padding: 12px 14px;
}
.vl-side-title {
  font-size: var(--vl-fs-xs, 12px);
  letter-spacing: 1px;
  color: var(--vl-muted);
  margin: 0 0 8px;
}
.vl-side-text {
  margin: 0;
  font-size: var(--vl-fs-xs, 12px);
  line-height: 1.8;
  color: var(--vl-muted);
  word-break: break-all;
}
.lesson-metrics {
  list-style: none;
  display: flex;
  gap: 16px;
  margin: 0 0 0 auto;
  padding: 0;
}
.lesson-metrics li {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.3;
}
.lesson-metrics b {
  font-size: var(--vl-fs-lg, 16px);
  color: var(--vl-ink);
}
.lesson-metrics span {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.lesson-explanation-text {
  min-width: 0;
}
.lesson-failure {
  border-color: var(--vl-warn, #d9a441) !important;
  color: var(--vl-warn, #d9a441) !important;
}
@media (max-width: 1100px) {
  .lesson-body {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 850px) {
  .lesson-metrics {
    display: none;
  }
}
/* 触屏：详情区与播放控件不小于 44×44 */
@media (pointer: coarse) {
  .lesson-playbar button,
  .lesson-playbar select,
  .lesson-chapters button,
  .lesson-stage-bar button {
    min-height: 44px;
  }
  .lesson-chapters button {
    min-width: 44px;
  }
  .lesson-dock-wrap :deep(.dock-collapse) {
    min-height: 44px;
  }
}
</style>
