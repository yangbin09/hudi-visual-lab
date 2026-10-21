import type { HudiVersionProfile } from '@/models/hudi'
import type {
  HudiBaseFile,
  HudiFileGroup,
  HudiLogFile,
  HudiRecord,
  HudiTableState,
  InstantAction,
} from '@/models/hudi'
import { SimulationError } from '@/engine/core/errors'
import { nextInstant } from '@/engine/core/instant'
import {
  findFileGroupForKey,
  partitionsOfRecord,
  pushCheckpoint,
  recomputeFileGroupStats,
} from '@/engine/core/state'
import {
  baseFileName,
  estimateBaseFileSize,
  estimateLogFileSize,
  logFileName,
  makeFileGroupId,
} from '@/engine/filesystem/layout'
import { ruleByKey, type ScenarioRule } from './rules'
import type { WriteOutcome } from './writes'

/** 一次删除的目标：主键 + 它所在的分区 */
interface DeleteTarget {
  recordKey: string
  partitionPath: string
}

/**
 * 删除语义。
 *
 * Hudi 的删除从来不是「把文件里的行删掉」，而是「写入一条 delete record（tombstone）」：
 *   - COW：无法局部修改 parquet，必须重写整个 File Group，
 *          新 base file 中该记录以 operation='D' 的形式保留；
 *   - MOR：向目标 File Group 追加一个 log file，里面装 tombstone。
 *
 * 逻辑记录视图（state.records）里该条记录被标记为 'D'，
 * visibleRecords() 会把它过滤掉 —— 逻辑上不可见，但物理上仍然存在。
 * 只有等到 compaction / clean 之后，这份空间才真正被回收。
 */
export function performDelete(
  state: HudiTableState,
  recordKeys: string[],
  profile: HudiVersionProfile,
): WriteOutcome {
  const table = state.table
  const logs: string[] = []
  const warnings: string[] = []
  const filesAdded: string[] = []
  const filesRemoved: string[] = []
  const recordsChanged: string[] = []
  const appliedRules: ScenarioRule[] = []

  if (!recordKeys.length) {
    throw new SimulationError('没有指定待删除的主键，删除操作终止。')
  }
  if (!table.primaryKey) {
    throw new SimulationError(
      '表未配置主键（hoodie.datasource.write.recordkey.field），无法定位待删除的记录。',
      'spark-sql-write',
    )
  }

  /* ---------- 1. 全量存在性校验 ---------- */
  // Hudi 写入是「整批原子提交」的：任何一条记录不存在，整批都失败。
  // 先做完校验再动状态，避免出现「删了一半」的中间态。
  const missing = recordKeys.filter((k) => !state.records.some((r) => r.recordKey === k))
  if (missing.length) {
    throw new SimulationError(
      `主键 ${missing.join('、')} 在表 ${table.tableName} 中不存在，删除操作已终止（不做部分删除）。`,
    )
  }

  const isCow = table.tableType === 'COPY_ON_WRITE'
  const instantTime = nextInstant(state.instantCounter)

  // 删除在文件落点上与「更新已存在主键」同构，复用同一条场景规则，避免另造一套说法
  const rule = ruleByKey(isCow ? 'COW_UPDATE_EXISTING' : 'MOR_UPDATE_EXISTING')
  if (rule) appliedRules.push(rule)

  /* ---------- 2. 展开删除目标 ---------- */
  // 同一主键可能落在多个分区（跨分区同主键是 Hudi 的经典坑），必须逐分区处理
  const targets: DeleteTarget[] = []
  recordKeys.forEach((key) => {
    partitionsOfRecord(state, key).forEach((partitionPath) => {
      targets.push({ recordKey: key, partitionPath })
    })
  })

  let seqNo = state.records.reduce((max, r) => Math.max(max, r.commitSeqNo), 0)
  const nextSeq = (): number => {
    seqNo += 1
    return seqNo
  }
  let fileIdSeq = state.fileGroups.reduce((max, g) => Math.max(max, fileIdOf(g.fileId)), -1) + 1

  // 受影响的 File Group 集合要在改文件之前算好，改完之后旧的 group 已经 superseded
  const affectedGroupIds = new Set<string>()
  targets.forEach((t) => {
    const owner = findFileGroupForKey(state, t.recordKey, t.partitionPath)
    if (owner) affectedGroupIds.add(owner.fileId)
  })

  /* ---------- 3. 文件层落地 ---------- */
  // 按目标 File Group 分组：COW 一次重写一个 group，MOR 一次追加一个 log file
  const byGroup = new Map<string, DeleteTarget[]>()
  targets.forEach((t) => {
    const owner = findFileGroupForKey(state, t.recordKey, t.partitionPath)
    if (!owner) {
      warnings.push(
        `主键 ${t.recordKey}（分区 ${t.partitionPath || '(默认分区)'}）在文件层没有对应的 File Group，` +
          '仅更新了逻辑记录视图。',
      )
      return
    }
    const list = byGroup.get(owner.fileId) ?? []
    list.push(t)
    byGroup.set(owner.fileId, list)
  })

  if (isCow) {
    /* ---- COW：重写目标 File Group，新 base file 中保留 tombstone ---- */
    byGroup.forEach((groupTargets, fileId) => {
      const owner = state.fileGroups.find((g) => g.fileId === fileId)
      if (!owner) return

      const tombstoneKeys = new Set(groupTargets.map((t) => `${t.partitionPath}::${t.recordKey}`))
      const source: HudiRecord[] = [
        ...(owner.fileSlice.baseFile?.records ?? []),
        ...owner.fileSlice.logFiles.flatMap((l) => l.records),
      ]

      // 其余记录原样保留；被删除的记录改写为 tombstone
      const rewritten: HudiRecord[] = source.map((r) => {
        if (!tombstoneKeys.has(`${r.partitionPath}::${r.recordKey}`)) {
          return { ...r }
        }
        return {
          ...r,
          operation: 'D',
          commitTime: instantTime,
          commitSeqNo: nextSeq(),
        }
      })

      const newGroupId = makeFileGroupId(instantTime, 0, fileIdSeq++)
      const newBase: HudiBaseFile = {
        fileName: baseFileName(newGroupId, instantTime),
        instantTime,
        sizeBytes: estimateBaseFileSize(rewritten.length),
        recordCount: rewritten.length,
        records: rewritten,
        storagePath: '',
        fileId: newGroupId,
      }

      // 旧文件只是「不再被引用」，物理上仍在 HDFS，等待 Clean 真正删除
      if (owner.fileSlice.baseFile) {
        filesRemoved.push(owner.fileSlice.baseFile.fileName)
        markSuperseded(state, owner.fileSlice.baseFile.fileName, instantTime, newBase.fileName)
      }
      owner.fileSlice.logFiles.forEach((l) => {
        filesRemoved.push(l.fileName)
        markSuperseded(state, l.fileName, instantTime, newBase.fileName)
      })
      owner.supersededBy = newGroupId

      filesAdded.push(newBase.fileName)
      registerFile(
        state,
        newBase.fileName,
        owner.partitionPath,
        'BASE',
        newBase.sizeBytes,
        newBase.recordCount,
        instantTime,
      )

      const group: HudiFileGroup = {
        fileId: newGroupId,
        partitionPath: owner.partitionPath,
        fileSlice: {
          baseFile: newBase,
          logFiles: [],
          baseInstantTime: instantTime,
          deltaCommits: [],
          compactionRequested: false,
        },
        recordCount: 0,
        totalSizeBytes: 0,
        bucket: owner.bucket,
      }
      recomputeFileGroupStats(group)
      state.fileGroups.push(group)
    })
  } else {
    /* ---- MOR：向目标 File Group 追加一个装满 tombstone 的 log file ---- */
    byGroup.forEach((groupTargets, fileId) => {
      const owner = state.fileGroups.find((g) => g.fileId === fileId)
      if (!owner) return

      const baseInstant = owner.fileSlice.baseInstantTime ?? owner.fileId.split('_')[0]
      const version = owner.fileSlice.logFiles.length + 1

      const tombstones: HudiRecord[] = groupTargets.map((t) => {
        const source = findVersionInGroup(owner, t.recordKey, t.partitionPath)
        return {
          recordKey: t.recordKey,
          partitionPath: t.partitionPath,
          // tombstone 仍然带着原来的字段值：读优化视图里它是一条「被删除的历史版本」
          fields: source ? { ...source.fields } : {},
          preCombineValue: source?.preCombineValue ?? null,
          commitTime: instantTime,
          commitSeqNo: nextSeq(),
          operation: 'D',
          hoodieKey: `${t.recordKey}:${t.partitionPath}`,
        }
      })

      const log: HudiLogFile = {
        fileName: logFileName(owner.fileId, baseInstant, version, instantTime),
        instantTime,
        version,
        sizeBytes: estimateLogFileSize(tombstones.length),
        recordCount: tombstones.length,
        records: tombstones,
        storagePath: '',
      }
      owner.fileSlice.logFiles.push(log)
      owner.fileSlice.deltaCommits.push(instantTime)
      filesAdded.push(log.fileName)
      registerFile(state, log.fileName, owner.partitionPath, 'LOG', log.sizeBytes, log.recordCount, instantTime)
      recomputeFileGroupStats(owner)
    })
  }

  /* ---------- 4. 逻辑记录视图 ---------- */
  // 标记为 'D' 之后 visibleRecords() 会把它过滤掉 —— 逻辑上「查不到」，物理上「还在」
  targets.forEach((t) => {
    const logical = state.records.find(
      (r) => r.recordKey === t.recordKey && r.partitionPath === t.partitionPath,
    )
    if (!logical) return
    logical.operation = 'D'
    logical.commitTime = instantTime
    logical.commitSeqNo = nextSeq()
    recordsChanged.push(`${t.partitionPath}::${t.recordKey}`)
  })

  /* ---------- 5. Timeline ---------- */
  const timelineAction: InstantAction = isCow ? 'COMMIT' : 'DELTA_COMMIT'
  state.timeline.push({
    instantTime,
    action: timelineAction,
    state: 'COMPLETED',
    operation: 'DELETE',
    tableName: table.tableName,
    files: filesAdded,
    extraMetadata: {
      recordsDeleted: recordsChanged.length,
      deletedKeys: [...recordKeys],
      scenarioRule: rule?.key,
    },
  })
  state.instantCounter += 1
  state.usedInstants.push(instantTime)

  /* ---------- 6. 日志 ---------- */
  logs.push(`[${instantTime}] 开始执行 DELETE（表类型 ${table.tableType}，目标版本 ${profile.release}）`)
  logs.push(`[${instantTime}] 待删除主键：${recordKeys.join('、')}`)
  if (rule) {
    logs.push(`[${instantTime}] 命中场景规则：${rule.scenario} → ${rule.landingText}`)
  }
  logs.push(
    isCow
      ? `[${instantTime}] COW 路径：重写 ${affectedGroupIds.size} 个 File Group，tombstone 写入新 base file`
      : `[${instantTime}] MOR 路径：向 ${affectedGroupIds.size} 个目标 File Group 追加 log file，tombstone 写入 log block`,
  )
  logs.push(`[${instantTime}] 新增数据文件 ${filesAdded.length} 个：${filesAdded.join(', ') || '无'}`)
  if (filesRemoved.length) {
    logs.push(
      `[${instantTime}] 旧文件被新文件取代（物理文件仍在 HDFS，等待 Clean 清理）：${filesRemoved.join(', ')}`,
    )
  }
  logs.push(`[${instantTime}] 提交完成，Timeline 写入 ${timelineAction} instant`)

  /* ---------- 7. Checkpoint ---------- */
  // 删完立刻打快照，这样 time travel 才能回到「刚删完」这一刻
  pushCheckpoint(state, instantTime)

  return {
    state,
    instantTime,
    action: timelineAction,
    operation: 'DELETE',
    logs,
    explanation: buildExplanation(isCow, recordsChanged.length, filesAdded.length, filesRemoved.length),
    warnings,
    filesAdded,
    filesRemoved,
    recordsChanged,
    appliedRules,
  }
}

/* ------------------------------ 内部工具 ------------------------------ */

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

/** 在 File Group 中找某主键的当前版本（base 优先，其次 log） */
function findVersionInGroup(
  group: HudiFileGroup,
  recordKey: string,
  partitionPath: string,
): HudiRecord | undefined {
  const inBase = group.fileSlice.baseFile?.records.find(
    (r) => r.recordKey === recordKey && r.partitionPath === partitionPath,
  )
  if (inBase) return inBase
  for (const l of group.fileSlice.logFiles) {
    const hit = l.records.find((r) => r.recordKey === recordKey && r.partitionPath === partitionPath)
    if (hit) return hit
  }
  return undefined
}

function buildExplanation(
  isCow: boolean,
  deletedCount: number,
  filesAddedCount: number,
  filesRemovedCount: number,
): string {
  const parts: string[] = []
  parts.push(
    isCow
      ? 'COW 表的删除会重写整个 File Group：读出旧 base file，把目标记录改写成 operation=D 的 tombstone，再写出新的 parquet 文件。' +
        '因为 parquet 无法局部修改，删除一行也要付出整文件重写的代价。'
      : 'MOR 表的删除只追加一个 log file，里面装着 operation=D 的 tombstone 记录。' +
        'base file 不动，删除成本与文件大小无关 —— 这正是 MOR 相对 COW 的核心优势。',
  )
  parts.push(
    `本次删除 ${deletedCount} 条记录，新增 ${filesAddedCount} 个数据文件，${filesRemovedCount} 个旧文件被新文件取代。`,
  )
  parts.push(
    '被删除的记录在逻辑记录视图中被标记为 operation=D，查询时不可见；' +
      '但 tombstone 仍然占用存储空间，只有后续 compaction / clean 才会真正回收。',
  )
  return parts.join('\n')
}
