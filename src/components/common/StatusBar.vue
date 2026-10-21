<script setup lang="ts">
/**
 * StatusBar —— 顶栏状态条
 * ---------------------------------------------------------------------------
 * 三件事，缺一不可：
 *   1. 目标版本：MRS 平台版本 + Hudi 组件版本（取自引擎的版本档案，不手写死）；
 *   2. **「纯浏览器模拟 · 未连接真实集群」警示徽标** —— 这是硬性要求，任何情况下都不隐藏；
 *   3. 主题切换按钮（调用 store 的 toggleTheme）。
 *
 * 版本号来自 `HuaweiMRS350R26Profile`（引擎的版本唯一权威），
 * profile 缺失时回落到常量，保证状态条永远不为空。
 */
import { computed } from 'vue'

import { HuaweiMRS350R26Profile } from '@/engine/versions/HuaweiMRS350R26Profile'
import { useLabStore } from '@/app/stores/lab'

const lab = useLabStore()

/** 平台版本，例如 MRS 3.1.0-350-r26 */
const release = computed<string>(
  () => HuaweiMRS350R26Profile.release || 'MRS 3.1.0-350-r26',
)

/** Hudi 组件版本，例如 0.15.0-h0.cbu.mrs.350.r26 */
const hudiVersion = computed<string>(
  () => HuaweiMRS350R26Profile.components?.hudi || '0.15.0-h0.cbu.mrs.350.r26',
)

/** Spark / Flink 版本，附在状态条里方便对照实验 */
const sparkVersion = computed<string>(() => HuaweiMRS350R26Profile.components?.spark ?? '3.3.1')
const flinkVersion = computed<string>(() => HuaweiMRS350R26Profile.components?.flink ?? '1.17.x')

function toggleTheme(): void {
  lab.toggleTheme()
}
</script>

<template>
  <div
    class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] leading-tight"
    data-testid="status-bar"
  >
    <!-- 版本信息 -->
    <span class="flex items-center gap-1.5 text-[var(--color-hudi-muted)]">
      <span class="font-mono text-[var(--color-hudi-text)]">{{ release }}</span>
      <span class="text-[var(--color-hudi-border)]">|</span>
      <span class="font-mono text-[var(--color-hudi-text)]">Hudi {{ hudiVersion }}</span>
    </span>

    <span class="hidden font-mono text-[var(--color-hudi-muted)] lg:inline">
      Spark {{ sparkVersion }} · Flink {{ flinkVersion }}
    </span>

    <!-- 硬性警示：纯浏览器模拟，未连接真实集群 -->
    <span
      class="inline-flex items-center gap-1 rounded-full border border-[var(--color-hudi-warning)]/60 bg-[var(--color-hudi-warning)]/15 px-2 py-0.5 font-semibold text-[var(--color-hudi-warning)]"
      role="status"
      title="本项目所有文件、Timeline、instant 变化均由浏览器内的 mini-Hudi 内核计算得出，未提交任何 Spark / Flink 作业，也未连接华为 MRS r26 集群。"
    >
      纯浏览器模拟 · 未连接真实集群
    </span>

    <!-- 主题切换 -->
    <button
      type="button"
      class="rounded border border-[var(--color-hudi-border)] px-2 py-0.5 text-[var(--color-hudi-muted)] transition-colors hover:border-[var(--color-hudi-accent)] hover:text-[var(--color-hudi-accent)]"
      :title="lab.darkMode ? '切换到浅色主题' : '切换到深色主题'"
      @click="toggleTheme"
    >
      {{ lab.darkMode ? '浅色' : '深色' }}
    </button>
  </div>
</template>
