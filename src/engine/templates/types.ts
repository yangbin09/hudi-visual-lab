/**
 * SQL 模板引擎的类型定义。
 *
 * 设计取舍：**不实现完整 SQL Parser**。
 * 本项目的目标是「把华为 r26 的真实用法讲清楚」，
 * 因此采用「参数化模板 + 操作定义 + 版本规则」的方式：
 *   - 模板正文是**逐字对齐 r26 / 社区 0.15 文档**的真实命令；
 *   - `${var}` 占位符由 TemplateContext 填充，方便 UI 把模板套到当前实验的表上；
 *   - status 如实反映证据强度，绝不因为「模板看起来对」就标成已验证。
 */

/** 模板语言 */
export type SqlLanguage = 'spark-sql' | 'flink-sql' | 'scala' | 'shell'

/**
 * 模板状态
 *   verified   —— 有 E2（华为文档）/ E3（r26 制品）证据直接支撑
 *   conditional—— 有证据但存在版本或环境前提（例如 run clean 仅 MRS 3.2.0+）
 *   unverified —— 只有社区文档（E1）或纯工程常识，r26 未确认
 */
export type SqlStatus = 'verified' | 'unverified' | 'conditional'

/** 一段可展示的代码块 */
export interface SqlBlock {
  id: string
  title: string
  language: SqlLanguage
  code: string
  /** 补充说明：为什么这么写 / 注意事项 */
  note?: string
  status: SqlStatus
  /** 关联证据 id（必须来自 src/evidence 中已存在的条目） */
  evidenceIds?: string[]
  /** 前置条件（status=conditional 时必填） */
  prerequisites?: string[]
  /** 风险提示 */
  risks?: string[]
}

/**
 * 模板变量。
 * 模板正文里的 `${name}` 一一对应这里的字段。
 */
export interface TemplateContext {
  /** 数据库名 */
  database: string
  /** 表名 */
  table: string
  /** 全限定表名 db.table */
  qualifiedTable: string
  /** 表在 HDFS 上的路径 */
  tablePath: string
  /** 表类型：cow / mor */
  tableType: string
  /** 主键字段名 */
  primaryKey: string
  /** precombine 字段名 */
  preCombineField: string
  /** 分区字段（逗号分隔，无分区时为空串） */
  partitionFields: string
  /** 首个分区字段名（模板里用它做 partitionKey） */
  partitionKey: string
  /** 示例分区值 */
  partitionValue: string
  /** 索引类型 */
  indexType: string
  /** 业务列清单（逗号分隔） */
  columns: string
  /** 数据来源表（写入模板用） */
  sourceTable: string
  /** 示例主键值 */
  recordKey: string
  /** 示例记录数 */
  recordCount: string
  /** 增量查询起始 instant */
  beginInstantTime: string
  /** 增量查询结束 instant */
  endInstantTime: string
  /** 时间旅行目标 instant */
  asOfInstant: string
  /** TTL 策略匹配的正则 */
  ttlSpec: string
  /** TTL 保留数量 */
  ttlValue: string
  /** TTL 时间单位 */
  ttlUnits: string
  /** TTL 级别（r26 仅支持 PARTITION） */
  ttlLevel: string
  /** keytab 路径 */
  keytabPath: string
  /** Kerberos principal */
  principal: string
  /** 提交作业用的 jar 路径 */
  jarPath: string
  /** Spark executor cores */
  executorCores: string
  /** Spark executor memory */
  executorMemory: string
  /** Spark executor instances */
  executorInstances: string
  /** SQL 文件路径 */
  sqlFilePath: string
  /** 日志级别 */
  logLevel: string
}

/** 模板变量的默认值 */
export const DEFAULT_TEMPLATE_CONTEXT: TemplateContext = {
  database: 'hudi_demo',
  table: 'hudi_ro_t1',
  qualifiedTable: 'hudi_demo.hudi_ro_t1',
  tablePath: '/user/hive/warehouse/hudi_demo.db/hudi_ro_t1',
  tableType: 'cow',
  primaryKey: 'id',
  preCombineField: 'ts',
  partitionFields: 'dt',
  partitionKey: 'dt',
  partitionValue: '2024-01-01',
  indexType: 'BLOOM',
  columns: 'id, ts, name, amount',
  sourceTable: 'hudi_demo.source_table',
  recordKey: '1001',
  recordCount: '1000',
  beginInstantTime: '20240101120000',
  endInstantTime: '20240101130000',
  asOfInstant: '20240101120000',
  ttlSpec: 'dt=2024/01/.*',
  ttlValue: '30',
  ttlUnits: 'DAYS',
  ttlLevel: 'PARTITION',
  keytabPath: '/opt/hudi/conf/hudi_user.keytab',
  principal: 'hudi_user@HADOOP.COM',
  jarPath: '/opt/hudi/jars/hudi-spark3-bundle_2.12-0.15.0-h0.cbu.mrs.350.r26.jar',
  executorCores: '2',
  executorMemory: '8g',
  executorInstances: '2',
  sqlFilePath: '/opt/hudi/sql/compaction_plan.sql',
  logLevel: 'INFO',
}

/** 用局部覆盖生成一份模板变量 */
export function createTemplateContext(overrides: Partial<TemplateContext> = {}): TemplateContext {
  return { ...DEFAULT_TEMPLATE_CONTEXT, ...overrides }
}

/** 模板状态的中文标签（供 UI 直接使用） */
export const SQL_STATUS_LABEL: Record<SqlStatus, string> = {
  verified: 'r26 文档已确认',
  conditional: '有条件支持',
  unverified: '待验证',
}
