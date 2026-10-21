import { describe, expect, it } from 'vitest'

import { buildTable, initialStateFor, runUpsert, stateOf, TEST_PARTITION } from '@/testing/factories'
import { derivePartitionPath, isDefaultPartition } from '@/engine/core/state'
import type { HudiTable } from '@/models/hudi'

/**
 * 分区行为。
 *
 * 教学重点：
 *   - 分区路径由「分区字段的值」推导，单级是 '2024-01-01'，多级是 'a/b'；
 *   - 非 GLOBAL 索引下，同一主键出现在多个分区就是「跨分区同主键」，
 *     引擎必须给出显式告警（这是 Hudi 最经典的坑之一）。
 */

describe('derivePartitionPath', () => {
  it('单级分区：分区字段的值就是分区路径', () => {
    const table = buildTable()
    expect(derivePartitionPath(table, { dt: '2024-01-01' })).toBe('2024-01-01')
  })

  it('多级分区：按分区字段顺序用 / 连接', () => {
    const table = buildTable({ partitionFields: ['dt', 'region'] })
    expect(derivePartitionPath(table, { dt: '2024-01-01', region: 'cn' })).toBe('2024-01-01/cn')
    // 顺序由表定义决定，与字段在对象里的顺序无关
    expect(derivePartitionPath(table, { region: 'cn', dt: '2024-01-01' })).toBe('2024-01-01/cn')
  })

  it('非分区表：分区路径恒为空串', () => {
    const table = buildTable({ partitionFields: [], partitionType: 'NON_PARTITIONED' })
    expect(derivePartitionPath(table, { dt: '2024-01-01' })).toBe('')
  })

  it('分区字段缺值 / 空串 → 落到默认分区', () => {
    const table = buildTable()
    expect(derivePartitionPath(table, {})).toBe('')
    expect(derivePartitionPath(table, { dt: '' })).toBe('')
    expect(derivePartitionPath(table, { dt: null })).toBe('')
    expect(isDefaultPartition(derivePartitionPath(table, {}))).toBe(true)
    expect(isDefaultPartition('2024-01-01')).toBe(false)
  })

  it('分区字段的值按字符串化处理', () => {
    const table = buildTable()
    expect(derivePartitionPath(table, { dt: 20240101 })).toBe('20240101')
  })
})

describe('跨分区同主键', () => {
  it('同一次写入里同一主键落在两个分区 → 产生 warning', () => {
    const result = runUpsert(initialStateFor(buildTable()), [
      { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 1, ts: 1, dt: '2024-01-01' } },
      { recordKey: '1001', fields: { id: 1001, name: '订单A-副本', amount: 1, ts: 1, dt: '2024-01-02' } },
    ])

    expect(result.success).toBe(true)
    const warning = result.warnings.find((w) => w.includes('跨越'))
    expect(warning).toBeDefined()
    expect(warning).toContain('1001')
    expect(warning).toContain('2 个分区')
    // 非 GLOBAL 索引的告警措辞
    expect(warning).toContain('非 GLOBAL 索引')
  })

  it('BUCKET 索引下跨分区同主键的告警措辞不同（说明会落入不同桶）', () => {
    const table = buildTable({ indexType: 'BUCKET', bucketCount: 4 })
    const result = runUpsert(initialStateFor(table), [
      { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 1, ts: 1, dt: '2024-01-01' } },
      { recordKey: '1001', fields: { id: 1001, name: '订单A-副本', amount: 1, ts: 1, dt: '2024-01-02' } },
    ])

    const warning = result.warnings.find((w) => w.includes('跨越'))
    expect(warning).toBeDefined()
    expect(warning).toContain('BUCKET 索引')
  })

  it('同一分区内的重复主键不算跨分区', () => {
    const result = runUpsert(initialStateFor(buildTable()), [
      { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 1, ts: 1, dt: TEST_PARTITION } },
      { recordKey: '1001', fields: { id: 1001, name: '订单A-新', amount: 1, ts: 2, dt: TEST_PARTITION } },
    ])
    expect(result.warnings.some((w) => w.includes('跨越'))).toBe(false)
  })

  it('跨分区同主键在状态里确实落在两个分区下', () => {
    const after = stateOf(
      runUpsert(initialStateFor(buildTable()), [
        { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 1, ts: 1, dt: '2024-01-01' } },
        { recordKey: '1001', fields: { id: 1001, name: '订单A-副本', amount: 1, ts: 1, dt: '2024-01-02' } },
      ]),
    )
    const partitions = after.records.filter((r) => r.recordKey === '1001').map((r) => r.partitionPath)
    expect(new Set(partitions).size).toBe(2)
  })
})

describe('分区目录与表定义的一致性', () => {
  it('表类型不影响分区推导', () => {
    const cow: HudiTable = buildTable()
    const mor: HudiTable = buildTable({ tableType: 'MERGE_ON_READ' })
    expect(derivePartitionPath(cow, { dt: '2024-01-01' })).toBe(
      derivePartitionPath(mor, { dt: '2024-01-01' }),
    )
  })
})
