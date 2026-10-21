import { readFileSync, writeFileSync } from 'node:fs'
const L = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/visual/lesson-content.ts'
let l = readFileSync(L, 'utf8')
const a = '所以计划里只出现这些 File ID，其余文件组不受影响。'
const b = '所以计划里只出现这些 File ID，其余文件组不受影响，这一步只写计划、不改任何数据文件。'
const n = l.split(a).length - 1
if (n !== 1) throw new Error(`match ${n}`)
l = l.replace(a, b)
writeFileSync(L, l, 'utf8')
console.log('patched B05#4')
