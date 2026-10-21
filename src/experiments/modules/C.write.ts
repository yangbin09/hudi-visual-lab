import type { CatalogEntry } from '../catalog'

/**
 * 模块 C —— 数据写入（10 条）。
 *
 * 目标：把每一种写入方式落到「哪些物理文件变了、Timeline 上多了哪个 instant」上，
 * 而不是停留在 SQL 语法层面。
 */
export const MODULE_C_ENTRIES: CatalogEntry[] = [
  {
    id: 'W01',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['insert', '插入'],
    moduleId: 'C',
    title: 'Insert 写入全过程',
    summary:
      '跟踪一次 INSERT INTO 从写出数据文件、落到 File Group、到提交 commit instant 的全过程，讲清每次写入都在 Timeline 上留下什么。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-MOR'],
  },
  {
    id: 'W02',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['upsert', '更新'],
    moduleId: 'C',
    title: 'Upsert 更新全过程',
    summary:
      '讲清 upsert 如何先按主键定位到已有 File Group：COW 重写整个 File Group，MOR 只追加一个 log file，两者的写放大差距一目了然。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-INDEX', 'EV-COMM-MOR'],
  },
  {
    id: 'W03',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['delete', '删除', 'tombstone'],
    moduleId: 'C',
    title: 'Delete 删除全过程',
    summary:
      '讲清 Hudi 的删除不是「把行从文件里抹掉」，而是写入一条 operation=DELETE 的记录，以及被删记录在 Compaction / Clean 之后才真正回收。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'W04',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['bulk insert', '初始化'],
    moduleId: 'C',
    title: 'Bulk Insert 数据初始化',
    summary:
      '用 bulk_insert 演示「跳过查重与合并、直接生成 Base File」的写入路径，讲清它为什么是 MOR 表唯一的「一写即 parquet」路径。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-BULK-INSERT'],
  },
  {
    id: 'W05',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['insert overwrite', '分区覆盖'],
    moduleId: 'C',
    title: 'Insert Overwrite 分区覆盖',
    summary:
      '演示只覆盖单个分区时的文件与 Timeline 变化，讲清 replacecommit instant 的作用，以及被覆盖分区的旧文件在 Clean 之前仍然占用 HDFS 空间。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-MOR'],
  },
  {
    id: 'W06',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['overwrite table', '整表覆盖'],
    moduleId: 'C',
    title: 'Insert Overwrite Table 整表覆盖',
    summary:
      '演示整表覆盖如何作废所有分区的 File Group，讲清它与分区覆盖在代价与恢复难度上的差别。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-MOR'],
  },
  {
    id: 'W07',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['savemode', 'append', 'overwrite'],
    moduleId: 'C',
    title: 'DataFrame SaveMode 四种模式',
    summary:
      '对比 DataFrameWriter 的 Append / Overwrite / ErrorIfExists / Ignore 四种 SaveMode，讲清它们与 Hudi 自身的 write.operation 语义如何叠加。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'W08',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['precombine', '主键冲突', '多版本'],
    moduleId: 'C',
    title: 'Precombine 与相同主键冲突处理',
    summary:
      '用同一主键的多版本数据演示 precombine 字段如何决定胜出者，讲清 precombine 字段选错会导致「旧数据覆盖新数据」的典型故障。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'W09',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['spark sql', 'dataframe'],
    moduleId: 'C',
    title: 'Spark SQL 与 DataFrame 写入差异',
    summary:
      '对比 INSERT INTO 与 DataFrameWriter 两条写入路径在 SaveMode、operation、分区推断上的差别，讲清什么时候必须显式指定 operation。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK-CLIENT'],
  },
  {
    id: 'W10',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['幂等', '重复写入'],
    moduleId: 'C',
    title: '重复写入、错误配置与幂等性分析',
    summary:
      '重复执行同一条写入语句并观察 Timeline 与文件的变化，讲清「重跑不一定幂等」的原因：幂等性取决于 operation、索引与并发控制三者的组合。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-INDEX', 'EV-COMM-CREATE-TABLE'],
    note: '重跑是否产生重复数据取决于并发控制（OCC）行为，r26 上的实际表现需实测确认。',
  },
]
