import type { SqlBlock } from './types'

/**
 * Spark SQL 模板集。
 *
 * 语法来源：
 *   - 建表 / 写入 / 查询：Apache Hudi 0.15.0 社区文档（EV-COMM-CREATE-TABLE 等，E1）
 *   - run compaction / run archivelog / run clean：华为《Hudi数据表Compaction规范》（EV-HW-RUN-COMPACTION，E2）
 *   - ttl_policy_*：华为《Hudi TTL 策略》（EV-HW-TTL-POLICY，E2）
 *
 * ⚠️ 凡是只有社区文档支撑的模板一律标 unverified —— 社区 0.15 支持 ≠ 华为 r26 支持。
 */
export const SPARK_SQL_TEMPLATES: SqlBlock[] = [
  /* ------------------------------ 建表 ------------------------------ */
  {
    id: 'spark-create-table-cow',
    title: '创建 COW 表（Spark SQL）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
    code: `CREATE TABLE IF NOT EXISTS \${database}.\${table} (
  \${primaryKey}      STRING,
  \${preCombineField} BIGINT,
  name  STRING,
  amount DOUBLE
)
USING hudi
TBLPROPERTIES (
  'type' = 'cow',
  'primaryKey' = '\${primaryKey}',
  'preCombineField' = '\${preCombineField}',
  'partitionKey' = '\${partitionKey}',
  'hoodie.datasource.write.recordkey.field' = '\${primaryKey}',
  'hoodie.datasource.write.precombine.field' = '\${preCombineField}',
  'hoodie.datasource.write.partitionpath.field' = '\${partitionKey}',
  'hoodie.datasource.write.table.type' = 'COPY_ON_WRITE',
  'hoodie.datasource.write.operation' = 'upsert',
  'hoodie.datasource.write.hive_style_partitioning' = 'true',
  'hoodie.index.type' = '\${indexType}'
);`,
    note:
      'type=cow 决定后续每次写入都重写整个 parquet 文件（写放大）。' +
      '非分区表请删除 partitionKey / partitionpath.field 两项，并把分区列并入上面的列定义。' +
      'recordkey.field 与 primaryKey 必须一致，否则索引无法定位记录。',
    risks: ['社区 0.15 文档给出了该语法，r26 上的实际行为仍需实测确认。'],
  },
  {
    id: 'spark-create-table-mor',
    title: '创建 MOR 表（Spark SQL）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-MOR', 'EV-R26-ART-SPARK3'],
    code: `CREATE TABLE IF NOT EXISTS \${database}.\${table} (
  \${primaryKey}      STRING,
  \${preCombineField} BIGINT,
  name  STRING,
  amount DOUBLE
)
USING hudi
TBLPROPERTIES (
  'type' = 'mor',
  'primaryKey' = '\${primaryKey}',
  'preCombineField' = '\${preCombineField}',
  'partitionKey' = '\${partitionKey}',
  'hoodie.datasource.write.recordkey.field' = '\${primaryKey}',
  'hoodie.datasource.write.precombine.field' = '\${preCombineField}',
  'hoodie.datasource.write.partitionpath.field' = '\${partitionKey}',
  'hoodie.datasource.write.table.type' = 'MERGE_ON_READ',
  'hoodie.datasource.write.operation' = 'upsert',
  'hoodie.datasource.write.hive_style_partitioning' = 'true',
  'hoodie.index.type' = '\${indexType}'
);`,
    note:
      'type=mor 时写入以 log file 追加，直到 compaction 才会合并成 parquet base file。' +
      '因此 MOR 表的「读优化查询」在 compaction 之前看不到最新数据。',
    risks: ['MOR 首写落点在 r26 上未实测确认（本项目的教学模型见「场景规则」表）。'],
  },

  /* ------------------------------ 写入 ------------------------------ */
  {
    id: 'spark-insert',
    title: '插入记录（INSERT INTO）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
    code: `INSERT INTO \${database}.\${table} (\${columns})
SELECT \${columns}
FROM \${sourceTable};`,
    note:
      'Spark SQL 的 INSERT INTO 落到 Hudi 后由 hoodie.datasource.write.operation 决定语义：' +
      'upsert（默认）会先按主键查重，insert 不查重，bulk_insert 直接生成 base file。',
  },
  {
    id: 'spark-upsert',
    title: '更新记录（upsert）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-INDEX', 'EV-COMM-MOR'],
    code: `SET hoodie.datasource.write.operation = 'upsert';

INSERT INTO \${database}.\${table} (\${columns})
SELECT \${columns}
FROM \${sourceTable};`,
    note:
      'upsert 依赖索引定位「已存在主键」所在的文件：COW 重写整个 File Group，MOR 只追加一个 log file。' +
      '同主键多版本时由 precombine 字段决定谁胜出。',
  },
  {
    id: 'spark-bulk-insert',
    title: '批量插入（bulk_insert）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-BULK-INSERT'],
    code: `SET hoodie.datasource.write.operation = 'bulk_insert';
SET hoodie.datasource.write.bulk_insert.enable = 'true';

INSERT INTO \${database}.\${table} (\${columns})
SELECT \${columns}
FROM \${sourceTable};`,
    note:
      'bulk_insert 跳过查重与合并，直接生成 base file，适合空表初始化。' +
      'MOR 表用 bulk_insert 初始化是「一写即 parquet」的唯一路径。',
    risks: ['BUCKET 索引表与 bulk_insert 的组合限制在 r26 尚未确认，本项目按拦截处理。'],
  },
  {
    id: 'spark-insert-overwrite-partition',
    title: '覆盖分区（INSERT OVERWRITE PARTITION）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
    code: `INSERT OVERWRITE TABLE \${database}.\${table}
PARTITION (\${partitionKey} = '\${partitionValue}')
SELECT \${columns}
FROM \${sourceTable};`,
    note:
      '覆盖写会在 Timeline 上产生 replacecommit instant，被覆盖分区的旧文件在 Clean 之前仍物理存在于 HDFS。',
  },
  {
    id: 'spark-insert-overwrite-table',
    title: '覆盖整表（INSERT OVERWRITE TABLE）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
    code: `INSERT OVERWRITE TABLE \${database}.\${table}
SELECT \${columns}
FROM \${sourceTable};`,
    note: '整表覆盖会作废所有分区的 File Group，历史数据在 Clean 之前仍在 HDFS 上占空间。',
  },
  {
    id: 'spark-delete',
    title: '删除记录（DELETE FROM）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `DELETE FROM \${database}.\${table}
WHERE \${primaryKey} = '\${recordKey}';`,
    note:
      'Hudi 的删除不是「把行从文件里抹掉」，而是写入一条 operation=DELETE 的记录：' +
      'COW 重写整个 File Group，MOR 追加一个 log file。被删记录在逻辑视图里不可见，物理上要等 compaction / clean 才回收。',
  },

  /* ------------------------------ 查询 ------------------------------ */
  {
    id: 'spark-query-snapshot',
    title: '快照查询（Snapshot）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `SELECT *
FROM \${database}.\${table};`,
    note:
      '默认的快照读会合并 base file 与全部 log file，因此 MOR 表在 compaction 之前也能查到最新数据。' +
      '代价是读放大：读一个逻辑记录可能要打开多个物理文件。',
  },
  {
    id: 'spark-query-read-optimized',
    title: '读优化查询（Read Optimized）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `SET hoodie.datasource.read.optimized = true;

SELECT *
FROM \${database}.\${table};`,
    note:
      '读优化只读 base file，完全忽略 log file —— 读得快，但 MOR 表在 compaction 之前看不到仅存在于 log file 的更新。' +
      '这是「MOR 表必须及时 compaction」的根因。',
  },
  {
    id: 'spark-query-incremental',
    title: '增量查询（Incremental）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `SET hoodie.datasource.read.begin.instanttime = \${beginInstantTime};
SET hoodie.datasource.read.end.instanttime = \${endInstantTime};

SELECT *
FROM \${database}.\${table};`,
    note:
      '增量查询返回该时间窗口内**新增/更新**的记录；被删除的记录会以 operation=DELETE 的形式返回，' +
      '消费端必须自己处理删除语义，否则会漏删。',
  },
  {
    id: 'spark-query-time-travel',
    title: '时间旅行（Time Travel）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    code: `SET hoodie.datasource.read.as.of.instant = \${asOfInstant};

SELECT *
FROM \${database}.\${table};`,
    note:
      'as.of.instant 读取的是该 instant 提交完成后的快照。' +
      '它依赖 Timeline 上仍然保留该 instant —— 一旦被 Archive 并清理了历史文件，历史时刻就查不到了。',
  },
  {
    id: 'spark-show-partitions',
    title: '查看分区（写 TTL spec 的前提）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-HW-TTL-POLICY'],
    code: `SHOW PARTITIONS \${database}.\${table};`,
    note: 'TTL 策略的 spec 是用于筛选分区的正则表达式，写之前先用 SHOW PARTITIONS 看清分区目录格式。',
  },

  /* ------------------------------ 表服务 ------------------------------ */
  {
    id: 'spark-compaction-plan-only',
    title: '生成 Compaction Plan（异步模式）',
    language: 'spark-sql',
    status: 'verified',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    code: `SET hoodie.compact.inline = true;
SET hoodie.run.compact.only.inline = true;

RUN COMPACTION ON \${database}.\${table};`,
    note:
      '这是华为《Hudi数据表Compaction规范》给出的写法：run compaction on <db>.<table> 会生成 compaction plan；' +
      '配合 hoodie.run.compact.only.inline=true 时**只写计划不执行**，由独立的 Spark 作业异步执行。' +
      'Flink 侧也是同样的思路：只生成 plan，不在 Flink 作业里做 compaction。',
    prerequisites: ['表类型必须是 MOR（COW 没有 log file，无需 compaction）'],
  },
  {
    id: 'spark-compaction-inline',
    title: '同步执行 Compaction',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-HW-RUN-COMPACTION', 'EV-COMM-MOR'],
    code: `SET hoodie.compact.inline = true;
SET hoodie.run.compact.only.inline = false;

RUN COMPACTION ON \${database}.\${table};`,
    note:
      'hoodie.run.compact.only.inline=false 时，本次 run compaction 会同步把 log file 合并成新的 parquet base file。' +
      '同步 compaction 会让写入作业变慢，生产上通常改为「只生成计划 + 独立作业异步执行」。',
    risks: ['华为文档给出的示例组合是 only.inline=true（只生成计划），false 的同步执行语义来自社区 0.15，r26 未实测。'],
  },
  {
    id: 'spark-clean',
    title: '执行 Clean（物理删除旧文件）',
    language: 'spark-sql',
    status: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    code: `RUN CLEAN ON \${database}.\${table};`,
    note:
      'Clean 负责真正把被取代的旧文件从 HDFS 上删掉。' +
      '它与 compaction 是两件事：compaction 产生新 base file，clean 才回收旧文件的空间。',
    prerequisites: [
      'MRS 3.2.0 及之后版本',
      'MRS 3.1.x（含目标版本 MRS 3.1.0-350-r26）没有该存储过程，请改用 hoodie.clean.automatic=true 方式自动清理',
    ],
    risks: [
      '在 3.1.0-350-r26 上直接执行该存储过程可能报「存储过程不存在」；目标版本的可用性需实测确认。',
    ],
  },
  {
    id: 'spark-clean-automatic-3-1',
    title: '开启自动清理（MRS 3.1.x 方式）',
    language: 'spark-sql',
    status: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    code: `SET hoodie.clean.automatic = true;
SET hoodie.clean.async = true;
SET hoodie.cleaner.commits.retained = 500;`,
    note:
      '这是目标版本 MRS 3.1.0-350-r26 上推荐的清理方式：' +
      '开启 hoodie.clean.automatic 后，Hudi 会在写入后自动清理不再被引用的旧文件；' +
      'commits.retained=500 决定保留多少次提交之前的历史（保留窗口内的文件不会被删，保证时间旅行仍可查）。',
    prerequisites: ['MRS 3.1.x（MRS 3.1.0-350-r26）；MRS 3.2.0+ 可直接使用 RUN CLEAN 存储过程'],
  },
  {
    id: 'spark-archive',
    title: '执行 Archive（归档旧 instant）',
    language: 'spark-sql',
    status: 'verified',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    code: `RUN ARCHIVELOG ON \${database}.\${table};`,
    note:
      'Archive 把较早的 instant 从活跃 Timeline 移到 .hoodie/archive/ 下，避免 Timeline 无限膨胀。' +
      '它只移动元数据文件，不触碰数据文件。',
  },
  {
    id: 'spark-clustering',
    title: '执行 Clustering（合并小文件）',
    language: 'spark-sql',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-COMMON', 'EV-COMM-MOR'],
    code: `CALL run_clustering(table => '\${database}.\${table}', orderby => '\${preCombineField}', predicate => '');`,
    note:
      'Clustering 重写分区内的小文件，把它们合并成接近目标大小的大文件，解决读放大与元数据膨胀。' +
      '它不改变数据内容，只改变物理布局。',
    risks: [
      'r26 侧 run_clustering 存储过程的参数签名（含 orderby / predicate）需实测确认；' +
        '文档仅覆盖 run compaction / run archivelog / run clean。',
    ],
  },

  /* ------------------------------ TTL ------------------------------ */
  {
    id: 'spark-ttl-save',
    title: '保存 TTL 策略',
    language: 'spark-sql',
    status: 'verified',
    evidenceIds: ['EV-HW-TTL-POLICY'],
    code: `CALL ttl_policy_save(table => '\${database}.\${table}', spec => '\${ttlSpec}', level => 'PARTITION', value => '\${ttlValue}', units => '\${ttlUnits}');`,
    note:
      '华为《Hudi TTL 策略》文档给出的语法。spec 是匹配分区的正则表达式，' +
      'value 与 units 必须同时提供，level 当前**仅支持 PARTITION**（RECORD 级在 r26 不可用）。',
    prerequisites: ['level 只能取 PARTITION'],
  },
  {
    id: 'spark-ttl-show',
    title: '查看 TTL 策略',
    language: 'spark-sql',
    status: 'verified',
    evidenceIds: ['EV-HW-TTL-POLICY'],
    code: `CALL ttl_policy_show(table => '\${database}.\${table}');`,
    note: '查看当前表上生效的所有 TTL 策略。',
  },
  {
    id: 'spark-ttl-delete',
    title: '删除单条 TTL 策略',
    language: 'spark-sql',
    status: 'verified',
    evidenceIds: ['EV-HW-TTL-POLICY'],
    code: `CALL ttl_policy_delete(
  table => '\${database}.\${table}',
  spec  => '\${ttlSpec}'
);`,
    note: '按 spec 精确删除一条策略。',
  },
  {
    id: 'spark-ttl-empty',
    title: '清空 TTL 策略',
    language: 'spark-sql',
    status: 'verified',
    evidenceIds: ['EV-HW-TTL-POLICY'],
    code: `CALL ttl_policy_empty(table => '\${database}.\${table}');`,
    note: '清空该表上的全部 TTL 策略。',
  },
]
