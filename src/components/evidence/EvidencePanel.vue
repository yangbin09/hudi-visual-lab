<script setup lang="ts">
/**
 * EvidencePanel —— 证据卡片列表
 * ---------------------------------------------------------------------------
 * 每条结论都必须能追到来源。等级色（E0~E4）用设计 token --color-ev-E0..E4：
 *   E0 灰 / E1 蓝 / E2 青 / E3 紫 / E4 绿
 * 证据等级只反映「依据有多硬」，不代表本平台连过集群（当前全库无 E4）。
 */
import { computed, ref } from 'vue'

import { getEvidence, getEvidenceList } from '@/evidence/index'
import { EVIDENCE_LEVEL_LABEL, type Evidence, type EvidenceSourceType } from '@/models/evidence'

const props = defineProps<{ evidenceIds: string[] }>()
const emit = defineEmits<{ (e: 'select', evidence: Evidence): void }>()

const evidences = computed<Evidence[]>(() => getEvidenceList(props.evidenceIds ?? []))

/** 传进来的 id 在证据库里不存在时必须显式提示，否则「没证据」会被误读成「没显示」 */
const missingIds = computed<string[]>(() =>
  (props.evidenceIds ?? []).filter((id) => !getEvidence(id)),
)

/** 等级色：优先用设计 token */
function levelColor(level: Evidence['evidenceLevel']): string {
  return `var(--color-ev-${level}, #64748b)`
}

/** 来源类型的中文映射 */
const SOURCE_LABEL: Record<EvidenceSourceType, string> = {
  'community-doc': '社区文档',
  'huawei-doc': '华为文档',
  'maven-artifact': 'Maven 制品',
  'source-analysis': '源码分析',
  bytecode: '字节码',
  'spark-sql-test': 'Spark SQL 实测',
  'flink-sql-test': 'Flink SQL 实测',
  'hdfs-snapshot': 'HDFS 快照',
  'timeline-metadata': 'Timeline 元数据',
  'error-log': '错误日志',
  'research-note': '研究笔记',
}

function sourceLabel(source: EvidenceSourceType): string {
  return SOURCE_LABEL[source] ?? source
}

/* -------------------------------------------------------------------------- */
/* 制品坐标复制                                                                  */
/* -------------------------------------------------------------------------- */

const copiedId = ref<string>('')

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

async function copyCoordinate(item: Evidence): Promise<void> {
  const text = item.artifactCoordinate ?? ''
  if (!text) return
  let ok = false
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      ok = true
    }
  } catch {
    ok = false
  }
  if (!ok) ok = legacyCopy(text)
  if (ok) {
    copiedId.value = item.evidenceId
    window.setTimeout(() => {
      if (copiedId.value === item.evidenceId) copiedId.value = ''
    }, 2000)
  }
}

function onSelect(item: Evidence): void {
  emit('select', item)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <!-- 空态 -->
    <div
      v-if="!evidences.length"
      class="rounded-lg border border-dashed border-[var(--color-hudi-border,#1f2937)] px-4 py-6 text-center text-sm text-[var(--color-hudi-muted,#94a3b8)]"
    >
      本实验暂未关联证据条目。
    </div>

    <!-- 找不到的 id -->
    <p
      v-if="missingIds.length"
      class="rounded border border-dashed border-amber-500/40 px-2 py-1 text-[11px] text-amber-300/90"
    >
      以下证据 id 未在证据库中登记：{{ missingIds.join('、') }}
    </p>

    <!-- 证据卡片 -->
    <article
      v-for="item in evidences"
      :key="item.evidenceId"
      class="rounded-lg border border-[var(--color-hudi-border,#1f2937)] bg-[var(--color-hudi-panel,#111827)] p-3"
      :data-evidence-id="item.evidenceId"
    >
      <!-- 标题 + 等级 -->
      <header class="flex flex-wrap items-start gap-2">
        <button
          type="button"
          class="min-w-0 flex-1 text-left text-sm font-semibold hover:underline"
          :title="`查看证据详情：${item.title}`"
          @click="onSelect(item)"
        >
          {{ item.title }}
        </button>
        <span
          class="rounded px-2 py-0.5 text-[11px] font-semibold text-slate-900"
          :style="{ background: levelColor(item.evidenceLevel) }"
          :title="EVIDENCE_LEVEL_LABEL[item.evidenceLevel]"
        >
          {{ item.evidenceLevel }} · {{ EVIDENCE_LEVEL_LABEL[item.evidenceLevel] }}
        </span>
      </header>

      <!-- 基本信息 -->
      <div
        class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-hudi-muted,#94a3b8)]"
      >
        <span class="inline-flex items-center gap-1">
          <span class="opacity-70">组件</span>
          <span class="text-[var(--color-hudi-text,#e2e8f0)]">{{ item.component || '—' }}</span>
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="opacity-70">版本</span>
          <span class="font-mono text-[var(--color-hudi-text,#e2e8f0)]">{{ item.version || '—' }}</span>
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="opacity-70">来源类型</span>
          <span class="text-[var(--color-hudi-text,#e2e8f0)]">{{ sourceLabel(item.sourceType) }}</span>
        </span>
        <span class="inline-flex items-center gap-1">
          <span class="opacity-70">证据 ID</span>
          <span class="font-mono text-[var(--color-hudi-text,#e2e8f0)]">{{ item.evidenceId }}</span>
        </span>
        <span v-if="item.verifiedAt" class="inline-flex items-center gap-1">
          <span class="opacity-70">核实时间</span>
          <span class="text-[var(--color-hudi-text,#e2e8f0)]">{{ item.verifiedAt }}</span>
        </span>
        <span v-if="item.environment" class="inline-flex items-center gap-1">
          <span class="opacity-70">环境</span>
          <span class="text-[var(--color-hudi-text,#e2e8f0)]">{{ item.environment }}</span>
        </span>
      </div>

      <!-- 文档链接 -->
      <div v-if="item.documentUrl" class="mt-2 text-[11px]">
        <span class="mr-1 opacity-70">原文链接</span>
        <a
          :href="item.documentUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="break-all text-[var(--color-hudi-accent,#60a5fa)] underline"
        >
          {{ item.documentUrl }}
        </a>
      </div>

      <!-- 制品坐标 -->
      <div v-if="item.artifactCoordinate" class="mt-2 text-[11px]">
        <span class="mr-1 opacity-70">制品坐标</span>
        <code
          class="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-hudi-text,#e2e8f0)]"
        >{{ item.artifactCoordinate }}</code>
        <button
          type="button"
          class="ml-1 rounded border border-[var(--color-hudi-border,#1f2937)] px-1.5 py-0.5 hover:bg-slate-700/60"
          :class="copiedId === item.evidenceId ? 'text-emerald-400' : ''"
          @click="copyCoordinate(item)"
        >
          {{ copiedId === item.evidenceId ? '已复制' : '复制' }}
        </button>
      </div>

      <!-- 类 / 方法 -->
      <div
        v-if="item.className || item.methodName"
        class="mt-2 text-[11px] text-[var(--color-hudi-muted,#94a3b8)]"
      >
        <span v-if="item.className" class="mr-2">
          <span class="opacity-70">类</span>
          <code class="ml-1 font-mono text-[var(--color-hudi-text,#e2e8f0)]">{{ item.className }}</code>
        </span>
        <span v-if="item.methodName">
          <span class="opacity-70">方法</span>
          <code class="ml-1 font-mono text-[var(--color-hudi-text,#e2e8f0)]">{{ item.methodName }}</code>
        </span>
      </div>

      <!-- 测试命令 -->
      <div v-if="item.testCommand" class="mt-2">
        <div class="mb-1 text-[11px] opacity-70">测试命令</div>
        <pre
          class="overflow-x-auto rounded bg-black/40 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-slate-200"
        >{{ item.testCommand }}</pre>
      </div>

      <!-- 预期 vs 实际 -->
      <div
        v-if="item.expectedResult || item.actualResult"
        class="mt-2 grid gap-2 sm:grid-cols-2"
      >
        <div class="rounded border border-sky-500/30 bg-sky-500/10 p-2">
          <div class="mb-1 text-[11px] font-semibold text-sky-300">预期结果</div>
          <p class="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
            {{ item.expectedResult || '（未记录）' }}
          </p>
        </div>
        <div class="rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
          <div class="mb-1 text-[11px] font-semibold text-emerald-300">实际结果</div>
          <p class="whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">
            {{ item.actualResult || '（未记录）' }}
          </p>
        </div>
      </div>

      <!-- 备注 -->
      <p
        v-if="item.notes"
        class="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--color-hudi-muted,#94a3b8)]"
      >
        备注：{{ item.notes }}
      </p>
    </article>
  </div>
</template>
