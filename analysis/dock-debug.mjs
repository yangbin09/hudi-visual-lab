import { chromium } from '@playwright/test'
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
const logs = []
p.on('pageerror', e => logs.push('pageerror: ' + e.message))
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 240)) })
p.on('framenavigated', f => logs.push('navigated: ' + f.url()))
await p.goto('http://127.0.0.1:5173/experiment/B05', { waitUntil: 'networkidle' }); await p.waitForTimeout(800)
const out = await p.evaluate(async () => {
  const resources = performance.getEntriesByType('resource').map(e => e.name)
  const vueUrl = resources.find(u => /\/node_modules\/\.vite\/deps\/vue\.js/.test(u))
  const Vue = await import(vueUrl)
  const [{ default: Dock }, { visualLesson }, scenarios] = await Promise.all([
    import('/src/components/lesson/LessonDock.vue'),
    import('/src/experiments/visual/lessons.ts'),
    import('/src/engine/visual/scenarios.ts'),
  ])
  const lesson = visualLesson('B05')
  const run = scenarios.buildLessonRun(lesson, scenarios.defaultParameters(lesson))
  const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#000;padding:12px'
  const shell = document.createElement('div'); shell.className = 'visual-lab'; shell.style.cssText = 'width:760px;background:var(--vl-bg)'
  host.appendChild(shell); document.body.appendChild(host)
  const app = Vue.createApp({ render: () => Vue.h(Dock, { lesson, frame: run.frames[2], state: run.frames[2].after, lessonId: 'B05', evidenceIds: [] }) })
  app.mount(shell)
  await new Promise(r => setTimeout(r, 500))
  return { hasDock: !!document.querySelector('.lesson-dock'), html: shell.innerHTML.slice(0, 300), tabs: document.querySelectorAll('.dock-tab').length }
})
console.log(JSON.stringify({ out, logs: logs.slice(0, 8) }, null, 1))
await b.close()
