<script setup lang="ts">
import { computed } from 'vue'
import type { LessonFrame } from '@/engine/visual/scenarios'
import type { HudiRecord } from '@/models/hudi'
const props = defineProps<{ frame: LessonFrame; progress: number; started: boolean }>()
const emit = defineEmits<{ inspect: [title:string,value:unknown] }>()
const trace = computed(()=>props.frame.teaching!)
const merge = computed(()=>trace.value.kind==='merge')
const logWrite = computed(()=>trace.value.outputFile?.type==='LOG')
const rows = computed(()=>merge.value ? trace.value.versions.slice(0,5).map(v=>({record:v.record,source:v.source,winner:v.winner,reason:v.reason})) : trace.value.sourceRecords.slice(0,5).map(record=>({record,source:'BASE',winner:trace.value.copiedKeys.includes(record.recordKey),reason:trace.value.copiedKeys.includes(record.recordKey)?'保持不变':record.recordKey===trace.value.focusKey?'与输入版本比较':'未受本次操作影响'})))
const output = computed(()=>trace.value.outputRecords.slice(0,5))
const input = computed(()=>trace.value.input[0])
const winnerInput = computed(()=>trace.value.input.find(record=>trace.value.outputRecords.some(row=>row.recordKey===record.recordKey && row.fields.amount===record.fields.amount && row.preCombineValue===Number(record.fields.ts)))??input.value)
const inputRejected = computed(()=>!!input.value && (!!winnerInput.value && input.value!==winnerInput.value || props.frame.step.operation==='stale'))
const otherVersions = computed(()=>trace.value.input.slice(1).filter(r=>r.recordKey===trace.value.focusKey))
const acceptedInputs=computed(()=>trace.value.input.filter(record=>trace.value.outputRecords.some(row=>row.recordKey===record.recordKey&&row.fields.amount===record.fields.amount&&row.preCombineValue===Number(record.fields.ts))))
const old = computed(()=>props.frame.before.records.find(r=>r.recordKey===trace.value.focusKey&&r.partitionPath===String(input.value?.fields.dt ?? r.partitionPath)))
const moving = computed(()=>props.started&&props.progress>.5&&props.progress<.82)
const move = computed(()=>Math.max(0,Math.min(1,(props.progress-.52)/.28)))
function y(n:number){return 118+n*30}
function destination(record:HudiRecord){return Math.max(0,output.value.findIndex(r=>r.recordKey===record.recordKey&&r.partitionPath===record.partitionPath))}
function rowProgress(n:number){return Math.max(0,Math.min(1,(props.progress-.52)/.2-n*.1))}
function copyY(row:{record:HudiRecord},i:number){const t=rowProgress(i), a=y(rows.value.findIndex(r=>r.record===row.record)), b=y(destination(row.record));const mid=278+i*8,control=2*mid-(a+b)/2;return (1-t)*(1-t)*a+2*(1-t)*t*control+t*t*b}
const commit = computed(()=>props.frame.after.timeline.find(i=>i.instantTime===props.frame.events[0]?.instantTime))
</script>
<template>
  <g class="record-walkthrough" data-detail="record-versions">
    <text x="28" y="23" class="td-section">{{ merge ? '① 打开真实输入版本' : '① 展开受影响的 Base' }}</text><text x="412" y="23" class="td-section">{{ merge ? '② 同键版本比较' : '② 输入记录与旧版本比较' }}</text><text x="760" y="23" class="td-section">③ {{ logWrite ? '只生成更新 Log' : '逐行生成新 Base' }}</text>
    <rect x="27" y="47" width="338" height="226" rx="12" class="td-file" :class="{'td-preserved':logWrite}"/><text x="45" y="74" class="td-title">{{ merge ? (frame.step.operation==='cluster'?'输入文件记录':'Base + Log 的记录')+(trace.versions.length>5?' · 前5/'+trace.versions.length:'') : trace.sourceFile ? 'Base · '+(trace.sourceRecords.length>5?'前5/':'')+trace.sourceRecords.length+' 条记录' : '该分区没有此主键的 Base' }}</text>
    <text x="45" y="95" class="td-label">KEY <tspan x="110">金额</tspan><tspan x="185">precombine / ts</tspan></text>
    <g v-for="(row,i) in rows" :key="i" :transform="`translate(39,${y(i)-15})`" role="button" tabindex="0" class="ac-clickable" :aria-label="`输入版本 ${row.record.recordKey} ${row.source} ${row.record.fields.amount}`" @click="emit('inspect',`${row.record.recordKey} · ${row.source}`,{...row.record,判断:row.reason})" @keydown.enter="emit('inspect',row.record.recordKey,row.record)">
      <rect width="313" height="26" rx="5" :class="row.record.recordKey===trace.focusKey?'td-focus-row':'td-row'"/><text x="8" y="20" class="td-value">{{ row.record.recordKey }}<tspan x="76">{{ row.record.fields.amount }}</tspan><tspan x="145" class="td-ts">{{ row.record.preCombineValue }}</tspan><tspan x="276" class="td-source">{{ merge ? row.source : trace.copiedKeys.includes(row.record.recordKey) ? '保留' : '' }}</tspan></text>
      <path v-if="merge && started && progress>=.49 && !row.winner" d="M5 15H298" class="td-reject-line"/><text v-if="merge&&started&&progress>=.49&&!row.winner" x="227" y="9" class="td-lost">旧版本淘汰</text>
    </g>
    <text v-if="!rows.length" x="54" y="150" class="td-value">没有旧行需要复制</text><text v-if="logWrite" x="45" y="265" class="td-positive">✓ Base 文件保持不变</text><text v-else-if="started&&progress>=.82&&frame.retired.length" x="45" y="265" class="td-label">旧文件转为 SUPERSEDED，仍未物理删除</text>
    <rect x="397" y="47" width="288" height="69" rx="10" class="td-input"/><text x="413" y="66" class="td-label">{{ merge ? '当前跟踪主键' : '本次真正输入的记录' }}</text><text x="413" y="89" class="td-title">{{ trace.focusKey }} <tspan x="514">{{ merge ? '版本归并' : frame.step.operation==='delete' ? 'operation = D' : '¥ '+input?.fields.amount }}</tspan></text><text x="413" y="106" class="td-ts">{{ input ? 'ts = '+input.fields.ts : '同分区 + 同主键，选择胜出版本' }}</text>
    <path v-if="started && progress>=.44 && inputRejected" d="M410 86H662" class="td-reject-line"/><text v-if="started && progress>=.44 && inputRejected" x="655" y="63" text-anchor="end" class="td-lost">较旧候选，不写入</text>
    <g v-if="otherVersions.length"><rect x="397" y="114" width="288" height="30" rx="7" class="td-row"/><text x="410" y="134" class="td-ts">同批另一版本：¥ {{ otherVersions[0]?.fields.amount }} · ts {{ otherVersions[0]?.fields.ts }}</text></g>
    <text v-if="trace.input.length>1&&!otherVersions.length" x="410" y="132" class="td-ts">本批 {{ trace.input.length }} 条不同主键，各自保留</text>
    <g v-if="started && progress>=.23"><path d="M365 168H397" class="td-arrow"/><rect x="397" :y="otherVersions.length?169:139" width="288" height="92" rx="10" class="td-comparison"/><text x="413" :y="otherVersions.length?191:161" class="td-label">{{ trace.comparison ? '比较 ts，金额大小不决定版本新旧' : frame.step.operation==='stale' ? '旧消息是否能覆盖新数据？' : '为什么选择这个结果？' }}</text><text x="413" :y="otherVersions.length?215:185" class="td-value">{{ merge ? '同键分组 → 比较 ts → 保留胜者' : trace.comparison ? `原 ts = ${trace.comparison.prior}` : old ? `已有 ¥${old.fields.amount} → 输入 ${frame.step.operation==='delete'?'D':'¥'+input?.fields.amount}` : '没有旧记录，按新增路径处理' }}</text><text x="413" :y="otherVersions.length?238:210" class="td-ts">{{ trace.comparison ? `新 ts = ${trace.comparison.incoming} (${trace.comparison.relation} 原 ts)` : frame.step.operation==='stale' ? '较小 ts 被引擎忽略，原状态保持' : logWrite ? '新版本进 Log，旧 Base 不重写' : trace.copiedKeys.length ? trace.copiedKeys.join('、')+' 不变，也要复制到新 Base' : '对照右侧实际生成的记录' }}</text></g>
    <g v-if="started && progress>=.82 && commit"><rect x="397" y="250" width="288" height="45" rx="7" class="td-comparison"/><text x="410" y="269" class="td-value">{{ commit.action }} · {{ commit.state }}</text><text x="410" y="287" class="td-ts">{{ commit.instantTime }}{{ commit.files?.length===0 ? ' · 空提交，没有新数据文件' : ' · 当前引用已切换' }}</text></g>
    <path d="M685 213H736" class="td-arrow"/>
    <rect x="736" y="47" width="316" height="226" rx="12" :class="logWrite?'td-log-file':'td-file'" :opacity="!started?.3:1"/><text x="754" y="74" class="td-title">{{ trace.outputFile ? (logWrite?'Log':'新 Base')+' · '+(trace.outputRecords.length>5?'前5/':'')+trace.outputRecords.length+' 条' : '本步没有新数据文件' }}</text><text x="754" y="95" class="td-label">KEY <tspan x="820">金额</tspan><tspan x="890">保留原因</tspan></text>
    <g v-for="(row,i) in output" :key="i" :transform="`translate(748,${y(i)-15})`" :opacity="started && (progress>=.82 || rowProgress(i)>=1) ? 1 : .1" role="button" :tabindex="progress>=.82?0:-1" :aria-disabled="progress<.82||undefined" :aria-label="`输出记录 ${row.recordKey}`" @click="progress>=.82&&emit('inspect',`输出 ${row.recordKey}`,row)" @keydown.enter="progress>=.82&&emit('inspect',`输出 ${row.recordKey}`,row)">
      <rect width="292" height="26" rx="5" :class="row.operation==='D'?'td-deleted-row':row.recordKey===trace.focusKey?'td-focus-row':'td-row'"/><text x="8" y="20" class="td-value">{{ row.recordKey }}<tspan x="73">{{ row.fields.amount }}</tspan><tspan x="143" class="td-reason">{{ row.operation==='D'?'删除标记 D':frame.step.operation==='bulk'?'批量直接写入':trace.copiedKeys.includes(row.recordKey)?'原样复制':logWrite?'本次更新':'胜出版本' }}</tspan></text>
    </g>
    <text x="754" y="265" class="td-label">{{ progress>=.82 ? '✓ 对应引擎提交后的真实文件内容' : '生成过程预览，提交前不生效' }}</text>
    <g v-if="moving"><g v-for="(row,i) in rows.filter(r=>merge?r.winner:trace.copiedKeys.includes(r.record.recordKey))" :key="i" :transform="`translate(${190+(850-190)*rowProgress(i)},${copyY(row,i)})`"><rect x="-62" y="-14" width="125" height="27" rx="5" class="td-moving-copy"/><text y="5" text-anchor="middle" class="td-moving-label">{{ row.record.recordKey }} · ¥{{ row.record.fields.amount }}</text></g><g v-for="(accepted,n) in acceptedInputs" :key="n" :transform="`translate(${535+rowProgress(n)*335},${(otherVersions.length?128:87)+(y(Math.max(0,output.findIndex(r=>r.recordKey===accepted.recordKey)))-(otherVersions.length?128:87))*rowProgress(n)})`" v-show="trace.outputFile"><rect x="-68" y="-14" width="136" height="27" rx="5" class="ac-message"/><text y="5" text-anchor="middle" class="ac-message-text">{{ accepted.recordKey }} · ¥{{ accepted.fields.amount }}</text></g><g v-if="frame.step.operation==='delete'" :transform="`translate(${535+move*335},${87+move*31})`"><rect x="-50" y="-13" width="100" height="27" rx="5" class="td-deleted-row"/><text y="5" text-anchor="middle" class="td-value">{{ trace.focusKey }} · D</text></g></g>

  </g>
</template>
