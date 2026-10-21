<script setup lang="ts">
/**
 * StepRunner —— 实验步骤执行器
 * ---------------------------------------------------------------------------
 * 契约 §6 约定的 props / emits：
 *   props: { steps: ExperimentStep[]; currentIndex: number }
 *   emits: (e: 'run', step: ExperimentStep, index: number): void
 *          (e: 'reset'): void
 *          (e: 'goto', index: number): void
 *
 * 职责边界：只负责「按什么顺序、把哪一步交出去」，
 * 动作真正的执行由父组件 → store → engine 完成，本组件不碰任何 Hudi 语义。
 */
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'

import type { ExperimentStep } from '@/models/simulation'

const props = withDefaults(
  defineProps<{
    steps: ExperimentStep[]
    currentIndex: number
    /** 自动播放间隔（ms） */
    interval?: number
  }>(),
  {
    interval: 1500,
  },
)

const emit = defineEmits<{
  (e: 'run', step: ExperimentStep, index: number): void
  (e: 'reset'): void
  (e: 'goto', index: number): void
}>()

/* -------------------------------------------------------------------------- */
/* 内部状态                                                                      */
/* -------------------------------------------------------------------------- */

/** 本地当前下标：父组件通过 currentIndex 同步回来 */
const localIndex = ref<number>(props.currentIndex)

watch(
  () => props.currentIndex,
  (value) => {
    if (typeof value === 'number' && value >= 0) localIndex.value = value
  },
)

/** 是否正在自动播放 */
const playing = ref(false)

/** 定时器句柄；onBeforeUnmount 必须清掉，否则组件卸载后仍在跑 */
let timer: number | undefined

const stepList = computed<ExperimentStep[]>(() => props.steps ?? [])

const currentStep = computed<ExperimentStep | null>(() => stepList.value[localIndex.value] ?? null)

const isLastStep = computed<boolean>(() => localIndex.value >= stepList.value.length - 1)

/* -------------------------------------------------------------------------- */
/* 执行                                                                        */
/* -------------------------------------------------------------------------- */

/** 执行第 index 步 */
function runStep(index: number): void {
  const step = stepList.value[index]
  if (!step) return
  localIndex.value = index
  // toRaw：props 是响应式代理，Proxy 不能被 structuredClone，父组件拿到后可能直接崩
  emit('run', toRaw(step), index)
}

/** 点击步骤列表：只切换高亮，是否执行由用户再点「单步执行」 */
function onSelect(index: number): void {
  localIndex.value = index
  emit('goto', index)
}

/* -------------------------------------------------------------------------- */
/* 自动播放                                                                    */
/* -------------------------------------------------------------------------- */

function stopAutoPlay(): void {
  playing.value = false
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
}

function startAutoPlay(fromIndex = 0): void {
  stopAutoPlay()
  if (!stepList.value.length) return
  playing.value = true
  localIndex.value = fromIndex
  timer = window.setInterval(() => {
    const next = localIndex.value + 1
    if (next >= stepList.value.length) {
      stopAutoPlay()
      return
    }
    localIndex.value = next
    emit('goto', next)
    runStep(next)
  }, props.interval)
}

function toggleAutoPlay(): void {
  if (playing.value) {
    stopAutoPlay()
    return
  }
  // 从当前步骤往后播；当前是最后一步时从头再播一遍
  const start = localIndex.value >= stepList.value.length - 1 ? 0 : localIndex.value
  startAutoPlay(start)
}

/** 重新执行：先复位，再从头自动重放整个实验 */
function replayAll(): void {
  stopAutoPlay()
  emit('reset')
  if (!stepList.value.length) return
  localIndex.value = 0
  startAutoPlay(0)
}

onBeforeUnmount(() => {
  stopAutoPlay()
})
</script>

<template>
  <div class="space-y-2">
    <!-- ============================ 控制按钮 ============================ -->
    <div class="flex flex-wrap gap-1.5">
      <el-button
        size="small"
        type="primary"
        plain
        :disabled="!currentStep"
        title="执行当前高亮的步骤"
        @click="runStep(localIndex)"
      >
        单步执行
      </el-button>

      <el-button
        size="small"
        plain
        :disabled="!playing"
        title="暂停自动播放"
        @click="stopAutoPlay"
      >
        暂停
      </el-button>

      <el-button
        size="small"
        :type="playing ? 'warning' : 'default'"
        :plain="!playing"
        :disabled="!stepList.length"
        title="按固定间隔自动依次执行所有步骤"
        @click="toggleAutoPlay"
      >
        {{ playing ? '自动播放中…' : '自动播放' }}
      </el-button>

      <el-button
        size="small"
        plain
        :disabled="!stepList.length"
        title="复位到实验初始状态，然后从头自动重放一遍"
        @click="replayAll"
      >
        重新执行
      </el-button>

      <el-button
        size="small"
        type="danger"
        plain
        title="恢复到实验初始状态（不产生任何 instant）"
        @click="emit('reset')"
      >
        恢复初始状态
      </el-button>
    </div>

    <!-- ============================ 步骤列表 ============================ -->
    <ol v-if="stepList.length" class="space-y-1">
      <li v-for="(step, index) in stepList" :key="step.stepId">
        <button
          type="button"
          class="w-full rounded px-2 py-1.5 text-left text-[11px] leading-snug transition-colors"
          :class="
            index === localIndex
              ? 'bg-[var(--color-hudi-accent)]/15 text-[var(--color-hudi-accent)]'
              : 'text-[var(--color-hudi-muted)] hover:bg-[var(--color-hudi-border)]/30 hover:text-[var(--color-hudi-text)]'
          "
          :title="step.description"
          @click="onSelect(index)"
        >
          <span class="mr-1 font-mono">{{ index + 1 }}.</span>{{ step.title }}
        </button>
      </li>
    </ol>
    <p v-else class="text-[11px] text-[var(--color-hudi-muted)]">该实验尚未定义步骤。</p>

    <!-- ============================ 当前步骤说明 ============================ -->
    <p v-if="currentStep" class="text-[11px] leading-relaxed text-[var(--color-hudi-muted)]">
      {{ currentStep.description }}
    </p>
    <p v-if="isLastStep && playing" class="text-[10px] text-[var(--color-hudi-muted)]">
      已是最后一步，自动播放将在本步结束后停止。
    </p>
  </div>
</template>
