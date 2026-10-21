<script setup lang="ts">
/**
 * LessonDock —— 页内详情区（不是 dialog / drawer）
 * ---------------------------------------------------------------------------
 * 设计目标：把原来藏在 620px 抽屉第 2 层、以及死代码里的详细视图，
 * 变成主题页里一处可展开、可寻址（tab 受控）的常驻区域。
 *
 * 四个固定分区：
 *   解释   —— 本步现象 / 原因 / 关键数字 / 变化文件（LessonExplainTab）
 *   数据   —— HDFS 文件树 / 逻辑记录 / Timeline 表格 + 时间轴 / Compaction 计划（LessonDataTab）
 *   代码   —— SQL / Scala / Flink / Shell 模板 + 源码映射（LessonCodeTab）
 *   依据   —— 证据条目 + r26 差距 / 边界说明
 *
 * 受控约定（都向后兼容，不传就自己管内部状态）：
 *   · v-model:active-tab="tab"   控制当前分区
 *   · v-model:open="open"        控制展开 / 收起
 *   · v-model:quiz-score="score" 控制自测得分（null = 未作答）
 *
 * 只使用 --vl-* 设计变量（缺省回退到全局 --color-hudi-*），不写死色值。
 */
import { computed, nextTick, ref } from 'vue'
import DockPanel from './DockPanel.vue'
import LessonExplainTab from './LessonExplainTab.vue'
import LessonDataTab from './LessonDataTab.vue'
import LessonCodeTab from './LessonCodeTab.vue'
import QuizPanel from '@/components/quiz/QuizPanel.vue'
import EvidencePanel from '@/components/evidence/EvidencePanel.vue'
import type { SqlBlock } from '@/engine/templates/types'
import type { LessonFrame } from '@/engine/visual/scenarios'
import type { HudiInstant, HudiPhysicalFile, HudiRecord, HudiTableState } from '@/models/hudi'
import type { QuizQuestion } from '@/models/simulation'
import type { VisualLesson } from '@/experiments/visual/types'
import {
  CAPABILITY_LABEL,
  EVIDENCE_LEVEL_LABEL,
  type CapabilityState,
  type EvidenceLevel,
} from '@/models/evidence'
import { DOCK_TABS, defaultSourceMap, type DockTab, type LessonSourceEntry } from './types'

const props = withDefaults(
  defineProps<{
    /** 当前展示位置对应的表状态（没有时数据分区显示空态） */
    state?: HudiTableState | null
    /** 当前步骤（解释分区的数据源） */
    frame?: LessonFrame | null
    /** 主题定义 */
    lesson?: VisualLesson | null
    /** 主题编号，例如 'B05' */
    lessonId?: string
    /** 已填好参数的 SQL / Scala / Flink / Shell 模板 */
    templates?: SqlBlock[]
    /** 本主题关联的证据 id */
    evidenceIds?: string[]
    /** 自测题（没有时不渲染自测区） */
    quiz?: QuizQuestion[]
    /** 受控当前分区；不传则由组件内部管理 */
    activeTab?: DockTab
    /** 受控展开状态；不传则由组件内部管理（默认展开） */
    open?: boolean
    /** 受控自测得分；null 表示未作答 */
    quizScore?: number | null
    /** 当前播放进度 0–1，用于高亮教学节点 */
    progress?: number
    /** 「引擎驱动 / 引擎 + 机制示意 / 机制示意」 */
    modelLabel?: string
    /** 证据等级（E0–E4） */
    evidenceLevel?: EvidenceLevel | string
    /** r26 支持状态 */
    supportState?: CapabilityState | string
    /** 主题的一句话证据缺口说明 */
    note?: string
    /** 本主题明确列出的限制 / 待验证点 */
    limitations?: string[]
    /** 覆盖默认源码映射 */
    sourceMap?: LessonSourceEntry[]
    /** HDFS 文件树里高亮的文件 */
    selectedFile?: string
    /** 记录表是否展示 _hoodie_* 元字段（默认展示） */
    showMetaFields?: boolean
    /** 是否显示收起按钮 */
    collapsible?: boolean
  }>(),
  {
    state: null,
    frame: null,
    lesson: null,
    lessonId: '',
    templates: () => [],
    evidenceIds: () => [],
    quiz: () => [],
    // 注意：布尔 prop 不写默认值时，Vue 会把“未传”转成 false。
    // 这里显式给 undefined，才能区分“父组件没传（内部管理）”与“父组件传了 false（收起）”。
    open: undefined,
    progress: 1,
    modelLabel: '',
    note: '',
    limitations: () => [],
    selectedFile: '',
    showMetaFields: true,
    collapsible: true,
  },
)

const emit = defineEmits<{
  'update:activeTab': [tab: DockTab]
  'update:open': [open: boolean]
  'update:quizScore': [score: number | null]
  'select-file': [file: HudiPhysicalFile]
  'select-record': [record: HudiRecord]
  'select-instant': [instant: HudiInstant]
  'quiz-submit': [score: number]
  copy: [code: string]
}>()

/* -------------------------------------------------------------------------- */
/* 受控状态                                                                      */
/* -------------------------------------------------------------------------- */

const internalTab = ref<DockTab>('explain')
const currentTab = computed<DockTab>(() => props.activeTab ?? internalTab.value)

const internalOpen = ref(true)
const isOpen = computed<boolean>(() => props.open ?? internalOpen.value)

const internalQuizScore = ref<number | null>(null)
const quizScoreValue = computed<number | null>(() =>
  props.quizScore !== undefined ? props.quizScore : internalQuizScore.value,
)

function selectTab(tab: DockTab): void {
  if (props.activeTab === undefined) internalTab.value = tab
  emit('update:activeTab', tab)
}

function toggle(): void {
  if (!props.collapsible) return
  const next = !isOpen.value
  if (props.open === undefined) internalOpen.value = next
  emit('update:open', next)
}

/** Tab 键在 4 个分区之间左右移动（WAI-ARIA tabs 模式） */
function moveTab(step: number): void {
  const index = DOCK_TABS.findIndex((tab) => tab.key === currentTab.value)
  const base = index < 0 ? 0 : index
  const next = DOCK_TABS[(base + step + DOCK_TABS.length) % DOCK_TABS.length]
  if (!next) return
  selectTab(next.key)
  void nextTick(() => {
    if (typeof document === 'undefined') return
    document.getElementById(`lesson-dock-tab-${next.key}`)?.focus()
  })
}

function onQuizModelValue(score: number | null): void {
  if (props.quizScore === undefined) internalQuizScore.value = score
  emit('update:quizScore', score)
}

function onQuizSubmit(score: number): void {
  onQuizModelValue(score)
  emit('quiz-submit', score)
}

/* -------------------------------------------------------------------------- */
/* 依据分区                                                                      */
/* -------------------------------------------------------------------------- */

const evidenceLevelLabel = computed<string>(() => {
  const level = props.evidenceLevel
  if (!level) return ''
  return EVIDENCE_LEVEL_LABEL[level as EvidenceLevel] ?? String(level)
})

const supportStateLabel = computed<string>(() => {
  const state = props.supportState
  if (!state) return ''
  return CAPABILITY_LABEL[state as CapabilityState] ?? String(state)
})

const limitationList = computed<string[]>(() => (props.limitations ?? []).filter(Boolean))

const hasBoundaryInfo = computed<boolean>(
  () => Boolean(props.note) || limitationList.value.length > 0 || Boolean(props.evidenceLevel) || Boolean(props.supportState),
)

const sourceMapEntries = computed<LessonSourceEntry[]>(() =>
  props.sourceMap && props.sourceMap.length ? props.sourceMap : defaultSourceMap(props.lesson?.kind),
)

const dockTitle = computed<string>(() => (props.lessonId ? `${props.lessonId} · 详情` : '详情'))

const firstTab = DOCK_TABS[0] ?? { key: 'explain' as DockTab }
const lastTab = DOCK_TABS[DOCK_TABS.length - 1] ?? firstTab
</script>

<template>
  <section
    class="lesson-dock"
    :class="{ 'is-collapsed': !isOpen }"
    data-testid="lesson-dock"
    :data-lesson-id="lessonId || undefined"
  >
    <header class="dock-head">
      <div class="dock-head-main">
        <h2 class="dock-title">{{ dockTitle }}</h2>
        <span class="dock-sub">本步数据、代码与依据都在这里，不用再开抽屉</span>
      </div>
      <button
        v-if="collapsible"
        type="button"
        class="dock-collapse"
        :aria-expanded="isOpen"
        :aria-label="isOpen ? '收起详情区' : '展开详情区'"
        @click="toggle"
      >
        {{ isOpen ? '收起 ▾' : '展开 ▸' }}
      </button>
    </header>

    <div v-show="isOpen" class="dock-body">
      <div class="dock-tablist" role="tablist" aria-label="详情分区">
        <button
          v-for="tab in DOCK_TABS"
          :id="`lesson-dock-tab-${tab.key}`"
          :key="tab.key"
          type="button"
          role="tab"
          class="dock-tab"
          :class="{ active: currentTab === tab.key }"
          :aria-selected="currentTab === tab.key"
          :aria-controls="`lesson-dock-panel-${tab.key}`"
          :tabindex="currentTab === tab.key ? 0 : -1"
          @click="selectTab(tab.key)"
          @keydown.right.prevent="moveTab(1)"
          @keydown.left.prevent="moveTab(-1)"
          @keydown.home.prevent="selectTab(firstTab.key)"
          @keydown.end.prevent="selectTab(lastTab.key)"
        >
          <span class="dock-tab-label">{{ tab.label }}</span>
          <span class="dock-tab-hint">{{ tab.hint }}</span>
        </button>
      </div>

      <div class="dock-content">
        <!-- ============================ 解释 ============================ -->
        <div
          v-if="currentTab === 'explain'"
          id="lesson-dock-panel-explain"
          role="tabpanel"
          aria-labelledby="lesson-dock-tab-explain"
        >
          <LessonExplainTab
            :frame="frame"
            :lesson="lesson"
            :progress="progress"
            :model-label="modelLabel"
          />

          <DockPanel
            v-if="quiz.length"
            class="dock-quiz"
            title="自测"
            :hint="`${quiz.length} 题 · 多选题需完全选对`"
            description="做完再提交；得分会通过 quiz-submit 事件交给主题页记录。"
          >
            <QuizPanel
              :questions="quiz"
              :model-value="quizScoreValue"
              @submit="onQuizSubmit"
              @update:model-value="onQuizModelValue"
            />
          </DockPanel>
        </div>

        <!-- ============================ 数据 ============================ -->
        <div
          v-else-if="currentTab === 'data'"
          id="lesson-dock-panel-data"
          role="tabpanel"
          aria-labelledby="lesson-dock-tab-data"
        >
          <LessonDataTab
            :state="state"
            :selected-file="selectedFile"
            :show-meta-fields="showMetaFields"
            @select-file="emit('select-file', $event)"
            @select-record="emit('select-record', $event)"
            @select-instant="emit('select-instant', $event)"
          />
        </div>

        <!-- ============================ 代码 ============================ -->
        <div
          v-else-if="currentTab === 'code'"
          id="lesson-dock-panel-code"
          role="tabpanel"
          aria-labelledby="lesson-dock-tab-code"
        >
          <LessonCodeTab
            :templates="templates"
            :lesson="lesson"
            :limitation="lesson?.limitation ?? ''"
            @copy="emit('copy', $event)"
          />
        </div>

        <!-- ============================ 依据 ============================ -->
        <div
          v-else
          id="lesson-dock-panel-evidence"
          role="tabpanel"
          aria-labelledby="lesson-dock-tab-evidence"
        >
          <div class="evidence-tab">
            <DockPanel
              title="边界与缺口"
              :hint="evidenceLevel ? `证据等级 ${evidenceLevel}` : undefined"
              description="先看这段，再看证据条目：哪些结论有文档支撑、哪些仍需 r26 实测。"
              :empty="!hasBoundaryInfo"
              empty-title="本主题没有额外的边界说明"
              empty-text="默认按现有教学模型展示；r26 的真实文件与事务行为仍需现场核对。"
            >
              <div v-if="evidenceLevel || supportState || modelLabel" class="evidence-badges">
                <span v-if="evidenceLevel" class="evidence-badge">
                  证据 {{ evidenceLevel }}<template v-if="evidenceLevelLabel"> · {{ evidenceLevelLabel }}</template>
                </span>
                <span v-if="supportState" class="evidence-badge">
                  支持状态：{{ supportStateLabel || supportState }}
                </span>
                <span v-if="modelLabel" class="evidence-badge">{{ modelLabel }}</span>
              </div>
              <p v-if="note" class="evidence-note">{{ note }}</p>
              <div v-if="limitationList.length" class="evidence-limit">
                <p class="evidence-limit-title">本主题明确列出的限制 / 待验证点</p>
                <ul class="evidence-limit-list">
                  <li v-for="(item, index) in limitationList" :key="index">{{ item }}</li>
                </ul>
              </div>
            </DockPanel>

            <DockPanel
              title="证据条目"
              description="每条结论都能追到来源；E0 表示尚无直接依据，不代表平台连过真实集群。"
            >
              <EvidencePanel :evidence-ids="evidenceIds" />
            </DockPanel>

            <DockPanel
              title="源码映射（摘要）"
              description="完整映射在「代码」分区；这里只保留与结论直接相关的入口。"
            >
              <ul class="evidence-source-list">
                <li v-for="entry in sourceMapEntries.slice(0, 3)" :key="`${entry.path}#${entry.symbol}`">
                  <code>{{ entry.path }}</code>
                  <span> → {{ entry.symbol }}</span>
                </li>
              </ul>
            </DockPanel>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.lesson-dock {
  min-width: 0;
  border: 1px solid var(--vl-line, var(--color-hudi-border));
  border-radius: 12px;
  background: var(--vl-panel, var(--color-hudi-panel));
  color: var(--vl-ink, var(--color-hudi-text));
  overflow: hidden;
}

.dock-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--vl-line, var(--color-hudi-border));
  padding: 10px 14px;
}

.dock-head-main {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 10px;
  row-gap: 2px;
}

.dock-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.dock-sub {
  ont-size: 12px;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.dock-collapse {
  flex: 0 0 auto;
  border: 1px solid var(--vl-line, var(--color-hudi-border));
  border-radius: 6px;
  background: transparent;
  padding: 4px 10px;
  ont-size: 12px;
  color: var(--vl-muted, var(--color-hudi-muted));
  cursor: pointer;
}

.dock-collapse:hover {
  color: var(--vl-ink, var(--color-hudi-text));
  border-color: var(--vl-ink, var(--color-hudi-text));
}

.dock-tablist {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  border-bottom: 1px solid var(--vl-line, var(--color-hudi-border));
  padding: 8px 14px;
}

.dock-tab {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  padding: 6px 10px;
  cursor: pointer;
  color: var(--vl-muted, var(--color-hudi-muted));
  white-space: nowrap;
}

.dock-tab:hover {
  border-color: var(--vl-line, var(--color-hudi-border));
}

.dock-tab.active {
  border-color: var(--vl-accent, var(--color-hudi-accent));
  color: var(--vl-ink, var(--color-hudi-text));
}

.dock-tab-label {
  font-size: 13px;
  font-weight: 600;
}

.dock-tab-hint {
  ont-size: 12px;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.dock-tab:focus-visible,
.dock-collapse:focus-visible {
  outline: 2px solid var(--vl-accent, var(--color-hudi-accent));
  outline-offset: 2px;
}

/* 视觉实验室的全局规则 `.visual-lab button{white-space:nowrap}` 会泄漏进被复用的
   EvidencePanel / QuizPanel，把中文长标题挤成横向溢出。详情区是阅读场景，按钮内文字
   应当正常换行；只有分区 tab 与收起按钮保持单行。 */
.lesson-dock :deep(button) {
  white-space: normal;
  max-width: 100%;
}

.lesson-dock .dock-tab,
.lesson-dock .dock-collapse {
  white-space: nowrap;
}

.dock-content {
  min-width: 0;
  padding: 12px 14px 14px;
}

.dock-quiz {
  margin-top: 10px;
}

.evidence-tab {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.evidence-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.evidence-badge {
  border: 1px solid var(--vl-line, var(--color-hudi-border));
  border-radius: 999px;
  padding: 2px 8px;
  ont-size: 12px;
  line-height: 1.6;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.evidence-note {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--vl-ink, var(--color-hudi-text));
  overflow-wrap: anywhere;
}

.evidence-limit {
  margin-top: 10px;
}

.evidence-limit-title {
  margin: 0 0 4px;
  ont-size: 12px;
  font-weight: 600;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.evidence-limit-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--vl-ink, var(--color-hudi-text));
}

.evidence-limit-list li {
  overflow-wrap: anywhere;
}

.evidence-source-list {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.8;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.evidence-source-list code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  ont-size: 12px;
  color: var(--vl-ink, var(--color-hudi-text));
  overflow-wrap: anywhere;
}
</style>
