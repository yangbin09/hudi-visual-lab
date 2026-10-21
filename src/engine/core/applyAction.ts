import type { ActionResult, SimulationEvent, StateDelta } from '@/models/simulation'
import type { Evidence } from '@/models/evidence'
import type { CompactionFailureMode, InputRecord, SimulationAction } from '@/models/actions'
import type { HudiTable, HudiTableState, HudiVersionProfile } from '@/models/hudi'
import { ACTION_LABEL } from '@/models/actions'
import { getEvidenceList } from '@/evidence'
import { SimulationError } from '@/engine/core/errors'
import { cloneState, createInitialState, pushCheckpoint } from '@/engine/core/state'
import { performWrite } from '@/engine/operations/writes'
import { performDelete } from '@/engine/operations/deletes'
import {
  applyTtl,
  runArchive,
  runClean,
  runClustering,
  runCompaction,
  runRollback,
  scheduleCompaction,
} from '@/engine/operations/services'
import { HuaweiMRS350R26Profile } from '@/engine/versions/HuaweiMRS350R26Profile'
import { EVIDENCE_MAP } from '@/engine/evidenceMap'

/** 内部：一次 action 执行完成后的中间产物 */
interface ActionOutcome {
  state: HudiTableState
  /** 本次产生的 instant；没有产生 instant 时为空串 */
  instantTime: string
  logs: string[]
  explanation: string
  warnings: string[]
}

/**
 * 统一动作调度器。
 *
 * 两条铁律：
 *   1. **失败绝不能留下任何状态变更** —— 因此先 cloneState 再操作，
 *      出错时直接把原始 state 原样返回，调用方拿到的状态与调用前完全一致。
 *   2. **每个成功动作都留下可回放的证据** —— 成功即 pushCheckpoint，
 *      失败则一条 checkpoint 都不写。
 */
export function applyAction(
  state: HudiTableState,
  action: SimulationAction,
  profile: HudiVersionProfile = HuaweiMRS350R26Profile,
): ActionResult {
  const evidenceIds = EVIDENCE_MAP[action.type] ?? []
  const evidence: Evidence[] = getEvidenceList(evidenceIds)

  // 重置实验不是引擎行为，而是把状态指针拨回实验初始快照。
  // 这里直接返回原始 state（不做任何修改），由 store 负责替换成 initialState。
  if (action.type === 'RESET_EXPERIMENT') {
    const logs = ['[RESET_EXPERIMENT] 收到重置指令，引擎不产生任何状态变更（由 store 恢复到 initialState）']
    const explanation =
      '重置实验不是一次引擎行为，而是把状态指针拨回实验开始时的快照。' +
      '因此这里既没有 instant，也没有 checkpoint。'
    const event: SimulationEvent = {
      eventId: 'evt-RESET_EXPERIMENT-noop',
      action: 'RESET_EXPERIMENT',
      title: ACTION_LABEL.RESET_EXPERIMENT,
      instantTime: null,
      deltas: [],
      logs,
      explanation,
      evidenceIds,
      warnings: [],
      success: true,
    }
    return {
      success: true,
      nextState: state,
      events: [event],
      changes: [],
      logs,
      explanation,
      evidence,
      warnings: [],
    }
  }

  try {
    // 先克隆：后续所有写操作都只作用在克隆体上
    const working = cloneState(state)
    const outcome = dispatch(working, action, profile)

    // 成功 → 打 checkpoint（已打过则跳过，避免重复快照）
    ensureCheckpoint(outcome.state, outcome.instantTime)

    const deltas = diffStates(state, outcome.state)
    const event: SimulationEvent = {
      eventId: `evt-${action.type}-${outcome.instantTime || 'noop'}`,
      action: action.type,
      title: ACTION_LABEL[action.type] ?? action.type,
      instantTime: outcome.instantTime || null,
      deltas,
      logs: outcome.logs,
      explanation: outcome.explanation,
      evidenceIds,
      warnings: outcome.warnings,
      success: true,
    }

    return {
      success: true,
      nextState: outcome.state,
      events: [event],
      changes: deltas,
      logs: outcome.logs,
      explanation: outcome.explanation,
      evidence,
      warnings: outcome.warnings,
    }
  } catch (err) {
    const isSimulationError = err instanceof SimulationError
    const message = isSimulationError
      ? err.message
      : `引擎内部错误：${err instanceof Error ? err.message : String(err)}`
    const warnings = isSimulationError
      ? [message]
      : [message, '该错误不是引擎主动抛出的约束错误，可能是实现缺陷，请反馈。']

    const event: SimulationEvent = {
      eventId: `evt-${action.type}-failed`,
      action: action.type,
      title: `${ACTION_LABEL[action.type] ?? action.type}（失败）`,
      instantTime: null,
      deltas: [],
      logs: [],
      explanation: message,
      evidenceIds,
      warnings,
      success: false,
      error: message,
    }

    return {
      success: false,
      // 关键：失败时 nextState 必须是**原样**的入参 state，不能是克隆体
      nextState: state,
      events: [event],
      changes: [],
      logs: [],
      explanation: message,
      evidence,
      warnings,
      error: message,
    }
  }
}

/* ============================ 动作分派 ============================ */

function dispatch(
  working: HudiTableState,
  action: SimulationAction,
  profile: HudiVersionProfile,
): ActionOutcome {
  switch (action.type) {
    case 'CREATE_TABLE': {
      // 建表是「换一个表」，返回的是全新初始状态，而不是在旧表上打补丁
      const table = buildTable(action.table, profile)
      const fresh = createInitialState(table)
      return {
        state: fresh,
        instantTime: '',
        logs: [
          `[CREATE_TABLE] 创建表 ${table.databaseName}.${table.tableName}`,
          `[CREATE_TABLE] 表类型 ${table.tableType}，主键 ${table.primaryKey}，precombine ${table.preCombineField}，分区字段 ${
            table.partitionFields.join(', ') || '(无)'
          }`,
          `[CREATE_TABLE] 表路径 ${table.tablePath}`,
          `[CREATE_TABLE] 目标版本 ${table.version}`,
        ],
        explanation:
          `建表本身不产生任何数据文件与 instant，只是把「表的元信息」固定下来：` +
          `表类型决定了后续写入落到 base file 还是 log file，主键决定了如何定位一条记录，` +
          `precombine 字段决定了同主键多版本谁胜出。`,
        warnings: [],
      }
    }

    case 'INSERT_RECORDS':
      return fromWrite(working, action.records, 'INSERT', profile)

    case 'UPSERT_RECORDS':
      return fromWrite(working, action.records, 'UPSERT', profile)

    case 'DELETE_RECORDS':
      return fromDelete(working, action.recordKeys, profile)

    case 'OVERWRITE_PARTITION':
      return fromWrite(working, action.records, 'INSERT_OVERWRITE', profile, {
        partitionOverride: action.partitionPath,
      })

    case 'OVERWRITE_TABLE':
      return fromWrite(working, action.records, 'INSERT_OVERWRITE_TABLE', profile)

    case 'SCHEDULE_COMPACTION': {
      const r = scheduleCompaction(working, action.deltaCommits ?? 1)
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: r.warnings,
      }
    }

    case 'RUN_COMPACTION': {
      const r = runCompaction(working, action.planInstant, action.failWith ?? 'NONE')
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: r.warnings,
      }
    }

    case 'RUN_CLEAN': {
      const r = runClean(working, action.commitsRetained ?? 1)
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: r.warnings,
      }
    }

    case 'RUN_ARCHIVE': {
      const r = runArchive(working, action.maxCommitsToKeep ?? 5)
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: r.warnings,
      }
    }

    case 'RUN_ROLLBACK': {
      const r = runRollback(working, action.instantTime)
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: r.warnings,
      }
    }

    case 'RUN_CLUSTERING': {
      const r = runClustering(working, action.targetFileSizeMb ?? 64)
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: r.warnings,
      }
    }

    case 'APPLY_TTL': {
      // executeNow 允许「只保存策略」与「保存并立即执行」两种用法；
      // 模型里没有该字段，因此按可选扩展读取。
      const executeNow = (action as { executeNow?: boolean }).executeNow ?? true
      const r = applyTtl(
        working,
        { spec: action.spec, level: action.level, value: action.value, units: action.units },
        executeNow,
      )
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: r.warnings,
      }
    }

    case 'INJECT_FAILURE': {
      const failWith = mapFailureScenario(action.scenario)
      // STALE_PLAN 的语义是「plan 已被消费过」，需要指向一个已执行的 plan 才会命中
      const planInstant =
        failWith === 'STALE_PLAN'
          ? [...working.compactionPlans].reverse().find((p) => p.state === 'EXECUTED')?.instantTime
          : undefined
      const r = runCompaction(working, planInstant, failWith)
      return {
        state: r.state,
        instantTime: r.instantTime,
        logs: r.logs,
        explanation: r.explanation,
        warnings: [
          ...r.warnings,
          '故障注入本身是一次「成功执行的动作」：它成功地把集群置于失败状态，' +
            '但 Hudi 侧的事务并未提交 —— 判断 compaction 成败请以 Timeline 上 completed 的 compaction instant 为准。',
        ],
      }
    }

    case 'RESET_EXPERIMENT': {
      // 正常流程下不会走到这里（applyAction 入口已单独处理），保留兜底以防将来调用路径变化
      return {
        state: working,
        instantTime: '',
        logs: ['[RESET_EXPERIMENT] 收到重置指令，引擎不产生任何状态变更（由 store 恢复到 initialState）'],
        explanation:
          '重置实验不是一次引擎行为，而是把状态指针拨回实验开始时的快照。' +
          '因此这里既没有 instant，也没有 checkpoint。',
        warnings: [],
      }
    }

    default: {
      const unknown = action as { type?: string }
      throw new SimulationError(`未实现的动作类型：${unknown.type ?? '未知'}`)
    }
  }
}

/* ============================ 写入 / 删除 ============================ */

function fromWrite(
  working: HudiTableState,
  records: InputRecord[],
  operation: 'UPSERT' | 'INSERT' | 'BULK_INSERT' | 'INSERT_OVERWRITE' | 'INSERT_OVERWRITE_TABLE',
  profile: HudiVersionProfile,
  opts: { partitionOverride?: string } = {},
): ActionOutcome {
  const r = performWrite(working, records, operation, profile, opts)
  return {
    state: r.state,
    instantTime: r.instantTime,
    logs: r.logs,
    explanation: r.explanation,
    warnings: r.warnings,
  }
}

function fromDelete(
  working: HudiTableState,
  recordKeys: string[],
  profile: HudiVersionProfile,
): ActionOutcome {
  const r = performDelete(working, recordKeys, profile)
  return {
    state: r.state,
    instantTime: r.instantTime,
    logs: r.logs,
    explanation: r.explanation,
    warnings: r.warnings,
  }
}

/* ============================ 故障注入映射 ============================ */

/**
 * 场景名 → runCompaction 的 failWith。
 * 只映射 r26 Compaction 规范中明确描述过的失败形态，未实现的场景必须明确报错。
 */
const FAILURE_SCENARIOS: Record<string, CompactionFailureMode> = {
  NONE: 'NONE',
  SPARK_TASK_FAILED: 'SPARK_TASK_FAILED',
  YARN_KILLED: 'YARN_KILLED',
  SPARK_OK_BUT_TX_INCOMPLETE: 'SPARK_OK_BUT_TX_INCOMPLETE',
  PLAN_NOT_FOUND: 'PLAN_NOT_FOUND',
  STALE_PLAN: 'STALE_PLAN',
  SCHEDULER_TIMEOUT: 'SCHEDULER_TIMEOUT',
}

function mapFailureScenario(scenario: string): CompactionFailureMode {
  const mode = FAILURE_SCENARIOS[scenario]
  if (!mode) {
    const supported = Object.keys(FAILURE_SCENARIOS)
      .filter((k) => k !== 'NONE')
      .join('、')
    throw new SimulationError(
      `未实现的故障注入场景「${scenario}」。当前已实现的场景：${supported}。`,
    )
  }
  return mode
}

/* ============================ 建表默认值 ============================ */

/** r26 目标的 Hudi 版本；版本差异必须来自 profile，不能硬编码在业务逻辑里 */
const DEFAULT_HUDI_VERSION = '0.15.0-h0.cbu.mrs.350.r26'

function buildTable(
  partial: Partial<HudiTable> & { tableName: string },
  profile: HudiVersionProfile,
): HudiTable {
  const tableName = partial.tableName
  const databaseName = partial.databaseName ?? 'hudi_demo'
  const partitionFields = partial.partitionFields ?? []
  const indexType = partial.indexType ?? 'SIMPLE'
  const tableType = partial.tableType ?? 'COPY_ON_WRITE'

  return {
    tableName,
    databaseName,
    tableType,
    fields: partial.fields ?? [],
    primaryKey: partial.primaryKey ?? 'id',
    preCombineField: partial.preCombineField ?? 'ts',
    partitionFields,
    partitionType: partial.partitionType ?? (partitionFields.length ? 'PARTITIONED' : 'NON_PARTITIONED'),
    indexType,
    bucketCount: partial.bucketCount ?? null,
    isGlobalIndexed:
      partial.isGlobalIndexed ?? (indexType === 'GLOBAL_SIMPLE' || indexType === 'GLOBAL_BLOOM'),
    payloadClass: partial.payloadClass ?? 'org.apache.hudi.common.model.HoodiePayload.class',
    tablePath: partial.tablePath ?? `/user/hive/warehouse/${databaseName}.db/${tableName}`,
    hiveStylePartitioning:
      partial.hiveStylePartitioning ?? (partitionFields.length ? 'HIVE_STYLE_PARTITIONING' : 'NONE'),
    properties: partial.properties ?? {},
    version: partial.version ?? profile.components.hudi ?? DEFAULT_HUDI_VERSION,
  }
}

/* ============================ Checkpoint ============================ */

/**
 * 打 checkpoint。
 * performDelete 已经在自己内部打过一次，这里做幂等保护，避免同一 instant 出现两份快照。
 */
function ensureCheckpoint(state: HudiTableState, instantTime: string): void {
  if (!instantTime) return
  const last = state.checkpoints[state.checkpoints.length - 1]
  if (last && last.instantTime === instantTime) return
  pushCheckpoint(state, instantTime)
}

/* ============================ 状态差异 ============================ */

/**
 * 计算两个状态之间的差异。
 * 需求 §13.3 要求「所有状态变化可追溯」，
 * 因此每个 action 都要明确回答：哪些记录、文件、instant 被加进来、改掉了或删掉了。
 */
function diffStates(before: HudiTableState, after: HudiTableState): StateDelta[] {
  const deltas: StateDelta[] = []

  const table = diffByKey(
    [before.table],
    [after.table],
    (t) => t.tableName,
    (t) => JSON.stringify(t),
  )
  pushDelta(deltas, 'table', table)

  const records = diffByKey(
    before.records,
    after.records,
    (r) => `${r.partitionPath}::${r.recordKey}`,
    (r) => JSON.stringify(r),
  )
  pushDelta(deltas, 'records', records)

  const groups = diffByKey(
    before.fileGroups,
    after.fileGroups,
    (g) => g.fileId,
    (g) => `${g.partitionPath}|${g.supersededBy ?? ''}|${JSON.stringify(g.fileSlice)}`,
  )
  pushDelta(deltas, 'fileGroups', groups)

  const timeline = diffByKey(
    before.timeline,
    after.timeline,
    (i) => i.instantTime,
    (i) => `${i.action}|${i.state}|${JSON.stringify(i.extraMetadata ?? {})}`,
  )
  pushDelta(deltas, 'timeline', timeline)

  const plans = diffByKey(
    before.compactionPlans,
    after.compactionPlans,
    (p) => p.instantTime,
    (p) => p.state,
  )
  pushDelta(deltas, 'compactionPlans', plans)

  const policies = diffByKey(
    before.ttlPolicies,
    after.ttlPolicies,
    (p) => p.spec,
    (p) => JSON.stringify(p),
  )
  pushDelta(deltas, 'ttlPolicies', policies)

  const files = diffByKey(
    before.physicalFiles,
    after.physicalFiles,
    (f) => f.fileName,
    (f) => `${f.status}|${f.supersededBy ?? ''}|${f.recordCount}`,
  )
  pushDelta(deltas, 'filesystem', files)

  return deltas
}

function pushDelta(
  deltas: StateDelta[],
  target: StateDelta['target'],
  diff: { added: string[]; updated: string[]; removed: string[] },
): void {
  if (!diff.added.length && !diff.updated.length && !diff.removed.length) return
  deltas.push({ target, added: diff.added, updated: diff.updated, removed: diff.removed })
}

function diffByKey<T>(
  before: T[],
  after: T[],
  keyOf: (item: T) => string,
  fingerprint: (item: T) => string,
): { added: string[]; updated: string[]; removed: string[] } {
  const beforeMap = new Map(before.map((i) => [keyOf(i), i]))
  const afterMap = new Map(after.map((i) => [keyOf(i), i]))
  const added: string[] = []
  const updated: string[] = []
  const removed: string[] = []

  afterMap.forEach((item, key) => {
    const prev = beforeMap.get(key)
    if (!prev) {
      added.push(key)
      return
    }
    if (fingerprint(prev) !== fingerprint(item)) updated.push(key)
  })
  beforeMap.forEach((_item, key) => {
    if (!afterMap.has(key)) removed.push(key)
  })

  return { added, updated, removed }
}
