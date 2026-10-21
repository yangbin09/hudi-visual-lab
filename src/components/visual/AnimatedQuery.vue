<script setup lang="ts">
import { computed } from 'vue'
import { fileRecords, type LessonFrame } from '@/engine/visual/scenarios'
import type { HudiTableState } from '@/models/hudi'
import type { QueryResult } from '@/engine/queries/types'
import type { TeachingTrace } from '@/engine/visual/teachingTrace'
const props = defineProps<{ frame: LessonFrame; state: HudiTableState; query?: QueryResult; trace?:TeachingTrace; progress: number; started: boolean }>()
const emit = defineEmits<{ inspect: [title: string, value: unknown] }>()
const files = computed(() => props.trace?.files.slice(0,4) ?? props.state.physicalFiles.filter(f => f.status === 'ACTIVE').slice(0,4).map(file=>({file,selected:true,removed:false,reason:'当前引用'})))
const result = computed(()=>props.trace?.result??props.query)
const preview = computed(()=>props.frame.teaching?.kind==='query' && props.progress<.82)
const versions = computed(()=>{
  const all=props.trace?.versions??props.frame.teaching?.versions??[]
  const focus=props.trace?.focusKey??props.frame.teaching?.focusKey
  return [...all.filter(v=>v.record.recordKey===focus),...all.filter(v=>v.record.recordKey!==focus).slice(0,1)].slice(0,4)
})
const rows = computed(()=>result.value?.rows.slice(0,4)??[])
const optimized = computed(()=>result.value?.mode==='read-optimized')
const ready = computed(()=>!!props.trace?.result && (!preview.value||props.progress>=.52))
</script>
<template>
  <g data-detail="query-versions">
    <text x="28" y="23" class="td-section">① 哪些文件真正参与读取？</text><text x="393" y="23" class="td-section">② 同键的多个版本，谁胜出？</text><text x="788" y="23" class="td-section">③ {{ optimized?'Base 中的值':'返回记录' }}</text>
    <g v-for="(item,i) in files" :key="item.file.fileName" :transform="`translate(28,${45+i*57})`" :opacity="item.selected?1:.37" class="ac-clickable" role="button" tabindex="0" :aria-label="`读取文件 ${item.file.fileName}`" @click="emit('inspect',item.file.fileName,{...item.file,读取判断:item.reason,records:fileRecords(state,item.file.fileName)})" @keydown.enter="emit('inspect',item.file.fileName,{...item.file,records:fileRecords(state,item.file.fileName)})">
      <rect width="297" height="50" rx="8" :class="item.file.type==='BASE'?'td-file':'td-log-file'"/><text x="13" y="22" class="td-title">{{ item.file.type==='BASE'?'Base':'Log' }} · {{ item.file.recordCount }} 条</text><text x="13" y="41" class="td-label">{{ item.selected?'✓ 打开文件': '× '+item.reason }}</text>
    </g>
    <g v-for="(version,i) in versions" :key="i" :transform="`translate(380,${60+i*55})`" :opacity="version.selected?1:.4" role="button" tabindex="0" class="ac-clickable" :aria-label="`候选记录 ${version.record.recordKey} ${version.source} ${version.record.fields.amount}`" @click="emit('inspect','候选版本的读取判断',version)" @keydown.enter="emit('inspect','候选版本的读取判断',version)">
      <rect width="342" height="47" rx="8" :class="version.returned&&ready?'td-focus-row':'td-row'"/><text x="12" y="21" class="td-value">{{ version.record.recordKey }} · ¥{{ version.record.fields.amount }} <tspan x="235" class="td-label">{{ version.source }}{{ version.record.operation==='D'?' · D':'' }}</tspan></text><text x="12" y="38" class="td-ts">ts {{ version.record.preCombineValue }} <tspan x="159" :class="!version.returned&&ready?'td-lost':'td-ts'">{{ ready?version.reason:'读取候选版本中…' }}</tspan></text><path v-if="ready&&version.selected&&!version.winner" d="M9 18H211" class="td-reject-line"/>
    </g>
    <path v-for="(version,i) in versions" :key="i" :d="`M325 ${70+Math.max(0,files.findIndex(f=>f.file.fileName===version.fileName))*57}L380 ${84+i*55}`" class="td-arrow" :opacity="version.selected?.6:.13"/>
    <g v-if="started&&preview&&progress>.22&&progress<.52"><g v-for="(v,i) in versions.filter(v=>v.selected)" :key="i" :transform="`translate(${325+(progress-.22)/.3*55},${84+versions.indexOf(v)*55})`"><rect x="-44" y="-12" width="88" height="24" rx="5" class="ac-message"/><text y="5" text-anchor="middle" class="ac-message-text">{{ v.record.recordKey }} · {{ v.record.fields.amount }}</text></g></g>
    <rect x="766" y="45" width="286" height="225" rx="12" class="td-file"/><text x="782" y="69" class="td-title">{{ result ? result.rowCount+' 条结果' : '等待实际查询步骤' }}</text>
    <g v-for="(row,i) in rows" :key="i" :transform="`translate(780,${83+i*42})`" :opacity="preview&&!ready?.15:1" class="ac-clickable" role="button" :tabindex="preview?-1:0" :aria-disabled="preview||undefined" :aria-label="`结果记录 ${row.id}`" @click="!preview&&emit('inspect','查询结果记录',row)" @keydown.enter="!preview&&emit('inspect','查询结果记录',row)"><rect width="258" height="40" rx="6" class="ac-result"/><text x="10" y="18" class="td-value">{{ row.id }}<tspan x="112">¥ {{ row.amount }}</tspan></text><text x="10" y="34" class="td-ts">{{ row._hoodie_operation?'operation = '+row._hoodie_operation:row.dt }}</text></g>
    <text x="781" y="263" class="td-label">{{ preview?'正在读取 · 结果预览':'点击结果查看完整字段' }}</text>
    <g v-if="started&&preview&&progress>=.52&&progress<.82"><g v-for="(v,i) in versions.filter(v=>v.returned)" :key="i" :transform="`translate(${690+(progress-.52)/.3*96},${(84+versions.indexOf(v)*55)*(1-(progress-.52)/.3)+(101+Math.max(0,rows.findIndex(row=>row.id===v.record.fields.id))*42)*(progress-.52)/.3})`"><rect x="-45" y="-13" width="90" height="25" rx="5" class="ac-message"/><text y="5" text-anchor="middle" class="ac-message-text">{{ v.record.recordKey }} · {{ v.record.fields.amount }}</text></g></g>
    <rect x="28" y="284" width="1024" height="42" rx="9" class="td-summary"/><text x="45" y="302" class="td-value">{{ optimized?'Log 没有参与读取，里面更新的值也就不会出现在本次结果。':trace?.summary??'先选择文件，再比较候选版本；被划去的旧版本不会进入结果。' }}</text><text x="45" y="319" class="td-ts">{{ result?.notes[0]?.slice(0,110)??'同一份物理数据，读取范围不同，结果可能不同。' }}</text>
  </g>
</template>
