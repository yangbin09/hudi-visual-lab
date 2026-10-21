import { launch, newPage, goto, measure, contrast, saveJson, SHOTS } from './lib.mjs'

const browser = await launch()
const report = {}

const contrastScan = `
(() => {
  const vh = innerHeight
  function effBg(el) {
    let e = el
    while (e && e.nodeType === 1) {
      const bg = getComputedStyle(e).backgroundColor
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
      e = e.parentElement
    }
    return getComputedStyle(document.body).backgroundColor || 'rgb(255,255,255)'
  }
  function path(el) {
    let e = el, s = ''
    for (let i = 0; i < 3 && e && e.nodeType === 1; i++) { s = e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/)[0] : '') + (s ? '>' + s : ''); e = e.parentElement }
    return s
  }
  const out = []
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    const t = n.nodeValue.replace(/\\s+/g, ' ').trim()
    if (!t) continue
    const el = n.parentElement
    if (!el || el.closest('script,style,noscript')) continue
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const key = path(el) + '|' + cs.fontSize + '|' + cs.color + '|' + effBg(el)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ t: t.slice(0, 60), size: parseFloat(cs.fontSize), lh: cs.lineHeight, color: cs.color, bg: effBg(el), path: path(el), top: Math.round(r.top), inFold: r.top < vh, w: Math.round(r.width), h: Math.round(r.height) })
  }
  // svg text (declared user-unit size)
  const svg = document.querySelector('svg.lesson-canvas')
  if (svg) {
    const sr = svg.getBoundingClientRect()
    const vb = (svg.getAttribute('viewBox') || '0 0 1080 425').split(' ').map(Number)
    const scale = Math.min(sr.width / vb[2], sr.height / vb[3])
    svg.querySelectorAll('text').forEach((el) => {
      const t = el.textContent.trim()
      if (!t) return
      const cs = getComputedStyle(el)
      const rr = el.getBoundingClientRect()
      if (rr.width < 1) return
      out.push({ t: t.slice(0, 60), size: parseFloat(cs.fontSize) * scale, declared: parseFloat(cs.fontSize), color: cs.color, bg: effBg(el), path: 'svg-text', top: Math.round(rr.top), inFold: rr.top < vh, w: Math.round(rr.width), h: Math.round(rr.height), scale: Math.round(scale * 1000) / 1000, svg: true })
    })
  }
  return out
})()`

function contrastRows(rows) {
  return rows.map((r) => {
    const ratio = contrast(r.color, r.bg)
    const large = r.size >= 24 || (r.size >= 18.66 && Number(r.weight || 400) >= 700)
    return { ...r, ratio, need: large ? 3 : 4.5, pass: ratio === null ? null : ratio >= (large ? 3 : 4.5), large }
  })
}

/* ===================== A. /experiment/B02 专用页 ===================== */
{
  const page = await newPage(browser, { width: 1440, height: 900 })
  await goto(page, '/experiment/B02')
  await page.waitForTimeout(900)
  await page.screenshot({ path: SHOTS + '30-B02-desktop.png' })
  const m = await measure(page)
  const rows = contrastRows(await page.evaluate(contrastScan))
  report.b02 = {
    title: await page.title(),
    h1: await page.locator('h1').innerText(),
    doc: m.doc,
    stageTop: await page.evaluate(() => {
      const st = document.querySelector('.vl-stage-top')
      if (!st) return null
      return { text: st.innerText.replace(/\s+/g, ' '), html: st.innerHTML.slice(0, 400), spans: [...st.children].map((c) => { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return { t: c.innerText.replace(/\s+/g, ' '), size: cs.fontSize, color: cs.color, w: Math.round(r.width), h: Math.round(r.height), display: cs.display } }) }
    }),
    legendBox: await page.evaluate(() => {
      const els = [...document.querySelectorAll('.vl-stage-top > span')]
      const legend = els.find((e) => /Base File|Log File|旧版本/.test(e.innerText))
      if (!legend) return null
      const r = legend.getBoundingClientRect()
      const cs = getComputedStyle(legend)
      return { text: legend.innerText.replace(/\s+/g, ' '), size: cs.fontSize, color: cs.color, w: Math.round(r.width), h: Math.round(r.height), bg: getComputedStyle(legend.closest('.vl-panel, .visual-lab') || document.body).backgroundColor }
    }),
    svg: m.svg,
    glyphs: m.svgGlyphButtons,
    svgTextCount: m.svgTexts?.length,
    svgTextSmall: m.svgTextSmall,
    svgTextSamples: (m.svgTexts || []).filter((t) => t.size < 12).slice(0, 8),
    actionBar: await page.evaluate(() => {
      const ab = document.querySelector('.vl-action-bar')
      if (!ab) return null
      return { text: ab.innerText.replace(/\s+/g, ' '), buttons: [...ab.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { t: b.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height), size: cs.fontSize, disabled: b.disabled } }) }
    }),
    controls: await page.evaluate(() => {
      const c = document.querySelector('.vl-controls')
      return c ? { text: c.innerText.replace(/\s+/g, ' '), controls: [...c.querySelectorAll('button,input,select')].map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), t: (el.getAttribute('aria-label') || el.innerText || '').slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) } }) } : null
    }),
    engineerBefore: await page.locator('.vl-nav-actions').innerText(),
    engineerBeforeActionBar: await page.locator('.vl-action-bar').innerText(),
  }
  await page.locator('.vl-nav-actions button', { hasText: '基础模式' }).click()
  await page.waitForTimeout(400)
  report.b02.engineerAfter = { nav: await page.locator('.vl-nav-actions').innerText(), actionBar: await page.locator('.vl-action-bar').innerText() }
  await page.screenshot({ path: SHOTS + '30b-B02-desktop-engineer.png' })
  // hover first file glyph
  const g = page.locator('svg [role="button"]').first()
  if (await g.count()) {
    await g.hover()
    await page.waitForTimeout(200)
    report.b02.glyphHover = await g.evaluate((el) => ({ cursor: getComputedStyle(el).cursor, aria: el.getAttribute('aria-label') }))
    await g.click()
    await page.waitForTimeout(600)
    report.b02.glyphDialog = await page.evaluate(() => {
      const d = document.querySelector('dialog[open], .vl-drawer, [class*=drawer]')
      return d ? { cls: d.className, text: d.innerText.replace(/\s+/g, ' ').slice(0, 400) } : null
    })
    await page.screenshot({ path: SHOTS + '30c-B02-desktop-glyphclick.png' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  }
  report.b02.contrast = rows.filter((r) => r.ratio !== null && r.ratio < 4.5).slice(0, 25)
  report.b02.contrastAll = rows.length
  report.b02.contrastFail = rows.filter((r) => r.pass === false).length
  await page.close()

  // mobile B02
  const mp = await newPage(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true })
  await goto(mp, '/experiment/B02')
  await mp.waitForTimeout(900)
  await mp.screenshot({ path: SHOTS + '31-B02-mobile.png' })
  const mm = await measure(mp)
  report.b02Mobile = {
    doc: mm.doc,
    svg: mm.svg,
    svgTextSamples: (mm.svgTexts || []).slice(0, 10),
    legendSpans: await mp.evaluate(() => [...document.querySelectorAll('.vl-stage-top > span')].map((c) => { const r = c.getBoundingClientRect(); const cs = getComputedStyle(c); return { t: c.innerText.replace(/\s+/g, ' '), w: Math.round(r.width), h: Math.round(r.height), size: cs.fontSize, display: cs.display } })),
    actionButtons: await mp.evaluate(() => [...document.querySelectorAll('.vl-action-bar button')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height) } })),
    controls: await mp.evaluate(() => [...document.querySelectorAll('.vl-controls button, .vl-controls input')].map((el) => { const r = el.getBoundingClientRect(); return { tag: el.tagName.toLowerCase(), t: (el.getAttribute('aria-label') || el.innerText || '').slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) } })),
    stageText: await mp.evaluate(() => { const s = document.querySelector('.vl-stage')?.innerText.replace(/\s+/g, ' '); return s?.slice(0, 300) }),
    caption: await mp.evaluate(() => { const c = document.querySelector('.vl-caption')?.innerText.replace(/\s+/g, ' '); return c?.slice(0, 300) }),
    canvasBox: await mp.evaluate(() => { const c = document.querySelector('.vl-canvas'); const r = c?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null }),
  }
  report.b02Mobile.contrastFail = contrastRows(await mp.evaluate(contrastScan)).filter((r) => r.pass === false).slice(0, 20)
  await mp.close()
}

/* ===================== B. 移动端动画页 ===================== */
for (const id of ['B05', 'I03', 'S04', 'Q02', 'S01', 'E01']) {
  const page = await newPage(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true })
  await goto(page, `/experiment/${id}`)
  await page.waitForTimeout(800)
  const m = await measure(page)
  await page.screenshot({ path: SHOTS + `32-${id}-mobile.png` })
  await page.locator('.lesson-playbar .lesson-primary').click().catch(() => {})
  await page.waitForTimeout(1600)
  await page.screenshot({ path: SHOTS + `33-${id}-mobile-playing.png` })
  const mPlay = await measure(page)
  const taps = m.interactives.map((i) => ({ tag: i.tag, t: i.text, w: i.w, h: i.h, y: i.y }))
  const under = taps.filter((t) => t.w < 44 || t.h < 44)
  // drawer
  await page.locator('.lesson-stage-bar button').first().click()
  await page.waitForTimeout(700)
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]')
    if (!d) return null
    const dr = d.querySelector('.vl-drawer')
    const r = d.getBoundingClientRect()
    const tabs = [...d.querySelectorAll('.vl-drawer-tabs button')].map((b) => { const br = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { t: b.innerText.trim(), w: Math.round(br.width), h: Math.round(br.height), top: Math.round(br.top), size: cs.fontSize } })
    const rows = [...new Set(tabs.map((t) => t.top))].length
    return {
      dialog: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) },
      drawer: { w: Math.round(dr.getBoundingClientRect().width), scrollH: dr.scrollHeight, clientH: dr.clientHeight, scrollW: dr.scrollWidth, clientW: dr.clientWidth },
      tabs, tabRows: rows,
      tabStripW: Math.round((tabs[0]?.w || 0)),
    }
  })
  await page.screenshot({ path: SHOTS + `34-${id}-mobile-drawer.png` })
  // switch to 运行日志 and check scroll
  await page.locator('.vl-drawer-tabs button', { hasText: '运行日志' }).first().click().catch(() => {})
  await page.waitForTimeout(300)
  const logTab = await page.evaluate(() => { const dr = document.querySelector('dialog[open] .vl-drawer'); return dr ? { scrollH: dr.scrollHeight, clientH: dr.clientHeight, text: dr.innerText.replace(/\s+/g, ' ').slice(0, 200) } : null })
  await page.locator('dialog[open] button[aria-label="关闭详情"]').click().catch(() => {})
  await page.waitForTimeout(200)
  // param panel on mobile
  await page.locator('.vl-nav-actions button', { hasText: '参数' }).click().catch(() => {})
  await page.waitForTimeout(400)
  const paramDlg = await page.evaluate(() => {
    const d = document.querySelector('dialog[open]')
    if (!d) return null
    const dr = d.querySelector('.vl-drawer')
    return { w: Math.round(dr.getBoundingClientRect().width), scrollH: dr.scrollHeight, clientH: dr.clientHeight, inputs: [...dr.querySelectorAll('input,select')].map((el) => { const r = el.getBoundingClientRect(); return { t: el.closest('label')?.innerText?.split('\\n')[0], w: Math.round(r.width), h: Math.round(r.height) } }), html: dr.innerText.replace(/\s+/g, ' ').slice(0, 300) }
  })
  await page.screenshot({ path: SHOTS + `35-${id}-mobile-params.png` })
  await page.locator('dialog[open] button[aria-label="关闭详情"]').click().catch(() => {})
  report['mobile_' + id] = {
    doc: m.doc,
    svg: m.svg,
    svgScale: (() => { if (!m.svg) return null; const [vw, vh] = (m.svg.vb || '0 0 1080 425').split(' ').slice(2).map(Number); const s = Math.min(m.svg.w / vw, m.svg.h / vh); return { scale: Math.round(s * 1000) / 1000, rendered10px: Math.round(10 * s * 10) / 10, rendered12px: Math.round(12 * s * 10) / 10, contentW: Math.round(vw * s), contentH: Math.round(vh * s) } })(),
    svgTexts: (mPlay.svgTexts || []).slice(0, 12).map((t) => ({ t: t.t, declared: t.size })),
    tapUnder44: under.length,
    tapTotal: taps.length,
    tapUnder44Samples: under.slice(0, 18),
    drawer: dlg,
    logTab,
    paramDlg,
    overflowCount: m.overflowCount,
    overflowEls: m.overflowEls.slice(0, 6),
    hScrollers: m.hScrollers,
    contrastFail: contrastRows(await page.evaluate(contrastScan)).filter((r) => r.pass === false).slice(0, 20),
    stageBarText: m.initial !== undefined ? undefined : undefined,
  }
  await page.close()
  console.log('mobile done', id)
}

/* ===================== C. 深浅色 + 对比度 ===================== */
for (const [path, name, key] of [['/', '40-home-light-audit', 'homeLightAudit'], ['/catalog', '41-catalog-light-audit', 'catalogLightAudit'], ['/experiment/B05', '42-B05-light-audit', 'lessonLightAudit']]) {
  const page = await newPage(browser, { width: 1440, height: 900 })
  await goto(page, path)
  await page.waitForTimeout(600)
  await page.locator('button[aria-label="切换深浅主题"]').first().click()
  await page.waitForTimeout(500)
  if (path.includes('B05')) { await page.locator('.lesson-playbar .lesson-primary').click().catch(() => {}); await page.waitForTimeout(1500) }
  await page.screenshot({ path: SHOTS + name + '.png' })
  const rows = contrastRows(await page.evaluate(contrastScan))
  report[key] = {
    rootBg: await page.evaluate(() => getComputedStyle(document.querySelector('.visual-home,.visual-lab')).backgroundColor),
    fail: rows.filter((r) => r.pass === false),
    failCount: rows.filter((r) => r.pass === false).length,
    total: rows.length,
    svgFill: await page.evaluate(() => {
      const svg = document.querySelector('svg.lesson-canvas')
      if (!svg) return null
      const rects = [...svg.querySelectorAll('rect')].slice(0, 6).map((r) => ({ cls: r.getAttribute('class'), fill: getComputedStyle(r).fill }))
      const texts = [...svg.querySelectorAll('text')].slice(0, 8).map((t) => ({ cls: t.getAttribute('class'), fill: getComputedStyle(t).fill, size: getComputedStyle(t).fontSize }))
      return { rects, texts }
    }),
  }
  await page.close()
}

/* ===================== D. 进度页与动画是否联通 ===================== */
{
  const page = await newPage(browser, { width: 1440, height: 900 })
  await goto(page, '/experiment/B05')
  await page.waitForTimeout(800)
  const lsBefore = await page.evaluate(() => Object.keys(localStorage))
  const progBefore = await page.evaluate(() => localStorage.getItem('hudi-lab-progress'))
  await page.locator('.lesson-playbar .lesson-primary').click().catch(() => {})
  await page.waitForTimeout(2000)
  await page.locator('.lesson-playbar button', { hasText: '跳到结果' }).click().catch(() => {})
  await page.waitForTimeout(800)
  const progAfter = await page.evaluate(() => localStorage.getItem('hudi-lab-progress'))
  await goto(page, '/progress')
  await page.waitForTimeout(600)
  const progressText = (await page.locator('body').innerText()).replace(/\s+/g, ' ')
  const tableRows = await page.locator('.el-table__row').count()
  const emptyText = await page.locator('.el-table__empty-text').innerText().catch(() => null)
  report.progressGap = {
    lsBefore, progBefore, progAfter, tableRows, emptyText,
    countCards: await page.evaluate(() => [...document.querySelectorAll('section .text-2xl')].map((e) => e.innerText.trim())),
    progressHead: progressText.slice(0, 400),
    hasAnyVisited: /已访问实验\s*0|还没有任何学习记录/.test(progressText),
  }
  await page.screenshot({ path: SHOTS + '43-progress-after-lesson.png' })
  // evidence search
  await goto(page, '/evidence')
  const evInput = page.locator('.el-input__inner').first()
  const evTests = []
  for (const q of ['Log', 'bucket', 'r26', 'zzzz']) {
    await evInput.fill(q)
    await page.waitForTimeout(400)
    const hitText = await page.evaluate(() => {
      const m = document.body.innerText.match(/命中\s*\d+\s*\/\s*\d+\s*条/)
      return m ? m[0] : null
    })
    evTests.push({ q, rows: await page.locator('.el-table__row').count(), hitText, empty: await page.locator('.el-table__empty-text').innerText().catch(() => null) })
  }
  report.evidenceSearch = evTests
  await page.screenshot({ path: SHOTS + '44-evidence-search.png' })
  await page.close()
}

saveJson('raw-03-interactions.json', report)
console.log('\n===== B02 =====')
console.log('stageTop:', JSON.stringify(report.b02.stageTop))
console.log('legend:', JSON.stringify(report.b02.legendBox))
console.log('actionBar:', JSON.stringify(report.b02.actionBar))
console.log('controls:', JSON.stringify(report.b02.controls))
console.log('engineer:', JSON.stringify(report.b02.engineerBefore), '->', JSON.stringify(report.b02.engineerAfter))
console.log('glyphHover:', JSON.stringify(report.b02.glyphHover), 'dialog:', JSON.stringify(report.b02.glyphDialog))
console.log('contrast fail', report.b02.contrastFail, '/', report.b02.contrastAll)
report.b02.contrast.slice(0, 15).forEach((r) => console.log('   ', r.ratio, r.size + 'px', r.color, 'on', r.bg, '|', r.t.slice(0, 30), '|', r.path))
console.log('\n===== B02 mobile =====')
console.log('doc', JSON.stringify(report.b02Mobile.doc), 'svg', JSON.stringify(report.b02Mobile.svg))
console.log('legend spans', JSON.stringify(report.b02Mobile.legendSpans))
console.log('action', JSON.stringify(report.b02Mobile.actionButtons))
console.log('controls', JSON.stringify(report.b02Mobile.controls))
console.log('canvasBox', JSON.stringify(report.b02Mobile.canvasBox))
console.log('caption', JSON.stringify(report.b02Mobile.caption))

for (const id of ['B05', 'I03', 'S04', 'Q02', 'S01', 'E01']) {
  const r = report['mobile_' + id]
  console.log('\n===== mobile', id, '=====')
  console.log('docW', r.doc.scrollWidth, 'clientW', r.doc.clientWidth, 'overflow', r.overflowCount, JSON.stringify(r.overflowEls.slice(0, 3)))
  console.log('svg', JSON.stringify(r.svg), 'scale', JSON.stringify(r.svgScale))
  console.log('taps', r.tapUnder44 + '/' + r.tapTotal, JSON.stringify(r.tapUnder44Samples.slice(0, 8)))
  console.log('drawer', JSON.stringify(r.drawer))
  console.log('logTab', JSON.stringify(r.logTab))
  console.log('paramDlg', JSON.stringify(r.paramDlg))
  console.log('contrastFail', r.contrastFail.length, r.contrastFail.slice(0, 6).map((x) => x.ratio + ' ' + x.size + 'px ' + x.t.slice(0, 20)))
}
for (const k of ['homeLightAudit', 'catalogLightAudit', 'lessonLightAudit']) {
  console.log('\n===== light', k, '===== rootBg', report[k].rootBg, 'fail', report[k].failCount, '/', report[k].total)
  report[k].fail.slice(0, 10).forEach((r) => console.log('   ', r.ratio, r.size + 'px', r.color, 'on', r.bg, '|', r.t.slice(0, 26), '|', r.path))
  console.log('svgFill', JSON.stringify(report[k].svgFill))
}
console.log('\n===== progress gap =====')
console.log(JSON.stringify(report.progressGap, null, 1).slice(0, 1500))
console.log('evidenceSearch', JSON.stringify(report.evidenceSearch))
await browser.close()
