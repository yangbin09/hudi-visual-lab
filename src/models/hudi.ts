import type { Capability } from './evidence'

/** Hudi 表类型 */
export type TableType = 'COPY_ON_WRITE' | 'MERGE_ON_READ'

/** 索引类型 */
export type IndexType = 'SIMPLE' | 'BLOOM' | 'BUCKET' | 'GLOBAL_SIMPLE' | 'GLOBAL_BLOOM'

/** 写入 Operation（Hudi 语义，与 Spark SaveMode 职责不同） */
export type WriteOperation = 'UPSERT' | 'INSERT' | 'BULK_INSERT' | 'INSERT_OVERWRITE' | 'INSERT_OVERWRITE_TABLE'

/** Hive Style Partitioning */
export type HiveStylePartitioning = 'NONE' | 'HIVE_STYLE_PARTITIONING' | 'STYLE_PARTITIONING_ONLY'

export interface HudiField {
  name: string
  type: string
  nullable?: boolean
  comment?: string
}

export interface HudiTable {
  tableName: string
  databaseName: string
  tableType: TableType
  fields: HudiField[]
  /** Record Key（主键），Hudi 0.15 默认使用 hoodie.datasource.write.recordkey.field */
  primaryKey: string | null
  /** Precombine Field，用于同主键多版本排序 */
  preCombineField: string | null
  partitionFields: string[]
  partitionType: 'PARTITIONED' | 'NON_PARTITIONED'
  indexType: IndexType
  /** BUCKET 索引的桶数；非 BUCKET 索引时为 null */
  bucketCount: number | null
  /** GLOBAL 索引：索引跨分区生效 */
  isGlobalIndexed: boolean
  payloadClass: string
  /** HDFS 表路径 */
  tablePath: string
  hiveStylePartitioning: HiveStylePartitioning
  properties: Record<string, string>
  /** 目标版本标识 */
  version: string
}

/** HoodieKey：Hudi 内部定位一条记录的复合键 */
export interface HoodieKey {
  recordKey: string
  partitionPath: string
}

/** 记录操作类型 */
export type RecordOperation = 'I' | 'U' | 'D'

export interface HudiRecord {
  recordKey: string
  partitionPath: string
  fields: Record<string, unknown>
  preCombineValue: number | null
  commitTime: string
  commitSeqNo: number
  operation: RecordOperation
  hoodieKey: string
}

export interface HudiBaseFile {
  fileName: string
  instantTime: string
  sizeBytes: number
  recordCount: number
  records: HudiRecord[]
  storagePath: string
  fileId: string
  /** 该 base 文件由哪个 compaction/clustering 产生 */
  producedBy?: string
}

export interface HudiLogFile {
  fileName: string
  instantTime: string
  version: number
  sizeBytes: number
  recordCount: number
  records: HudiRecord[]
  storagePath: string
}

export interface HudiFileSlice {
  baseFile: HudiBaseFile | null
  logFiles: HudiLogFile[]
  baseInstantTime: string | null
  /** 引用该 slice 的 delta commit instant */
  deltaCommits: string[]
  compactionRequested: boolean
}

export interface HudiFileGroup {
  fileId: string
  partitionPath: string
  fileSlice: HudiFileSlice
  recordCount: number
  totalSizeBytes: number
  /** BUCKET 索引下的桶号；非 BUCKET 时为 null */
  bucket: number | null
  /**
   * 被新 File Group 取代后记录其 id。
   * 被取代的 File Group 的文件在 Clean 执行前仍然物理存在于 HDFS 上。
   */
  supersededBy?: string | null
}

export type InstantAction =
  | 'COMMIT'
  | 'DELTA_COMMIT'
  | 'COMPACTION'
  | 'CLEAN'
  | 'ARCHIVE'
  | 'ROLLBACK'
  | 'REPLACE_COMMIT'
  | 'CLUSTERING'
  | 'RESTORE'
  | 'TTL'
  | 'SAVEPOINT'

export type InstantState = 'REQUESTED' | 'INFLIGHT' | 'COMPLETED'

export interface HudiInstant {
  instantTime: string
  action: InstantAction
  state: InstantState
  operation?: string
  tableName?: string
  partitionPath?: string
  files?: string[]
  extraMetadata?: Record<string, unknown>
}

/** Compaction 计划中待处理的 file group */
export interface CompactionPlanEntry {
  partitionPath: string
  fileId: string
  logFileCount: number
  recordCount: number
}

export interface CompactionPlan {
  instantTime: string
  entries: CompactionPlanEntry[]
  state: 'PLANNED' | 'EXECUTED' | 'FAILED'
}

export interface TtlPolicy {
  spec: string
  level: 'PARTITION' | 'RECORD'
  value: number
  units: 'YEARS' | 'MONTHS' | 'WEEKS' | 'DAYS'
}

/**
 * HDFS 上的物理文件。
 *
 * 关键区分：
 *   - physicalFiles = HDFS 上真实存在的文件（含被新版本取代但尚未 Clean 的旧文件）
 *   - fileGroups[].fileSlice = 当前 Timeline 版本所引用的文件
 * Clean 的作用就是把 physicalFiles 中不再被引用的文件真正删除。
 */
export interface HudiPhysicalFile {
  fileName: string
  partitionPath: string
  type: 'BASE' | 'LOG'
  sizeBytes: number
  recordCount: number
  createdInstant: string
  /** ACTIVE = 仍被当前 File Slice 引用；SUPERSEDED = 已被取代，等待 Clean */
  status: 'ACTIVE' | 'SUPERSEDED'
  supersededAt?: string
  supersededBy?: string
}

/** HudiTableState：一次实验的完整可回放状态 */
export interface HudiTableState {
  table: HudiTable
  /** 逻辑记录视图（模拟计算辅助状态，不等于真实存储布局） */
  records: HudiRecord[]
  fileGroups: HudiFileGroup[]
  /** HDFS 上的物理文件清单 */
  physicalFiles: HudiPhysicalFile[]
  timeline: HudiInstant[]
  /** 已归档的 instant（不再出现在活跃 timeline） */
  archivedInstants: HudiInstant[]
  pendingInstants: HudiInstant[]
  compactionPlans: CompactionPlan[]
  ttlPolicies: TtlPolicy[]
  /** instant 时间生成器状态 */
  instantCounter: number
  /** 已使用的 instant 时间集合，保证单调递增且不重复 */
  usedInstants: string[]
  /** 成功提交后的状态快照，供 Restore / Time Travel 使用 */
  checkpoints: { instantTime: string; state: HudiTableState }[]
}

/** 版本规则档案：所有存在版本差异的逻辑都必须经由此处 */
export interface HudiVersionProfile {
  /** 发行版本标识 */
  release: string
  /** 组件版本 */
  components: Record<string, string>
  /** 已确认支持的能力 */
  capabilities: Record<string, Capability>
  /** 配置名映射：逻辑名 → 该版本实际配置名 */
  configMapping: Record<string, string>
  /** 操作约束：某操作在某条件下不允许 */
  operationConstraints: Record<string, string>
  /** 索引规则 */
  indexRules: IndexRules
  /** TTL 支持范围 */
  ttlSupport: {
    supported: boolean
    levels: string[]
    units: string[]
    note: string
  }
}

export interface IndexRules {
  /** BUCKET 索引的分桶算法标识 —— 待 r26 源码确认 */
  bucketHashAlgorithm: string
  /** 该算法是否为 r26 已确认实现 */
  bucketHashVerified: boolean
  /** BUCKET 索引与 bulk insert 的组合限制 */
  bucketWithBulkInsertAllowed: boolean
  bucketWithBulkInsertNote: string
  /** GLOBAL 索引支持情况 */
  globalIndexSupported: boolean
  globalIndexNote: string
}

export const TABLE_TYPE_LABEL: Record<TableType, string> = {
  COPY_ON_WRITE: 'COW（Copy On Write）',
  MERGE_ON_READ: 'MOR（Merge On Read）',
}

export const INDEX_TYPE_LABEL: Record<IndexType, string> = {
  SIMPLE: 'SIMPLE',
  BLOOM: 'BLOOM',
  BUCKET: 'BUCKET',
  GLOBAL_SIMPLE: 'GLOBAL SIMPLE',
  GLOBAL_BLOOM: 'GLOBAL BLOOM',
}

export const HIVE_PARTITIONING_LABEL: Record<HiveStylePartitioning, string> = {
  NONE: 'NONE',
  HIVE_STYLE_PARTITIONING: 'HIVE_STYLE_PARTITIONING（目录 + 字段双写）',
  STYLE_PARTITIONING_ONLY: 'STYLE_PARTITIONING_ONLY（仅目录）',
}
