import { launch, newPage, goto, measure, contrast, saveJson, SHOTS } from './lib.mjs'

const browser = await launch()
const report = {}

/* ============================ HOME · desktop ============================ */
{
  const page = await newPage(browser, { width: 1440, height: 900 })
  const t0 = Date.now()
  await goto(page, '/')
  report.homeNavMs = Date.now() - t0
  report.homeTiming = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0]
    return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd), fcp: Math.round((performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0) } : null
  })
  await page.screenshot({ path: SHOTS + '01-home-desktop.png' })
  const m = await measure(page)
  report.home = {
    title: m.title,
    doc: m.doc,
    textCount: m.textCount,
    smallBySize: m.smallBySize,
    interactiveCount: m.interactiveCount,
    foldInteractives: m.foldInteractives.map((i) => ({ tag: i.tag, text: i.text, w: i.w, h: i.h, y: i.y })),
    headings: m.headings,
    overflowCount: m.overflowCount,
    hScrollers: m.hScrollers,
  }
  // key text styles
  report.homeKeyStyles = await page.evaluate(() => {
    const out = []
    const q = (sel, label) => {
      const el = document.querySelector(sel)
      if (!el) return
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      out.push({ label, sel, size: cs.fontSize, lh: cs.lineHeight, color: cs.color, bg: getComputedStyle(el.closest('.visual-home') || document.body).backgroundColor, weight: cs.fontWeight, w: Math.round(r.width), h: Math.round(r.height) })
    }
    q('.vh-main>h1', '首页主标题')
    q('.vh-intro', '首页副标题')
    q('.vl-eyebrow', 'eyebrow')
    q('.vh-feature h2', '精选实验标题')
    q('.vh-feature p', '精选实验说明')
    q('.vh-start', '精选CTA')
    q('.vh-topics-head h2', '问题区标题')
    q('.vh-all-topics', '全部80个动画')
    q('.vh-topics h3', '主题卡标题')
    q('.vh-topics .vl-eyebrow', '主题卡序号')
    q('.vl-footer span', '页脚')
    q('.vl-nav a', '导航')
    return out
  })
  // first fold text inventory
  report.homeFoldText = await page.evaluate(() => {
    const vh = innerHeight
    const items = []
    document.querySelectorAll('.vh-main *').forEach((el) => {
      if (el.children.length) return
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!t) return
      const r = el.getBoundingClientRect()
      if (r.top < vh && r.bottom > 0 && r.width > 0) items.push({ t: t.slice(0, 60), y: Math.round(r.y), size: parseFloat(getComputedStyle(el).fontSize) })
    })
    return items.sort((a, b) => a.y - b.y)
  })
  // light theme
  await page.click('button[aria-label="切换深浅主题"]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: SHOTS + '02-home-light.png' })
  report.homeLight = await page.evaluate(() => {
    const out = {}
    const pick = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const cs = getComputedStyle(el)
      let bgEl = el, bg = ''
      while (bgEl) {
        const b = getComputedStyle(bgEl).backgroundColor
        if (b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') { bg = b; break }
        bgEl = bgEl.parentElement
      }
      return { color: cs.color, size: cs.fontSize, bg }
    }
    out.rootBg = getComputedStyle(document.querySelector('.visual-home')).backgroundColor
    out.intro = pick('.vh-intro')
    out.eyebrow = pick('.vl-eyebrow')
    out.topicMeta = pick('.vh-topics .vl-eyebrow')
    out.featureP = pick('.vh-feature p')
    return out
  })
  await page.close()
}

/* ============================ CATALOG · desktop ============================ */
{
  const page = await newPage(browser, { width: 1440, height: 900 })
  await goto(page, '/catalog')
  await page.screenshot({ path: SHOTS + '03-catalog-desktop.png' })
  const m = await measure(page)
  report.catalog = {
    title: m.title,
    doc: m.doc,
    cardCount: await page.locator('.catalog-card').count(),
    statusText: await page.locator('.catalog-status').innerText(),
    firstFold: m.foldInteractives.map((i) => ({ tag: i.tag, text: i.text, w: i.w, h: i.h, y: i.y })),
    smallBySize: m.smallBySize,
    smallSamples: m.smallSamples,
    textCount: m.textCount,
    headings: m.headings.slice(0, 6),
    hScrollers: m.hScrollers,
  }
  report.catalogKeyStyles = await page.evaluate(() => {
    const out = []
    const q = (sel, label) => {
      const el = document.querySelector(sel)
      if (!el) return
      const cs = getComputedStyle(el)
      out.push({ label, size: cs.fontSize, lh: cs.lineHeight, color: cs.color, bg: (() => { let e = el; while (e) { const b = getComputedStyle(e).backgroundColor; if (b !== 'rgba(0, 0, 0, 0)' && b !== 'transparent') return b; e = e.parentElement } return '' })(), weight: cs.fontWeight })
    }
    q('.catalog-card-meta', '卡片元信息 9px')
    q('.catalog-card h2', '卡片标题')
    q('.catalog-card-bottom', '卡片底部')
    q('.catalog-filters button', '模块筛选按钮')
    q('.catalog-status', '计数状态行')
    q('.catalog-search input', '搜索框')
    q('.catalog-heading h1', '页面标题')
    q('.catalog-heading p', '页面说明')
    q('.vl-eyebrow', 'eyebrow')
    q('.catalog-footnote', '脚注')
    return out
  })
  // ---- search behaviour ----
  const input = page.locator('.catalog-search input')
  const terms = ['bucket', '索引', 'compaction', 'Compaction', 'COW', 'MOR', 'log', 'Log', '文件组', 'File Group', 'timeline', '日志', 'E01', 'B02', '小文件', 'zzz']
  const results = []
  for (const term of terms) {
    await input.fill(term)
    await page.waitForTimeout(180)
    const cards = await page.locator('.catalog-card').count()
    const ids = await page.locator('.catalog-card .catalog-card-meta > span:first-child').allInnerTexts()
    const status = (await page.locator('.catalog-status').innerText()).split('\n')[0]
    results.push({ term, cards, status, ids: ids.slice(0, 8) })
    if (term === 'bucket' || term === '索引' || term === 'compaction' || term === 'zzz') {
      await page.screenshot({ path: SHOTS + `04-catalog-search-${encodeURIComponent(term)}.png` })
    }
  }
  report.catalogSearch = results
  // empty state details
  report.catalogEmpty = await page.evaluate(() => {
    const el = document.querySelector('.catalog-empty')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { text: el.innerText, visible: r.height > 0, y: Math.round(r.top), h: Math.round(r.height), statusLine: document.querySelector('.catalog-status')?.innerText }
  })
  // ---- filter behaviour ----
  await input.fill('')
  await page.waitForTimeout(150)
  const filterBtns = await page.locator('.catalog-filters button').allInnerTexts()
  report.catalogFilterButtons = filterBtns
  const filterTests = []
  for (const label of ['基础原理', '索引机制', '教学', '全部']) {
    const btn = page.locator('.catalog-filters button', { hasText: label }).first()
    if (!(await btn.count())) continue
    await btn.click()
    await page.waitForTimeout(150)
    filterTests.push({ label, cards: await page.locator('.catalog-card').count(), status: (await page.locator('.catalog-status').innerText()).split('\n')[0] })
  }
  // combined: filter + search
  await page.locator('.catalog-filters button', { hasText: '全部' }).first().click()
  await page.waitForTimeout(120)
  // model select
  const modelSelect = page.locator('.catalog-status select')
  await modelSelect.selectOption('concept')
  await page.waitForTimeout(200)
  const conceptCount = await page.locator('.catalog-card').count()
  await page.screenshot({ path: SHOTS + '05-catalog-model-concept.png' })
  await modelSelect.selectOption('all')
  await page.waitForTimeout(150)
  // combined search that yields 0 within a module
  await page.locator('.catalog-filters button', { hasText: '基础原理' }).first().click()
  await input.fill('compaction')
  await page.waitForTimeout(200)
  const combo = { cards: await page.locator('.catalog-card').count(), status: (await page.locator('.catalog-status').innerText()).split('\n')[0], empty: await page.locator('.catalog-empty').count(), activeFilter: await page.locator('.catalog-filters button.active').innerText().catch(() => '') }
  report.catalogFilters = { filterTests, conceptCount, combo }
  await input.fill('')
  await page.locator('.catalog-filters button', { hasText: '全部' }).first().click()
  // ---- scroll depth: first visible row of cards ----
  report.catalogCardMetrics = await page.evaluate(() => {
    const c = document.querySelector('.catalog-card')
    if (!c) return null
    const r = c.getBoundingClientRect()
    const meta = c.querySelector('.catalog-card-meta')
    return {
      card: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) },
      metaFont: getComputedStyle(meta).fontSize,
      previewH: Math.round(c.querySelector('.topic-preview')?.getBoundingClientRect().height || 0),
      titleFont: getComputedStyle(c.querySelector('h2')).fontSize,
    }
  })
  await page.close()
}

/* ============================ PROGRESS + EVIDENCE · desktop ============================ */
for (const [path, name] of [['/progress', '06-progress-desktop'], ['/evidence', '07-evidence-desktop']]) {
  const page = await newPage(browser, { width: 1440, height: 900 })
  await goto(page, path)
  await page.screenshot({ path: SHOTS + name + '.png' })
  const m = await measure(page)
  const key = path.slice(1)
  report[key] = {
    title: m.title,
    doc: m.doc,
    textCount: m.textCount,
    smallBySize: m.smallBySize,
    smallSamples: m.smallSamples,
    foldInteractives: m.foldInteractives.map((i) => ({ tag: i.tag, text: i.text, w: i.w, h: i.h, y: i.y })),
    interactiveCount: m.interactiveCount,
    headings: m.headings,
    overflowCount: m.overflowCount,
    hScrollers: m.hScrollers,
  }
  report[key + 'Body'] = await page.evaluate(() => {
    const b = document.body
    const app = document.querySelector('#app > *')
    const cs = app ? getComputedStyle(app) : null
    return {
      bodyBg: getComputedStyle(b).backgroundColor,
      appBg: cs?.backgroundColor,
      appClass: app?.className,
      hasVlNav: !!document.querySelector('.vl-nav'),
      hasMainLayoutHeader: !!document.querySelector('header'),
      firstText: (b.innerText || '').slice(0, 240),
    }
  })
  // measure el-table overflow
  report[key + 'Table'] = await page.evaluate(() => {
    const t = document.querySelector('.el-table')
    if (!t) return null
    const r = t.getBoundingClientRect()
    return { w: Math.round(r.width), scrollW: t.scrollWidth, h: Math.round(r.height), rows: document.querySelectorAll('.el-table__row').length }
  })
  await page.close()
}

/* ============================ MOBILE 390x844 ============================ */
const mobilePages = [['/', '10-home-mobile', 'homeMobile'], ['/catalog', '11-catalog-mobile', 'catalogMobile'], ['/progress', '12-progress-mobile', 'progressMobile'], ['/evidence', '13-evidence-mobile', 'evidenceMobile']]
for (const [path, name, key] of mobilePages) {
  const page = await newPage(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true })
  await goto(page, path)
  await page.screenshot({ path: SHOTS + name + '.png' })
  await page.screenshot({ path: SHOTS + name + '-full.png', fullPage: true })
  const m = await measure(page)
  const taps = m.interactives.map((i) => ({ tag: i.tag, text: i.text, w: i.w, h: i.h, y: i.y, path: i.path }))
  const small = taps.filter((t) => t.w < 44 || t.h < 44)
  report[key] = {
    title: m.title,
    doc: m.doc,
    textCount: m.textCount,
    smallBySize: m.smallBySize,
    smallSamples: m.smallSamples,
    interactiveCount: m.interactiveCount,
    tapUnder44: small.length,
    tapUnder44Ratio: m.interactiveCount ? Math.round((small.length / m.interactiveCount) * 100) : 0,
    tapUnder44Samples: small.slice(0, 30),
    overflowCount: m.overflowCount,
    overflowEls: m.overflowEls,
    hScrollers: m.hScrollers,
    headings: m.headings.slice(0, 8),
  }
  await page.close()
}

saveJson('raw-01-pages.json', report)

/* ---------------- console: compact summary ---------------- */
console.log('\n===== HOME desktop =====')
console.log('timing', JSON.stringify(report.homeTiming), 'navMs', report.homeNavMs)
console.log('doc', JSON.stringify(report.home.doc))
console.log('interactive', report.home.interactiveCount, 'fold', report.home.foldInteractives.length)
console.log('fold:', JSON.stringify(report.home.foldInteractives.map((i) => `${i.tag}:${i.text}@y${i.y} ${i.w}x${i.h}`), null, 1))
console.log('headings', JSON.stringify(report.home.headings))
console.log('keyStyles', JSON.stringify(report.homeKeyStyles, null, 1))
console.log('small', JSON.stringify(report.home.smallBySize))
console.log('homeLight', JSON.stringify(report.homeLight))

console.log('\n===== CATALOG desktop =====')
console.log('doc', JSON.stringify(report.catalog.doc), 'cards', report.catalog.cardCount, 'status', JSON.stringify(report.catalog.statusText))
console.log('keyStyles', JSON.stringify(report.catalogKeyStyles, null, 1))
console.log('cardMetrics', JSON.stringify(report.catalogCardMetrics))
console.log('filterButtons', JSON.stringify(report.catalogFilterButtons))
console.log('search results:')
report.catalogSearch.forEach((r) => console.log(`  ${r.term.padEnd(12)} -> ${String(r.cards).padStart(3)} cards | ${r.status} | ${r.ids.join(' / ')}`))
console.log('empty', JSON.stringify(report.catalogEmpty))
console.log('filters', JSON.stringify(report.catalogFilters))

console.log('\n===== PROGRESS / EVIDENCE desktop =====')
for (const k of ['progress', 'evidence']) {
  console.log(k, 'doc', JSON.stringify(report[k].doc), 'small', JSON.stringify(report[k].smallBySize), 'table', JSON.stringify(report[k + 'Table']), 'body', JSON.stringify(report[k + 'Body']))
}

console.log('\n===== MOBILE =====')
for (const k of ['homeMobile', 'catalogMobile', 'progressMobile', 'evidenceMobile']) {
  const r = report[k]
  console.log(`\n-- ${k}: docW=${r.doc.scrollWidth} clientW=${r.doc.clientWidth} tapUnder44=${r.tapUnder44}/${r.interactiveCount} (${r.tapUnder44Ratio}%) overflow=${r.overflowCount} small=${JSON.stringify(r.smallBySize)}`)
  console.log('   overflowEls', JSON.stringify(r.overflowEls.slice(0, 8)))
  console.log('   tap samples', JSON.stringify(r.tapUnder44Samples.slice(0, 12)))
}

await browser.close()
