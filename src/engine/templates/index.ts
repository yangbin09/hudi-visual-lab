import { SimulationError } from '@/engine/core/errors'
import { SPARK_SQL_TEMPLATES } from './sparkSql'
import { FLINK_SQL_TEMPLATES } from './flinkSql'
import { SCALA_TEMPLATES } from './scala'
import { SHELL_TEMPLATES } from './shell'
import {
  DEFAULT_TEMPLATE_CONTEXT,
  type SqlBlock,
  type SqlLanguage,
  type SqlStatus,
  type TemplateContext,
} from './types'

export * from './types'
export { SPARK_SQL_TEMPLATES } from './sparkSql'
export { FLINK_SQL_TEMPLATES } from './flinkSql'
export { SCALA_TEMPLATES } from './scala'
export { SHELL_TEMPLATES } from './shell'

/** 按语言分组的模板表 */
export const TEMPLATES: Record<SqlLanguage, SqlBlock[]> = {
  'spark-sql': SPARK_SQL_TEMPLATES,
  'flink-sql': FLINK_SQL_TEMPLATES,
  scala: SCALA_TEMPLATES,
  shell: SHELL_TEMPLATES,
}

/** 全部模板（跨语言） */
export const ALL_TEMPLATES: SqlBlock[] = [
  ...SPARK_SQL_TEMPLATES,
  ...FLINK_SQL_TEMPLATES,
  ...SCALA_TEMPLATES,
  ...SHELL_TEMPLATES,
]

/** 全部语言 */
export const TEMPLATE_LANGUAGES: SqlLanguage[] = ['spark-sql', 'flink-sql', 'scala', 'shell']

/** 语言的中文标签 */
export const TEMPLATE_LANGUAGE_LABEL: Record<SqlLanguage, string> = {
  'spark-sql': 'Spark SQL',
  'flink-sql': 'Flink SQL',
  scala: 'Scala DataFrame API',
  shell: 'Shell / 运维命令',
}

/**
 * 按 id 找模板（跨语言）。
 * id 是全局唯一的，找不到返回 undefined —— UI 可以据此隐藏入口。
 */
export function findTemplate(id: string): SqlBlock | undefined {
  return ALL_TEMPLATES.find((b) => b.id === id)
}

/** 在指定语言里找模板 */
export function findTemplateIn(language: SqlLanguage, id: string): SqlBlock | undefined {
  return TEMPLATES[language].find((b) => b.id === id)
}

/** 某语言下的全部模板 id */
export function templateIds(language: SqlLanguage): string[] {
  return TEMPLATES[language].map((b) => b.id)
}

/** 按状态筛选模板 */
export function templatesByStatus(language: SqlLanguage, status: SqlStatus): SqlBlock[] {
  return TEMPLATES[language].filter((b) => b.status === status)
}

/**
 * 渲染模板：把正文里的 `${var}` 用 TemplateContext 填充。
 *
 * 约定：
 *   - 已知变量 → 替换为实际值；
 *   - 未知变量 → **原样保留** `${var}`。
 *     故意不静默替换成空串：模板渲染错了必须一眼看得出来，
 *     而不是变成一段看起来正常、实则少了一行的 SQL。
 *
 * 找不到模板时抛 SimulationError —— 模板 id 写错属于调用方错误，必须明确报错。
 */
export function buildSql(
  language: SqlLanguage,
  id: string,
  ctx: TemplateContext = DEFAULT_TEMPLATE_CONTEXT,
): string {
  const block = findTemplateIn(language, id)
  if (!block) {
    throw new SimulationError(
      `模板不存在：${language} / ${id}。当前该语言下可用模板：${templateIds(language).join('、') || '(无)'}。`,
    )
  }
  return render(block.code, ctx)
}

/** 只做变量替换，不查模板 */
export function render(code: string, ctx: TemplateContext = DEFAULT_TEMPLATE_CONTEXT): string {
  const values = ctx as unknown as Record<string, unknown>
  return code.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const v = values[name]
    if (v === undefined || v === null) return match
    return String(v)
  })
}
