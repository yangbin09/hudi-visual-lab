<script setup lang="ts">
/**
 * LessonCodeTab —— 「代码」分区
 * ---------------------------------------------------------------------------
 * 两部分：
 *  1. SQL / Scala / Flink / Shell 参考模板（复用 SqlBlock，只读 + 复制，状态徽标如实标注证据强度）；
 *  2. 源码映射：本主题对应到本地 TypeScript 实现的哪个文件 / 入口。
 *
 * 源码映射必须逐行渲染（数组 + v-for）。历史版本曾在模板里写字符串 `\n`，
 * 结果页面只显示一行字面反斜杠 n —— 这里用真实列表彻底避免该问题。
 */
import { computed } from 'vue'
import DockPanel from './DockPanel.vue'
import SqlBlockView from '@/components/sql/SqlBlock.vue'
import type { SqlBlock } from '@/engine/templates/types'
import type { SceneKind, VisualLesson } from '@/experiments/visual/types'
import { defaultSourceMap, type LessonSourceEntry } from './types'

const props = withDefaults(
  defineProps<{
    /** 已由 buildSql 填好参数的模板（结构与 SqlBlock 一致） */
    templates?: SqlBlock[]
    /** 覆盖默认源码映射 */
    sourceMap?: LessonSourceEntry[]
    /** 主题定义：用于按场景类型生成默认源码映射 */
    lesson?: VisualLesson | null
    /** 机制示意页的边界说明 */
    limitation?: string
  }>(),
  {
    templates: () => [],
    lesson: null,
    limitation: '',
  },
)

const emit = defineEmits<{ copy: [code: string] }>()

const KIND_LABEL: Record<SceneKind, string> = {
  files: '文件与写入路径',
  index: '索引定位',
  query: '查询语义',
  timeline: 'Timeline 与表服务',
  flow: '机制链路',
  schema: '表结构与目录',
  metrics: '指标与表健康',
}

const blocks = computed<SqlBlock[]>(() => (props.templates ?? []).filter((block): block is SqlBlock => Boolean(block?.code)))

const kindLabel = computed<string>(() => {
  const kind = props.lesson?.kind
  return kind ? KIND_LABEL[kind] ?? kind : ''
})

const entries = computed<LessonSourceEntry[]>(() =>
  props.sourceMap && props.sourceMap.length ? props.sourceMap : defaultSourceMap(props.lesson?.kind),
)

const languageCount = computed<number>(() => new Set(blocks.value.map((block) => block.language)).size)
</script>

<template>
  <div class="code-tab">
    <DockPanel
      title="参考模板"
      :hint="blocks.length ? `${blocks.length} 条 · ${languageCount} 种语言` : '无模板'"
      description="模板只用于阅读与复制；本平台不执行真实 Spark SQL / Flink SQL，也未连接 r26 集群。"
      :empty="!blocks.length"
      empty-title="本主题暂时没有代码模板"
      empty-text="机制示意类主题不提供可执行 SQL；可在「数据 / 依据」分区继续查看本步的文件与证据。"
    >
      <div class="code-block-list">
        <SqlBlockView
          v-for="block in blocks"
          :key="block.id"
          :block="block"
          @copy="emit('copy', $event)"
        />
      </div>
    </DockPanel>

    <DockPanel
      title="源码映射"
      :hint="kindLabel ? `本主题类型：${kindLabel}` : undefined"
      description="本地 TypeScript 模拟实现，不代表已核实的华为 Java / Scala 源码；r26 的真实类名与执行路径仍需结合发行源码核对。"
      :empty="!entries.length"
      empty-title="没有额外的源码映射"
    >
      <ul class="source-list">
        <li v-for="entry in entries" :key="`${entry.path}#${entry.symbol}`" class="source-item">
          <code class="source-path">{{ entry.path }}</code>
          <span class="source-symbol">{{ entry.symbol }}</span>
          <span v-if="entry.note" class="source-note">{{ entry.note }}</span>
        </li>
      </ul>
    </DockPanel>

    <DockPanel
      v-if="limitation"
      title="本主题的边界"
      description="这一条必须和代码一起读：机制示意不等于真实集群行为。"
    >
      <p class="code-limitation">{{ limitation }}</p>
    </DockPanel>
  </div>
</template>

<style scoped>
.code-tab {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

.code-block-list {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10px;
}

/* SqlBlock 是 flex item：默认 min-width:auto 会被 CodeMirror 的内容宽度撑开，
   在 390px 下把整个 dock 拖出横向滚动。这里显式允许收缩。 */
.code-block-list :deep(article) {
  min-width: 0;
  max-width: 100%;
}

.code-block-list :deep(.cm-host) {
  min-width: 0;
  overflow-x: hidden;
}

.code-block-list :deep(.cm-editor) {
  max-width: 100%;
}

.code-block-list :deep(section) {
  min-width: 0;
}

/* 代码块本身由 SqlBlock 负责滚动，这里只保证父级不会把 dock 撑宽 */
.code-block-list :deep(.cm-host) {
  max-width: 100%;
}

.code-block-list :deep(pre) {
  max-width: 100%;
}

.source-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-item {
  min-width: 0;
  border-left: 2px solid var(--vl-line, var(--color-hudi-border));
  padding-left: 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.source-path {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--vl-ink, var(--color-hudi-text));
  overflow-wrap: anywhere;
}

.source-symbol {
  font-size: 12px;
  line-height: 1.6;
  color: var(--vl-ink, var(--color-hudi-text));
  overflow-wrap: anywhere;
}

.source-note {
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-muted, var(--color-hudi-muted));
  overflow-wrap: anywhere;
}

.code-limitation {
  margin: 0;
  font-size: 12px;
  line-height: 1.8;
  color: var(--vl-muted, var(--color-hudi-muted));
  overflow-wrap: anywhere;
}
</style>
