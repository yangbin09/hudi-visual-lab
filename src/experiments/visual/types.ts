export type SceneKind = 'files' | 'index' | 'query' | 'timeline' | 'flow' | 'schema' | 'metrics'
export type Effect = 'observe' | 'route' | 'write' | 'merge' | 'remove' | 'archive' | 'rollback' | 'error' | 'read' | 'highlight' | 'branch'
export type LessonOperation = 'insert' | 'upsert' | 'delete' | 'bulk' | 'overwrite-partition' | 'overwrite-table' | 'duplicates' | 'stale' | 'schedule' | 'compact' | 'fail' | 'rollback' | 'clean' | 'archive' | 'cluster' | 'ttl' | 'create' | 'snapshot' | 'optimized' | 'incremental' | 'history' | 'metadata' | 'partition-read' | 'bucket-write' | 'empty-partition' | 'cross-partition' | 'invalid-schema' | 'invalid-bulk'
export interface LessonStep { title: string; caption: string; effect: Effect; operation?: LessonOperation; focus?: number; moments?: { at: number; title: string; explanation: string }[] }
export interface VisualLesson {
  id: string
  kind: SceneKind
  seed: 'empty' | 'cow' | 'mor' | 'updates' | 'multi' | 'bucket' | 'pending' | 'small'
  model: 'engine' | 'concept' | 'mixed'
  nodes: string[]
  steps: LessonStep[]
  actionLabel: string
  controls: ('recordKey' | 'amount' | 'bucketCount' | 'partition' | 'retention' | 'failureAt' | 'tableType')[]
  /** 兼容旧字段：单条边界说明 */
  limitation?: string
  /** 一句话学习目标（学生视角："学完你能回答……"）；可选，缺失时渲染层应容忍 */
  objective?: string
  /** 前置知识 / 术语；可点击跳术语表 */
  prerequisites?: string[]
  /** 一句话关键结论 */
  takeaway?: string
  /** 本课术语卡（≤4 个），def ≤30 字 */
  glossary?: { term: string; def: string }[]
  /** 本主题边界：把正文里的免责话术集中到这里，1–2 条可执行信息 */
  limitations?: string[]
  /** 本主题对应的 SQL / Scala / Flink / Shell 模板 id（必须真实存在） */
  templateIds?: string[]
}
export interface LessonParameters {
  checkpointOffset?: number
  writerTarget?: 'same' | 'different'
  occRetry?: boolean
  recordKey: string; amount: number; bucketCount: number; partition: string; retention: number; failureAt: number; tableType: 'COPY_ON_WRITE' | 'MERGE_ON_READ'
}
