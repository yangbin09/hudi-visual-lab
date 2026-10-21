import type { HudiRecord, HudiTableState } from '@/models/hudi'
import { mergeRecords, snapshotAt } from '@/engine/operations/services'
import {
  META_FIELDS,
  META_FIELD_NAMES,
  QUERY_MODE_LABEL,
  type QueryMode,
  type QueryRequest,
  type QueryResult,
} from './types'

/**
 * 查询引擎。
 *
 * 关键取舍：**读路径一律从物理布局（File Group → File Slice → base/log）推导**，
 * 而不是直接读逻辑记录视图（state.records）。
 * 只有这样「读优化模式下看不到 log file 里的更新」才会自然浮现出来 ——
 * 如果直接读逻辑视图，四种查询模式的结果会完全一样，实验就没有教学价值了。
 */
export function runQuery(state: HudiTableState, request: QueryRequest): QueryResult {
  switch (request.mode) {
    case 'snapshot':
      return runSnapshot(state, request)
    case 'read-optimized':
      return runReadOptimized(state, request)
    case 'incremental':
      return runIncremental(state, request)
    case 'time-travel':
      return runTimeTravel(state, request)
    default: {
      const unknown = request as { mode?: string }
      return {
        mode: unknown.mode as QueryMode,
        columns: [],
        rows: [],
        rowCount: 0,
        notes: [`未实现的查询模式：${unknown.mode ?? '未知'}`],
        explanation: '未实现的查询模式，返回空结果。',
      }
    }
  }
}

/* ============================ 各模式实现 ============================ */

/** 快照读：合并 base file 与全部 log file */
function runSnapshot(state: HudiTableState, request: QueryRequest): QueryResult {
  const groups = activeGroups(state)
  const baseRecords: HudiRecord[] = []
  const logRecords: HudiRecord[] = []
  let logFileCount = 0

  groups.forEach((g) => {
    if (g.fileSlice.baseFile) baseRecords.push(...g.fileSlice.baseFile.records)
    g.fileSlice.logFiles.forEach((l) => {
      logFileCount += 1
      logRecords.push(...l.records)
    })
  })

  const merged = mergeRecords([...baseRecords, ...logRecords])
  const visible = merged.filter((r) => r.operation !== 'D')

  const notes: string[] = []
  notes.push(
    `快照读合并了 ${groups.length} 个 File Group 的 base file，以及 ${logFileCount} 个 log file（${logRecords.length} 条记录）。`,
  )
  const deleted = merged.filter((r) => r.operation === 'D')
  if (deleted.length) {
    notes.push(
      `其中 ${deleted.length} 条记录已被删除（operation=D），在快照读中不可见，但仍占用存储空间。`,
    )
  }

  return assemble(
    'snapshot',
    state,
    visible,
    request,
    notes,
    '快照读会把 base file 与全部 log file 合并成逻辑上的最新视图：' +
      '读到的结果一定是最新的，代价是要打开多个物理文件（读放大）。',
  )
}

/** 读优化：只读 base file，完全忽略 log file */
function runReadOptimized(state: HudiTableState, request: QueryRequest): QueryResult {
  const groups = activeGroups(state)
  const baseRecords: HudiRecord[] = []
  const logRecords: HudiRecord[] = []

  groups.forEach((g) => {
    if (g.fileSlice.baseFile) baseRecords.push(...g.fileSlice.baseFile.records)
    g.fileSlice.logFiles.forEach((l) => logRecords.push(...l.records))
  })

  const merged = mergeRecords(baseRecords)
  const visible = merged.filter((r) => r.operation !== 'D')

  const baseKeys = new Set(baseRecords.map(keyOf))
  const logOnlyNew = logRecords.filter((r) => !baseKeys.has(keyOf(r))).length
  const logOnlyUpdated = logRecords.length - logOnlyNew

  const notes: string[] = []
  notes.push(
    `read-optimized 模式下忽略了 ${logRecords.length} 条仅存在于 log file 的记录` +
      `（其中 ${logOnlyNew} 条是 base 中完全没有的新主键，${logOnlyUpdated} 条是 base 中已有主键的更新版本）。`,
  )
  if (logRecords.length) {
    notes.push(
      '这些更新要等 compaction 把 log file 合并进 base file 之后才能被读到 —— ' +
        '这正是 MOR 表「必须及时 compaction」的原因。',
    )
  }
  const deletedInBase = merged.filter((r) => r.operation === 'D').length
  if (deletedInBase) {
    notes.push(`base file 中有 ${deletedInBase} 条 tombstone，已在读优化结果中过滤掉。`)
  }

  return assemble(
    'read-optimized',
    state,
    visible,
    request,
    notes,
    '读优化只读 base file：查询最快，但 compaction 之前看不到仅存在于 log file 的更新。' +
      'MOR 表上这个差异最明显。',
  )
}

/** 增量读：beginInstantTime → endInstantTime 窗口内新增/更新的记录 */
function runIncremental(state: HudiTableState, request: QueryRequest): QueryResult {
  const begin = request.beginInstantTime ?? ''
  const end = request.endInstantTime ?? '99999999999999'
  const groups = activeGroups(state)

  const all: HudiRecord[] = []
  groups.forEach((g) => {
    if (g.fileSlice.baseFile) all.push(...g.fileSlice.baseFile.records)
    g.fileSlice.logFiles.forEach((l) => all.push(...l.records))
  })

  // 增量读必须扫描**原始版本**而不是合并后的视图：
  // 合并视图只保留每个主键的最新版本，会把窗口内的中间版本吃掉
  const inWindow = all.filter((r) => r.commitTime >= begin && r.commitTime <= end)
  const latest = mergeRecords(inWindow)

  const deleted = latest.filter((r) => r.operation === 'D')
  const upserts = latest.filter((r) => r.operation !== 'D')

  const notes: string[] = []
  notes.push(
    `增量读窗口 [${begin || '最早'} , ${end === '99999999999999' ? '最新' : end}]：` +
      `返回 ${upserts.length} 条新增/更新记录，${deleted.length} 条删除标记（operation=D）。`,
  )
  if (deleted.length) {
    notes.push(
      '删除记录以 operation=D 的形式返回，消费端必须自己处理删除语义，否则下游会出现「删了但没删干净」的问题。',
    )
  }

  // 增量读必须带上 _hoodie_operation，否则消费端无法区分新增、更新与删除
  return assemble(
    'incremental',
    state,
    latest,
    { ...request, includeMetaFields: true },
    notes,
    '增量读返回时间窗口内的变更流水（新增 / 更新 / 删除），而不是全量快照。' +
      '它是 CDC 链路与微批同步的基础。',
    ['_hoodie_operation'],
  )
}

/** 时间旅行：读取某个历史 instant 时刻的快照 */
function runTimeTravel(state: HudiTableState, request: QueryRequest): QueryResult {
  const asOf = request.asOfInstant ?? ''
  if (!asOf) {
    return {
      mode: 'time-travel',
      columns: [],
      rows: [],
      rowCount: 0,
      notes: ['未指定 asOfInstant，无法执行时间旅行查询。'],
      explanation: '时间旅行查询必须指定目标 instant。',
    }
  }

  const notes: string[] = []
  const snapshot = snapshotAt(state, asOf)

  if (snapshot) {
    const groups = activeGroups(snapshot)
    const all: HudiRecord[] = []
    groups.forEach((g) => {
      if (g.fileSlice.baseFile) all.push(...g.fileSlice.baseFile.records)
      g.fileSlice.logFiles.forEach((l) => all.push(...l.records))
    })
    const visible = mergeRecords(all).filter((r) => r.operation !== 'D')
    notes.push(`已从 checkpoint 还原 ${asOf} 时刻的完整快照。`)
    return assemble(
      'time-travel',
      state,
      visible,
      request,
      notes,
      `时间旅行读取的是 instant ${asOf} 提交完成之后的状态 —— ` +
        '这依赖 Timeline 上仍然保留该 instant，一旦被归档并清理了历史文件就查不到了。',
    )
  }

  // 回退：没有 checkpoint 时，按 commitTime 过滤当前记录
  const fallback = state.records.filter((r) => r.commitTime <= asOf && r.operation !== 'D')
  notes.push(
    `未找到 instant ${asOf} 对应的 checkpoint，已回退为「按 commitTime ≤ ${asOf} 过滤当前记录」。`,
  )
  notes.push(
    '注意：当前记录视图每个主键只保留最新版本，因此在该 instant 之后被更新或删除的记录无法精确还原 —— ' +
      '回退结果是近似值，不是真实快照。',
  )
  return assemble(
    'time-travel',
    state,
    fallback,
    request,
    notes,
    `时间旅行（回退模式）读取 ${asOf} 时刻的近似状态。` +
      '若要得到精确快照，需要该 instant 仍然留在 Timeline 与 checkpoint 中。',
  )
}

/* ============================ 公共部分 ============================ */

/** 当前生效的 File Group（被取代的不再参与查询） */
function activeGroups(state: HudiTableState): HudiTableState['fileGroups'] {
  return state.fileGroups.filter((g) => !g.supersededBy)
}

function keyOf(r: HudiRecord): string {
  return `${r.partitionPath}::${r.recordKey}`
}

/**
 * 组装最终结果：列顺序 = 业务字段（表定义顺序优先）+ 追加字段 + 元字段。
 */
function assemble(
  mode: QueryMode,
  state: HudiTableState,
  records: HudiRecord[],
  request: QueryRequest,
  notes: string[],
  explanation: string,
  forcedMetaFields: string[] = [],
): QueryResult {
  const includeMeta = request.includeMetaFields === true
  const metaFields = forcedMetaFields.length
    ? forcedMetaFields
    : includeMeta
      ? META_FIELD_NAMES
      : []

  const limited =
    typeof request.limit === 'number' && request.limit >= 0 ? records.slice(0, request.limit) : records

  const rows = limited.map((r) => toRow(r, metaFields))
  const columns = buildColumns(state, rows, metaFields)

  const finalNotes = [...notes]
  if (limited.length < records.length) {
    finalNotes.push(`结果已按 limit=${request.limit} 截断（实际命中 ${records.length} 行）。`)
  }

  return {
    mode,
    columns,
    rows,
    rowCount: rows.length,
    notes: finalNotes,
    explanation: `${QUERY_MODE_LABEL[mode]}：${explanation}`,
  }
}

/** 记录 → 结果行 */
function toRow(record: HudiRecord, metaFields: string[]): Record<string, unknown> {
  const row: Record<string, unknown> = { ...record.fields }
  metaFields.forEach((f) => {
    switch (f) {
      case META_FIELDS.recordKey:
        row[f] = record.recordKey
        break
      case META_FIELDS.partitionPath:
        row[f] = record.partitionPath
        break
      case META_FIELDS.operation:
        row[f] = record.operation
        break
      case META_FIELDS.commitTime:
        row[f] = record.commitTime
        break
      case META_FIELDS.commitSeqNo:
        row[f] = record.commitSeqNo
        break
      default:
        break
    }
  })
  return row
}

/**
 * 列顺序：
 *   1. 表定义里的字段（保持 schema 顺序）
 *   2. 结果里出现但表定义没有的字段（按字典序，避免顺序抖动）
 *   3. 元字段
 */
function buildColumns(
  state: HudiTableState,
  rows: Record<string, unknown>[],
  metaFields: string[],
): string[] {
  const declared = state.table.fields.map((f) => f.name)
  const extras = new Set<string>()
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      if (!declared.includes(k) && !metaFields.includes(k)) extras.add(k)
    })
  })

  const columns: string[] = []
  declared.forEach((d) => {
    if (!columns.includes(d)) columns.push(d)
  })
  if (state.table.primaryKey && !columns.includes(state.table.primaryKey)) {
    columns.push(state.table.primaryKey)
  }
  if (state.table.preCombineField && !columns.includes(state.table.preCombineField)) {
    columns.push(state.table.preCombineField)
  }
  ;[...extras].sort().forEach((e) => {
    if (!columns.includes(e)) columns.push(e)
  })
  metaFields.forEach((m) => {
    if (!columns.includes(m)) columns.push(m)
  })
  return columns
}
