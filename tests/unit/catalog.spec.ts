import { describe, expect, it } from 'vitest'

// 注意：必须从 '@/experiments' 引入 —— 目录（catalog）本身不注册实验，
// 注册发生在 experiments/index.ts 的副作用里。
import { CATALOG, CATALOG_STATS, getAllExperiments, getCatalogEntry, getExperimentById, MODULES } from '@/experiments'
import { EVIDENCE_REPOSITORY, getEvidence } from '@/evidence'
import type { EvidenceLevel } from '@/models/evidence'
import type { HudiTableState } from '@/models/hudi'

/**
 * 实验目录（catalog）。
 *
 * 目录是「课程大纲」的唯一来源，三条硬约束：
 *   1. 共 80 条，分布在 9 个模块里，数量固定；
 *   2. **没有任何条目是 E3 / E4** —— 纯模拟项目不得过度声明；
 *   3. 每条目录引用的证据 id 都必须真实存在。
 */

/** 各模块的条目数（需求 §4 规定的固定配额） */
const EXPECTED_MODULE_COUNTS: Record<string, number> = {
  A: 8,
  B: 8,
  C: 10,
  D: 8,
  E: 8,
  F: 12,
  G: 8,
  H: 10,
  I: 8,
}

describe('目录规模', () => {
  it('共 80 条', () => {
    expect(CATALOG.length).toBe(80)
    expect(CATALOG_STATS.total).toBe(80)
  })

  it('9 个模块，条目数分别为 8/8/10/8/8/12/8/10/8', () => {
    expect(MODULES).toHaveLength(9)
    expect(CATALOG_STATS.modules).toBe(9)
    MODULES.forEach((m) => {
      const count = CATALOG.filter((e) => e.moduleId === m.id).length
      expect(count, `模块 ${m.id} 的条目数不对`).toBe(EXPECTED_MODULE_COUNTS[m.id])
    })
    // 总数校验
    const sum = MODULES.reduce((n, m) => n + CATALOG.filter((e) => e.moduleId === m.id).length, 0)
    expect(sum).toBe(80)
  })

  it('目录 id 全局唯一', () => {
    const ids = CATALOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('每个条目都有标题、摘要、证据等级与支持状态', () => {
    CATALOG.forEach((e) => {
      expect(e.id, '缺少 id').toBeTruthy()
      expect(e.title.length, `${e.id} 缺少标题`).toBeGreaterThan(0)
      expect(e.summary.length, `${e.id} 缺少摘要`).toBeGreaterThan(0)
      expect(['E0', 'E1', 'E2', 'E3', 'E4']).toContain(e.evidenceLevel)
      expect(['supported', 'conditional', 'unverified', 'unsupported']).toContain(e.supportState)
    })
  })
})

describe('证据等级（不得过度声明）', () => {
  it('没有任何条目是 E3 或 E4', () => {
    const overclaimed = CATALOG.filter((e) => e.evidenceLevel === 'E3' || e.evidenceLevel === 'E4')
    expect(
      overclaimed.map((e) => `${e.id}:${e.evidenceLevel}`),
      '纯模拟项目不得把目录条目标成 E3 / E4',
    ).toEqual([])
    expect(CATALOG_STATS.byLevel.E3).toBe(0)
    expect(CATALOG_STATS.byLevel.E4).toBe(0)
  })

  it('目录里用到的等级只有 E0 / E1 / E2', () => {
    const used = new Set<EvidenceLevel>(CATALOG.map((e) => e.evidenceLevel))
    expect([...used].sort()).toEqual(['E0', 'E1', 'E2'])
  })

  it('conditional / unverified 的条目必须写明证据缺口', () => {
    CATALOG.filter((e) => e.supportState === 'conditional' || e.supportState === 'unverified').forEach((e) => {
      expect(e.note, `${e.id} 缺少证据缺口说明`).toBeTruthy()
    })
  })

  it('目录引用的证据 id 都真实存在', () => {
    CATALOG.forEach((e) => {
      ;(e.evidenceIds ?? []).forEach((id) => {
        expect(getEvidence(id), `${e.id} 引用了不存在的证据 id：${id}`).toBeDefined()
      })
    })
  })
})

describe('实验注册表', () => {
  it('getExperimentById("B02") 能取到定义', () => {
    const def = getExperimentById('B02')
    expect(def).toBeDefined()
    expect(def?.id).toBe('B02')
    expect(def?.title).toContain('COW')
    expect(def?.steps.length).toBeGreaterThan(0)
    expect(def?.quiz.length).toBeGreaterThan(0)
    expect(def?.edgeCases.length).toBeGreaterThan(0)
    expect(def?.learningObjectives.length).toBeGreaterThan(0)
    // createState 必须能造出可用的初始状态
    // 注意：模型里 createState 的返回类型是 unknown（models/simulation.ts），
    // 这里显式收敛成 HudiTableState，避免把 unknown 传染到断言里。
    const state = def!.createState() as HudiTableState
    expect(state.table.tableName).toBeTruthy()
    expect(state.records.length).toBeGreaterThan(0)
  })

  it('已实现的目录条目都能通过 experimentId 找到实验定义', () => {
    const implemented = CATALOG.filter((e) => e.implemented)
    expect(implemented.length).toBeGreaterThan(0)
    implemented.forEach((e) => {
      expect(e.experimentId, `${e.id} 标记为已实现却没有 experimentId`).toBeTruthy()
      const def = getExperimentById(e.experimentId!)
      expect(def, `${e.id} 的 experimentId（${e.experimentId}）在注册表里找不到`).toBeDefined()
    })
  })

  it('找不到的实验返回 undefined 而不是抛错', () => {
    expect(getExperimentById('X99')).toBeUndefined()
    expect(getExperimentById('')).toBeUndefined()
  })

  it('实验定义的 moduleId 与目录对齐', () => {
    getAllExperiments().forEach((def) => {
      const entry = def.catalogIds?.map((cid) => getCatalogEntry(cid)).find((e) => e !== undefined)
      if (entry) {
        expect(def.moduleId, `${def.id} 的 moduleId 与目录不一致`).toBe(entry.moduleId)
      }
    })
  })

  it('实验定义引用的证据 id 都真实存在', () => {
    getAllExperiments().forEach((def) => {
      ;(def.evidenceIds ?? []).forEach((id) => {
        expect(getEvidence(id), `${def.id} 引用了不存在的证据 id：${id}`).toBeDefined()
      })
    })
  })

  it('实验的 evidenceLevel 不是 E3 / E4', () => {
    getAllExperiments().forEach((def) => {
      expect(['E3', 'E4'], `${def.id} 的证据等级过度声明`).not.toContain(def.evidenceLevel)
    })
  })
})

describe('证据库规模', () => {
  it('证据库里的 id 唯一，且 E4 数量为 0', () => {
    const ids = EVIDENCE_REPOSITORY.map((e) => e.evidenceId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(EVIDENCE_REPOSITORY.filter((e) => e.evidenceLevel === 'E4')).toHaveLength(0)
  })
})
