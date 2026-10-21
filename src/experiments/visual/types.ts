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
  limitation?: string
}
export interface LessonParameters {
  recordKey: string; amount: number; bucketCount: number; partition: string; retention: number; failureAt: number; tableType: 'COPY_ON_WRITE' | 'MERGE_ON_READ'
}
