import type { HudiFileGroup, HudiRecord, HudiTable, HudiTableState } from '@/models/hudi'

/** 初始状态 */
export function createInitialState(table: HudiTable): HudiTableState {
  return {
    table: structuredClone(table),
    records: [],
    fileGroups: [],
    physicalFiles: [],
    timeline: [],
    archivedInstants: [],
    pendingInstants: [],
    compactionPlans: [],
    ttlPolicies: [],
    instantCounter: 0,
    usedInstants: [],
    checkpoints: [],
  }
}

/** 提交成功后打快照（供 Restore / Time Travel 使用） */
export function pushCheckpoint(state: HudiTableState, instantTime: string): void {
  const snapshot: HudiTableState = {
    ...cloneState(state),
    checkpoints: [],
  }
  state.checkpoints.push({ instantTime, state: snapshot })
}

export function cloneState(state: HudiTableState): HudiTableState {
  return structuredClone(state)
}

/** 按 record key 定位当前记录 */
export function findRecord(state: HudiTableState, recordKey: string): HudiRecord | undefined {
  return state.records.find((r) => r.recordKey === recordKey)
}

/** 按 record key + 分区定位记录 */
export function findRecordInPartition(
  state: HudiTableState,
  recordKey: string,
  partitionPath: string,
): HudiRecord | undefined {
  return state.records.find((r) => r.recordKey === recordKey && r.partitionPath === partitionPath)
}

/** 记录所在分区集合（同一 key 出现在多个分区即为冲突） */
export function partitionsOfRecord(state: HudiTableState, recordKey: string): string[] {
  return [...new Set(state.records.filter((r) => r.recordKey === recordKey).map((r) => r.partitionPath))]
}

/**
 * 定位包含某 record key 的 file group。
 *
 * 只在**未被取代**（!supersededBy）的 File Group 中查找：
 * COW 重写后旧 File Group 仍留在 fileGroups 里（等 Clean 才物理删除），
 * 若不过滤，第二次更新同一主键时会命中旧 group，导致新旧两个 group 同时「有效」。
 */
export function findFileGroupForKey(
  state: HudiTableState,
  recordKey: string,
  partitionPath: string,
): HudiFileGroup | undefined {
  return state.fileGroups.find(
    (g) =>
      !g.supersededBy &&
      g.partitionPath === partitionPath &&
      g.fileSlice.baseFile?.records.some((r) => r.recordKey === recordKey) === true,
  ) ?? state.fileGroups.find(
    (g) =>
      !g.supersededBy &&
      g.partitionPath === partitionPath &&
      g.fileSlice.logFiles.some((l) => l.records.some((r) => r.recordKey === recordKey)),
  )
}

/** 分区下的所有 file group */
export function fileGroupsOfPartition(state: HudiTableState, partitionPath: string): HudiFileGroup[] {
  return state.fileGroups.filter((g) => g.partitionPath === partitionPath)
}

/** 全部分区路径 */
export function allPartitions(state: HudiTableState): string[] {
  return [...new Set(state.fileGroups.map((g) => g.partitionPath))].sort()
}

/** 当前可见记录（过滤掉 tombstone） */
export function visibleRecords(state: HudiTableState): HudiRecord[] {
  return state.records.filter((r) => r.operation !== 'D')
}

/** 记录总数（含 tombstone） */
export function totalRecords(state: HudiTableState): number {
  return state.records.length
}

/** 构建 HoodieKey 字符串 */
export function hoodieKeyOf(recordKey: string, partitionPath: string): string {
  return `${recordKey}:${partitionPath}`
}

/** 重新计算 file group 的记录数与体积 */
export function recomputeFileGroupStats(group: HudiFileGroup): void {
  let count = 0
  let size = 0
  if (group.fileSlice.baseFile) {
    count += group.fileSlice.baseFile.records.length
    size += group.fileSlice.baseFile.sizeBytes
  }
  group.fileSlice.logFiles.forEach((l) => {
    count += l.records.length
    size += l.sizeBytes
  })
  group.recordCount = count
  group.totalSizeBytes = size
}

/** 推导分区路径 */
export function derivePartitionPath(table: HudiTable, fields: Record<string, unknown>): string {
  if (!table.partitionFields.length) return ''
  return table.partitionFields
    .map((f) => {
      const v = fields[f]
      if (v === undefined || v === null || v === '') return ''
      return String(v)
    })
    .join('/')
}

/** 判断是否为「默认分区」（分区字段缺失/空） */
export function isDefaultPartition(partitionPath: string): boolean {
  return partitionPath === ''
}

/** 逻辑记录视图：同 key 多次写入以最后一条为准 */
export function materializeLogicalRecords(state: HudiTableState): HudiRecord[] {
  const byKey = new Map<string, HudiRecord>()
  state.records.forEach((r) => {
    const k = `${r.partitionPath}::${r.recordKey}`
    const prev = byKey.get(k)
    if (!prev) {
      byKey.set(k, r)
      return
    }
    // precombine 语义：值更大的胜出；相等时后写入的胜出
    if (r.preCombineValue === null || prev.preCombineValue === null) {
      byKey.set(k, r)
    } else if (r.preCombineValue >= prev.preCombineValue) {
      byKey.set(k, r)
    }
  })
  return [...byKey.values()]
}

/**
 * 合并同一 File Slice 内的多条记录，产出一个「每个主键只有一行」的结果集。
 *
 * 这是 COW 重写与 MOR compaction 的共同基础：
 * 物理文件里同一个主键只应保留一行（生效版本），
 * 否则 base file 内会出现重复主键 —— 真实 Hudi 的 COW 重写必然做这一步去重。
 *
 * 规则：precombine 值大者胜；precombine 缺失时后写入者胜。
 */
export function mergeRecords(records: HudiRecord[]): HudiRecord[] {
  const byKey = new Map<string, HudiRecord>()
  records.forEach((r) => {
    const k = `${r.partitionPath}::${r.recordKey}`
    const prev = byKey.get(k)
    if (!prev) {
      byKey.set(k, r)
      return
    }
    const a = prev.preCombineValue
    const b = r.preCombineValue
    if (a !== null && b !== null) {
      if (b >= a) byKey.set(k, r)
    } else {
      byKey.set(k, r)
    }
  })
  return [...byKey.values()]
}
