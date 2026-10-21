<script setup lang="ts">
import { computed } from 'vue'
import { stateMetrics, type LessonFrame } from '@/engine/visual/scenarios'
const props = defineProps<{ frame: LessonFrame; progress: number; started: boolean }>()
const emit = defineEmits<{ inspect: [title: string, value: unknown] }>()
const before = computed(() => stateMetrics(props.frame.before)), after = computed(() => stateMetrics(props.frame.after))
const metrics = [{key:'files' as const,label:'物理文件'}, {key:'active' as const,label:'有效文件'}, {key:'logs' as const,label:'有效 Log'}, {key:'old' as const,label:'旧版本'}, {key:'records' as const,label:'可见记录'}, {key:'pending' as const,label:'未完成事务'}]
const max = computed(() => Math.max(1,...metrics.flatMap(m=>[before.value[m.key],after.value[m.key]])))
const tween = computed(() => props.started ? Math.min(1,props.progress/.82) : 0)
</script>
<template>
  <g>
    <text x="38" y="34" class="ac-section">{{ progress >= .82 ? '当前模拟结果' : '变化预览 · 提交前不生效' }}</text><text x="1040" y="34" text-anchor="end" class="ac-meta">浅色：操作前　绿色：操作后</text>
    <path d="M55 294H1030" class="ac-path"/>
    <g v-for="(metric,i) in metrics" :key="metric.key" :transform="`translate(${80+i*164},0)`" role="button" tabindex="0" class="ac-clickable" :aria-label="`指标 ${metric.label}`" @click="emit('inspect',metric.label,{操作前:before[metric.key],操作后:after[metric.key],说明:'全部为教学引擎统计，非真实集群指标'})" @keydown.enter="emit('inspect',metric.label,{操作前:before[metric.key],操作后:after[metric.key]})">
      <rect x="0" :y="294-before[metric.key]/max*188" width="42" :height="Math.max(2,before[metric.key]/max*188)" rx="5" class="ac-before-bar"/><rect x="47" :y="294-(before[metric.key]+(after[metric.key]-before[metric.key])*tween)/max*188" width="42" :height="Math.max(2,(before[metric.key]+(after[metric.key]-before[metric.key])*tween)/max*188)" rx="5" class="ac-after-bar"/>
      <text x="44" :y="Math.min(294-before[metric.key]/max*188,294-after[metric.key]/max*188)-17" text-anchor="middle" class="ac-large">{{ before[metric.key] }} → {{ after[metric.key] }}</text><text x="44" y="322" text-anchor="middle" class="ac-worker-title">{{ metric.label }}</text>
    </g>
    <rect x="55" y="355" width="974" height="45" rx="9" class="ac-node"/><text x="75" y="383" class="ac-meta">模拟物理占用 {{ before.bytes }} → {{ after.bytes }} B · 可见记录 {{ before.records }} → {{ after.records }} · 不代表实际吞吐或延迟</text>
  </g>
</template>
