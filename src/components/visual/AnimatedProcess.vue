<script setup lang="ts">
import { computed } from 'vue'
import type { LessonFrame } from '@/engine/visual/scenarios'
import type { LessonParameters, VisualLesson } from '@/experiments/visual/types'
const props = defineProps<{ lesson: VisualLesson; frame: LessonFrame; progress: number; current: number; started: boolean; parameters: LessonParameters }>()
const emit = defineEmits<{ inspect: [title: string, value: unknown] }>()
const nodes = computed(() => props.lesson.nodes)
const failure = computed(() => props.parameters.failureAt >= 0 && (props.frame.step.effect === 'error' || props.current === props.lesson.steps.length-1))
const target = computed(() => failure.value ? Math.min(props.parameters.failureAt, nodes.value.length-1) : Math.min(nodes.value.length-1,props.current+1))
const parallel = computed(() => ['A04','W09','F08','E09','A03'].includes(props.lesson.id))
function point(n: number): [number,number] {
  if (['A04','W09'].includes(props.lesson.id)) return [[100,112],[100,266],[420,189],[700,189],[970,189]][n] as [number,number]
  if (props.lesson.id === 'E09') return [[100,112],[420,189],[100,266],[700,189],[970,189]][n] as [number,number]
  if (props.lesson.id === 'F08') return [[110,112],[510,189],[110,266],[960,189]][n] as [number,number]
  if (props.lesson.id === 'A03') return [[110,189],[490,100],[490,278],[960,189]][n] as [number,number]
  return [100 + n * 870 / Math.max(1,nodes.value.length-1),props.lesson.id === 'W07' ? 123 : 176]
}
function x(n: number) { return point(n)[0] }
function y(n: number) { return point(n)[1] }
const edges = computed(() => ['A04','W09'].includes(props.lesson.id) ? [[0,2],[1,2],[2,3],[3,4]] : props.lesson.id === 'E09' ? [[0,1],[2,1],[1,3],[3,4]] : props.lesson.id === 'F08' ? [[0,1],[2,1],[1,3]] : props.lesson.id === 'A03' ? [[0,1],[0,2],[1,3],[2,3]] : nodes.value.slice(0,-1).map((_,i)=>[i,i+1]))
const modes = [{name:'Append',result:'追加入口'},{name:'Overwrite',result:'覆盖入口'},{name:'ErrorIfExists',result:'目标存在则拒绝'},{name:'Ignore',result:'目标存在则跳过'}]

const motion = computed(() => {
  const failEdge = failure.value ? edges.value.findIndex(e=>e[1]===target.value) : -1
  if (failure.value && target.value === 0) return {x:x(0),y:y(0)}
  const span = failEdge >= 0 ? failEdge + 1 : parallel.value ? edges.value.length : Math.max(1,target.value)
  const route = Math.min(span, props.progress * span / .82)
  const edgeIndex = Math.min(edges.value.length-1,Math.floor(route))
  const edge = edges.value[edgeIndex]!
  const a = edge[0]!, b = edge[1]!, f = Math.min(1,route-edgeIndex)
  const reverse = props.frame.step.effect === 'rollback'
  return { x: reverse ? x(b)+(x(a)-x(b))*f : x(a)+(x(b)-x(a))*f, y: reverse ? y(b)+(y(a)-y(b))*f : y(a)+(y(b)-y(a))*f }
})
</script>
<template>
  <g>
    <text x="38" y="35" class="ac-section">{{ lesson.model === 'engine' ? '本地引擎执行路径' : '机制链路 · 图形节点不代表真实集群状态' }}</text>
    <path v-for="(edge,i) in edges" :key="i" :d="`M${x(edge[0]!)} ${y(edge[0]!)}L${x(edge[1]!)} ${y(edge[1]!)}`" class="ac-process-path" :class="{ 'ac-selected-path': started && i < target, 'ac-blocked-path': failure && i >= target }"/>
    <g v-for="(node,i) in nodes" :key="node" :transform="`translate(${x(i)},${y(i)})`" tabindex="0" role="button" :aria-label="`流程节点 ${node}`" class="ac-clickable" @click="emit('inspect',node,{位置:i+1,当前步骤:frame.step.title,说明:frame.step.caption,执行范围:lesson.model,模拟日志:frame.logs})" @keydown.enter="emit('inspect',node,{说明:frame.step.caption,执行范围:lesson.model})" @keydown.space.prevent="emit('inspect',node,{说明:frame.step.caption})">
      <rect x="-85" y="-48" width="170" height="96" rx="14" class="ac-node" :class="{ 'ac-selected-node': started && i <= target, 'ac-error': started && failure && i === target }"/>
      <text y="-19" text-anchor="middle" class="ac-meta">{{ String(i+1).padStart(2,'0') }}</text><text y="9" text-anchor="middle" class="ac-worker-title">{{ node }}</text><text y="33" text-anchor="middle" class="ac-meta">{{ started && failure && i === target ? '× 选择的阻断关口' : started && i < target ? '✓ 已追踪' : '点击查看' }}</text>
    </g>
    <g v-if="started && progress < .82" :transform="`translate(${motion.x},${motion.y-64})`"><rect x="-34" y="-14" width="68" height="28" rx="7" class="ac-message"/><text text-anchor="middle" y="5" class="ac-message-text">{{ lesson.id==='F04' ? 'offset 103' : ['F07','E10'].includes(lesson.id) ? '身份 / 权限检查' : frame.step.effect === 'rollback' ? '重放' : '数据 / 事件' }}</text></g>
    <g v-if="lesson.id === 'W07'"><g v-for="(mode,i) in modes" :key="mode.name" :transform="`translate(${42+i*265},262)`"><path :d="`M${x(1)-42-i*265} -91L115 0`" class="ac-path"/><rect width="231" height="71" rx="10" class="ac-node" :class="{'ac-selected-node':started&&Math.floor(progress*4)===i}"/><text x="115" y="28" text-anchor="middle" class="ac-worker-title">{{ mode.name }}</text><text x="115" y="53" text-anchor="middle" class="ac-meta">{{ mode.result }}</text></g></g>
    <g v-if="lesson.id === 'F04' && started"><path :d="`M${150+Math.min(1,progress/.82)*780} 91V260`" stroke="#c7aa70" stroke-width="3" stroke-dasharray="6 4"/><text :x="150+Math.min(1,progress/.82)*780" y="76" text-anchor="middle" class="ac-meta">Checkpoint barrier</text><g v-for="(offset,i) in [101,102,103]" :key="offset" :transform="`translate(${100+i*210},281)`"><rect width="188" height="46" rx="7" :class="current>=3&&offset===103?'td-focus-row':'td-row'" :opacity="current>=3&&offset<=102?.38:1"/><text x="12" y="20" class="td-value">示例 offset {{ offset }}</text><text x="12" y="37" class="td-ts">{{ current>=3 ? offset<=102?'已包含在检查点，不重放':'位于检查点之后，恢复重放' : offset<=102?'在示例 barrier 之前':'在示例 barrier 之后' }}</text></g><text x="788" y="304" class="td-label">示例 Checkpoint：offset=102</text></g>
    <rect x="220" y="365" width="640" height="43" rx="10" class="ac-node"/><text x="540" y="393" text-anchor="middle" class="ac-meta">{{ failure ? `当前拦截点：${nodes[target]}，后续链路尚未通过。` : frame.step.effect === 'branch' ? '多条通道在不同关口汇合；点击节点查看该步骤的解释。' : lesson.id==='F04' ? '示意重点：恢复边界决定哪些消息会重放；r26 connector 的提交顺序仍需验证。' : ['F07','E10'].includes(lesson.id) ? '身份认证回答“你是谁”；HDFS/HMS 授权分别回答“是否有权限操作这里”。' : '沿着数据与事件的移动，观察当前步骤经过哪些组件。' }}</text>
  </g>
</template>
