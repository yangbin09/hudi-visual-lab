<script setup lang="ts">
/**
 * ExperimentLayout —— 实验页三栏 + 底部 Tab 的骨架布局
 * ---------------------------------------------------------------------------
 * 职责边界：**只提供结构，不提供内容**。
 * 所有业务内容（文件树、Timeline、记录表、参数面板、SQL、证据、练习）都由
 * 调用方通过插槽填入，本组件不认识任何 Hudi 概念。
 *
 * 栅格：
 *   左栏 240px  |  中栏 flex-1  |  右栏 320px
 *   底部 Tab 区默认 320px 高，可折叠。
 */
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 顶部标题条（可选） */
    title?: string
    /** 底部 Tab 区高度（px），默认 320 */
    bottomHeight?: number
  }>(),
  {
    title: '',
    bottomHeight: 320,
  },
)

/** 底部 Tab 区是否折叠 */
const bottomCollapsed = ref(false)

const bottomStyle = computed<string>(() =>
  bottomCollapsed.value ? '32px' : `${props.bottomHeight}px`,
)

function toggleBottom(): void {
  bottomCollapsed.value = !bottomCollapsed.value
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-3">
    <!-- ============================ 顶部（可选） ============================ -->
    <header
      v-if="title || $slots.header"
      class="shrink-0 rounded-lg border border-[var(--color-hudi-border)] bg-[var(--color-hudi-panel)] px-4 py-2"
    >
      <h2 v-if="title" class="text-sm font-semibold">{{ title }}</h2>
      <slot name="header" />
    </header>

    <!-- ============================ 三栏 ============================ -->
    <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-12">
      <!-- 左栏：240px -->
      <aside
        class="min-h-0 overflow-y-auto xl:col-span-2"
        style="width: 240px"
      >
        <slot name="left" />
      </aside>

      <!-- 中栏：自适应 -->
      <main class="min-h-0 min-w-0 overflow-y-auto xl:col-span-7">
        <slot />
      </main>

      <!-- 右栏：320px -->
      <aside class="min-h-0 overflow-y-auto xl:col-span-3" style="width: 320px">
        <slot name="right" />
      </aside>
    </div>

    <!-- ============================ 底部 Tab ============================ -->
    <section
      class="flex min-h-0 shrink-0 flex-col rounded-lg border border-[var(--color-hudi-border)] bg-[var(--color-hudi-panel)] p-2 transition-[height] duration-200"
      :style="{ height: bottomStyle }"
    >
      <div class="flex shrink-0 items-center gap-2 pb-1">
        <span class="text-xs font-semibold text-[var(--color-hudi-muted)]">明细面板</span>
        <slot name="tabs-toolbar" />
        <button
          type="button"
          class="ml-auto rounded px-1.5 py-0.5 text-xs text-[var(--color-hudi-muted)] transition-colors hover:bg-[var(--color-hudi-border)]/40 hover:text-[var(--color-hudi-text)]"
          :title="bottomCollapsed ? '展开底部面板' : '折叠底部面板'"
          @click="toggleBottom"
        >
          {{ bottomCollapsed ? '▲' : '▼' }}
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <slot name="tabs" />
      </div>
    </section>
  </div>
</template>
