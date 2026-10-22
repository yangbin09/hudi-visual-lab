<script setup lang="ts">
import { computed } from 'vue'
import { checkpointTrace, conflictTrace } from '@/engine/visual/mechanisms'
import type { LessonParameters } from '@/experiments/visual/types'
const props=defineProps<{id:string;parameters:LessonParameters;current:number;progress:number;started:boolean}>()
const emit=defineEmits<{change:[patch:Partial<LessonParameters>];inspect:[title:string,value:unknown]}>()
const checkpoint=computed(()=>checkpointTrace(props.parameters.checkpointOffset))
const conflict=computed(()=>conflictTrace(props.parameters.writerTarget,props.parameters.occRetry))
const stage=computed(()=>props.started?props.current:-1)
const settled=computed(()=>stage.value===3 && props.progress>=.86)
const moving=computed(()=>Math.max(0,Math.min(1,(props.progress-.12)/.74)))
</script>
<template>
  <div class="mechanism-case" :data-detail="id==='F04'?'checkpoint-recovery':'optimistic-conflict'">
    <div class="mechanism-tools">
      <template v-if="id==='F04'"><label>示例检查点已确认到<select aria-label="检查点确认边界" :value="parameters.checkpointOffset??102" @change="emit('change',{checkpointOffset:Number(($event.target as HTMLSelectElement).value)})"><option v-for="offset in [101,102,103]" :key="offset" :value="offset">offset {{ offset }}</option></select></label><span>收到 104 后故障，观察哪些需要重放</span></template>
      <template v-else><label>Writer B 的目标<select aria-label="Writer B 目标文件组" :value="parameters.writerTarget??'same'" @change="emit('change',{writerTarget:($event.target as HTMLSelectElement).value as 'same'|'different',occRetry:false})"><option value="same">与 A 相同 · FG-A</option><option value="different">与 A 不同 · FG-B</option></select></label><button :disabled="!settled||!conflict.conflict||parameters.occRetry" @click="emit('change',{occRetry:true})">读取新版本并重试</button></template>
    </div>
    <svg class="lesson-canvas" viewBox="0 0 1080 335" role="img" :aria-label="id==='F04'?'消息确认边界与恢复重放':'同版本候选的冲突校验与重试'" data-scene="flow" :data-progress="progress.toFixed(3)">
      <g v-if="id==='F04'">
        <text x="25" y="25" class="mc-title">收到 ≠ 已确认：先保留检查点，再决定恢复范围</text>
        <g v-for="(message,i) in checkpoint.messages" :key="message.offset" :transform="`translate(${25+i*265},45)`">
          <rect width="235" height="92" rx="10" class="ac-node" :class="{'ac-selected-node':stage>=1 && message.offset<=checkpoint.boundary,'ac-error':stage===2 && message.offset>checkpoint.boundary}"/>
          <text x="16" y="27" class="mc-title">offset {{ message.offset }}</text><text x="16" y="51" class="mc-label">{{ message.key }} · 金额 {{ message.amount }}</text><text x="16" y="76" class="mc-label">{{ stage<0?'等待输入':stage===0?'已进入示例缓冲':message.offset<=checkpoint.boundary?'✓ 检查点已确认':'尚未被检查点确认' }}</text>
          <path d="M117 92V130" class="ac-path"/>
          <rect y="130" width="235" height="54" rx="8" class="ac-node" :class="{'ac-selected-node':stage===3 && message.offset>checkpoint.boundary && progress>=.62}"/>
          <text x="117" y="153" text-anchor="middle" class="mc-label">{{ stage<3?'比较 offset 与确认边界':message.offset<=checkpoint.boundary?`${message.offset} ≤ ${checkpoint.boundary} → 跳过`:`${message.offset} > ${checkpoint.boundary} → 重放` }}</text>
          <text x="117" y="172" text-anchor="middle" class="mc-small">{{ stage===3?(message.offset<=checkpoint.boundary?'已确认部分不再重放':'从恢复边界后重新进入处理'):'相同规则逐条检查' }}</text>
          <circle v-if="stage===3 && message.offset>checkpoint.boundary && !settled" cx="117" :cy="97+moving*27" r="6" class="ac-token"/>
        </g>
        <rect x="25" y="250" width="1030" height="49" rx="8" class="ac-node" :class="{'ac-error':stage===2}"/><text x="42" y="279" class="mc-result">{{ stage<1?'先播放，观察消息进入、确认、故障与恢复。':stage===1?`持久化示例检查点：offset=${checkpoint.boundary}`:stage===2?`故障：已收到 104，但不能跳过尚未确认的 ${checkpoint.replay.map(m=>m.offset).join('、')}`:`恢复集合：${checkpoint.replay.map(m=>m.offset).join('、')}；已确认集合：${checkpoint.confirmed.map(m=>m.offset).join('、')}` }}</text>
      </g>
      <g v-else>
        <text x="25" y="25" class="mc-title">先读版本，再提交候选：目标相同且版本改变时，旧候选不能直接覆盖</text>
        <g v-for="(writer,i) in ['A','B']" :key="writer" :transform="`translate(${25+i*530},45)`">
          <rect width="500" height="92" rx="10" class="ac-node"/>
          <text x="16" y="27" class="mc-title">Writer {{ writer }} → {{ i===0?'FG-A':conflict.target }}</text><text x="16" y="51" class="mc-label">输入 key={{ i===0?'1001':conflict.key }} · 候选金额 {{ i===0?'200':'300' }}</text>
          <text x="16" y="76" class="mc-label">{{ stage<1?'等待读取版本':i===1 && parameters.occRetry && stage===3?`重读 v${conflict.retryReadVersion}，重新构造候选`:'读取版本 v7；候选尚未提交' }}</text>
          <path d="M250 92V130" class="ac-path"/>
          <rect y="130" width="500" height="63" rx="8" class="ac-node" :class="{'ac-error':i===1 && settled && !conflict.accepted,'ac-selected-node':stage>=2 && i===0||settled && i===1 && conflict.accepted}"/>
          <text x="16" y="154" class="mc-label">{{ i===0?(stage>=2?'A 已提交：FG-A v7 → v8，金额=200':'A 将先提交自己的更新'):(stage<3?'B 的旧候选仍等待提交校验':`B 校验：读 v${parameters.occRetry?conflict.retryReadVersion:7} / 当前 v${conflict.committedVersion}`) }}</text>
          <text x="16" y="179" class="mc-small">{{ i===0?'只有提交完成，才能成为后续读取的新版本。':!settled?'校验目标文件组是否发生版本变化':conflict.accepted?`✓ 本次允许提交 → ${conflict.target} v${conflict.outputVersion}，金额=300`:'× 版本不一致，拒绝旧候选；A 的金额=200 保留' }}</text>
          <circle v-if="stage===2 && i===0||stage===3 && i===1 && !settled" cx="250" :cy="97+moving*27" r="6" class="ac-token"/>
        </g>
        <rect x="25" y="260" width="1030" height="39" rx="8" class="ac-node"/><text x="42" y="285" class="mc-result">{{ stage<3?'控制变量：切换 B 的目标文件组，对比提交时的版本检查。':!settled?'先比较读版本与目标当前版本，再决定提交、拒绝或重试。':conflict.accepted?'验证通过：候选基于未变的版本，或已重新读取新版本。':'发现冲突：同一目标已被 A 提交，B 需要读取新版本并重试。' }}</text>
      </g>
      <text x="25" y="326" class="mc-small">教学模型 · 未连接真实服务；Flink 检查点与 Hudi 提交顺序、r26 锁及冲突规则需另行验证。</text>
    </svg>
  </div>
</template>
<style scoped>
.mechanism-case{width:100%;height:100%;display:flex;flex-direction:column;min-height:0}.mechanism-tools{display:flex;align-items:center;justify-content:center;gap:15px;padding:10px;flex-wrap:wrap;border-bottom:1px solid var(--vl-line);font-size:12px;color:var(--vl-muted)}.mechanism-tools label{display:flex;align-items:center;gap:10px}.mechanism-tools select{background:var(--vl-bg);color:var(--vl-ink);border:1px solid var(--vl-line);border-radius:6px;padding:6px}.mechanism-tools button{font-size:12px;padding:6px 12px}.mechanism-tools button:disabled{opacity:.4}.mechanism-case svg{flex:1;min-height:0}.mc-title{font:600 15px 'PingFang SC',sans-serif;fill:var(--vl-ink)}.mc-label{font:13px 'PingFang SC',sans-serif;fill:var(--vl-ink)}.mc-small{font:11px 'PingFang SC',sans-serif;fill:var(--vl-muted)}.mc-result{font:14px 'PingFang SC',sans-serif;fill:var(--vl-ink)}@media(max-width:550px){.mechanism-tools>span{display:none}}
</style>
