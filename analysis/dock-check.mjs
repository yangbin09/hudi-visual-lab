// LessonDock 验证（单次 evaluate 内完成挂载/交互/测量，避免开发服务器 HMR 重载导致 DOM 丢失）
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const base = 'http://127.0.0.1:5173/'
const outDir = 'D:/code/hudi演示/_analysis/shots/'
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)) })
await page.goto(base + 'experiment/B05', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)

const RUN = async ({ width, withFrame, emptyMode }) => {
  const resources = performance.getEntriesByType('resource').map((e) => e.name)
  const vueUrl = resources.find((u) => /\/node_modules\/\.vite\/deps\/vue\.js/.test(u))
  if (!vueUrl) throw new Error('no vue runtime url')
  const Vue = await import(vueUrl)
  const [{ default: Dock }, { visualLesson }, scenarios, catalog, templates] = await Promise.all([
    import('/src/components/lesson/LessonDock.vue'),
    import('/src/experiments/visual/lessons.ts'),
    import('/src/engine/visual/scenarios.ts'),
    import('/src/experiments/catalog.ts'),
    import('/src/engine/templates/index.ts'),
  ])

  const id = 'B05'
  const lesson = visualLesson(id)
  const entry = catalog.getCatalogEntry(id)
  let frame = null
  let state = null
  let run = null
  if (!emptyMode) {
    run = scenarios.buildLessonRun(lesson, scenarios.defaultParameters(lesson))
    frame = run.frames[2]
    state = frame.after
  }
  let blocks = []
  if (state) {
    const t = state.table
    const ctx = templates.createTemplateContext({
      database: t.databaseName, table: t.tableName, qualifiedTable: `${t.databaseName}.${t.tableName}`,
      tablePath: t.tablePath, tableType: t.tableType === 'COPY_ON_WRITE' ? 'cow' : 'mor',
      primaryKey: t.primaryKey ?? '', preCombineField: t.preCombineField ?? '',
      partitionFields: t.partitionFields.join(','), partitionKey: t.partitionFields[0] ?? '',
      partitionValue: '2024-01-01', recordKey: '1001', indexType: t.indexType,
      beginInstantTime: run.initial.timeline[0]?.instantTime ?? '', asOfInstant: run.initial.checkpoints[0]?.instantTime ?? '',
    })
    blocks = ['spark-upsert', 'spark-delete', 'spark-compaction-inline'].map((tid) => {
      const tpl = templates.findTemplate(tid)
      return tpl ? { ...tpl, code: templates.buildSql(tpl.language, tid, ctx) } : null
    }).filter(Boolean)
  }
  const quiz = emptyMode ? [] : [
    { id: 'q1', prompt: '本步之后，旧 Base 文件会立即消失吗？', options: [
      { id: 'A', text: '会，新 Base 提交后旧文件马上删除' },
      { id: 'B', text: '不会，旧文件要等 Cleaner 按保留窗口回收' },
      { id: 'C', text: '取决于是否开启了 Metadata Table' },
    ], answerIds: ['B'], explanation: 'Compaction 只切换引用；物理删除由 Cleaner 决定。' },
    { id: 'q2', prompt: 'Snapshot 读取会看到 Log 中的更新吗？', multiple: true, options: [
      { id: 'A', text: 'COW：直接读新 Base' },
      { id: 'B', text: 'MOR：归并 Base 与 Log' },
      { id: 'C', text: 'Read Optimized：跳过 Log' },
    ], answerIds: ['A', 'B'], explanation: 'Snapshot 是逻辑视图；Read Optimized 才跳过 Log。' },
  ]

  // 清掉旧挂载
  document.querySelectorAll('.dock-test-host').forEach((n) => n.remove())
  const host = document.createElement('div')
  host.className = 'dock-test-host'
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--vl-bg,#151c20);padding:12px;box-sizing:border-box'
  const shell = document.createElement('div')
  shell.className = 'visual-lab'
  shell.style.cssText = `width:${width}px;max-width:100%;margin:0 auto;background:var(--vl-bg);color:var(--vl-ink)`
  host.appendChild(shell)
  document.body.appendChild(host)

  // 受控状态：记录 dock 抛出的 quiz 事件与 tab 切换
  const events = []
  const props = {
    lessonId: id, lesson, frame, state, templates: blocks,
    evidenceIds: emptyMode ? [] : (entry?.evidenceIds ?? ['EV-COMM-MOR']),
    quiz, modelLabel: '引擎驱动', progress: 0.6,
    evidenceLevel: emptyMode ? undefined : entry?.evidenceLevel,
    supportState: emptyMode ? undefined : entry?.supportState,
    note: emptyMode ? '' : (entry?.note ?? ''),
    limitations: emptyMode ? [] : ['BUCKET 分桶算法 r26 未确认（djb2 仅为教学算法）', 'Archive / Restore 的真实耗时与阻塞条件未在集群实测'],
    'onUpdate:quizScore': (v) => events.push({ type: 'quizScore', value: v }),
    'onQuiz-submit': (v) => events.push({ type: 'quizSubmit', value: v }),
    'onUpdate:activeTab': (v) => events.push({ type: 'tab', value: v }),
  }
  const app = Vue.createApp({ render: () => Vue.h(Dock, props) })
  app.mount(shell)
  const tick = () => new Promise((r) => setTimeout(r, 260))
  await tick()

  const dock = () => document.querySelector('.lesson-dock')
  const inner = () => (dock()?.innerText || '').replace(/\s+/g, ' ')
  function tabButton(label) {
    return [...document.querySelectorAll('.dock-tab')].find((b) => b.textContent.includes(label))
  }
  function measureDock(label) {
    const root = dock()
    if (!root) return { label, missing: true }
    const rr = root.getBoundingClientRect()
    const inScroller = (el) => {
      let n = el.parentElement
      while (n && n !== root) {
        const cs = getComputedStyle(n)
        if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return true
        n = n.parentElement
      }
      return false
    }
    const overflowers = []
    for (const el of root.querySelectorAll('*')) {
      if (inScroller(el)) continue
      const r = el.getBoundingClientRect()
      if (!r.width || !el.textContent?.trim()) continue
      if (r.right > rr.right + 1.5) {
        overflowers.push({ cls: String(el.getAttribute('class') || el.tagName).slice(0, 44), right: Math.round(r.right), text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 26) })
        if (overflowers.length > 6) break
      }
    }
    const tablist = root.querySelector('.dock-tablist')
    return {
      label,
      width: Math.round(rr.width),
      dockScrollW: root.scrollWidth,
      dockClientW: root.clientWidth,
      overflowers,
      pageScrollW: document.documentElement.scrollWidth,
      innerW: innerWidth,
      hostScroll: { scrollW: host.scrollWidth, clientW: host.clientWidth },
      tablist: tablist ? { scrollW: tablist.scrollWidth, clientW: tablist.clientWidth } : null,
      tabs: [...root.querySelectorAll('.dock-tab')].map((b) => ({
        label: b.querySelector('.dock-tab-label')?.textContent,
        hint: b.querySelector('.dock-tab-hint')?.textContent,
        selected: b.getAttribute('aria-selected'),
      })),
    }
  }

  const result = { width, emptyMode, viewport: { w: innerWidth, h: innerHeight }, steps: {} }

  if (emptyMode) {
    const empties = {}
    for (const [label, key] of [['解释', 'explain'], ['数据', 'data'], ['代码', 'code'], ['依据', 'evidence']]) {
      tabButton(label)?.click(); await tick()
      empties[key] = inner().slice(0, 220)
    }
    result.empties = empties
    result.hasQuizSection = inner().includes('自测')
    result.plainText = inner().slice(0, 500)
    return result
  }

  tabButton('解释')?.click(); await tick()
  result.steps.explain = measureDock('explain')
  result.explainText = inner().slice(0, 900)
  result.hasQuiz = !!document.querySelector('.lesson-dock [data-question-id]')
  result.sourceRowsBefore = document.querySelectorAll('.lesson-dock .source-item').length

  for (const [label, key] of [['数据', 'data'], ['代码', 'code'], ['依据', 'evidence']]) {
    tabButton(label)?.click(); await tick()
    result.steps[key] = measureDock(label)
    result[key + 'Text'] = inner().slice(0, 700)
  }

  // 数据分区结构
  tabButton('数据')?.click(); await tick()
  result.dataChecks = {
    fileRows: document.querySelectorAll('.lesson-dock .fv-row').length,
    recordRows: document.querySelectorAll('.lesson-dock .rt-row').length,
    timelineTableRows: document.querySelectorAll('.lesson-dock .tt-row').length,
    hasTimelineTableHeader: (document.querySelector('.lesson-dock .tt-root')?.innerText || '').includes('Instant Time'),
    hasTimelineAxis: !!document.querySelector('.lesson-dock .tv-root'),
    planCards: document.querySelectorAll('.lesson-dock .plan-card').length,
    planEmptyText: (document.querySelector('.lesson-dock')?.innerText || '').includes('当前没有 Compaction 计划'),
    jsonLeak: (document.querySelector('.lesson-dock')?.innerText || '').includes('"instantTime"'),
  }

  // 代码分区：字面 \n 检查 + 多行渲染
  tabButton('代码')?.click(); await tick()
  const codeText = document.querySelector('.lesson-dock')?.innerText || ''
  result.codeChecks = {
    literalBackslashN: codeText.includes('\\n'),
    sourceRows: document.querySelectorAll('.lesson-dock .source-item').length,
    sqlBlocks: document.querySelectorAll('.lesson-dock .cm-host, .lesson-dock .cm-editor').length,
    hasSourceMapHeading: codeText.includes('源码映射'),
    langLabels: ['Spark SQL', 'Scala', 'Flink', 'Shell'].filter((x) => codeText.includes(x)),
  }

  // 解释分区：数字表 + 自测受控
  tabButton('解释')?.click(); await tick()
  result.explainChecks = {
    metricRows: document.querySelectorAll('.lesson-dock .metric-table tbody tr').length,
    hasDelta: /操作前|操作后/.test(inner()),
    hasMoments: document.querySelectorAll('.lesson-dock .moment-item').length,
    hasFileChange: inner().includes('本步变化的物理文件'),
  }
  const q1 = document.querySelector('.lesson-dock [data-question-id="q1"]')
  const q2 = document.querySelector('.lesson-dock [data-question-id="q2"]')
  q1?.querySelectorAll('button')[1]?.click(); await tick()
  q2?.querySelectorAll('button')[0]?.click()
  q2?.querySelectorAll('button')[1]?.click(); await tick()
  const submitBtn = [...document.querySelectorAll('.lesson-dock button')].find((b) => b.textContent.trim() === '提交答案')
  submitBtn?.click(); await tick()
  result.quizChecks = {
    scoreBadge: (inner().match(/得分 \d+ 分（\d+ \/ \d+）/) || [null])[0],
    correctCount: document.querySelectorAll('.lesson-dock .text-emerald-300').length,
    events: events.filter((e) => e.type !== 'tab'),
    submitButtonDisabled: !!submitBtn?.disabled,
  }

  // 收起 / 展开
  const collapse = document.querySelector('.lesson-dock .dock-collapse')
  collapse?.click(); await tick()
  result.collapse = {
    expanded: collapse?.getAttribute('aria-expanded'),
    bodyDisplay: getComputedStyle(document.querySelector('.lesson-dock .dock-body')).display,
  }
  collapse?.click(); await tick()
  result.expand = {
    expanded: collapse?.getAttribute('aria-expanded'),
    bodyDisplay: getComputedStyle(document.querySelector('.lesson-dock .dock-body')).display,
  }

  // 键盘左右切换
  const firstTabBtn = document.querySelector('.lesson-dock .dock-tab')
  firstTabBtn?.focus()
  firstTabBtn?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
  await tick()
  result.keyboardTab = {
    selected: document.querySelector('.lesson-dock .dock-tab[aria-selected="true"] .dock-tab-label')?.textContent,
    activeId: document.activeElement?.id,
    tabEvents: events.filter((e) => e.type === 'tab').map((e) => e.value),
  }

  result.plainText = inner().slice(0, 1200)
  return result
}

const RETRIES = 4
let report = null
for (let attempt = 1; attempt <= RETRIES && !report; attempt++) {
  try {
    const desktop = await page.evaluate(RUN, { width: 760, withFrame: true, emptyMode: false })
    const empty = await page.evaluate(RUN, { width: 720, withFrame: false, emptyMode: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(150)
    const mobile = await page.evaluate(RUN, { width: 336, withFrame: true, emptyMode: false })
    report = { attempt, desktop, empty, mobile }
  } catch (e) {
    errors.push('attempt ' + attempt + ': ' + e.message.slice(0, 200))
    await page.waitForTimeout(800)
  }
}

// 截图（尽力而为；开发服务器重载时跳过）
async function bestEffortShot(name, width, label) {
  try {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(async ({ width }) => {
      const resources = performance.getEntriesByType('resource').map((e) => e.name)
      const vueUrl = resources.find((u) => /\/node_modules\/\.vite\/deps\/vue\.js/.test(u))
      const Vue = await import(vueUrl)
      const [{ default: Dock }, { visualLesson }, scenarios, catalog, templates] = await Promise.all([
        import('/src/components/lesson/LessonDock.vue'),
        import('/src/experiments/visual/lessons.ts'),
        import('/src/engine/visual/scenarios.ts'),
        import('/src/experiments/catalog.ts'),
        import('/src/engine/templates/index.ts'),
      ])
      document.querySelectorAll('.dock-test-host').forEach((n) => n.remove())
      const lesson = visualLesson('B05')
      const entry = catalog.getCatalogEntry('B05')
      const run = scenarios.buildLessonRun(lesson, scenarios.defaultParameters(lesson))
      const frame = run.frames[2]
      const state = frame.after
      const t = state.table
      const ctx = templates.createTemplateContext({
        database: t.databaseName, table: t.tableName, qualifiedTable: `${t.databaseName}.${t.tableName}`,
        tablePath: t.tablePath, tableType: 'cow', primaryKey: t.primaryKey ?? '', preCombineField: t.preCombineField ?? '',
        partitionFields: t.partitionFields.join(','), partitionKey: t.partitionFields[0] ?? '',
        partitionValue: '2024-01-01', recordKey: '1001', indexType: t.indexType,
        beginInstantTime: run.initial.timeline[0]?.instantTime ?? '', asOfInstant: run.initial.checkpoints[0]?.instantTime ?? '',
      })
      const blocks = ['spark-upsert', 'spark-delete'].map((tid) => {
        const tpl = templates.findTemplate(tid)
        return tpl ? { ...tpl, code: templates.buildSql(tpl.language, tid, ctx) } : null
      }).filter(Boolean)
      const host = document.createElement('div'); host.className = 'dock-test-host'
      host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--vl-bg);padding:12px;box-sizing:border-box'
      const shell = document.createElement('div'); shell.className = 'visual-lab'
      shell.style.cssText = `width:${width}px;max-width:100%;margin:0 auto;background:var(--vl-bg);color:var(--vl-ink)`
      host.appendChild(shell); document.body.appendChild(host)
      const app = Vue.createApp({ render: () => Vue.h(Dock, { lessonId: 'B05', lesson, frame, state, templates: blocks, evidenceIds: entry?.evidenceIds ?? [], modelLabel: '引擎驱动', evidenceLevel: entry?.evidenceLevel, supportState: entry?.supportState, progress: 0.6 }) })
      app.mount(shell)
      await new Promise((r) => setTimeout(r, 400))
      return true
    }, { width })
    const btn = page.locator('.dock-tab', { hasText: label }).first()
    if (await btn.count()) { await btn.click(); await page.waitForTimeout(250) }
    await page.screenshot({ path: outDir + name + '.png' })
    return true
  } catch { return false }
}

report.shots = {
  explain: await bestEffortShot('dock-desktop-explain', 760, '解释'),
  data: await bestEffortShot('dock-desktop-data', 760, '数据'),
  code: await bestEffortShot('dock-desktop-code', 760, '代码'),
  evidence: await bestEffortShot('dock-desktop-evidence', 760, '依据'),
  mobile: await bestEffortShot('dock-mobile390-data', 360, '数据'),
}
report.errors = errors.slice(0, 12)
fs.writeFileSync('D:/code/hudi演示/_analysis/dock-preview.json', JSON.stringify(report, null, 2))

const d = report.desktop || {}
console.log(JSON.stringify({
  attempt: report.attempt,
  steps: d.steps,
  explainChecks: d.explainChecks,
  dataChecks: d.dataChecks,
  codeChecks: d.codeChecks,
  quizChecks: d.quizChecks,
  collapse: d.collapse,
  expand: d.expand,
  keyboardTab: d.keyboardTab,
  empty: report.empty ? { empties: report.empty.empties, hasQuizSection: report.empty.hasQuizSection } : null,
  mobile: report.mobile ? { steps: report.mobile.steps, viewport: report.mobile.viewport } : null,
  shots: report.shots,
  errors: report.errors,
}, null, 1))
await browser.close()
