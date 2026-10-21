import { describe, expect, it } from 'vitest'

import { buildMorTable, buildTable, runUpsert, seededState, stateOf, TEST_PARTITION } from '@/testing/factories'
import { applyAction } from '@/engine/core/applyAction'
import { runQuery } from '@/engine/queries'
import { META_FIELDS, QUERY_MODE_LABEL } from '@/engine/queries/types'
import type { HudiTable, HudiTableState } from '@/models/hudi'

/**
 * 查询引擎：快照读 / 读优化 / 增量读 / 时间旅行。
 *
 * 教学重点（本项目的核心教学点之一）：
 *   读路径**一律从物理布局推导**（File Group → File Slice → base/log），
 *   而不是直接读逻辑记录视图。
 *   因此「读优化模式下看不到 log file 里的更新」会自然浮现出来。
 */

/** MOR 表：首写落点为 base file（这样才有「base 里的旧版本 vs log 里的新版本」的对照） */
function morWithBaseFile(): HudiTable {
  return buildMorTable({ properties: { 'lab.mor.initial.landing': 'BASE_FILE' } })
}

/** 取某列的值 */
function columnOf(rows: Record<string, unknown>[], column: string): unknown[] {
  return rows.map((r) => r[column])
}

describe('snapshot 读', () => {
  it('合并 base file 与全部 log file，能看到 log 里的更新', () => {
    const s1 = seededState(morWithBaseFile())
    const s2 = stateOf(
      runUpsert(s1, [
        { recordKey: '1001', fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )

    const result = runQuery(s2, { mode: 'snapshot' })
    expect(result.mode).toBe('snapshot')
    expect(result.rowCount).toBe(3)
    const names = columnOf(result.rows, 'name')
    expect(names).toContain('订单A-已更新')
    expect(names).not.toContain('订单A')
  })

  it('MOR 首写为 log-only 时，snapshot 依然能读到全部记录', () => {
    const state = seededState(buildMorTable())
    const result = runQuery(state, { mode: 'snapshot' })
    expect(result.rowCount).toBe(3)
  })

  it('COW 表两种读法结果一致（更新直接写进了 base file）', () => {
    const s1 = seededState(buildTable())
    const s2 = stateOf(
      runUpsert(s1, [
        { recordKey: '1001', fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )

    const snapshot = runQuery(s2, { mode: 'snapshot' })
    const readOptimized = runQuery(s2, { mode: 'read-optimized' })
    expect(snapshot.rowCount).toBe(readOptimized.rowCount)
    expect(columnOf(snapshot.rows, 'name')).toEqual(columnOf(readOptimized.rows, 'name'))
  })
})

describe('read-optimized 读', () => {
  it('看不到 log file 里的更新（教学重点）', () => {
    const s1 = seededState(morWithBaseFile())
    const s2 = stateOf(
      runUpsert(s1, [
        { recordKey: '1001', fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )

    // 读优化只读 base file
    const result = runQuery(s2, { mode: 'read-optimized' })
    expect(result.rowCount).toBe(3)
    const names = columnOf(result.rows, 'name')
    // 仍然是 base file 里的旧版本
    expect(names).toContain('订单A')
    expect(names).not.toContain('订单A-已更新')

    // 快照读能看到新版本 —— 两者结果不同，正是 MOR 必须及时 compaction 的原因
    const snapshot = runQuery(s2, { mode: 'snapshot' })
    expect(columnOf(snapshot.rows, 'name')).toContain('订单A-已更新')
    expect(result.notes.join('\n')).toContain('log file')
  })

  it('MOR 首写为 log-only 时，读优化读不到任何记录', () => {
    const state = seededState(buildMorTable())
    const result = runQuery(state, { mode: 'read-optimized' })
    expect(result.rowCount).toBe(0)
    expect(result.notes.join('\n')).toContain('log file')
  })

  it('compaction 之后读优化与快照读结果一致', () => {
    const s1 = seededState(buildMorTable())
    const s2 = stateOf(
      runUpsert(s1, [
        { recordKey: '1001', fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )
    // 通过引擎的标准通道做一次 compaction
    const after = compact(s2)

    const snapshot = runQuery(after, { mode: 'snapshot' })
    const readOptimized = runQuery(after, { mode: 'read-optimized' })
    expect(snapshot.rowCount).toBe(readOptimized.rowCount)
    expect(columnOf(snapshot.rows, 'name')).toEqual(columnOf(readOptimized.rows, 'name'))
  })
})

describe('incremental 读', () => {
  it('按 instant 区间过滤', () => {
    const s1 = seededState(buildMorTable())
    const t1 = s1.timeline[0].instantTime
    const s2 = stateOf(
      runUpsert(s1, [
        { recordKey: '1001', fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )
    const t2 = s2.timeline[s2.timeline.length - 1].instantTime

    // 只看第二次提交 → 只有 1001 的新版本
    const onlySecond = runQuery(s2, { mode: 'incremental', beginInstantTime: t2, endInstantTime: t2 })
    expect(onlySecond.rowCount).toBe(1)
    expect(columnOf(onlySecond.rows, 'name')).toEqual(['订单A-已更新'])

    // 只看第一次提交 → 3 条种子记录
    const onlyFirst = runQuery(s2, { mode: 'incremental', beginInstantTime: t1, endInstantTime: t1 })
    expect(onlyFirst.rowCount).toBe(3)

    // 整个区间 → 合并后仍是 3 个主键
    const all = runQuery(s2, { mode: 'incremental', beginInstantTime: t1, endInstantTime: t2 })
    expect(all.rowCount).toBe(3)
  })

  it('增量读一定带上 _hoodie_operation（消费端要靠它识别删除）', () => {
    const s1 = seededState(buildMorTable())
    const t1 = s1.timeline[0].instantTime
    const result = runQuery(s1, { mode: 'incremental', beginInstantTime: t1, endInstantTime: t1 })
    expect(result.columns).toContain(META_FIELDS.operation)
    expect(columnOf(result.rows, META_FIELDS.operation)).toEqual(['I', 'I', 'I'])
  })

  it('删除记录以 operation=D 的形式出现在增量结果里', () => {
    const s1 = seededState(buildMorTable())
    const deleted = stateOf(applyAction(s1, { type: 'DELETE_RECORDS', recordKeys: ['1002'] }))
    const t = deleted.timeline[deleted.timeline.length - 1].instantTime

    const result = runQuery(deleted, { mode: 'incremental', beginInstantTime: t, endInstantTime: t })
    expect(result.rowCount).toBe(1)
    expect(columnOf(result.rows, META_FIELDS.operation)).toEqual(['D'])
  })
})

describe('time-travel 读', () => {
  it('读历史 instant 时刻的快照', () => {
    const s1 = seededState(buildMorTable())
    const t1 = s1.timeline[0].instantTime
    const s2 = stateOf(
      runUpsert(s1, [
        { recordKey: '1001', fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )

    const past = runQuery(s2, { mode: 'time-travel', asOfInstant: t1 })
    expect(past.rowCount).toBe(3)
    expect(columnOf(past.rows, 'name')).toContain('订单A')
    expect(columnOf(past.rows, 'name')).not.toContain('订单A-已更新')
  })

  it('未指定 asOfInstant 时给出明确提示而不是静默返回空', () => {
    const state = seededState()
    const result = runQuery(state, { mode: 'time-travel' })
    expect(result.rowCount).toBe(0)
    expect(result.notes.join('\n')).toContain('asOfInstant')
  })
})

describe('查询结果的通用约定', () => {
  it('limit 会截断结果并给出提示', () => {
    const state = seededState()
    const result = runQuery(state, { mode: 'snapshot', limit: 2 })
    expect(result.rowCount).toBe(2)
    expect(result.notes.join('\n')).toContain('limit')
  })

  it('includeMetaFields 会带上 _hoodie_* 元字段', () => {
    const state = seededState()
    const result = runQuery(state, { mode: 'snapshot', includeMetaFields: true })
    expect(result.columns).toContain(META_FIELDS.recordKey)
    expect(result.columns).toContain(META_FIELDS.commitTime)
  })

  it('业务字段在前、元字段在后', () => {
    const state = seededState()
    const result = runQuery(state, { mode: 'snapshot', includeMetaFields: true })
    const firstMeta = result.columns.findIndex((c) => c.startsWith('_hoodie_'))
    const lastBusiness = result.columns.map((c) => c.startsWith('_hoodie_')).lastIndexOf(false)
    expect(firstMeta).toBeGreaterThan(lastBusiness)
  })

  it('未实现的查询模式返回空结果并说明原因', () => {
    const state = seededState()
    const result = runQuery(state, { mode: 'unknown-mode' as never })
    expect(result.rowCount).toBe(0)
    expect(result.notes.join('\n')).toContain('未实现')
  })

  it('查询模式的中文标签齐全', () => {
    expect(QUERY_MODE_LABEL.snapshot).toContain('快照')
    expect(QUERY_MODE_LABEL['read-optimized']).toContain('读优化')
    expect(QUERY_MODE_LABEL.incremental).toContain('增量')
    expect(QUERY_MODE_LABEL['time-travel']).toContain('时间旅行')
  })
})

/* -------------------------------------------------------------------------- */
/* 内部工具                                                                    */
/* -------------------------------------------------------------------------- */

/** 生成 compaction plan 并执行它（全部走引擎的标准动作通道） */
function compact(state: HudiTableState): HudiTableState {
  const scheduled = applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 })
  const executed = applyAction(scheduled.nextState as HudiTableState, { type: 'RUN_COMPACTION' })
  return executed.nextState as HudiTableState
}
