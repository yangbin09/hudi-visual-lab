<script setup lang="ts">
import { computed } from 'vue'
import type { HudiTableState } from '@/models/hudi'
import type { LessonFrame } from '@/engine/visual/scenarios'
import type { LessonParameters, VisualLesson } from '@/experiments/visual/types'
const props = defineProps<{ lesson: VisualLesson; frame: LessonFrame; state: HudiTableState; progress: number; started: boolean; parameters: LessonParameters }>()
const emit = defineEmits<{ inspect: [title: string, value: unknown] }>()
const fields = computed(() => props.state.table.fields)
const schemaOptions = computed(() => props.lesson.id === 'T08' ? ['新增可空列', '删除已有列', '修改字段类型'] : props.lesson.id === 'T05' ? ['NONE', 'HIVE_STYLE_PARTITIONING', 'STYLE_PARTITIONING_ONLY'] : [props.state.table.tableType, props.state.table.indexType, props.state.table.partitionFields.join(' / ')])
</script>
<template>
  <g>
    <text x="45" y="32" class="ac-section">① {{ lesson.id === 'B08' ? '表结构与目录' : '字段与配置输入' }}</text><text x="438" y="32" class="ac-section">② {{ lesson.nodes[1] }}</text><text x="797" y="32" class="ac-section">③ {{ lesson.nodes.at(-1) }}</text>
    <g v-for="(field,i) in fields" :key="field.name" :transform="`translate(45,${60+i*59})`"><rect width="250" height="52" rx="7" class="ac-node"/><text x="15" y="22" class="ac-worker-title">{{ field.name }} <tspan x="118" class="ac-meta">{{ field.type }}</tspan></text><text x="15" y="42" class="td-ts">{{ frame.input?.[0]?.fields[field.name] ?? state.records[0]?.fields[field.name] ?? '暂无数据值' }}</text><path :d="`M250 22Q330 22 390 ${170-i*59}`" class="ac-path"/></g>
    <rect x="435" y="100" width="220" height="213" rx="14" class="ac-worker" :class="{ 'ac-error': frame.error || (lesson.model === 'concept' && parameters.failureAt >= 0 && progress > .5) }"/><text x="545" y="137" text-anchor="middle" class="ac-large">{{ lesson.nodes[2] }}</text><text x="455" y="178" class="ac-meta">primaryKey = {{ state.table.primaryKey }}</text><text x="455" y="206" class="ac-meta">precombine = {{ state.table.preCombineField }}</text><text x="455" y="234" class="ac-meta">partition = {{ state.table.partitionFields.join(', ') }}</text><text x="455" y="258" class="ac-meta">分区值 = {{ parameters.partition.slice(0,20) }}</text><text x="455" y="283" class="ac-meta">{{ lesson.model === 'concept' ? '配置关系示意' : '来自模拟表定义' }}</text>
    <g v-for="(option,i) in schemaOptions" :key="i" :transform="`translate(780,${83+i*90})`" class="ac-clickable" role="button" tabindex="0" :aria-label="`配置 ${option}`" @click="emit('inspect',String(option),{table:state.table,说明:frame.step.caption})" @keydown.enter="emit('inspect',String(option),state.table)"><path :d="`M-125 ${128-i*90}Q-55 ${128-i*90} 0 29`" class="ac-path"/><rect width="270" height="64" rx="9" class="ac-node"/><text x="14" y="26" class="ac-worker-title">{{ String(option).length > 27 ? String(option).slice(0,26)+'…' : option }}</text><text x="14" y="47" class="ac-meta">{{ lesson.id === 'T08' ? ['检查读写兼容性','检查旧文件读取','检查类型兼容边界'][i] : lesson.id === 'T05' ? ['非 Hive Style 配置','目录 key=value 与字段保留','仅目录模式的读取边界'][i] : ['表类型 / 配置选项','索引 / 存储选项','分区 / 字段选项'][i] }}</text></g>
    <g v-if="started && progress < .82"><circle v-for="(_,i) in fields" :key="i" :cx="295+Math.min(1,progress*2)*140" :cy="(82+i*59)*(1-Math.min(1,progress*2))+230*Math.min(1,progress*2)" r="6" class="ac-token"/><circle :cx="655 + Math.max(0,progress-.4)/.42*125" cy="210" r="8" class="ac-token"/></g>
    <text x="45" y="397" class="ac-meta">{{ frame.error ? frame.error.slice(0,100) : lesson.model === 'concept' && parameters.failureAt >= 0 ? `机制示意：在 ${lesson.nodes[parameters.failureAt]} 阻断，尚未执行真实兼容性校验。` : lesson.model === 'concept' ? '机制示意 · 未实现真实 Schema 演进或配置编码执行。' : `当前文件 ${state.physicalFiles.length} 个 · 分区 ${[...new Set(state.fileGroups.map(g=>g.partitionPath))].join('、') || '尚未写入'}` }}</text>
  </g>
</template>
