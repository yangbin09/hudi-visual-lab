/**
 * 版本证据模型
 *
 * 证据分级（见需求 §2.3）：
 *   E0 尚无依据，仅为待研究场景
 *   E1 Apache Hudi 0.15 社区文档支持
 *   E2 华为相关版本文档支持，但未确认 r26
 *   E3 已通过 r26 源码/JAR 分析确认
 *   E4 已通过实际 r26 测试环境验证
 */
export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4'

export type CapabilityState = 'supported' | 'unsupported' | 'unverified' | 'conditional'

export type EvidenceSourceType =
  | 'community-doc'
  | 'huawei-doc'
  | 'maven-artifact'
  | 'source-analysis'
  | 'bytecode'
  | 'spark-sql-test'
  | 'flink-sql-test'
  | 'hdfs-snapshot'
  | 'timeline-metadata'
  | 'error-log'
  | 'research-note'

export interface Evidence {
  evidenceId: string
  title: string
  evidenceLevel: EvidenceLevel
  component: string
  version: string
  sourceType: EvidenceSourceType
  documentUrl?: string
  artifactCoordinate?: string
  className?: string
  methodName?: string
  testCommand?: string
  expectedResult?: string
  actualResult?: string
  environment?: string
  verifiedAt?: string
  notes?: string
}

/** 能力项：带前置条件的支持状态 */
export interface Capability {
  key: string
  state: CapabilityState
  /** conditional 时必填：适用前提 */
  precondition?: string
  /** unverified 时必填：待核实的问题描述 */
  openQuestion?: string
  evidenceIds?: string[]
}

/** 能力项在 UI 上的展示标签 */
export const CAPABILITY_LABEL: Record<CapabilityState, string> = {
  supported: 'r26 已确认',
  unsupported: 'r26 不支持',
  unverified: '待验证',
  conditional: '有条件支持',
}

export const EVIDENCE_LEVEL_LABEL: Record<EvidenceLevel, string> = {
  E0: '待研究场景',
  E1: '社区文档',
  E2: '华为文档',
  E3: 'r26 源码确认',
  E4: 'r26 实测',
}
