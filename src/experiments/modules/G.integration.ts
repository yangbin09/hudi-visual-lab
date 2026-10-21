import type { CatalogEntry } from '../catalog'

/**
 * 模块 G —— Spark / Flink 集成（8 条）。
 *
 * ⚠️ 证据口径：
 *   - Spark / Flink 侧的建表与写入语法为社区 0.15 语义（E1），
 *     r26 只在**制品坐标**层面确认 hudi-spark3.3.x_2.12 / hudi-flink1.17-bundle 在位。
 *   - Flink 只生成 Compaction Plan、由 Spark 异步执行这一分工有华为文档直接支撑（E2）。
 *   - Kerberos / HDFS / HMS 权限链路细节在 r26 未确认（E0）。
 */
export const MODULE_G_ENTRIES: CatalogEntry[] = [
  {
    id: 'F01',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['spark sql', '建表写入'],
    moduleId: 'G',
    title: 'Spark SQL 创建与写入 Hudi',
    summary:
      '把建表、写入、查询三段 Spark SQL 串成一条完整链路，讲清 TBLPROPERTIES 里的表类型与主键配置如何影响随后的每一次写入。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
  },
  {
    id: 'F02',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['scala', 'dataframe'],
    moduleId: 'G',
    title: 'Scala DataFrame Writer',
    summary:
      '用 DataFrameWriter API 完成一次带分区条件的写入，讲清它比 Spark SQL 多出来的 SaveMode、prepartition 与 repartition 控制手段。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-R26-ART-SPARK-CLIENT', 'EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'F03',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['flink', '实时写入'],
    moduleId: 'G',
    title: 'Flink SQL 实时写入',
    summary:
      '用 Flink SQL 的 connector=hudi 建表并持续写入，讲清 Flink 侧的写入以 log file 追加到 File Slice，以及 checkpoint 与 Hudi 提交的配合。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-R26-ART-FLINK17', 'EV-COMM-MOR'],
  },
  {
    id: 'F04',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['checkpoint', 'flink 提交'],
    moduleId: 'G',
    title: 'Flink Checkpoint 与 Hudi 提交',
    summary:
      '讲清 Flink 的 checkpoint 边界如何与 Hudi instant 的提交点对齐，以及「Hudi 已提交但 checkpoint 未成功」时数据会被重放一次的后果。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-MOR', 'EV-R26-ART-FLINK17'],
    note: '对齐语义为社区 0.15 行为；r26 上 Flink 1.17 connector 的具体提交点需实测确认。',
  },
  {
    id: 'F05',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['flink compaction', '异步'],
    moduleId: 'G',
    title: 'Flink 写入与 Spark 异步 Compaction',
    summary:
      '按华为规范配置 Flink 侧 compaction.async.enabled=false、compaction.schedule.enabled=true，讲清 Flink 只生成 Plan、合并交给独立 Spark 作业的分工。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'supported',
    evidenceIds: ['EV-HW-RUN-COMPACTION', 'EV-R26-ART-FLINK17'],
  },
  {
    id: 'F06',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['并行度', 'bucket'],
    moduleId: 'G',
    title: 'Flink 并行度与 Bucket 分配',
    summary:
      '调整 Flink 并行度观察写入产出的 File Group 数量，讲清并行度与桶数不匹配时，同一个桶被多个并发写者争抢会引发什么问题。',
    implemented: false,
    evidenceLevel: 'E0',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX', 'EV-R26-ART-FLINK17'],
    note: 'Flink 并行度与 BUCKET 索引的交互在社区文档中无对应说明，r26 也未确认，属待研究场景（E0）。',
  },
  {
    id: 'F07',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['kerberos', '权限', 'keytab'],
    moduleId: 'G',
    title: 'Kerberos、HDFS、HMS 权限链路',
    summary:
      '梳理作业提交前必须打通的认证链路：keytab 登录 → HDFS 目录读写权限 → Hive Metastore 建表权限，讲清断在哪一环会表现为什么样的报错。',
    implemented: false,
    evidenceLevel: 'E0',
    supportState: 'unverified',
    evidenceIds: ['EV-HW-KERBEROS'],
    note: 'r26 环境下的 keytab / principal / 目录权限 / HMS 库表权限配置项尚未收集到现场记录，该证据本身为 E0。',
  },
  {
    id: 'F08',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['spark flink 兼容'],
    moduleId: 'G',
    title: 'Hudi 表的 Spark / Flink 兼容性',
    summary:
      '对比 Spark 与 Flink 对同一张表的建表参数、写入模式与查询语义，讲清「同一份数据、两个引擎」时最容易踩到的配置差异。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-R26-ART-SPARK3', 'EV-R26-ART-FLINK17', 'EV-COMM-CREATE-TABLE'],
    note: '社区 0.15 两侧均支持；r26 上跨引擎读写同一张表的兼容性需实测确认。',
  },
]
