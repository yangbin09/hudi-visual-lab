<script setup lang="ts">
import { computed } from 'vue'
import type { LessonFrame } from '@/engine/visual/scenarios'
import type { HudiTableState, HudiInstant } from '@/models/hudi'
const props = defineProps<{ frame: LessonFrame; state: HudiTableState; progress: number; started: boolean }>()
const emit = defineEmits<{ inspect: [title: string, value: unknown] }>()
const instants = computed(() => props.state.timeline.slice(-7))
const changes = computed(() => props.frame.after.timeline.filter(i => !props.frame.before.timeline.some(b => b.instantTime === i.instantTime && b.state === i.state)))
const focused = computed(()=>props.frame.step.operation==='rollback'?props.frame.before.pendingInstants.at(-1):props.frame.step.operation==='archive'?props.frame.before.timeline.find(i=>props.frame.after.archivedInstants.some(a=>a.instantTime===i.instantTime)):changes.value[0])
const prior = computed(()=>props.frame.before.timeline.find(i=>i.instantTime===focused.value?.instantTime))
const final = computed(()=>props.frame.after.timeline.find(i=>i.instantTime===focused.value?.instantTime))
const explanation = computed(()=>props.frame.step.operation==='archive'?'旧 Instant 被移到 Archive；数据文件不动。':props.frame.step.operation==='rollback'?'该未完成事务被移出；另写 ROLLBACK 记录，其他已完成提交保留。':props.frame.step.operation==='fail'?'上层作业可以显示成功，但这个事务仍未 COMPLETED。':props.frame.step.operation==='schedule'?'只有计划就绪：没有生成新 Base，不能画成提交完成。':'对比同一个 Instant 的状态，而不是只看新增了几个圆点。')
function x(i: number) { return 88 + i * 146 }
function inspect(instant: HudiInstant) { emit('inspect',`${instant.instantTime} · ${instant.action}`,instant) }
</script>
<template>
  <g>
    <text x="38" y="33" class="ac-section">活跃 Timeline · {{ state.timeline.length }} 个 Instant</text><text x="38" y="58" class="ac-meta">只展示引擎快照中的真实模拟状态；请求、执行动画不会虚构成功提交。</text>
    <path d="M74 151H1010" class="ac-process-path"/>
    <g v-for="(instant,i) in instants" :key="instant.instantTime" :transform="`translate(${x(i)},151)`" role="button" tabindex="0" class="ac-clickable" :aria-label="`Instant ${instant.instantTime}`" @click="inspect(instant)" @keydown.enter="inspect(instant)" @keydown.space.prevent="inspect(instant)">
      <circle r="15" :class="instant.state === 'COMPLETED' ? 'ac-complete-dot' : 'ac-pending-dot'"/><text y="5" text-anchor="middle" class="ac-status-icon">{{ instant.state === 'COMPLETED' ? '✓' : '…' }}</text><text y="42" text-anchor="middle" class="ac-worker-title ac-time-action">{{ instant.action }}</text><text y="63" text-anchor="middle" class="ac-meta">{{ instant.instantTime.slice(8) }}</text><text y="84" text-anchor="middle" class="ac-meta">{{ instant.state }}</text>
    </g>
    <g v-if="started && progress < .82 && focused"><rect :x="370+progress*110" y="84" width="232" height="34" rx="8" class="ac-node"/><text :x="486+progress*110" y="106" text-anchor="middle" class="ac-meta">{{ focused.instantTime }} · {{ focused.action }}</text></g>
    <circle v-if="started && frame.step.effect === 'archive' && progress < .82" :cx="88+progress/.82*140" :cy="151+progress/.82*170" r="10" class="ac-token"/>
    <rect x="38" y="274" width="620" height="112" rx="12" class="ac-node"/>
    <text x="55" y="297" class="td-title">{{ focused ? focused.instantTime : '先选定一个实际 Instant' }}</text>
    <text x="55" y="324" class="td-value">操作前：{{ prior?.state??'尚未存在' }} <tspan x="324">→ {{ progress<.82?'结果预览：':'操作后：' }}{{ final?.state ?? (frame.step.operation==='archive'?'已归档':focused?'已移出':'没有状态变化') }}</tspan></text>
    <text x="55" y="350" class="td-ts">{{ explanation.slice(0,53) }}</text><text x="55" y="373" class="td-ts">{{ frame.teaching?.summary?.slice(0,65)??'没有提交成功的状态，就不产生成功的新文件快照。' }}</text>
    <rect x="702" y="289" width="340" height="94" rx="12" class="ac-worker"/><text x="724" y="318" class="ac-worker-title">当前文件引用</text><text x="724" y="346" class="ac-meta">{{ state.physicalFiles.filter(f=>f.status==='ACTIVE').length }} 个有效文件 · {{ state.pendingInstants.length }} 个 pending</text><text x="724" y="369" class="ac-meta">归档 {{ state.archivedInstants.length }} 个 Instant</text>
  </g>
</template>
