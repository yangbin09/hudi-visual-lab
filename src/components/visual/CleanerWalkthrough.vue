<script setup lang="ts">
import { computed } from 'vue'
import type { LessonFrame } from '@/engine/visual/scenarios'
const props=defineProps<{frame:LessonFrame;progress:number;started:boolean}>()
const emit=defineEmits<{inspect:[title:string,value:unknown]}>()
const trace=computed(()=>props.frame.teaching!)
const rows=computed(()=>[...trace.value.files].sort((a,b)=>Number(b.removed)-Number(a.removed)).slice(0,6))
</script>
<template>
  <g data-detail="cleaner-eligibility"><text x="30" y="23" class="td-section">不是“旧文件都删掉”：逐个检查引用和保留窗口</text>
    <rect x="30" y="40" width="1020" height="38" rx="10" class="td-comparison"/><text x="48" y="56" class="td-label">本地模型保留最近 {{ trace.retention?.count }} 个已完成 Instant</text><text x="48" y="72" class="td-ts">{{ trace.retention?.keepInstants.join(' · ') }}</text>
    <text x="47" y="96" class="td-label">物理文件 <tspan x="332">仍被当前 Slice 引用？</tspan><tspan x="555">为什么保留 / 删除</tspan><tspan x="955">结果</tspan></text>
    <g v-for="(item,i) in rows" :key="item.file.fileName" :transform="`translate(30,${104+i*31})`" role="button" tabindex="0" class="ac-clickable" :aria-label="`清理判断 ${item.file.fileName}`" @click="emit('inspect',item.file.fileName,item)" @keydown.enter="emit('inspect',item.file.fileName,item)">
      <rect width="1020" height="29" rx="5" :class="item.removed&&progress>.55?'td-deleted-row':'td-row'" :opacity="item.removed&&started?Math.max(.18,1-Math.max(0,(progress-.55)/.27)*.82):1"/><text x="16" y="20" class="td-value">{{ item.file.type }} · {{ item.file.createdInstant }}<tspan x="310" :class="item.file.status==='ACTIVE'?'td-positive':'td-ts'">{{ item.file.status==='ACTIVE'?'是 → 不能删':'否 → 再检查窗口' }}</tspan><tspan x="526" class="td-ts">{{ progress>.28 ? item.reason : '等待判断' }}</tspan><tspan x="930" :class="item.removed?'td-lost':'td-positive'">{{ progress>.55 ? item.removed ? progress>=.82?'已删除':'可删除' : '保留' : '…' }}</tspan></text>
    </g>
    <rect x="30" y="293" width="1020" height="34" rx="9" class="td-summary"/><text x="47" y="315" class="td-value">{{ progress>=.82?trace.summary:'先看引用，再看保留窗口；变灰不等于文件已经从存储中消失。' }}</text>
  </g>
</template>
