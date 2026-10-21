import type { CatalogEntry } from '../catalog'

/**
 * 模块 A —— 基础原理（8 条）。
 *
 * 目标：把 Hudi 的「存储单元 + 元数据链」这两件事讲透，
 * 让学习者在看任何 SQL 之前，先知道一次写入会在磁盘和 Timeline 上留下什么。
 */
export const MODULE_A_ENTRIES: CatalogEntry[] = [
  {
    id: 'B01',
    moduleId: 'A',
    title: 'Hudi 与 Hive 普通 Parquet 表的区别',
    summary:
      '用同一份数据对比「Hudi 表的增量提交 + 快照读」与「Hive 普通 Parquet 表的整表覆盖」，讲清 Hudi 在数据文件之外多出来的那条 Timeline。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-MOR'],
  },
  {
    id: 'B02',
    moduleId: 'A',
    title: 'COW 表的数据写入与文件重写',
    summary:
      '一步步向同一分区写入与更新，观察 COW 如何把整个 File Group 重写成新的 parquet 文件，以及旧文件在 Clean 之前为什么还留在 HDFS 上。',
    implemented: true,
    experimentId: 'B02',
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-MOR'],
    note: '社区 0.15 文档给出 COW / MOR 的表类型与写入语义；r26 上的实际文件落点仍需实测校正。',
  },
  {
    id: 'B03',
    moduleId: 'A',
    title: 'MOR 表的数据写入与 Log 合并',
    summary:
      '观察 MOR 把更新写成 Log File 追加进 File Slice，直到一次 Compaction 才把 log 合并回新的 Base File，解释「读优化查询在此之前看不到新数据」的根因。',
    implemented: true,
    experimentId: 'B02',
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-MOR'],
    note: 'MOR 首写是产生 log-only File Slice 还是直接产生 base file，属于 r26 未确认细节，界面须标待验证。',
  },
  {
    id: 'B04',
    moduleId: 'A',
    title: 'File Group、File ID、File Slice 结构',
    summary:
      '把散落的物理文件按 File Group 重新聚合，讲清 File ID 作为稳定标识的作用，以及 File Slice = Base File + 若干 Log File 的结构。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR', 'EV-R26-ART-COMMON'],
  },
  {
    id: 'B05',
    moduleId: 'A',
    title: 'Base File 与 Log File 的版本关系',
    summary:
      '用 log 文件的 version 号与 base instant 说明「一个 File Slice 引用了哪些物理文件」，以及新旧 base 文件之间的替换关系。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'B06',
    moduleId: 'A',
    title: 'Record Key、Partition Path、HoodieKey',
    summary:
      '讲清 HoodieKey = Record Key + Partition Path 的复合定位语义，以及 recordkey.field 配置与索引定位之间的依赖关系。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-INDEX'],
  },
  {
    id: 'B07',
    moduleId: 'A',
    title: 'Hudi 的 MVCC 与 Snapshot 可见性',
    summary:
      '用两个 instant 的 checkpoint 讲清快照读看到的是「提交时刻的完整状态」，以及 Time Travel 为什么强依赖 Timeline 上的历史 instant 仍然存在。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'B08',
    moduleId: 'A',
    title: 'Hudi 表在 HDFS 中的完整目录结构',
    summary:
      '逐层展开表根目录与 .hoodie 目录，讲清「数据文件放分区目录、元数据文件放 .hoodie」这种分离存放方式，以及各自承担什么职责。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-R26-ART-COMMON'],
    note: 'r26 制品层面确认 hudi-common 在位（组件级证据），目录结构本身为社区 0.15 语义。',
  },
]
