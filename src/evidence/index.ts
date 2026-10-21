import type { Evidence } from '@/models/evidence'
import { HUAWEI_R26_EVIDENCE } from './huawei/mrs350r26'
import { COMMUNITY_EVIDENCE } from './community/hudi015'

/** 版本证据库：实验 → 动作 → 版本规则 → 证据 的关联终点 */
export const EVIDENCE_REPOSITORY: Evidence[] = [...HUAWEI_R26_EVIDENCE, ...COMMUNITY_EVIDENCE]

const INDEX = new Map(EVIDENCE_REPOSITORY.map((e) => [e.evidenceId, e]))

export function getEvidence(id: string): Evidence | undefined {
  return INDEX.get(id)
}

export function getEvidenceList(ids: string[]): Evidence[] {
  return ids.map((id) => INDEX.get(id)).filter((e): e is Evidence => Boolean(e))
}

/** 按版本级别筛选 */
export function evidenceByLevel(level: Evidence['evidenceLevel']): Evidence[] {
  return EVIDENCE_REPOSITORY.filter((e) => e.evidenceLevel === level)
}

/**
 * 证据库健康度：是否存在 E4（r26 实测）证据。
 * 当前项目为纯模拟阶段，应当为 0 —— 界面据此显示「全部为模拟，未接入真实集群」。
 */
export function hasFieldVerifiedEvidence(): boolean {
  return EVIDENCE_REPOSITORY.some((e) => e.evidenceLevel === 'E4')
}

export const EVIDENCE_STATS = {
  total: EVIDENCE_REPOSITORY.length,
  E0: evidenceByLevel('E0').length,
  E1: evidenceByLevel('E1').length,
  E2: evidenceByLevel('E2').length,
  E3: evidenceByLevel('E3').length,
  E4: evidenceByLevel('E4').length,
}
