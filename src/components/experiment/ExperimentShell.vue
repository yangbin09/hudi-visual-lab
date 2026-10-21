<script setup lang="ts">
/**
 * ExperimentShell —— 实验页三栏骨架
 * ---------------------------------------------------------------------------
 * 契约 §6 约定的 props / emits：
 *   props: { experiment: ExperimentDefinition }
 *   emits: (e: 'dispatch', action: SimulationAction): void
 *   slots: default（中央）、controls（右栏）、tabs（底部）
 *
 * 设计约束（铁律 1）：**UI 不实现 Hudi 业务规则**。
 * 左栏的步骤列表只负责把「步骤定义的 action」原样往上抛，
 * 具体文件变化、Timeline 变化全部由 store → engine 计算后再渲染。
 *
 * 右栏的「原理解释」与「版本证据」直接取自 store 的最后一次执行结果，
 * 不在组件里另存一份状态，避免两处数据打架。
 */
import { computed, defineComponent, h, ref, toRaw } from 'vue'

import type { SimulationAction } from '@/models/actions'
import { CAPABILITY_LABEL, EVIDENCE_LEVEL_LABEL, type EvidenceLevel } from '@/models/evidence'
import type { ExperimentDefinition, ExperimentStep } from '@/models/simulation'

import { getEvidenceList } from '@/evidence'
import { useLabStore } from '@/app/stores/lab'

/* -------------------------------------------------------------------------- */
/* Props / Emits                                                                */
/* -------------------------------------------------------------------------- */

const props = defineProps<{ experiment: ExperimentDefinition }>()

const emit = defineEmits<{ (e: 'dispatch', action: SimulationAction): void }>()

const lab = useLabStore()

/* -------------------------------------------------------------------------- */
/* 本地内联徽标组件（不依赖其它子任务的文件）                                     */
/* -------------------------------------------------------------------------- */

type SupportState = 'supported' | 'conditional' | 'unverified' | 'unsupported'

/** 支持状态 → 徽标文案与配色 */
const SUPPORT_META: Record<SupportState, { label: string; className: string; hint: string }> = {
  supported: {
    label: CAPABILITY_LABEL.supported,
    className: 'ev-badge--E4',
    hint: '该能力已在华为 MRS r26 上确认。',
  },
  conditional: {
    label: CAPABILITY_LABEL.conditional,
    className: 'ev-badge--E2',
    hint: '有条件支持：必须同时满足适用前提，r26 上的实际表现仍需实测校正。',
  },
  unverified: {
    label: CAPABILITY_LABEL.unverified,
    className: 'ev-badge--E0',
    hint: '待验证：r26 上尚未实测确认，界面结论仅来自社区 0.15 文档或工程推演。',
  },
  unsupported: {
    label: CAPABILITY_LABEL.unsupported,
    className: 'ev-badge--E0',
    hint: 'r26 明确不支持该行为。',
  },
}

/** 支持状态徽标：极简内联组件 */
const SupportStateBadge = defineComponent({
  name: 'SupportStateBadge',
  props: {
    state: { type: String, required: true },
  },
  setup(componentProps) {
    return () => {
      const state = componentProps.state as SupportState
      const meta = SUPPORT_META[state] ?? SUPPORT_META.unverified
      return h(
        'span',
        { class: ['ev-badge', meta.className], title: meta.hint },
        `支持状态：${meta.label}`,
      )
    }
  },
})

/** 证据等级徽标：极简内联组件 */
const EvidenceLevelBadge = defineComponent({
  name: 'EvidenceLevelBadge',
  props: {
    level: { type: String, required: true },
  },
  setup(componentProps) {
    return () => {
      const level = componentProps.level as EvidenceLevel
      const label = EVIDENCE_LEVEL_LABEL[level] ?? level
      return h(
        'span',
        { class: ['ev-badge', `ev-badge--${level}`], title: `证据等级 ${level}：${label}` },
        `证据 ${level} · ${label}`,
      )
    }
  },
})

/* -------------------------------------------------------------------------- */
/* 步骤                                                                        */
/* -------------------------------------------------------------------------- */

/** 当前选中的步骤下标（仅用于高亮，真正的执行结果由 store 决定） */
const activeStepIndex = ref(0)

const steps = computed<ExperimentStep[]>(() => props.experiment.steps ?? [])

function onStepClick(index: number): void {
  activeStepIndex.value = index
  const step = steps.value[index]
  if (!step?.action) return
  // 原样上抛：步骤里定义的 action 由父组件决定要不要做参数替换。
  // ⚠️ 必须 toRaw —— props 是响应式代理，Proxy 无法被 structuredClone，
  //    父组件若把它交给引擎做克隆会直接抛 DataCloneError。
  emit('dispatch', toRaw(step.action) as unknown as SimulationAction)
}

/* -------------------------------------------------------------------------- */
/* 右栏：原理解释 + 版本证据                                                      */
/* -------------------------------------------------------------------------- */

const lastEvent = computed(() => lab.history[lab.history.length - 1] ?? null)

const explanation = computed<string>(
  () => lastEvent.value?.explanation ?? '尚未执行任何动作。',
)

const warnings = computed<string[]>(() => lastEvent.value?.warnings ?? [])

/** 证据 id = 实验声明的证据 + 最近一次动作的证据 */
const evidenceIds = computed<string[]>(() => {
  const ids = new Set<string>(props.experiment.evidenceIds ?? [])
  lastEvent.value?.evidenceIds?.forEach((id: string) => ids.add(id))
  return [...ids]
})

const evidenceList = computed(() => getEvidenceList(evidenceIds.value))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-3 p-3 text-[var(--color-hudi-text)]">
    <!-- ============================ 三栏 ============================ -->
    <div class="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[240px_minmax(0,1fr)_320px]">
      <!-- ---------------------------- 左栏 ---------------------------- -->
      <aside class="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <!-- 实验元信息 -->
        <section class="hudi-panel">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <span
              class="rounded border border-[var(--color-hudi-accent)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-hudi-accent)]"
            >
              {{ experiment.id }}
            </span>
            <SupportStateBadge :state="experiment.supportState" />
            <EvidenceLevelBadge :level="experiment.evidenceLevel" />
          </div>

          <h1 class="text-sm font-semibold leading-snug">{{ experiment.title }}</h1>

          <dl class="mt-2 space-y-1 text-[11px] leading-relaxed">
            <div class="flex gap-2">
              <dt class="w-16 shrink-0 text-[var(--color-hudi-muted)]">难度</dt>
              <dd>{{ experiment.difficulty }}</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-16 shrink-0 text-[var(--color-hudi-muted)]">预计时长</dt>
              <dd>{{ experiment.estimatedMinutes }} 分钟</dd>
            </div>
            <div class="flex gap-2">
              <dt class="w-16 shrink-0 text-[var(--color-hudi-muted)]">目标版本</dt>
              <dd class="font-mono break-all">{{ experiment.targetVersion }}</dd>
            </div>
          </dl>

          <div v-if="experiment.prerequisites?.length" class="mt-2">
            <h3 class="text-[11px] font-semibold text-[var(--color-hudi-muted)]">前置知识</h3>
            <ul class="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-[var(--color-hudi-muted)]">
              <li v-for="(item, idx) in experiment.prerequisites" :key="idx">{{ item }}</li>
            </ul>
          </div>
        </section>

        <!-- 学习目标 -->
        <section class="hudi-panel">
          <h2 class="mb-1.5 text-xs font-semibold">学习目标</h2>
          <ul
            class="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-[var(--color-hudi-muted)]"
          >
            <li v-for="(item, idx) in experiment.learningObjectives ?? []" :key="idx">
              {{ item }}
            </li>
          </ul>
        </section>

        <!-- 步骤列表 -->
        <section class="hudi-panel">
          <h2 class="mb-1.5 text-xs font-semibold">实验步骤</h2>
          <ol class="space-y-1">
            <li v-for="(step, index) in steps" :key="step.stepId">
              <button
                type="button"
                class="w-full rounded px-2 py-1.5 text-left text-[11px] leading-snug transition-colors"
                :class="
                  index === activeStepIndex
                    ? 'bg-[var(--color-hudi-accent)]/15 text-[var(--color-hudi-accent)]'
                    : 'text-[var(--color-hudi-muted)] hover:bg-[var(--color-hudi-border)]/30 hover:text-[var(--color-hudi-text)]'
                "
                :title="step.description"
                @click="onStepClick(index)"
              >
                <span class="mr-1 font-mono">{{ index + 1 }}.</span>{{ step.title }}
              </button>
            </li>
          </ol>
          <p v-if="!steps.length" class="text-[11px] text-[var(--color-hudi-muted)]">
            该实验尚未定义步骤。
          </p>
        </section>
      </aside>

      <!-- ---------------------------- 中栏 ---------------------------- -->
      <main class="min-h-0 min-w-0 overflow-y-auto">
        <slot />
      </main>

      <!-- ---------------------------- 右栏 ---------------------------- -->
      <aside class="flex min-h-0 flex-col gap-3 overflow-y-auto">
        <!-- 参数面板（由父组件填充） -->
        <section class="hudi-panel">
          <h2 class="mb-2 text-xs font-semibold">参数</h2>
          <slot name="controls">
            <p class="text-[11px] text-[var(--color-hudi-muted)]">该实验没有可调参数。</p>
          </slot>
        </section>

        <!-- 原理解释 -->
        <section class="hudi-panel">
          <h2 class="mb-2 text-xs font-semibold">原理解释</h2>
          <div class="mb-1.5 text-[11px] text-[var(--color-hudi-muted)]">
            <span v-if="lastEvent">
              {{ lastEvent.title }}
              <span v-if="lastEvent.instantTime"> · instant {{ lastEvent.instantTime }}</span>
            </span>
            <span v-else>尚未执行任何动作</span>
          </div>
          <p class="whitespace-pre-wrap text-[11px] leading-relaxed">{{ explanation }}</p>
          <ul v-if="warnings.length" class="mt-2 space-y-1">
            <li
              v-for="(w, idx) in warnings"
              :key="idx"
              class="rounded border border-[var(--color-hudi-warning)]/50 bg-[var(--color-hudi-warning)]/10 px-2 py-1 text-[11px] leading-relaxed text-[var(--color-hudi-warning)]"
            >
              {{ w }}
            </li>
          </ul>
        </section>

        <!-- 版本证据 -->
        <section class="hudi-panel">
          <h2 class="mb-2 text-xs font-semibold">版本证据</h2>
          <p v-if="!evidenceList.length" class="text-[11px] text-[var(--color-hudi-muted)]">
            该实验暂未关联版本证据。
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="item in evidenceList"
              :key="item.evidenceId"
              class="rounded border border-[var(--color-hudi-border)] px-2 py-1.5"
            >
              <div class="flex flex-wrap items-center gap-1.5">
                <EvidenceLevelBadge :level="item.evidenceLevel" />
                <span class="font-mono text-[10px] text-[var(--color-hudi-muted)]">
                  {{ item.evidenceId }}
                </span>
              </div>
              <p class="mt-1 text-[11px] leading-snug">{{ item.title }}</p>
              <p class="mt-0.5 text-[10px] text-[var(--color-hudi-muted)]">
                {{ item.component }} · {{ item.version }} · {{ item.sourceType }}
              </p>
            </li>
          </ul>
        </section>
      </aside>
    </div>

    <!-- ============================ 底部 Tab ============================ -->
    <section
      class="flex min-h-0 shrink-0 flex-col rounded-lg border border-[var(--color-hudi-border)] bg-[var(--color-hudi-panel)] p-2"
      style="height: 320px"
    >
      <slot name="tabs" />
    </section>
  </div>
</template>
