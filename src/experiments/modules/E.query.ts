import type { CatalogEntry } from '../catalog'

/**
 * 模块 E —— 数据查询（8 条）。
 *
 * 目标：讲清「同一个表，四种读法，四种结果」，
 * 让学习者在写 SQL 之前先知道自己会拿到哪一份数据。
 */
export const MODULE_E_ENTRIES: CatalogEntry[] = [
  {
    id: 'Q01',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['snapshot', '快照读'],
    moduleId: 'E',
    title: 'Snapshot 快照查询',
    summary:
      '讲清默认的快照读会合并 base file 与全部 log file，因此 MOR 表在 Compaction 之前也能查到最新数据，代价是读放大。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'Q02',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['read optimized', '读优化'],
    moduleId: 'E',
    title: 'Read Optimized 读优化查询',
    summary:
      '讲清读优化只读 base file、完全忽略 log file，读得快但会「漏掉」仅存在于 log file 的更新，这是 MOR 表必须及时 Compaction 的根因。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'Q03',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['incremental', '增量读'],
    moduleId: 'E',
    title: 'Incremental 增量查询',
    summary:
      '用 begin/end instant time 圈出时间窗口，讲清增量查询只返回窗口内新增与更新的记录，以及被删记录会以 operation=DELETE 的形式返回。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'Q04',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['time travel', '时间旅行', 'as.of.instant'],
    moduleId: 'E',
    title: 'Time Travel 时间旅行',
    summary:
      '用 as.of.instant 读回某个历史时刻的数据，讲清它依赖 Timeline 上仍保留该 instant —— 一旦被 Archive 并清理了历史文件，历史时刻就查不到了。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR', 'EV-HW-RUN-COMPACTION'],
  },
  {
    id: 'Q05',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['cow mor 查询', '可见性'],
    moduleId: 'E',
    title: 'COW / MOR 查询数据可见性对比',
    summary:
      '在同一份数据上并排比较 COW 与 MOR 在快照读、读优化读下的可见性差异，解释「写完立刻读」为什么两种表结果一致、跑完 Compaction 后为何更一致。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'Q06',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['分区裁剪', '扫描文件'],
    moduleId: 'E',
    title: '分区过滤与文件扫描',
    summary:
      '调整分区过滤条件并观察实际被打开的文件数，讲清分区裁剪是 Hudi 最有效的读优化手段，也是分区设计必须对齐查询模式的原因。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR', 'EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'Q07',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['_hoodie_', '元字段'],
    moduleId: 'E',
    title: '_hoodie_* 元数据字段',
    summary:
      '逐个解释 _hoodie_record_key / _hoodie_partition_path / _hoodie_commit_time / _hoodie_operation 等元字段的来源与用途，说明它们为什么能直接用来做增量消费。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR', 'EV-COMM-CREATE-TABLE'],
  },
  {
    id: 'Q08',
    difficulty: 'L2',
    minutes: 5,
    aliases: ['cdc', '增量消费'],
    moduleId: 'E',
    title: 'CDC 与增量数据消费场景',
    summary:
      '把 Incremental Query 接到一条「上游采集 → 下游落库」的链路上，讲清消费端必须自己处理删除语义，否则会漏删造成数据不一致。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
]
