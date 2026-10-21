import { describe, expect, it } from 'vitest'

import { buildMorTable, buildTable, runUpsert, seededState, stateOf, TEST_PARTITION } from '@/testing/factories'
import { applyAction } from '@/engine/core/applyAction'
import { SimulationError } from '@/engine/core/errors'
import { runRollback } from '@/engine/operations/services'
import type { HudiTableState } from '@/models/hudi'

/**
 * Timeline 的 instant 状态迁移。
 *
 * 教学重点（也是本项目最想强调的一条）：
 *   判断 compaction 到底成没成功，**只能看 Timeline 上有没有 state=COMPLETED 的 compaction instant**，
 *   不能看 YARN 状态、也不能看 Spark 日志。
 *   「YARN SUCCEEDED 但 Hudi 事务没提交」是真实存在的场景。
 */

/** 造一个已经写入数据、可以生成 compaction plan 的 MOR 状态 */
function morStateWithLogs(): HudiTableState {
  return seededState(buildMorTable())
}

describe('compaction 成功', () => {
  it('Timeline 新增一个 COMPLETED 的 COMPACTION instant', () => {
    const state = morStateWithLogs()
    const scheduled = applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 })
    expect(scheduled.success).toBe(true)
    const planned = stateOf(scheduled)

    // 生成计划时是 REQUESTED，且属于 pending
    const requested = planned.timeline.find((i) => i.action === 'COMPACTION')
    expect(requested?.state).toBe('REQUESTED')
    expect(planned.pendingInstants).toHaveLength(1)

    const executed = applyAction(planned, { type: 'RUN_COMPACTION' })
    expect(executed.success).toBe(true)
    const after = stateOf(executed)

    const completed = after.timeline.find((i) => i.action === 'COMPACTION' && i.state === 'COMPLETED')
    expect(completed).toBeDefined()
    // pending 被清空
    expect(after.pendingInstants).toHaveLength(0)
    // 计划被标记为已执行
    expect(after.compactionPlans[0].state).toBe('EXECUTED')
  })
})

describe('compaction 故障注入', () => {
  it('SPARK_OK_BUT_TX_INCOMPLETE：不产生任何数据文件变化，Timeline 上留下 INFLIGHT 的 COMPACTION instant', () => {
    const state = morStateWithLogs()
    const planned = stateOf(applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))

    // 故障注入前后的数据文件快照
    const filesBefore = JSON.stringify(planned.physicalFiles)
    const groupsBefore = JSON.stringify(planned.fileGroups)

    const result = applyAction(planned, {
      type: 'RUN_COMPACTION',
      failWith: 'SPARK_OK_BUT_TX_INCOMPLETE',
    })
    expect(result.success).toBe(true)
    const after = stateOf(result)

    // 没有任何数据文件变化
    expect(JSON.stringify(after.physicalFiles)).toBe(filesBefore)
    expect(JSON.stringify(after.fileGroups)).toBe(groupsBefore)

    // Timeline 上有 INFLIGHT 的 COMPACTION instant，且没有 COMPLETED 的
    const inflight = after.timeline.filter((i) => i.action === 'COMPACTION' && i.state === 'INFLIGHT')
    expect(inflight.length).toBeGreaterThan(0)
    expect(after.timeline.some((i) => i.action === 'COMPACTION' && i.state === 'COMPLETED')).toBe(false)

    // 计划被标记为失败
    expect(after.compactionPlans[0].state).toBe('FAILED')
  })

  it('其它故障场景同样不产生数据文件变化', () => {
    const scenarios = [
      'SPARK_TASK_FAILED',
      'YARN_KILLED',
      'SCHEDULER_TIMEOUT',
      'PLAN_NOT_FOUND',
    ] as const

    scenarios.forEach((failWith) => {
      const state = morStateWithLogs()
      const planned = stateOf(applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))
      const filesBefore = JSON.stringify(planned.physicalFiles)

      const result = applyAction(planned, { type: 'RUN_COMPACTION', failWith })
      const after = stateOf(result)

      expect(JSON.stringify(after.physicalFiles)).toBe(filesBefore)
      expect(after.timeline.some((i) => i.action === 'COMPACTION' && i.state === 'COMPLETED')).toBe(false)
    })
  })

  it('INJECT_FAILURE 场景会附带「以 Timeline 上的 completed instant 为准」的告警', () => {
    const state = morStateWithLogs()
    const planned = stateOf(applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))
    const filesBefore = JSON.stringify(planned.physicalFiles)

    const result = applyAction(planned, { type: 'INJECT_FAILURE', scenario: 'SPARK_OK_BUT_TX_INCOMPLETE' })
    expect(result.success).toBe(true)
    expect(result.warnings.some((w) => w.includes('completed 的 compaction instant'))).toBe(true)
    // 注入故障同样不产生任何数据文件变化
    expect(JSON.stringify(stateOf(result).physicalFiles)).toBe(filesBefore)
  })
})

describe('runRollback', () => {
  it('只对 pending instant 生效：回滚后写入一个 ROLLBACK instant', () => {
    const state = morStateWithLogs()
    const planned = stateOf(applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 }))
    const failed = stateOf(
      applyAction(planned, { type: 'RUN_COMPACTION', failWith: 'SPARK_OK_BUT_TX_INCOMPLETE' }),
    )

    const inflight = failed.timeline.filter((i) => i.action === 'COMPACTION' && i.state === 'INFLIGHT')
    expect(inflight.length).toBeGreaterThan(0)
    const target = inflight[inflight.length - 1]

    const outcome = runRollback(failed, target.instantTime)
    const after = outcome.state

    // 被回滚的 instant 从 Timeline 与 pending 中消失
    expect(after.timeline.some((i) => i.instantTime === target.instantTime)).toBe(false)
    expect(after.pendingInstants.some((i) => i.instantTime === target.instantTime)).toBe(false)
    // 写入了一个 COMPLETED 的 ROLLBACK instant
    const rollback = after.timeline.find((i) => i.action === 'ROLLBACK')
    expect(rollback).toBeDefined()
    expect(rollback?.state).toBe('COMPLETED')
  })

  it('对 COMPLETED 的 instant 抛 SimulationError，且不改变状态', () => {
    const state = seededState()
    const completed = state.timeline.find((i) => i.state === 'COMPLETED')
    expect(completed).toBeDefined()
    const before = JSON.stringify(state)

    expect(() => runRollback(state, completed!.instantTime)).toThrow(SimulationError)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('没有任何 pending instant 时抛 SimulationError', () => {
    const state = seededState()
    const before = JSON.stringify(state)
    expect(() => runRollback(state)).toThrow(SimulationError)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('通过 applyAction 触发回滚时，失败不会污染状态', () => {
    const state = seededState()
    const result = applyAction(state, { type: 'RUN_ROLLBACK' })
    expect(result.success).toBe(false)
    expect(result.nextState).toBe(state)
    expect(result.error).toBeTruthy()
  })
})

describe('Timeline 的基本不变量', () => {
  it('COW 表生成 compaction plan 会被拒绝（COW 没有 log file）', () => {
    const state = seededState(buildTable())
    const result = applyAction(state, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 })
    expect(result.success).toBe(false)
    expect(result.error).toContain('COW')
    expect(result.nextState).toBe(state)
  })

  it('instant time 单调递增且不重复', () => {
    const state = seededState(buildMorTable())
    const after = stateOf(
      runUpsert(state, [
        { recordKey: '1001', fields: { id: 1001, name: 'x', amount: 1, ts: 2, dt: TEST_PARTITION } },
      ]),
    )
    const times = after.timeline.map((i) => i.instantTime)
    expect(new Set(times).size).toBe(times.length)
    expect([...times].sort()).toEqual(times)
  })
})
