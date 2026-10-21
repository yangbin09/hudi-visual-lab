import type { CompactionFailureMode } from '@/models/actions'
import type {
  CompactionPlan,
  HudiFileGroup,
  HudiRecord,
  HudiTableState,
  HudiInstant,
  TtlPolicy,
} from '@/models/hudi'
import { SimulationError } from '@/engine/core/errors'
import { nextInstant, prettyInstant } from '@/engine/core/instant'
import { mergeRecords, recomputeFileGroupStats } from '@/engine/core/state'
import { baseFileName, estimateBaseFileSize, makeFileGroupId } from '@/engine/filesystem/layout'
import { AVG_RECORD_BYTES } from '@/engine/filesystem/layout'

export interface ServiceOutcome {
  state: HudiTableState
  instantTime: string
  logs: string[]
  explanation: string
  warnings: string[]
  filesAdded: string[]
  filesDeleted: string[]
  events: string[]
}

/**
 * 合并记录：同 (分区, 主键) 以 precombine 值大者胜；
 * precombine 缺失时后写入者胜（与 Hudi 行为一致）。
 *
 * 实现在 core/state.ts（COW 重写与 MOR compaction 共用），此处保留 re-export 以兼容既有引用。
 */
export { mergeRecords }

/* =========================== Compaction =========================== */

export function scheduleCompaction(state: HudiTableState, deltaCommits = 1): ServiceOutcome {
  if (state.table.tableType !== 'MERGE_ON_READ') {
    throw new SimulationError('COW 表没有 log file，不需要 compaction。')
  }
  const logs: string[] = []
  const eligible = state.fileGroups.filter(
    (g) => !g.supersededBy && g.fileSlice.logFiles.length >= deltaCommits,
  )
  if (!eligible.length) {
    throw new SimulationError(
      `当前没有满足条件的 File Group（要求 log file 数 ≥ ${deltaCommits}）。compaction.delta_commits 配置过小会导致空跑。`,
    )
  }
  const instantTime = nextInstant(state.instantCounter)
  const plan: CompactionPlan = {
    instantTime,
    state: 'PLANNED',
    entries: eligible.map((g) => ({
      partitionPath: g.partitionPath,
      fileId: g.fileId,
      logFileCount: g.fileSlice.logFiles.length,
      recordCount: g.fileSlice.logFiles.reduce((n, l) => n + l.records.length, 0),
    })),
  }
  state.compactionPlans.push(plan)
  eligible.forEach((g) => (g.fileSlice.compactionRequested = true))

  const pending: HudiInstant = {
    instantTime,
    action: 'COMPACTION',
    state: 'REQUESTED',
    tableName: state.table.tableName,
    extraMetadata: { planFileCount: plan.entries.length },
  }
  state.timeline.push(pending)
  state.pendingInstants.push(pending)
  state.instantCounter += 1

  logs.push(`[${instantTime}] 生成 Compaction Plan（compaction.delta_commits = ${deltaCommits}）`)
  logs.push(`[${instantTime}] 待处理 File Group ${plan.entries.length} 个：`)
  plan.entries.forEach((e) => {
    logs.push(`           - ${e.partitionPath} / ${e.fileId}：${e.logFileCount} 个 log file，${e.recordCount} 条记录`)
  })
  logs.push(`[${instantTime}] 写入 ${instantTime}.compaction.requested，等待调度执行`)

  return {
    state,
    instantTime,
    logs,
    explanation:
      `Compaction Plan 的生成本身不改动任何数据文件，它只在 .hoodie 下写出一个 requested 标记与计划文件。` +
      `计划与执行是两个独立动作 —— 这正是异步 compaction 的基础。`,
    warnings: ['本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群。'],
    filesAdded: [],
    filesDeleted: [],
    events: [`生成 Compaction Plan（${plan.entries.length} 个 File Group）`],
  }
}

export function runCompaction(
  state: HudiTableState,
  planInstant: string | undefined,
  failWith: CompactionFailureMode = 'NONE',
): ServiceOutcome {
  const logs: string[] = []
  const warnings: string[] = ['本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群。']
  const filesAdded: string[] = []
  const filesDeleted: string[] = []
  const events: string[] = []

  const plan = planInstant
    ? state.compactionPlans.find((p) => p.instantTime === planInstant)
    : [...state.compactionPlans].reverse().find((p) => p.state === 'PLANNED')

  if (!plan) {
    throw new SimulationError(
      '未找到待执行的 Compaction Plan。可能原因：尚未生成计划，或计划已被执行 / 已被 Archive。',
      'run-compaction-sql',
    )
  }
  if (plan.state === 'EXECUTED') {
    throw new SimulationError(
      `Compaction Plan ${plan.instantTime} 已执行过，属于过期计划（stale plan）。Hudi 会忽略并需要重新生成计划。`,
      'run-compaction-sql',
    )
  }
  if (plan.state === 'FAILED') {
    throw new SimulationError(`Compaction Plan ${plan.instantTime} 上次执行失败，请先排查失败原因再重新生成计划。`)
  }

  const instantTime = nextInstant(state.instantCounter)
  state.instantCounter += 1

  /* ---------------- 故障注入分支 ---------------- */
  if (failWith !== 'NONE') {
    const pending = state.timeline.find((i) => i.instantTime === plan.instantTime && i.state === 'REQUESTED')
    const scenarios: Record<Exclude<CompactionFailureMode, 'NONE'>, { yarn: string; spark: string; hudi: string; detail: string }> = {
      SPARK_TASK_FAILED: {
        yarn: 'ACCEPTED → RUNNING → FAILED',
        spark: 'Job aborted due to task failure: java.lang.OutOfMemoryError: Java heap space',
        hudi: 'compaction instant 停留在 REQUESTED，未产生任何新 base file',
        detail:
          'Spark 任务失败 → YARN 应用 FAILED → compaction 事务没有提交 → Timeline 上仍是 requested。文件与数据均未变化。',
      },
      YARN_KILLED: {
        yarn: 'ACCEPTED → RUNNING → KILLED（用户 kill 或抢占）',
        spark: '（无正常结束日志，被强制终止）',
        hudi: 'compaction instant 停留在 REQUESTED',
        detail:
          'YARN 应用被 KILL → 同样是「调度成功但事务未提交」的情况。注意 YARN 侧看到的是 KILLED，不是 SUCCEEDED。',
      },
      SPARK_OK_BUT_TX_INCOMPLETE: {
        yarn: 'ACCEPTED → RUNNING → SUCCEEDED',
        spark: 'Job finished successfully. Total time: 42 s',
        hudi: '⚠️ Spark 成功，但 compaction instant 仍停留在 REQUESTED —— Hudi 事务没有真正完成',
        detail:
          '这是最危险的场景：YARN 显示 SUCCEEDED、Spark 日志正常结束，但 Hudi 的 Timeline 事务并未提交。' +
          '必须以 Timeline 上的 completed compaction instant 为准，不能只看 YARN 状态。',
      },
      PLAN_NOT_FOUND: {
        yarn: '（未提交）',
        spark: '（未提交）',
        hudi: '未找到 plan 文件，作业直接失败',
        detail: '调度系统触发了 compaction，但 .hoodie 下没有对应的 plan 文件。',
      },
      STALE_PLAN: {
        yarn: 'ACCEPTED → RUNNING → SUCCEEDED',
        spark: 'Job finished successfully.',
        hudi: 'plan 已被消费（Hoodie 的 plan 是「一次性」资源），本次执行未产生任何变更',
        detail:
          '同一个 plan 被重复触发。Hudi 的 compaction plan 是一次性资源，重复执行不会产生新的 compaction。',
      },
      SCHEDULER_TIMEOUT: {
        yarn: '未提交',
        spark: '未提交',
        hudi: 'plan 一直停留在 requested，文件未合并',
        detail:
          '调度平台超时未触发作业。compaction.delta_commits 设置过大会让 plan 长时间堆积，log file 持续增长。',
      },
    }
    const s = scenarios[failWith]
    plan.state = 'FAILED'
    if (pending) {
      pending.state = 'INFLIGHT'
      pending.extraMetadata = { ...(pending.extraMetadata ?? {}), failure: failWith }
    }
    state.pendingInstants = state.pendingInstants.filter((i) => i.instantTime !== plan.instantTime)
    state.timeline.push({
      instantTime,
      action: 'COMPACTION',
      state: 'INFLIGHT',
      tableName: state.table.tableName,
      extraMetadata: { failure: failWith, planInstant: plan.instantTime },
    })
    state.pendingInstants.push({
      instantTime,
      action: 'COMPACTION',
      state: 'INFLIGHT',
      tableName: state.table.tableName,
      extraMetadata: { failure: failWith, planInstant: plan.instantTime },
    })

    logs.push(`[${instantTime}] 调度提交 Compaction 作业（plan = ${plan.instantTime}）`)
    logs.push(`  YARN 状态：${s.yarn}`)
    logs.push(`  Spark 状态：${s.spark}`)
    logs.push(`  Hudi 事务：${s.hudi}`)
    logs.push(`[${instantTime}] 结论：${s.detail}`)
    events.push(`Compaction 执行失败（${failWith}）`)
    return {
      state,
      instantTime,
      logs,
      explanation: s.detail,
      warnings,
      filesAdded,
      filesDeleted,
      events,
    }
  }

  /* ---------------- 正常执行 ---------------- */
  const touched: HudiFileGroup[] = []
  plan.entries.forEach((entry) => {
    const g = state.fileGroups.find((x) => x.fileId === entry.fileId)
    if (!g) return
    const merged = mergeRecords([
      ...(g.fileSlice.baseFile?.records ?? []),
      ...g.fileSlice.logFiles.flatMap((l) => l.records),
    ])
    const newBaseName = baseFileName(g.fileId, instantTime)
    const oldBase = g.fileSlice.baseFile
    const oldLogs = [...g.fileSlice.logFiles]

    oldBase?.records.forEach(() => undefined)
    // 旧文件转为 SUPERSEDED（物理仍在 HDFS，等待 Clean）
    const supAt = instantTime
    if (oldBase) {
      const pf = state.physicalFiles.find((f) => f.fileName === oldBase.fileName)
      if (pf) {
        pf.status = 'SUPERSEDED'
        pf.supersededAt = supAt
        pf.supersededBy = newBaseName
      }
      filesDeleted.push(oldBase.fileName)
    }
    oldLogs.forEach((l) => {
      const pf = state.physicalFiles.find((f) => f.fileName === l.fileName)
      if (pf) {
        pf.status = 'SUPERSEDED'
        pf.supersededAt = supAt
        pf.supersededBy = newBaseName
      }
      filesDeleted.push(l.fileName)
    })

    const newBase = {
      fileName: newBaseName,
      instantTime,
      sizeBytes: estimateBaseFileSize(merged.length),
      recordCount: merged.length,
      records: merged,
      storagePath: '',
      fileId: g.fileId,
      producedBy: instantTime,
    }
    g.fileSlice = {
      baseFile: newBase,
      logFiles: [],
      baseInstantTime: instantTime,
      deltaCommits: [],
      compactionRequested: false,
    }
    recomputeFileGroupStats(g)
    state.physicalFiles.push({
      fileName: newBaseName,
      partitionPath: g.partitionPath,
      type: 'BASE',
      sizeBytes: newBase.sizeBytes,
      recordCount: newBase.recordCount,
      createdInstant: instantTime,
      status: 'ACTIVE',
    })
    filesAdded.push(newBaseName)
    touched.push(g)
  })

  plan.state = 'EXECUTED'
  const pending = state.timeline.find((i) => i.instantTime === plan.instantTime)
  if (pending) {
    pending.state = 'COMPLETED'
    pending.extraMetadata = { ...(pending.extraMetadata ?? {}), executedAt: instantTime }
  }
  state.pendingInstants = state.pendingInstants.filter((i) => i.instantTime !== plan.instantTime)
  state.timeline.push({
    instantTime,
    action: 'COMPACTION',
    state: 'COMPLETED',
    tableName: state.table.tableName,
    files: filesAdded,
    extraMetadata: { planInstant: plan.instantTime, fileGroups: touched.length },
  })

  logs.push(`[${instantTime}] 调度提交 Compaction 作业（plan = ${plan.instantTime}）`)
  logs.push('  YARN 状态：ACCEPTED → RUNNING → SUCCEEDED')
  logs.push('  Spark 状态：Job finished successfully.')
  logs.push(`  Hudi 事务：compaction instant ${instantTime} 已提交（COMPLETED）`)
  logs.push(`[${instantTime}] 合并 ${touched.length} 个 File Group，生成新 base file ${filesAdded.length} 个`)
  logs.push(`[${instantTime}] 被合并的旧文件（log + 旧 base）标记为待 Clean：${filesDeleted.length} 个`)

  return {
    state,
    instantTime,
    logs,
    explanation:
      `Compaction 把每个 File Group 的 base file 与全部 log file 合并成一个新的 parquet base file。` +
      `旧的 base/log 文件此时只是「不再被引用」，物理文件仍在 HDFS 上，必须由 Clean 真正删除。` +
      `判断 compaction 是否成功，要看 Timeline 上是否出现 state=COMPLETED 的 compaction instant，而不是看 YARN 是否 SUCCEEDED。`,
    warnings,
    filesAdded,
    filesDeleted,
    events: [`Compaction 完成，合并 ${touched.length} 个 File Group`],
  }
}

/* ============================== Clean ============================== */

export function runClean(state: HudiTableState, commitsRetained = 1): ServiceOutcome {
  const logs: string[] = []
  const warnings: string[] = ['本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群。']
  const filesDeleted: string[] = []

  const completed = state.timeline.filter((i) => i.state === 'COMPLETED')
  const keep = completed.slice(-Math.max(1, commitsRetained))
  const keepInstants = new Set(keep.map((i) => i.instantTime))

  const deletable = state.physicalFiles.filter(
    (f) => f.status === 'SUPERSEDED' && f.supersededAt && !keepInstants.has(f.supersededAt),
  )

  const instantTime = nextInstant(state.instantCounter)
  state.instantCounter += 1

  if (!deletable.length) {
    logs.push(`[${instantTime}] 执行 Clean（hoodie.cleaner.commits.retained = ${commitsRetained}）`)
    logs.push(`[${instantTime}] 没有符合条件的待清理文件，Clean 空跑`)
    return {
      state,
      instantTime,
      logs,
      explanation:
        `Clean 的删除依据是「文件已不被任何保留窗口内的 commit 引用」。保留窗口内的文件即使被取代也不会被删除，` +
        `这是为了保证历史时间点仍可查询。`,
      warnings,
      filesAdded: [],
      filesDeleted: [],
      events: ['Clean 空跑（无文件满足清理条件）'],
    }
  }

  const names = new Set(deletable.map((f) => f.fileName))
  state.physicalFiles = state.physicalFiles.filter((f) => !names.has(f.fileName))
  filesDeleted.push(...deletable.map((f) => f.fileName))

  state.timeline.push({
    instantTime,
    action: 'CLEAN',
    state: 'COMPLETED',
    tableName: state.table.tableName,
    extraMetadata: { deletedCount: filesDeleted.length, commitsRetained },
  })

  logs.push(`[${instantTime}] 执行 Clean（hoodie.cleaner.commits.retained = ${commitsRetained}）`)
  logs.push(`[${instantTime}] 保留窗口内的 commit：${[...keepInstants].join(', ')}`)
  deletable.forEach((f) => {
    logs.push(`  删除 ${f.type === 'BASE' ? 'base' : 'log '} file: ${f.fileName} (${f.recordCount} 条, ${f.sizeBytes} B)`)
  })
  logs.push(`[${instantTime}] Clean 完成，共删除 ${filesDeleted.length} 个物理文件`)

  return {
    state,
    instantTime,
    logs,
    explanation:
      `Clean 负责物理删除。只有当文件既被新版本取代、又超出 hoodie.cleaner.commits.retained 指定的保留窗口时才可删除。` +
      `「被取代」是逻辑变化，「被删除」是物理变化 —— 两者发生在不同的 instant 上。`,
    warnings,
    filesAdded: [],
    filesDeleted,
    events: [`Clean 删除 ${filesDeleted.length} 个物理文件`],
  }
}

/* ============================= Archive ============================= */

export function runArchive(state: HudiTableState, maxCommitsToKeep = 5): ServiceOutcome {
  const logs: string[] = []
  const warnings: string[] = ['本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群。']

  const completed = state.timeline.filter((i) => i.state === 'COMPLETED')
  if (completed.length <= maxCommitsToKeep) {
    throw new SimulationError(
      `当前 completed instant 数量为 ${completed.length}，未超过保留上限 ${maxCommitsToKeep}，无需归档。`,
      'run-archivelog-sql',
    )
  }
  const boundary = completed[completed.length - maxCommitsToKeep]
  const toArchive = completed.filter((i) => i.instantTime < boundary.instantTime)

  const instantTime = nextInstant(state.instantCounter)
  state.instantCounter += 1

  toArchive.forEach((i) => {
    state.archivedInstants.push(i)
  })
  state.timeline = state.timeline.filter((i) => !toArchive.includes(i))

  state.timeline.push({
    instantTime,
    action: 'ARCHIVE',
    state: 'COMPLETED',
    tableName: state.table.tableName,
    extraMetadata: {
      archivedCount: toArchive.length,
      boundary: boundary.instantTime,
    },
  })

  logs.push(`[${instantTime}] 执行 Archive（hoodie.keep.max.commits = ${maxCommitsToKeep}）`)
  logs.push(`[${instantTime}] 归档边界 instant：${boundary.instantTime}`)
  toArchive.forEach((i) => {
    logs.push(`  归档 ${i.instantTime}.${i.action.toLowerCase()}`)
  })
  logs.push(`[${instantTime}] 归档完成，活跃 Timeline 剩余 ${state.timeline.length} 个 instant`)

  return {
    state,
    instantTime,
    logs,
    explanation:
      `Archive 把较早的 instant 从活跃 Timeline 移到 .hoodie/archive/ 目录下，避免 Timeline 无限膨胀。` +
      `归档只移动元数据 instant 文件，不触碰数据文件。`,
    warnings,
    filesAdded: [],
    filesDeleted: [],
    events: [`Archive 归档 ${toArchive.length} 个 instant`],
  }
}

/* ============================ Rollback ============================ */

export function runRollback(state: HudiTableState, instantTime?: string): ServiceOutcome {
  const logs: string[] = []
  const warnings: string[] = ['本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群。']

  const pending =
    (instantTime
      ? state.pendingInstants.find((i) => i.instantTime === instantTime)
      : state.pendingInstants[state.pendingInstants.length - 1]) ??
    state.timeline.find((i) => i.state !== 'COMPLETED')

  if (!pending) {
    // 指定了一个已完成的 instant 时，给出准确的错误语义
    const completed =
      instantTime !== undefined
        ? state.timeline.find((i) => i.instantTime === instantTime && i.state === 'COMPLETED')
        : undefined
    if (completed) {
      throw new SimulationError(
        `instant ${completed.instantTime} 已经 COMPLETED，无法 rollback；如需回到该时间点请使用 restore。`,
      )
    }
    throw new SimulationError(
      '没有可回滚的 pending / failed instant。Rollback 只能处理未完成的事务，已提交的 instant 需要使用 restore。',
    )
  }
  if (pending.state === 'COMPLETED') {
    throw new SimulationError(
      `instant ${pending.instantTime} 已经 COMPLETED，无法 rollback；如需回到该时间点请使用 restore。`,
    )
  }

  const rollbackInstant = nextInstant(state.instantCounter)
  state.instantCounter += 1

  const removedFiles = state.physicalFiles.filter((f) => f.createdInstant === pending.instantTime)
  const removedNames = new Set(removedFiles.map((f) => f.fileName))
  state.physicalFiles = state.physicalFiles.filter((f) => !removedNames.has(f.fileName))
  state.fileGroups = state.fileGroups.filter((g) => g.fileId !== pending.instantTime)

  state.timeline = state.timeline.filter((i) => i.instantTime !== pending.instantTime)
  state.pendingInstants = state.pendingInstants.filter((i) => i.instantTime !== pending.instantTime)
  state.compactionPlans = state.compactionPlans.filter((p) => p.instantTime !== pending.instantTime)

  state.timeline.push({
    instantTime: rollbackInstant,
    action: 'ROLLBACK',
    state: 'COMPLETED',
    tableName: state.table.tableName,
    extraMetadata: { rolledBack: pending.instantTime, removedFiles: removedFiles.length },
  })

  logs.push(`[${rollbackInstant}] 回滚 instant ${pending.instantTime}（原状态 ${pending.state}）`)
  logs.push(`[${rollbackInstant}] 删除残留文件 ${removedFiles.length} 个`)
  logs.push(`[${rollbackInstant}] 写入 ${rollbackInstant}.rollback，Timeline 恢复一致`)

  return {
    state,
    instantTime: rollbackInstant,
    logs,
    explanation:
      `Rollback 用于处理写了一半就失败的事务：删除该 instant 产生的残留文件，并写入一个 rollback instant 让 Timeline 重新自洽。` +
      `Rollback 不会删除 .hoodie 目录本身，也不应该手工删除 .hoodie 下的元数据文件。`,
    warnings,
    filesAdded: [],
    filesDeleted: removedFiles.map((f) => f.fileName),
    events: [`Rollback ${pending.instantTime}`],
  }
}

/* =========================== Clustering =========================== */

export function runClustering(state: HudiTableState, targetFileSizeMb = 64): ServiceOutcome {
  const logs: string[] = []
  const warnings: string[] = ['本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群。']
  const filesAdded: string[] = []
  const filesDeleted: string[] = []

  const targetRecords = Math.max(1, Math.floor((targetFileSizeMb * 1024 * 1024) / AVG_RECORD_BYTES))
  const partitions = [...new Set(state.fileGroups.filter((g) => !g.supersededBy).map((g) => g.partitionPath))]
  if (!partitions.length) throw new SimulationError('表中没有任何数据，无法执行 clustering。')

  const instantTime = nextInstant(state.instantCounter)
  state.instantCounter += 1
  let fileIdSeq = state.fileGroups.length

  partitions.forEach((partitionPath) => {
    const groups = state.fileGroups.filter((g) => g.partitionPath === partitionPath && !g.supersededBy)
    const allRecords = mergeRecords(
      groups.flatMap((g) => [
        ...(g.fileSlice.baseFile?.records ?? []),
        ...g.fileSlice.logFiles.flatMap((l) => l.records),
      ]),
    )
    const chunks: HudiRecord[][] = []
    for (let i = 0; i < allRecords.length; i += targetRecords) {
      chunks.push(allRecords.slice(i, i + targetRecords))
    }
    groups.forEach((g) => {
      g.supersededBy = 'clustering'
      if (g.fileSlice.baseFile) {
        filesDeleted.push(g.fileSlice.baseFile.fileName)
        const pf = state.physicalFiles.find((f) => f.fileName === g.fileSlice.baseFile!.fileName)
        if (pf) {
          pf.status = 'SUPERSEDED'
          pf.supersededAt = instantTime
          pf.supersededBy = 'clustering'
        }
      }
      g.fileSlice.logFiles.forEach((l) => {
        filesDeleted.push(l.fileName)
        const pf = state.physicalFiles.find((f) => f.fileName === l.fileName)
        if (pf) {
          pf.status = 'SUPERSEDED'
          pf.supersededAt = instantTime
          pf.supersededBy = 'clustering'
        }
      })
    })
    chunks.forEach((chunk) => {
      const gid = makeFileGroupId(instantTime, 0, fileIdSeq++)
      const name = baseFileName(gid, instantTime)
      const size = estimateBaseFileSize(chunk.length)
      state.fileGroups.push({
        fileId: gid,
        partitionPath,
        fileSlice: {
          baseFile: {
            fileName: name,
            instantTime,
            sizeBytes: size,
            recordCount: chunk.length,
            records: chunk,
            storagePath: '',
            fileId: gid,
          },
          logFiles: [],
          baseInstantTime: instantTime,
          deltaCommits: [],
          compactionRequested: false,
        },
        recordCount: chunk.length,
        totalSizeBytes: size,
        bucket: null,
      })
      state.physicalFiles.push({
        fileName: name,
        partitionPath,
        type: 'BASE',
        sizeBytes: size,
        recordCount: chunk.length,
        createdInstant: instantTime,
        status: 'ACTIVE',
      })
      filesAdded.push(name)
    })
  })

  state.timeline.push({
    instantTime,
    action: 'CLUSTERING',
    state: 'COMPLETED',
    tableName: state.table.tableName,
    files: filesAdded,
    extraMetadata: { targetFileSizeMb },
  })

  logs.push(`[${instantTime}] 执行 Clustering（目标文件大小 ${targetFileSizeMb} MB）`)
  logs.push(`[${instantTime}] 重写 ${partitions.length} 个分区，生成新文件 ${filesAdded.length} 个`)
  logs.push(`[${instantTime}] 旧文件标记为待 Clean：${filesDeleted.length} 个`)

  return {
    state,
    instantTime,
    logs,
    explanation:
      `Clustering 重写分区内的小文件，把它们合并成接近目标大小的大文件。` +
      `它解决的是「小文件过多导致读放大与元数据膨胀」的问题，本身不改变数据内容。`,
    warnings,
    filesAdded,
    filesDeleted,
    events: [`Clustering 重写 ${partitions.length} 个分区`],
  }
}

/* ============================== TTL ============================== */

export function applyTtl(
  state: HudiTableState,
  policy: TtlPolicy,
  executeNow = false,
): ServiceOutcome {
  const logs: string[] = []
  const warnings: string[] = ['本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群。']

  if (policy.level !== 'PARTITION') {
    throw new SimulationError(
      '华为 r26 文档明确：TTL 的 level 当前仅支持 PARTITION，RECORD 级不可用。',
      'ttl-record-level',
    )
  }

  const existing = state.ttlPolicies.find((p) => p.spec === policy.spec)
  if (existing) {
    Object.assign(existing, policy)
    logs.push(`[policy] 更新已存在的 TTL 策略：spec=${policy.spec}`)
  } else {
    state.ttlPolicies.push({ ...policy })
    logs.push(`[policy] 新增 TTL 策略：spec=${policy.spec}，${policy.value} ${policy.units}`)
  }

  if (!executeNow) {
    return {
      state,
      instantTime: '',
      logs,
      explanation:
        `TTL 策略已保存，但尚未触发。spec 使用正则表达式匹配分区（可用 show partitions 查看分区格式），` +
        `value 与 units 必须同时提供。华为 r26 的 level 当前仅支持 PARTITION。`,
      warnings,
      filesAdded: [],
      filesDeleted: [],
      events: [`保存 TTL 策略 ${policy.spec}`],
    }
  }

  /* --- 执行：识别过期分区 --- */
  const now = nextInstant(state.instantCounter)
  const nowDate = new Date(
    Date.UTC(Number(now.slice(0, 4)), Number(now.slice(4, 6)) - 1, Number(now.slice(6, 8))),
  )
  const unitMs: Record<TtlPolicy['units'], number> = {
    DAYS: 86400000,
    WEEKS: 7 * 86400000,
    MONTHS: 30 * 86400000,
    YEARS: 365 * 86400000,
  }
  const cutoff = nowDate.getTime() - policy.value * unitMs[policy.units]

  const partitions = [...new Set(state.fileGroups.filter((g) => !g.supersededBy).map((g) => g.partitionPath))]
  let regex: RegExp
  try {
    regex = new RegExp(policy.spec)
  } catch {
    throw new SimulationError(`TTL spec 不是合法的正则表达式：${policy.spec}`)
  }

  const expired: string[] = []
  partitions.forEach((p) => {
    if (!regex.test(p)) return
    const m = p.match(/(\d{4})[-/]?(\d{2})[-/]?(\d{2})/)
    if (!m) return
    const d = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (d < cutoff) expired.push(p)
  })

  const instantTime = nextInstant(state.instantCounter)
  state.instantCounter += 1

  if (!expired.length) {
    logs.push(`[${instantTime}] 执行 TTL（spec=${policy.spec}）`)
    logs.push(`[${instantTime}] 未匹配到过期分区，本次为逻辑空跑`)
    return {
      state,
      instantTime,
      logs,
      explanation:
        `TTL 采用「分区级」语义：先用正则匹配分区，再用分区里的日期与保留时长比较。` +
        `没有任何分区命中时不会产生 ReplaceCommit。`,
      warnings,
      filesAdded: [],
      filesDeleted: [],
      events: ['TTL 执行（无过期分区）'],
    }
  }

  expired.forEach((p) => {
    state.fileGroups
      .filter((g) => g.partitionPath === p && !g.supersededBy)
      .forEach((g) => {
        g.supersededBy = 'ttl'
        if (g.fileSlice.baseFile) {
          const pf = state.physicalFiles.find((f) => f.fileName === g.fileSlice.baseFile!.fileName)
          if (pf) {
            pf.status = 'SUPERSEDED'
            pf.supersededAt = instantTime
            pf.supersededBy = 'ttl'
          }
        }
        g.fileSlice.logFiles.forEach((l) => {
          const pf = state.physicalFiles.find((f) => f.fileName === l.fileName)
          if (pf) {
            pf.status = 'SUPERSEDED'
            pf.supersededAt = instantTime
            pf.supersededBy = 'ttl'
          }
        })
      })
    state.records = state.records.filter((r) => r.partitionPath !== p)
  })

  state.timeline.push({
    instantTime,
    action: 'REPLACE_COMMIT',
    state: 'COMPLETED',
    tableName: state.table.tableName,
    operation: 'TTL',
    extraMetadata: { expiredPartitions: expired, spec: policy.spec },
  })

  logs.push(`[${instantTime}] 执行 TTL（spec=${policy.spec}，${policy.value} ${policy.units}）`)
  logs.push(`[${instantTime}] 逻辑过期分区：${expired.join(', ')}`)
  logs.push(`[${instantTime}] 生成 ReplaceCommit（instant=${instantTime}）—— 分区数据已不可见`)
  logs.push(`[${instantTime}] ⚠️ 物理文件尚未删除，需要后续执行 Clean 才会真正释放存储`)

  return {
    state,
    instantTime,
    logs,
    explanation:
      `TTL 的「分区逻辑过期」与「文件物理删除」是两个独立动作。` +
      `TTL 通过 ReplaceCommit 让过期分区在查询中不再可见；文件仍然占用 HDFS 空间，只有 Clean 才会真正删除。` +
      `排查「TTL 执行了但空间没降」时，要先看 Clean 是否执行。`,
    warnings,
    filesAdded: [],
    filesDeleted: [],
    events: [`TTL 逻辑过期 ${expired.length} 个分区`],
  }
}

/* =========================== 时间旅行 =========================== */

export function snapshotAt(state: HudiTableState, instantTime: string): HudiTableState | undefined {
  const cp = state.checkpoints.find((c) => c.instantTime === instantTime)
  if (cp) return cp.state
  return undefined
}

export function instantLabel(t: string): string {
  return `${t} (${prettyInstant(t)})`
}
