<script setup lang="ts">
/**
 * LogPanel —— 模拟终端日志
 * ---------------------------------------------------------------------------
 * 只渲染引擎产生的日志文本，不做任何加工（不排序、不去重、不改写），
 * 缩进与换行必须原样保留 —— 日志的顺序本身就是排查线索。
 */
import { computed, nextTick, ref, watch } from 'vue'

const props = defineProps<{ logs: string[]; title?: string }>()

const bodyRef = ref<HTMLElement | null>(null)
const autoScroll = ref(true)

const lines = computed<string[]>(() => props.logs ?? [])
const title = computed<string>(() => props.title ?? '模拟执行日志')

/** 新日志到达时滚到底部；用户手动上翻后自动停止跟随 */
watch(
  () => lines.value.length,
  async () => {
    if (!autoScroll.value) return
    await nextTick()
    const el = bodyRef.value
    if (el) el.scrollTop = el.scrollHeight
  },
)

function onScroll(): void {
  const el = bodyRef.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
  autoScroll.value = atBottom
}
</script>

<template>
  <section
    class="flex min-h-0 flex-col overflow-hidden rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[#0b1120]"
  >
    <!-- 标题栏 -->
    <header
      class="flex items-center gap-2 border-b border-[var(--color-hudi-border,#1f2937)] bg-slate-900/60 px-3 py-1.5"
    >
      <span class="text-[11px] font-semibold text-slate-300">{{ title }}</span>
      <span class="text-[11px] text-slate-500">{{ lines.length }} 行</span>
      <button
        v-if="lines.length"
        type="button"
        class="ml-auto rounded border border-slate-700 px-1.5 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
        :class="autoScroll ? 'text-emerald-400' : ''"
        :title="autoScroll ? '已开启自动滚动' : '自动滚动已暂停（你正在向上翻看）'"
        @click="autoScroll = !autoScroll"
      >
        {{ autoScroll ? '自动滚动：开' : '自动滚动：关' }}
      </button>
    </header>

    <!-- 日志正文 -->
    <div ref="bodyRef" class="max-h-[26rem] min-h-[6rem] overflow-y-auto px-3 py-2" @scroll="onScroll">
      <div
        v-if="!lines.length"
        class="py-6 text-center text-xs text-slate-500"
      >
        暂无日志
      </div>
      <pre
        v-else
        class="whitespace-pre-wrap break-words font-mono text-[11.5px] leading-relaxed text-slate-200"
      >{{ lines.join('\n') }}</pre>
    </div>
  </section>
</template>
