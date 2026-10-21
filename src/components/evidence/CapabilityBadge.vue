<script setup lang="ts">
/**
 * CapabilityBadge —— 能力项在 r26 上的支持状态徽标
 * ---------------------------------------------------------------------------
 * 状态口径来自引擎的版本档案（HuaweiMRS350R26Profile），UI 只负责渲染：
 *   supported   绿 —— r26 已确认
 *   conditional 黄 —— 有条件支持，必须同时显示适用前提
 *   unverified  灰 —— 待验证，必须把「待核实的问题」写清楚
 *   unsupported 红 —— r26 明确不支持
 */
import { computed, ref } from 'vue'

import { capabilityOf } from '@/engine/versions/HuaweiMRS350R26Profile'
import { CAPABILITY_LABEL, type CapabilityState } from '@/models/evidence'

const props = defineProps<{ capabilityKey: string }>()

const capability = computed(() => capabilityOf(props.capabilityKey))
const label = computed<string>(() => CAPABILITY_LABEL[capability.value.state] ?? capability.value.state)

/**
 * 徽标配色是语义色（绿 / 黄 / 灰 / 红），与证据等级色是两套口径：
 * 优先取设计 token，token 缺失时回落到硬编码色值，保证任何主题下都可读。
 */
const STATE_COLOR: Record<CapabilityState, string> = {
  supported: 'var(--color-ev-E4, #22c55e)',
  conditional: 'var(--color-hudi-warning, #eab308)',
  unverified: 'var(--color-ev-E0, #64748b)',
  unsupported: 'var(--color-hudi-danger, #ef4444)',
}

function badgeColor(state: CapabilityState): string {
  return STATE_COLOR[state] ?? STATE_COLOR.unverified
}

const expanded = ref(false)

/** 详情文本：conditional 看前提，unverified 看待核实问题，其余看前提 */
const detailText = computed<string>(() => {
  const c = capability.value
  if (c.state === 'unverified') {
    return `待验证：${c.openQuestion ?? '该能力在 r26 上尚未确认。'}`
  }
  if (c.precondition) return c.precondition
  if (c.openQuestion) return `待验证：${c.openQuestion}`
  return ''
})

const detailTitle = computed<string>(() => {
  if (capability.value.state === 'conditional') return '适用前提'
  if (capability.value.state === 'unverified') return '待验证'
  if (capability.value.state === 'unsupported') return '限制说明'
  return '说明'
})

/** 是否值得展开：无详情文本时不需要展开入口 */
const hasDetail = computed<boolean>(() => detailText.value.length > 0)
</script>

<template>
  <span class="inline-flex flex-col gap-1 align-middle">
    <span class="group relative inline-flex items-center">
      <button
        type="button"
        class="rounded px-2 py-0.5 text-[11px] font-medium text-slate-900"
        :style="{ background: badgeColor(capability.state) }"
        :aria-expanded="hasDetail ? expanded : undefined"
        :title="hasDetail ? detailText : label"
        @click="hasDetail && (expanded = !expanded)"
      >
        {{ label }}
      </button>

      <!-- 悬停提示：条件 / 待验证的细节不该被藏在点击之后 -->
      <span
        v-if="hasDetail"
        class="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-64 rounded border border-[var(--color-hudi-border,#1f2937)] bg-slate-900 px-2 py-1.5 text-[11px] leading-relaxed text-slate-200 shadow-lg group-hover:block"
      >
        <b class="text-slate-100">{{ detailTitle }}：</b>{{ detailText }}
      </span>
    </span>

    <!-- 展开详情 -->
    <span
      v-if="hasDetail && expanded"
      class="max-w-md rounded border px-2 py-1.5 text-[11px] leading-relaxed"
      :class="
        capability.state === 'unverified'
          ? 'border-dashed border-amber-400/70 bg-amber-400/10 text-amber-100'
          : capability.state === 'unsupported'
            ? 'border-rose-500/50 bg-rose-500/10 text-rose-200'
            : 'border-amber-500/50 bg-amber-500/10 text-amber-200'
      "
    >
      <b>{{ detailTitle }}：</b>{{ detailText }}
    </span>
  </span>
</template>
