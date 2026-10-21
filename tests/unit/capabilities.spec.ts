import { describe, expect, it } from 'vitest'

import { buildTable, initialStateFor, seededState, stateOf, TEST_PARTITION } from '@/testing/factories'
import { applyAction } from '@/engine/core/applyAction'
import { SimulationError } from '@/engine/core/errors'
import { capabilityOf, configName, HuaweiMRS350R26Profile, R26_ARTIFACTS } from '@/engine/versions/HuaweiMRS350R26Profile'
import { hasFieldVerifiedEvidence, EVIDENCE_STATS } from '@/evidence'

/**
 * 能力（capability）与「不支持的操作」的拒绝行为。
 *
 * 两条底线：
 *   1. 未登记的能力一律按 unverified 处理（保守默认，不做乐观假设）；
 *   2. 引擎拒绝一个动作时，**状态必须原样不变** —— 失败绝不允许留下半截改动。
 */

describe('capabilityOf', () => {
  it('未登记的能力返回 unverified（保守默认）', () => {
    const cap = capabilityOf('this-capability-does-not-exist')
    expect(cap.key).toBe('this-capability-does-not-exist')
    expect(cap.state).toBe('unverified')
    expect(cap.openQuestion).toBeTruthy()
  })

  it('已登记的能力返回登记时的状态', () => {
    expect(capabilityOf('run-compaction-sql').state).toBe('supported')
    expect(capabilityOf('run-clean-sql').state).toBe('conditional')
    expect(capabilityOf('ttl-record-level').state).toBe('unsupported')
    expect(capabilityOf('index-bucket').state).toBe('unverified')
    expect(capabilityOf('index-global').state).toBe('unverified')
  })

  it('conditional 的能力必须写明前置条件', () => {
    const cap = capabilityOf('run-clean-sql')
    expect(cap.precondition).toBeTruthy()
    expect(cap.precondition).toContain('3.1')
  })

  it('unsupported 的能力（RECORD 级 TTL）写明原因', () => {
    const cap = capabilityOf('ttl-record-level')
    expect(cap.precondition).toContain('PARTITION')
  })
})

describe('版本档案', () => {
  it('组件版本指向 r26 定制版', () => {
    expect(HuaweiMRS350R26Profile.release).toContain('3.1.0-350-r26')
    expect(HuaweiMRS350R26Profile.components.hudi).toBe('0.15.0-h0.cbu.mrs.350.r26')
    expect(HuaweiMRS350R26Profile.components.spark).toContain('3.3.1')
    expect(HuaweiMRS350R26Profile.components.flink).toBe('1.17.x')
  })

  it('BUCKET 分桶算法未被标记为已确认', () => {
    expect(HuaweiMRS350R26Profile.indexRules.bucketHashVerified).toBe(false)
    expect(HuaweiMRS350R26Profile.indexRules.bucketWithBulkInsertAllowed).toBe(false)
    expect(HuaweiMRS350R26Profile.indexRules.globalIndexSupported).toBe(false)
  })

  it('TTL 只支持 PARTITION 级', () => {
    expect(HuaweiMRS350R26Profile.ttlSupport.supported).toBe(true)
    expect(HuaweiMRS350R26Profile.ttlSupport.levels).toEqual(['PARTITION'])
  })

  it('逻辑配置名能映射到 r26 的实际配置名', () => {
    expect(configName('compaction.only.inline')).toBe('hoodie.run.compact.only.inline')
    expect(configName('cleaner.commits.retained')).toBe('hoodie.cleaner.commits.retained')
    // 未登记的名字原样返回
    expect(configName('unknown.config')).toBe('unknown.config')
  })

  it('制品坐标里没有 hudi-spark-common（负向证据：该坐标在 r26 不存在）', () => {
    expect(Object.keys(R26_ARTIFACTS)).not.toContain('hudi-spark-common')
    expect(Object.values(R26_ARTIFACTS).every((v) => v === '0.15.0-h0.cbu.mrs.350.r26')).toBe(true)
  })
})

describe('证据库', () => {
  it('本项目是纯模拟：证据库里没有 E4（集群实测）条目', () => {
    expect(hasFieldVerifiedEvidence()).toBe(false)
    expect(EVIDENCE_STATS.E4).toBe(0)
  })
})

describe('applyAction 失败时的状态不变性', () => {
  it('nextState 与入参严格相等（同一个引用）', () => {
    const state = seededState()
    const result = applyAction(state, { type: 'RUN_COMPACTION' })
    expect(result.success).toBe(false)
    expect(result.nextState).toBe(state)
  })

  it('失败时状态内容完全没有被修改', () => {
    const state = seededState()
    const before = JSON.stringify(state)
    const result = applyAction(state, { type: 'RUN_COMPACTION' })
    expect(result.success).toBe(false)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('失败时不写 checkpoint', () => {
    const state = seededState()
    const checkpointsBefore = state.checkpoints.length
    const result = applyAction(state, { type: 'RUN_COMPACTION' })
    expect(result.success).toBe(false)
    expect(state.checkpoints.length).toBe(checkpointsBefore)
  })

  it('多种非法操作都会失败且不改状态', () => {
    const cases = [
      { type: 'RUN_COMPACTION' as const },
      { type: 'SCHEDULE_COMPACTION' as const, deltaCommits: 1 },
      { type: 'DELETE_RECORDS' as const, recordKeys: ['不存在的主键'] },
      { type: 'APPLY_TTL' as const, spec: 'dt=.*', level: 'RECORD' as const, value: 30, units: 'DAYS' as const },
      { type: 'RUN_ROLLBACK' as const },
    ]

    cases.forEach((action) => {
      const state = seededState()
      const before = JSON.stringify(state)
      const result = applyAction(state, action)
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
      expect(result.nextState).toBe(state)
      expect(JSON.stringify(state)).toBe(before)
    })
  })

  it('失败的错误信息会被放进 warnings', () => {
    const state = seededState()
    const result = applyAction(state, { type: 'RUN_COMPACTION' })
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.join('\n')).toContain(result.error)
  })

  it('RECORD 级 TTL 被明确拒绝（r26 文档只支持 PARTITION）', () => {
    const state = seededState(buildTable())
    const result = applyAction(state, {
      type: 'APPLY_TTL',
      spec: 'dt=2024/01/.*',
      level: 'RECORD',
      value: 30,
      units: 'DAYS',
    })
    expect(result.success).toBe(false)
    expect(result.error).toContain('PARTITION')
  })

  it('成功的动作会写 checkpoint，状态随之推进', () => {
    const state = seededState()
    const checkpointsBefore = state.checkpoints.length
    const result = applyAction(state, {
      type: 'UPSERT_RECORDS',
      records: [{ recordKey: '1004', fields: { id: 1004, name: '新增订单D', amount: 4, ts: 1, dt: TEST_PARTITION } }],
    })
    expect(result.success).toBe(true)
    expect(stateOf(result).checkpoints.length).toBeGreaterThan(checkpointsBefore)
  })

  it('未实现的动作类型被拒绝', () => {
    const state = initialStateFor(buildTable())
    const result = applyAction(state, { type: 'NOT_A_REAL_ACTION' } as never)
    expect(result.success).toBe(false)
    expect(result.error).toContain('未实现的动作类型')
  })

  it('RESET_EXPERIMENT 不产生任何状态变更', () => {
    const state = seededState()
    const before = JSON.stringify(state)
    const result = applyAction(state, { type: 'RESET_EXPERIMENT' })
    expect(result.success).toBe(true)
    expect(result.nextState).toBe(state)
    expect(JSON.stringify(state)).toBe(before)
    expect(result.events[0].instantTime).toBeNull()
  })
})

describe('SimulationError', () => {
  it('携带命中的能力键', () => {
    const err = new SimulationError('测试消息', 'run-clean-sql')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('SimulationError')
    expect(err.capabilityKey).toBe('run-clean-sql')
  })
})
