import { applyAction } from '@/engine/core/applyAction'
import { cloneState, createInitialState, pushCheckpoint } from '@/engine/core/state'
import { performWrite } from '@/engine/operations/writes'
import { runQuery } from '@/engine/queries'
import { HuaweiMRS350R26Profile } from '@/engine/versions/HuaweiMRS350R26Profile'
import { bucketOf } from '@/engine/indexes/bucket'
import { buildTeachingTrace, type TeachingTrace } from './teachingTrace'
export { fileRecords } from './records'
import { buildB02Table } from '@/experiments/basics/B02CowVsMor'
import type { InputRecord, SimulationAction } from '@/models/actions'
import type { HudiPhysicalFile, HudiRecord, HudiTableState } from '@/models/hudi'
import type { SimulationEvent } from '@/models/simulation'
import type { QueryRequest, QueryResult } from '@/engine/queries/types'
import type { LessonOperation, LessonParameters, LessonStep, VisualLesson } from '@/experiments/visual/types'

export interface LessonFrame {
  step: LessonStep; before: HudiTableState; after: HudiTableState; events: SimulationEvent[]
  query?: QueryResult; added: HudiPhysicalFile[]; removed: HudiPhysicalFile[]; retired: HudiPhysicalFile[]
  logs: string[]; error?: string; input?: InputRecord[]; request?: QueryRequest; teaching?: TeachingTrace
}
export interface LessonRun { initial: HudiTableState; frames: LessonFrame[]; parameters: LessonParameters }
export function defaultParameters(lesson: VisualLesson): LessonParameters {
  return { recordKey: '1001', amount: 200, bucketCount: 4, partition: '2024-01-01', retention: 1, failureAt: lesson.steps.some(s=>s.effect==='error') ? 2 : -1,
    tableType: ['mor', 'updates', 'pending'].includes(lesson.seed) ? 'MERGE_ON_READ' : 'COPY_ON_WRITE' }
}
function record(key: string, amount: number, partition: string, ts = 20240101140000): InputRecord {
  return { recordKey: key, fields: { id: /^\d+$/.test(key) ? Number(key) : key, name: `订单 ${key}`, amount, ts, dt: partition } }
}
function checked(state: HudiTableState, action: SimulationAction): HudiTableState {
  const r = applyAction(state, action)
  if (!r.success) throw new Error(`场景初始化失败：${r.error}`)
  return r.nextState as HudiTableState
}
// Uses the existing engine's public write path for BULK_INSERT, which is absent from SimulationAction.
function directWrite(state: HudiTableState, records: InputRecord[], invalid = false) {
  try {
    const working = cloneState(state)
    if (invalid) working.table.primaryKey = null
    const result = performWrite(working, records, invalid ? 'UPSERT' : 'BULK_INSERT', HuaweiMRS350R26Profile)
    pushCheckpoint(result.state, result.instantTime)
    const event: SimulationEvent = { eventId: `visual-write-${result.instantTime}`, action: 'INSERT_RECORDS', title: invalid ? '配置校验' : 'Bulk Insert', instantTime: result.instantTime, deltas: [], logs: result.logs, explanation: result.explanation, evidenceIds: ['EV-COMM-BULK-INSERT'], warnings: result.warnings, success: true }
    return { state: result.state, events: [event], logs: result.logs, input: records }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    const event: SimulationEvent = { eventId: 'visual-write-rejected', action: 'INSERT_RECORDS', title: '引擎拒绝写入', instantTime: null, deltas: [], logs: [error], explanation: error, evidenceIds: ['EV-COMM-CREATE-TABLE'], warnings: [error], success: false, error }
    return { state, events: [event], logs: [error], error, input: records }
  }
}
export function seedLesson(lesson: VisualLesson, p: LessonParameters): HudiTableState {
  const table = buildB02Table({ tableType: p.tableType, indexType: lesson.seed === 'bucket' ? 'BUCKET' : 'SIMPLE', bucketCount: p.bucketCount, partitionValue: p.partition })
  let state = createInitialState(table)
  if (lesson.seed === 'empty') return state
  const seeds = [record('1001', 100.5, p.partition, 20240101100000), record('1002', 200, p.partition, 20240101100010), record('1003', 300.25, p.partition, 20240101100020)]
  if (p.tableType === 'MERGE_ON_READ') {
    const bulk = directWrite(state, seeds)
    if (bulk.error) throw new Error(bulk.error)
    state = bulk.state
  } else if (lesson.seed === 'bucket' || ['I01','I02'].includes(lesson.id)) {
    for (const seed of seeds) state = checked(state, { type: 'UPSERT_RECORDS', records: [seed] })
  } else state = checked(state, { type: 'UPSERT_RECORDS', records: seeds })
  if (lesson.seed === 'multi') state = checked(state, { type: 'INSERT_RECORDS', records: [record('2001', 80, '2020-01-01'), record('2002', 90, '2020-01-01')] })
  if (lesson.seed === 'small') {
    for (let i = 4; i <= 8; i++) state = checked(state, { type: 'INSERT_RECORDS', records: [record(String(1000 + i), i * 35, p.partition, 20240101140000 + i)] })
  }
  if (lesson.seed === 'updates' || lesson.seed === 'pending') state = checked(state, { type: 'UPSERT_RECORDS', records: [record(p.recordKey, p.amount, p.partition)] })
  if (lesson.seed === 'pending') {
    state = checked(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 })
    state = checked(state, { type: 'RUN_COMPACTION', failWith: 'SPARK_TASK_FAILED' })
  }
  return state
}
function execute(state: HudiTableState, operation: LessonOperation, p: LessonParameters, index: number, initial: HudiTableState) {
  const ts = 20240101150000 + index * 100
  const input = record(p.recordKey, p.amount, p.partition, ts)
  if (operation === 'bulk' || operation === 'invalid-bulk') return directWrite(state, [input, record('1008', 500, p.partition, ts)])
  if (operation === 'invalid-schema') return directWrite(state, [input], true)
  const requests: Partial<Record<LessonOperation, QueryRequest>> = {
    snapshot: { mode: 'snapshot' }, optimized: { mode: 'read-optimized' }, metadata: { mode: 'snapshot', includeMetaFields: true },
    incremental: { mode: 'incremental', beginInstantTime: initial.timeline[0]?.instantTime ? String(Number(initial.timeline[0].instantTime) + 1) : '', includeMetaFields: true },
    history: { mode: 'time-travel', asOfInstant: initial.checkpoints[0]?.instantTime }, 'partition-read': { mode: 'snapshot' },
  }
  const request = requests[operation]
  if (request) {
    const selected = operation === 'partition-read' ? { ...state, fileGroups: state.fileGroups.filter(g => g.partitionPath === p.partition) } : state
    const query = runQuery(selected, request)
    return { state, events: [] as SimulationEvent[], logs: query.notes, query, request }
  }
  let key = 1004
  while (state.records.some(r => r.recordKey === String(key))) key++
  const actions: Partial<Record<LessonOperation, SimulationAction>> = {
    insert: { type: 'INSERT_RECORDS', records: [record(String(key), p.amount, p.partition, ts)] },
    upsert: { type: 'UPSERT_RECORDS', records: [input] }, 'bucket-write': { type: 'UPSERT_RECORDS', records: [input] },
    delete: { type: 'DELETE_RECORDS', recordKeys: [p.recordKey] },
    duplicates: { type: 'UPSERT_RECORDS', records: [record(p.recordKey, p.amount - 50, p.partition, ts - 1), input] },
    stale: { type: 'UPSERT_RECORDS', records: [record(p.recordKey, 1, p.partition, 20230101100000)] },
    'overwrite-partition': { type: 'OVERWRITE_PARTITION', partitionPath: p.partition, records: [input] },
    'overwrite-table': { type: 'OVERWRITE_TABLE', records: [input] },
    schedule: { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }, compact: { type: 'RUN_COMPACTION' },
    fail: { type: 'RUN_COMPACTION', failWith: 'SPARK_OK_BUT_TX_INCOMPLETE' }, rollback: { type: 'RUN_ROLLBACK' },
    clean: { type: 'RUN_CLEAN', commitsRetained: p.retention }, archive: { type: 'RUN_ARCHIVE', maxCommitsToKeep: p.retention },
    cluster: { type: 'RUN_CLUSTERING', targetFileSizeMb: 1 }, ttl: { type: 'APPLY_TTL', spec: '.*', level: 'PARTITION', value: 7, units: 'DAYS' },
    create: { type: 'CREATE_TABLE', table: state.table },
    'empty-partition': { type: 'UPSERT_RECORDS', records: [record(p.recordKey, p.amount, '', ts)] },
    'cross-partition': { type: 'UPSERT_RECORDS', records: [record(p.recordKey, p.amount, p.partition === '2024-02-01' ? '2024-03-01' : '2024-02-01', ts)] },
  }
  const action = actions[operation]
  if (!action) throw new Error(`未实现的动画操作：${operation}`)
  const result = applyAction(state, action)
  return { state: result.nextState as HudiTableState, events: result.events, logs: result.logs, error: result.error, input: 'records' in action ? action.records : undefined }
}
export function buildLessonRun(lesson: VisualLesson, p: LessonParameters): LessonRun {
  const initial = seedLesson(lesson, p)
  let state = initial
  const frames = lesson.steps.map((step, index): LessonFrame => {
    const before = state
    const result = step.operation ? execute(state, step.operation, p, index, initial) : { state, events: [], logs: [] }
    state = result.state
    const priorNames = new Set(before.physicalFiles.map(f => f.fileName))
    const afterNames = new Set(state.physicalFiles.map(f => f.fileName))
    const frame: LessonFrame = { step, before, after: state, events: result.events, logs: result.logs, query: 'query' in result ? result.query : undefined, error: 'error' in result ? result.error : undefined,
      added: state.physicalFiles.filter(f => !priorNames.has(f.fileName)), removed: before.physicalFiles.filter(f => !afterNames.has(f.fileName)),
      retired: state.physicalFiles.filter(f => f.status === 'SUPERSEDED' && before.physicalFiles.find(b => b.fileName === f.fileName)?.status === 'ACTIVE'),
      input: 'input' in result ? result.input : undefined, request: 'request' in result ? result.request : undefined }
    frame.teaching = buildTeachingTrace({before,after:state,operation:step.operation,input:frame.input,request:frame.request,query:frame.query,parameters:p,error:frame.error})
    return frame
  })
  return { initial, frames, parameters: { ...p } }
}
export function bucketRecords(state: HudiTableState, bucket: number, count: number, partition?: string): HudiRecord[] {
  return state.records.filter(r => bucketOf(r.recordKey, count) === bucket && r.operation !== 'D' && (partition === undefined || r.partitionPath === partition))
}
export function stateMetrics(state: HudiTableState) {
  return { files: state.physicalFiles.length, active: state.physicalFiles.filter(f => f.status === 'ACTIVE').length, logs: state.physicalFiles.filter(f => f.type === 'LOG' && f.status === 'ACTIVE').length,
    old: state.physicalFiles.filter(f => f.status === 'SUPERSEDED').length, bytes: state.physicalFiles.reduce((n, f) => n + f.sizeBytes, 0), records: runQuery(state, { mode: 'snapshot' }).rowCount,
    pending: state.timeline.filter(i => i.state !== 'COMPLETED').length, timeline: state.timeline.length, archived: state.archivedInstants.length }
}
