<script setup lang="ts">
/** B02 / B03 share deterministic playback and bookmarks, with separate COW / MOR teaching scenes. */
import { computed, defineAsyncComponent, onMounted, onBeforeUnmount, watch } from 'vue'

import { useVisualTimeline, type Operation, type ComparisonBookmark } from '@/animation/useVisualTimeline'
const WritePrinciples = defineAsyncComponent(() => import('./basics/WritePrinciples.vue'))
import type { HudiTableState } from '@/models/hudi'

const props = defineProps<{
  /** 主题 id（B02 / B03） */
  topicId: string
  /** 画布上的问题 */
  question: string
  /** 副标题 */
  subtitle: string
  /** 更新金额（由外层参数面板控制） */
  amount: number
  /** 工程师模式：显示「模拟失败」 */
  engineer: boolean
  saved?: ComparisonBookmark
}>()

const emit = defineEmits<{
  inspect: [title: string, value: unknown]
  state: [state: HudiTableState]
  watched: []
  caption: [text: string]
  bookmark: [value: ComparisonBookmark]
}>()

const tl = useVisualTimeline(props.topicId)
const { scene, sequence, position, duration, step, settled, playing, speed, caption } = tl

const busy = computed(() => !!sequence.value && !settled.value)
const hasLogs = computed(() => scene.value.mor.fileGroups.some((g) => !g.supersededBy && g.fileSlice.logFiles.length))
const hasPlan = computed(() => scene.value.mor.compactionPlans.some((p) => p.state === 'PLANNED'))
function start(kind: Operation) {
  tl.run(kind, props.amount)
}

function saveBookmark(){emit('bookmark',{...tl.bookmark(),nextAmount:props.amount})}
function saveWhenHidden(){if(document.visibilityState==='hidden')saveBookmark()}
onMounted(()=>{
  if(props.saved)tl.restore(props.saved)
  window.addEventListener('pagehide',saveBookmark)
  document.addEventListener('visibilitychange',saveWhenHidden)
})
onBeforeUnmount(()=>{
  saveBookmark()
  window.removeEventListener('pagehide',saveBookmark)
  document.removeEventListener('visibilitychange',saveWhenHidden)
})
watch(position,()=>{if(!playing.value)saveBookmark()})
watch(playing,(v)=>{if(!v)saveBookmark()})
watch(()=>props.amount,saveBookmark)

/* 状态与旁白同步给外层（详情区 / 统一讲解条） */
watch(
  () => scene.value[props.topicId==='B02'?'cow':'mor'],
  (state) => emit('state', state),
  { immediate: true },
)
watch(caption, (text) => emit('caption', text), { immediate: true })
watch(
  () => settled.value && !!sequence.value,
  (done) => {
    if (done) emit('watched')
  },
)
</script>

<template>
  <section class="cmp-stage vl-stage" :aria-label="topicId==='B02'?'COW 文件重写交互画布':'MOR 日志归并交互画布'">
    <header class="cmp-stage-head">
      <div>
        <h2 class="cmp-question">{{ question }}</h2>
        <p class="cmp-subtitle">{{ subtitle }}</p>
      </div>
      <span class="cmp-status"><i class="vl-dot"></i>{{ busy ? '正在演示' : '交互画布' }}</span>
    </header>

    <div class="vl-action-bar">
      <span>现在试试看</span>
      <button class="vl-primary" :disabled="busy" @click="start('update')">↑ Upsert 更新记录</button>
      <button :disabled="busy" @click="start('snapshot')">Snapshot 读取</button>
      <template v-if="topicId==='B03'"><span class="vl-action-divider"></span>
      <button :disabled="busy || !hasLogs || hasPlan" @click="start('schedule')">① Schedule</button>
      <button :disabled="busy || !hasPlan" @click="start('compact')">② Compaction</button>
      </template>
      <button :disabled="busy" @click="start('clean')">Cleaner</button>
      <button v-if="engineer && topicId==='B03'" :disabled="busy || !hasPlan" @click="start('failure')">模拟失败</button>
    </div>

    <div class="cmp-canvas-wrap">
      <WritePrinciples :topic-id="topicId" :scene="scene" :sequence="sequence" :position="position" :duration="duration" :amount="amount" @inspect="(title,value)=>emit('inspect',title,value)"/>
    </div>

    <div class="vl-caption" aria-live="polite">
      <span class="vl-step-number">{{ String(sequence ? step + 1 : 0).padStart(2, '0') }}</span>
      <div>
        <small>{{ sequence ? '观察正在发生的变化' : '从这里开始 · 约 1 分钟' }}</small>
        <p>{{ caption }}</p>
      </div>
      <span class="vl-caption-count">{{ sequence ? `${step + 1} / ${duration}` : topicId==='B02'?'COW':'MOR' }}</span>
    </div>

    <div class="vl-controls" aria-label="动画播放控件">
      <div class="vl-playback">
        <button aria-label="上一步" :disabled="!sequence || position === 0" @click="tl.back">|◀</button>
        <button
          class="vl-play"
          :aria-label="playing ? '暂停' : '播放'"
          @click="!sequence ? start('update') : playing ? tl.pause() : tl.play()"
        >
          {{ playing ? 'Ⅱ' : '▶' }}
        </button>
        <button aria-label="下一步" :disabled="!sequence || settled" @click="tl.next">▶|</button>
        <button aria-label="重放" :disabled="!sequence" @click="tl.pause(); position = 0; tl.play()">↺</button>
        <select v-model.number="speed" aria-label="播放速度">
          <option :value="0.5">0.5×</option>
          <option :value="1">1×</option>
          <option :value="2">2×</option>
        </select>
      </div>
      <div class="vl-progress">
        <input
          type="range"
          min="0"
          :max="duration"
          :value="position"
          step="0.01"
          aria-label="动画进度"
          :disabled="!sequence"
          @input="tl.pause(); position = Number(($event.target as HTMLInputElement).value)"
        />
        <button :disabled="!busy" @click="tl.skip">跳过动画</button>
      </div>
      <button class="vl-reset" @click="tl.reset">重置实验</button>
    </div>


  </section>
</template>

<style scoped>
.cmp-stage {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--vl-line);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vl-panel);
}
.cmp-stage > .vl-action-bar {padding:10px; border-top:0; border-bottom:1px solid var(--vl-line);flex-wrap:wrap}
.cmp-stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--vl-line);
}
.cmp-question {
  margin: 0;
  font-size: var(--vl-fs-lg, 16px);
  color: var(--vl-ink);
}
.cmp-subtitle {
  margin: 4px 0 0;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.cmp-status {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  white-space: nowrap;
}
.cmp-canvas-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 0;
}
.cmp-canvas-wrap .vl-canvas {
  width: 100%;
  height: auto;
  max-height: 320px;
}
.vl-teaching-note {
  font: 12px 'PingFang SC', sans-serif;
  fill: var(--vl-ink);
}
@media (max-width: 550px) {
  .cmp-canvas-wrap {
    justify-content: flex-start;
    overflow-x: auto;
  }
  .cmp-canvas-wrap .vl-canvas {
    width: 900px;
    min-width: 900px;
    flex: none;
  }
}
</style>
