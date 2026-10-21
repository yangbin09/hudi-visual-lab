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
  const blocks = ['spark-upsert','spark-delete'].map(tid => { const tpl = templates.findTemplate(tid); return tpl ? { ...tpl, code: templates.buildSql(tpl.language, tid, ctx) } : null }).filter(Boolean)
  const quiz = [{ id: 'q1', prompt: '本步之后，旧 Base 文件会立即消失吗？', options: [{ id: 'A', text: '会，新 Base 提交后旧文件马上删除' }, { id: 'B', text: '不会，旧文件要等 Cleaner 按保留窗口回收' }, { id: 'C', text: '取决于是否开启了 Metadata Table' }], answerIds: ['B'], explanation: 'Compaction 只切换引用；物理删除由 Cleaner 决定。' }, { id: 'q2', prompt: 'Snapshot 读取会看到 Log 中的更新吗？', multiple: true, options: [{ id: 'A', text: 'COW：直接读新 Base' }, { id: 'B', text: 'MOR：归并 Base 与 Log' }, { id: 'C', text: 'Read Optimized：跳过 Log' }], answerIds: ['A','B'], explanation: 'Snapshot 是逻辑视图；Read Optimized 才跳过 Log。' }]
  const host = document.createElement('div'); host.className='dock-test-host'; host.style.cssText='position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--vl-bg);padding:12px;box-sizing:border-box'
  const shell = document.createElement('div'); shell.className='visual-lab'; shell.style.cssText='width:336px;background:var(--vl-bg)'
  host.appendChild(shell); document.body.appendChild(host)
  const app = Vue.createApp({ render: () => Vue.h(Dock, { lessonId:'B05', lesson, frame, state, templates: blocks, evidenceIds: catalog.getCatalogEntry('B05')?.evidenceIds ?? [], quiz }) })
  app.mount(shell); await new Promise(r=>setTimeout(r,500))
  const root = document.querySelector('.lesson-dock')
  const bad = []
  for (const el of root.querySelectorAll('*')) {
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      const cs = getComputedStyle(el)
      bad.push({ cls: String(el.getAttribute('class')||el.tagName).slice(0,60), scrollW: el.scrollWidth, clientW: el.clientWidth, overflowX: cs.overflowX, text: (el.textContent||'').trim().replace(/\s+/g,' ').slice(0,20) })
    }
  }
  const ev = () => { [...document.querySelectorAll('.dock-tab')].find(b=>b.textContent.includes('依据'))?.click() }
  ev(); await new Promise(r=>setTimeout(r,400))
  const root2 = document.querySelector('.lesson-dock'); const bad2 = []
  for (const el of root2.querySelectorAll('*')) { if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) { const cs = getComputedStyle(el); bad2.push({ cls: String(el.getAttribute('class')||el.tagName).slice(0,60), scrollW: el.scrollWidth, clientW: el.clientWidth, overflowX: cs.overflowX, text: (el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,20) }) } }
  return { explain: { dockScrollW: root.scrollWidth, dockClientW: root.clientWidth, bad: bad.slice(0, 8) }, evidence: { dockScrollW: root2.scrollWidth, dockClientW: root2.clientWidth, bad: bad2.slice(0, 8) } }
})
console.log(JSON.stringify(out, null, 1))
await b.close()
