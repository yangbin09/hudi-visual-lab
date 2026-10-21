import { chromium } from '@playwright/test'
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://127.0.0.1:5173/experiment/B05', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const out = await p.evaluate(async () => {
  const resources = performance.getEntriesByType('resource').map(e => e.name)
  const vueUrl = resources.find(u => /\/node_modules\/\.vite\/deps\/vue\.js/.test(u))
  const Vue = await import(vueUrl)
  const [{ default: Dock }, { visualLesson }, scenarios, catalog, templates] = await Promise.all([
    import('/src/components/lesson/LessonDock.vue'), import('/src/experiments/visual/lessons.ts'),
    import('/src/engine/visual/scenarios.ts'), import('/src/experiments/catalog.ts'), import('/src/engine/templates/index.ts'),
  ])
  const lesson = visualLesson('B05'); const run = scenarios.buildLessonRun(lesson, scenarios.defaultParameters(lesson)); const frame = run.frames[2]; const state = frame.after
  const t = state.table
  const ctx = templates.createTemplateContext({ database: t.databaseName, table: t.tableName, qualifiedTable: 'x', tablePath: t.tablePath, tableType: 'cow', primaryKey: t.primaryKey ?? '', preCombineField: t.preCombineField ?? '', partitionFields: t.partitionFields.join(','), partitionKey: t.partitionFields[0] ?? '', partitionValue: '2024-01-01', recordKey: '1001', indexType: t.indexType })
  const blocks = ['spark-upsert','spark-delete','spark-compaction-inline'].map(tid => { const tpl = templates.findTemplate(tid); return tpl ? { ...tpl, code: templates.buildSql(tpl.language, tid, ctx) } : null }).filter(Boolean)
  const host = document.createElement('div'); host.className='dock-test-host'; host.style.cssText='position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--vl-bg);padding:12px;box-sizing:border-box'
  const shell = document.createElement('div'); shell.className='visual-lab'; shell.style.cssText='width:336px;background:var(--vl-bg)'
  host.appendChild(shell); document.body.appendChild(host)
  const app = Vue.createApp({ render: () => Vue.h(Dock, { lessonId:'B05', lesson, frame, state, templates: blocks, evidenceIds: catalog.getCatalogEntry('B05')?.evidenceIds ?? [] }) })
  app.mount(shell); await new Promise(r=>setTimeout(r,500))
  function scan(label) {
    const root = document.querySelector('.lesson-dock'); const rr = root.getBoundingClientRect()
    const rows = []
    for (const el of root.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (!r.width) continue
      if (r.right > rr.right + 0.5) rows.push({ cls: String(el.getAttribute('class') || el.tagName).slice(0,70), right: Math.round(r.right*10)/10, w: Math.round(r.width), text: (el.textContent||'').trim().replace(/\s+/g,' ').slice(0,24) })
      if (rows.length > 12) break
    }
    return { label, dockRight: Math.round(rr.right*10)/10, dockScrollW: root.scrollWidth, clientW: root.clientWidth, rows }
  }
  const res = {}
  res.explain = scan('explain')
  ;[...document.querySelectorAll('.dock-tab')].find(b=>b.textContent.includes('代码'))?.click()
  await new Promise(r=>setTimeout(r,500))
  res.code = scan('code')
  return res
})
console.log(JSON.stringify(out, null, 1))
await b.close()
