<script setup lang="ts">
/**
 * ControlPanel —— 实验参数面板
 * ---------------------------------------------------------------------------
 * 契约 §6 约定的 props / emits：
 *   props: { controls: ExperimentControl[]; values: Record<string, unknown> }
 *   emits: (e: 'update', key: string, value: unknown): void
 *
 * 本组件**只做参数收集**：它不判断参数是否合法，也不直接改状态 ——
 * 改什么状态由父组件决定（通常是重建实验状态或派发一个 action）。
 */
import { computed } from 'vue'

import type { ExperimentControl } from '@/models/simulation'

const props = defineProps<{
  controls: ExperimentControl[]
  values: Record<string, unknown>
}>()

const emit = defineEmits<{ (e: 'update', key: string, value: unknown): void }>()

/** 取当前值：优先用外部传入的 values，缺省回落到 control.defaultValue */
function currentValue(control: ExperimentControl): string | number | boolean {
  const raw = props.values?.[control.key]
  if (raw === undefined || raw === null) return control.defaultValue
  return raw as string | number | boolean
}

/** select 的值统一按 string 处理，数字选项在提交时再转回 */
function selectValue(control: ExperimentControl): string | number {
  const raw = currentValue(control)
  return raw === undefined || raw === null ? '' : (raw as string | number)
}

const controlList = computed<ExperimentControl[]>(() => props.controls ?? [])

function onUpdate(control: ExperimentControl, value: unknown): void {
  emit('update', control.key, value)
}

/** select 的选项可能是数字，这里统一转成字符串比较 */
function optionValue(option: { value: string | number }): string | number {
  return option.value
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="!controlList.length" class="text-[11px] text-[var(--color-hudi-muted)]">
      该实验没有可调参数。
    </p>

    <div v-for="control in controlList" :key="control.key" class="space-y-1">
      <label class="block text-[11px] font-medium leading-snug">
        {{ control.label }}
        <span class="ml-1 font-mono text-[10px] text-[var(--color-hudi-muted)]">
          {{ control.key }}
        </span>
      </label>

      <!-- select -->
      <el-select
        v-if="control.kind === 'select'"
        :model-value="selectValue(control)"
        size="small"
        class="w-full"
        @update:model-value="(v: string | number) => onUpdate(control, v)"
      >
        <el-option
          v-for="option in control.options ?? []"
          :key="String(optionValue(option))"
          :label="option.label"
          :value="optionValue(option)"
        />
      </el-select>

      <!-- number -->
      <el-input-number
        v-else-if="control.kind === 'number'"
        :model-value="Number(currentValue(control))"
        :min="control.min"
        :max="control.max"
        size="small"
        class="w-full"
        @update:model-value="(v: number | undefined) => onUpdate(control, v ?? control.defaultValue)"
      />

      <!-- text -->
      <el-input
        v-else-if="control.kind === 'text'"
        :model-value="String(currentValue(control) ?? '')"
        size="small"
        clearable
        @update:model-value="(v: string) => onUpdate(control, v)"
      />

      <!-- switch -->
      <el-switch
        v-else-if="control.kind === 'switch'"
        :model-value="Boolean(currentValue(control))"
        size="small"
        @update:model-value="(v: string | number | boolean) => onUpdate(control, Boolean(v))"
      />

      <!-- records：只读说明（记录类参数由实验固定，不由用户编辑） -->
      <p
        v-else-if="control.kind === 'records'"
        class="rounded border border-[var(--color-hudi-border)] bg-[var(--color-hudi-bg)]/40 px-2 py-1 font-mono text-[10px] leading-relaxed text-[var(--color-hudi-muted)]"
      >
        {{ currentValue(control) || '（只读：由实验定义固定）' }}
      </p>

      <p v-if="control.hint" class="text-[10px] leading-relaxed text-[var(--color-hudi-muted)]">
        {{ control.hint }}
      </p>
    </div>
  </div>
</template>
