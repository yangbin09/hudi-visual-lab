// IA / code audit probe for Hudi Visual Lab (read-only against running dev server at 127.0.0.1:5173)
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const base = 'http://127.0.0.1:5173/'
const outDir = 'D:/code/hudi演示/_analysis/shots/'
fs.mkdirSync(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge' })
const report = {}
const errs = []
const H = `
window.__h = {
  rect(el){ const r = el.getBoundingClientRect(); return {y:Math.round(r.y),h:Math.round(r.height),w:Math.round(r.width),bottom:Math.round(r.bottom)} },
  bgOf(el){ let n=el; while(n && n!==document.documentElement){ const c=getComputedStyle(n).backgroundColor; if(c && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c)) return c; n=n.parentElement } return getComputedStyle(document.body).backgroundColor },
  rgb(s){ const m=s.match(/[\\d.]+/g); return m?m.slice(0,3).map(Number):null },
  lum(c){ const a=c.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}); return 0.2126*a[0]+0.7152*a[1]+0.0722*a[2] },
  ratio(a,b){ const l1=__h.lum(a),l2=__h.lum(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return Math.round(((hi+0.05)/(lo+0.05))*100)/100 },
  desc(el){ return el.tagName.toLowerCase() + (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\\s+/).slice(0,2).join('.') : '') }
};
true`

async function open(path, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage({ viewport })
  page.on('pageerror', e => errs.push(path + ' :: ' + e.message))
  page.setDefaultTimeout(6000)
  await page.addInitScript(H)
  await page.goto(new URL(path, base).href, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(700)
  return page
}
const rd = (page, fn, arg) => page.evaluate(fn, arg)

const domOrder = () => {
  const main = document.querySelector('.lesson-main') || document.querySelector('.vl-main')
  const kids = [...main.children].map(el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { cls: el.className, y: Math.round(r.y), h: Math.round(r.height), w: Math.round(r.width), font: c.fontSize } })
  const box = el => el ? __h.rect(el) : null
  const h1 = document.querySelector('h1')
  const svg = document.querySelector('.lesson-canvas, .vl-canvas')
  return {
    viewport: { w: innerWidth, h: innerHeight },
    doc: { scrollH: document.documentElement.scrollHeight, scrollW: document.documentElement.scrollWidth },
    kids, nav: box(document.querySelector('.vl-nav')), stage: box(document.querySelector('.lesson-stage, .vl-stage')),
    canvasArea: box(document.querySelector('.lesson-canvas-area, .vl-canvas-wrap')), svg: box(svg),
    explanation: box(document.querySelector('.lesson-explanation, .vl-caption')),
    playbar: box(document.querySelector('.lesson-playbar, .vl-controls')),
    chapters: box(document.querySelector('.lesson-chapters')), footer: box(document.querySelector('.vl-footer')),
    h1: h1 ? { text: h1.textContent.trim().slice(0, 60), font: getComputedStyle(h1).fontSize, ...box(h1) } : null,
    svgVisibleAboveFold: svg ? Math.round(Math.max(0, Math.min(innerHeight, svg.getBoundingClientRect().bottom) - Math.max(0, svg.getBoundingClientRect().top))) : null
  }
}

const typeScale = () => ['.vl-brand', '.vl-breadcrumb', '.vl-eyebrow', 'h1', '.lesson-stage-bar', '.lesson-stage-bar span', '.lesson-stage-bar button', '.lesson-explanation p', '.lesson-explanation small', '.lesson-step', '.lesson-primary', '.lesson-playbar button', '.lesson-playbar select', '.lesson-chapters button', '.lesson-bottom', '.vl-footer', '.vl-footer button'].map(sel => { const el = document.querySelector(sel); if (!el) return null; const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return { sel, font: c.fontSize, color: c.color, weight: c.fontWeight, h: Math.round(r.height), text: (el.textContent || '').trim().slice(0, 40) } }).filter(Boolean)

const clickableInventory = scope => {
  const root = document.querySelector(scope) || document
  const out = []
  for (const el of root.querySelectorAll('g,rect,circle')) {
    const c = getComputedStyle(el); const role = el.getAttribute('role'), tab = el.getAttribute('tabindex')
    if (c.cursor !== 'pointer' && role !== 'button' && tab === null) continue
    const r = el.getBoundingClientRect(); if (r.width < 6 || r.height < 6) continue
    const fill = getComputedStyle(el).fill
    out.push({ tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class') || '').slice(0, 44), role, tab, cursor: c.cursor, disabled: el.getAttribute('aria-disabled'), aria: (el.getAttribute('aria-label') || '').slice(0, 28), title: (el.getAttribute('title') || '').slice(0, 20), text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), fill })
  }
  const byKey = new Map()
  for (const o of out) { const k = o.cls + '|' + o.role + '|' + o.tag; if (!byKey.has(k)) byKey.set(k, { ...o, count: 1 }); else byKey.get(k).count++ }
  return { rawTotal: out.length, groups: [...byKey.values()] }
}

const domClickableStats = () => {
  const all = [...document.querySelectorAll('a[href],button,input,select,[tabindex="0"]')].map((el, i) => ({ i, tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class') || '').slice(0, 36), label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 30), inCanvas: !!el.closest('svg'), font: getComputedStyle(el).fontSize }))
  const labels = all.map(x => x.label)
  const playIdx = labels.findIndex(l => /演示|播放|暂停|开始|探索/.test(l))
  const canvasIdx = all.findIndex(x => x.inCanvas)
  return { count: all.length, canvasFocusable: all.filter(x => x.inCanvas).length, playIdx, firstCanvasIdx: canvasIdx, first18: all.slice(0, 18) }
}

const a11yStatic = () => ({
  live: [...document.querySelectorAll('[aria-live]')].map(el => ({ live: el.getAttribute('aria-live'), role: el.getAttribute('role'), textLen: (el.textContent || '').trim().length })),
  roleStatus: document.querySelectorAll('[role="status"],[role="alert"]').length,
  svgRoleImg: [...document.querySelectorAll('svg[role="img"]')].map(s => ({ aria: (s.getAttribute('aria-label') || '').slice(0, 40), hasTitle: !!s.querySelector('title') })),
  svgRoleButton: document.querySelectorAll('svg [role="button"]').length,
  svgTabindex0: document.querySelectorAll('svg [tabindex="0"]').length,
  inputs: [...document.querySelectorAll('input,select')].map(el => ({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), aria: el.getAttribute('aria-label'), inLabel: !!el.closest('label'), min: el.getAttribute('min'), max: el.getAttribute('max') })),
  lang: document.documentElement.lang, dialogs: document.querySelectorAll('dialog').length, skipLinks: document.querySelectorAll('a[href^="#"]').length
})

const contrastScan = () => {
  const els = [...document.querySelectorAll('.visual-lab *')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && el.getClientRects().length)
  const res = []
  for (const el of els) {
    const c = getComputedStyle(el); const fg = __h.rgb(c.color); if (!fg) continue
    const bg = __h.rgb(__h.bgOf(el)); if (!bg) continue
    const ratio = __h.ratio(fg, bg)
    if (ratio < 4.5) res.push({ ratio, font: c.fontSize, cls: __h.desc(el), fg: c.color, bg: __h.bgOf(el), text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 26) })
  }
  res.sort((a, b) => a.ratio - b.ratio)
  const vars = getComputedStyle(document.querySelector('.visual-lab'))
  const tok = k => vars.getPropertyValue(k).trim()
  const hex = h => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)] }
  const pairs = [['--vl-muted', '--vl-bg'], ['--vl-muted', '--vl-panel'], ['--vl-line', '--vl-bg'], ['--vl-ink', '--vl-panel'], ['--vl-accent', '--vl-bg'], ['--vl-bg', '--vl-accent']].map(([a, b]) => ({ pair: a + ' / ' + b, a: tok(a), b: tok(b), ratio: __h.ratio(hex(tok(a)), hex(tok(b))) }))
  return { low: res.slice(0, 20), tokenPairs: pairs }
}

async function clickTest(page, steps) {
  const out = []
  for (const s of steps) {
    const loc = page.locator(s.selector).first()
    let pre = null
    try { pre = await loc.evaluate(el => ({ cursor: getComputedStyle(el).cursor, aria: el.getAttribute('aria-label'), title: el.getAttribute('title'), disabled: el.getAttribute('aria-disabled') })) } catch { out.push({ name: s.name, err: 'not-found' }); continue }
    let clicked = false
    try { await loc.click({ force: true, timeout: 2500 }); clicked = true } catch { }
    await page.waitForTimeout(350)
    const dialog = await rd(page, () => { const d = document.querySelector('dialog[open]'); if (!d) return { open: false }; return { open: true, title: d.querySelector('h2')?.textContent.trim().slice(0, 36), tabs: [...d.querySelectorAll('.vl-drawer-tabs button')].map(b => b.textContent.trim()), bodyLen: d.innerText.length } })
    out.push({ name: s.name, selector: s.selector, pre, clicked, dialog })
    if (dialog.open) { await page.keyboard.press('Escape'); await page.waitForTimeout(200) }
  }
  return out
}

async function modeDiff(page) {
  const snap = () => rd(page, () => ({ text: document.body.innerText.replace(/\s+/g, ' '), nodes: document.querySelectorAll('*').length, buttons: [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim()).filter(Boolean) }))
  const before = await snap()
  const labelBefore = await rd(page, () => { const b = [...document.querySelectorAll('button')].find(x => /模式/.test(x.textContent || '')); return b ? b.textContent.trim() : 'NOT-FOUND:' + document.querySelectorAll('button').length })
  await rd(page, () => { const b = [...document.querySelectorAll('button')].find(x => /模式/.test(x.textContent || '')); if (b) b.click(); return !!b })
  await page.waitForTimeout(250)
  const after = await snap()
  const bs = new Set(before.text.split(/[\s，。；、|/·→:：()（）]+/).filter(Boolean))
  const as = new Set(after.text.split(/[\s，。；、|/·→:：()（）]+/).filter(Boolean))
  return {
    labelBefore, labelAfter: await rd(page, () => { const b = [...document.querySelectorAll('button')].find(x => /模式/.test(x.textContent || '')); return b ? b.textContent.trim() : 'NOT-FOUND' }),
    textChanged: before.text !== after.text, nodeDelta: after.nodes - before.nodes,
    addedTokens: [...as].filter(w => !bs.has(w)).slice(0, 30), removedTokens: [...bs].filter(w => !as.has(w)).slice(0, 30),
    newButtons: after.buttons.filter(b => !before.buttons.includes(b))
  }
}

async function focusProbe(page) {
  await rd(page, () => document.body.focus())
  const seq = []
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    seq.push(await rd(page, () => { const a = document.activeElement; return { tag: a.tagName.toLowerCase(), cls: (a.getAttribute('class') || '').slice(0, 30), aria: a.getAttribute('aria-label'), text: (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20), inCanvas: !!a.closest('svg') } }))
  }
  return seq
}

async function drawerProbe(page, openText = /参数/) {
  await page.locator('button', { hasText: openText }).first().click()
  await page.waitForTimeout(300)
  return rd(page, () => {
    const d = document.querySelector('dialog[open]'); if (!d) return { open: false }
    const a = document.activeElement
    return { open: true, title: d.querySelector('h2')?.textContent.trim(), tabs: [...d.querySelectorAll('.vl-drawer-tabs button')].map(b => b.textContent.trim()), focused: (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 22), hasForm: !!d.querySelector('form'), controls: [...d.querySelectorAll('form input,form select')].map(i => ({ type: i.type || i.tagName, aria: i.getAttribute('aria-label'), label: i.closest('label')?.textContent.trim().slice(0, 14) })) }
  })
}

async function timelinePath(page) {
  const landing = await rd(page, () => ({ details: [...document.querySelectorAll('button')].filter(b => /技术详情|SQL \/ HDFS/.test(b.textContent)).map(b => ({ text: b.textContent.trim(), font: getComputedStyle(b).fontSize, color: getComputedStyle(b).color })), params: [...document.querySelectorAll('button')].filter(b => /参数|设置/.test(b.textContent)).map(b => ({ text: b.textContent.trim(), font: getComputedStyle(b).fontSize })) }))
  await page.locator('button', { hasText: /技术详情|SQL \/ HDFS \/ Timeline/ }).first().click(); await page.waitForTimeout(300)
  const drawer = await rd(page, () => { const d = document.querySelector('dialog[open]'); const tabs = d ? [...d.querySelectorAll('.vl-drawer-tabs button')] : []; return { open: !!d, tabs: tabs.map(b => b.textContent.trim()), timelineIdx: tabs.findIndex(b => b.textContent.trim() === 'Timeline'), width: d ? Math.round(d.getBoundingClientRect().width) : 0 } })
  return { landing, drawer, clicksToTimeline: drawer.timelineIdx >= 0 ? 2 : null }
}

/* A. Lesson desktop */
const p1 = await open('/experiment/B05')
report.lessonDesktop = { path: '/experiment/B05', dom: await rd(p1, domOrder), type: await rd(p1, typeScale), a11y: await rd(p1, a11yStatic), domClickables: await rd(p1, domClickableStats), svgClickables: await rd(p1, clickableInventory, 'svg'), contrastDark: await rd(p1, contrastScan) }
await p1.screenshot({ path: outDir + 'ia-B05-desktop-initial.png' })
report.cursorSemantics = await rd(p1, () => {
  const rows = []
  for (const s of ['.ac-worker', '.ac-node', '.td-file', '.ac-section', '.ac-meta']) {
    for (const el of [...document.querySelectorAll('.lesson-canvas ' + s)].slice(0, 3)) {
      const c = getComputedStyle(el), r = el.getBoundingClientRect()
      const fill = c.fill
      rows.push({ sel: s, cls: (el.getAttribute('class') || '').slice(0, 34), cursor: c.cursor, role: el.getAttribute('role'), tab: el.getAttribute('tabindex'), aria: el.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height), fill })
    }
  }
  return rows
})
report.clickBeforePlay = await clickTest(p1, [
  { name: 'B05 file glyph', selector: '.lesson-canvas .file-glyph' },
  { name: 'B05 disabled output glyph', selector: '.lesson-canvas .file-glyph[aria-disabled="true"]' },
  { name: 'B05 worker box', selector: '.lesson-canvas .ac-worker' },
  { name: 'B05 section label', selector: '.lesson-canvas .ac-section' }
])
await p1.locator('button', { hasText: /开始演示/ }).first().click().catch(() => {})
await p1.waitForTimeout(500)
await p1.locator('button', { hasText: /跳到结果/ }).first().click().catch(() => {})
await p1.waitForTimeout(500)
report.clickAfterPlay = await clickTest(p1, [
  { name: 'B05 file glyph after commit', selector: '.lesson-canvas .file-glyph' },
  { name: 'B05 worker box after commit', selector: '.lesson-canvas .ac-worker' }
])
await p1.screenshot({ path: outDir + 'ia-B05-committed.png' })
report.keyboard = {}
await p1.locator('h1').click()
await p1.keyboard.press('Space'); await p1.waitForTimeout(400)
report.keyboard.spaceOnBody = await rd(p1, () => ({ label: document.querySelector('.lesson-primary')?.textContent.trim() }))
await p1.locator('.lesson-primary').click(); await p1.waitForTimeout(300)
const beforePos = await rd(p1, () => document.querySelector('.lesson-playbar input[type=range]')?.value)
await p1.keyboard.press('ArrowRight'); await p1.waitForTimeout(400)
const afterPos = await rd(p1, () => document.querySelector('.lesson-playbar input[type=range]')?.value)
report.keyboard.arrowAfterButtonClick = { beforePos, afterPos, changed: beforePos !== afterPos }
report.keyboard.focusSeq = await focusProbe(p1)
report.paramDrawer = await drawerProbe(p1)
await p1.keyboard.press('Escape'); await p1.waitForTimeout(250)
report.keyboard.escClosed = await rd(p1, () => ({ closed: !document.querySelector('dialog[open]'), focus: (document.activeElement.textContent || '').trim().slice(0, 20) }))
await drawerProbe(p1)
const trap = []
for (let i = 0; i < 16; i++) { await p1.keyboard.press('Tab'); trap.push(await rd(p1, () => !!document.activeElement.closest('dialog'))) }
report.keyboard.dialogTrap = { escaped: trap.some(x => !x), pattern: trap.map(x => x ? 1 : 0).join('') }
await p1.keyboard.press('Escape')
report.modeToggleLesson = await modeDiff(p1)
report.timelinePath = await timelinePath(p1)
await p1.screenshot({ path: outDir + 'ia-B05-drawer-tabs.png' })
await p1.emulateMedia({ reducedMotion: 'reduce' })
await p1.reload({ waitUntil: 'networkidle' }); await p1.waitForTimeout(500)
report.reducedMotion = await rd(p1, () => ({ rootClass: document.querySelector('.visual-lab')?.className, matches: matchMedia('(prefers-reduced-motion: reduce)').matches }))
await p1.close()

/* B. other kinds */
report.kinds = {}
for (const [id, kind] of [['T01', 'schema'], ['S01', 'timeline'], ['F04', 'flow'], ['A01', 'metrics'], ['B07', 'query']]) {
  const p = await open('/experiment/' + id)
  const inv = await rd(p, clickableInventory, 'svg')
  const startLabel = await p.locator('button', { hasText: /开始演示|开始探索/ }).first().textContent().catch(() => null)
  await p.locator('button', { hasText: /开始演示|开始探索/ }).first().click().catch(() => {})
  await p.waitForTimeout(400)
  await p.locator('button', { hasText: /跳到结果/ }).first().click().catch(() => {})
  await p.waitForTimeout(400)
  const tests = await clickTest(p, [
    { name: id + ' first svg button', selector: 'svg g[role="button"]' },
    { name: id + ' plain rect', selector: '.lesson-canvas rect:not(.file-body)' }
  ])
  report.kinds[id] = { kind, startLabel: (startLabel || '').trim(), invRawTotal: inv.rawTotal, invGroups: inv.groups.slice(0, 10), tests }
  await p.screenshot({ path: outDir + 'ia-' + id + '.png' })
  await p.close()
}

/* C. B02 VisualLabView */
{
  const p = await open('/experiment/B02')
  report.visualLab = {
    dom: await rd(p, domOrder),
    type: await rd(p, () => ['.vl-title-row h1', '.vl-title-row p', '.vl-stage-top', '.vl-caption p', '.vl-caption small', '.vl-controls button', '.vl-action-bar button', '.vl-footer', '.vl-nav button'].map(sel => { const el = document.querySelector(sel); if (!el) return null; const c = getComputedStyle(el); return { sel, font: c.fontSize, color: c.color, text: (el.textContent || '').trim().slice(0, 28) } }).filter(Boolean)),
    inv: await rd(p, clickableInventory, 'svg'),
    tests: await clickTest(p, [
      { name: 'B02 file glyph', selector: 'svg .file-glyph' },
      { name: 'B02 writer box', selector: '.vl-writer' },
      { name: 'B02 input box', selector: '.vl-input' },
      { name: 'B02 lane title', selector: '.vl-lane-title' }
    ])
  }
  await p.locator('.vl-play').click(); await p.waitForTimeout(1000)
  await p.locator('button', { hasText: /跳过动画/ }).click().catch(() => {})
  await p.waitForTimeout(500)
  report.visualLab.testsAfterPlay = await clickTest(p, [{ name: 'B02 file glyph after play', selector: 'svg .file-glyph' }])
  report.visualLab.mode = await modeDiff(p)
  await p.screenshot({ path: outDir + 'ia-B02-desktop.png' })
  await p.close()
}

/* D. mobile */
report.mobile = {}
for (const [path, name] of [['/experiment/B05', 'B05'], ['/experiment/B02', 'B02'], ['/catalog', 'catalog']]) {
  const p = await open(path, { width: 375, height: 812 })
  report.mobile[name] = await rd(p, () => {
    const box = el => el ? __h.rect(el) : null
    const play = document.querySelector('.lesson-playbar, .vl-controls')
    const chap = document.querySelector('.lesson-chapters')
    const svg = document.querySelector('.lesson-canvas, .vl-canvas')
    const small = [...document.querySelectorAll('button,a[href],input,select')].map(el => { const r = el.getBoundingClientRect(); return { label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) } }).filter(x => x.w > 0 && (x.w < 44 || x.h < 44))
    return {
      viewport: { w: innerWidth, h: innerHeight },
      doc: { scrollW: document.documentElement.scrollWidth, scrollH: document.documentElement.scrollHeight, horizontalOverflow: document.documentElement.scrollWidth > innerWidth },
      h1: box(document.querySelector('h1')), svg: box(svg), svgMinH: svg ? getComputedStyle(svg).minHeight : null,
      playbar: box(play), playbarChildren: play ? [...play.children].map(el => ({ tag: el.tagName.toLowerCase(), cls: (el.getAttribute('class') || '').slice(0, 20), ...box(el) })) : [],
      chapters: chap ? { ...box(chap), scrollW: chap.scrollWidth, clientW: chap.clientWidth, overflowX: getComputedStyle(chap).overflowX } : null,
      stageBar: box(document.querySelector('.lesson-stage-bar, .vl-stage-top')), explanation: box(document.querySelector('.lesson-explanation, .vl-caption')),
      navActions: [...document.querySelectorAll('.vl-nav-actions > *')].map(el => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 14), ...box(el) })),
      smallTargets: { total: small.length, sample: small.slice(0, 10) }
    }
  })
  await p.screenshot({ path: outDir + 'ia-' + name + '-375.png' })
  await p.close()
}

/* E. progress */
{
  const p = await open('/experiment/B05')
  report.progress = {}
  await p.locator('button', { hasText: /开始演示/ }).click().catch(() => {}); await p.waitForTimeout(1500)
  report.progress.linksToProgressOnLesson = await rd(p, () => ({ progressLinks: document.querySelectorAll('a[href="/progress"]').length, allLinks: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).slice(0, 14) }))
  for (const id of ['T01', 'S01']) { await p.goto(new URL('/experiment/' + id, base).href, { waitUntil: 'networkidle' }); await p.waitForTimeout(300) }
  report.progress.storageAfter3Lessons = await rd(p, () => ({ keys: Object.keys(localStorage), progress: localStorage.getItem('hudi-lab-progress') }))
  await p.goto(new URL('/catalog', base).href, { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
  report.progress.catalogNav = await rd(p, () => ({ progressLinks: document.querySelectorAll('a[href="/progress"]').length, headerLinks: [...document.querySelectorAll('header a')].map(a => a.getAttribute('href')) }))
  await p.goto(new URL('/progress', base).href, { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
  report.progress.page = await rd(p, () => { const t = document.body.innerText.replace(/\n/g, ' | '); return { hasEmptyState: t.includes('还没有任何学习记录'), rows: document.querySelectorAll('.el-table__row').length, text: t.slice(0, 460) } })
  await p.screenshot({ path: outDir + 'ia-progress.png' })
  await p.close()
}

/* F. light theme + E01 caption overflow */
{
  const p = await open('/experiment/B05'); await p.addInitScript(H)
  await p.evaluate(() => localStorage.setItem('hudi-lab-theme', 'light'))
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(500)
  report.lightContrast = await rd(p, contrastScan)
  await p.screenshot({ path: outDir + 'ia-B05-light.png' })
  await p.close()
  const q = await open('/experiment/E01')
  await q.locator('.lesson-chapters button').nth(3).click().catch(() => {})
  await q.waitForTimeout(500)
  report.e01caption = await rd(q, () => {
    const wrap = document.querySelector('.lesson-explanation'), pEl = wrap?.querySelector('p'), inner = wrap?.querySelector('div')
    const box = el => el ? { ...__h.rect(el), scrollH: el.scrollHeight, clientH: el.clientHeight } : null
    return { stageBar: (document.querySelector('.lesson-stage-bar')?.textContent || '').trim().slice(0, 70), wrap: box(wrap), inner: box(inner), p: box(pEl), overflow: wrap ? wrap.scrollHeight > wrap.clientHeight : null }
  })
  await q.screenshot({ path: outDir + 'ia-E01-caption.png' })
  await q.close()
}

report.pageErrors = errs
fs.writeFileSync('D:/code/hudi演示/_analysis/ia-probe.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  lessonDomKids: report.lessonDesktop.dom.kids,
  lessonDom: { nav: report.lessonDesktop.dom.nav, svg: report.lessonDesktop.dom.svg, explanation: report.lessonDesktop.dom.explanation, playbar: report.lessonDesktop.dom.playbar, chapters: report.lessonDesktop.dom.chapters, footer: report.lessonDesktop.dom.footer, h1: report.lessonDesktop.dom.h1, doc: report.lessonDesktop.dom.doc },
  clickBeforePlay: report.clickBeforePlay.map(x => ({ name: x.name, clicked: x.clicked, dialogOpen: x.dialog.open, title: x.dialog.title, cursor: x.pre?.cursor, disabled: x.pre?.disabled })),
  clickAfterPlay: report.clickAfterPlay.map(x => ({ name: x.name, clicked: x.clicked, dialogOpen: x.dialog.open, title: x.dialog.title })),
  mode: report.modeToggleLesson,
  timeline: report.timelinePath,
  keyboard: report.keyboard,
  param: report.paramDrawer,
  a11y: report.lessonDesktop.a11y,
  domClickables: report.lessonDesktop.domClickables,
  mobile: Object.fromEntries(Object.entries(report.mobile).map(([k, v]) => [k, { doc: v.doc, h1: v.h1, svg: v.svg, playbar: v.playbar, playbarChildren: v.playbarChildren, chapters: v.chapters, small: v.smallTargets.total }])),
  progress: report.progress,
  pageErrors: errs
}, null, 2))
await browser.close()
