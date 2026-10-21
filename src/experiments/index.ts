import { registerExperiment } from './registry'
import { B02 } from './basics/B02CowVsMor'

/**
 * 实验总入口。
 *
 * 约定：
 *   - 每个实验模块导出自己的 `ExperimentDefinition` 常量（如 `export const B02`），
 *     在这里统一 `registerExperiment(...)`；
 *   - 目录（catalog）与注册表（registry）从本文件透出，
 *     消费方一律 `import { ... } from '@/experiments'`。
 *
 * ⚠️ 依赖：'./basics/B02CowVsMor' 由另一位同学创建，
 *    导出名必须是 `B02`（ExperimentDefinition 类型）。
 */
registerExperiment(B02)

export { B02 }

export * from './catalog'
export * from './registry'
