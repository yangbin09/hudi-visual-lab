import { describe, expect, it } from 'vitest'

import { buildTable, initialStateFor, runUpsert, stateOf, TEST_PARTITION } from '@/testing/factories'
import {
  BUCKET_ALGORITHM_NOTE,
  bucketOf,
  checkOperationCompatibility,
  indexDescription,
  indexSupportsUpsert,
  isGlobalIndex,
  teachingHash,
} from '@/engine/indexes/bucket'
import { performWrite } from '@/engine/operations/writes'
import { HuaweiMRS350R26Profile } from '@/engine/versions/HuaweiMRS350R26Profile'
import { SimulationError } from '@/engine/core/errors'
import type { HudiTable } from '@/models/hudi'

/**
 * Bucket 分配与索引约束。
 *
 * ⚠️ 重要：分桶哈希是**教学示意算法**（djb2 取模），
 *    r26 的实际分桶算法尚未确认（见 BUCKET_ALGORITHM_NOTE 与 profile.indexRules）。
 *    本测试锁定的是「本项目自己的确定性口径」，不代表 r26 行为。
 */

function bucketTable(bucketCount = 8): HudiTable {
  return buildTable({ indexType: 'BUCKET', bucketCount })
}

describe('bucketOf', () => {
  it('同一 key 恒定落到同一个桶（确定性）', () => {
    const first = bucketOf('1001', 8)
    const second = bucketOf('1001', 8)
    expect(first).toBe(second)
    expect(bucketOf('1001', 8)).toBe(bucketOf('1001', 8))
  })

  it('桶号恒在 [0, bucketCount) 区间内', () => {
    for (const key of ['1', '2', '1001', '1002', 'abc', '', '订单A']) {
      for (const count of [1, 2, 4, 8, 16]) {
        const bucket = bucketOf(key, count)
        expect(Number.isInteger(bucket)).toBe(true)
        expect(bucket).toBeGreaterThanOrEqual(0)
        expect(bucket).toBeLessThan(count)
      }
    }
  })

  it('bucketCount <= 0 时归一到 0 桶', () => {
    expect(bucketOf('1001', 0)).toBe(0)
    expect(bucketOf('1001', -1)).toBe(0)
  })

  it('teachingHash 是非负整数', () => {
    expect(teachingHash('1001')).toBeGreaterThanOrEqual(0)
    expect(teachingHash('1001')).toBe(teachingHash('1001'))
  })

  it('不同桶数的分桶结果可能不同（但都合法）', () => {
    const b4 = bucketOf('1001', 4)
    const b8 = bucketOf('1001', 8)
    expect(b4).toBeGreaterThanOrEqual(0)
    expect(b8).toBeGreaterThanOrEqual(0)
  })

  it('BUCKET_ALGORITHM_NOTE 明确声明这是教学示意算法', () => {
    expect(BUCKET_ALGORITHM_NOTE).toContain('教学示意算法')
    expect(BUCKET_ALGORITHM_NOTE).toContain('待源码/实测确认')
  })
})

describe('索引能力描述', () => {
  it('SIMPLE / BLOOM 是分区级索引', () => {
    expect(indexDescription('SIMPLE').scope).toBe('partition')
    expect(indexDescription('BLOOM').scope).toBe('partition')
    expect(indexDescription('BUCKET').scope).toBe('partition')
  })

  it('GLOBAL 索引是全局级', () => {
    expect(indexDescription('GLOBAL_SIMPLE').scope).toBe('global')
    expect(isGlobalIndex('GLOBAL_SIMPLE')).toBe(true)
    expect(isGlobalIndex('GLOBAL_BLOOM')).toBe(true)
    expect(isGlobalIndex('SIMPLE')).toBe(false)
  })

  it('各索引都支持 upsert（能定位已存在主键所在文件）', () => {
    expect(indexSupportsUpsert('SIMPLE')).toBe(true)
    expect(indexSupportsUpsert('BLOOM')).toBe(true)
    expect(indexSupportsUpsert('BUCKET')).toBe(true)
    expect(indexSupportsUpsert('GLOBAL_SIMPLE')).toBe(true)
    expect(indexSupportsUpsert('GLOBAL_BLOOM')).toBe(true)
  })
})

describe('BUCKET 索引 + bulk_insert 的组合限制', () => {
  it('checkOperationCompatibility 返回非 null（被拒绝）', () => {
    const reason = checkOperationCompatibility(bucketTable(), 'BULK_INSERT')
    expect(reason).not.toBeNull()
    expect(typeof reason).toBe('string')
    expect(reason).toContain('BUCKET')
  })

  it('BUCKET 索引 + insert_overwrite 同样被拒绝', () => {
    expect(checkOperationCompatibility(bucketTable(), 'INSERT_OVERWRITE')).not.toBeNull()
  })

  it('BUCKET 索引 + 普通 upsert 不被拒绝', () => {
    expect(checkOperationCompatibility(bucketTable(), 'UPSERT')).toBeNull()
  })

  it('非 BUCKET 索引 + bulk_insert 不被拒绝', () => {
    expect(checkOperationCompatibility(buildTable(), 'BULK_INSERT')).toBeNull()
  })

  it('performWrite 直接抛 SimulationError，且不产生任何状态变更', () => {
    const state = initialStateFor(bucketTable())
    const before = JSON.stringify(state)

    expect(() =>
      performWrite(
        state,
        [{ recordKey: '1001', fields: { id: 1001, name: 'x', amount: 1, ts: 1, dt: TEST_PARTITION } }],
        'BULK_INSERT',
        HuaweiMRS350R26Profile,
      ),
    ).toThrow(SimulationError)

    expect(JSON.stringify(state)).toBe(before)
  })
})

describe('BUCKET 索引下的写入落点', () => {
  it('同主键始终落在同一个桶 → 同一个 File Group', () => {
    const table = bucketTable(4)
    const after = stateOf(
      runUpsert(initialStateFor(table), [
        { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 1, ts: 1, dt: TEST_PARTITION } },
      ]),
    )
    expect(after.fileGroups).toHaveLength(1)
    const bucket = after.fileGroups[0].bucket
    expect(bucket).not.toBeNull()
    expect(bucket).toBe(bucketOf('1001', 4))
  })

  it('BUCKET 索引的 File Group 记录了桶号，非 BUCKET 索引则为 null', () => {
    const plain = stateOf(
      runUpsert(initialStateFor(buildTable()), [
        { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 1, ts: 1, dt: TEST_PARTITION } },
      ]),
    )
    expect(plain.fileGroups[0].bucket).toBeNull()
  })
})
