import { readFileSync, writeFileSync } from 'node:fs'
const D = JSON.parse(readFileSync('D:/code/hudi演示/_analysis/02-data.json', 'utf8'))
const { perLesson, entries, hedgeHits } = D
const order = entries.map(e => e.id)
const idx = Object.fromEntries(order.map((id, i) => [id, i]))
const moduleOf = Object.fromEntries(entries.map(e => [e.id, e.module]))
const zh = s => (s.match(/[\u4e00-\u9fff]/g) || []).length
const ascii = s => (s.match(/[A-Za-z][A-Za-z0-9_.-]*/g) || [])

// ---- 因果/解释词 ----
const causal = /因为|所以|原因|由于|因此|导致|从而|是为了|取决于|否则|相当于|意味着|本质|区别在于|而不是/
const instructionStart = /^(点击|选择|观察|查看|高亮|切换|调整|修改|让|把|先|进入|读取|执行|写入|打开)/
const phenomenonOnly = []
const casualCount = []
let causalN = 0, instrN = 0, total = 0
const capStarts = {}
for (const l of perLesson) l.captions.forEach((c, i) => {
  total++
  const st = c.slice(0, 2)
  const first2 = [...c].slice(0, 2).join('')
  capStarts[first2] = (capStarts[first2] ?? 0) + 1
  if (causal.test(c)) { causalN++; casualCount.push({ id: l.id, step: i + 1, c }) }
  if (instructionStart.test(c)) instrN++
  if (!causal.test(c) && zh(c) <= 12) phenomenonOnly.push({ id: l.id, step: i + 1, c, zh: zh(c) })
})
console.log('captions:', total, '| 含因果解释词:', causalN, `(${(causalN / total * 100).toFixed(0)}%)`, '| 以操作动词开头:', instrN, `(${(instrN / total * 100).toFixed(0)}%)`)
console.log('以「你会看到」开头:', perLesson.filter(l => l.captions.some(c => c.startsWith('你会看到'))).length)

// ---- 每主题旁白质量 ----
const scored = perLesson.map(l => {
  const n = l.captions.length
  const causalN2 = l.captions.filter(c => causal.test(c)).length
  const instr = l.captions.filter(c => instructionStart.test(c)).length
  const hedgeN = l.captions.filter(c => /示意|模拟|待验证|待实测|未实现|未建模|不伪造|不能|不代表|不连接/.test(c)).length
  return { id: l.id, avg: +(l.totalChars / n).toFixed(1), min: Math.min(...l.captionChars), causal: causalN2, instr, hedge: hedgeN, totalChars: l.totalChars }
}).sort((a, b) => (a.avg - b.avg) || (a.causal - b.causal))
console.log('\n=== 旁白最短 12 个主题（avg 字/步）===')
for (const s of scored.slice(0, 12)) console.log(s)
console.log('\n=== 无任何因果解释句的主题 ===')
for (const s of scored.filter(s => s.causal === 0)) console.log(s.id, 'avg', s.avg, 'instr', s.instr, '/', perLesson.find(l => l.id === s.id).steps, 'hedge', s.hedge)

// ---- 最短/最长 caption ----
const flat = []
for (const l of perLesson) l.captions.forEach((c, i) => flat.push({ id: l.id, step: i + 1, c, n: [...c].length, zh: zh(c), causal: causal.test(c) }))
flat.sort((a, b) => a.zh - b.zh)
console.log('\n=== 最短 15 条步骤旁白 ===')
for (const f of flat.slice(0, 15)) console.log(`${f.id}#${f.step} ${f.zh}字 ${f.n}字符 | ${f.c}`)
console.log('\n=== 最长 8 条步骤旁白 ===')
for (const f of flat.slice(-8)) console.log(`${f.id}#${f.step} ${f.zh}字 ${f.n}字符 | ${f.c}`)

// ---- 台词模板化：effect 序列 ----
const seq = {}
for (const l of perLesson) {
  const key = l.operations.map((o, i) => o ?? 'observe').join('>')
  seq[key] = (seq[key] ?? 0) + 1
}
console.log('\n=== operation 序列重复次数 top ===')
console.log(Object.entries(seq).sort((a, b) => b[1] - a[1]).slice(0, 12))

// ---- 节点标签中英混用 ----
let mixedLessons = 0, asciiNode = 0, totalNodes = 0
const mixedList = []
for (const l of perLesson) {
  totalNodes += l.nodes.length
  const cn = l.nodes.filter(n => /[\u4e00-\u9fff]/.test(n)).length
  const en = l.nodes.filter(n => /[A-Za-z]/.test(n)).length
  asciiNode += en
  if (cn && en) { mixedLessons++; mixedList.push(l.id) }
}
console.log(`\n节点标签：共 ${totalNodes} 个，含英文 ${asciiNode} 个 (${(asciiNode / totalNodes * 100).toFixed(0)}%)；同一主题内中英混排的主题 ${mixedLessons}/78`)
console.log('混排主题:', mixedList.join(','))

// ---- moments / limitation ----
console.log('\n=== 二级细节(moments)/限制声明 ===')
console.log('有 moments 的主题:', perLesson.filter(l => l.hasMoments).map(l => l.id))
console.log('设置 limitation 的主题:', perLesson.filter(l => l.hasLimitation).length)

// ---- 免责话术分布 ----
const hedgedLessons = [...new Set(hedgeHits.map(h => h.id))]
const hedgePerLesson = {}
for (const h of hedgeHits) hedgePerLesson[h.id] = (hedgePerLesson[h.id] ?? 0) + 1
console.log('\n=== 免责话术 ===')
console.log('出现限定话术的步骤数:', hedgeHits.length, '/', total, `(${(hedgeHits.length / total * 100).toFixed(0)}%)`, '| 涉及主题:', hedgedLessons.length, '/78')
console.log('步骤文案带免责的主题数 top:', Object.entries(hedgePerLesson).sort((a, b) => b[1] - a[1]))
console.log('按类型:', D.hedgeStats)
console.log('summary/note 中的限定话术:', D.hedgeSummary)

// ---- 前向引用分析 ----
const DEF = {
  'File Group': 'B04', 'File Slice': 'B04', 'Base File': 'B04', 'Log File': 'B04',
  'Timeline': 'S01', 'Instant': 'S01', 'Commit': 'S02', 'DeltaCommit': 'S02',
  'Compaction': 'S04', 'HoodieKey': 'B06', 'Record Key': 'B06', 'Partition Path': 'B06',
  'Precombine': 'T02', 'COW': 'B02', 'MOR': 'B03', 'Bucket': 'I03', 'Read Optimized': 'Q02',
  'Snapshot': 'Q01', 'Incremental': 'Q03', 'Checkpoint': 'Q04', 'Metadata Table': 'A03',
  'Archive': 'S07', 'Clean': 'S06', 'Rollback': 'S08', 'TTL': 'S11', 'Pending': 'S12',
  'Clustering': 'S10', 'ReplaceCommit': 'S10', 'Hive Sync / HMS': 'T06', 'Schema': 'T08',
  'Bulk Insert': 'W04', 'SaveMode': 'W07', 'File ID': 'B05', 'HDFS': 'B08', 'OCC / 并发控制': 'A04',
}
const seen = D.firstSeen
const fwd = []
for (const [term, defId] of Object.entries(DEF)) {
  const s = seen[term]
  if (!s) { fwd.push({ term, issue: '未在步骤/节点中出现', defId }); continue }
  if (idx[s.id] > idx[defId]) fwd.push({ term, usedIn: s.id, stepNo: s.stepNo, defId, defOrder: idx[defId], useOrder: idx[s.id], text: s.text })
}
console.log('\n=== 术语先用后定义（按目录顺序）===')
for (const f of fwd) console.log(f)

// ---- 每个术语所在主题（用于定义核验）----
console.log('\n=== 术语出现主题数与首次出现 ===')
for (const [term, s] of Object.entries(seen)) {
  const ids = []
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(' ').join('|'), 'i')
  for (const l of perLesson) if (l.captions.join(' ').match(term.split(' ')[0]) || l.titles.join(' ').includes(term.split(' ')[0])) ids.push(l.id)
  console.log(`${term}\t首次 ${s.id}#${s.stepNo}\t定义主题 ${DEF[term] ?? '无'}\t出现于 ${[...new Set(ids)].slice(0, 12).join(',')}`)
}

writeFileSync('D:/code/hudi演示/_analysis/02-stats2.json', JSON.stringify({ causalN, instrN, total, scored, flat, fwd, mixedLessons, hedgedLessons, hedgePerLesson, seq }, null, 1))
