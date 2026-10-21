import type { ExperimentDefinition } from '@/models/simulation'

/**
 * 实验定义注册表。
 *
 * 为什么要注册表而不是直接 import 全部实验：
 *   - 实验模块位于 src/experiments/basics/**、src/experiments/modules/** 等目录，
 *     由多位同学并行开发，注册表允许「谁写完谁注册」，互不阻塞；
 *   - 路由与 store 只需要一个 id → 定义 的查询入口。
 *
 * 注册是幂等的：同一个 id 重复注册以最后一次为准。
 */
export const experimentRegistry: Record<string, ExperimentDefinition> = Object.create(
  null,
) as Record<string, ExperimentDefinition>

/**
 * 注册一个实验定义。
 *
 * 约定：
 *   - `def.id` 是主键（通常与目录编号一致，如 'B02'）；
 *   - 若 `def.catalogIds` 中的目录编号与 `def.id` 不同，注册表**不会**额外建别名条目，
 *     以免 `listExperiments()` 出现重复；目录编号别名由 `getExperimentById()` 兜底解析。
 */
export function registerExperiment(def: ExperimentDefinition): void {
  if (!def || typeof def.id !== 'string' || def.id.length === 0) {
    throw new Error('registerExperiment: 实验定义缺少合法的 id')
  }
  experimentRegistry[def.id] = def
}

/**
 * 按 id 取实验定义。
 *
 * 查找顺序：
 *   1. 精确匹配 `def.id`；
 *   2. 兜底：匹配 `def.catalogIds` —— 这样即使实验实现把 id 写成 'b02-cow-vs-mor'，
 *      路由 `/experiment/B02` 依然可用（目录编号天然是稳定的对外标识）。
 *
 * 找不到返回 undefined，**不抛错** —— 路由层据此渲染「实验不存在」。
 */
export function getExperimentById(id: string): ExperimentDefinition | undefined {
  if (!id) return undefined
  const direct = experimentRegistry[id]
  if (direct) return direct
  for (const def of Object.values(experimentRegistry)) {
    if (def.catalogIds?.includes(id)) return def
  }
  return undefined
}

/** 列出全部已注册实验（按 id 去重） */
export function listExperiments(): ExperimentDefinition[] {
  const seen = new Set<string>()
  const out: ExperimentDefinition[] = []
  for (const def of Object.values(experimentRegistry)) {
    if (seen.has(def.id)) continue
    seen.add(def.id)
    out.push(def)
  }
  return out
}
