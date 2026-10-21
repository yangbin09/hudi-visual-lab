<script setup lang="ts">
/**
 * EdgeCasePanel —— 边界场景与预期结果
 * ---------------------------------------------------------------------------
 * 每条边界场景都必须写清「预期结果」：教学平台的价值不在于演示正常路径，
 * 而在于让使用者知道「出问题时应该看到什么」。预期结果用绿色强调，
 * 保证一眼可见，不会被折叠起来看不到。
 */
import { computed, ref, watch } from 'vue'

import type { EdgeCase } from '@/models/simulation'

const props = defineProps<{ edgeCases: EdgeCase[] }>()

const edgeCases = computed<EdgeCase[]>(() => props.edgeCases ?? [])

/** 展开的条目 id 集合；默认只展开第一条 */
const expandedIds = ref<Set<string>>(new Set())

watch(
  () => edgeCases.value,
  (list) => {
    const next = new Set<string>()
    const keep = [...expandedIds.value].filter((id) => list.some((e) => e.id === id))
    keep.forEach((id) => next.add(id))
    if (!next.size && list.length) next.add(list[0].id)
    expandedIds.value = next
  },
  { immediate: true },
)

function isExpanded(id: string): boolean {
  return expandedIds.value.has(id)
}

function toggle(id: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedIds.value = next
}

function expandAll(): void {
  expandedIds.value = new Set(edgeCases.value.map((e) => e.id))
}

function collapseAll(): void {
  expandedIds.value = new Set()
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- 工具条 -->
    <div
      v-if="edgeCases.length"
      class="flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-hudi-muted,#94a3b8)]"
    >
      <span>共 {{ edgeCases.length }} 条边界场景</span>
      <button
        type="button"
        class="rounded border border-[var(--color-hudi-border,#1f2937)] px-1.5 py-0.5 hover:bg-slate-700/60"
        @click="expandAll"
      >
        展开全部
      </button>
      <button
        type="button"
        class="rounded border border-[var(--color-hudi-border,#1f2937)] px-1.5 py-0.5 hover:bg-slate-700/60"
        @click="collapseAll"
      >
        收起全部
      </button>
    </div>

    <!-- 空态 -->
    <div
      v-if="!edgeCases.length"
      class="rounded-lg border border-dashed border-[var(--color-hudi-border,#1f2937)] px-4 py-6 text-center text-sm text-[var(--color-hudi-muted,#94a3b8)]"
    >
      本实验暂未登记边界场景。
    </div>

    <!-- 边界场景条目 -->
    <article
      v-for="item in edgeCases"
      :key="item.id"
      class="overflow-hidden rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)]"
      :data-edge-case-id="item.id"
    >
      <!-- 折叠标题 -->
      <button
        type="button"
        class="flex w-full items-start gap-2 px-3 py-2 text-left"
        :aria-expanded="isExpanded(item.id)"
        @click="toggle(item.id)"
      >
        <span
          class="mt-0.5 inline-block shrink-0 text-[10px] text-[var(--color-hudi-muted,#94a3b8)]"
          aria-hidden="true"
        >
          {{ isExpanded(item.id) ? '▼' : '▶' }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-xs font-semibold leading-relaxed">{{ item.title }}</span>
          <span
            v-if="!isExpanded(item.id)"
            class="mt-0.5 block line-clamp-2 text-[11px] leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]"
          >
            {{ item.description }}
          </span>
        </span>
      </button>

      <!-- 展开内容 -->
      <div v-if="isExpanded(item.id)" class="border-t border-[var(--color-hudi-border,#1f2937)] px-3 py-2">
        <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">{{ item.description }}</p>

        <!-- 预期结果：必须显眼 -->
        <section class="mt-2 rounded border border-emerald-500/50 bg-emerald-500/10 p-2">
          <div class="mb-1 inline-flex items-center gap-1">
            <span
              class="rounded bg-emerald-500/80 px-1.5 py-0.5 text-[11px] font-semibold text-slate-900"
            >
              预期结果
            </span>
            <span class="text-[11px] text-emerald-200/80">引擎应产生的结果，用来核对操作是否符合预期</span>
          </div>
          <p class="whitespace-pre-wrap text-xs leading-relaxed text-emerald-100">
            {{ item.expected }}
          </p>
        </section>
      </div>
    </article>
  </div>
</template>
