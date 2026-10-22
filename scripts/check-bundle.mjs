import { readFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'))
async function measure(roots){
  const visited=new Set(),files=new Set()
  function visit(key){if(visited.has(key))return;visited.add(key);const c=manifest[key];if(!c)throw new Error(`Missing manifest entry ${key}`);files.add(c.file);for(const f of c.css??[])files.add(f);for(const dep of c.imports??[])visit(dep)}
  for(const root of roots)visit(root)
  let compressed=0
  for(const file of files){
    if(/vendor-(element|codemirror|echarts)/.test(file))throw new Error(`${roots.join(",")} eagerly loads ${file}`)
    compressed+=gzipSync(await readFile(`dist/${file}`)).length
  }
  return compressed
}
const lessonEntry=Object.entries(manifest).find(([,chunk])=>chunk.name==='LessonView' && chunk.file.endsWith('.js'))?.[0]
if(!lessonEntry)throw new Error('Lesson entry not found')
const home=await measure(['index.html','src/views/VisualHomeView.vue'])
const lesson=await measure(['index.html',lessonEntry])
const budgets={home:100*1024,lesson:220*1024}
console.log(`Initial static assets (gzip): home ${(home/1024).toFixed(1)} KiB / 100 KiB; lesson ${(lesson/1024).toFixed(1)} KiB / 220 KiB.`)
if(home>budgets.home||lesson>budgets.lesson)throw new Error('Initial download budget exceeded')
for(const chunk of Object.values(manifest)){if(chunk.file.endsWith('.js')&&(await stat(`dist/${chunk.file}`)).size>350*1024)throw new Error(`Oversized JavaScript chunk: ${chunk.file}`)}
