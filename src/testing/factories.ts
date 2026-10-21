/**
 * 测试数据工厂。
 * ---------------------------------------------------------------------------
 * 目的：让所有单元测试共用**同一份**表定义与种子数据，
 *       避免每个 spec 各写一份「长得差不多但字段不一样」的表，
 *       导致测试之间的期望值对不上、也看不出回归到底来自哪里。
 *
 * 铁律（与 CONTRACT.md 一致）：
 *   - 工厂只负责**造数据**，不实现任何 Hudi 业务规则；
 *   - 任何「写入」都必须走引擎的 applyAction 通道，
 *     这样 File Group / File Slice / Timeline instant 才是真的，
 *     而不是测试自己拼出来的假状态。
 *
 * 确定性：所有时间戳、文件 id、instant time 都由引擎的固定 epoch 推导，
 *         同一输入必然得到同一输出（测试里不出现随机数）。
 */

import type { InputRecord } from '@/models/actions'
import type { HudiTable, HudiTableState } from '@/models/hudi'
import type { ActionResult } from '@/models/simulation'
import { applyAction } from '@/engine/core/applyAction'
import { createInitialState } from '@/engine/core/state'

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

export const TEST_DATABASE = 'hudi_demo'
export const TEST_TABLE = 'orders'
export const TEST_TABLE_PATH = '/user/hive/warehouse/hudi_demo.db/orders'
export const TEST_VERSION = '0.15.0-h0.cbu.mrs.350.r26'
/** 默认分区值（对应分区字段 dt） */
export const TEST_PARTITION = '2024-01-01'

/* -------------------------------------------------------------------------- */
/* 表定义                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 默认表：`hudi_demo.orders`
 *
 * 字段：id / name / amount / ts / dt
 *   - id   → 主键（Record Key）
 *   - ts   → precombine 字段
 *   - dt   → 分区字段
 */
export function buildTable(overrides: Partial<HudiTable> = {}): HudiTable {
  const base: HudiTable = {
    tableName: TEST_TABLE,
    databaseName: TEST_DATABASE,
    tableType: 'COPY_ON_WRITE',
    fields: [
      { name: 'id', type: 'INT', comment: '主键 / Record Key' },
      { name: 'name', type: 'STRING' },
      { name: 'amount', type: 'DOUBLE' },
      { name: 'ts', type: 'BIGINT', comment: 'precombine 字段' },
      { name: 'dt', type: 'STRING', comment: '分区字段' },
    ],
    primaryKey: 'id',
    preCombineField: 'ts',
    partitionFields: ['dt'],
    partitionType: 'PARTITIONED',
    indexType: 'SIMPLE',
    bucketCount: null,
    isGlobalIndexed: false,
    payloadClass: 'org.apache.hudi.common.model.HoodiePayload.class',
    tablePath: TEST_TABLE_PATH,
    hiveStylePartitioning: 'HIVE_STYLE_PARTITIONING',
    properties: {},
    version: TEST_VERSION,
  }
  return { ...base, ...overrides }
}

/** MOR 版默认表（其余字段与 buildTable 完全一致） */
export function buildMorTable(overrides: Partial<HudiTable> = {}): HudiTable {
  return buildTable({ ...overrides, tableType: 'MERGE_ON_READ' })
}

/* -------------------------------------------------------------------------- */
/* 种子记录                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 3 条种子记录：让「新增 / 更新 / 删除 / precombine」四个场景一上来就有靶子。
 * 三条记录同属一个分区（dt = 2024-01-01）。
 */
export function seedRecords(partitionPath: string = TEST_PARTITION): InputRecord[] {
  return [
    { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 100.5, ts: 20240101100000, dt: partitionPath } },
    { recordKey: '1002', fields: { id: 1002, name: '订单B', amount: 200, ts: 20240101100010, dt: partitionPath } },
    { recordKey: '1003', fields: { id: 1003, name: '订单C', amount: 300.25, ts: 20240101100020, dt: partitionPath } },
  ]
}

/* -------------------------------------------------------------------------- */
/* 状态                                                                        */
/* -------------------------------------------------------------------------- */

/** 空状态（只有表定义，没有任何 File Group / instant） */
export function initialStateFor(table: HudiTable = buildTable()): HudiTableState {
  return createInitialState(table)
}

/** 从 ActionResult 里取出新的状态（引擎约定 nextState 的运行时类型是 HudiTableState） */
export function stateOf(result: ActionResult): HudiTableState {
  return result.nextState as HudiTableState
}

/* -------------------------------------------------------------------------- */
/* 动作封装                                                                    */
/* -------------------------------------------------------------------------- */

/** UPSERT_RECORDS 的薄封装 */
export function runUpsert(state: HudiTableState, records: InputRecord[]): ActionResult {
  return applyAction(state, { type: 'UPSERT_RECORDS', records })
}

/** INSERT_RECORDS 的薄封装 */
export function runInsert(state: HudiTableState, records: InputRecord[]): ActionResult {
  return applyAction(state, { type: 'INSERT_RECORDS', records })
}

/** DELETE_RECORDS 的薄封装 */
export function runDelete(state: HudiTableState, recordKeys: string[]): ActionResult {
  return applyAction(state, { type: 'DELETE_RECORDS', recordKeys })
}

/* -------------------------------------------------------------------------- */
/* 常用预置状态                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 已经写入 3 条种子记录的状态。
 *
 * 注意：种子数据**必须走引擎写入通道**（applyAction → performWrite），
 * 否则初始状态里就没有 File Group / Timeline instant，COW 与 MOR 的对照就没有基准。
 */
export function seededState(table: HudiTable = buildTable()): HudiTableState {
  const result = runUpsert(initialStateFor(table), seedRecords())
  if (!result.success) {
    throw new Error(`种子数据写入失败：${result.error ?? '未知原因'}`)
  }
  return stateOf(result)
}

/** MOR 版的已写种子状态（首写为 log-only File Group） */
export function seededMorState(table: HudiTable = buildMorTable()): HudiTableState {
  return seededState(table)
}
