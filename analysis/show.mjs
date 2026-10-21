import fs from 'node:fs'
const f = process.argv[2]
const j = JSON.parse(fs.readFileSync(f, 'utf8'))
const keys = process.argv.slice(3)
if (!keys.length) console.log(Object.keys(j))
else for (const k of keys) console.log(k, '\n', JSON.stringify(j[k], null, 1).slice(0, 12000))
