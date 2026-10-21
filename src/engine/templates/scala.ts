import type { SqlBlock } from './types'

/**
 * Scala DataFrame API 模板集。
 *
 * DataFrame API 是 Spark SQL 底下的那层：Spark SQL 的 INSERT/DELETE 最终都落到
 * DataFrameWriter / DataFrameReader 的选项上，因此排查「为什么行为不对」时
 * 经常要回到这一层看 option 的实际取值。
 */
export const SCALA_TEMPLATES: SqlBlock[] = [
  {
    id: 'scala-df-write-upsert',
    title: 'DataFrame 写入 Hudi（upsert）',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-SPARK-CLIENT', 'EV-COMM-INDEX'],
    code: `val df = spark.read.format("hudi").load("/user/hive/warehouse/hudi_demo.db/source_table")

df.write
  .format("hudi")
  .option("hoodie.datasource.write.table.type", "COPY_ON_WRITE")
  .option("hoodie.datasource.write.recordkey.field", "\${primaryKey}")
  .option("hoodie.datasource.write.precombine.field", "\${preCombineField}")
  .option("hoodie.datasource.write.partitionpath.field", "\${partitionKey}")
  .option("hoodie.datasource.write.operation", "upsert")
  .option("hoodie.index.type", "\${indexType}")
  .mode(SaveMode.Append)
  .save("\${tablePath}")`,
    note:
      '每个 .option 都会落到 Spark SQL 的同名 TBLPROPERTIES / SET 上。' +
      '注意：option 的名字必须和 r26 的 configMapping 一致，写错不会报错，只会静默失效。',
  },
  {
    id: 'scala-df-write-bulk-insert',
    title: 'DataFrame 写入 Hudi（bulk_insert）',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-COMM-BULK-INSERT', 'EV-R26-ART-SPARK-CLIENT'],
    code: `df.write
  .format("hudi")
  .option("hoodie.datasource.write.table.type", "MERGE_ON_READ")
  .option("hoodie.datasource.write.recordkey.field", "\${primaryKey}")
  .option("hoodie.datasource.write.precombine.field", "\${preCombineField}")
  .option("hoodie.datasource.write.bulk_insert.enable", "true")
  .option("hoodie.datasource.write.operation", "bulk_insert")
  .mode(SaveMode.Append)
  .save("\${tablePath}")`,
    note:
      'bulk_insert 跳过查重与合并，直接生成 base file。' +
      'MOR 表用 bulk_insert 初始化是唯一「一写即 parquet」的路径。',
    risks: ['BUCKET 索引表与 bulk_insert 的组合限制在 r26 尚未确认。'],
  },
  {
    id: 'scala-df-read-snapshot',
    title: 'DataFrame 快照读',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `val snapshot = spark.read
  .format("hudi")
  .load("\${tablePath}")

snapshot.show(10, false)`,
    note: '默认行为：合并 base file 与全部 log file 的快照读。',
  },
  {
    id: 'scala-df-read-optimized',
    title: 'DataFrame 读优化读',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `val readOptimized = spark.read
  .format("hudi")
  .option("hoodie.datasource.read.optimized", "true")
  .load("\${tablePath}")

readOptimized.show(10, false)`,
    note:
      '只读 base file，忽略 log file。MOR 表在 compaction 之前，最新更新在这里是看不到的 —— ' +
      '这是「MOR 表不及时 compaction 会丢数据」的根因。',
  },
  {
    id: 'scala-df-read-incremental',
    title: 'DataFrame 增量读',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `val incremental = spark.read
  .format("hudi")
  .option("hoodie.datasource.read.begin.instanttime", "\${beginInstantTime}")
  .option("hoodie.datasource.read.end.instanttime", "\${endInstantTime}")
  .load("\${tablePath}")

incremental.show(10, false)`,
    note:
      '增量读返回窗口内新增/更新的记录，被删除的记录以 operation=DELETE 的形式返回。' +
      '消费端必须处理删除语义，否则会漏删。',
  },
  {
    id: 'scala-df-read-time-travel',
    title: 'DataFrame 时间旅行读',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `val asOf = spark.read
  .format("hudi")
  .option("hoodie.datasource.read.as.of.instant", "\${asOfInstant}")
  .load("\${tablePath}")

asOf.show(10, false)`,
    note: '读取 as.of.instant 提交完成后的快照；该 instant 被归档并清理历史后即不可用。',
  },
  {
    id: 'scala-metaclient-rollback',
    title: '回滚未完成的事务（MetaClient API）',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-COMMON'],
    code: `import org.apache.hudi.common.table.HoodieTableMetaClient
import org.apache.hudi.common.config.HoodieConfig

val hadoopConf = spark.sparkContext.hadoopConfiguration
val metaClient = HoodieTableMetaClient
  .builder()
  .setConf(hadoopConf)
  .setBasePath("\${tablePath}")
  .build()

// 回滚指定的未完成 instant（partial = true 表示只回滚该 instant 的文件）
metaClient.rollback("\${beginInstantTime}", true)`,
    note:
      'Rollback 只能处理**未完成**的事务：已提交的 instant 要用 restore / 时间旅行回看，不能 rollback。' +
      'Spark SQL 没有 rollback 存储过程，只能走 Scala API 或 hoodie-cli。',
    risks: [
      'r26 侧 HoodieTableMetaClient.rollback 的方法签名需以 r26 源码确认；' +
        '本项目的 rollback 实验以 hoodie-cli 方式为准（见 shell 模板）。',
    ],
  },
  {
    id: 'scala-metaclient-list-instants',
    title: '查看 Timeline（MetaClient API）',
    language: 'scala',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-COMMON'],
    code: `import org.apache.hudi.common.table.HoodieTableMetaClient

val metaClient = HoodieTableMetaClient
  .builder()
  .setConf(spark.sparkContext.hadoopConfiguration)
  .setBasePath("\${tablePath}")
  .build()

// 活跃 Timeline：判断 compaction 成败就看这里有没有 state=COMPLETED 的 compaction instant
metaClient.getActiveTimeline
  .getInstants()
  .forEach(i => println(i.getTimestamp + "  " + i.getAction + "  " + i.getState))`,
    note:
      '排查 compaction 问题的第一站：不要看 YARN 状态，要看 Timeline 上有没有 completed 的 compaction instant。' +
      'YARN 显示 SUCCEEDED 但 Hudi 事务未提交的情况真实存在。',
  },
]
