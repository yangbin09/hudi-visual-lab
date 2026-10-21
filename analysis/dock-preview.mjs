// LessonDock 渲染验证：在真实 dev server 里用 Vite 动态加载 SFC，检查 390px / 桌面布局、4 个分区、空态与受控 Quiz。
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const base = 'http://127.0.0.1:5173/'
const outDir = 'D:/code/hudi演示/_analysis/shots/'
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })
const results = {}
const errors = []

async function mountDock(page, opts) {
  return page.evaluate(async ({ width, withFrame, withQuiz }) => {
    // 找到 Vite 已经加载的 Vue 运行时的 URL，确保与页面共用同一个 Vue 实例
    const resources = performance.getEntriesByType('resource').map((e) => e.name)
    const vueUrl = resources.find((u) => /\/node_modules\/\.vite\/deps\/vue\.js/.test(u))
    if (!vueUrl) throw new Error('Vue runtime URL not found: ' + resources.slice(0, 12).join(','))
    const Vue = await import(vueUrl)

    const [{ default: Dock }, { visualLesson }, scenarios, catalog, templates, evidence] = await Promise.all([
      import('/src/components/lesson/LessonDock.vue'),
      import('/src/experiments/visual/lessons.ts'),
      import('/src/engine/visual/scenarios.ts'),
      import('/src/experiments/catalog.ts'),
      import('/src/engine/templates/index.ts'),
      import('/src/evidence/index.ts'),
    ])

    const id = 'B05'
    const lesson = visualLesson(id)
    const entry = catalog.getCatalogEntry(id)
    let frame = null
    let state = null
    let run = null
    if (withFrame) {
      run = scenarios.buildLessonRun(lesson, scenarios.defaultParameters(lesson))
      frame = run.frames[Math.min(2, run.frames.length - 1)]
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

    const quiz = withQuiz ? [
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
    ] : []

    const host = document.createElement('div')
    host.style.cssText = `position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--vl-bg,#151c20);padding:12px;box-sizing:border-box`
    const shell = document.createElement('div')
    shell.className = 'visual-lab'
    shell.style.cssText = `width:${width}px;max-width:100%;margin:0 auto;background:var(--vl-bg);color:var(--vl-ink)`
    host.appendChild(shell)
    document.body.appendChild(host)

    const props = {
      lessonId: id,
      lesson,
      frame,
      state,
      templates: blocks,
      evidenceIds: entry?.evidenceIds ?? ['EV-COMM-MOR'],
      quiz,
      modelLabel: '引擎驱动',
      evidenceLevel: entry?.evidenceLevel,
      supportState: entry?.supportState,
      note: entry?.note ?? '',
      limitations: ['BUCKET 分桶算法 r26 未确认（djb2 仅为教学算法）', 'Archive / Restore 的真实耗时与阻塞条件未在集群实测'],
      progress: 0.6,
      selectedFile: '',
    }
    const app = Vue.createApp({ render: () => Vue.h(Dock, props) })
    app.mount(shell)
    await new Promise((r) => setTimeout(r, 400))
    return { mounted: true, run: !!run }
  }, opts)
}

function px(n) { return Math.round((n ?? 0) * 10) / 10 }

async function measure(page, label) {
  return page.evaluate((label) => {
    const dock = document.querySelector('.lesson-dock')
    const host = dock?.parentElement?.parentElement
    const rect = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) } }
    const dockRect = dent(dock)
    function dent(el) { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right } }
    // 找出：不在横向滚动容器里的子元素，右边界超出 dock 的元素
    const overflowers = []
    if (dock) {
      const insideScroller = (el) => {
        let n = el.parentElement
        while (n && n !== dock) {
          const cs = getComputedStyle(n)
          if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflow === 'auto') return true
          n = n.parentElement
        }
        return false
      }
      for (const el of dock.querySelectorAll('*')) {
        if (insideScroller(el)) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0) continue
        if (r.right > dockRect.right + 1.5) {
          overflowers.push({ cls: (el.getAttribute('class') || el.tagName).toString().slice(0, 50), right: Math.round(r.right), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30) })
          if (overflowers.length > 8) break
        }
      }
    }
    const tabs = [...document.querySelectorAll('.dock-tab')].map((b) => ({ label: b.querySelector('.dock-tab-label')?.textContent, hint: b.querySelector('.dock-tab-hint')?.textContent, active: b.getAttribute('aria-selected') }))
    return {
      label,
      viewport: { w: innerWidth, h: innerHeight },
      dock: dockRect,
      host: host ? rect(host) : null,
      hostScroll: host ? { scrollW: host.scrollWidth, clientW: host.clientWidth } : null,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      overflowers,
      tabs,
      tablistScroll: (() => { const t = document.querySelector('.dock-tablist'); return t ? { scrollW: t.scrollWidth, clientW: t.clientWidth } : null })(),
      content: (document.querySelector('.lesson-dock')?.innerText || '').slice(0, 260),
    }
  }, label)
}

async function shotAndMeasure(page, name) {
  await page.waitForTimeout(250)
  await page.screenshot({ path: outDir + 'dock-' + name + '.png', fullPage: false })
  return measure(page, name)
}

const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)) })
await page.goto(base + 'experiment/B05', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

// ---------- 桌面 + 四分区 ----------
await mountDock(page, { width: 760, withFrame: true, withQuiz: true })
results.desktopExplain = await shotAndMeasure(page, 'desktop-explain')
const tabsDesk = {}
for (const [label, key] of [['数据', 'data'], ['代码', 'code'], ['依据', 'evidence'], ['解释', 'explain']]) {
  await page.locator('.dock-tab', { hasText: label }).first().click()
  await page.waitForTimeout(350)
  tabsDesk[key] = await shotAndMeasure(page, 'desktop-' + key)
}
results.desktopTabs = tabsDesk
// 源码映射必须是多行、不能出现字面 \n
results.codeTabCheck = await page.evaluate(() => {
  const dock = document.querySelector('.lesson-dock')
  const text = dock?.innerText || ''
  return {
    literalBackslashN: text.includes('\\n'),
    sourceRows: document.querySelectorAll('.source-item').length,
    sqlBlocks: document.querySelectorAll('.lesson-dock .cm-editor, .lesson-dock .cm-host').length,
  }
})
// 数据分区细节
await page.locator('.dock-tab', { hasText: '数据' }).first().click()
await page.waitForTimeout(300)
results.dataTabCheck = await page.evaluate(() => ({
  fileRows: document.querySelectorAll('.lesson-dock .fv-row').length,
  recordRows: document.querySelectorAll('.lesson-dock .rt-row').length,
  timelineHeader: !!document.querySelector('.lesson-dock .tt-root'),
  timelineTableRows: document.querySelectorAll('.lesson-dock .tt-row').length,
  planCards: document.querySelectorAll('.lesson-dock .plan-card').length,
  planEmpty: (document.querySelector('.lesson-dock')?.innerText || '').includes('当前没有 Compaction 计划'),
  noJsonBlock: !(document.querySelector('.lesson-dock')?.innerText || '').includes('"instantTime"'),
}))
// 收起 / 展开
await page.locator('.dock-collapse').click()
await page.waitForTimeout(200)
results.collapsed = await page.evaluate(() => ({
  expanded: document.querySelector('.dock-collapse')?.getAttribute('aria-expanded'),
  bodyVisible: (() => { const b = document.querySelector('.dock-body'); return b ? getComputedStyle(b).display !== 'none' : null })(),
}))
await page.locator('.dock-collapse').click()
await page.waitForTimeout(200)

// 键盘左右切换 tab
await page.locator('.dock-tab').first().focus()
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(150)
results.keyboardTab = await page.evaluate(() => ({
  selected: document.querySelector('.dock-tab[aria-selected="true"] .dock-tab-label')?.textContent,
  focused: document.activeElement?.querySelector?.('.dock-tab-label')?.textContent ?? document.activeElement?.textContent?.slice(0, 12),
}))
await page.locator('.dock-tab', { hasText: '解释' }).first().click()
// 受控 Quiz：作答 + 提交
await page.waitForTimeout(200)
const quizBefore = await page.evaluate(() => ({ submitDisabled: document.querySelector('.lesson-dock button[disabled]')?.textContent?.trim() ?? null, hasQuiz: !!document.querySelector('.lesson-dock [data-question-id]') }))
await page.locator('.lesson-dock [data-question-id="q1"] button').nth(1).click()
await page.locator('.lesson-dock [data-question-id="q2"] button').nth(0).click()
await page.locator('.lesson-dock [data-question-id="q2"] button').nth(1).click()
await page.locator('.lesson-dock button', { hasText: '提交答案' }).click()
await page.waitForTimeout(250)
const quizAfter = await page.evaluate(() => ({
  scoreBadge: (document.querySelector('.lesson-dock')?.innerText || '').match(/得分 \d+ 分（\d+ \/ \d+）/)?.[0] ?? null,
  correctMarks: document.querySelectorAll('.lesson-dock .text-emerald-300').length,
  stillInteractive: [...document.querySelectorAll('.lesson-dock [data-question-id] button')].every((b) => b.getBoundingClientRect().width > 0),
}))
results.quiz = { before: quizBefore, after: quizAfter }
await page.screenshot({ path: outDir + 'dock-desktop-quiz-graded.png' })

// ---------- 390px ----------
await page.evaluate(() => { document.querySelector('.dock-harness')?.remove(); document.querySelectorAll('body > div').forEach((d) => { if (d.querySelector && d.querySelector('.lesson-dock')) d.remove() }) })
// 移除上一次 mount：host 是最外层 fixed div（没有 class）——通过 dock 向上查找
await page.evaluate(() => { const dock = document.querySelector('.lesson-dock'); let n = dock; while (n && n.parentElement !== document.body) n = n.parentElement; n?.remove() })
await page.setViewportSize({ width: 390, height: 844 })
await mountDock(page, { width: 360, withFrame: true, withQuiz: true })
results.mobile390 = await shotAndMeasure(page, 'mobile390-explain')
const mobileTabs = {}
for (const [label, key] of [['数据', 'data'], ['代码', 'code'], ['依据', 'evidence']]) {
  await page.locator('.dock-tab', { hasText: label }).first().click()
  await page.waitForTimeout(350)
  mobileTabs[key] = await shotAndMeasure(page, 'mobile390-' + key)
}
results.mobile390Tabs = mobileTabs
results.mobile390Scroll = await page.evaluate(() => {
  const dock = document.querySelector('.lesson-dock')
  return dock ? { dockScrollW: dock.scrollWidth, dockClientW: dock.clientWidth, docScrollW: document.documentElement.scrollWidth, innerW: innerWidth } : null
})

// ---------- 空状态 ----------
await page.evaluate(() => { const dock = document.querySelector('.lesson-dock'); let n = dock; while (n && n.parentElement !== document.body) n = n.parentElement; n?.remove() })
await page.setViewportSize({ width: 1280, height: 900 })
await mountDock(page, { width: 720, withFrame: false, withQuiz: false })
const empty = {}
await page.locator('.dock-tab', { hasText: '解释' }).first().click(); await page.waitForTimeout(200)
empty.explain = await page.evaluate(() => (document.querySelector('.lesson-dock')?.innerText || '').includes('还没有可解释的步骤'))
await page.locator('.dock-tab', { hasText: '数据' }).first().click(); await page.waitForTimeout(200)
empty.data = await page.evaluate(() => (document.querySelector('.lesson-dock')?.innerText || '').includes('表状态还没有准备好'))
await page.locator('.dock-tab', { hasText: '代码' }).first().click(); await page.waitForTimeout(200)
empty.code = await page.evaluate(() => (document.querySelector('.lesson-dock')?.innerText || '').includes('本主题暂时没有代码模板'))
await page.locator('.dock-tab', { hasText: '依据' }).first().click(); await page.waitForTimeout(200)
empty.evidence = await page.evaluate(() => { const t = document.querySelector('.lesson-dock')?.innerText || ''; return { hasEvidenceEmpty: t.includes('本实验暂未关联证据条目'), hasBoundaryEmpty: t.includes('本主题没有额外的边界说明') } })
empty.quizHidden = await page.evaluate(() => !(document.querySelector('.lesson-dock')?.innerText || '').includes('自测'))
results.emptyStates = empty
await page.screenshot({ path: outDir + 'dock-desktop-empty.png' })

results.errors = errors
fs.writeFileSync('D:/code/hudi演示/_analysis/dock-preview.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify({
  desktop: { dock: results.desktopExplain.dock, tabs: results.desktopExplain.tabs, overflowers: results.desktopExplain.overflowers, tablistScroll: results.desktopExplain.tablistScroll },
  codeTabCheck: results.codeTabCheck,
  dataTabCheck: results.dataTabCheck,
  collapsed: results.collapsed,
  keyboardTab: results.keyboardTab,
  quiz: results.quiz,
  mobile: { dock: results.mobile390.dock, overflowers: results.mobile390.overflowers, pageOverflow: results.mobile390.pageOverflow, tablistScroll: results.mobile390.tablistScroll, scroll: results.mobile390Scroll },
  mobileTabsOverflow: Object.fromEntries(Object.entries(results.mobile390Tabs).map(([k, v]) => [k, { overflowers: v.overflowers, pageOverflow: v.pageOverflow }])),
  emptyStates: results.emptyStates,
  errors: results.errors.slice(0, 10),
}, null, 1))
await browser.close()
