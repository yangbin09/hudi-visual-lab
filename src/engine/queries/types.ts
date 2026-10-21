/**
 * 查询引擎的类型定义。
 *
 * 四种查询模式对应 Hudi 的四种读路径：
 *   snapshot      —— 合并 base + log 的快照读（默认，最完整也最贵）
 *   read-optimized—— 只读 base file，忽略 log file（最快，但可能读不到最新数据）
 *   incremental   —— 指定 instant 窗口内的新增/更新
 *   time-travel   —— 读某个历史 instant 时刻的快照
 */

/** 查询模式 */
export type QueryMode = 'snapshot' | 'read-optimized' | 'incremental' | 'time-travel'

/** 查询请求 */
export interface QueryRequest {
  mode: QueryMode
  /** 增量查询：起始 instant（含） */
  beginInstantTime?: string
  /** 增量查询：结束 instant（含） */
  endInstantTime?: string
  /** 时间旅行：目标 instant */
  asOfInstant?: string
  /** 是否附带 _hoodie_* 元字段 */
  includeMetaFields?: boolean
  /** 最多返回多少行（不填表示不限） */
  limit?: number
}

/** 查询结果 */
export interface QueryResult {
  mode: QueryMode
  /** 结果列：业务字段在前，_hoodie_* 元字段在后 */
  columns: string[]
  /** 结果行 */
  rows: Record<string, unknown>[]
  /** 返回的行数 */
  rowCount: number
  /** 注意事项（例如被忽略的 log file 记录数） */
  notes: string[]
  /** 本次查询做了什么（供 UI 直接展示） */
  explanation: string
}

/** _hoodie_* 元字段名 */
export const META_FIELDS = {
  recordKey: '_hoodie_record_key',
  partitionPath: '_hoodie_partition_path',
  operation: '_hoodie_operation',
  commitTime: '_hoodie_commit_time',
  commitSeqNo: '_hoodie_commit_seq_no',
} as const

/** 全部元字段名 */
export const META_FIELD_NAMES: string[] = Object.values(META_FIELDS)

/** 查询模式的中文标签 */
export const QUERY_MODE_LABEL: Record<QueryMode, string> = {
  snapshot: '快照读（Snapshot）',
  'read-optimized': '读优化（Read Optimized）',
  incremental: '增量读（Incremental）',
  'time-travel': '时间旅行（Time Travel）',
}
