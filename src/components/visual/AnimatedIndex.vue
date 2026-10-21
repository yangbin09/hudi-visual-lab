<script setup lang="ts">
import { computed } from 'vue'
import { bucketOf, teachingHash, teachingHashSteps, BUCKET_ALGORITHM_NOTE } from '@/engine/indexes/bucket'
import { bucketRecords } from '@/engine/visual/scenarios'
import type { HudiTableState } from '@/models/hudi'
import type { LessonFrame } from '@/engine/visual/scenarios'
import type { LessonParameters, VisualLesson } from '@/experiments/visual/types'
const props = defineProps<{ lesson: VisualLesson; frame: LessonFrame; state: HudiTableState; parameters: LessonParameters; progress: number; started: boolean }>()
const emit = defineEmits<{ inspect: [title: string, value: unknown] }>()
const bucketMode = computed(() => props.state.table.indexType === 'BUCKET')
const candidates=computed(()=>props.frame.before.fileGroups.filter(g=>!g.supersededBy).slice(0,6))
const count = computed(() => bucketMode.value ? props.parameters.bucketCount : Math.max(1,candidates.value.length))
const focusKey=computed(()=>props.frame.teaching?.focusKey??props.parameters.recordKey)
const partition=computed(()=>String(props.frame.input?.[0]?.fields.dt??props.parameters.partition))
const hashWalk=computed(()=>teachingHashSteps(focusKey.value))
const hashStep=computed(()=>hashWalk.value.steps[Math.min(hashWalk.value.steps.length-1,Math.floor(props.progress/.35*hashWalk.value.steps.length))])
function inspectHash(){emit('inspect','教学 Hash 的逐字符计算',{initial:hashWalk.value.initial,hashValue:hash.value,bucketCount:count.value,bucket:target.value,计算公式:'从 h=5381 开始：h=(h×33+UTF-16编码单元) 转为32位有符号整数；最后取绝对值，再对桶数取模。',steps:hashWalk.value.steps,note:BUCKET_ALGORITHM_NOTE})}
const hash=computed(()=>teachingHash(focusKey.value))
const target = computed(() => bucketMode.value ? bucketOf(focusKey.value, count.value) : candidates.value.findIndex(g=>g.partitionPath===partition.value&&[...(g.fileSlice.baseFile?.records??[]),...g.fileSlice.logFiles.flatMap(l=>l.records)].some(r=>r.recordKey===focusKey.value)))
const inputAmount=computed(()=>props.frame.input?.[0]?.fields.amount)
const oldAmount=computed(()=>props.frame.before.records.find(r=>r.recordKey===focusKey.value&&r.partitionPath===partition.value)?.fields.amount)
const existing=computed(()=>props.frame.before.records.some(r=>r.recordKey===focusKey.value&&r.partitionPath===partition.value))
const indexType = computed(() => props.lesson.id === 'I02' ? 'Bloom 候选筛选' : bucketMode.value ? '教学 Hash → 取模' : '主键 / 分区定位')
function bx(n: number) { const cols = Math.min(6, count.value); return 540 - cols * 178 / 2 + (n % cols) * 178 }
function by(n: number) { return 231 + Math.floor(n / 6) * 91 }
function candidateRows(n:number){const g=candidates.value[n];return g?[...(g.fileSlice.baseFile?.records??[]),...g.fileSlice.logFiles.flatMap(l=>l.records)]:[]}
function candidateReason(n:number){if(!candidates.value[n])return '没有候选文件'; if(props.lesson.id==='I02'){const maybe=n===target.value||n===(target.value===0?1:0);return props.progress<.44 ? maybe?'示意：可能包含':'示意：粗筛排除' : n===target.value?'精确确认：确有此键':maybe?'误判：精确校验不含此键':'示意：粗筛排除'}return n===target.value&&props.progress>=.44?'匹配分区与主键':'按实际文件内容核对'}
function inspect(n: number) { emit('inspect', bucketMode.value ? `Bucket ${n}` : `候选文件 ${n + 1}`, bucketMode.value ? { bucket: n, records: bucketRecords(props.state, n, count.value,partition.value), fileGroups: props.state.fileGroups.filter(g=>!g.supersededBy && g.bucket===n&&g.partitionPath===partition.value), note: BUCKET_ALGORITHM_NOTE } : candidates.value[n] ?? { note: '候选查找机制示意；此节点没有对应物理文件。' }) }
</script>
<template>
  <g>
    <rect x="58" y="45" width="214" height="84" rx="12" class="ac-node"/><text x="78" y="72" class="ac-meta">待定位记录</text><text x="78" y="100" class="ac-large">key = {{ focusKey }}</text>
    <path d="M272 87H429" class="ac-path"/><g class="ac-clickable" role="button" tabindex="0" aria-label="查看哈希计算" @click="inspectHash" @keydown.enter="inspectHash"><rect x="429" y="45" width="238" height="84" rx="12" class="ac-worker"/><text x="548" y="77" text-anchor="middle" class="ac-worker-title">{{ indexType }}</text><text x="548" y="102" text-anchor="middle" class="ac-meta">{{ bucketMode ? `bucketOf(key, ${count}) = ${target}` : '候选范围 → 精确确认' }}</text></g>
    <rect x="823" y="45" width="200" height="84" rx="12" class="ac-node"/><text x="923" y="78" text-anchor="middle" class="ac-worker-title">{{ partition || '空分区路径' }}</text><text x="923" y="103" text-anchor="middle" class="ac-meta">分区路径 · 定位范围</text><path d="M823 87H667" class="ac-path"/>
    <g v-if="bucketMode" data-detail="hash-calculation"><rect x="58" y="148" width="965" height="49" rx="9" class="td-comparison"/><text x="75" y="174" class="td-value">hash("{{ focusKey }}") = {{ hash }} <tspan x="463">{{ hash }} % {{ count }} = {{ target }}</tspan><tspan x="775" class="td-positive">只能路由到 Bucket {{ target }}</tspan></text><text v-if="hashStep" x="75" y="191" class="td-ts">h 从 5381 开始按字符累积 · 当前字符“{{ hashStep.character }}”编码 {{ hashStep.code }}：{{ hashStep.before }} × 33 + {{ hashStep.code }} → {{ hashStep.after }}（32 位） · 点击 Hash 查看全部步骤</text></g>
    <g v-else><rect x="58" y="148" width="965" height="49" rx="9" class="td-comparison"/><text x="75" y="178" class="td-value">{{ lesson.id==='I02'?'Bloom “可能包含”只是候选：仍须按主键精确确认。':`分区 ${partition || '空路径'} + 主键 ${focusKey}${inputAmount!==undefined ? `：${oldAmount??'未找到'} → ${inputAmount}` : '，必须精确匹配'}` }}</text></g>
    <path v-for="n in count" :key="n" :d="`M548 129Q548 170 ${bx(n-1)+80} ${by(n-1)}`" class="ac-path" :class="{ 'ac-selected-path': started && progress >= .23 && n-1 === target }"/>
    <g v-for="n in count" :key="n" :transform="`translate(${bx(n-1)},${by(n-1)})`" tabindex="0" role="button" :aria-label="bucketMode ? `Bucket ${n-1}` : `候选文件 ${n}`" class="ac-clickable" @click="inspect(n-1)" @keydown.enter="inspect(n-1)" @keydown.space.prevent="inspect(n-1)">
      <rect width="160" height="80" rx="10" class="ac-node" :class="{ 'ac-selected-node': started && target === n-1, 'ac-error': frame.error && target === n-1 }"/><text x="80" y="28" text-anchor="middle" class="ac-worker-title">{{ bucketMode ? `Bucket ${n-1}` : `候选 ${n}` }}</text><text x="80" y="52" text-anchor="middle" class="ac-meta">{{ bucketMode ? bucketRecords(state,n-1,count,partition).length + ' 条记录' : candidateReason(n-1) }}</text><text v-if="!bucketMode" x="80" y="72" text-anchor="middle" class="td-ts">{{ candidateRows(n-1).slice(0,2).map(r=>r.recordKey).join('、')||'空' }}</text><text v-if="bucketMode" x="80" y="72" text-anchor="middle" class="td-ts">{{ bucketRecords(state,n-1,count,partition).slice(0,2).map(r=>r.recordKey+':'+r.fields.amount).join(' · ') || '空桶' }}</text>
    </g>
    <g v-if="started && progress < .82 && (bucketMode || target>=0 || progress<.35)" :transform="`translate(${progress < .35 ? 154 + progress/.35*390 : 548+(bx(Math.max(0,target))+80-548)*Math.min(1,(progress-.35)/.47)},${progress < .35 ? 75 : 87+(by(Math.max(0,target))+18-87)*Math.min(1,(progress-.35)/.47)})`"><rect width="82" height="28" rx="6" class="ac-message"/><text x="41" y="19" text-anchor="middle" class="ac-message-text">{{ focusKey }}</text></g>
    <text x="38" y="416" class="ac-meta">{{ bucketMode ? `${focusKey} ${existing?'是已有主键：改这一行，记录数不增加':'是新主键：增加一行'}。djb2 为教学算法，r26 待验证。` : lesson.id === 'I02' ? '候选筛选为机制示意，未实现真实 Bloom Filter 位图或性能模拟。' : '图形展示查找关口；实际文件与记录以引擎结果为准。' }}</text>
  </g>
</template>
