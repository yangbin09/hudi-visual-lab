import { readFileSync } from 'node:fs'
const D = JSON.parse(readFileSync('D:/code/hudi演示/_analysis/02-data.json', 'utf8'))
const { perLesson, entries } = D
const zh = s => (s.match(/[\u4e00-\u9fff]/g) || []).length
const bigrams = s => { const t = s.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, ''); const out = []; for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2)); return out }
const jac = (a, b) => { const A = new Set(a), B = new Set(b); const i = [...A].filter(x => B.has(x)).length; const u = new Set([...A, ...B]).size; return u ? i / u : 0 }

// 目录标题相似度
const titles = entries.map(e => ({ id: e.id, t: e.title, m: e.module }))
const tPairs = []
for (let i = 0; i < titles.length; i++) for (let j = i + 1; j < titles.length; j++) {
  const s = jac(bigrams(titles[i].t), bigrams(titles[j].t))
  if (s >= 0.34) tPairs.push({ a: titles[i].id, ta: titles[i].t, b: titles[j].id, tb: titles[j].t, sim: +s.toFixed(2) })
}
tPairs.sort((a, b) => b.sim - a.sim)
console.log('=== 目录标题高度相似 ===')
for (const p of tPairs) console.log(`${p.sim}  ${p.a}「${p.ta}」  ↔  ${p.b}「${p.tb}」`)

// 步骤标题重复统计
const stepTitleCount = {}
for (const l of perLesson) for (const t of l.titles) stepTitleCount[t] = (stepTitleCount[t] ?? 0) + 1
const uniqTitles = Object.keys(stepTitleCount).length
const totalTitles = perLesson.reduce((a, l) => a + l.titles.length, 0)
console.log(`\n步骤标题：${totalTitles} 条 / ${uniqTitles} 种（去重率 ${(uniqTitles / totalTitles * 100).toFixed(0)}%）；重复≥2 的标题：`)
console.log(Object.entries(stepTitleCount).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}×${n}`).join('  '))

// 节点列表完全相同的主题组
const nodeGroups = {}
for (const l of perLesson) { const k = l.nodes.join('|'); (nodeGroups[k] ??= []).push(l.id) }
console.log('\n=== 节点列表完全相同的主题组 ===')
for (const [k, ids] of Object.entries(nodeGroups)) if (ids.length > 1) console.log(ids.join(', '), '→', k)

// 旁白 bigram 相似对
const capPairs = []
for (let i = 0; i < perLesson.length; i++) for (let j = i + 1; j < perLesson.length; j++) {
  const a = perLesson[i], b = perLesson[j]
  const s = jac(a.captions.flatMap(bigrams), b.captions.flatMap(bigrams))
  if (s >= 0.12) capPairs.push({ a: a.id, b: b.id, sim: +s.toFixed(2) })
}
capPairs.sort((a, b) => b.sim - a.sim)
console.log('\n=== 旁白用词最接近的主题对 top12 ===')
console.log(capPairs.slice(0, 12))

// 术语密度 & 全英术语
const asciiTokens = perLesson.map(l => ({ id: l.id, n: (l.captions.join(' ') + l.titles.join(' ')).match(/[A-Za-z][A-Za-z0-9_.\-]*/g)?.length ?? 0, zh: l.totalZh }))
asciiTokens.sort((a, b) => b.n - a.n)
console.log('\n=== 英文术语 token 最多的主题 ===')
console.log(asciiTokens.slice(0, 10))
const totalAscii = asciiTokens.reduce((a, x) => a + x.n, 0)
console.log('全部步骤+标题中的英文 token 数:', totalAscii, '| 中文总字数:', perLesson.reduce((a, l) => a + l.totalZh, 0))

// 每个主题步骤中出现的术语种类（英文 token 去重）
const uniqAscii = new Set()
for (const l of perLesson) for (const m of (l.captions.join(' ') + l.titles.join(' ') + l.nodes.join(' ')).match(/[A-Za-z][A-Za-z0-9_.\-]*/g) ?? []) uniqAscii.add(m.toLowerCase())
console.log('不同英文 token 种数:', uniqAscii.size)
console.log([...uniqAscii].sort().join(' '))

// 中文术语同义/混用检查
const syn = [['提交', 'Instant', 'commit'], ['文件组', 'File Group'], ['桶', 'Bucket'], ['压缩', 'Compaction'], ['合并', 'Compaction'], ['清理', 'Clean'], ['归档', 'Archive'], ['回滚', 'Rollback'], ['快照', 'Snapshot'], ['时间线', 'Timeline'], ['缓存', 'Checkpoint']]
for (const group of syn) {
  const hits = {}
  for (const w of group) {
    let n = 0
    for (const l of perLesson) { const t = l.captions.join(' ') + ' ' + l.titles.join(' ') + ' ' + l.nodes.join(' '); n += (t.match(new RegExp(w, 'g')) || []).length }
    hits[w] = n
  }
  console.log('同义词组', group.join(' / '), '→', hits)
}
