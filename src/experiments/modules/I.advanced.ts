import type { CatalogEntry } from '../catalog'

/**
 * 模块 I —— 高级专题（8 条）。
 *
 * 目标：面向「表已经上线、开始出问题时」的场景，
 * 讲清容量、倾斜、元数据与并发这几条真正影响生产成本的线。
 *
 * ⚠️ 证据口径：Metadata Table 在 r26 未确认（最高 E1）；
 *    Bucket 倾斜与并发控制的细节无直接文档支撑（E0）。
 */
export const MODULE_I_ENTRIES: CatalogEntry[] = [
  {
    id: 'A01',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['小文件', '文件大小'],
    moduleId: 'I',
    title: 'Hudi 文件大小与小文件问题',
    summary:
      '统计每个分区的文件数与平均大小，讲清小文件怎么产生、怎么拖慢查询，以及用 Clustering 从源头控制文件大小的思路。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-MOR', 'EV-R26-ART-COMMON'],
  },
  {
    id: 'A02',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['数据倾斜', 'bucket 倾斜'],
    moduleId: 'I',
    title: 'Bucket 数据倾斜',
    summary:
      '构造主键分布极不均匀的数据并观察各桶的记录数，讲清哈希分桶下的倾斜现象，以及它和文件大小、Compaction 负载之间的因果链。',
    implemented: false,
    evidenceLevel: 'E0',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX'],
    note: '分桶算法本身在 r26 未确认，倾斜程度与分布特征无法定量结论，属待研究场景（E0）。',
  },
  {
    id: 'A03',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['metadata table', '元数据表'],
    moduleId: 'I',
    title: 'Metadata Table',
    summary:
      '讲清 Metadata Table 提供的文件元信息视图能替代哪些昂贵的 HDFS 列举操作，以及 hoodie.metadata.enable 开关带来的取舍。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-METADATA-TABLE'],
    note: 'Metadata Table 为社区 0.15 特性；r26 的开关、索引实现与限制均未确认。',
  },
  {
    id: 'A04',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['并发控制', 'occ', '锁'],
    moduleId: 'I',
    title: '并发控制、锁与多 Writer',
    summary:
      '让两个写者同时改同一分区，讲清乐观并发控制如何发现写冲突、为什么并发写者必须收敛到同一个 File Group 集合上。',
    implemented: false,
    evidenceLevel: 'E0',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX', 'EV-R26-ART-COMMON'],
    note: '并发控制在社区文档中有 OCC 的概念性描述，但 r26 上的具体冲突检测与重试行为无直接依据，属待研究场景（E0）。',
  },
  {
    id: 'A05',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['compaction 吞吐', '策略'],
    moduleId: 'I',
    title: 'Compaction 策略与吞吐量分析',
    summary:
      '调节 compaction.delta_commits 并观察每次 Compaction 合并掉的 log 数量，讲清「攒多久合一次」在延迟与吞吐之间的取舍。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: '参数取值与调度建议来自华为规范；真实吞吐数据必须在 r26 集群实测。',
  },
  {
    id: 'A06',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['cleaner 保留', '存储成本'],
    moduleId: 'I',
    title: 'Cleaner 保留策略与存储成本',
    summary:
      '调节 hoodie.cleaner.commits.retained / keep.max.commits / keep.min.commits 并观察存储占用，讲清「保留窗口」同时决定了成本与可回溯范围。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: '参数组合来自华为规范；具体存储成本随数据量变化，需实测标定。',
  },
  {
    id: 'A07',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['timeline 规模', '归档性能'],
    moduleId: 'I',
    title: 'Timeline 规模与归档性能',
    summary:
      '统计活跃 Timeline 上的 instant 数量并执行 Archive，讲清 Timeline 为什么会无限膨胀、Archive 如何控制它，以及归档动作本身的代价。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: 'RUN ARCHIVELOG 语法有华为文档支撑（E2）；Timeline 规模阈值与归档耗时无实测数据，需 r26 标定。',
  },
  {
    id: 'A08',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['健康检查', '维护'],
    moduleId: 'I',
    title: 'Hudi 表健康检查与维护决策',
    summary:
      '把前面的能力串成一张体检清单：文件数与大小、log file 堆积、pending instant、Timeline 长度、Cleaner 保留窗口，逐项给出维护决策。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-R26-ART-COMMON', 'EV-HW-RUN-COMPACTION'],
    note: '检查项来自社区 0.15 的运维实践与华为规范；r26 上 hoodie-cli 的安装路径与命令名需实测确认。',
  },
]
