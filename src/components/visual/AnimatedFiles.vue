<script setup lang="ts">
import { computed } from 'vue'
import FileGlyph from './FileGlyph.vue'
import { fileRecords, type LessonFrame } from '@/engine/visual/scenarios'
import type { LessonParameters } from '@/experiments/visual/types'
import type { HudiPhysicalFile, HudiTableState } from '@/models/hudi'
const props = defineProps<{ frame: LessonFrame; state: HudiTableState; progress: number; started: boolean; parameters: LessonParameters }>()
const emit = defineEmits<{ inspect: [title: string, value: unknown] }>()
const inputs = computed(() => {
  const active = props.frame.before.physicalFiles.filter(f => f.status === 'ACTIVE')
  const removed = props.frame.removed.filter(f => !active.some(a => a.fileName === f.fileName))
  const old = props.frame.before.physicalFiles.filter(f=>f.status==='SUPERSEDED').slice(-1)
  return [...active, ...removed, ...old].filter((f,i,all)=>all.findIndex(a=>a.fileName===f.fileName)===i).slice(0, 4)
})
const outputs = computed(() => props.frame.after.physicalFiles.filter(f => f.status === 'ACTIVE').slice(0, 4))
const moving = computed(() => props.started && props.progress < .82 && !!props.frame.input?.length)
const worker = computed(() => props.frame.step.operation === 'schedule' ? 'Compaction Plan' : ({ merge: '合并 / 重组', remove: '保留窗口检查', write: 'Hudi Writer', rollback: 'Rollback', archive: 'Archive', error: '校验 / 拒绝', read: 'Reader' }[props.frame.step.effect as string] ?? 'Hudi Engine'))
function x(index: number, length: number) { return 540 - length * 220 / 2 + index * 220 }
function packetPosition() {
  const t = Math.min(1, props.progress / .82)
  if (t < .5) return `translate(${x(0, Math.max(1, inputs.value.length)) + 87 + (540 - x(0, Math.max(1, inputs.value.length)) - 87) * t * 2},${105 + t * 2 * 100})`
  return `translate(${540 + (x(0, Math.max(1, outputs.value.length)) + 87 - 540) * (t - .5) * 2},${205 + (t - .5) * 2 * 123})`
}
function inputFile(file: HudiPhysicalFile) { return props.progress >= .82 ? props.frame.after.physicalFiles.find(f=>f.fileName===file.fileName) ?? file : file }
function inspect(file: HudiPhysicalFile, state: HudiTableState) { emit('inspect', file.fileName, { ...file, records: fileRecords(state, file.fileName) }) }
</script>
<template>
  <g class="animated-files">
    <text x="28" y="26" class="ac-section">操作前 · {{ frame.before.physicalFiles.length }} 个物理文件</text>
    <g v-for="(file, i) in inputs" :key="file.fileName" :opacity="frame.removed.some(f => f.fileName === file.fileName) && started ? Math.max(.06, 1 - progress) : 1" :transform="`translate(${x(i, inputs.length)},43) scale(1.02)`"><FileGlyph :file="inputFile(file)" :records="fileRecords(frame.before, file.fileName)" :x="0" :y="0" :highlight="started && progress > .15" @select="inspect(inputFile(file), progress >= .82 ? frame.after : frame.before)"/></g>
    <text v-if="!inputs.length" x="540" y="93" class="ac-empty" text-anchor="middle">空表 · 还没有数据文件</text>
    <path v-for="(_, i) in inputs" :key="i" :d="`M${x(i, inputs.length)+87} 153 Q${x(i, inputs.length)+87} 185 475 201`" class="ac-path"/>
    <rect x="448" y="177" width="184" height="58" rx="12" class="ac-worker" :class="{ 'ac-error': frame.error }"/><text x="540" y="201" text-anchor="middle" class="ac-worker-title">{{ worker }}</text><text x="540" y="220" text-anchor="middle" class="ac-meta">{{ frame.error ? '未提交 · 原状态保留' : progress >= .82 ? '已展示引擎结果' : '执行过程示意' }}</text>
    <g v-if="moving && frame.step.effect !== 'observe'"><circle v-for="(_, i) in Math.max(1, inputs.length)" :key="i" :cx="(x(i, Math.max(1, inputs.length))+65)*(1-Math.min(1,progress*2)) + 540*Math.min(1,progress*2)" :cy="133 + Math.sin(Math.min(1,progress*2)*Math.PI/2)*65" r="7" class="ac-token"/><g :transform="packetPosition()"><rect x="-58" y="-14" width="116" height="29" rx="6" class="ac-message"/><text x="0" y="5" text-anchor="middle" class="ac-message-text">{{ frame.step.effect === 'remove' ? '检查可回收文件' : frame.input?.[0]?.recordKey + ' · ¥' + frame.input?.[0]?.fields.amount }}</text></g></g>
    <text x="28" y="273" class="ac-section">{{ progress >= .82 ? '操作后 · 当前有效引用' : '目标文件预览 · 提交前不生效' }}</text>
    <path v-for="(_, i) in outputs" :key="i" :d="`M540 235 Q540 264 ${x(i,outputs.length)+87} 294`" class="ac-path"/>
    <g v-for="(file, i) in outputs" :key="file.fileName" :opacity="!started ? .28 : progress >= .82 ? 1 : Math.max(.12, (progress-.3)*1.5)" :transform="`translate(${x(i,outputs.length)},${294 + (started ? Math.max(0, .82-progress)*22 : 0)}) scale(1.02)`"><FileGlyph :file="file" :records="fileRecords(frame.after, file.fileName)" :disabled="progress < .82" :x="0" :y="0" :fresh="frame.added.some(f => f.fileName === file.fileName)" :highlight="started" @select="progress >= .82 && inspect(file, frame.after)"/></g>
    <g v-if="frame.step.operation === 'schedule' && started"><rect x="740" y="166" width="293" height="76" rx="9" class="ac-node"/><text x="755" y="190" class="ac-worker-title">{{ progress >= .82 ? 'Plan · REQUESTED' : '计划生成中…' }}</text><text x="755" y="214" class="ac-meta">{{ frame.after.compactionPlans.at(-1)?.entries.length ?? 0 }} 个候选 File Group</text><text x="755" y="231" class="ac-meta">数据文件未改变</text></g>
    <g v-if="frame.removed.length && started"><text x="815" y="209" class="ac-danger">− {{ progress >= .82 ? frame.removed.length : '…' }} 个物理文件</text></g>
    <text v-if="frame.retired.length && started && progress >= .82" x="28" y="411" class="ac-meta">{{ frame.retired.length }} 个旧文件已被取代，仍等待 Cleaner；点击技术详情查看完整清单。</text>
    <text v-else x="28" y="411" class="ac-meta">图中最多显示四个文件；完整文件清单与记录可按需展开。</text>
  </g>
</template>
