import type { CatalogEntry } from '../catalog'

/**
 * 模块 F —— Timeline 与表服务（12 条）。
 *
 * 目标：把 Instant 的生命周期与六类表服务讲成一条因果链：
 *   写入产生 delta commit → 日志攒多了要 Compaction → 旧文件要 Clean →
 *   instant 太多要 Archive → 写坏了要 Rollback → 数据乱了要 Clustering。
 *
 * ⚠️ 证据口径：Compaction / Archive / Clean / TTL 的**语法**有华为文档直接支撑（E2）；
 *    Rollback / Clustering / Restore 只有社区语义（E1）或组件级证据，r26 行为待实测。
 */
export const MODULE_F_ENTRIES: CatalogEntry[] = [
  {
    id: 'S01',
    difficulty: 'L3',
    minutes: 7,
    aliases: ['timeline', 'instant', '生命周期'],
    moduleId: 'F',
    title: 'Timeline 与 Instant 生命周期',
    summary:
      '讲清 Timeline 是按 instant time 排序的一串 Instant，以及 REQUESTED / INFLIGHT / COMPLETED 三种状态各自代表写入走到了哪一步。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR', 'EV-R26-ART-COMMON'],
  },
  {
    id: 'S02',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['commit', 'delta commit'],
    moduleId: 'F',
    title: 'Commit 与 DeltaCommit',
    summary:
      '区分 COW 的一次性 commit 与 MOR 的 commit + delta commit 组合，讲清 delta commit 如何只记录增量、又如何被 Compaction 消费。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR'],
  },
  {
    id: 'S03',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['compaction plan', '计划'],
    moduleId: 'F',
    title: 'Compaction Plan 生成',
    summary:
      '用 RUN COMPACTION ON 配合 hoodie.run.compact.only.inline=true 只生成 Compaction Plan，讲清计划里记录的是「哪些 File Group 有多少个 log file 要合并」。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'supported',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: '语法与参数来自华为《Hudi数据表Compaction规范》；r26 上该存储过程的可用性仍需实测确认。',
  },
  {
    id: 'S04',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['compaction', '合并'],
    moduleId: 'F',
    title: 'Compaction 执行与文件合并',
    summary:
      '执行一次 Compaction，观察 log file 被合并成新的 base file、旧 base 与 log 变为 SUPERSEDED，讲清 Compaction 与 Clean 是两件不同的事。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'supported',
    evidenceIds: ['EV-HW-RUN-COMPACTION', 'EV-COMM-MOR'],
  },
  {
    id: 'S05',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['异步 compaction', '调度'],
    moduleId: 'F',
    title: '异步 Compaction 调度',
    summary:
      '按华为规范拆成「Spark 作业只生成 Plan → 独立 Spark 作业执行 Plan」两步，讲清为什么实时写入链路不应该自己执行 Compaction。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: '调度间隔（2~4 小时）与 CPU:内存配比（1:4~1:8）来自华为文档；异步作业的入口类名需以 r26 实际发行包为准。',
  },
  {
    id: 'S06',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['clean', '清理', '保留窗口'],
    moduleId: 'F',
    title: 'Clean 策略与文件物理删除',
    summary:
      '讲清 Clean 才真正把被取代的旧文件从 HDFS 上删掉，以及保留窗口 hoodie.cleaner.commits.retained 如何同时决定空间成本与时间旅行能力。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: 'RUN CLEAN 存储过程在华为文档中标注为 MRS 3.2.0+；目标版本 3.1.0-350-r26 需改用 hoodie.clean.automatic=true。',
  },
  {
    id: 'S07',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['archive', '归档', 'archivelog'],
    moduleId: 'F',
    title: 'Archive Timeline 归档',
    summary:
      '演示 Archive 把较早的 instant 从活跃 Timeline 移到 .hoodie/archive/ 下，讲清它只搬元数据、不动数据文件，以及归档与 Clean 的先后依赖。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'supported',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
  },
  {
    id: 'S08',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['rollback', '回滚'],
    moduleId: 'F',
    title: 'Rollback 回滚',
    summary:
      '制造一次写到一半失败的提交，再执行 Rollback，讲清它如何删除该 instant 的残留文件并让 Timeline 重新自洽。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-R26-ART-COMMON'],
    note: '仅有组件级证据（hudi-common 在位），无行为级文档；r26 上 hoodie-cli rollback 的参数名需实测确认。',
  },
  {
    id: 'S09',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['restore', '恢复'],
    moduleId: 'F',
    title: 'Restore 恢复',
    summary:
      '用 Restore 把表回滚到某个历史 instant，讲清它与 Rollback 的区别：Rollback 撤销未完成的写入，Restore 撤销已经生效的历史提交。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-MOR'],
    note: 'Restore 语义为社区 0.15 行为；r26 的 restore 命令可用性与前置条件需实测确认。',
  },
  {
    id: 'S10',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['clustering', '聚类', 'replacecommit'],
    moduleId: 'F',
    title: 'Clustering 与 ReplaceCommit',
    summary:
      '演示 Clustering 重写分区内的小文件并产生 replacecommit instant，讲清它只改变物理布局、不改变数据内容，与 Clean 的职责边界。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-R26-ART-COMMON', 'EV-COMM-MOR'],
    note: 'r26 侧 run_clustering 存储过程的参数签名（含 orderby / predicate）需实测确认，华为文档未覆盖。',
  },
  {
    id: 'S11',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['ttl', '过期'],
    moduleId: 'F',
    title: 'TTL 分区过期与清理',
    summary:
      '用 ttl_policy_save 写一条分区级 TTL 策略，讲清 spec 用正则匹配分区、value 与 units 必须成对提供，以及 level 当前仅支持 PARTITION。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-TTL-POLICY'],
    note: 'TTL 语法与 PARTITION 级约束有华为文档支撑（E2）；TTL 触发后写哪种 instant、旧文件如何回收等 ReplaceCommit 行为细节 r26 未确认（E0），页面须标待验证。',
  },
  {
    id: 'S12',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['pending', '未完成', '文件引用'],
    moduleId: 'F',
    title: 'Pending Instant 与文件版本引用',
    summary:
      '讲清「Timeline 引用的文件」与「HDFS 上真实存在的文件」是两个集合，Pending Instant 会让两者长期不一致，直到 Clean 把残留文件收走。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-MOR', 'EV-R26-ART-COMMON'],
    note: 'pending instant 阻塞后续表服务的具体阈值与行为 r26 未实测确认。',
  },
]
