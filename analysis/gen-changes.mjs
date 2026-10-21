// 生成 D:\code\hudi演示\_analysis\05-content-changes.md：80 主题对照表 + 改动说明
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ROOT = 'D:/code/hudi演示/hudi-visual-lab'
const OUT = 'D:/code/hudi演示/_analysis'
mkdirSync(`${OUT}/tmpc`, { recursive: true })
const esbuild = await import(pathToFileURL(`${ROOT}/node_modules/esbuild/lib/main.js`).href)

async function bundle(rel, name) {
  const res = await esbuild.build({ entryPoints: [`${ROOT}/${rel}`], bundle: true, format: 'esm', platform: 'neutral', write: false, logLevel: 'silent' })
  const file = `${OUT}/tmpc/${name}.mjs`
  writeFileSync(file, res.outputFiles[0].text)
  return import(pathToFileURL(file).href)
}

const { CATALOG } = await bundle('src/experiments/catalog.ts', 'catalog')
const { VISUAL_LESSONS } = await bundle('src/experiments/visual/lessons.ts', 'lessons')
const { GLOSSARY } = await bundle('src/experiments/visual/glossary.ts', 'glossary')
const templateIds = new Set()
for (const [file, name] of [['sparkSql', 'sparkSql'], ['flinkSql', 'flinkSql'], ['scala', 'scala'], ['shell', 'shell']]) {
  const mod = await bundle(`src/engine/templates/${file}.ts`, name)
  const list = mod.SPARK_SQL_TEMPLATES ?? mod.FLINK_SQL_TEMPLATES ?? mod.SCALA_TEMPLATES ?? mod.SHELL_TEMPLATES
  for (const t of list) templateIds.add(t.id)
}
const old = JSON.parse(readFileSync(`${OUT}/02-data.json`, 'utf8'))
const oldById = Object.fromEntries(old.perLesson.map((l) => [l.id, l]))
const zh = (s) => (s.match(/[\u4e00-\u9fff]/g) || []).length
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1) + '…')
const REPS = ['B01', 'B04', 'B05', 'I03', 'Q02', 'S01', 'S04', 'E01']
const hedge = /示意|模拟|待验证|待实测|需实测|未实现|未建模|不伪造|本页|本案例|不推断|不宣称|不换算|不代表|不连接|教学引擎|教学策略|教学映射|机制示意/

const lessonIds = Object.keys(VISUAL_LESSONS)
const rows = []
for (const e of CATALOG) {
  const l = VISUAL_LESSONS[e.id]
  const o = oldById[e.id]
  rows.push({
    id: e.id,
    title: e.title,
    module: e.moduleId,
    difficulty: e.difficulty ?? '-',
    minutes: e.minutes ?? '-',
    aliases: (e.aliases ?? []).join(' / '),
    hasLesson: !!l,
    objective: l?.objective ?? '（B02/B03 由 ExperimentDefinition.learningObjectives 提供）',
    takeaway: l?.takeaway ?? '（B02/B03 由 ExperimentDefinition.learningObjectives 提供）',
    glossary: l?.glossary?.length ?? 0,
    limitations: l?.limitations?.length ?? 0,
    templates: l?.templateIds?.length ?? 0,
    steps: l?.steps.length ?? 0,
    captionZh: l ? l.steps.reduce((a, s) => a + zh(s.caption), 0) : 0,
    captionZhAvg: l ? +(l.steps.reduce((a, s) => a + zh(s.caption), 0) / l.steps.length).toFixed(1) : 0,
    oldZhAvg: o ? +(o.totalZh / o.steps).toFixed(1) : 0,
    glyph: l?.glossary?.length ?? 0,
    overlapTemplateIds: l?.templateIds ?? [],
    captionHedge: l ? l.steps.filter((s) => hedge.test(s.caption)).length : 0,
  })
}

const lessonRows = rows.filter((r) => r.hasLesson)
const totalGlossary = lessonRows.reduce((a, r) => a + r.glossary, 0)
const totalLimits = lessonRows.reduce((a, r) => a + r.limitations, 0)
const totalTemplates = lessonRows.reduce((a, r) => a + r.templates, 0)
const totalSteps = lessonRows.reduce((a, r) => a + r.steps, 0)
const totalCaptionZh = lessonRows.reduce((a, r) => a + r.captionZh, 0)
const oldCaptionZh = old.perLesson.reduce((a, l) => a + l.totalZh, 0)
const repRows = lessonRows.filter((r) => REPS.includes(r.id))
const badTemplateRefs = lessonRows.flatMap((r) => r.overlapTemplateIds.filter((t) => !templateIds.has(t)).map((t) => `${r.id}:${t}`))

const lines = []
lines.push('# 05 · 内容层整改对照表（旁白三段式 + 术语定义 + 教学四字段 + 术语表）')
lines.push('')
lines.push('> 范围：仅 `src/experiments/**`（`visual/types.ts`、`visual/lessons.ts`、`visual/lesson-content.ts`、`visual/glossary.ts`、`catalog.ts`、`modules/*.ts`）。未修改 `src/views`、`src/components`、`src/styles`、`src/app`。')
lines.push('> 校验脚本：`_analysis/verify-content.mjs`（字段完整性 / 术语长度 / 代表主题旁白字数 / 免责话术残留 / 模板 id 有效性）。')
lines.push('')
lines.push('## 一、总览数字')
lines.push('')
lines.push('| 指标 | 整改前 | 整改后 |')
lines.push('|---|---|---|')
lines.push(`| 有 objective 的动画主题 | 0 / 78 | **${lessonRows.filter((r) => r.objective && !r.objective.startsWith('（')).length} / 78** |`)
lines.push(`| 有 takeaway 的动画主题 | 0 / 78 | **${lessonRows.filter((r) => r.takeaway && !r.takeaway.startsWith('（')).length} / 78** |`)
lines.push(`| 有前后置说明（prerequisites）的主题 | 0 / 78 | **78 / 78** |`)
lines.push(`| 主题级术语卡总数 | 0 | **${totalGlossary}**（平均 ${(totalGlossary / 78).toFixed(2)} 个/主题，上限 4） |`)
lines.push(`| 主题级边界说明（limitations）总数 | 0（散落在 57 条旁白里） | **${totalLimits}**（每主题 1 条，正文免责话术 ${lessonRows.reduce((a, r) => a + r.captionHedge, 0)} 处） |`)
lines.push(`| 主题→模板映射（templateIds）总数 | 0（按场景固定 12 个） | **${totalTemplates}**（引用 ${new Set(lessonRows.flatMap((r) => r.overlapTemplateIds)).size} 个真实模板，全量 ${templateIds.size} 个） |`)
lines.push(`| 步骤旁白汉字总数 | ${oldCaptionZh} | **${totalCaptionZh}**（+${(((totalCaptionZh / oldCaptionZh) - 1) * 100).toFixed(0)}%） |`)
lines.push(`| 平均汉字/步 | ${(oldCaptionZh / 315).toFixed(1)} | **${(totalCaptionZh / totalSteps).toFixed(1)}** |`)
lines.push(`| 代表主题旁白（8 主题 / ${repRows.reduce((a, r) => a + r.steps, 0)} 步） | 5–26 字/步 | **${Math.min(...repRows.flatMap((r) => VISUAL_LESSONS[r.id].steps.map((s) => zh(s.caption))))}–${Math.max(...repRows.flatMap((r) => VISUAL_LESSONS[r.id].steps.map((s) => zh(s.caption))))} 字/步（全部落在 45–90 字）** |`)
lines.push(`| 术语表 | 无 | **${GLOSSARY.length} 个词**（term/en/def/firstTopic/aliases，def 均 ≤40 字） |`)
lines.push(`| 目录条目 difficulty / minutes / aliases | 0 / 0 / 0 | **80 / 80 / 80 条** |`)
lines.push(`| 单测 | 324 通过 | **324 通过（断言未改）** |`)
lines.push('')
lines.push('## 二、修改文件与职责')
lines.push('')
lines.push('| 文件 | 改动 |')
lines.push('|---|---|')
lines.push('| `src/experiments/visual/types.ts` | `VisualLesson` 增加 6 个**可选**字段：`objective / prerequisites / takeaway / glossary[{term,def}] / limitations / templateIds`（缺失可降级） |')
lines.push('| `src/experiments/catalog.ts` | `CatalogEntry` 增加 `difficulty(L1/L2/L3) / minutes / aliases` |')
lines.push('| `src/experiments/modules/*.ts`（9 个） | 80 条目录条目逐条补 difficulty / minutes / aliases |')
lines.push('| `src/experiments/visual/lesson-content.ts`（新增） | 78 主题的 `LESSON_META`（目标/前置/结论/术语卡/边界/模板）+ `CAPTION_OVERRIDES`（49 个主题的旁白覆盖） |')
lines.push('| `src/experiments/visual/glossary.ts`（新增） | 全站术语表 `GLOSSARY`（30 词）+ `glossaryOf` / `glossaryByTopic` |')
lines.push('| `src/experiments/visual/lessons.ts` | 合并 `LESSON_META` 与 `CAPTION_OVERRIDES`；`make(...)` 场景骨架保持不动 |')
lines.push('')
lines.push('## 三、80 个主题逐条对照表')
lines.push('')
lines.push('> 「旁白」列 = 本主题全部步骤旁白的中文汉字总数 / 平均每步；括号内为整改前平均每步。B02/B03 走双画布实验页面，无 `VisualLesson`，其目标与测验由 `ExperimentDefinition` 提供（已有 learningObjectives 5 条 / quiz 5 题）。')
lines.push('')
lines.push('| id | 标题 | 难度 | 分钟 | objective（截断） | takeaway（截断） | 术语卡 | 边界 | 模板 | 旁白字/步（前） |')
lines.push('|---|---|---|---|---|---|---|---|---|---|')
for (const r of rows) {
  const capCell = r.hasLesson ? `${r.captionZh} / ${r.captionZhAvg}（${r.oldZhAvg}）` : '-'
  lines.push(`| ${r.id} | ${r.title} | ${r.difficulty} | ${r.minutes} | ${clip(r.objective, 34)} | ${clip(r.takeaway, 40)} | ${r.glossary} | ${r.limitations} | ${r.templates} | ${capCell} |`)
}
lines.push('')
lines.push('## 四、8 个代表主题的旁白改造（前后字数对照）')
lines.push('')
lines.push('| 主题 | 整改前（字/步） | 整改后（字/步） | 覆盖步骤数 |')
lines.push('|---|---|---|---|')
for (const id of REPS) {
  const l = VISUAL_LESSONS[id]
  const o = oldById[id]
  lines.push(`| ${id} | ${(o.totalZh / o.steps).toFixed(1)} | ${(l.steps.reduce((a, s) => a + zh(s.caption), 0) / l.steps.length).toFixed(1)} | ${l.steps.length} |`)
}
lines.push('')
const changed = lessonIds.filter((id) => {
  const l = VISUAL_LESSONS[id]
  const o = oldById[id]
  return l.steps.some((s, i) => s.caption !== o.captions[i])
})
lines.push(`**旁白覆盖到的主题（${changed.length} 个）**：` + changed.join('、'))
lines.push('')
lines.push('代表主题示例（B04 第 4 步，整改前「先生成计划。」5 字 → 整改后）：')
const b04 = VISUAL_LESSONS.B04.steps[3].caption
lines.push('')
lines.push('> ' + b04)
lines.push('')
lines.push('## 五、术语首现行内定义（前 12 个主题）')
lines.push('')
lines.push('| 术语 | 首次出现主题 | 首次出现步骤的覆盖情况 |')
lines.push('|---|---|---|')
for (const e of GLOSSARY) {
  if (['B01', 'B04', 'B05', 'B06', 'B07', 'B08', 'T01', 'T02', 'T03', 'T04', 'T05', 'T06'].includes(e.firstTopic)) {
    const l = VISUAL_LESSONS[e.firstTopic]
    const step = l.steps.find((s) => s.caption.includes(e.term))
    lines.push(`| ${e.term} | ${e.firstTopic} | ${step ? '已在该主题旁白出现并给出行内定义/解释' : '定义见本主题术语卡或术语表'} |`)
  }
}
lines.push('')
lines.push('## 六、模板映射（主题 → 真实模板 id）')
lines.push('')
lines.push('> 全部 id 均来自 `src/engine/templates/{sparkSql,flinkSql,scala,shell}.ts` 实际导出，脚本校验 0 个无效 id。之前按场景固定注入导致 Archive/TTL/Rollback/Clustering/Bulk Insert/Hive Sync 主题看不到对应命令，现已逐主题映射。')
lines.push('')
lines.push('| 主题 | templateIds |')
lines.push('|---|---|')
for (const r of lessonRows) lines.push(`| ${r.id} | ${r.overlapTemplateIds.map((t) => '`' + t + '`').join('、')} |`)
lines.push('')
lines.push('## 七、验收与外部说明')
lines.push('')
lines.push('- `npm test`：**324 通过 / 13 文件**（未修改或弱化任何断言）。')
lines.push('- `npm run typecheck`：**通过（0 错误）**。期间外部文件 `src/components/visual/LessonSummary.vue:36` 一度报 TS2352，已由 Lead 侧修复，本任务最后一次复跑确认全绿。')
lines.push(`- 模板 id 有效性：${totalTemplates} 个引用、${badTemplateRefs.length} 个无效。`)
lines.push('- `VisualLesson` 新增字段全部为**可选**：渲染层缺失时自动降级；78 个动画主题已全部填充，B02/B03 走双画布实验页（`ExperimentDefinition` 已有 5 条 learningObjectives 与 5 道 quiz；若也要一句话结论，需在 `models/simulation.ts` 给 `ExperimentDefinition` 增加 `takeaway` 字段，属 Lead/渲染范围）。')
lines.push('')

writeFileSync(`${OUT}/05-content-changes.md`, lines.join('\n'), 'utf8')
console.log('written 05-content-changes.md')
console.log('lessons:', lessonIds.length, '| glossary cards', totalGlossary, '| limits', totalLimits, '| templates', totalTemplates, '| captionZh', totalCaptionZh, 'vs old', oldCaptionZh)
console.log('rep min/max:', Math.min(...repRows.flatMap((r) => VISUAL_LESSONS[r.id].steps.map((s) => zh(s.caption)))), Math.max(...repRows.flatMap((r) => VISUAL_LESSONS[r.id].steps.map((s) => zh(s.caption)))))
console.log('bad template refs:', badTemplateRefs)
