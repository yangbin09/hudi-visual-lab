import type { CatalogEntry } from '../catalog'

/**
 * 模块 D —— 索引机制（8 条）。
 *
 * 目标：讲清「索引是干什么的」与「索引什么时候靠不住」。
 *
 * ⚠️ 证据口径：BUCKET 索引的分桶哈希算法、File Group 分配规则，
 *    以及 GLOBAL 索引在 r26 上的支持情况均**未确认**，
 *    相关条目最高只标 E1，supportState 一律标 unverified，并在 note 中写明缺口。
 */
export const MODULE_D_ENTRIES: CatalogEntry[] = [
  {
    id: 'I01',
    moduleId: 'D',
    title: 'SIMPLE 索引定位原理',
    summary:
      '讲清 SIMPLE 索引在写入时靠内存 HashMap 定位旧记录、在读取时不做任何裁剪的特点，解释它为什么适合「写后读全量」的场景。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-INDEX'],
  },
  {
    id: 'I02',
    moduleId: 'D',
    title: 'BLOOM 索引定位原理',
    summary:
      '讲清 Bloom Filter 存在 base file footer 中、查询时先判文件再决定是否打开的概率性剪枝，说明它「可能误判但不会漏判」的语义。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'supported',
    evidenceIds: ['EV-COMM-INDEX'],
  },
  {
    id: 'I03',
    moduleId: 'D',
    title: 'BUCKET 索引与哈希分桶',
    summary:
      '讲清 BUCKET 索引把主键哈希映射到固定数量的桶、每个桶对应一个 File Group，从而让 upsert 只重写一个桶而非全表扫描。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX'],
    note: '「按主键哈希分桶、File Group 固定分配」为社区 0.15 语义；r26 的实际分桶哈希算法未确认，本项目使用教学示意算法并须显著标注。',
  },
  {
    id: 'I04',
    moduleId: 'D',
    title: 'BUCKET 索引与分区路径',
    summary:
      '讲清 BUCKET 索引的作用域是「分区内」而非全局，以及跨分区移动同一个主键时 Bucket 映射会怎样失效。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX'],
    note: '分区作用域为社区 0.15 语义；r26 下 BUCKET 与分区路径组合的具体行为需实测确认。',
  },
  {
    id: 'I05',
    moduleId: 'D',
    title: 'BUCKET 数量与 File Group 分配',
    summary:
      '讲清桶数如何决定每个分区的 File Group 数量、桶数过小或过大分别带来什么问题，以及桶数与写入并行度的匹配关系。',
    implemented: false,
    evidenceLevel: 'E0',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX'],
    note: '桶数与 File Group 的分配规则在社区文档中未给出细节，r26 也未确认，属待研究场景（E0）。',
  },
  {
    id: 'I06',
    moduleId: 'D',
    title: 'GLOBAL 索引与非 GLOBAL 索引',
    summary:
      '对比 GLOBAL_SIMPLE / GLOBAL_BLOOM 与分区级索引的作用域差异，讲清全局索引解决的是「同主键跨分区」问题，代价是索引构建与维护成本更高。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX'],
    note: 'GLOBAL 索引仅见于社区 0.15 文档；r26 是否启用、行为如何均未确认。',
  },
  {
    id: 'I07',
    moduleId: 'D',
    title: '索引类型与写入操作兼容性',
    summary:
      '把索引类型 × 写入 operation 展开成一张兼容性矩阵，讲清哪些组合天然不被支持，以及遇到不支持的组合时引擎应当拦截还是放行。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX', 'EV-COMM-BULK-INSERT'],
    note: '矩阵中绝大多数格子有社区文档支撑，唯独「BUCKET + bulk_insert」这一格社区文档未明确说明、r26 未确认，本项目按拦截处理。',
  },
  {
    id: 'I08',
    moduleId: 'D',
    title: '索引异常诊断实验',
    summary:
      '制造索引与写入操作不匹配的异常，观察引擎给出的错误信息，讲清「看错误类型 → 判断是哪一层拒绝 → 改配置还是改 operation」的排查路径。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-INDEX', 'EV-COMM-BULK-INSERT'],
    note: '诊断流程为社区 0.15 语义；r26 上具体的异常类名与报错文案需实测确认。',
  },
]
