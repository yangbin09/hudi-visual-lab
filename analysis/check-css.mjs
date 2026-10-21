import fs from 'node:fs'

const pairs = [
  ['D:/code/hudi演示/_analysis/orig-visual-lab.css', 'D:/code/hudi演示/hudi-visual-lab/src/styles/visual-lab.css'],
  ['D:/code/hudi演示/_analysis/orig-lessons.css', 'D:/code/hudi演示/hudi-visual-lab/src/styles/lessons.css'],
  ['D:/code/hudi演示/_analysis/orig-main.css', 'D:/code/hudi演示/hudi-visual-lab/src/styles/main.css'],
]

const norm = (s) => s.replace(/\s+/g, '').replace(/\s*,\s*/g, ',').trim()
function selectors(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = []
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim()
    if (sel.startsWith('@')) continue
    out.push(norm(sel))
  }
  return out
}
function braceCheck(css) {
  let d = 0
  for (const ch of css) {
    if (ch === '{') d++
    else if (ch === '}') d--
    if (d < 0) return 'NEGATIVE'
  }
  return d === 0 ? 'OK' : 'UNBALANCED ' + d
}

let bad = 0
for (const [oldF, newF] of pairs) {
  const oldCss = fs.readFileSync(oldF, 'utf8')
  const newCss = fs.readFileSync(newF, 'utf8')
  const os = new Set(selectors(oldCss))
  const ns = new Set(selectors(newCss))
  const missing = [...os].filter((s) => !ns.has(s))
  const added = [...ns].filter((s) => !os.has(s))
  console.log('\n=== ' + newF.split('/').pop())
  console.log('braces:', braceCheck(newCss), '| rules old/new:', os.size, '/', ns.size)
  console.log('MISSING selectors (' + missing.length + '):')
  missing.forEach((s) => console.log('  -', s))
  console.log('ADDED selectors (' + added.length + '):')
  added.forEach((s) => console.log('  +', s))
  if (missing.length) bad++
}
// small font sizes left?
for (const [, f] of pairs) {
  const css = fs.readFileSync(f, 'utf8')
  const hits = [...css.matchAll(/font(?:-size)?\s*:\s*(9|10|11)px/gi)].map((m) => m[0])
  console.log('\nsmall font sizes in', f.split('/').pop(), ':', hits.length, hits)
}
process.exit(bad ? 1 : 0)
