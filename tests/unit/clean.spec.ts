import { describe, expect, it } from 'vitest'

import { runUpsert, seededState, stateOf, TEST_PARTITION } from '@/testing/factories'
import { runClean } from '@/engine/operations/services'
import type { HudiTableState } from '@/models/hudi'

/**
 * Clean 的保留窗口。
 *
 * 教学重点：
 *   「被取代（SUPERSEDED）」是逻辑变化，「被删除」是物理变化 —— 两者发生在不同的 instant 上。
 *   只有当文件既被新版本取代、又超出 hoodie.cleaner.commits.retained 指定的保留窗口时才可删除。
 */

/**
 * 造一个「被取代的文件落在窗口内外」的状态：
 *   T1 写入      → base1（ACTIVE）
 *   T2 更新      → base1 变 SUPERSEDED（supersededAt = T2），产出 base2
 *   T3 插入新主键 → 产出 base3（不取代任何文件）
 *
 * ⚠️ T3 用的是「新主键插入」而不是「再次更新同一个主键」：
 *    连续两次更新同一个主键会命中引擎的一个已知缺陷（见文件末尾的 it.fails 用例），
 *    那个缺陷与 Clean 的保留窗口无关，这里刻意绕开以免两条线索混在一起。
 */
function stateWithSupersededFile(): HudiTableState {
  const s1 = seededState()
  const s2 = stateOf(
    runUpsert(s1, [
      { recordKey: '1001', fields: { id: 1001, name: '订单A-版本2', amount: 2, ts: 20240101140000, dt: TEST_PARTITION } },
    ]),
  )
  const s3 = stateOf(
    runUpsert(s2, [
      { recordKey: '1004', fields: { id: 1004, name: '新增订单D', amount: 4, ts: 20240101150000, dt: TEST_PARTITION } },
    ]),
  )
  return s3
}

describe('runClean', () => {
  it('保留窗口内的 superseded 文件不删', () => {
    const state = stateWithSupersededFile()
    const supersededBefore = state.physicalFiles.filter((f) => f.status === 'SUPERSEDED')
    expect(supersededBefore).toHaveLength(1)

    // 保留最近 3 次提交 → 被取代的文件仍落在窗口内
    const outcome = runClean(state, 3)

    expect(outcome.filesDeleted).toHaveLength(0)
    expect(outcome.state.physicalFiles.filter((f) => f.status === 'SUPERSEDED')).toHaveLength(1)
    // 空跑时不会往 Timeline 写 CLEAN instant
    expect(outcome.state.timeline.some((i) => i.action === 'CLEAN')).toBe(false)
  })

  it('窗口外的 superseded 文件被真正删除', () => {
    const state = stateWithSupersededFile()
    const supersededName = state.physicalFiles.find((f) => f.status === 'SUPERSEDED')!.fileName
    const activeBefore = state.physicalFiles.filter((f) => f.status === 'ACTIVE').map((f) => f.fileName)

    // 只保留最近 1 次提交（T3）→ supersededAt = T2 的文件落到窗口外
    const outcome = runClean(state, 1)

    expect(outcome.filesDeleted).toHaveLength(1)
    expect(outcome.filesDeleted[0]).toBe(supersededName)
    // 被删的文件确实从物理文件清单里消失了
    expect(outcome.state.physicalFiles.some((f) => f.fileName === supersededName)).toBe(false)
    // 其它文件原封不动
    expect(outcome.state.physicalFiles.filter((f) => f.status === 'ACTIVE').map((f) => f.fileName)).toEqual(
      activeBefore,
    )

    // Timeline 上出现一个 COMPLETED 的 CLEAN instant
    const clean = outcome.state.timeline.find((i) => i.action === 'CLEAN')
    expect(clean).toBeDefined()
    expect(clean?.state).toBe('COMPLETED')
  })

  it('没有可清理文件时是空跑（不产生 CLEAN instant，也不改文件清单）', () => {
    const state = seededState()
    const before = JSON.stringify(state.physicalFiles)
    const outcome = runClean(state, 1)

    expect(outcome.filesDeleted).toHaveLength(0)
    expect(JSON.stringify(outcome.state.physicalFiles)).toBe(before)
    expect(outcome.state.timeline.some((i) => i.action === 'CLEAN')).toBe(false)
  })

  it('Clean 只删文件，不动 Timeline 上已完成的 instant', () => {
    const state = stateWithSupersededFile()
    const instantsBefore = state.timeline.map((i) => `${i.instantTime}:${i.action}:${i.state}`)
    const outcome = runClean(state, 1)
    const instantsAfter = outcome.state.timeline
      .filter((i) => i.action !== 'CLEAN')
      .map((i) => `${i.instantTime}:${i.action}:${i.state}`)
    expect(instantsAfter).toEqual(instantsBefore)
  })

  it('commitsRetained 小于 1 时按 1 处理（不会把窗口清空）', () => {
    const state = stateWithSupersededFile()
    const outcome = runClean(state, 0)
    // 窗口 = 最近 1 次提交 → 被取代的文件落到窗口外 → 被删
    expect(outcome.filesDeleted).toHaveLength(1)
  })
})

/**
 * 【已知缺陷】连续两次 COW 更新同一个主键时，第二次更新没有取代当前的 base file。
 *
 * 现象（引擎当前行为）：
 *   T1 写入 → T2 更新（正常：旧 group 被 superseded，新 group 含 4 条记录）
 *   T3 再更新 → 新 group 只含 1 条记录，而 T2 的 group **既没有被 superseded，
 *   它对应的物理文件也仍然是 ACTIVE** —— 同一张表出现两个「有效」File Group。
 *
 * 根因（src/engine/core/state.ts 的 findFileGroupForKey）：
 *   查找 File Group 时没有排除已被 superseded 的 group，
 *   于是 COW 更新路径命中的是早已被取代的旧 group；
 *   随后的 `state.fileGroups.find(g => g.fileId === gid && !g.supersededBy)` 取不到 owner，
 *   合并时便只带上了本次新增的那一条记录。
 *
 * 与 B02 边界场景 EC-02 描述的期望（「旧 base 文件被标记为 SUPERSEDED」）不一致。
 * 缺陷不在本子任务的改动范围内（src/engine/** 属于只读文件），因此这里用 it.fails 钉住期望行为。
 */
describe('COW 连续更新（缺陷已修复）', () => {
  it('第二次更新应把当前 base file 标记为 SUPERSEDED', () => {
    const s1 = seededState()
    const s2 = stateOf(
      runUpsert(s1, [
        { recordKey: '1001', fields: { id: 1001, name: 'v2', amount: 2, ts: 20240101140000, dt: TEST_PARTITION } },
      ]),
    )
    const s3 = stateOf(
      runUpsert(s2, [
        { recordKey: '1001', fields: { id: 1001, name: 'v3', amount: 3, ts: 20240101150000, dt: TEST_PARTITION } },
      ]),
    )

    const active = s3.fileGroups.filter((g) => !g.supersededBy)
    // 期望：始终只有一个有效 File Group
    expect(active).toHaveLength(1)
    // 期望：有效 File Group 的 base file 里包含全部 3 个主键
    expect(active[0].fileSlice.baseFile?.recordCount).toBe(3)
  })
})
