/**
 * Hudi Visual Lab 术语表（全站唯一术语口径）。
 *
 * 设计约定：
 *   - `term` 是**全站唯一推荐写法**：术语正文保留英文，中文只作说明；
 *   - `def` ≤ 40 字（渲染层可直接作为术语卡/提示文案，不超过两行）；
 *   - `firstTopic` 是该术语在课程里**首次出现**的目录主题 id（可直接跳转）；
 *   - 查询用 `glossaryOf(term)` / `glossaryByTopic(id)`，不要在视图里各自维护映射。
 */

export interface GlossaryEntry {
  /** 推荐写法（英文术语，保留原文） */
  term: string
  /** 英文全称/别名，用于搜索与 tooltip */
  en: string
  /** ≤40 字定义 */
  def: string
  /** 首次出现的目录主题 id */
  firstTopic: string
  /** 中文别名（同义异名收敛用，供搜索命中） */
  aliases?: string[]
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'File Group',
    en: 'File Group',
    def: '同一 File ID 下共享一组文件版本的存储单元',
    firstTopic: 'B04',
    aliases: ['文件组'],
  },
  {
    term: 'File Slice',
    en: 'File Slice',
    def: 'Base 加若干 Log 组成的一次快照引用',
    firstTopic: 'B04',
    aliases: ['文件切片'],
  },
  {
    term: 'Base File',
    en: 'Base File',
    def: '列式 parquet 数据文件，承载一次提交后的完整记录',
    firstTopic: 'B04',
    aliases: ['基础文件', 'base 文件'],
  },
  {
    term: 'Log File',
    en: 'Log File',
    def: 'MOR 表的增量日志文件，按写入追加、等待合并',
    firstTopic: 'B04',
    aliases: ['日志文件', 'log 文件'],
  },
  {
    term: 'File ID',
    en: 'File ID',
    def: 'File Group 的稳定标识，写入产生新文件时保持不变',
    firstTopic: 'B04',
  },
  {
    term: 'Instant',
    en: 'Instant',
    def: '一次带时间戳的原子提交，是 Timeline 上的一个点',
    firstTopic: 'B05',
    aliases: ['提交时刻'],
  },
  {
    term: 'Timeline',
    en: 'Timeline',
    def: '按 instant 排序的提交记录，决定当前能读到哪一版数据',
    firstTopic: 'B01',
    aliases: ['时间线'],
  },
  {
    term: 'Checkpoint',
    en: 'Checkpoint',
    def: '某次提交完成后的完整状态快照，供时间旅行与恢复读取',
    firstTopic: 'B07',
    aliases: ['检查点'],
  },
  {
    term: 'Commit',
    en: 'Commit',
    def: '一次写入成功后在 Timeline 留下的一条提交记录',
    firstTopic: 'B01',
    aliases: ['提交'],
  },
  {
    term: 'Compaction',
    en: 'Compaction',
    def: '把 Base 与 Log 归并成新 Base 的表服务',
    firstTopic: 'B05',
  },
  {
    term: 'Clean',
    en: 'Clean / Cleaner',
    def: '按保留窗口物理删除被取代旧文件的表服务',
    firstTopic: 'W06',
    aliases: ['清理'],
  },
  {
    term: 'Archive',
    en: 'Archive',
    def: '把旧的 instant 移到归档区，只搬元数据',
    firstTopic: 'S07',
    aliases: ['归档'],
  },
  {
    term: 'Rollback',
    en: 'Rollback',
    def: '撤销未完成事务并删除该 instant 残留文件',
    firstTopic: 'S08',
    aliases: ['回滚'],
  },
  {
    term: 'Clustering',
    en: 'Clustering',
    def: '重排文件布局、合并小文件，不改变业务数据',
    firstTopic: 'S10',
    aliases: ['聚类', '小文件合并'],
  },
  {
    term: 'TTL',
    en: 'Time To Live',
    def: '按分区过期时间自动清理数据的策略',
    firstTopic: 'S11',
    aliases: ['过期清理', '生命周期'],
  },
  {
    term: 'Metadata Table',
    en: 'Metadata Table',
    def: '用元数据索引代替逐文件列举的加速表',
    firstTopic: 'A03',
    aliases: ['元数据表'],
  },
  {
    term: 'Precombine',
    en: 'Precombine Field',
    def: '同主键多版本的排序字段，值更大者胜出',
    firstTopic: 'T01',
    aliases: ['预合并字段'],
  },
  {
    term: 'Bucket',
    en: 'Bucket',
    def: '按主键哈希划分、一个桶对应一个 File Group',
    firstTopic: 'I03',
    aliases: ['桶', '分桶'],
  },
  {
    term: 'Record Key',
    en: 'Record Key',
    def: '记录主键，决定"这条记录是谁"',
    firstTopic: 'B06',
    aliases: ['主键', 'recordkey.field'],
  },
  {
    term: 'Partition Path',
    en: 'Partition Path',
    def: '记录所属的分区目录，限定索引与查询的查找范围',
    firstTopic: 'B06',
    aliases: ['分区路径'],
  },
  {
    term: 'HoodieKey',
    en: 'HoodieKey',
    def: '主键与分区路径组成的复合定位键',
    firstTopic: 'B06',
  },
  {
    term: 'Copy On Write',
    en: 'Copy On Write (COW)',
    def: '写入时重写整个 File Group 的表类型',
    firstTopic: 'B02',
    aliases: ['COW'],
  },
  {
    term: 'Merge On Read',
    en: 'Merge On Read (MOR)',
    def: '写入追加 Log File、读取时再归并的表类型',
    firstTopic: 'B03',
    aliases: ['MOR'],
  },
  {
    term: 'Snapshot Read',
    en: 'Snapshot Read',
    def: '合并 Base 与 Log 的默认读法，能看到最新提交',
    firstTopic: 'B01',
    aliases: ['快照读', 'Snapshot'],
  },
  {
    term: 'Read Optimized',
    en: 'Read Optimized',
    def: '只读 Base 的读法，可能看不到 Log 里的新更新',
    firstTopic: 'Q02',
    aliases: ['读优化'],
  },
  {
    term: 'Incremental Read',
    en: 'Incremental Read',
    def: '只返回指定 instant 窗口内新增、更新与删除的读法',
    firstTopic: 'Q03',
    aliases: ['增量读'],
  },
  {
    term: 'Time Travel',
    en: 'Time Travel',
    def: '按历史 instant 读取当时版本数据的读法',
    firstTopic: 'Q04',
    aliases: ['时间旅行'],
  },
  {
    term: 'SaveMode',
    en: 'Spark SaveMode',
    def: 'Spark 写入时对已存在目标表的处理模式',
    firstTopic: 'W07',
  },
  {
    term: 'Hive Metastore',
    en: 'Hive Metastore (HMS)',
    def: 'Hive 元数据服务，保存表结构与分区信息',
    firstTopic: 'T06',
    aliases: ['HMS', 'hive metastore', 'hive sync'],
  },
  {
    term: 'BLOOM Index',
    en: 'Bloom Index',
    def: '用位图做文件级概率剪枝的索引，可能误判但不会漏判',
    firstTopic: 'I02',
    aliases: ['Bloom', '布隆索引'],
  },
]

/** 按术语名（大小写不敏感，支持中文别名）查找 */
export function glossaryOf(term: string): GlossaryEntry | undefined {
  const q = term.trim().toLowerCase()
  if (!q) return undefined
  return GLOSSARY.find(
    (e) =>
      e.term.toLowerCase() === q ||
      e.en.toLowerCase() === q ||
      (e.aliases ?? []).some((a) => a.toLowerCase() === q),
  )
}

/** 取首次出现在某主题的术语（用于主题页「本课术语」） */
export function glossaryByTopic(topicId: string): GlossaryEntry[] {
  return GLOSSARY.filter((e) => e.firstTopic === topicId)
}
