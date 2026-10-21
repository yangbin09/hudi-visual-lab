import type { EvidenceLevel } from '@/models/evidence'
import type { ExperimentDefinition, ModuleDefinition } from '@/models/simulation'
import { listExperiments } from './registry'
import { MODULE_A_ENTRIES } from './modules/A.basics'
import { MODULE_B_ENTRIES } from './modules/B.ddl'
import { MODULE_C_ENTRIES } from './modules/C.write'
import { MODULE_D_ENTRIES } from './modules/D.index'
import { MODULE_E_ENTRIES } from './modules/E.query'
import { MODULE_F_ENTRIES } from './modules/F.services'
import { MODULE_G_ENTRIES } from './modules/G.integration'
import { MODULE_H_ENTRIES } from './modules/H.lab'
import { MODULE_I_ENTRIES } from './modules/I.advanced'

/**
 * 实验目录（需求 §4）。
 *
 * 本文件是「课程大纲」的唯一来源：
 *   - 目录页 / 学习路径 / 学习进度用 `CATALOG` 渲染主题列表与模块分组；
 *   - 动画主题页用 `visualLesson(id)` 拿场景定义，用 `getExperimentById` 拿
 *     旧实验定义（B02 的学习目标与自测题仍来自那里）。
 *
 * ── 证据等级口径（本目录统一执行） ──────────────────────────────────────
 * `evidenceLevel` = 该条目**核心结论**所依据的最高证据等级：
 *   E2  华为官方文档直接支撑（Compaction 规范、Hudi TTL 策略）
 *   E1  Apache Hudi 0.15 社区文档直接支撑
 *   E0  无直接文档支撑，属于工程推演 / 待研究场景
 *   E3  已通过 r26 源码或 JAR **行为级**分析确认
 *   E4  已通过真实 r26 集群实测
 *
 * ⚠️ 本目录**不使用 E3，也不存在 E4**：
 *   - 证据库中的 E3 条目全部是「制品坐标 HTTP 200 存在性」这一**组件级**证据，
 *     不能直接支撑任何行为级断言；把行为结论标成 E3 会构成过度声明。
 *   - 本项目是纯浏览器模拟，没有真实集群，因此 E4 一条都不可能有。
 *   凡是 r26 未确认的行为（BUCKET 分桶算法细节、GLOBAL 索引、Metadata Table、
 *   TTL 的 ReplaceCommit 行为细节、Kerberos 链路细节等），一律标 E0 / E1，
 *   并在 `note` 中写明缺口，绝不标 E3 / E4。
 * ────────────────────────────────────────────────────────────────────
 */

export interface CatalogEntry {
  /** 需求 §4 中的实验编号，如 'B02' / 'T01' */
  id: string
  /** 所属模块 id（A~I） */
  moduleId: string
  /** 中文标题，技术术语保留英文 */
  title: string
  /** 一句话说明该实验要讲清什么 */
  summary: string
  /** 是否已有可交互的实验实现 */
  implemented: boolean
  /** 已有实现时对应的 ExperimentDefinition.id；用于拼 /experiment/:id 路由 */
  experimentId?: string
  /** 核心结论的证据等级 */
  evidenceLevel: EvidenceLevel
  /** r26 上的支持状态 */
  supportState: 'supported' | 'conditional' | 'unverified' | 'unsupported'
  /** 关联证据 id（均来自 src/evidence 下已存在的条目） */
  evidenceIds?: string[]
  /** 证据缺口 / 需要 r26 实测才能确认的点 */
  note?: string
  /** 学习难度：L1 入门（基础原理/建表/写入）、L2 进阶（索引/查询）、L3 高级（表服务/集成/故障/高级专题） */
  difficulty?: 'L1' | 'L2' | 'L3'
  /** 建议学习时长（分钟，按步骤数 3–8 估算） */
  minutes?: number
  /** 目录搜索别名（中文/英文同义词，用于搜索命中也算命中本条目） */
  aliases?: string[]
}

/** 九个模块的目录元数据 */
export const MODULES: ModuleDefinition[] = [
  {
    id: 'A',
    order: 1,
    title: 'A 基础原理',
    shortTitle: '基础原理',
    description:
      '从 Hudi 与普通 Parquet 表的差别出发，建立 File Group / File Slice / Base File / Log File / Timeline 这套核心心智模型。',
  },
  {
    id: 'B',
    order: 2,
    title: 'B 建表与分区',
    shortTitle: '建表与分区',
    description:
      '用 Spark SQL 建出 COW 与 MOR 表，讲清主键、Precombine、分区字段、Hive Style Partitioning 与表级配置落盘方式。',
  },
  {
    id: 'C',
    order: 3,
    title: 'C 数据写入',
    shortTitle: '数据写入',
    description:
      '拆解 Insert / Upsert / Delete / Bulk Insert / Insert Overwrite 的完整写入链路，解释文件落点与幂等性。',
  },
  {
    id: 'D',
    order: 4,
    title: 'D 索引机制',
    shortTitle: '索引机制',
    description:
      'SIMPLE / BLOOM / BUCKET / GLOBAL 四类索引的定位原理、作用域与写入兼容性，以及索引异常怎么排查。',
  },
  {
    id: 'E',
    order: 5,
    title: 'E 数据查询',
    shortTitle: '数据查询',
    description:
      'Snapshot / Read Optimized / Incremental / Time Travel 四种读法的语义差异、可见性与元数据字段。',
  },
  {
    id: 'F',
    order: 6,
    title: 'F Timeline 与表服务',
    shortTitle: 'Timeline 与表服务',
    description:
      'Instant 生命周期与 Compaction / Clean / Archive / Rollback / Clustering / TTL 等表服务的执行原理与资源占用。',
  },
  {
    id: 'G',
    order: 7,
    title: 'G Spark / Flink 集成',
    shortTitle: 'Spark / Flink 集成',
    description:
      'Spark SQL、Scala DataFrame、Flink SQL 三条写入链路的差异，以及 Checkpoint、异步 Compaction 与 Kerberos 权限链路。',
  },
  {
    id: 'H',
    order: 8,
    title: 'H 生产故障实验室',
    shortTitle: '故障实验室',
    description:
      '十类真实生产故障的可复现实验：症状是什么、根因在哪一层、处置动作是什么、哪些部分尚未在 r26 确认。',
  },
  {
    id: 'I',
    order: 9,
    title: 'I 高级专题',
    shortTitle: '高级专题',
    description:
      '小文件、数据倾斜、Metadata Table、并发控制、Compaction 吞吐、Cleaner 保留策略与表健康检查等生产级议题。',
  },
]

/** 全部 80 条目录条目 */
export const CATALOG: CatalogEntry[] = [
  ...MODULE_A_ENTRIES,
  ...MODULE_B_ENTRIES,
  ...MODULE_C_ENTRIES,
  ...MODULE_D_ENTRIES,
  ...MODULE_E_ENTRIES,
  ...MODULE_F_ENTRIES,
  ...MODULE_G_ENTRIES,
  ...MODULE_H_ENTRIES,
  ...MODULE_I_ENTRIES,
]

const CATALOG_INDEX = new Map(CATALOG.map((e) => [e.id, e]))

/** 按目录编号取条目 */
export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG_INDEX.get(id)
}

/** 取某个模块下的全部条目（按模块内部顺序） */
export function catalogByModule(moduleId: string): CatalogEntry[] {
  return CATALOG.filter((e) => e.moduleId === moduleId)
}

/** 取某个条目所属的模块元数据 */
export function moduleOf(id: string): ModuleDefinition | undefined {
  const entry = getCatalogEntry(id)
  if (!entry) return undefined
  return MODULES.find((m) => m.id === entry.moduleId)
}

/** 按模块 id 取模块元数据 */
export function moduleById(moduleId: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.id === moduleId)
}

/**
 * 按 id 取实验定义 —— 契约 §4 要求的入口。
 *
 * 实现放在 registry.ts（实验定义的注册与查询都归它管），
 * 这里原样透出，保证 `import { getExperimentById } from '@/experiments/catalog'`
 * 与 `from '@/experiments/registry'` 拿到的是**同一个函数**。
 */
export { getExperimentById } from './registry'

/**
 * 实验清单（与目录对齐的视图）。
 *
 * 与 `registry.listExperiments()` 的区别只有一处：**moduleId 会被归一化**。
 * 目录（catalog）是模块归属的唯一权威 —— 实验实现里写的 moduleId 只是作者当时的
 * 标注，可能与目录编号不一致（例如把「基础原理」标成 'M1'）。
 * 这里按 catalogIds 反查目录条目，取目录里的 moduleId，
 * 保证 Dashboard 的「已实现 N / 共 M」统计落在正确的模块卡片上。
 */
export function getAllExperiments(): ExperimentDefinition[] {
  return listExperiments().map((def) => {
    const entry = def.catalogIds?.map((cid) => CATALOG_INDEX.get(cid)).find((e) => e !== undefined)
    if (!entry || entry.moduleId === def.moduleId) return def
    return { ...def, moduleId: entry.moduleId }
  })
}

/** 目录统计 —— Dashboard 的证据概览直接用它，避免各视图重复统计逻辑 */
export const CATALOG_STATS = {
  total: CATALOG.length,
  modules: MODULES.length,
  implemented: CATALOG.filter((e) => e.implemented).length,
  byLevel: {
    E0: CATALOG.filter((e) => e.evidenceLevel === 'E0').length,
    E1: CATALOG.filter((e) => e.evidenceLevel === 'E1').length,
    E2: CATALOG.filter((e) => e.evidenceLevel === 'E2').length,
    E3: CATALOG.filter((e) => e.evidenceLevel === 'E3').length,
    E4: CATALOG.filter((e) => e.evidenceLevel === 'E4').length,
  } as Record<EvidenceLevel, number>,
  bySupportState: {
    supported: CATALOG.filter((e) => e.supportState === 'supported').length,
    conditional: CATALOG.filter((e) => e.supportState === 'conditional').length,
    unverified: CATALOG.filter((e) => e.supportState === 'unverified').length,
    unsupported: CATALOG.filter((e) => e.supportState === 'unsupported').length,
  } as Record<CatalogEntry['supportState'], number>,
  byModule: Object.fromEntries(
    MODULES.map((m) => [m.id, catalogByModule(m.id).length]),
  ) as Record<string, number>,
}
