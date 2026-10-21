// 校验内容层改动：全部 78 主题字段完整性 / 术语长度 / 代表主题旁白长度 / 免责话术残留 / 模板 id 有效性
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ROOT = 'D:/code/hudi演示/hudi-visual-lab'
const OUT = 'D:/code/hudi演示/_analysis'
mkdirSync(`${OUT}/tmpv`, { recursive: true })
const esbuild = await import(pathToFileURL(`${ROOT}/node_modules/esbuild/lib/main.js`).href)

async function bundle(rel, name) {
  const res = await esbuild.build({
    entryPoints: [`${ROOT}/${rel}`],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'silent',
  })
  const file = `${OUT}/tmpv/${name}.mjs`
  writeFileSync(file, res.outputFiles[0].text)
  return import(pathToFileURL(file).href)
}

const { VISUAL_LESSONS } = await bundle('src/experiments/visual/lessons.ts', 'lessons')
const { GLOSSARY } = await bundle('src/experiments/visual/glossary.ts', 'glossary')
const templateIds = new Set()
for (const [file, name] of [['sparkSql', 'sparkSql'], ['flinkSql', 'flinkSql'], ['scala', 'scala'], ['shell', 'shell']]) {
  const mod = await bundle(`src/engine/templates/${file}.ts`, name)
  const list = mod.SPARK_SQL_TEMPLATES ?? mod.FLINK_SQL_TEMPLATES ?? mod.SCALA_TEMPLATES ?? mod.SHELL_TEMPLATES
  for (const t of list) templateIds.add(t.id)
}

const zh = (s) => (s.match(/[\u4e00-\u9fff]/g) || []).length
const hedge = /示意|模拟|待验证|待实测|需实测|未实现|未建模|不伪造|本页|本案例|不推断|不宣称|不换算|不代表|不连接|教学引擎|教学策略|教学映射|机制示意/
const REPS = ['B01', 'B04', 'B05', 'I03', 'Q02', 'S01', 'S04', 'E01']
const errors = []
const rows = []
const ids = Object.keys(VISUAL_LESSONS)
for (const id of ids) {
  const l = VISUAL_LESSONS[id]
  if (!l.objective || l.objective.length < 8) errors.push(`${id}: objective 缺失/过短`)
  if (!l.takeaway || l.takeaway.length < 10) errors.push(`${id}: takeaway 缺失/过短`)
  if (!l.prerequisites?.length) errors.push(`${id}: prerequisites 缺失`)
  if (!l.limitations?.length) errors.push(`${id}: limitations 缺失`)
  if ((l.limitations?.length ?? 0) > 2) errors.push(`${id}: limitations 超过 2 条`)
  if (!l.glossary?.length) errors.push(`${id}: glossary 缺失（允许为空但有术语时应给出）`)
  if ((l.glossary?.length ?? 0) > 4) errors.push(`${id}: glossary 超过 4 个`)
  for (const g of l.glossary ?? []) {
    if (g.def.length > 30) errors.push(`${id}: glossary「${g.term}」def ${g.def.length} 字 > 30`)
    if (!GLOSSARY.some((e) => e.term === g.term)) errors.push(`${id}: glossary「${g.term}」不在术语表`)
  }
  if (!l.templateIds?.length) errors.push(`${id}: templateIds 缺失`)
  for (const t of l.templateIds ?? []) if (!templateIds.has(t)) errors.push(`${id}: 模板 id 不存在 ${t}`)
  const capHedge = l.steps.filter((s) => hedge.test(s.caption)).map((s) => s.title)
  if (capHedge.length) errors.push(`${id}: 旁白仍含免责话术 ${capHedge.join('/')}`)
  if (REPS.includes(id)) {
    l.steps.forEach((s, i) => {
      const n = zh(s.caption)
      if (n < 45 || n > 90) errors.push(`${id}#${i + 1}: 代表主题旁白汉字数 ${n} 不在 45–90`)
    })
  }
  rows.push({
    id,
    steps: l.steps.length,
    objectiveLen: l.objective?.length ?? 0,
    takeawayLen: l.takeaway?.length ?? 0,
    prerequisites: l.prerequisites?.length ?? 0,
    glossary: l.glossary?.length ?? 0,
    limitations: l.limitations?.length ?? 0,
    templates: l.templateIds?.length ?? 0,
    captionZh: l.steps.reduce((a, s) => a + zh(s.caption), 0),
    captionZhAvg: +(l.steps.reduce((a, s) => a + zh(s.caption), 0) / l.steps.length).toFixed(1),
  })
}

// 术语表校验
for (const e of GLOSSARY) {
  if (!e.term || !e.en || !e.def || !e.firstTopic) errors.push(`术语表缺字段：${e.term}`)
  if (e.def.length > 40) errors.push(`术语表「${e.term}」def ${e.def.length} 字 > 40`)
  if (!ids.includes(e.firstTopic) && !['B02', 'B03'].includes(e.firstTopic)) errors.push(`术语表「${e.term}」firstTopic ${e.firstTopic} 不存在`)
}

// 术语首次出现是否已覆盖（前 12 个主题）
const FIRST12 = ['B01', 'B04', 'B05', 'B06', 'B07', 'B08', 'T01', 'T02', 'T03', 'T04', 'T05', 'T06']
console.log('=== 术语首次出现主题（前 12 主题检查）===')
for (const e of GLOSSARY) {
  const inFirst12 = FIRST12.includes(e.firstTopic)
  if (inFirst12) {
    const l = VISUAL_LESSONS[e.firstTopic]
    const inline = l.steps.some((s) => s.caption.includes(e.term) && (s.caption.includes('：') || s.caption.includes('：') || s.caption.includes('（')))
    console.log(`${e.term}\tfirstTopic=${e.firstTopic}\t前12主题内=${inFirst12}\t行内定义=${inline}`)
  }
}

console.log('\n=== 汇总 ===')
console.log('主题数:', ids.length, '| 全部有 objective:', rows.every((r) => r.objectiveLen > 0), '| takeaway:', rows.every((r) => r.takeawayLen > 0))
console.log('glossary 平均:', (rows.reduce((a, r) => a + r.glossary, 0) / rows.length).toFixed(2), '| limitations 平均:', (rows.reduce((a, r) => a + r.limitations, 0) / rows.length).toFixed(2), '| templates 平均:', (rows.reduce((a, r) => a + r.templates, 0) / rows.length).toFixed(2))
console.log('旁白汉字/步：min', Math.min(...rows.map((r) => r.captionZhAvg)), 'max', Math.max(...rows.map((r) => r.captionZhAvg)), 'avg', (rows.reduce((a, r) => a + r.captionZhAvg, 0) / rows.length).toFixed(1))
console.log('术语表词数:', GLOSSARY.length, '| 模板 id 总数:', templateIds.size)
console.log('代表主题：')
for (const id of REPS) {
  const l = VISUAL_LESSONS[id]
  console.log(` ${id}: ` + l.steps.map((s, i) => `${i + 1}=${zh(s.caption)}字`).join(' '))
}
console.log('\n=== 错误 ===')
if (!errors.length) console.log('无')
else errors.forEach((e) => console.log('- ' + e))

writeFileSync(`${OUT}/05-verify.json`, JSON.stringify({ rows, errors, glossary: GLOSSARY.length, templateIds: [...templateIds] }, null, 1))
