import type { SqlBlock } from './types'

/**
 * Flink SQL 模板集。
 *
 * 目标平台是 MRS 上的 Flink 1.17.x + hudi-flink1.17-bundle。
 * 与 Spark 侧最大的差别：**Flink 侧只生成 compaction plan，由独立 Spark 作业异步执行**，
 * 相关的 Flink 参数在华为《Hudi数据表Compaction规范》中有明确列举。
 */
export const FLINK_SQL_TEMPLATES: SqlBlock[] = [
  {
    id: 'flink-create-table',
    title: '创建 Hudi 表（Flink SQL）',
    language: 'flink-sql',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-FLINK17', 'EV-COMM-CREATE-TABLE'],
    code: `CREATE TABLE IF NOT EXISTS \${database}.\${table} (
  \${primaryKey}      STRING,
  \${preCombineField} BIGINT,
  name  STRING,
  amount DOUBLE,
  PRIMARY KEY (\${primaryKey}) NOT ENFORCED
) WITH (
  'connector' = 'hudi',
  'path' = '\${tablePath}',
  'hoodie.datasource.write.recordkey.field' = '\${primaryKey}',
  'hoodie.datasource.write.precombine.field' = '\${preCombineField}',
  'hoodie.datasource.write.partitionpath.field' = '\${partitionKey}',
  'hoodie.datasource.write.table.type' = '\${tableType}',
  'hoodie.datasource.write.operation' = 'upsert',
  'hoodie.datasource.write.hive_style_partitioning' = 'true'
);`,
    note:
      'Flink 侧用 connector= hudi 的建表语法。PRIMARY KEY NOT ENFORCED 表示主键由 Hudi 自己保证，' +
      'Flink 不会在运行时校验。',
    risks: ['r26 的 hudi-flink1.17-bundle 存在（E3 制品证据），但上述选项在 r26 上的实际行为仍需实测。'],
  },
  {
    id: 'flink-insert',
    title: '写入 Hudi 表（Flink SQL）',
    language: 'flink-sql',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-FLINK17', 'EV-COMM-MOR'],
    code: `INSERT INTO \${database}.\${table}
SELECT \${columns}
FROM \${sourceTable};`,
    note:
      'Flink 的持续写入以 log file 形式追加到 File Slice，' +
      '因此 Flink 写入的 MOR 表在 compaction 之前，「读优化查询」看不到最新数据。',
  },
  {
    id: 'flink-compaction-config',
    title: 'Flink 侧 Compaction 参数（只生成 plan）',
    language: 'flink-sql',
    status: 'verified',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    code: `SET 'compaction.async.enabled' = 'false';
SET 'compaction.schedule.enabled' = 'true';
SET 'compaction.delta_commits' = '5';
SET 'clean.async.enabled' = 'false';
SET 'hoodie.archive.automatic' = 'false';`,
    note:
      '这组参数是华为《Hudi数据表Compaction规范》明确推荐的 Flink 侧配置：' +
      '关闭 compaction 异步执行、开启 compaction 调度、累积 5 个 delta commit 后触发一次计划，' +
      '并关闭 Flink 侧的 clean 与 archive。' +
      '目的只有一个：让 Flink 作业只负责「生成 compaction plan」，真正的合并交给独立 Spark 作业异步做。',
    prerequisites: [
      '需关闭 Flink 侧 compaction.async.enabled，开启 compaction.schedule.enabled',
      '需要独立的 Spark 作业消费 plan 并执行 compaction',
    ],
  },
  {
    id: 'flink-compaction-plan-only',
    title: 'Flink 侧只生成 Compaction Plan',
    language: 'flink-sql',
    status: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    code: `-- Flink 作业侧：只生成 plan，不执行 compaction
SET 'compaction.async.enabled' = 'false';
SET 'compaction.schedule.enabled' = 'true';
SET 'compaction.delta_commits' = '5';

-- 之后的合并由独立 Spark 作业执行：
--   SET hoodie.compact.inline = true;
--   SET hoodie.run.compact.only.inline = true;
--   RUN COMPACTION ON \${database}.\${table};`,
    note:
      'Flink 侧不执行 compaction，只把「哪些 File Group 需要合并」写进 plan 文件；' +
      '独立 Spark 作业再消费 plan 完成合并。' +
      '这样 Flink 作业的 checkpoint 与延迟不会被 compaction 拖垮。',
    prerequisites: ['已按「Flink 侧 Compaction 参数」设置好 Flink 参数', '已部署独立的 Spark compaction 作业'],
  },
  {
    id: 'flink-query',
    title: '查询 Hudi 表（Flink SQL）',
    language: 'flink-sql',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-FLINK17', 'EV-COMM-MOR'],
    code: `SELECT *
FROM \${database}.\${table};`,
    note: 'Flink SQL 读 Hudi 默认是快照读，合并 base file 与 log file。',
  },
]
