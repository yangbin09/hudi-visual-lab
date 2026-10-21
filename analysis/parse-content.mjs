// 只读分析脚本：解析 Hudi Visual Lab 教学内容，输出量化数据到 stdout / 02-data.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const ROOT = 'D:/code/hudi演示/hudi-visual-lab'
const OUT = 'D:/code/hudi演示/_analysis'
const esbuild = await import(pathToFileURL(`${ROOT}/node_modules/esbuild/lib/main.js`).href)
const { transformSync } = esbuild

function loadTs(rel) {
  const src = readFileSync(`${ROOT}/${rel}`, 'utf8')
  const code = transformSync(src, { loader: 'ts', format: 'esm', target: 'es2022' }).code
  writeFileSync(`${OUT}/tmp_${rel.replace(/[\\/.]/g, '_')}.mjs`, code)
  return import(pathToFileURL(`${OUT}/tmp_${rel.replace(/[\\/.]/g, '_')}.mjs`).href)
}

const lessonsMod = await loadTs('src/experiments/visual/lessons.ts')
const VISUAL_LESSONS = lessonsMod.VISUAL_LESSONS
const MODEL_LABEL = lessonsMod.MODEL_LABEL

const moduleFiles = [
  ['A', 'src/experiments/modules/A.basics.ts', 'MODULE_A_ENTRIES'],
  ['B', 'src/experiments/modules/B.ddl.ts', 'MODULE_B_ENTRIES'],
  ['C', 'src/experiments/modules/C.write.ts', 'MODULE_C_ENTRIES'],
  ['D', 'src/experiments/modules/D.index.ts', 'MODULE_D_ENTRIES'],
  ['E', 'src/experiments/modules/E.query.ts', 'MODULE_E_ENTRIES'],
  ['F', 'src/experiments/modules/F.services.ts', 'MODULE_F_ENTRIES'],
  ['G', 'src/experiments/modules/G.integration.ts', 'MODULE_G_ENTRIES'],
  ['H', 'src/experiments/modules/H.lab.ts', 'MODULE_H_ENTRIES'],
  ['I', 'src/experiments/modules/I.advanced.ts', 'MODULE_I_ENTRIES'],
]
const entries = []
for (const [mod, file, exportName] of moduleFiles) {
  const m = await loadTs(file)
  for (const e of m[exportName]) entries.push({ ...e, module: mod })
}
const order = entries.map(e => e.id)
const orderIdx = Object.fromEntries(order.map((id, i) => [id, i]))

// ---------- 基础统计 ----------
const zhLen = s => (s.match(/[\u4e00-\u9fff]/g) || []).length
const charLen = s => [...s].length

const perLesson = []
for (const [id, l] of Object.entries(VISUAL_LESSONS)) {
  const caps = l.steps.map(s => s.caption)
  perLesson.push({
    id,
    module: entries.find(e => e.id === id)?.module,
    order: orderIdx[id],
    kind: l.kind,
    seed: l.seed,
    model: l.model,
    modelLabel: MODEL_LABEL[l.model],
    nodes: l.nodes,
    steps: l.steps.length,
    stepTitles: l.steps.map(s => s.title),
    captions: caps,
    captionChars: caps.map(charLen),
    captionZh: caps.map(zhLen),
    totalChars: caps.reduce((a, c) => a + charLen(c), 0),
    totalZh: caps.reduce((a, c) => a + zhLen(c), 0),
    operations: l.steps.map(s => s.operation ?? null),
    moments: l.steps.map(s => (s.moments ? s.moments.length : 0)),
    hasMoments: l.steps.some(s => s.moments && s.moments.length),
    hasLimitation: !!l.limitation,
    controls: l.controls,
    titles: l.steps.map(s => s.title),
  })
}
perLesson.sort((a, b) => a.order - b.order)

// ---------- 术语 ----------
const TERMS = [
  ['File Group', /File Group|FileGroup|FileGroup|文件组/g],
  ['File Slice', /File Slice|文件切片/g],
  ['Base File', /Base File|Base 文件|BaseFile|基础文件/g],
  ['Log File', /Log File|Log 文件|日志文件/g],
  ['Instant', /Instant|instant/g],
  ['Timeline', /Timeline|时间线/g],
  ['Commit', /Commit|commit|提交/g],
  ['Compaction', /Compaction|compaction|压缩合并/g],
  ['Clustering', /Clustering|clustering|聚类|重组/g],
  ['HoodieKey', /HoodieKey|Hoodie Key/g],
  ['Record Key', /Record Key|recordkey|recordKey|主键/g],
  ['Partition Path', /Partition Path|partition path|分区路径/g],
  ['Bucket', /Bucket|bucket|分桶|桶/g],
  ['Precombine', /Precombine|precombine|preCombine|预合并/g],
  ['COW', /COW|Copy On Write|Copy-On-Write/g],
  ['MOR', /MOR|Merge On Read|Merge-On-Read/g],
  ['Read Optimized', /Read Optimized|read-optimized|读优化/g],
  ['Snapshot', /Snapshot|snapshot|快照/g],
  ['Incremental', /Incremental|incremental|增量/g],
  ['Metadata Table', /Metadata Table|metadata table|元数据表/g],
  ['Archive', /Archive|archive|归档/g],
  ['Clean', /Cleaner|Clean|clean|清理/g],
  ['Rollback', /Rollback|rollback|回滚/g],
  ['TTL', /TTL|t\s?t\s?l/g],
  ['Pending', /Pending|pending|未完成/g],
  ['Checkpoint', /Checkpoint|checkpoint|检查点/g],
  ['ReplaceCommit', /ReplaceCommit|replacecommit|replace commit/g],
  ['DeltaCommit', /DeltaCommit|delta commit|DELTA_COMMIT/g],
  ['Hive Sync / HMS', /Hive Sync|HMS|Hive Metastore|hive-sync|HiveSync/g],
  ['HDFS', /HDFS|Hdfs/g],
  ['OCC / 并发控制', /OCC|乐观并发|并发控制/g],
  ['Bulk Insert', /Bulk Insert|bulk_insert|BULK_INSERT|bulk insert/g],
  ['SaveMode', /SaveMode/g],
  ['Schema', /Schema|schema/g],
  ['File ID', /File ID|fileId|file id/g],
  ['Flink', /Flink/g],
  ['Spark', /Spark/g],
  ['Kerberos', /Kerberos|keytab/g],
]
function scan(text) {
  const found = {}
  for (const [name, re] of TERMS) {
    re.lastIndex = 0
    const m = text.match(re)
    if (m) found[name] = m.length
  }
  return found
}
const termStats = {}
for (const [name] of TERMS) termStats[name] = { caption: 0, lessonMeta: 0, summary: 0, note: 0, places: [] }
for (const l of perLesson) {
  const capText = l.captions.join(' ')
  const metaText = [...l.titles, ...l.nodes].join(' ')
  const c = scan(capText), m = scan(metaText)
  for (const k in c) termStats[k].caption += c[k]
  for (const k in m) termStats[k].lessonMeta += m[k]
}
for (const e of entries) {
  const s = scan(e.summary), n = scan(e.note ?? '')
  for (const k in s) termStats[k].summary += s[k]
  for (const k in n) termStats[k].note += n[k]
}
// 每个术语在课程顺序中的首次出现（步骤文案或步骤标题/节点，或摘要）
const firstSeen = {}
for (const l of perLesson) {
  for (const [t, re] of TERMS) {
    if (firstSeen[t]) continue
    const idxStep = l.captions.findIndex(c => { re.lastIndex = 0; return re.test(c) })
    const idxTitle = l.titles.findIndex(c => { re.lastIndex = 0; return re.test(c) })
    const nodeHit = l.nodes.some(n => { re.lastIndex = 0; return re.test(n) })
    if (idxStep >= 0 || idxTitle >= 0 || nodeHit) {
      firstSeen[t] = {
        id: l.id,
        stepNo: idxStep >= 0 ? idxStep + 1 : idxTitle >= 0 ? idxTitle + 1 : 1,
        source: idxStep >= 0 ? 'caption' : idxTitle >= 0 ? 'stepTitle' : 'node',
        text: idxStep >= 0 ? l.captions[idxStep] : idxTitle >= 0 ? l.titles[idxTitle] : l.nodes.find(n => { re.lastIndex = 0; return re.test(n) }),
      }
    }
  }
}

// ---------- 免责/限定话术 ----------
const hedgePatterns = [
  ['待验证', /待验证/g],
  ['待实测', /待实测|需实测|仍要实测|需要实测/g],
  ['教学模型', /教学模型/g],
  ['模拟', /模拟/g],
  ['不连接真实集群', /不连接真实|未连接真实|未连接|不连接/g],
  ['示意 / 机制示意', /示意/g],
  ['不伪造 / 避免虚构', /不伪造|未伪造|避免虚构|不虚构|不编造|不宣称|不能当成|不代表/g],
  ['未实现 / 未建模', /未实现|未建模|尚未建模|未执行|不模型?模拟/g],
  ['假设 / 本案例', /假设|本案例|当前教学/g],
  ['仅展示 / 不能推断', /不能推断|不能换算|不换算|仅展示|只展示|不代表实测|不代表真实/g],
]
const hedgeStats = Object.fromEntries(hedgePatterns.map(([k]) => [k, 0]))
const hedgeHits = []
for (const l of perLesson) {
  l.captions.forEach((c, i) => {
    for (const [k, re] of hedgePatterns) {
      re.lastIndex = 0
      const m = c.match(re)
      if (m) { hedgeStats[k] += m.length; hedgeHits.push({ id: l.id, step: i + 1, kind: k, text: c }) }
    }
  })
  for (const [k, re] of hedgePatterns) {
    const t = [...l.titles, ...l.nodes].join(' ')
    re.lastIndex = 0
    const m = t.match(re)
    if (m) hedgeStats[k] += m.length
  }
}
const hedgeSummary = {}
for (const e of entries) {
  const t = [e.title, e.summary, e.note ?? '', e.supportState, e.evidenceLevel].join(' ')
  for (const [k, re] of hedgePatterns) { re.lastIndex = 0; const m = t.match(re); if (m) hedgeSummary[k] = (hedgeSummary[k] ?? 0) + m.length }
}

// ---------- 重复度 ----------
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b)
  const inter = [...A].filter(x => B.has(x)).length
  const uni = new Set([...A, ...B]).size
  return uni ? inter / uni : 0
}
const dupPairs = []
for (let i = 0; i < perLesson.length; i++) for (let j = i + 1; j < perLesson.length; j++) {
  const a = perLesson[i], b = perLesson[j]
  const capSim = jaccard(a.captions.map(c => c.slice(0, 8)), b.captions.map(c => c.slice(0, 8)))
  const nodeSim = jaccard(a.nodes, b.nodes)
  const titleSim = jaccard(a.titles, b.titles)
  const score = +(capSim * 0.2 + nodeSim * 0.5 + titleSim * 0.3).toFixed(2)
  if (score >= 0.35) dupPairs.push({ a: a.id, b: b.id, capSim: +capSim.toFixed(2), nodeSim: +nodeSim.toFixed(2), titleSim: +titleSim.toFixed(2), score })
}
dupPairs.sort((a, b) => b.score - a.score)

// ---------- 结构完整性 ----------
const structure = entries.map(e => {
  const l = VISUAL_LESSONS[e.id]
  return {
    id: e.id, module: e.module, title: e.title,
    hasSummary: !!e.summary, hasNote: !!e.note,
    lesson: !!l,
    steps: l ? l.steps.length : 0,
    evidenceLevel: e.evidenceLevel, supportState: e.supportState,
    model: l?.model ?? (e.id === 'B02' || e.id === 'B03' ? 'experiment' : 'none'),
  }
})

// ---------- 认知负荷代理 ----------
const load = perLesson.map(l => {
  const termsInLesson = new Set()
  const text = [...l.captions, ...l.titles, ...l.nodes].join(' ')
  for (const [t, re] of TERMS) { re.lastIndex = 0; if (re.test(text)) termsInLesson.add(t) }
  return { id: l.id, order: l.order, steps: l.steps, terms: termsInLesson.size, chars: l.totalChars, load: +(l.steps * 1.0 + termsInLesson.size * 1.5 + l.totalChars / 120).toFixed(1) }
})

// ---------- 输出 ----------
const data = {
  catalogCount: entries.length,
  lessonCount: Object.keys(VISUAL_LESSONS).length,
  missingLessons: order.filter(id => !VISUAL_LESSONS[id]),
  perLesson, entries, termStats, firstSeen, hedgeStats, hedgeSummary, hedgeHits, dupPairs, structure, load,
}
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/02-data.json`, JSON.stringify(data, null, 1))

// 打印摘要
const caps = perLesson.flatMap(l => l.captions)
const lens = caps.map(charLen).sort((a, b) => a - b)
const fmt = n => String(n).padEnd(14)
console.log('=== 总量 ===')
console.log('catalog entries:', entries.length, '| visual lessons:', Object.keys(VISUAL_LESSONS).length, '| 缺课:', order.filter(id => !VISUAL_LESSONS[id]).join(','))
console.log('step 总数:', caps.length)
console.log('=== 字数 ===')
console.log('平均 chars:', (lens.reduce((a, b) => a + b, 0) / lens.length).toFixed(1), '| 中位:', lens[Math.floor(lens.length / 2)], '| p90:', lens[Math.floor(lens.length * 0.9)], '| 最大:', lens.at(-1), '| 最小:', lens[0])
console.log('=== 每主题步骤数分布 ===')
const stepDist = {}
for (const l of perLesson) stepDist[l.steps] = (stepDist[l.steps] ?? 0) + 1
console.log(stepDist)
console.log('=== 术语首次出现 ===')
for (const [t, r] of Object.entries(firstSeen)) console.log(`${t}\t首次=${r.id} step${r.stepNo} (${r.source})「${String(r.text).slice(0, 40)}」 total=${termStats[t].caption}/${termStats[t].lessonMeta} summary=${termStats[t].summary}`)
console.log('=== 免责话术（步骤文案）===')
console.log(hedgeStats)
console.log('=== 重复对 top ===')
for (const p of dupPairs.slice(0, 15)) console.log(p)
console.log('=== 负荷 ===')
console.log(load.map(l => `${l.id}:${l.steps}步/${l.terms}术语/${l.chars}字/负荷${l.load}`).join('  '))
