import type { HudiTable } from './hudi'

export type ActionType =
  | 'CREATE_TABLE'
  | 'INSERT_RECORDS'
  | 'UPSERT_RECORDS'
  | 'DELETE_RECORDS'
  | 'OVERWRITE_PARTITION'
  | 'OVERWRITE_TABLE'
  | 'SCHEDULE_COMPACTION'
  | 'RUN_COMPACTION'
  | 'RUN_CLEAN'
  | 'RUN_ARCHIVE'
  | 'RUN_ROLLBACK'
  | 'RUN_CLUSTERING'
  | 'APPLY_TTL'
  | 'INJECT_FAILURE'
  | 'RESET_EXPERIMENT'

/** 写入时传入的一条记录（用户输入） */
export interface InputRecord {
  recordKey: string
  /** 用户显式指定的分区值；为空则由引擎按分区字段推导 */
  partitionPath?: string
  fields: Record<string, unknown>
}

export interface CreateTableAction {
  type: 'CREATE_TABLE'
  table: Partial<HudiTable> & { tableName: string }
}

export interface InsertRecordsAction {
  type: 'INSERT_RECORDS'
  records: InputRecord[]
}

export interface UpsertRecordsAction {
  type: 'UPSERT_RECORDS'
  records: InputRecord[]
}

export interface DeleteRecordsAction {
  type: 'DELETE_RECORDS'
  recordKeys: string[]
}

export interface OverwritePartitionAction {
  type: 'OVERWRITE_PARTITION'
  partitionPath: string
  records: InputRecord[]
}

export interface OverwriteTableAction {
  type: 'OVERWRITE_TABLE'
  records: InputRecord[]
}

export interface ScheduleCompactionAction {
  type: 'SCHEDULE_COMPACTION'
  /** 触发 compaction 的最小 log 文件数 */
  deltaCommits?: number
}

export interface RunCompactionAction {
  type: 'RUN_COMPACTION'
  /** 指定要执行的计划 instant；缺省执行最新计划 */
  planInstant?: string
  /** 故障注入：模拟执行失败 */
  failWith?: CompactionFailureMode
}

export type CompactionFailureMode =
  | 'NONE'
  | 'SPARK_TASK_FAILED'
  | 'YARN_KILLED'
  | 'SPARK_OK_BUT_TX_INCOMPLETE'
  | 'PLAN_NOT_FOUND'
  | 'STALE_PLAN'
  | 'SCHEDULER_TIMEOUT'

export interface RunCleanAction {
  type: 'RUN_CLEAN'
  /** 保留的 commit 数（hoodie.cleaner.commits.retained） */
  commitsRetained?: number
}

export interface RunArchiveAction {
  type: 'RUN_ARCHIVE'
  /** 归档后保留的最大 instant 数 */
  maxCommitsToKeep?: number
}

export interface RunRollbackAction {
  type: 'RUN_ROLLBACK'
  instantTime?: string
}

export interface RunClusteringAction {
  type: 'RUN_CLUSTERING'
  /** 目标单文件大小（MB） */
  targetFileSizeMb?: number
}

export interface ApplyTtlAction {
  type: 'APPLY_TTL'
  spec: string
  level: 'PARTITION' | 'RECORD'
  value: number
  units: 'YEARS' | 'MONTHS' | 'WEEKS' | 'DAYS'
}

export interface InjectFailureAction {
  type: 'INJECT_FAILURE'
  scenario: string
}

export interface ResetExperimentAction {
  type: 'RESET_EXPERIMENT'
}

export type SimulationAction =
  | CreateTableAction
  | InsertRecordsAction
  | UpsertRecordsAction
  | DeleteRecordsAction
  | OverwritePartitionAction
  | OverwriteTableAction
  | ScheduleCompactionAction
  | RunCompactionAction
  | RunCleanAction
  | RunArchiveAction
  | RunRollbackAction
  | RunClusteringAction
  | ApplyTtlAction
  | InjectFailureAction
  | ResetExperimentAction

export const ACTION_LABEL: Record<ActionType, string> = {
  CREATE_TABLE: '创建表',
  INSERT_RECORDS: '插入记录',
  UPSERT_RECORDS: '更新记录',
  DELETE_RECORDS: '删除记录',
  OVERWRITE_PARTITION: '覆盖分区',
  OVERWRITE_TABLE: '覆盖整表',
  SCHEDULE_COMPACTION: '生成 Compaction Plan',
  RUN_COMPACTION: '执行 Compaction',
  RUN_CLEAN: '执行 Clean',
  RUN_ARCHIVE: '执行 Archive',
  RUN_ROLLBACK: '执行 Rollback',
  RUN_CLUSTERING: '执行 Clustering',
  APPLY_TTL: '应用 TTL',
  INJECT_FAILURE: '注入故障',
  RESET_EXPERIMENT: '重置实验',
}
