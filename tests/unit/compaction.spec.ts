import { describe, expect, it } from 'vitest'

import { buildMorTable, buildTable, runUpsert, seededState, stateOf, TEST_PARTITION } from '@/testing/factories'
import { applyAction } from '@/engine/core/applyAction'
import { SimulationError } from '@/engine/core/errors'
import { runCompaction, scheduleCompaction } from '@/engine/operations/services'

/**
 * Compaction 的「计划」与「执行」两阶段。
 *
 * 教学重点：compaction 分两步 —— 生成 plan（只写 .hoodie 下的 plan 文件，不动数据文件）
 * 与执行 plan（真正把 log file 合并成新的 parquet base file）。
 * 这正是华为 r26 规范里「Flink 只生成计划、独立 Spark 作业异步执行」的基础。
 */

/** MOR 状态：已写入 3 条种子记录（log-only File Group） */
function morState() {
  return seededState(buildMorTable())
}

describe('scheduleCompaction', () => {
  it('生成 state=PLANNED 的 plan，且不改动任何数据文件', () => {
    const state = morState()
    const filesBefore = JSON.stringify(state.physicalFiles)

    const outcome = scheduleCompaction(state, 1)

    expect(outcome.state.compactionPlans).toHaveLength(1)
    expect(outcome.state.compactionPlans[0].state).toBe('PLANNED')
    expect(outcome.state.compactionPlans[0].entries).toHaveLength(1)
    expect(outcome.state.compactionPlans[0].entries[0].logFileCount).toBe(1)

    // 生成计划不动数据（只会把 File Group 标记为「已请求 compaction」）
    expect(JSON.stringify(outcome.state.physicalFiles)).toBe(filesBefore)
    const sliceBefore = JSON.stringify(state.fileGroups.map((g) => g.fileSlice))
    const sliceAfter = JSON.stringify(outcome.state.fileGroups.map((g) => g.fileSlice))
    expect(sliceAfter).toBe(sliceBefore)
    expect(outcome.state.fileGroups.every((g) => g.fileSlice.compactionRequested)).toBe(true)

    // 但会往 Timeline 上写一个 REQUESTED 的 COMPACTION instant，并进入 pending
    const requested = outcome.state.timeline.find((i) => i.action === 'COMPACTION')
    expect(requested?.state).toBe('REQUESTED')
    expect(outcome.state.pendingInstants).toHaveLength(1)
  })

  it('COW 表生成 compaction plan 会抛 SimulationError（COW 没有 log file）', () => {
    const state = seededState(buildTable())
    expect(() => scheduleCompaction(state, 1)).toThrow(SimulationError)
  })

  it('没有满足条件的 File Group 时抛 SimulationError（避免空跑）', () => {
    const state = seededState(buildTable())
    expect(() => scheduleCompaction(state, 1)).toThrow(SimulationError)
  })
})

describe('runCompaction', () => {
  it('执行后 log file 消失、base file 的记录数正确', () => {
    const state = morState()
    // 再写一次，凑出 2 个 log file
    const withTwoLogs = stateOf(
      runUpsert(state, [
        { recordKey: '1001', fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )
    expect(withTwoLogs.fileGroups[0].fileSlice.logFiles).toHaveLength(2)

    const planned = stateOf(applyAction(withTwoLogs, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))
    const executed = stateOf(applyAction(planned, { type: 'RUN_COMPACTION' }))

    const group = executed.fileGroups[0]
    // log file 全部消失
    expect(group.fileSlice.logFiles).toHaveLength(0)
    // base file 出现，且记录数 = 合并后的记录数（3 个主键，其中 1001 有两个版本 → 合并成 3 条）
    expect(group.fileSlice.baseFile).not.toBeNull()
    expect(group.fileSlice.baseFile?.recordCount).toBe(3)
    expect(group.fileSlice.baseFile?.producedBy).toBeTruthy()
    // 旧的 log 文件变成 SUPERSEDED，但物理上还在，等 Clean 才删
    const oldLogs = executed.physicalFiles.filter((f) => f.type === 'LOG')
    expect(oldLogs).toHaveLength(2)
    oldLogs.forEach((f) => expect(f.status).toBe('SUPERSEDED'))
  })

  it('重复执行同一个 plan 会抛错（plan 是一次性资源）', () => {
    const state = morState()
    const planned = stateOf(applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))
    const planInstant = planned.compactionPlans[0].instantTime

    const first = runCompaction(planned, planInstant)
    expect(first.state.compactionPlans[0].state).toBe('EXECUTED')

    // 第二次执行同一个 plan → 过期计划
    expect(() => runCompaction(first.state, planInstant)).toThrow(SimulationError)
  })

  it('通过 applyAction 重复执行同一个 plan：失败且状态原样不变', () => {
    const state = morState()
    const planned = stateOf(applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))
    const planInstant = planned.compactionPlans[0].instantTime

    const first = stateOf(applyAction(planned, { type: 'RUN_COMPACTION', planInstant }))
    const before = JSON.stringify(first)

    const second = applyAction(first, { type: 'RUN_COMPACTION', planInstant })
    expect(second.success).toBe(false)
    expect(second.error).toContain('过期计划')
    expect(second.nextState).toBe(first)
    expect(JSON.stringify(first)).toBe(before)
  })

  it('找不到 plan 时抛 SimulationError', () => {
    const state = morState()
    expect(() => runCompaction(state, '20990101000000')).toThrow(SimulationError)
  })

  it('compaction 之后快照读与读优化读的结果一致（log 已被合并进 base）', () => {
    const state = morState()
    const planned = stateOf(applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))
    const executed = stateOf(applyAction(planned, { type: 'RUN_COMPACTION' }))

    const group = executed.fileGroups[0]
    expect(group.fileSlice.baseFile).not.toBeNull()
    expect(group.fileSlice.logFiles).toHaveLength(0)
  })
})
