import type { CatalogEntry } from '../catalog'

/**
 * 模块 B —— 建表与分区（8 条）。
 *
 * 目标：把「怎么把表建对」讲清楚。Hudi 的大部分线上事故，
 * 根因都落在建表这一步的配置错误上，而不是运行时。
 */
export const MODULE_B_ENTRIES: CatalogEntry[] = [
  {
    id: 'T01',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['建表', 'create table', 'cow', 'mor'],
    moduleId: 'B',
    title: '华为 Spark SQL 创建 COW / MOR 表',
    summary:
      '用 Spark SQL 的 CREATE TABLE ... USING hudi + TBLPROPERTIES 建出 COW 与 MOR 两张表，讲清 type / primaryKey / partitionKey 等属性如何落进 .hoodie/hoodie.properties。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
    note: '建表语法为社区 0.15 语义（E1）；r26 侧仅确认 hudi-spark3.3.x_2.12 制品在位（组件级）。',
  },
  {
    id: 'T02',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['主键', 'precombine', '预合并'],
    moduleId: 'B',
    title: 'Hudi 主键与 Precombine 配置',
    summary:
      '讲清 recordkey.field 与 precombine.field 的语义差别：前者决定「这条记录是谁」，后者决定「同一个人的多个版本谁胜出」，以及两者配错的典型后果。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'T03',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['分区', '多级分区', 'partition'],
    moduleId: 'B',
    title: 'Hudi 单分区与多级分区',
    summary:
      '对比单层分区与多层分区的目录结构、分区过滤行为与 File Group 分布，讲清分区路径如何由分区字段值拼出。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'T04',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['默认分区', 'null 分区', '异常分区'],
    moduleId: 'B',
    title: '默认分区、Null 分区与异常分区值',
    summary:
      '复现空分区值被落到默认分区、以及非法分区字符被清洗的行为，讲清 Hudi 的分区值清洗规则与由此产生的跨分区问题。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'T05',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['hive style', '分区列', 'partitioning'],
    moduleId: 'B',
    title: 'Hive Style Partitioning',
    summary:
      '对比 NONE / HIVE_STYLE_PARTITIONING / STYLE_PARTITIONING_ONLY 三种配置下分区列的存储方式，讲清「目录 + 字段双写」与「仅写目录」对下游读取的影响。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'T06',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['hms', 'hive metastore', 'hive sync'],
    moduleId: 'B',
    title: 'Hive Metastore 同步与分区元数据',
    summary:
      '讲清 Hudi 表的数据在 HDFS、元数据在 Hive Metastore 的分工，以及用 hudi-hive-sync-bundle 同步后 HMS 才能识别分区并供下游引擎使用。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-R26-ART-HIVESYNC', 'EV-COMM-CREATE-TABLE'],
    note: 'r26 制品层面确认 hudi-hive-sync-bundle 在位；同步工具的入口类名与参数需以 r26 实际发行包确认。',
  },
  {
    id: 'T07',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['hoodie.properties', '表配置'],
    moduleId: 'B',
    title: 'Hudi 表配置与 .hoodie/hoodie.properties',
    summary:
      '逐项解读 hoodie.properties 里的表级配置，讲清哪些配置在建表后可以改、哪些改动会破坏历史文件与索引的一致性。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'T08',
    difficulty: 'L1',
    minutes: 4,
    aliases: ['schema 演进', '加列', '删列'],
    moduleId: 'B',
    title: '建表、写入与 Schema 演进限制',
    summary:
      '讲清新增列、删除列、修改列类型三类 Schema 演进在 Hudi 0.15 下的约束边界，以及 hoodie.schema.on.read 的适用场景。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
    note: 'Schema 演进的具体限制以社区 0.15 为准，r26 上的实际行为与报错信息需实测确认。',
  },
]
