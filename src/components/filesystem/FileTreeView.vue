<script setup lang="ts">
/**
 * FileTreeView —— HDFS 目录树（表根 → .hoodie/ → 分区目录 → base / log 文件）
 * ---------------------------------------------------------------------------
 * 教学重点：
 *  1. physicalFiles（HDFS 上真实存在的文件）与 fileGroups（当前 Timeline 引用）来源不同。
 *     COW 改写文件后，旧文件在 Clean 执行前仍物理存在于 HDFS 上 —— 必须画出来。
 *  2. base file / log file / 已被取代的文件 三种状态要有明确的视觉区分。
 *  3. 文件名格式是「简化教学显示」，提示语来自引擎常量 SIMPLIFIED_NOTE，不可省略。
 *
 * 契约边界：UI 只渲染引擎算好的状态，不在这里推断任何 Hudi 业务规则。
 */
import { computed, getCurrentInstance } from 'vue'
import type {
  HudiFileGroup,
  HudiInstant,
  HudiPhysicalFile,
  HudiTable,
  HudiTableState,
} from '@/models/hudi'
import { useLabStore } from '@/app/stores/lab'
import {
  SIMPLIFIED_NOTE,
  buildDirectoryTree,
  instantFileName,
  partitionRelativeDir,
  renderTree,
  tableRoot,
  type HoodieDirEntry,
} from '@/engine/filesystem/layout'

/* -------------------------------------------------------------------------- */
/* Props / Emits                                                               */
/* -------------------------------------------------------------------------- */

const props = withDefaults(
  defineProps<{
    table: HudiTable
    physicalFiles: HudiPhysicalFile[]
    fileGroups: HudiFileGroup[]
    selectedFile?: string
    /**
     * 可选扩展（契约 §6 的必需 props 完全不变）：
     * 传入 timeline / pending 后，.hoodie 目录才能按真实 action + state 展示 instant 文件。
     * 不传时自动降级为「仅展示由 File Group / 物理文件推导出的 instant」。
     */
    timeline?: HudiInstant[]
    pending?: HudiInstant[]
    archived?: HudiInstant[]
  }>(),
  {
    selectedFile: '',
    timeline: () => [],
    pending: () => [],
    archived: () => [],
  },
)

const emit = defineEmits<{
  (e: 'select', file: HudiPhysicalFile): void
}>()

/* -------------------------------------------------------------------------- */
/* 常量与工具                                                                  */
/* -------------------------------------------------------------------------- */

const FALLBACK_TABLE = {
  tablePath: '/hudi/unknown_table',
  tableName: 'unknown_table',
  partitionFields: [],
  hiveStylePartitioning: 'NONE',
} as unknown as HudiTable

const tbl = computed<HudiTable>(() => props.table ?? FALLBACK_TABLE)
const rootPath = computed<string>(() => {
  try {
    return tableRoot(tbl.value) || '/'
  } catch {
    return '/'
  }
})

/** 物理文件在 HDFS 上的完整路径（与 layout.buildDirectoryTree 的拼接口径一致） */
function physicalPath(pf: HudiPhysicalFile): string {
  const rel = partitionRelativeDir(tbl.value, pf.partitionPath ?? '')
  return `${rootPath.value}/${rel}${pf.fileName}`
}

/** log 文件名里的版本号：{fileGroupId}_{base}.log.{version}_{writeToken} */
function logVersion(fileName: string): number | null {
  const m = /\.log\.(\d+)_/.exec(fileName)
  if (!m) return null
  const n = Number(m[1])
  return Number.isNaN(n) ? null : n
}

function formatSize(bytes: number | undefined | null): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatCount(n: number | undefined | null): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return String(n)
}

const ACTION_LABEL: Record<string, string> = {
  COMMIT: 'commit',
  DELTA_COMMIT: 'deltacommit',
  COMPACTION: 'compaction',
  CLEAN: 'clean',
  ARCHIVE: 'archive',
  ROLLBACK: 'rollback',
  REPLACE_COMMIT: 'replacecommit',
  CLUSTERING: 'clustering',
  RESTORE: 'restore',
  TTL: 'ttl',
  SAVEPOINT: 'savepoint',
}

const ACTION_STYLE: Record<string, string> = {
  COMMIT: 'act-commit',
  DELTA_COMMIT: 'act-deltacommit',
  COMPACTION: 'act-compaction',
  CLEAN: 'act-clean',
  ARCHIVE: 'act-archive',
  ROLLBACK: 'act-rollback',
  REPLACE_COMMIT: 'act-replace',
  CLUSTERING: 'act-clustering',
  RESTORE: 'act-restore',
  TTL: 'act-other',
  SAVEPOINT: 'act-other',
}

/* -------------------------------------------------------------------------- */
/* instant 元信息（.hoodie 目录里的时间线文件）                                    */
/* -------------------------------------------------------------------------- */

/**
 * 兜底数据源：父组件没有传 timeline / pending 时，从实验 store 里取。
 * 这不改变契约 §6 的 props 签名（那三个 prop 都是可选的），
 * 也没有把「Hudi 规则」搬到 UI —— 这里只是搬运引擎已经算好的 instant。
 *
 * 之所以需要兜底：.hoodie 目录里的 instant 文件名需要 action + state，
 * 而契约 §6 给 FileTreeView 的四个 prop 里并不包含 timeline。
 */
const piniaInstance = getCurrentInstance()?.appContext.config.globalProperties?.$pinia

function fromStore(pick: (state: HudiTableState | null) => HudiInstant[] | undefined): HudiInstant[] {
  try {
    if (!piniaInstance) return []
    const s = useLabStore(piniaInstance)
    return pick((s.state ?? null) as HudiTableState | null) ?? []
  } catch {
    return []
  }
}

const storeTimeline = computed<HudiInstant[]>(() => fromStore((st) => st?.timeline))
const storePending = computed<HudiInstant[]>(() => fromStore((st) => st?.pendingInstants))
const storeArchived = computed<HudiInstant[]>(() => fromStore((st) => st?.archivedInstants))

const timelineInstants = computed<HudiInstant[]>(() =>
  props.timeline?.length ? props.timeline : storeTimeline.value,
)
const pendingInstants = computed<HudiInstant[]>(() =>
  props.pending?.length ? props.pending : storePending.value,
)
const archivedInstants = computed<HudiInstant[]>(() =>
  props.archived?.length ? props.archived : storeArchived.value,
)

interface InstantMeta {
  instant: HudiInstant
  fileName: string
  pending: boolean
  archived: boolean
}

const instantMap = computed<Map<string, InstantMeta>>(() => {
  const map = new Map<string, InstantMeta>()
  const push = (i: HudiInstant, pending: boolean, archived: boolean) => {
    if (!i || !i.instantTime) return
    const fileName = instantFileName(i.instantTime, i.action, i.state)
    map.set(fileName, { instant: i, fileName, pending, archived })
  }
  timelineInstants.value.forEach((i) => push(i, false, false))
  pendingInstants.value.forEach((i) => push(i, true, false))
  archivedInstants.value.forEach((i) => push(i, false, true))
  return map
})

/** .hoodie 目录下要展示的 instant 文件名（pending 用警示色，archive 进子目录） */
const hoodieInstantFiles = computed<string[]>(() => {
  const out: string[] = []
  instantMap.value.forEach((meta) => {
    if (!meta.archived) out.push(meta.fileName)
  })
  return out
})

/* -------------------------------------------------------------------------- */
/* 目录树组装                                                                    */
/* -------------------------------------------------------------------------- */

const physicalByPath = computed<Map<string, HudiPhysicalFile>>(() => {
  const m = new Map<string, HudiPhysicalFile>()
  ;(props.physicalFiles ?? []).forEach((pf) => {
    if (!pf || !pf.fileName) return
    m.set(physicalPath(pf), pf)
  })
  return m
})

function collectPaths(node: HoodieDirEntry, into: Set<string>): void {
  into.add(node.path)
  ;(node.children ?? []).forEach((c) => collectPaths(c, into))
}

function findDir(node: HoodieDirEntry, path: string): HoodieDirEntry | null {
  if (node.path === path && node.type === 'dir') return node
  for (const c of node.children ?? []) {
    if (c.type !== 'dir') continue
    const hit = findDir(c, path)
    if (hit) return hit
  }
  return null
}

function sortTree(node: HoodieDirEntry): void {
  const children = node.children ?? []
  children.sort((a, b) => {
    const ad = a.type === 'dir' ? 0 : 1
    const bd = b.type === 'dir' ? 0 : 1
    return ad - bd || a.path.localeCompare(b.path)
  })
  children.forEach((c) => {
    if (c.children) sortTree(c)
  })
}

const tree = computed<HoodieDirEntry>(() => {
  let root: HoodieDirEntry
  try {
    root = buildDirectoryTree(tbl.value, props.fileGroups ?? [], hoodieInstantFiles.value)
  } catch {
    root = { path: rootPath.value, type: 'dir', children: [] }
  }

  /* 1. 把「已被取代但尚未 Clean」的物理文件补回树里 —— 它们不在 fileGroups 中 */
  const existing = new Set<string>()
  collectPaths(root, existing)
  ;(props.physicalFiles ?? []).forEach((pf) => {
    if (!pf || !pf.fileName) return
    const full = physicalPath(pf)
    if (existing.has(full)) return
    const rel = partitionRelativeDir(tbl.value, pf.partitionPath ?? '')
    const dirPath = `${rootPath.value}/${rel}`
    let dir = findDir(root, dirPath)
    if (!dir) {
      dir = { path: dirPath, type: 'dir', children: [] }
      root.children = root.children ?? []
      root.children.push(dir)
    }
    dir.children = dir.children ?? []
    dir.children.push({ path: full, type: 'file', size: pf.sizeBytes })
    existing.add(full)
  })

  /* 2. .hoodie/archive/ —— 归档后的 instant 移到这里 */
  const hoodiePath = `${rootPath.value}/.hoodie`
  const hoodieDir = findDir(root, hoodiePath)
  if (hoodieDir) {
    const archivedNames: string[] = []
    instantMap.value.forEach((meta) => {
      if (meta.archived) archivedNames.push(meta.fileName)
    })
    if (archivedNames.length) {
      hoodieDir.children = hoodieDir.children ?? []
      const archivePath = `${hoodiePath}/archive`
      let archiveDir = hoodieDir.children.find((c) => c.path === archivePath)
      if (!archiveDir) {
        archiveDir = { path: archivePath, type: 'dir', children: [] }
        hoodieDir.children.push(archiveDir)
      }
      archiveDir.children = archiveDir.children ?? []
      archivedNames.forEach((name) => {
        archiveDir.children!.push({ path: `${archivePath}/${name}`, type: 'file', size: 256 })
      })
    }
  }

  sortTree(root)
  return root
})

/* -------------------------------------------------------------------------- */
/* 扁平化渲染（避免递归组件）                                                     */
/* -------------------------------------------------------------------------- */

interface Row {
  key: string
  depth: number
  name: string
  path: string
  kind: 'dir' | 'file'
  size: number | null
  physical: HudiPhysicalFile | null
  instant: InstantMeta | null
  role: 'dir' | 'data' | 'hoodie-meta' | 'instant' | 'archive-instant'
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  const root = tree.value
  out.push({
    key: root.path,
    depth: 0,
    name: root.path.replace(/\/+$/, '').split('/').pop() || root.path,
    path: root.path,
    kind: 'dir',
    size: null,
    physical: null,
    instant: null,
    role: 'dir',
  })

  const walk = (node: HoodieDirEntry, depth: number) => {
    ;(node.children ?? []).forEach((c) => {
      const name = c.path.replace(/\/+$/, '').split('/').pop() ?? c.path
      const instant = instantMap.value.get(name) ?? null
      const physical = c.type === 'file' ? physicalByPath.value.get(c.path) ?? null : null
      let role: Row['role'] = 'hoodie-meta'
      if (c.type === 'dir') role = 'dir'
      else if (instant) role = c.path.includes('/.hoodie/archive/') ? 'archive-instant' : 'instant'
      else if (physical) role = 'data'

      out.push({
        key: c.path,
        depth,
        name,
        path: c.path,
        kind: c.type,
        size: typeof c.size === 'number' ? c.size : null,
        physical,
        instant,
        role,
      })
      if (c.type === 'dir') walk(c, depth + 1)
    })
  }
  walk(root, 1)
  return out
})

/** 命令行视角（hdfs dfs -lsR 风格），直接用引擎的 renderTree 输出 */
const treeText = computed<string>(() => {
  try {
    return renderTree(tree.value).join('\n')
  } catch {
    return ''
  }
})

/* -------------------------------------------------------------------------- */
/* 统计                                                                        */
/* -------------------------------------------------------------------------- */

const stats = computed(() => {
  const files = props.physicalFiles ?? []
  const superseded = files.filter((f) => f.status === 'SUPERSEDED')
  const base = files.filter((f) => f.type === 'BASE')
  const log = files.filter((f) => f.type === 'LOG')
  return {
    total: files.length,
    active: files.length - superseded.length,
    superseded: superseded.length,
    base: base.length,
    log: log.length,
    bytes: files.reduce((n, f) => n + (f.sizeBytes ?? 0), 0),
  }
})

const isEmpty = computed<boolean>(() => stats.value.total === 0)

/* -------------------------------------------------------------------------- */
/* 交互                                                                        */
/* -------------------------------------------------------------------------- */

function onRowClick(row: Row): void {
  if (!row.physical) return
  emit('select', row.physical)
}

function isSelected(row: Row): boolean {
  return Boolean(props.selectedFile) && row.physical?.fileName === props.selectedFile
}

function stateClass(instant: HudiInstant): string {
  if (instant.state === 'REQUESTED') return 'st-requested'
  if (instant.state === 'INFLIGHT') return 'st-inflight'
  return 'st-completed'
}
</script>

<template>
  <div class="fv-root flex flex-col gap-2 text-xs">
    <!-- ========================= 顶部：简化显示提示（不可省略） ========================= -->
    <div
      class="rounded-md border px-3 py-2 text-[11px] leading-relaxed"
      style="border-color: var(--st-warn-bd); background: var(--st-warn-bg); color: var(--st-warn-fg)"
    >
      <span class="font-semibold">简化教学显示：</span>
      <span>{{ SIMPLIFIED_NOTE }}</span>
    </div>

    <!-- ========================= 图例 ========================= -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-hudi-muted)]">
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 bg-[var(--color-hudi-accent)]" aria-hidden="true" />
        <span>BASE（parquet，实心方块）</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 rounded-full bg-[var(--st-busy-fg)]" aria-hidden="true" />
        <span>LOG（实心圆 + 版本号）</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span
          class="inline-block h-2.5 w-2.5 bg-[var(--color-hudi-muted)] opacity-60"
          style="text-decoration: line-through"
          aria-hidden="true"
        />
        <span>已被取代，待 Clean（删除线）</span>
      </span>
      <span class="inline-flex items-center gap-1">
        <span class="inline-block h-2.5 w-2.5 rounded-full border border-[var(--st-warn-fg)]" aria-hidden="true" />
        <span>REQUESTED / INFLIGHT（pending instant）</span>
      </span>
    </div>

    <!-- ========================= 统计条 ========================= -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[var(--color-hudi-muted)]">
      <span>HDFS 物理文件：<b class="text-[var(--color-hudi-text)]">{{ stats.total }}</b></span>
      <span>ACTIVE：<b class="text-[var(--color-hudi-text)]">{{ stats.active }}</b></span>
      <span>
        待 Clean（SUPERSEDED）：
        <b :style="{ color: stats.superseded ? 'var(--st-warn-fg)' : undefined }">{{ stats.superseded }}</b>
      </span>
      <span>base / log：<b class="text-[var(--color-hudi-text)]">{{ stats.base }} / {{ stats.log }}</b></span>
      <span>合计大小：<b class="text-[var(--color-hudi-text)]">{{ formatSize(stats.bytes) }}</b></span>
    </div>

    <!-- ========================= 空态 ========================= -->
    <div
      v-if="isEmpty"
      class="rounded-md border border-dashed p-4 text-center text-[var(--color-hudi-muted)]"
      style="border-color: var(--color-hudi-border)"
    >
      <p class="font-medium">当前表在 HDFS 上还没有任何数据文件。</p>
      <p class="mt-1 leading-relaxed">
        执行一次写入（UPSERT / INSERT / BULK_INSERT）后，引擎会在此列出分区目录下的 base / log 文件。
      </p>
    </div>

    <!-- ========================= 目录树 ========================= -->
    <div
      class="fv-tree overflow-x-auto rounded-md border p-2"
      style="border-color: var(--color-hudi-border)"
    >
      <div
        v-for="row in rows"
        :key="row.key"
        class="fv-row flex items-center gap-2 rounded px-1 py-[3px]"
        :class="{
          'fv-row-clickable': row.role === 'data',
          'fv-row-selected': isSelected(row),
        }"
        :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
        @click="onRowClick(row)"
      >
        <!-- 目录 -->
        <template v-if="row.kind === 'dir'">
          <span class="fv-dir-mark" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path
                d="M1 3.2h3.2l1 1.2H11v5.4H1z"
                fill="none"
                stroke="var(--color-hudi-muted)"
                stroke-width="1.1"
              />
            </svg>
          </span>
          <span class="font-medium text-[var(--color-hudi-text)]">{{ row.name }}/</span>
        </template>

        <!-- 文件 -->
        <template v-else>
          <!-- 数据文件：base = 实心方块，log = 实心圆 -->
          <span v-if="row.role === 'data'" class="fv-file-mark" aria-hidden="true">
            <svg v-if="row.physical?.type === 'BASE'" width="12" height="12" viewBox="0 0 12 12">
              <rect x="1.5" y="1.5" width="9" height="9" fill="var(--color-hudi-accent)" />
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 12 12">
              <circle cx="6" cy="6" r="4.6" fill="var(--st-busy-fg)" />
            </svg>
          </span>
          <span v-else class="fv-file-mark text-[var(--color-hudi-muted)]" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M2.5 1.5h5l2 2v7h-7z" fill="none" stroke="currentColor" stroke-width="1.1" />
            </svg>
          </span>

          <span
            class="fv-file-name break-all"
            :class="row.physical?.status === 'SUPERSEDED' ? 'fv-superseded' : ''"
          >
            {{ row.name }}
          </span>

          <!-- 数据文件徽标 -->
          <template v-if="row.role === 'data' && row.physical">
            <span
              class="fv-badge"
              :class="row.physical.type === 'BASE' ? 'fv-badge-base' : 'fv-badge-log'"
            >
              {{ row.physical.type }}
            </span>
            <span v-if="logVersion(row.name) !== null" class="fv-badge fv-badge-version">
              v{{ logVersion(row.name) }}
            </span>
            <span v-if="row.physical.status === 'SUPERSEDED'" class="fv-badge fv-badge-superseded">
              已被取代，待 Clean
            </span>
            <span v-if="row.physical.status === 'SUPERSEDED' && row.physical.supersededAt" class="fv-subtle">
              （被 {{ row.physical.supersededAt }} 取代）
            </span>
            <span class="fv-subtle">{{ formatCount(row.physical.recordCount) }} 条</span>
            <span class="fv-subtle">{{ formatSize(row.physical.sizeBytes) }}</span>
          </template>

          <!-- instant 文件徽标 -->
          <template v-else-if="row.instant">
            <span class="fv-badge" :class="ACTION_STYLE[row.instant.instant.action] ?? 'act-other'">
              {{ ACTION_LABEL[row.instant.instant.action] ?? row.instant.instant.action }}
            </span>
            <span class="fv-badge" :class="stateClass(row.instant.instant)">
              {{ row.instant.instant.state }}
            </span>
            <span v-if="row.instant.pending" class="fv-badge fv-badge-pending">Pending 区</span>
            <span v-if="row.role === 'archive-instant'" class="fv-badge fv-badge-archive">已归档</span>
          </template>

          <!-- .hoodie 元文件 -->
          <template v-else>
            <span class="fv-subtle">Hoodie 元文件</span>
            <span class="fv-subtle">{{ formatSize(row.size) }}</span>
          </template>
        </template>
      </div>
    </div>

    <!-- ========================= 命令行视角 ========================= -->
    <details class="rounded-md border px-3 py-2" style="border-color: var(--color-hudi-border)">
      <summary class="cursor-pointer text-[11px] font-medium text-[var(--color-hudi-muted)]">
        命令行视角（hdfs dfs -lsR 风格文本）
      </summary>
      <pre
        class="mt-2 overflow-x-auto whitespace-pre font-mono text-[11px] leading-relaxed text-[var(--color-hudi-text)]"
      >{{ treeText }}</pre>
    </details>
  </div>
</template>

<style scoped>
.fv-root {
  --st-ok-fg: #6ee7b7;
  --st-warn-fg: #fcd34d;
  --st-warn-bg: rgba(245, 158, 11, 0.14);
  --st-warn-bd: rgba(245, 158, 11, 0.45);
  --st-busy-fg: #fdba74;
  --st-del-fg: #fca5a5;
  --st-del-bg: rgba(239, 68, 68, 0.16);
  --st-del-bd: rgba(239, 68, 68, 0.45);
  --st-upd-fg: #93c5fd;
  --st-upd-bg: rgba(59, 130, 246, 0.16);
  --st-upd-bd: rgba(59, 130, 246, 0.45);
  --act-commit-fg: #6ee7b7;
  --act-deltacommit-fg: #7dd3fc;
  --act-compaction-fg: #c4b5fd;
  --act-clean-fg: #5eead4;
  --act-archive-fg: #a5b4fc;
  --act-rollback-fg: #fda4af;
  --act-replace-fg: #f9a8d4;
  --act-clustering-fg: #f0abfc;
  --act-other-fg: #cbd5e1;
}
:global(:root[data-theme='light']) .fv-root {
  --st-ok-fg: #047857;
  --st-warn-fg: #b45309;
  --st-busy-fg: #c2410c;
  --st-del-fg: #b91c1c;
  --st-upd-fg: #1d4ed8;
  --act-commit-fg: #047857;
  --act-deltacommit-fg: #0369a1;
  --act-compaction-fg: #6d28d9;
  --act-clean-fg: #0f766e;
  --act-archive-fg: #4338ca;
  --act-rollback-fg: #be123c;
  --act-replace-fg: #be185d;
  --act-clustering-fg: #a21caf;
  --act-other-fg: #475569;
}

.fv-row {
  min-height: 20px;
}
.fv-row-clickable {
  cursor: pointer;
}
.fv-row-clickable:hover {
  background: color-mix(in srgb, var(--color-hudi-accent) 10%, transparent);
}
.fv-row-selected {
  background: color-mix(in srgb, var(--color-hudi-accent) 18%, transparent);
  outline: 1px solid color-mix(in srgb, var(--color-hudi-accent) 55%, transparent);
}
.fv-file-name {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--color-hudi-text);
}
.fv-superseded {
  color: var(--color-hudi-muted);
  text-decoration: line-through;
}
.fv-subtle {
  color: var(--color-hudi-muted);
  font-size: 10px;
}
.fv-badge {
  border-radius: 3px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
  border: 1px solid transparent;
}
.fv-badge-base {
  color: var(--color-hudi-accent);
  border-color: color-mix(in srgb, var(--color-hudi-accent) 55%, transparent);
  background: color-mix(in srgb, var(--color-hudi-accent) 12%, transparent);
}
.fv-badge-log {
  color: var(--st-busy-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.fv-badge-version {
  color: var(--color-hudi-muted);
  border-color: var(--color-hudi-border);
}
.fv-badge-superseded {
  color: var(--st-warn-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.fv-badge-pending {
  color: var(--st-warn-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.fv-badge-archive {
  color: var(--color-hudi-muted);
  border-color: var(--color-hudi-border);
}
.st-completed {
  color: var(--st-ok-fg);
  border-color: color-mix(in srgb, var(--st-ok-fg) 55%, transparent);
  background: color-mix(in srgb, var(--st-ok-fg) 12%, transparent);
}
.st-requested {
  color: var(--st-warn-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
}
.st-inflight {
  color: var(--st-busy-fg);
  border-color: var(--st-warn-bd);
  background: var(--st-warn-bg);
  animation: fv-blink 1.1s ease-in-out infinite;
}
.act-commit {
  color: var(--act-commit-fg);
  border-color: color-mix(in srgb, var(--act-commit-fg) 50%, transparent);
}
.act-deltacommit {
  color: var(--act-deltacommit-fg);
  border-color: color-mix(in srgb, var(--act-deltacommit-fg) 50%, transparent);
}
.act-compaction {
  color: var(--act-compaction-fg);
  border-color: color-mix(in srgb, var(--act-compaction-fg) 50%, transparent);
}
.act-clean {
  color: var(--act-clean-fg);
  border-color: color-mix(in srgb, var(--act-clean-fg) 50%, transparent);
}
.act-archive {
  color: var(--act-archive-fg);
  border-color: color-mix(in srgb, var(--act-archive-fg) 50%, transparent);
}
.act-rollback {
  color: var(--act-rollback-fg);
  border-color: color-mix(in srgb, var(--act-rollback-fg) 50%, transparent);
}
.act-replace {
  color: var(--act-replace-fg);
  border-color: color-mix(in srgb, var(--act-replace-fg) 50%, transparent);
}
.act-clustering {
  color: var(--act-clustering-fg);
  border-color: color-mix(in srgb, var(--act-clustering-fg) 50%, transparent);
}
.act-other {
  color: var(--act-other-fg);
  border-color: var(--color-hudi-border);
}
@keyframes fv-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
