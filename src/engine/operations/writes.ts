import type { HudiVersionProfile } from '@/models/hudi'
import type {
  HudiBaseFile,
  HudiFileGroup,
  HudiFileSlice,
  HudiLogFile,
  HudiRecord,
  HudiTableState,
  InstantAction,
} from '@/models/hudi'
import type { InputRecord } from '@/models/actions'
import { SimulationError } from '@/engine/core/errors'
import { nextInstant } from '@/engine/core/instant'
import {
  derivePartitionPath,
  findFileGroupForKey,
  mergeRecords,
  recomputeFileGroupStats,
} from '@/engine/core/state'
import { checkOperationCompatibility, bucketOf } from '@/engine/indexes/bucket'
import {
  baseFileName,
  estimateBaseFileSize,
  estimateLogFileSize,
  logFileName,
  makeFileGroupId,
} from '@/engine/filesystem/layout'
import { SCENARIO_RULES, type LandingKind, type ScenarioRule } from './rules'

export interface WriteOutcome {
  state: HudiTableState
  instantTime: string
  action: InstantAction
  operation: string
  logs: string[]
  explanation: string
  warnings: string[]
  filesAdded: string[]
  filesRemoved: string[]
  recordsChanged: string[]
  appliedRules: ScenarioRule[]
}

interface PreparedRecord {
  recordKey: string
  partitionPath: string
  fields: Record<string, unknown>
  preCombineValue: number | null
}

/** 场景开关：MOR 分区首写的文件落点 */
export function morInitialLanding(table: { properties: Record<string, string> }): LandingKind {
  return table.properties['lab.mor.initial.landing'] === 'BASE_FILE' ? 'BASE_FILE' : 'LOG_ONLY_GROUP'
}

function preCombineOf(
  table: { preCombineField: string | null },
  fields: Record<string, unknown>,
): number | null {
  if (!table.preCombineField) return null
  const v = fields[table.preCombineField]
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

function fileIdOf(groupId: string): number {
  const tail = groupId.slice(groupId.lastIndexOf('-') + 1)
  const n = Number(tail)
  return Number.isNaN(n) ? 0 : n
}

/** 登记一个 HDFS 物理文件 */
function registerFile(
  state: HudiTableState,
  fileName: string,
  partitionPath: string,
  type: 'BASE' | 'LOG',
  sizeBytes: number,
  recordCount: number,
  createdInstant: string,
): void {
  state.physicalFiles.push({
    fileName,
    partitionPath,
    type,
    sizeBytes,
    recordCount,
    createdInstant,
    status: 'ACTIVE',
  })
}

/** 标记物理文件被取代（仍存在于 HDFS，等待 Clean 删除） */
function markSuperseded(state: HudiTableState, fileName: string, at: string, by: string): void {
  const f = state.physicalFiles.find((x) => x.fileName === fileName)
  if (f) {
    f.status = 'SUPERSEDED'
    f.supersededAt = at
    f.supersededBy = by
  }
}

function nextFileId(state: HudiTableState): number {
  return state.fileGroups.reduce((max, g) => Math.max(max, fileIdOf(g.fileId)), -1) + 1
}

/** 同批次同主键去重：precombine 值大者胜；相等或含空值时后写入者胜 */
function dedupeBatch(prepared: PreparedRecord[], warnings: string[]): PreparedRecord[] {
  const map = new Map<string, { rec: PreparedRecord; seq: number }>()
  prepared.forEach((r, i) => {
    const k = `${r.partitionPath}::${r.recordKey}`
    const prev = map.get(k)
    if (!prev) {
      map.set(k, { rec: r, seq: i })
      return
    }
    const a = prev.rec.preCombineValue
    const b = r.preCombineValue
    let winner = r
    if (a !== null && b !== null) {
      if (a > b) winner = prev.rec
      else if (a === b) {
        warnings.push(
          `同一批次内主键 ${r.recordKey} 出现两次且 precombine 字段取值相同（${b}），按 Hudi 行为保留后写入的一条。`,
        )
      }
    } else {
      warnings.push(
        `同一批次内主键 ${r.recordKey} 出现多次，且 precombine 字段存在空值，保留最后写入的一条。`,
      )
    }
    map.set(k, { rec: winner, seq: i })
  })
  return [...map.entries()]
    .sort((a, b) => a[1].seq - b[1].seq)
    .map(([, v]) => v.rec)
}

/**
 * 统一写入实现 —— insert / upsert / bulk_insert / insert_overwrite 共用。
 */
export function performWrite(
  state: HudiTableState,
  input: InputRecord[],
  operation: 'UPSERT' | 'INSERT' | 'BULK_INSERT' | 'INSERT_OVERWRITE' | 'INSERT_OVERWRITE_TABLE',
  profile: HudiVersionProfile,
  opts: { partitionOverride?: string } = {},
): WriteOutcome {
  const table = state.table
  const warnings: string[] = []
  const logs: string[] = []
  const appliedRules: ScenarioRule[] = []
  const filesAdded: string[] = []
  const filesRemoved: string[] = []
  const recordsChanged: string[] = []

  const incompat = checkOperationCompatibility(table, operation)
  if (incompat) {
    throw new SimulationError(incompat, 'bucket-with-bulk-insert')
  }
  if (!input.length) {
    throw new SimulationError('没有待写入的记录，操作终止。')
  }
  if (!table.primaryKey) {
    throw new SimulationError(
      '表未配置主键（hoodie.datasource.write.recordkey.field），无法进行写入定位。',
      'spark-sql-write',
    )
  }

  const instantTime = nextInstant(state.instantCounter)
  const isCow = table.tableType === 'COPY_ON_WRITE'
  const isBulk = operation === 'BULK_INSERT'
  const isOverwrite = operation === 'INSERT_OVERWRITE' || operation === 'INSERT_OVERWRITE_TABLE'

  /* ---------- 1. 准备记录 ---------- */
  const preparedRaw: PreparedRecord[] = input.map((r) => {
    const partitionPath =
      opts.partitionOverride !== undefined
        ? opts.partitionOverride
        : r.partitionPath !== undefined
          ? r.partitionPath
          : derivePartitionPath(table, r.fields)
    return {
      recordKey: r.recordKey,
      partitionPath,
      fields: r.fields,
      preCombineValue: preCombineOf(table, r.fields),
    }
  })

  /* ---------- 2. 同批次去重 ---------- */
  const prepared = dedupeBatch(preparedRaw, warnings)

  /* ---------- 2.5 precombine 判定（必须发生在写盘之前） ----------
   * Hudi 在合并时先比较 precombine 字段：新版本值更小则直接丢弃，
   * 该记录根本不会进入任何文件。若放到写盘之后才判断，
   * 文件内容与逻辑记录视图会出现不一致。 */
  let effective = prepared
  if (!isBulk && !isOverwrite) {
    effective = prepared.filter((r) => {
      const existing = state.records.find(
        (x) =>
          x.recordKey === r.recordKey &&
          x.partitionPath === r.partitionPath &&
          x.operation !== 'D',
      )
      if (!existing) return true
      if (
        existing.preCombineValue !== null &&
        r.preCombineValue !== null &&
        r.preCombineValue < existing.preCombineValue
      ) {
        warnings.push(
          `主键 ${r.recordKey} 的新记录 precombine 值（${r.preCombineValue}）小于已有版本（${existing.preCombineValue}），按 Hudi 语义忽略该次更新（该记录不会写入任何文件）。`,
        )
        return false
      }
      return true
    })
  }

  /* ---------- 3. 跨分区同主键检查 ---------- */
  const keyToPartitions = new Map<string, Set<string>>()
  effective.forEach((r) => {
    if (!keyToPartitions.has(r.recordKey)) keyToPartitions.set(r.recordKey, new Set())
    keyToPartitions.get(r.recordKey)!.add(r.partitionPath)
  })
  keyToPartitions.forEach((parts, key) => {
    if (parts.size > 1) {
      warnings.push(
        `主键 ${key} 在本次写入中跨越了 ${parts.size} 个分区（${[...parts].join(', ')}）。` +
          (table.indexType === 'BUCKET'
            ? 'BUCKET 索引按 (分区, 桶) 定位 File Group，跨分区同主键会落入不同桶，产生重复主键。'
            : '非 GLOBAL 索引只能在分区内定位主键。'),
      )
    }
  })

  /* ---------- 4. 按分区分组 ---------- */
  const byPartition = new Map<string, PreparedRecord[]>()
  effective.forEach((r) => {
    const list = byPartition.get(r.partitionPath) ?? []
    list.push(r)
    byPartition.set(r.partitionPath, list)
  })

  let fileIdSeq = nextFileId(state)
  let seqNo = 0
  let primaryRule: ScenarioRule | undefined

  /* ---------- 5. 逐分区处理 ---------- */
  for (const [partitionPath, recs] of byPartition) {
    const activeGroups = state.fileGroups.filter((g) => g.partitionPath === partitionPath && !g.supersededBy)

    /* --- 覆盖语义：先作废旧 File Group --- */
    if (isOverwrite) {
      const targets = operation === 'INSERT_OVERWRITE_TABLE'
        ? state.fileGroups.filter((g) => !g.supersededBy)
        : activeGroups
      targets.forEach((g) => {
        g.supersededBy = 'replace'
        if (g.fileSlice.baseFile) {
          filesRemoved.push(g.fileSlice.baseFile.fileName)
          markSuperseded(state, g.fileSlice.baseFile.fileName, instantTime, 'replace')
        }
        g.fileSlice.logFiles.forEach((l) => {
          filesRemoved.push(l.fileName)
          markSuperseded(state, l.fileName, instantTime, 'replace')
        })
      })
      if (operation === 'INSERT_OVERWRITE_TABLE') {
        state.records = []
      } else {
        state.records = state.records.filter(
          (r) => !(r.partitionPath === partitionPath && r.operation !== 'D'),
        )
      }
    }

    /* --- 分类：更新已有主键 vs 新主键 --- */
    const updates: PreparedRecord[] = []
    const inserts: PreparedRecord[] = []
    recs.forEach((r) => {
      const owner = isBulk
        ? undefined
        : table.indexType === 'BUCKET'
          ? state.fileGroups.find(
              (g) =>
                !g.supersededBy &&
                g.partitionPath === r.partitionPath &&
                g.bucket === bucketOf(r.recordKey, table.bucketCount ?? 1),
            )
          : findFileGroupForKey(state, r.recordKey, r.partitionPath)
      if (owner && !isOverwrite) updates.push(r)
      else inserts.push(r)
    })

    /* --- 场景规则 --- */
    const rule = resolveRule(table.tableType, {
      isBulk,
      hasUpdates: updates.length > 0,
      partitionHasGroups: activeGroups.length > 0,
      morInitialLanding: morInitialLanding(table),
    })
    appliedRules.push(rule)
    primaryRule = primaryRule ?? rule
    if (rule.needsVerification) {
      warnings.push(`场景规则「${rule.scenario}」的 r26 实际落点待确认，当前按教学模型呈现。`)
    }

    /* --- COW 路径 --- */
    if (isCow) {
      const groupOfUpdate = new Map<string, PreparedRecord[]>()
      updates.forEach((r) => {
        const owner = findFileGroupForKey(state, r.recordKey, r.partitionPath)
        const gid = owner?.fileId ?? `__new__${r.recordKey}`
        const list = groupOfUpdate.get(gid) ?? []
        list.push(r)
        groupOfUpdate.set(gid, list)
      })

      groupOfUpdate.forEach((recsOfGroup, gid) => {
        const owner = state.fileGroups.find((g) => g.fileId === gid && !g.supersededBy)
        const newGroupId = makeFileGroupId(instantTime, 0, fileIdSeq++)
        const candidates: HudiRecord[] = []
        if (owner) {
          owner.fileSlice.baseFile?.records.forEach((r) => candidates.push({ ...r }))
          owner.fileSlice.logFiles.forEach((l) => l.records.forEach((r) => candidates.push({ ...r })))
          owner.supersededBy = newGroupId
          if (owner.fileSlice.baseFile) {
            filesRemoved.push(owner.fileSlice.baseFile.fileName)
            markSuperseded(state, owner.fileSlice.baseFile.fileName, instantTime, newGroupId)
          }
          owner.fileSlice.logFiles.forEach((l) => {
            filesRemoved.push(l.fileName)
            markSuperseded(state, l.fileName, instantTime, newGroupId)
          })
        }
        recsOfGroup.forEach((r) => {
          seqNo += 1
          candidates.push(buildRecord(r, instantTime, seqNo, owner ? 'U' : 'I'))
          recordsChanged.push(`${r.partitionPath}::${r.recordKey}`)
        })
        // COW 重写必须去重：base file 里同一个主键只能保留生效版本
        const merged = mergeRecords(candidates)
        const base = buildBaseFile(newGroupId, instantTime, merged)
        filesAdded.push(base.fileName)
        registerFile(state, base.fileName, partitionPath, 'BASE', base.sizeBytes, base.recordCount, instantTime)
        const group: HudiFileGroup = {
          fileId: newGroupId,
          partitionPath,
          fileSlice: {
            baseFile: base,
            logFiles: [],
            baseInstantTime: instantTime,
            deltaCommits: [],
            compactionRequested: false,
          },
          recordCount: 0,
          totalSizeBytes: 0,
          bucket: table.indexType === 'BUCKET' ? bucketOf(recsOfGroup[0].recordKey, table.bucketCount ?? 1) : null,
        }
        recomputeFileGroupStats(group)
        state.fileGroups.push(group)
      })

      if (inserts.length) {
        const newGroupId = makeFileGroupId(instantTime, 0, fileIdSeq++)
        const built: HudiRecord[] = []
        inserts.forEach((r) => {
          seqNo += 1
          built.push(buildRecord(r, instantTime, seqNo, 'I'))
          recordsChanged.push(`${r.partitionPath}::${r.recordKey}`)
        })
        const base = buildBaseFile(newGroupId, instantTime, built)
        filesAdded.push(base.fileName)
        registerFile(state, base.fileName, partitionPath, 'BASE', base.sizeBytes, base.recordCount, instantTime)
        const group: HudiFileGroup = {
          fileId: newGroupId,
          partitionPath,
          fileSlice: {
            baseFile: base,
            logFiles: [],
            baseInstantTime: instantTime,
            deltaCommits: [],
            compactionRequested: false,
          },
          recordCount: 0,
          totalSizeBytes: 0,
          bucket: table.indexType === 'BUCKET' ? bucketOf(inserts[0].recordKey, table.bucketCount ?? 1) : null,
        }
        recomputeFileGroupStats(group)
        state.fileGroups.push(group)
      }
    } else {
      /* --- MOR 路径 --- */
      const groupOfUpdate = new Map<string, PreparedRecord[]>()
      updates.forEach((r) => {
        const owner = findFileGroupForKey(state, r.recordKey, r.partitionPath)
        const gid = owner?.fileId ?? '__none__'
        const list = groupOfUpdate.get(gid) ?? []
        list.push(r)
        groupOfUpdate.set(gid, list)
      })

      groupOfUpdate.forEach((recsOfGroup, gid) => {
        const owner = state.fileGroups.find((g) => g.fileId === gid && !g.supersededBy)
        if (!owner) return
        appendLogFile(owner, recsOfGroup, instantTime, filesAdded, recordsChanged, state, partitionPath, () => {
          seqNo += 1
          return seqNo
        })
      })

      if (inserts.length) {
        const newGroupId = makeFileGroupId(instantTime, 0, fileIdSeq++)
        const built: HudiRecord[] = []
        inserts.forEach((r) => {
          seqNo += 1
          built.push(buildRecord(r, instantTime, seqNo, 'I'))
          recordsChanged.push(`${r.partitionPath}::${r.recordKey}`)
        })
        if (rule.landing === 'BASE_FILE') {
          const base = buildBaseFile(newGroupId, instantTime, built)
          filesAdded.push(base.fileName)
          registerFile(state, base.fileName, partitionPath, 'BASE', base.sizeBytes, base.recordCount, instantTime)
          const group: HudiFileGroup = {
            fileId: newGroupId,
            partitionPath,
            fileSlice: {
              baseFile: base,
              logFiles: [],
              baseInstantTime: instantTime,
              deltaCommits: [],
              compactionRequested: false,
            },
            recordCount: 0,
            totalSizeBytes: 0,
            bucket: table.indexType === 'BUCKET' ? bucketOf(inserts[0].recordKey, table.bucketCount ?? 1) : null,
          }
          recomputeFileGroupStats(group)
          state.fileGroups.push(group)
        } else {
          const group: HudiFileGroup = {
            fileId: newGroupId,
            partitionPath,
            fileSlice: {
              baseFile: null,
              logFiles: [],
              baseInstantTime: null,
              deltaCommits: [],
              compactionRequested: false,
            },
            recordCount: 0,
            totalSizeBytes: 0,
            bucket: table.indexType === 'BUCKET' ? bucketOf(inserts[0].recordKey, table.bucketCount ?? 1) : null,
          }
          const log = buildLogFile(newGroupId, instantTime, 1, instantTime, built)
          filesAdded.push(log.fileName)
          registerFile(state, log.fileName, partitionPath, 'LOG', log.sizeBytes, log.recordCount, instantTime)
          group.fileSlice.logFiles.push(log)
          recomputeFileGroupStats(group)
          state.fileGroups.push(group)
        }
      }
    }
  }

  /* ---------- 6. 逻辑记录视图 ---------- */
  effective.forEach((r) => {
    const existing = state.records.find(
      (x) => x.recordKey === r.recordKey && x.partitionPath === r.partitionPath && x.operation !== 'D',
    )
    if (existing) {
      if (
        existing.preCombineValue !== null &&
        r.preCombineValue !== null &&
        r.preCombineValue < existing.preCombineValue
      ) {
        warnings.push(
          `主键 ${r.recordKey} 的新记录 precombine 值（${r.preCombineValue}）小于已有版本（${existing.preCombineValue}），按 Hudi 语义忽略该次更新。`,
        )
        return
      }
      existing.operation = 'U'
      existing.fields = { ...existing.fields, ...r.fields }
      existing.preCombineValue = r.preCombineValue
      existing.commitTime = instantTime
      existing.commitSeqNo = ++seqNo
    } else {
      seqNo += 1
      state.records.push(buildRecord(r, instantTime, seqNo, 'I'))
    }
  })

  /* ---------- 7. Timeline ---------- */
  const timelineAction: InstantAction = isOverwrite ? 'REPLACE_COMMIT' : isCow ? 'COMMIT' : 'DELTA_COMMIT'
  state.timeline.push({
    instantTime,
    action: timelineAction,
    state: 'COMPLETED',
    operation,
    tableName: table.tableName,
    files: filesAdded,
    extraMetadata: {
      recordsChanged: recordsChanged.length,
      scenarioRule: primaryRule?.key,
    },
  })
  state.instantCounter += 1
  state.usedInstants.push(instantTime)

  /* ---------- 8. 日志 ---------- */
  logs.push(`[${instantTime}] 开始执行 ${operation}（表类型 ${table.tableType}）`)
  logs.push(`[${instantTime}] 目标分区：${[...byPartition.keys()].join(', ') || '(无)'}`)
  if (primaryRule) {
    logs.push(`[${instantTime}] 命中场景规则：${primaryRule.scenario} → ${primaryRule.landingText}`)
  }
  logs.push(`[${instantTime}] 新增数据文件 ${filesAdded.length} 个：${filesAdded.join(', ') || '无'}`)
  if (filesRemoved.length) {
    logs.push(
      `[${instantTime}] 旧文件被新文件取代（物理文件仍在 HDFS，等待 Clean 清理）：${filesRemoved.join(', ')}`,
    )
  }
  logs.push(`[${instantTime}] 提交完成，Timeline 写入 ${timelineAction} instant`)

  return {
    state,
    instantTime,
    action: timelineAction,
    operation,
    logs,
    explanation: buildExplanation(table.tableType, operation, primaryRule, filesAdded.length, filesRemoved.length),
    warnings,
    filesAdded,
    filesRemoved,
    recordsChanged,
    appliedRules: appliedRules.filter(Boolean),
  }
}

function resolveRule(
  tableType: 'COPY_ON_WRITE' | 'MERGE_ON_READ',
  ctx: {
    isBulk: boolean
    hasUpdates: boolean
    partitionHasGroups: boolean
    morInitialLanding: LandingKind
  },
): ScenarioRule {
  const isCow = tableType === 'COPY_ON_WRITE'
  if (ctx.isBulk) {
    return SCENARIO_RULES.find((r) => r.key === (isCow ? 'COW_BULK_INSERT' : 'MOR_BULK_INSERT'))!
  }
  if (isCow) {
    if (ctx.hasUpdates) return SCENARIO_RULES.find((r) => r.key === 'COW_UPDATE_EXISTING')!
    return SCENARIO_RULES.find((r) => r.key === 'COW_INSERT_NEW_KEY')!
  }
  if (ctx.hasUpdates) return SCENARIO_RULES.find((r) => r.key === 'MOR_UPDATE_EXISTING')!
  if (ctx.partitionHasGroups) return SCENARIO_RULES.find((r) => r.key === 'MOR_INSERT_NEW_KEY')!
  const rule = SCENARIO_RULES.find((r) => r.key === 'MOR_INITIAL_INSERT')!
  if (ctx.morInitialLanding === 'BASE_FILE') {
    return {
      ...rule,
      landing: 'BASE_FILE',
      landingText: '生成 Base File（场景开关：MOR 首写落点 = BASE_FILE）',
    }
  }
  return rule
}

function buildRecord(
  r: PreparedRecord,
  instantTime: string,
  seqNo: number,
  op: 'I' | 'U' | 'D',
): HudiRecord {
  return {
    recordKey: r.recordKey,
    partitionPath: r.partitionPath,
    fields: { ...r.fields },
    preCombineValue: r.preCombineValue,
    commitTime: instantTime,
    commitSeqNo: seqNo,
    operation: op,
    hoodieKey: `${r.recordKey}:${r.partitionPath}`,
  }
}

function buildBaseFile(fileGroupId: string, instantTime: string, records: HudiRecord[]): HudiBaseFile {
  return {
    fileName: baseFileName(fileGroupId, instantTime),
    instantTime,
    sizeBytes: estimateBaseFileSize(records.length),
    recordCount: records.length,
    records,
    storagePath: '',
    fileId: fileGroupId,
  }
}

function buildLogFile(
  fileGroupId: string,
  baseInstantTime: string,
  version: number,
  writeToken: string,
  records: HudiRecord[],
): HudiLogFile {
  return {
    fileName: logFileName(fileGroupId, baseInstantTime, version, writeToken),
    instantTime: writeToken,
    version,
    sizeBytes: estimateLogFileSize(records.length),
    recordCount: records.length,
    records,
    storagePath: '',
  }
}

function appendLogFile(
  owner: HudiFileGroup,
  recs: PreparedRecord[],
  instantTime: string,
  filesAdded: string[],
  recordsChanged: string[],
  state: HudiTableState,
  partitionPath: string,
  nextSeq: () => number,
): void {
  const baseInstant = owner.fileSlice.baseInstantTime ?? owner.fileId.split('_')[0]
  const version = owner.fileSlice.logFiles.length + 1
  const built = recs.map((r) => buildRecord(r, instantTime, nextSeq(), 'U'))
  const log = buildLogFile(owner.fileId, baseInstant, version, instantTime, built)
  owner.fileSlice.logFiles.push(log)
  owner.fileSlice.deltaCommits.push(instantTime)
  filesAdded.push(log.fileName)
  registerFile(state, log.fileName, partitionPath, 'LOG', log.sizeBytes, log.recordCount, instantTime)
  built.forEach((b) => recordsChanged.push(`${b.partitionPath}::${b.recordKey}`))
  recomputeFileGroupStats(owner)
}

function buildExplanation(
  tableType: string,
  operation: string,
  rule: ScenarioRule | undefined,
  fileCount: number,
  replacedCount: number,
): string {
  const parts: string[] = []
  parts.push(
    tableType === 'COPY_ON_WRITE'
      ? 'COW 表：每次写入都以「整文件重写」的方式落地，写入即产出完整 parquet 文件。'
      : 'MOR 表：写入以 log file 形式追加到 File Slice，只有经过 compaction 才会合并成 parquet base file。',
  )
  if (rule) parts.push(`本次命中场景规则「${rule.scenario}」，文件落点为：${rule.landingText}。${rule.note}`)
  parts.push(
    `本次新增 ${fileCount} 个数据文件${replacedCount ? `，另有 ${replacedCount} 个旧文件被新文件取代` : ''}。`,
  )
  parts.push('被取代的旧文件在 Clean 执行之前仍然物理存在于 HDFS 上 —— 这就是 COW 的写放大代价。')
  return parts.join('\n')
}
