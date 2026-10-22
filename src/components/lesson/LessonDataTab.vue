<script setup lang="ts">
/**
 * LessonDataTab —— 「数据」分区
 * ---------------------------------------------------------------------------
 * 把死代码里已经实现好的详细视图搬进页内 dock：
 *   · HDFS 文件树      → FileTreeView（物理文件 ≠ 当前 File Slice 引用）
 *   · 逻辑记录          → RecordTable（业务字段 + _hoodie_* 元字段 + tombstone）
 *   · Timeline          → TimelineView（时间轴看节奏）+ TimelineTable（表格看细节）
 *   · Compaction 计划   → 本组件内的轻量表格
 * 四个区块都有空状态，state 为空时整块给出一句说明。
 */
import { computed, ref } from 'vue'
import DockPanel from './DockPanel.vue'
import FileTreeView from '@/components/filesystem/FileTreeView.vue'
import RecordTable from '@/components/records/RecordTable.vue'
import TimelineTable from '@/components/timeline/TimelineTable.vue'
import TimelineView from '@/components/timeline/TimelineView.vue'
import type { HudiInstant, HudiPhysicalFile, HudiRecord, HudiTableState } from '@/models/hudi'

const props = withDefaults(
  defineProps<{
    /** 当前展示位置对应的表状态（来自 LessonFrame.before / after） */
    state?: HudiTableState | null
    /** 需要在文件树里高亮的物理文件 */
    selectedFile?: string
    /** 是否展示 _hoodie_* 元字段（默认展示，详情区以排查视角为主） */
    showMetaFields?: boolean
  }>(),
  {
    state: null,
    selectedFile: '',
    showMetaFields: true,
  },
)

const emit = defineEmits<{
  'select-file': [file: HudiPhysicalFile]
  'select-record': [record: HudiRecord]
  'select-instant': [instant: HudiInstant]
}>()

const state = computed<HudiTableState | null>(() => props.state ?? null)

const timeline = computed<HudiInstant[]>(() => state.value?.timeline ?? [])
const pending = computed<HudiInstant[]>(() => state.value?.pendingInstants ?? [])
const archived = computed<HudiInstant[]>(() => state.value?.archivedInstants ?? [])
/** 表格同时展示活跃区与 Pending 区；时间轴组件自己区分两者 */
const timelineRows = computed<HudiInstant[]>(() => [...timeline.value, ...pending.value])

const selectedInstant = ref<string>('')

const plans = computed(() => state.value?.compactionPlans ?? [])

function planEntryCount(plan: (typeof plans.value)[number]): number {
  return plan.entries?.length ?? 0
}

function planRecordCount(plan: (typeof plans.value)[number]): number {
  return (plan.entries ?? []).reduce((sum, entry) => sum + (entry.recordCount ?? 0), 0)
}

function planLogCount(plan: (typeof plans.value)[number]): number {
  return (plan.entries ?? []).reduce((sum, entry) => sum + (entry.logFileCount ?? 0), 0)
}

function onInstantSelect(instant: HudiInstant): void {
  selectedInstant.value = instant.instantTime
  emit('select-instant', instant)
}
</script>

<template>
  <div class="data-tab">
    <DockPanel
      v-if="!state"
      title="数据"
      empty
      empty-title="表状态还没有准备好"
      empty-text="当前步骤没有携带表快照；先播放或单步执行一次，再回来看 HDFS、记录和 Timeline。"
    />

    <template v-else>
      <DockPanel
        title="HDFS 文件树"
        hint="物理文件 ≠ 当前 File Slice 引用"
        description="被新版本取代、但尚未被 Cleaner 删除的文件仍在这里；点击数据文件可查看它自己的记录。"
      >
        <FileTreeView
          :table="state.table"
          :physical-files="state.physicalFiles"
          :file-groups="state.fileGroups"
          :selected-file="selectedFile"
          :timeline="timeline"
          :pending="pending"
          :archived="archived"
          @select="emit('select-file', $event)"
        />
      </DockPanel>

      <DockPanel
        title="逻辑记录"
        hint="Snapshot 可见性口径"
        description="D 是删除标记：记录仍在物理文件里，但 Snapshot 不会再返回它。"
      >
        <RecordTable
          :records="state.records"
          :primary-key="state.table.primaryKey"
          :pre-combine-field="state.table.preCombineField"
          :show-meta-fields="showMetaFields"
          @select-record="emit('select-record', $event)"
        />
      </DockPanel>

      <DockPanel
        title="Timeline"
        :hint="`${timeline.length} 个活跃 instant / ${pending.length} 个 pending`"
        description="表格看每个 instant 的细节，时间轴看提交节奏；Pending 区的事务尚未提交，对查询不可见。"
      >
        <div class="data-subsection">
          <p class="data-subtitle">表格视图</p>
          <TimelineTable :timeline="timelineRows" @select="onInstantSelect" />
        </div>
        <div class="data-subsection">
          <p class="data-subtitle">时间轴视图</p>
          <div class="data-scroll-x">
            <TimelineView
              :timeline="timeline"
              :pending="pending"
              :archived="archived"
              :selected="selectedInstant"
              @select="onInstantSelect"
            />
          </div>
        </div>
        <DockPanel
          v-if="!archived.length"
          class="data-archived-note"
          title="归档 Instant"
          hint="0 个"
          description="执行 Archive 后，旧 instant 会移到 .hoodie/archive/，不再出现在活跃 Timeline 上。"
          empty
          empty-title="还没有归档的 instant"
        />
      </DockPanel>

      <DockPanel
        title="Compaction 计划"
        :hint="plans.length ? `${plans.length} 个计划` : '0 个计划'"
        description="Plan 只记录“准备合并哪些 File Group”，不代表已经生成新 Base。"
        :empty="!plans.length"
        empty-title="当前没有 Compaction 计划"
        empty-text="执行 Schedule（或写入触发自动 Schedule）后，这里会出现 REQUESTED 状态的计划及其候选 File Group。"
      >
        <div class="plan-list">
          <article v-for="plan in plans" :key="plan.instantTime" class="plan-card">
            <header class="plan-head">
              <span class="mono">{{ plan.instantTime }}</span>
              <span class="plan-state">{{ plan.state }}</span>
              <span class="plan-stat">{{ planEntryCount(plan) }} 个 File Group</span>
              <span class="plan-stat">{{ planLogCount(plan) }} 个 Log</span>
              <span class="plan-stat">{{ planRecordCount(plan) }} 条记录</span>
            </header>
            <div v-if="plan.entries?.length" class="plan-table-wrap">
              <table class="plan-table">
                <thead>
                  <tr>
                    <th scope="col">分区</th>
                    <th scope="col">File ID</th>
                    <th scope="col">Log 数</th>
                    <th scope="col">记录数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="entry in plan.entries" :key="`${plan.instantTime}-${entry.fileId}`">
                    <td class="mono">{{ entry.partitionPath || '（空分区）' }}</td>
                    <td class="mono">{{ entry.fileId }}</td>
                    <td class="num">{{ entry.logFileCount }}</td>
                    <td class="num">{{ entry.recordCount }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-else class="plan-empty">该计划没有候选 File Group。</p>
          </article>
        </div>
      </DockPanel>
    </template>
  </div>
</template>

<style scoped>
.data-tab {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.data-subsection {
  min-width: 0;
}

.data-subsection + .data-subsection {
  margin-top: 12px;
}

.data-subtitle {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.data-scroll-x {
  min-width: 0;
  overflow-x: auto;
}

.data-archived-note {
  margin-top: 12px;
}

.plan-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.plan-card {
  min-width: 0;
  border: 1px solid var(--vl-line, var(--color-hudi-border));
  border-radius: 8px;
  background: var(--vl-bg, var(--color-hudi-bg));
  padding: 8px 10px;
}

.plan-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 10px;
  row-gap: 4px;
  font-size: 12px;
  color: var(--vl-ink, var(--color-hudi-text));
}

.plan-state {
  border: 1px solid var(--vl-line, var(--color-hudi-border));
  border-radius: 4px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 16px;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.plan-stat {
  font-size: 12px;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.plan-table-wrap {
  min-width: 0;
  overflow-x: auto;
  margin-top: 8px;
}

.plan-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.plan-table th,
.plan-table td {
  border-bottom: 1px solid var(--vl-line, var(--color-hudi-border));
  padding: 5px 7px;
  text-align: left;
  white-space: nowrap;
}

.plan-table th {
  font-weight: 500;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.plan-table td {
  color: var(--vl-ink, var(--color-hudi-text));
}

.plan-empty {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.num {
  text-align: right;
  font-family: ui-monospace, monospace;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow-wrap: anywhere;
}
</style>
