/**
 * 页内详情区（LessonDock）的公共类型。
 *
 * 与组件分开定义，父组件可以直接 `import type { DockTab } from '@/components/lesson/types'`
 * 来做受控 tab / 事件类型标注，不需要为了取类型而 import 组件本身。
 */
import type { SceneKind } from '@/experiments/visual/types'

/** LessonDock 的四个固定分区 */
export type DockTab = 'explain' | 'data' | 'code' | 'evidence'

/** 分区元信息（顺序即界面顺序） */
export interface DockTabMeta {
  key: DockTab
  /** 分区短名 */
  label: string
  /** 分区里有什么（用于首次发现，不再只写 tab 名） */
  hint: string
}

export const DOCK_TABS: ReadonlyArray<DockTabMeta> = [
  { key: 'explain', label: '解释', hint: '现象 / 原因 / 关键数字' },
  { key: 'data', label: '数据', hint: 'HDFS / 记录 / Timeline / 计划' },
  { key: 'code', label: '代码', hint: 'SQL / 源码映射' },
  { key: 'evidence', label: '依据', hint: '证据 / r26 差距' },
] as const

/** 源码映射的一行：文件 → 函数/常量 → 说明（真实换行渲染，不是字面 \n） */
export interface LessonSourceEntry {
  /** 仓库内相对路径 */
  path: string
  /** 该文件里与本主题相关的入口（函数 / 常量） */
  symbol: string
  /** 可选补充说明 */
  note?: string
}

/** 通用源码映射（所有主题都成立的入口） */
const COMMON_SOURCE_MAP: LessonSourceEntry[] = [
  {
    path: 'src/experiments/visual/lessons.ts',
    symbol: 'VISUAL_LESSONS / make / s',
    note: '本主题的步骤标题与讲解文案',
  },
  {
    path: 'src/engine/visual/scenarios.ts',
    symbol: 'buildLessonRun / seedLesson / execute',
    note: '把每一步映射为一次引擎动作，并生成前后快照',
  },
  {
    path: 'src/engine/visual/teachingTrace.ts',
    symbol: 'buildTeachingTrace',
    note: '从真实前后快照推导"同键版本 / 文件判断 / 结论"，不改动结果',
  },
  {
    path: 'src/engine/core/applyAction.ts',
    symbol: 'applyAction',
    note: '所有写入与服务动作的统一入口',
  },
]

/** 场景类型专属入口 */
const KIND_SOURCE_MAP: Record<SceneKind, LessonSourceEntry[]> = {
  files: [
    {
      path: 'src/engine/operations/writes.ts',
      symbol: 'performWrite',
      note: '定位 File Group、写 Base / Log 文件',
    },
    {
      path: 'src/engine/core/state.ts',
      symbol: 'mergeRecords / visibleRecords',
      note: '同键版本的归并与查询可见性过滤',
    },
  ],
  index: [
    {
      path: 'src/engine/indexes/bucket.ts',
      symbol: 'bucketOf / teachingHash',
      note: 'BUCKET 教学哈希（djb2 仅为教学算法，r26 待验证）',
    },
    {
      path: 'src/engine/operations/writes.ts',
      symbol: 'performWrite',
      note: '按索引定位目标 File Group',
    },
  ],
  query: [
    {
      path: 'src/engine/queries/index.ts',
      symbol: 'runQuery',
      note: 'Snapshot / 读优化 / 增量 / Time Travel 四种读法',
    },
    {
      path: 'src/engine/core/state.ts',
      symbol: 'mergeRecords',
      note: '按 precombine 归并同键版本',
    },
  ],
  timeline: [
    {
      path: 'src/engine/operations/services.ts',
      symbol: 'SCHEDULE_COMPACTION / RUN_COMPACTION / RUN_CLEAN / RUN_ARCHIVE',
      note: '表服务动作如何改变 Timeline 上的 instant 状态',
    },
    {
      path: 'src/engine/core/state.ts',
      symbol: 'pushCheckpoint',
      note: '每次成功提交写入 checkpoint，供回退与 Time Travel 使用',
    },
  ],
  flow: [
    {
      path: 'src/components/visual/AnimatedProcess.vue',
      symbol: 'nodes / edges / motion',
      note: '流程示意节点与连线：节点不代表真实服务执行状态',
    },
    {
      path: 'src/engine/core/applyAction.ts',
      symbol: 'applyAction',
      note: '机制示意页只在可执行部分调用引擎',
    },
  ],
  schema: [
    {
      path: 'src/engine/core/applyAction.ts',
      symbol: 'CREATE_TABLE / CREATE_TABLE 选项校验',
      note: '表定义、主键与分区字段进入 hoodie.properties',
    },
    {
      path: 'src/engine/operations/writes.ts',
      symbol: 'performWrite',
      note: '建表后的第一批写入路径',
    },
  ],
  metrics: [
    {
      path: 'src/engine/visual/scenarios.ts',
      symbol: 'stateMetrics',
      note: '文件数 / 有效文件 / Log / 旧版本 / pending 的统计口径',
    },
    {
      path: 'src/engine/queries/index.ts',
      symbol: 'runQuery',
      note: '可见记录数来自 Snapshot 查询，不是文件行数',
    },
  ],
}

/**
 * 按主题类型生成默认源码映射（父组件可用 `source-map` 覆盖）。
 * 返回真实数组，渲染时逐行输出 —— 不再出现模板里写字面 `\n` 的问题。
 */
export function defaultSourceMap(kind: SceneKind | undefined): LessonSourceEntry[] {
  const specific = kind ? KIND_SOURCE_MAP[kind] ?? [] : []
  const seen = new Set<string>()
  return [...specific, ...COMMON_SOURCE_MAP].filter((entry) => {
    const key = `${entry.path}#${entry.symbol}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
