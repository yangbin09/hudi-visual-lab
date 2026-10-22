<script setup lang="ts">
import { computed } from 'vue'
import type { Scene, Sequence } from '@/animation/useVisualTimeline'
import { activeGroup, focusAmount } from '@/engine/visual/basics'
import { fileRecords } from '@/engine/visual/records'
import { buildTeachingTrace } from '@/engine/visual/teachingTrace'
import BasicsFile from './BasicsFile.vue'
import './basics.css'
const props=defineProps<{topicId:string;scene:Scene;sequence?:Sequence;position:number;duration:number;amount:number}>()
const emit=defineEmits<{inspect:[title:string,value:unknown]}>()
const side=computed(()=>props.topicId==='B02'?'cow':'mor')
const before=computed(()=>props.sequence?.before[side.value]??props.scene[side.value])
const after=computed(()=>props.sequence?.after[side.value]??props.scene[side.value])
const current=computed(()=>props.scene[side.value])
const step=computed(()=>Math.min(Math.floor(props.position),props.duration-1))
const fraction=computed(()=>props.position>=props.duration?1:props.position%1)
const isUpdate=computed(()=>props.sequence?.kind==='update')
const isCompact=computed(()=>props.sequence?.kind==='compact')
const visible=computed(()=>!props.sequence||props.position>=props.duration-1)
const oldBase=computed(()=>activeGroup(before.value)?.fileSlice.baseFile)
const currentSlice=computed(()=>activeGroup(current.value)?.fileSlice)
const trace=computed(()=>props.sequence?buildTeachingTrace({before:before.value,after:after.value,action:props.sequence.actions[side.value],operation:props.sequence.kind==='update'?'upsert':props.sequence.kind==='failure'?'fail':props.sequence.kind,parameters:{recordKey:'1001',amount:props.sequence.amount,bucketCount:4,partition:'2024-01-01',retention:1,failureAt:-1,tableType:before.value.table.tableType}}):undefined)
const outputRows=computed(()=>isUpdate.value||isCompact.value?trace.value?.outputRecords??[]:currentSlice.value?.baseFile?.records??[])
const logs=computed(()=>activeGroup((isCompact.value&&!visible.value?before.value:visible.value?current.value:before.value))?.fileSlice.logFiles??[])
const previewLogs=computed(()=>!visible.value&&isUpdate.value?activeGroup(after.value)?.fileSlice.logFiles??[]:logs.value)
const showOutput=computed(()=>!!props.sequence&&(step.value>=3||visible.value))
const outputReveal=computed(()=>visible.value?1:step.value===3?Math.max(0,Math.min(outputRows.value.length,Math.floor((fraction.value*1.6-1)/.18)+1))/Math.max(1,outputRows.value.length):0)
const move=(i:number)=>Math.max(0,Math.min(1,fraction.value*1.6-i*.18))
function along(points:number[][],t:number){const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]!-points[i]![0]!,p[1]!-points[i]![1]!));let distance=lengths.reduce((a,b)=>a+b,0)*t;for(let i=0;i<lengths.length;i++){const length=lengths[i]!;if(distance<=length){const a=points[i]!,b=points[i+1]!,f=distance/length;return {x:a[0]!+(b[0]!-a[0]!)*f,y:a[1]!+(b[1]!-a[1]!)*f}}distance-=length}const end=points.at(-1)!;return {x:end[0],y:end[1]}}
const readPaths=[[[280,127],[296,127],[296,47],[685,47],[685,102],[717,102]],[[654,157],[685,157],[685,102],[717,102]],[[280,225],[296,225],[296,263],[689,263],[689,219],[717,219]]]
const short=(s:string|undefined|null)=>s?.slice(-6)??'—'
const latestAmount=computed(()=>focusAmount(current.value,'1001'))
const baseAmount=computed(()=>focusAmount(current.value,'1001','read-optimized'))
function inspect(name:string){emit('inspect',name,{...current.value.physicalFiles.find(f=>f.fileName===name),records:fileRecords(current.value,name)})}
</script>
<template>
<div class="basics-scene" :data-detail="`basics-${topicId}`">
  <div class="basics-tools"><strong>{{ topicId==='B02'?'COW · 一行变化，整份受影响 Base 如何重建？':'MOR · 写入、读取、后台合并是三个不同动作' }}</strong><span>{{ sequence?`当前动作：${({update:'更新',snapshot:'读取',schedule:'生成计划',compact:'执行合并',clean:'清理',failure:'模拟失败'})[sequence.kind]}`:'先点 Upsert，观察一次模拟写入' }}</span></div>
  <svg class="vl-canvas" viewBox="0 0 1080 445" role="img" :aria-label="topicId==='B02'?'COW 逐行复制与原子提交':'MOR 多版本日志与两条读取路径'" :data-progress="position.toFixed(3)">
    <defs><pattern id="write-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="currentColor" opacity=".12"/></pattern></defs><rect width="1080" height="445" fill="url(#write-grid)"/>
    <g v-if="topicId==='B02'">
      <text x="28" y="32" class="bs-title">① 读取受影响的旧 Base</text><text x="397" y="32" class="bs-title">② 按主键与 ts 选择版本</text><text x="800" y="32" class="bs-title">③ 生成完整的新 Base</text>
      <g transform="translate(28,67)"><BasicsFile title="原 Base · 不原地修改" :subtitle="`提交 ${short(oldBase?.instantTime)}`" :rows="oldBase?.records??[]" focus="1001" :muted="visible&&!!sequence&&isUpdate" @inspect="oldBase&&emit('inspect',oldBase.fileName,{records:oldBase.records})"/></g>
      <path d="M280 158H367M720 158H800" class="bs-path"/>
      <rect x="367" y="67" width="353" height="73" rx="11" class="bs-soft"/><text x="385" y="91" class="bs-small">本次输入 · 主键 1001</text><text x="385" y="122" class="bs-big">¥ {{ focusAmount(before,'1001') }} → {{ sequence?.amount??amount }}</text>
      <g transform="translate(367,156)" :opacity="isUpdate&&step===3&&!visible?.28:1"><rect width="353" height="95" rx="11" class="bs-panel"/><text x="18" y="29" class="bs-label">{{ isUpdate?'已有键：比较输入与原记录的 ts':'当前操作按引擎执行' }}</text><text x="18" y="55" class="bs-code">{{ trace?.comparison?`${short(String(trace.comparison.incoming))} ${trace.comparison.relation} ${short(String(trace.comparison.prior))}`:'选择本次应保留的记录版本' }}</text><text x="18" y="79" class="bs-small">{{ isUpdate?`未修改的 ${trace?.copiedKeys.join('、')??'1002、1003'} 也要复制`:'文件与查询结果随提交一起切换' }}</text></g>
      <g transform="translate(800,67)" :opacity="showOutput?1:.25" data-testid="cow-output"><BasicsFile :title="isUpdate?'新 Base · 完整记录':'当前 Base'" subtitle="行不变也需要写入新文件" :rows="outputRows" focus="1001" :reveal="showOutput?outputReveal:0" :note="visible?'✓ 提交完成，当前引用已切换':'候选预览 · 提交前不可见'" @inspect="emit('inspect',visible?'COW 输出':'COW 候选',{records:outputRows,说明:visible?'来自已提交文件':'候选预览；当前 Snapshot 尚未切换。'})"/></g>
      <g v-if="isUpdate&&step===3&&!visible" data-detail="cow-mor-row-copy"><g v-for="(row,i) in outputRows.slice(0,3)" :key="row.recordKey" :transform="`translate(${(row.recordKey==='1001'?544:155)+(911-(row.recordKey==='1001'?544:155))*move(i)},${row.recordKey==='1001'?110+(177+i*25-110)*move(i):177+i*25+Math.sin(move(i)*Math.PI)*18})`" :opacity="move(i)<.97?1:0"><rect x="-58" y="-13" width="116" height="26" rx="6" :class="row.recordKey==='1001'?'bs-focus-row':'bs-panel'"/><text text-anchor="middle" y="5" class="bs-code">{{ row.recordKey }} · {{ row.fields.amount }}</text></g></g>
      <rect x="28" y="278" width="1024" height="63" rx="10" class="bs-panel"/><text x="45" y="303" class="bs-label">本次写入 {{ isUpdate?trace?.outputRecords.length??0:0 }} 条完整记录，其中 {{ isUpdate?trace?.copiedKeys.length??0:0 }} 条原样复制</text><text x="45" y="326" class="bs-small">旧文件 {{ current.physicalFiles.filter(f=>f.status==='SUPERSEDED').length }} 个仍物理保留；Cleaner 单独决定何时回收。MOR 对照：Base 不改写，只追加更新。</text>
    </g>
    <g v-else>
      <text x="28" y="32" class="bs-title">{{ isCompact?'① 旧 Slice 切换到新 Slice':'① Base 保持原样' }}</text><text x="321" y="32" class="bs-title">{{ isCompact?'② 同键多版本归并':'② Log 保留增量版本' }}</text><text x="724" y="32" class="bs-title">{{ isCompact&&!visible&&step>=2?'③ 生成候选新 Base':'③ 读取路径决定结果' }}</text>
      <g transform="translate(28,67)"><BasicsFile :title="isCompact&&visible?'合并后的新 Base':'Base · 不改写'" :subtitle="`base instant ${short(currentSlice?.baseInstantTime)}`" :rows="currentSlice?.baseFile?.records??[]" focus="1001" @inspect="currentSlice?.baseFile&&inspect(currentSlice.baseFile.fileName)"/></g>
      <g transform="translate(317,67)"><rect width="337" height="184" rx="13" class="bs-log-panel"/><text x="17" y="31" class="bs-title">{{ previewLogs.length }} 个 Log · 按提交顺序</text><text x="17" y="55" class="bs-small">记录增量，不复制未修改的行</text>
        <g v-for="(log,i) in previewLogs.slice(-3)" :key="log.fileName" :transform="`translate(13,${69+i*33})`" :opacity="!visible&&isUpdate&&i===previewLogs.length-1?Math.max(.15,outputReveal):1" class="bs-hit" role="button" tabindex="0" :aria-label="`MOR Log v${log.version}`" @click="visible&&inspect(log.fileName)" @keydown.enter="visible&&inspect(log.fileName)"><rect width="311" height="29" rx="6" class="bs-panel"/><text x="10" y="20" class="bs-code">v{{ log.version }} @{{ short(log.instantTime) }} · {{ log.records.map(r=>r.recordKey+':'+r.fields.amount).join(' ') }}</text></g>
        <g v-if="isCompact&&!visible&&step>=2"><text x="17" y="168" class="bs-small">同 key：比较 ts，保留最新金额 {{ outputRows.find(r=>r.recordKey==='1001')?.fields.amount }}</text><path d="M337 101H420" class="bs-link"/><circle :cx="337+fraction*83" cy="101" r="6" class="bs-token"/></g>
        <text v-if="!previewLogs.length" x="17" y="108" class="bs-small">{{ isCompact&&visible?'Log 已合并进新 Base':'尚无更新日志，先执行一次 Upsert' }}</text>
      </g>
      <path d="M280 127H296V47H685V102H717M654 157H685V102" class="bs-link"/><path d="M280 225H296V263H689V219H717" class="bs-gold-link"/>
      <g v-if="!isCompact||visible||step<2"><rect x="717" y="67" width="335" height="85" rx="12" class="bs-result"/><text x="735" y="94" class="bs-title">Snapshot · Base + Logs</text><text x="735" y="130" class="bs-big">1001 → ¥ {{ latestAmount }}</text>
      <rect x="717" y="174" width="335" height="77" rx="12" class="bs-log-panel"/><text x="735" y="201" class="bs-title">Read Optimized · 只读 Base</text><text x="735" y="235" class="bs-big">1001 → ¥ {{ baseAmount }}</text>
      </g>
      <g v-if="isCompact&&!visible&&step>=2" transform="translate(745,67)"><BasicsFile title="候选新 Base" subtitle="按主键分组，再比较 ts" :rows="outputRows" focus="1001" :reveal="step===3?outputReveal:.15" note="旧版本淘汰，新版本保留 · 等待提交" @inspect="emit('inspect','归并后的候选记录',{records:outputRows})"/></g>
      <g v-if="sequence?.kind==='snapshot'&&step===1"><circle v-for="(path,i) in readPaths" :key="i" :cx="along(path,fraction).x" :cy="along(path,fraction).y" r="6" class="bs-token" :style="i===2?'fill:var(--bs-log)':undefined"/></g>
      <g v-if="isUpdate&&step===3&&!visible" data-detail="cow-mor-row-copy" :transform="`translate(${400+move(0)*35},${39+move(0)*85})`"><rect x="0" y="0" width="174" height="29" rx="7" class="bs-focus-row"/><text x="14" y="21" class="bs-code">1001 · {{ sequence?.amount }}</text></g>
      <rect x="28" y="278" width="1024" height="63" rx="10" class="bs-panel"/><text x="45" y="303" class="bs-label">{{ isCompact?'Compaction：读取 Base + Log → 同键选出最新版本 → 新 Base':'写入时追加；Snapshot 读时归并；Compaction 后台生成新 Base' }}</text><text x="45" y="326" class="bs-small">{{ isCompact&&visible?'当前 Base 已含更新，两个读法结果一致；旧 Base 与 Log 等待 Cleaner。':`当前读值：Snapshot=${latestAmount} / Read Optimized=${baseAmount}；它们可能不同，因为读取的文件范围不同。` }}</text>
    </g>
    <g transform="translate(28,360)"><rect width="1024" height="60" rx="11" class="bs-soft"/><text x="18" y="26" class="bs-label">{{ visible?'✓ 当前可读版本':'○ 候选生成中 · 尚未提交' }} <tspan x="390" class="bs-code">Snapshot 1001 = <tspan class="vl-query-value">¥ {{ latestAmount }}</tspan></tspan><tspan x="720" class="bs-code">Base-only = <tspan class="vl-query-value">¥ {{ baseAmount }}</tspan></tspan></text><text x="18" y="48" class="bs-small">{{ visible?`最新 Timeline：${current.timeline.at(-1)?.action} · ${current.timeline.at(-1)?.state} · ${current.timeline.at(-1)?.instantTime}`:'生成预览与已提交结果分开显示；到提交阶段才切换文件引用和查询结果。' }}</text></g>
  </svg>
  <div class="basics-key"><span><i></i>Base / 当前引用</span><span><i class="log"></i>Log / 只读 Base 路径</span><span><i class="blue"></i>复制保留的记录</span><span>文件内容来自模拟引擎 · 实际落点以版本与写入方式为准</span></div>
</div>
</template>
