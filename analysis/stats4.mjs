import { readFileSync } from 'node:fs'
const D = JSON.parse(readFileSync('D:/code/hudi演示/_analysis/02-data.json', 'utf8'))
const { perLesson, entries, termStats } = D
const order = entries.map(e => e.id)
const idx = Object.fromEntries(order.map((id, i) => [id, i]))

const TERMS = Object.keys(termStats)
const rows = []
for (const t of TERMS) {
  const pat = { 'File Group': /File Group|FileGroup|文件组/, 'File Slice': /File Slice|文件切片/, 'Base File': /Base File|Base 文件|BaseFile/, 'Log File': /Log File|Log 文件|日志文件/, 'Instant': /Instant/, 'Timeline': /Timeline|时间线/, 'Commit': /Commit|commit|提交/, 'Compaction': /Compaction/, 'Clustering': /Clustering|聚类|重组/, 'HoodieKey': /HoodieKey/, 'Record Key': /Record Key|recordKey|recordkey|主键/, 'Partition Path': /Partition Path|partition path|分区路径/, 'Bucket': /Bucket|分桶|桶/, 'Precombine': /Precombine|precombine|preCombine/, 'COW': /COW|Copy On Write/, 'MOR': /MOR|Merge On Read/, 'Read Optimized': /Read Optimized|read-optimized|读优化/, 'Snapshot': /Snapshot|快照/, 'Incremental': /Incremental|增量/, 'Metadata Table': /Metadata Table|元数据表/, 'Archive': /Archive|归档/, 'Clean': /Cleaner|Clean|清理/, 'Rollback': /Rollback|回滚/, 'TTL': /TTL/, 'Pending': /Pending|未完成/, 'Checkpoint': /Checkpoint|检查点/, 'ReplaceCommit': /ReplaceCommit|replacecommit|replace commit/, 'DeltaCommit': /DeltaCommit|DELTA_COMMIT/, 'Hive Sync / HMS': /HMS|Hive Metastore|Hive Sync/, 'HDFS': /HDFS/, 'OCC / 并发控制': /OCC|并发控制/, 'Bulk Insert': /Bulk Insert|bulk_insert|BULK_INSERT/, 'SaveMode': /SaveMode/, 'Schema': /Schema/, 'File ID': /File ID|fileId/, 'Flink': /Flink/, 'Spark': /Spark/, 'Kerberos': /Kerberos|keytab/ }[t]
  const lessonIds = []
  for (const l of perLesson) {
    const text = [...l.captions, ...l.titles, ...l.nodes].join(' ')
    if (pat && pat.test(text)) lessonIds.push(l.id)
  }
  const inSummary = entries.filter(e => pat && pat.test(e.summary)).map(e => e.id)
  const inNote = entries.filter(e => e.note && pat.test(e.note)).map(e => e.id)
  rows.push({
    term: t, captions: termStats[t].caption, nodesTitles: termStats[t].lessonMeta,
    lessons: lessonIds.length, first: lessonIds[0] ?? '-', last: lessonIds.at(-1) ?? '-',
    summaryTopics: inSummary.length, noteTopics: inNote.length,
    lessonList: lessonIds,
  })
}
rows.sort((a, b) => b.captions + b.nodesTitles - (a.captions + a.nodesTitles))
console.log('term | 旁白命中 | 标题/节点命中 | 覆盖主题数 | 首次 | 末次 | summary提及主题数 | note提及主题数')
for (const r of rows) console.log(`${r.term} | ${r.captions} | ${r.nodesTitles} | ${r.lessons} | ${r.first} | ${r.last} | ${r.summaryTopics} | ${r.noteTopics}`)
console.log('\n=== 术语覆盖主题明细（≥2 才列）===')
for (const r of rows) if (r.lessons >= 2) console.log(`${r.term}: ${r.lessonList.join(',')}`)

// 模块统计
const MOD = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
console.log('\n=== 模块统计 ===')
for (const m of MOD) {
  const ls = perLesson.filter(l => l.module === m)
  const es = entries.filter(e => e.module === m)
  const chars = ls.reduce((a, l) => a + l.totalChars, 0)
  const steps = ls.reduce((a, l) => a + l.steps, 0)
  console.log(`模块 ${m}: 目录 ${es.length} 条 / 视觉主题 ${ls.length} 个 / 步骤 ${steps} / 旁白 ${chars} 字 / 平均 ${(chars / steps).toFixed(1)} 字/步 / 证据等级 ${[...new Set(es.map(e => e.evidenceLevel))].join('/')} / support ${JSON.stringify(es.reduce((a, e) => (a[e.supportState] = (a[e.supportState] ?? 0) + 1, a), {}))}`)
}
const levelCount = entries.reduce((a, e) => (a[e.evidenceLevel] = (a[e.evidenceLevel] ?? 0) + 1, a), {})
const supportCount = entries.reduce((a, e) => (a[e.supportState] = (a[e.supportState] ?? 0) + 1, a), {})
const noteCount = entries.filter(e => e.note).length
console.log('\n证据等级分布:', levelCount, '| supportState:', supportCount, '| 有 note 的条目:', noteCount, '/80')
