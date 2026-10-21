<script setup lang="ts">
import { computed } from 'vue'
import { teachingHash, bucketOf, teachingHashSteps } from '@/engine/indexes/bucket'
import type { LessonParameters } from '@/experiments/visual/types'
const props=defineProps<{jobIndex:'SIMPLE'|'BUCKET';current:number;progress:number;started:boolean;parameters:LessonParameters}>()
const emit=defineEmits<{change:[index:'SIMPLE'|'BUCKET'];inspect:[title:string,value:unknown]}>()
const matched=computed(()=>props.jobIndex==='BUCKET')
const phase=computed(()=>props.started?props.current:-1)
const hash=computed(()=>teachingHash(props.parameters.recordKey))
const bucket=computed(()=>bucketOf(props.parameters.recordKey,props.parameters.bucketCount))
const travel=computed(()=>props.progress<.6?Math.min(1,Math.max(0,(props.progress-.12)/.24)):Math.min(1,(props.progress-.6)/.26))
function inspectHash(){emit('inspect','主键如何得到桶号',{...teachingHashSteps(props.parameters.recordKey),recordKey:props.parameters.recordKey,bucketCount:props.parameters.bucketCount,bucket:bucket.value,note:'djb2 教学算法；不代表 r26 的实际映射。'})}
</script>
<template>
  <div class="index-case" data-detail="index-config">
    <div class="index-case-tools"><span>试一试：表固定为 BUCKET</span><label>本次作业选项<select aria-label="本次作业索引" :value="jobIndex" @change="emit('change',($event.target as HTMLSelectElement).value as 'SIMPLE'|'BUCKET')"><option>SIMPLE</option><option>BUCKET</option></select></label><button :disabled="matched" @click="emit('change','BUCKET')">对齐为 BUCKET 并重演</button></div>
    <svg class="lesson-canvas" viewBox="0 0 1080 280" role="img" aria-label="表索引与作业索引的定位方式对照" data-scene="flow" :data-progress="progress.toFixed(3)">
      <text x="30" y="16" class="ic-muted">① 两份配置从哪里来？</text>
      <g :opacity="phase>=0?1:.65"><rect x="30" y="28" width="300" height="75" rx="10" class="ac-node" :class="{'ac-selected-node':phase===0}"/><text x="48" y="49" class="ic-muted">表定义 · 已有表的索引类型</text><text x="48" y="75" class="ic-value">BUCKET</text><text x="48" y="94" class="ic-muted">预期：主键 → 桶 → File Group</text></g>
      <g :opacity="phase>=1?1:.45"><rect x="385" y="28" width="300" height="75" rx="10" class="ac-node" :class="{'ac-selected-node':phase===1}"/><text x="403" y="49" class="ic-muted">作业选项 · 本案例手动选择</text><text x="403" y="75" class="ic-value">{{ jobIndex }}</text><text x="403" y="94" class="ic-muted">{{ matched?'预期：主键 → 桶 → File Group':'预期：主键 → 匹配已有键与文件位置' }}</text></g>
      <text x="350" y="70" class="ic-muted">vs</text><path d="M685 66H746" class="ac-process-path"/>
      <g :opacity="phase>=2?1:.4"><rect x="746" y="28" width="304" height="75" rx="10" class="ac-node" :class="phase>=2?(matched?'ac-selected-node':'ac-error'):''"/><text x="764" y="49" class="ic-muted">② 比较的结果</text><text x="764" y="75" class="ic-result" :class="{'ic-warning':!matched&&phase>=2}">{{ phase<2?'等待比对':matched?'BUCKET = BUCKET · 一致':'BUCKET ≠ SIMPLE · 不一致' }}</text><text x="764" y="94" class="ic-muted">{{ phase<2?'播放或单步，沿配置来源观察':matched?'配置已对齐，继续验证实际作业':'这是排查线索，还不是异常根因' }}</text></g>
      <text x="30" y="125" class="ic-muted">③ 为什么值得核对？两种索引的定位方式不同</text>
      <g :opacity="phase>=2?1:.35">
        <rect x="30" y="138" width="495" height="98" rx="10" class="ac-node" :class="!matched&&phase>=2?'ac-error':''"/>
        <text x="48" y="158" class="ic-title">SIMPLE · 先按主键匹配已有位置</text>
        <path d="M135 191H210M345 191H398" class="ac-path"/>
        <rect x="48" y="175" width="88" height="34" rx="6" class="ac-node"/><text x="92" y="197" text-anchor="middle" class="ic-mono">{{ parameters.recordKey }}</text>
        <rect x="210" y="170" width="135" height="46" rx="6" class="ac-node" :class="{'ac-selected-node':phase===3&&!matched&&progress>=.36}"/><text x="277" y="185" text-anchor="middle" class="ic-small">其他 key → 文件 A</text><text x="277" y="201" text-anchor="middle" class="ic-small" :class="{'ic-match':phase===3&&!matched&&progress>=.6}">{{ parameters.recordKey }} → 文件 B</text>
        <rect x="398" y="175" width="108" height="34" rx="6" class="ac-node"/><text x="452" y="197" text-anchor="middle" class="ic-small">{{ phase===3&&!matched&&progress>=.86?'✓ 文件 B':'文件位置' }}</text>
        <text x="48" y="229" class="ic-muted">位置表示例；不是“算错了桶”，而是另一种定位策略。</text>
        <circle v-if="phase===3&&!matched" :cx="progress<.6?145+travel*55:352+travel*38" cy="191" r="5" class="ac-token"/>
        <rect x="545" y="138" width="505" height="98" rx="10" class="ac-node" :class="matched&&phase>=2?'ac-selected-node':''"/>
        <text x="563" y="158" class="ic-title">BUCKET · 用同一主键算出固定桶</text>
        <path d="M651 191H678M880 191H921" class="ac-path"/>
        <rect x="563" y="175" width="88" height="34" rx="6" class="ac-node"/><text x="607" y="197" text-anchor="middle" class="ic-mono">{{ parameters.recordKey }}</text>
        <g role="button" tabindex="0" aria-label="查看本案例分桶计算" class="ac-clickable" @click="inspectHash" @keydown.enter.prevent="inspectHash" @keydown.space.prevent="inspectHash"><rect x="678" y="170" width="202" height="46" rx="6" class="ac-node" :class="{'ac-selected-node':phase===3&&matched&&progress>=.36}"/><text x="779" y="185" text-anchor="middle" class="ic-small">hash(key) % {{ parameters.bucketCount }}</text><text x="779" y="201" text-anchor="middle" class="ic-small">{{ hash }} % {{ parameters.bucketCount }} = {{ bucket }} ↗</text></g>
        <rect x="921" y="175" width="110" height="34" rx="6" class="ac-selected-node"/><text x="976" y="197" text-anchor="middle" class="ic-mono">{{ phase===3&&matched&&progress>=.86?'✓ ':'' }}桶 {{ bucket }}</text>
        <text x="563" y="229" class="ic-muted">同一分区、桶数不变时，相同 key 定位到相同桶。</text>
        <circle v-if="phase===3&&matched" :cx="progress<.6?658+travel*12:888+travel*25" cy="191" r="5" class="ac-token"/>
      </g>
      <text x="30" y="255" class="ic-conclusion">{{ phase<3?'先追来源，再看策略；最后由你修改配置并复查。':matched?'✓ 配置一致；现在选用分桶策略。下一步应在真实环境重跑并核对日志。':'发现差异 → 用上方按钮对齐作业选项 → 重演并比较结果。' }}</text>
      <text x="30" y="275" class="ic-footnote">教学案例：假设采用所选作业选项；不推断真实配置优先级。哈希为教学算法，r26 异常根因仍需日志验证。</text>
    </svg>
  </div>
</template>
<style scoped>
.index-case{width:100%;height:100%;display:flex;flex-direction:column;min-height:0}.index-case-tools{display:flex;align-items:center;justify-content:center;gap:20px;padding:10px 16px;flex-shrink:0;font-size:12px;color:var(--vl-muted);border-bottom:1px solid var(--vl-line)}.index-case-tools label{display:flex;align-items:center;gap:9px}.index-case-tools select{padding:5px 12px;color:var(--vl-ink);background:var(--vl-bg);border:1px solid var(--vl-line);border-radius:5px}.index-case-tools button{font-size:12px;padding:6px 12px}.index-case-tools button:disabled{opacity:.4;cursor:default}.index-case svg{flex:1;min-height:0}.ic-muted{font:12px 'PingFang SC',sans-serif;fill:var(--vl-muted)}.ic-value{font:600 24px ui-monospace,monospace;fill:var(--vl-ink)}.ic-result{font:600 17px 'PingFang SC',sans-serif;fill:var(--vl-ink)}.ic-match{fill:var(--vl-accent);font-weight:700}.ic-warning{fill:var(--ac-red)}.ic-title{font:600 14px 'PingFang SC',sans-serif;fill:var(--vl-ink)}.ic-mono{font:14px ui-monospace,monospace;fill:var(--vl-ink)}.ic-small{font:12px 'PingFang SC',sans-serif;fill:var(--vl-ink)}.ic-conclusion{font:14px 'PingFang SC',sans-serif;fill:var(--vl-ink)}.ic-footnote{font:10px 'PingFang SC',sans-serif;fill:var(--vl-muted)}@media(max-width:850px){.index-case-tools{gap:8px;flex-wrap:wrap;padding:8px}.index-case-tools>span{display:none}}
</style>
