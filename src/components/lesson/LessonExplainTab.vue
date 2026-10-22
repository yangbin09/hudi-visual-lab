<script setup lang="ts">
/**
 * LessonExplainTab —— 「解释」分区
 * ---------------------------------------------------------------------------
 * 只从 frame（当前步骤的真实前后快照）与 teaching（引擎推导出的讲解数据）取内容：
 *   · 现象 = frame.step.caption
 *   · 原因 = teaching.summary / 教学节点 / 同键版本比较
 *   · 关键数字 = stateMetrics(frame.before) 与 stateMetrics(frame.after) 的对比
 * 组件不推断任何 Hudi 规则，也不编造执行结果。
 */
import { computed } from 'vue'
import DockPanel from './DockPanel.vue'
import { stateMetrics, type LessonFrame } from '@/engine/visual/scenarios'
import type { TeachingMoment } from '@/engine/visual/teachingTrace'
import type { LessonOperation, VisualLesson } from '@/experiments/visual/types'

const props = withDefaults(
  defineProps<{
    /** 当前步骤的前后快照与教学数据 */
    frame?: LessonFrame | null
    /** 主题定义（用于标题、步骤序号、模型类型） */
    lesson?: VisualLesson | null
    /** 当前播放进度 0–1，用于高亮当前教学节点 */
    progress?: number
    /** 「引擎驱动 / 引擎 + 机制示意 / 机制示意」的中文标签 */
    modelLabel?: string
  }>(),
  {
    frame: null,
    lesson: null,
    progress: 1,
    modelLabel: '',
  },
)

const OPERATION_LABEL: Record<LessonOperation, string> = {
  insert: 'INSERT · 新增',
  upsert: 'UPSERT · 更新或插入',
  delete: 'DELETE · 删除标记',
  bulk: 'BULK_INSERT · 批量写入初始化',
  'overwrite-partition': 'INSERT_OVERWRITE · 分区覆盖',
  'overwrite-table': 'INSERT_OVERWRITE_TABLE · 整表覆盖',
  duplicates: '同批次重复主键',
  stale: '乱序旧消息',
  schedule: 'SCHEDULE_COMPACTION · 生成合并计划',
  compact: 'RUN_COMPACTION · 执行合并',
  fail: '注入执行失败',
  rollback: 'RUN_ROLLBACK · 回滚未完成事务',
  clean: 'RUN_CLEAN · 清理旧文件',
  archive: 'RUN_ARCHIVE · 归档旧 instant',
  cluster: 'RUN_CLUSTERING · 重组文件',
  ttl: 'APPLY_TTL · 分区过期',
  create: 'CREATE_TABLE · 建表',
  snapshot: 'Snapshot 查询',
  optimized: 'Read Optimized 查询',
  incremental: 'Incremental 查询',
  history: 'Time Travel 查询',
  metadata: '查询并返回元字段',
  'partition-read': '按分区读取',
  'bucket-write': 'BUCKET 定位后写入',
  'empty-partition': '空分区值写入',
  'cross-partition': '跨分区写入',
  'invalid-schema': '配置校验（拒绝）',
  'invalid-bulk': '索引兼容性校验（拒绝）',
}

const frame = computed<LessonFrame | null>(() => props.frame ?? null)
const step = computed(() => frame.value?.step ?? null)
const teaching = computed(() => frame.value?.teaching ?? null)

const moments = computed<TeachingMoment[]>(() => {
  const list = step.value?.moments ?? teaching.value?.moments ?? []
  return list.filter(Boolean)
})

const operationLabel = computed<string>(() => {
  const operation = step.value?.operation
  return operation ? OPERATION_LABEL[operation] ?? operation : '机制观察（不改变表状态）'
})

interface MetricRow {
  label: string
  before: number
  after: number
}

const metricRows = computed<MetricRow[]>(() => {
  if (!frame.value) return []
  try {
    const before = stateMetrics(frame.value.before)
    const after = stateMetrics(frame.value.after)
    return [
      { label: '可见记录', before: before.records, after: after.records },
      { label: '有效文件', before: before.active, after: after.active },
      { label: '有效 Log', before: before.logs, after: after.logs },
      { label: '旧版本文件', before: before.old, after: after.old },
      { label: 'pending 事务', before: before.pending, after: after.pending },
      { label: 'Timeline instant', before: before.timeline, after: after.timeline },
    ]
  } catch {
    return []
  }
})

const hasMetricChange = computed<boolean>(() => metricRows.value.some((row) => row.before !== row.after))

function deltaLabel(row: MetricRow): string {
  const delta = row.after - row.before
  if (delta === 0) return '不变'
  return delta > 0 ? `+${delta}` : String(delta)
}

function deltaClass(row: MetricRow): string {
  const delta = row.after - row.before
  if (delta === 0) return 'dock-delta-flat'
  return delta > 0 ? 'dock-delta-up' : 'dock-delta-down'
}

const changedFiles = computed(() => {
  if (!frame.value) return { added: [], removed: [], retired: [] }
  return {
    added: frame.value.added ?? [],
    removed: frame.value.removed ?? [],
    retired: frame.value.retired ?? [],
  }
})

const hasChangedFiles = computed<boolean>(
  () =>
    changedFiles.value.added.length + changedFiles.value.removed.length + changedFiles.value.retired.length > 0,
)

const comparison = computed(() => teaching.value?.comparison ?? null)
const focusKey = computed<string>(() => teaching.value?.focusKey ?? '')
const summary = computed<string>(() => teaching.value?.summary ?? '')
const hash = computed(() => teaching.value?.hash ?? null)
const retention = computed(() => teaching.value?.retention ?? null)

function isMomentActive(at: number): boolean {
  const progress = props.progress
  if (typeof progress !== 'number' || Number.isNaN(progress)) return false
  return progress + 1e-6 >= at
}

const modelNote = computed<string>(() => {
  const model = props.lesson?.model
  if (model === 'concept') return '机制示意：本主题不改变表状态，也不伪造服务执行结果。'
  if (model === 'mixed') return '机制示意：文件与查询结果来自本地引擎，外部服务只作示意图。'
  if (model === 'engine') return '操作前后状态来自同一本地引擎，回放和拖动不重复执行操作。'
  return ''
})
</script>

<template>
  <div class="explain-tab">
    <DockPanel
      v-if="!frame || !step"
      title="本步解释"
      empty
      empty-title="还没有可解释的步骤"
      empty-text="先播放或单步执行一次，这里会显示本步的现象、原因和关键数字。"
    />

    <template v-else>
      <DockPanel :title="`本步：${step.title}`" :hint="step.operation ? operationLabel : undefined">
        <div class="explain-block">
          <p class="explain-kicker">现象</p>
          <p class="explain-text">{{ step.caption }}</p>
        </div>

        <div v-if="summary" class="explain-block">
          <p class="explain-kicker">发生了什么</p>
          <p class="explain-text">{{ summary }}</p>
        </div>

        <div v-if="frame.error" class="explain-alert" role="alert">
          <strong>本次被引擎拒绝：</strong>{{ frame.error }}
        </div>

        <div v-if="moments.length" class="explain-block">
          <p class="explain-kicker">教学节点</p>
          <ol class="moment-list">
            <li
              v-for="(moment, index) in moments"
              :key="`${index}-${moment.at}`"
              class="moment-item"
              :class="{ 'is-active': isMomentActive(moment.at) }"
            >
              <span class="moment-dot" aria-hidden="true" />
              <div class="moment-body">
                <p class="moment-title">
                  <span class="moment-index">{{ String(index + 1).padStart(2, '0') }}</span>
                  {{ moment.title }}
                </p>
                <p class="moment-text">{{ moment.explanation }}</p>
              </div>
            </li>
          </ol>
        </div>

        <p v-if="modelNote" class="explain-model">{{ modelLabel ? `${modelLabel} · ` : '' }}{{ modelNote }}</p>
      </DockPanel>

      <DockPanel
        title="关键数字"
        :hint="hasMetricChange ? '本步前后有变化' : '本步前后没有变化'"
        description="数字来自引擎的前后快照与 Snapshot 查询，不是估算。"
        :empty="!metricRows.length"
        empty-title="暂时算不出指标"
        empty-text="当前步骤缺少可对比的前后状态。"
      >
        <div class="metric-table-wrap">
          <table class="metric-table">
            <thead>
              <tr>
                <th scope="col">指标</th>
                <th scope="col">操作前</th>
                <th scope="col">操作后</th>
                <th scope="col">变化</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in metricRows" :key="row.label">
                <th scope="row">{{ row.label }}</th>
                <td class="metric-num">{{ row.before }}</td>
                <td class="metric-num">{{ row.after }}</td>
                <td class="metric-num" :class="deltaClass(row)">{{ deltaLabel(row) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DockPanel>

      <DockPanel
        v-if="focusKey || comparison || hash || retention"
        title="本步跟踪的主键与判断"
        :hint="focusKey ? `focus key = ${focusKey}` : undefined"
      >
        <dl v-if="comparison" class="explain-props">
          <dt>旧 ts</dt>
          <dd>{{ comparison.prior }}</dd>
          <dt>新 ts</dt>
          <dd>{{ comparison.incoming }}</dd>
          <dt>比较结果</dt>
          <dd>{{ comparison.relation }} · {{ comparison.result }}</dd>
        </dl>
        <dl v-if="hash" class="explain-props">
          <dt>教学哈希</dt>
          <dd class="mono">hash({{ hash.key }}) = {{ hash.value }} → {{ hash.count }} 个桶 → Bucket {{ hash.bucket }}</dd>
        </dl>
        <dl v-if="retention" class="explain-props">
          <dt>保留窗口</dt>
          <dd class="mono">{{ retention.count }} 个 instant：{{ retention.keepInstants.join(' · ') || '（空）' }}</dd>
        </dl>
        <p v-if="teaching?.kind === 'query' && teaching.result" class="explain-note">
          本次读取模式 {{ teaching.result.mode }}，返回 {{ teaching.result.rowCount }} 条记录。
        </p>
      </DockPanel>

      <DockPanel
        title="本步变化的物理文件"
        :empty="!hasChangedFiles"
        empty-title="本步没有新增 / 删除 / 被取代的文件"
        empty-text="机制示意或纯读取步骤不会改变 HDFS 上的物理文件。"
      >
        <div class="file-change-groups">
          <div v-if="changedFiles.added.length" class="file-change-group">
            <p class="file-change-title">新增（{{ changedFiles.added.length }}）</p>
            <ul class="file-change-list">
              <li v-for="file in changedFiles.added" :key="`add-${file.fileName}`">
                <span class="mono">{{ file.type }} · {{ file.fileName }}</span>
              </li>
            </ul>
          </div>
          <div v-if="changedFiles.removed.length" class="file-change-group">
            <p class="file-change-title">物理删除（{{ changedFiles.removed.length }}）</p>
            <ul class="file-change-list">
              <li v-for="file in changedFiles.removed" :key="`del-${file.fileName}`">
                <span class="mono">{{ file.type }} · {{ file.fileName }}</span>
              </li>
            </ul>
          </div>
          <div v-if="changedFiles.retired.length" class="file-change-group">
            <p class="file-change-title">被取代、等待 Clean（{{ changedFiles.retired.length }}）</p>
            <ul class="file-change-list">
              <li v-for="file in changedFiles.retired" :key="`retire-${file.fileName}`">
                <span class="mono">{{ file.type }} · {{ file.fileName }}</span>
              </li>
            </ul>
          </div>
        </div>
      </DockPanel>
    </template>
  </div>
</template>

<style scoped>
.explain-tab {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.explain-block + .explain-block {
  margin-top: 10px;
}

.explain-kicker {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.explain-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--vl-ink, var(--color-hudi-text));
  overflow-wrap: anywhere;
}

.explain-alert {
  margin-top: 10px;
  border-left: 3px solid var(--vl-accent, var(--color-hudi-warning));
  border-radius: 0 6px 6px 0;
  background: var(--vl-bg, var(--color-hudi-bg));
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-ink, var(--color-hudi-text));
}

.moment-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.moment-item {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  opacity: 0.62;
}

.moment-item.is-active {
  opacity: 1;
}

.moment-dot {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--vl-line, var(--color-hudi-border));
}

.moment-item.is-active .moment-dot {
  background: var(--vl-accent, var(--color-hudi-accent));
}

.moment-body {
  min-width: 0;
}

.moment-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--vl-ink, var(--color-hudi-text));
}

.moment-index {
  margin-right: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.moment-text {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-muted, var(--color-hudi-muted));
  overflow-wrap: anywhere;
}

.explain-model {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.metric-table-wrap {
  min-width: 0;
  overflow-x: auto;
}

.metric-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.metric-table th,
.metric-table td {
  border-bottom: 1px solid var(--vl-line, var(--color-hudi-border));
  padding: 6px 8px;
  text-align: left;
  white-space: nowrap;
}

.metric-table thead th {
  font-size: 12px;
  font-weight: 500;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.metric-table tbody th {
  font-weight: 400;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.metric-num {
  font-family: ui-monospace, monospace;
  color: var(--vl-ink, var(--color-hudi-text));
}

.dock-delta-up {
  color: var(--vl-accent, var(--color-hudi-accent));
}

.dock-delta-down {
  color: var(--vl-ink, var(--color-hudi-text));
  opacity: 0.72;
}

.dock-delta-flat {
  color: var(--vl-muted, var(--color-hudi-muted));
}

.explain-props {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  margin: 0;
  column-gap: 10px;
  row-gap: 4px;
  font-size: 12px;
}

.explain-props dt {
  color: var(--vl-muted, var(--color-hudi-muted));
}

.explain-props dd {
  margin: 0;
  color: var(--vl-ink, var(--color-hudi-text));
  overflow-wrap: anywhere;
}

.explain-note {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  overflow-wrap: anywhere;
}

.file-change-groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.file-change-title {
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.file-change-list {
  margin: 0;
  padding-left: 16px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-ink, var(--color-hudi-text));
}

.file-change-list li {
  overflow-wrap: anywhere;
}
</style>
