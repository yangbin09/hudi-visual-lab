import { describe, expect, it } from 'vitest'

import {
  buildMorTable,
  buildTable,
  initialStateFor,
  runUpsert,
  seedRecords,
  seededState,
  stateOf,
  TEST_PARTITION,
} from '@/testing/factories'
import type { HudiTableState } from '@/models/hudi'

/**
 * 写入语义（Insert / Upsert）的逻辑结果。
 *
 * 覆盖需求 §13.1 的第一组要求：
 *   - COW upsert 已有主键 → 旧 File Group 被 superseded、新 File Group 出现、
 *     旧物理文件变 SUPERSEDED、Timeline 新增 COMMIT instant；
 *   - MOR upsert 已有主键 → 追加 log file、base file 不变、Timeline 新增 DELTA_COMMIT instant；
 *   - precombine 值更小的更新被忽略（并产生 warning）；
 *   - 同批次重复主键 → 按 precombine 取值大者胜。
 */

/** 找到记录（按主键） */
function recordOf(state: HudiTableState, recordKey: string) {
  return state.records.find((r) => r.recordKey === recordKey)
}

describe('COW upsert 已有主键', () => {
  it('旧 File Group 被 superseded、新 File Group 出现，且旧物理文件变 SUPERSEDED', () => {
    const before = seededState()
    const oldGroup = before.fileGroups[0]
    const oldBase = oldGroup.fileSlice.baseFile
    expect(oldBase).not.toBeNull()

    const result = runUpsert(before, [
      {
        recordKey: '1001',
        fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION },
      },
    ])
    expect(result.success).toBe(true)
    const after = stateOf(result)

    // 旧 File Group 被标记为 superseded
    const oldAfter = after.fileGroups.find((g) => g.fileId === oldGroup.fileId)
    expect(oldAfter).toBeDefined()
    expect(oldAfter?.supersededBy).toBeTruthy()

    // 新 File Group 出现，且带新的 base file
    const newGroup = after.fileGroups.find((g) => g.fileId === oldAfter?.supersededBy)
    expect(newGroup).toBeDefined()
    expect(newGroup?.fileSlice.baseFile).not.toBeNull()
    expect(newGroup?.fileSlice.baseFile?.fileName.endsWith('.parquet')).toBe(true)
    // COW 重写整个 File Group：旧 base 里的 3 条记录 + 本次更新的 1 条新版本
    // → 写盘时按主键去重，base file 内每个主键只保留生效版本（3 行）
    // （真实 Hudi 的 COW 重写同样会做这一步：parquet 里不允许同一主键出现两行）
    expect(newGroup?.fileSlice.baseFile?.recordCount).toBe(3)
    expect(newGroup?.fileSlice.baseFile?.records).toHaveLength(3)
    // 被更新的主键只剩一行，且是新版本
    const updated = newGroup?.fileSlice.baseFile?.records.filter((r) => r.recordKey === '1001')
    expect(updated).toHaveLength(1)
    expect(updated?.[0].fields.name).toBe('订单A-已更新')

    // 旧物理文件变 SUPERSEDED，但仍留在 physicalFiles 里（等 Clean 才真正删除）
    const oldPhysical = after.physicalFiles.find((f) => f.fileName === oldBase?.fileName)
    expect(oldPhysical).toBeDefined()
    expect(oldPhysical?.status).toBe('SUPERSEDED')
    // supersededBy 指向取代它的新 File Group
    expect(oldPhysical?.supersededBy).toBe(newGroup?.fileId)
    expect(after.physicalFiles).toHaveLength(2)
  })

  it('Timeline 新增一个 COMPLETED 的 COMMIT instant', () => {
    const before = seededState()
    expect(before.timeline).toHaveLength(1)
    expect(before.timeline[0].action).toBe('COMMIT')

    const after = stateOf(runUpsert(before, [
      {
        recordKey: '1001',
        fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION },
      },
    ]))

    expect(after.timeline).toHaveLength(2)
    const last = after.timeline[after.timeline.length - 1]
    expect(last.action).toBe('COMMIT')
    expect(last.state).toBe('COMPLETED')
    // instant time 单调递增，且互不重复
    expect(last.instantTime > before.timeline[0].instantTime).toBe(true)
    expect(new Set(after.usedInstants).size).toBe(after.usedInstants.length)
  })

  it('逻辑记录视图里被更新的主键字段被覆盖', () => {
    const before = seededState()
    const after = stateOf(runUpsert(before, [
      {
        recordKey: '1001',
        fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION },
      },
    ]))

    const rec = recordOf(after, '1001')
    expect(rec?.fields.name).toBe('订单A-已更新')
    expect(rec?.operation).toBe('U')
  })
})

describe('MOR upsert 已有主键', () => {
  it('追加 log file、base file 不变、Timeline 新增 DELTA_COMMIT instant', () => {
    const before = seededState(buildMorTable())
    const group = before.fileGroups[0]
    // MOR 首写（普通 upsert，非 bulk_insert）产生的是 log-only File Group
    expect(group.fileSlice.baseFile).toBeNull()
    expect(group.fileSlice.logFiles).toHaveLength(1)

    const result = runUpsert(before, [
      {
        recordKey: '1001',
        fields: { id: 1001, name: '订单A-已更新', amount: 150.75, ts: 20240101140000, dt: TEST_PARTITION },
      },
    ])
    expect(result.success).toBe(true)
    const after = stateOf(result)

    // 追加了第 2 个 log file
    const afterGroup = after.fileGroups[0]
    expect(afterGroup.fileId).toBe(group.fileId)
    expect(afterGroup.fileSlice.logFiles).toHaveLength(2)
    expect(afterGroup.fileSlice.logFiles[1].version).toBe(2)
    expect(afterGroup.fileSlice.deltaCommits).toHaveLength(1)

    // base file 依然不存在（没有产生新的 parquet）
    expect(afterGroup.fileSlice.baseFile).toBeNull()
    // 没有新 File Group
    expect(after.fileGroups).toHaveLength(1)

    // Timeline 是 DELTA_COMMIT
    const last = after.timeline[after.timeline.length - 1]
    expect(last.action).toBe('DELTA_COMMIT')
    expect(last.state).toBe('COMPLETED')
  })

  it('MOR 的 log 文件名带版本号，base 文件仍然是空', () => {
    const before = seededState(buildMorTable())
    const after = stateOf(runUpsert(before, [
      {
        recordKey: '1002',
        fields: { id: 1002, name: '订单B-已更新', amount: 210, ts: 20240101150000, dt: TEST_PARTITION },
      },
    ]))
    const logs = after.fileGroups[0].fileSlice.logFiles
    expect(logs.map((l) => l.fileName)).toEqual([
      expect.stringMatching(/\.log\.1_/),
      expect.stringMatching(/\.log\.2_/),
    ])
  })
})

describe('precombine 语义', () => {
  it('precombine 值更小的更新被忽略，并产生 warning', () => {
    const before = seededState()
    const oldTs = recordOf(before, '1001')?.preCombineValue
    expect(oldTs).toBe(20240101100000)

    const result = runUpsert(before, [
      {
        recordKey: '1001',
        fields: { id: 1001, name: '订单A-旧版本', amount: 1, ts: 20240101090000, dt: TEST_PARTITION },
      },
    ])
    expect(result.success).toBe(true)

    // 产生了一条明确的告警
    expect(result.warnings.some((w) => w.includes('precombine') && w.includes('忽略'))).toBe(true)

    // 逻辑记录视图保持旧版本
    const after = stateOf(result)
    const rec = recordOf(after, '1001')
    expect(rec?.fields.name).toBe('订单A')
    expect(rec?.preCombineValue).toBe(oldTs)
  })

  it('同批次重复主键 → 按 precombine 取值大者胜，且只新增一条记录', () => {
    const before = seededState()
    const result = runUpsert(before, [
      {
        recordKey: '1005',
        fields: { id: 1005, name: '订单E-旧', amount: 500, ts: 20240101150000, dt: TEST_PARTITION },
      },
      {
        recordKey: '1005',
        fields: { id: 1005, name: '订单E-新', amount: 505, ts: 20240101160000, dt: TEST_PARTITION },
      },
    ])
    expect(result.success).toBe(true)
    const after = stateOf(result)

    // 只保留 1 条主键 1005
    const hits = after.records.filter((r) => r.recordKey === '1005')
    expect(hits).toHaveLength(1)
    expect(hits[0].fields.name).toBe('订单E-新')
    expect(hits[0].preCombineValue).toBe(20240101160000)

    // 记录总数只 +1
    expect(after.records).toHaveLength(before.records.length + 1)

    // 取值不同 → 不产生「同一批次重复主键」的告警
    expect(result.warnings.some((w) => w.includes('同一批次内主键'))).toBe(false)
  })

  it('同批次重复主键且 precombine 取值相同 → 保留后写入者并告警', () => {
    const before = seededState()
    const result = runUpsert(before, [
      {
        recordKey: '1006',
        fields: { id: 1006, name: '订单F-前', amount: 600, ts: 20240101170000, dt: TEST_PARTITION },
      },
      {
        recordKey: '1006',
        fields: { id: 1006, name: '订单F-后', amount: 601, ts: 20240101170000, dt: TEST_PARTITION },
      },
    ])
    const after = stateOf(result)
    const hits = after.records.filter((r) => r.recordKey === '1006')
    expect(hits).toHaveLength(1)
    expect(hits[0].fields.name).toBe('订单F-后')
    expect(result.warnings.some((w) => w.includes('同一批次内主键'))).toBe(true)
  })
})

describe('写入的基本不变量', () => {
  it('全新主键在 COW 下产生新的 base file，在 MOR 下产生 log-only File Group', () => {
    const cow = stateOf(
      runUpsert(initialStateFor(buildTable()), [
        { recordKey: '2001', fields: { id: 2001, name: '新记录', amount: 1, ts: 1, dt: TEST_PARTITION } },
      ]),
    )
    expect(cow.fileGroups).toHaveLength(1)
    expect(cow.fileGroups[0].fileSlice.baseFile).not.toBeNull()
    expect(cow.fileGroups[0].fileSlice.logFiles).toHaveLength(0)

    const mor = stateOf(
      runUpsert(initialStateFor(buildMorTable()), [
        { recordKey: '2001', fields: { id: 2001, name: '新记录', amount: 1, ts: 1, dt: TEST_PARTITION } },
      ]),
    )
    expect(mor.fileGroups).toHaveLength(1)
    expect(mor.fileGroups[0].fileSlice.baseFile).toBeNull()
    expect(mor.fileGroups[0].fileSlice.logFiles).toHaveLength(1)
  })

  it('写入不会修改传入的 state（引擎内部先克隆再操作）', () => {
    const before = seededState()
    const snapshot = JSON.stringify(before)
    runUpsert(before, [
      { recordKey: '1001', fields: { id: 1001, name: 'x', amount: 1, ts: 99999999999999, dt: TEST_PARTITION } },
    ])
    expect(JSON.stringify(before)).toBe(snapshot)
  })

  it('种子数据本身就是 3 条记录、1 个 File Group、1 个 COMMIT instant', () => {
    const state = seededState()
    expect(state.records).toHaveLength(3)
    expect(state.fileGroups).toHaveLength(1)
    expect(state.timeline).toHaveLength(1)
    expect(state.timeline[0].action).toBe('COMMIT')
    expect(state.physicalFiles).toHaveLength(1)
    expect(state.physicalFiles[0].type).toBe('BASE')
    expect(seedRecords()).toHaveLength(3)
  })
})
