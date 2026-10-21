<script setup lang="ts">
import type { HudiPhysicalFile, HudiRecord } from '@/models/hudi'
defineProps<{ file: HudiPhysicalFile; records: HudiRecord[]; x: number; y: number; fresh?: boolean; highlight?: boolean; disabled?: boolean; revealCount?: number; annotations?: Record<string,string> }>()
defineEmits<{ select: [] }>()
</script>
<template>
  <g :transform="`translate(${x},${y})`" class="file-glyph" :class="{ old: file.status === 'SUPERSEDED', fresh }" :tabindex="disabled ? -1 : 0" :aria-disabled="disabled || undefined" role="button" :aria-label="`${file.type} ${file.fileName}`" @click="!disabled && $emit('select')" @keydown.enter="!disabled && $emit('select')" @keydown.space.prevent="!disabled && $emit('select')">
    <rect width="172" height="108" rx="12" class="file-body" :class="file.type === 'BASE' ? 'base-body' : 'log-body'" />
    <path d="M139 0 V22 H172" fill="none" stroke="currentColor" opacity=".3" />
    <text x="14" y="23" class="file-type">{{ file.type === 'BASE' ? '▤  BASE FILE' : '≡  LOG FILE' }}</text>
    <text x="14" y="39" class="file-format">{{ file.type === 'BASE' ? '.parquet' : '.log' }} · {{ file.recordCount }} 条记录</text>
    <g v-for="(record, n) in records.slice(0, Math.min(3,revealCount??3))" :key="`${record.recordKey}:${record.commitTime}:${n}`" :transform="`translate(10,${45 + n * 17})`">
      <rect width="152" height="16" rx="4" :class="record.operation === 'D' ? 'record-deleted' : record.recordKey === '1001' && highlight ? 'record-highlight' : 'record-bg'" />
      <text x="8" y="12" class="record-text">{{ record.recordKey }} <tspan v-if="record.operation === 'D'" x="48" class="delete-label">D</tspan><tspan v-if="record.operation!=='D' && annotations?.[record.recordKey]" x="48" class="row-annotation">{{ annotations[record.recordKey] }}</tspan><tspan x="90">¥ {{ record.fields.amount }}</tspan></text>
    </g>
    <text x="14" y="104" class="file-format">{{ disabled ? '生成预览 · 尚未提交' : file.status === 'SUPERSEDED' ? '旧版本 · 等待清理' : '当前版本 · 点击查看' }}</text>
  </g>
</template>
<style scoped>
.file-glyph{cursor:pointer;outline:none;color:var(--vl-ink)}.file-glyph:focus .file-body,.file-glyph:hover .file-body{stroke:var(--vl-ink);stroke-width:2}.file-body{stroke-width:1.4}.base-body{fill:var(--vl-base-bg);stroke:#79a99a}.log-body{fill:var(--vl-log-bg);stroke:#c5a565}.file-type{font:600 12px ui-monospace,monospace;fill:var(--vl-ink)}.file-format{font:10px ui-monospace,monospace;fill:var(--vl-muted)}.record-text{font:11px ui-monospace,monospace;fill:var(--vl-ink)}.record-bg{fill:var(--vl-panel)}.record-highlight{fill:var(--vl-highlight)}.row-annotation{fill:var(--vl-copy-text,#9ac9e6);font-size:9px}.record-deleted{fill:var(--vl-delete-bg,#643e36)}.delete-label{fill:#eab5a5;font-weight:bold}.old{opacity:.43}.fresh .file-body{stroke:#38957a;stroke-width:2.5}
</style>
