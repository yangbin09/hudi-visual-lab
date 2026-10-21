<script setup lang="ts">
/**
 * SqlBlock —— 单条 SQL / 命令模板的只读展示
 * ---------------------------------------------------------------------------
 * 铁律（CONTRACT §0.4）：凡是 r26 未确认的行为必须显示「待验证」徽标。
 * 因此本组件的三个状态各自绑定固定文案，绝不出现「执行成功」这类措辞 ——
 * 本平台不执行真实 Spark SQL，只展示与复制语句。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { sql } from '@codemirror/lang-sql'
import { oneDark } from '@codemirror/theme-one-dark'

import type { SqlBlock as SqlBlockModel, SqlLanguage, SqlStatus } from '@/engine/templates/types'
import { TEMPLATE_LANGUAGE_LABEL } from '@/engine/templates/index'
import { getEvidenceList } from '@/evidence/index'
import type { Evidence } from '@/models/evidence'

const props = defineProps<{ block: SqlBlockModel }>()
const emit = defineEmits<{ (e: 'copy', code: string): void }>()

/* -------------------------------------------------------------------------- */
/* 状态徽标                                                                      */
/* -------------------------------------------------------------------------- */

interface StatusMeta {
  label: string
  /** 徽标底色 */
  color: string
  /** 徽标下方的固定说明 —— 必须如实反映证据强度 */
  detail: string
}

const STATUS_META: Record<SqlStatus, StatusMeta> = {
  verified: {
    label: 'r26 已确认语法',
    color: 'var(--color-ev-E4, #22c55e)',
    detail:
      '该语句的语法在华为 MRS r26 文档 / 制品中已确认（见下方证据条目）。' +
      '注意：本平台未在真实集群执行该语句，此处仅供核对与复制。',
  },
  conditional: {
    label: '有条件支持',
    color: 'var(--color-hudi-warning, #eab308)',
    detail:
      '该语句有文档依据，但存在版本或环境前提（见「执行前提」）。' +
      '目标版本 MRS 3.1.0-350-r26 上的可用性仍需实测确认。',
  },
  unverified: {
    label: '待验证',
    color: 'var(--color-ev-E0, #64748b)',
    detail:
      '本页语句尚未在 r26 环境实测 —— 当前只有社区 Hudi 0.15 文档支撑，' +
      'r26 上的语法与行为请以实测为准。',
  },
}

const statusMeta = computed<StatusMeta>(() => STATUS_META[props.block.status] ?? STATUS_META.unverified)

/* -------------------------------------------------------------------------- */
/* 证据                                                                          */
/* -------------------------------------------------------------------------- */

const evidences = computed<Evidence[]>(() => getEvidenceList(props.block.evidenceIds ?? []))

/* -------------------------------------------------------------------------- */
/* CodeMirror 6（只读）                                                          */
/* -------------------------------------------------------------------------- */

const editorHost = ref<HTMLElement | null>(null)
/** CodeMirror 初始化失败时的降级展示（例如单元测试的 jsdom 环境） */
const fallbackMode = ref(false)

let view: EditorView | null = null
const languageCompartment = new Compartment()

/** spark-sql / flink-sql 走 SQL 高亮；scala / shell 没有对应语言包，按纯文本展示 */
function languageExtension(language: SqlLanguage): Extension {
  if (language === 'spark-sql' || language === 'flink-sql') {
    return sql()
  }
  return []
}

function buildState(code: string, language: SqlLanguage): EditorState {
  return EditorState.create({
    doc: code,
    extensions: [
      oneDark,
      languageCompartment.of(languageExtension(language)),
      // 只读：既禁止光标编辑，也禁止粘贴 / 退格等输入
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      keymap.of([]),
      EditorView.lineWrapping,
      EditorView.theme({
        '&': { fontSize: '12px' },
        '.cm-scroller': {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace',
          lineHeight: '1.6',
        },
        '.cm-content': { padding: '8px 0' },
      }),
    ],
  })
}

onMounted(() => {
  if (!editorHost.value) return
  try {
    view = new EditorView({
      state: buildState(props.block.code, props.block.language),
      parent: editorHost.value,
    })
  } catch (err) {
    // CodeMirror 起不来（老浏览器 / 无 DOM 环境）也不能让整块内容消失
    console.warn('[SqlBlock] CodeMirror 初始化失败，降级为纯文本展示', err)
    fallbackMode.value = true
  }
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})

watch(
  () => props.block.code,
  (code) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (current === code) return
    view.dispatch({ changes: { from: 0, to: current.length, insert: code } })
  },
)

watch(
  () => props.block.language,
  (language) => {
    if (!view) return
    view.dispatch({ effects: languageCompartment.reconfigure(languageExtension(language)) })
  },
)

/* -------------------------------------------------------------------------- */
/* 复制                                                                          */
/* -------------------------------------------------------------------------- */

const copyState = ref<'idle' | 'ok' | 'fail'>('idle')

/** 降级方案：没有 navigator.clipboard 时用 execCommand */
function legacyCopy(text: string): boolean {
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', 'readonly')
    area.style.position = 'fixed'
    area.style.top = '-9999px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

async function copyCode(): Promise<void> {
  const code = props.block.code
  let ok = false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(code)
      ok = true
    }
  } catch {
    ok = false
  }
  if (!ok) ok = legacyCopy(code)

  copyState.value = ok ? 'ok' : 'fail'
  window.setTimeout(() => {
    copyState.value = 'idle'
  }, 2200)

  // 契约要求抛出 copy 事件，交给上层统一提示
  emit('copy', code)
}

const copyText = computed<string>(() => {
  if (copyState.value === 'ok') return '已复制'
  if (copyState.value === 'fail') return '复制失败，请手动选中复制'
  return '复制'
})
</script>

<template>
  <article
    class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)]"
    :data-block-id="block.id"
    :data-status="block.status"
  >
    <!-- ------------------------------ 头部 ------------------------------ -->
    <header
      class="flex flex-wrap items-center gap-2 border-b border-[var(--color-hudi-border,#1f2937)] px-3 py-2"
    >
      <h3 class="min-w-0 flex-1 truncate text-sm font-semibold">{{ block.title }}</h3>

      <span
        class="rounded px-2 py-0.5 text-[11px] font-medium text-slate-900"
        :style="{ background: statusMeta.color }"
        :title="statusMeta.label"
      >
        {{ statusMeta.label }}
      </span>

      <span
        class="rounded border border-[var(--color-hudi-border,#1f2937)] px-2 py-0.5 text-[11px] text-[var(--color-hudi-muted,#94a3b8)]"
      >
        {{ TEMPLATE_LANGUAGE_LABEL[block.language] ?? block.language }}
      </span>

      <button
        type="button"
        class="rounded border border-[var(--color-hudi-border,#1f2937)] px-2 py-0.5 text-[11px] hover:bg-slate-700/60"
        :class="copyState === 'ok' ? 'text-emerald-400' : copyState === 'fail' ? 'text-rose-400' : ''"
        @click="copyCode"
      >
        {{ copyText }}
      </button>
    </header>

    <!-- ------------------------------ 状态说明 ------------------------------ -->
    <p
      class="border-b border-[var(--color-hudi-border,#1f2937)] px-3 py-2 text-[11px] leading-relaxed"
      :class="{
        'text-emerald-300/90': block.status === 'verified',
        'text-amber-300/90': block.status === 'conditional',
        'text-slate-400': block.status === 'unverified',
      }"
    >
      {{ statusMeta.detail }}
    </p>

    <!-- ------------------------------ 代码 ------------------------------ -->
    <div v-if="!fallbackMode" ref="editorHost" class="cm-host overflow-hidden"></div>
    <pre
      v-else
      class="overflow-x-auto bg-[#0b1120] px-3 py-2 font-mono text-[12px] leading-relaxed text-slate-200"
    >{{ block.code }}</pre>

    <!-- ------------------------------ 中文注释 ------------------------------ -->
    <section v-if="block.note" class="border-t border-[var(--color-hudi-border,#1f2937)] px-3 py-2">
      <span class="mr-1 text-[11px] font-semibold text-[var(--color-hudi-accent,#60a5fa)]">说明</span>
      <span class="text-xs leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]">{{ block.note }}</span>
    </section>

    <!-- ------------------------------ 执行前提 ------------------------------ -->
    <details
      v-if="block.prerequisites && block.prerequisites.length"
      class="border-t border-[var(--color-hudi-border,#1f2937)] px-3 py-2"
      :open="block.status === 'conditional'"
    >
      <summary
        class="cursor-pointer select-none text-[11px] font-semibold text-amber-300"
      >
        执行前提（{{ block.prerequisites.length }} 条）
      </summary>
      <ul class="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-200/90">
        <li v-for="(item, idx) in block.prerequisites" :key="idx">{{ item }}</li>
      </ul>
    </details>

    <!-- ------------------------------ 风险提示 ------------------------------ -->
    <section
      v-if="block.risks && block.risks.length"
      class="border-t border-rose-500/30 bg-rose-500/10 px-3 py-2"
    >
      <span class="mr-1 text-[11px] font-semibold text-rose-300">风险提示</span>
      <ul class="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-rose-200/90">
        <li v-for="(item, idx) in block.risks" :key="idx">{{ item }}</li>
      </ul>
    </section>

    <!-- ------------------------------ 证据链接 ------------------------------ -->
    <section
      v-if="evidences.length"
      class="border-t border-[var(--color-hudi-border,#1f2937)] px-3 py-2"
    >
      <span class="mr-1 text-[11px] font-semibold text-[var(--color-hudi-muted,#94a3b8)]">证据</span>
      <span class="inline-flex flex-wrap gap-1 align-middle">
        <template v-for="item in evidences" :key="item.evidenceId">
          <a
            v-if="item.documentUrl"
            :href="item.documentUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:underline"
            :style="{
              borderColor: 'var(--color-ev-' + item.evidenceLevel + ', #64748b)',
              color: 'var(--color-ev-' + item.evidenceLevel + ', #94a3b8)',
            }"
            :title="item.title"
          >
            <span class="font-semibold">{{ item.evidenceLevel }}</span>
            <span class="max-w-[18rem] truncate">{{ item.title }}</span>
          </a>
          <span
            v-else
            class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]"
            :style="{
              borderColor: 'var(--color-ev-' + item.evidenceLevel + ', #64748b)',
              color: 'var(--color-ev-' + item.evidenceLevel + ', #94a3b8)',
            }"
            :title="item.title"
          >
            <span class="font-semibold">{{ item.evidenceLevel }}</span>
            <span class="max-w-[18rem] truncate">{{ item.title }}</span>
          </span>
        </template>
      </span>
    </section>
  </article>
</template>

<style scoped>
.cm-host :deep(.cm-editor) {
  background: #0b1120;
}

.cm-host :deep(.cm-editor.cm-focused) {
  outline: none;
}

.cm-host :deep(.cm-gutters) {
  background: #0b1120;
  border-right: 1px solid var(--color-hudi-border, #1f2937);
}

.cm-host :deep(.cm-activeLine) {
  background: transparent;
}
</style>
