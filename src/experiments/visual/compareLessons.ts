/**
 * B02 / B03 —— 双泳道对比主题（COW ↔ MOR）
 * ---------------------------------------------------------------------------
 * 背景：B02 与 B03 原本走的是**另一套渲染器**（src/views/VisualLabView.vue），
 * 与其余 78 个动画主题的 LessonView 并存 —— 这是审计报告里
 * 「两代产品并存 / 80 个主题两套渲染入口」那条结构性问题的最后一块。
 *
 * 现在：这两个主题仍然拥有自己的**交互方式**（两个泳道并排 + 可点的操作条），
 * 但页面骨架、目标条、术语栏、图例、详情区（dock）、小结、自测与进度
 * 全部复用 LessonView 的统一外壳。
 *
 * 本文件只描述这两个主题的**教学元信息**（目标 / 前置 / 结论 / 术语卡 / 边界），
 * 场景本身由 src/components/visual/CompareLesson.vue 负责。
 */

export interface CompareLessonDef {
  id: string
  /** 目录标题（与 catalog 一致） */
  title: string
  /** 画布上的一句话问题 */
  question: string
  /** 一句话副标题 */
  subtitle: string
  /** 学完你能…… */
  objective: string
  /** 前置知识 */
  prerequisites: string[]
  /** 一句话结论 */
  takeaway: string
  /** 术语卡 */
  glossary: { term: string; def: string }[]
  /** 本主题边界 */
  limitations: string[]
  /** 默认更新金额 */
  amount: number
}

export const COMPARE_LESSONS: Record<string, CompareLessonDef> = {
  B02: {
    id: 'B02',
    title: 'COW 表的数据写入与文件重写',
    question: '更新一条记录，文件会怎样变化？',
    subtitle: '同一份数据，两种策略。亲手写入，看见区别。',
    objective:
      '看懂 COW 与 MOR 在「同一次更新」上的不同落点：COW 重写整个 File Group 并产生新 parquet，MOR 只追加一条 Log；并知道读优化查询为什么会读到旧值。',
    prerequisites: ['File Group', 'File Slice', 'Base File'],
    takeaway:
      'COW 用「重写文件」换「读时简单」：更新后旧文件仍在 HDFS 上等着 Cleaner，而 Snapshot 读已经能拿到新值；MOR 用「追加 Log」换「写入快」，代价是读的时候要归并。',
    glossary: [
      { term: 'File Group', def: '同一 File ID 下的一组文件版本，COW 一次更新通常重写其中一份。' },
      { term: 'Base File', def: '列式存储的基准文件，记录该 File Slice 的完整数据。' },
      { term: 'Log File', def: '追加写的增量文件，只记录本次更新，读取时需要与 Base 归并。' },
      { term: 'File Slice', def: '一个 Base File 加上若干 Log File 的组合，是 MOR 读取的最小单位。' },
      { term: 'Compaction', def: '把一个 File Group 的 Base 与 Log 合并成新的 Base，消除读时归并开销。' },
    ],
    limitations: [
      'MOR 普通写入的落点为教学模型，尚未在 r26 集群实测，不能推导为所有写入场景的真实行为。',
    ],
    amount: 200,
  },
  B03: {
    id: 'B03',
    title: 'MOR 表的数据写入与 Log 合并',
    question: '同一次更新，为什么 MOR 的旧文件还在？',
    subtitle: '追加 Log、延迟合并：先写快，还是先读快？',
    objective:
      '看懂 MOR 的写入与合并节奏：一次更新只追加一条 Log、Base 原封不动，直到执行 Compaction 才产生新 Base；并由此解释读优化查询为什么可能读到旧值。',
    prerequisites: ['Log File', 'File Slice', 'Compaction'],
    takeaway:
      'MOR 把「合并」推迟到后台：写入时只追加 Log，Snapshot 读时归并 Base 与 Log 得到新值，而 Read Optimized 只看 Base，所以它读到的仍是旧值——直到 Compaction 产生新 Base。',
    glossary: [
      { term: 'Log File', def: '追加写的增量文件，只记录本次更新，读取时需要与 Base 归并。' },
      { term: 'File Slice', def: '一个 Base File 加上若干 Log File 的组合，是 MOR 读取的最小单位。' },
      { term: 'Compaction', def: '把一个 File Group 的 Base 与 Log 合并成新的 Base，消除读时归并开销。' },
      { term: 'Read Optimized', def: '只读 Base 文件，忽略尚未合并的 Log，结果可能不是最新。' },
      { term: 'Snapshot Read', def: '读取最新已提交 Instant 的数据，是最常用的一种读。' },
    ],
    limitations: [
      'MOR 的 Log 合并顺序与 ReplaceCommit 细节属于教学模型，r26 上的实际行为仍需现场核对。',
    ],
    amount: 200,
  },
}

/** 取对比主题定义 */
export function compareLesson(id: string): CompareLessonDef | undefined {
  return COMPARE_LESSONS[id]
}
