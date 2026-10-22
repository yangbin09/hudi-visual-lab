<script setup lang="ts">
import type { HudiRecord } from '@/models/hudi'
withDefaults(defineProps<{title:string;subtitle?:string;rows:HudiRecord[];focus?:string;reveal?:number;muted?:boolean;tone?:string;note?:string}>(),{reveal:1,tone:'base'})
defineEmits<{inspect:[]}>()
</script>
<template>
  <g class="bf" :class="[tone,{muted}]" role="button" tabindex="0" :aria-label="`查看${title}`" @click="$emit('inspect')" @keydown.enter="$emit('inspect')" @keydown.space.prevent="$emit('inspect')">
    <rect width="252" height="184" rx="13" class="bf-paper"/><path d="M215 0V26H252" class="bf-fold"/>
    <rect x="15" y="17" width="5" height="19" rx="2" class="bf-accent"/>
    <text x="29" y="33" class="bs-title">{{ title }}</text><text x="16" y="57" class="bs-small">{{ subtitle&&subtitle.length>31?subtitle.slice(0,17)+'…'+subtitle.slice(-12):subtitle }}</text>
    <text x="24" y="83" class="bs-small">KEY<tspan x="110">金额</tspan><tspan x="177">版本 / ts</tspan></text>
    <g v-for="(row,i) in rows.slice(0,3)" :key="`${row.partitionPath}/${row.recordKey}`" :transform="`translate(14,${93+i*25})`" :opacity="Math.max(.08,Math.min(1,reveal*3-i))">
      <rect width="224" height="22" rx="4" :class="row.recordKey===focus?'bs-focus-row':'bs-quiet-row'"/>
      <text x="10" y="16" class="bs-code">{{ row.recordKey }}<tspan x="96">{{ row.fields.amount }}</tspan><tspan x="163" class="bs-small">{{ String(row.preCombineValue??'').slice(-6) }}</tspan></text>
    </g>
    <text v-if="!rows.length" x="24" y="126" class="bs-small">尚无记录</text>
    <text x="16" y="176" class="bs-small">{{ note ?? `${rows.length} 条记录 · 点击检查文件` }}</text>
  </g>
</template>
<style scoped>
.bf{cursor:pointer;outline:none}.bf-paper{fill:var(--vl-panel);stroke:var(--bs-base);stroke-width:1.5}.bf-fold{fill:none;stroke:var(--bs-base);opacity:.6}.bf-accent{fill:var(--bs-base)}.bf.log .bf-paper{stroke:var(--bs-log)}.bf.log .bf-accent{fill:var(--bs-log)}.bf.muted{opacity:.48}.bf:focus-visible .bf-paper,.bf:hover .bf-paper{stroke:var(--vl-accent);stroke-width:2.5}
</style>
