<script setup lang="ts">
/**
 * SqlPanel —— SQL / 命令模板面板
 * ---------------------------------------------------------------------------
 * 顶部固定提示必须保留：本平台是纯浏览器模拟，**不执行真实 Spark SQL**，
 * 面板里的语句只用于阅读与复制。任何时候都不能让使用者误以为语句已被执行。
 */
import { computed } from 'vue'

import type { SqlBlock } from '@/engine/templates/types'
import SqlBlockView from '@/components/sql/SqlBlock.vue'

const props = defineProps<{ blocks: SqlBlock[] }>()
const emit = defineEmits<{ (e: 'copy', code: string): void }>()

const blocks = computed<SqlBlock[]>(() => props.blocks ?? [])

/** 统计各状态的数量，方便使用者一眼看到「哪些还没在 r26 实测」 */
const statusSummary = computed<{ verified: number; conditional: number; unverified: number }>(() => ({
  verified: blocks.value.filter((b) => b.status === 'verified').length,
  conditional: blocks.value.filter((b) => b.status === 'conditional').length,
  unverified: blocks.value.filter((b) => b.status === 'unverified').length,
}))

function onCopy(code: string): void {
  emit('copy', code)
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 固定提示：不执行真实 Spark SQL -->
    <div
      class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200"
    >
      <span class="font-semibold">以下 SQL 仅供参考与复制，本平台不执行真实 Spark SQL。</span>
      <span class="text-amber-200/80">
        页面里的文件、Timeline 变化全部由浏览器内的 mini-Hudi 内核计算得出，未提交任何 Spark / Flink 作业，
        也未连接华为 MRS r26 集群。
      </span>
    </div>

    <!-- 状态统计 -->
    <div
      v-if="blocks.length"
      class="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-hudi-muted,#94a3b8)]"
    >
      <span>共 {{ blocks.length }} 条语句</span>
      <span class="inline-flex items-center gap-1">
        <i
          class="inline-block h-2 w-2 rounded-full"
          style="background: var(--color-ev-E4, #22c55e)"
        ></i>
        r26 已确认语法 {{ statusSummary.verified }}
      </span>
      <span class="inline-flex items-center gap-1">
        <i
          class="inline-block h-2 w-2 rounded-full"
          style="background: var(--color-hudi-warning, #eab308)"
        ></i>
        有条件支持 {{ statusSummary.conditional }}
      </span>
      <span class="inline-flex items-center gap-1">
        <i
          class="inline-block h-2 w-2 rounded-full"
          style="background: var(--color-ev-E0, #64748b)"
        ></i>
        待验证 {{ statusSummary.unverified }}
      </span>
    </div>

    <!-- 空态 -->
    <div
      v-if="!blocks.length"
      class="rounded-lg border border-dashed border-[var(--color-hudi-border,#1f2937)] px-4 py-6 text-center text-sm text-[var(--color-hudi-muted,#94a3b8)]"
    >
      本实验暂未提供 SQL 模板。
    </div>

    <!-- 语句列表 -->
    <SqlBlockView
      v-for="block in blocks"
      :key="block.id"
      :block="block"
      @copy="onCopy"
    />
  </div>
</template>
