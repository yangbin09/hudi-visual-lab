import { readFileSync, writeFileSync } from 'node:fs'
const G = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/visual/glossary.ts'
const L = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/visual/lesson-content.ts'

let g = readFileSync(G, 'utf8')
const gOld = "def: 'Base File 加若干 Log File 组成的一次快照引用',"
if (!g.includes(gOld)) throw new Error('glossary old not found')
g = g.replace(gOld, "def: 'Base 加若干 Log 组成的一次快照引用',")
writeFileSync(G, g, 'utf8')

let l = readFileSync(L, 'utf8')
const pairs = [
  ['所以空间释放要等 Clean 的保留窗口过去。', '所以空间释放要等 Clean 的保留窗口过去，这也解释了 MOR 的存储成本究竟从哪来。'],
  ['所以 1001 的金额仍停留在 Base 文件里的旧值 100.5。', '所以 1001 的金额仍停留在 Base 文件里的旧值 100.5，两种读法的差异就来自是否合并 Log。'],
  ['所以“MOR 表必须及时 Compaction”的根因就是两种读法在可见性上的差异。', '所以“MOR 表必须及时 Compaction”的根因就是两种读法在可见性上的差异，越早合并越早一致。'],
  ['所以读放大下降、查询变快。', '所以读放大下降、查询变快，这也是 Compaction 最直接的收益。'],
]
for (const [a, b] of pairs) {
  const n = l.split(a).length - 1
  if (n !== 1) throw new Error(`match ${n} for: ${a}`)
  l = l.replace(a, b)
}
writeFileSync(L, l, 'utf8')
console.log('patched')
