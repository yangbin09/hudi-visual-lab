import { chromium } from '@playwright/test'
const browser = await chromium.launch({ channel: 'msedge' })
const base = 'http://127.0.0.1:5173/'
const out = {}
for (const [vp, name] of [[{ width: 1366, height: 768 }, 'laptop'], [{ width: 768, height: 1024 }, 'tablet']]) {
  const p = await browser.newPage({ viewport: vp })
  await p.goto(base + 'experiment/B05', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  out[name] = await p.evaluate(() => {
    const b = el => el ? (r => ({ y: Math.round(r.y), h: Math.round(r.height), bottom: Math.round(r.bottom) }))(el.getBoundingClientRect()) : null
    return { vp: { w: innerWidth, h: innerHeight }, docH: document.documentElement.scrollHeight,
      h1: b(document.querySelector('h1')), svg: b(document.querySelector('.lesson-canvas')), playbar: b(document.querySelector('.lesson-playbar')), chapters: b(document.querySelector('.lesson-chapters')), footer: b(document.querySelector('.vl-footer')),
      playVisible: (document.querySelector('.lesson-primary')?.getBoundingClientRect().bottom || 0) <= innerHeight,
      chaptersVisible: (document.querySelector('.lesson-chapters')?.getBoundingClientRect().bottom || 0) <= innerHeight }
  })
  await p.screenshot({ path: 'D:/code/hudi演示/_analysis/shots/ia-B05-' + name + '.png' })
  await p.close()
}
// catalog grid + card behavior
for (const [vp, name] of [[{ width: 1440, height: 900 }, 'desktop'], [{ width: 375, height: 812 }, 'mobile']]) {
  const p = await browser.newPage({ viewport: vp })
  await p.goto(base + 'catalog', { waitUntil: 'networkidle' }); await p.waitForTimeout(600)
  out['catalog-' + name] = await p.evaluate(() => {
    const grid = document.querySelector('.catalog-grid'); const cards = [...document.querySelectorAll('.catalog-card')]
    return { cards: cards.length, cols: grid ? getComputedStyle(grid).gridTemplateColumns : null, docH: document.documentElement.scrollHeight,
      firstCardY: cards[0] ? Math.round(cards[0].getBoundingClientRect().y) : null,
      cardH: cards[0] ? Math.round(cards[0].getBoundingClientRect().height) : null,
      aboveFold: cards.filter(c => c.getBoundingClientRect().top < innerHeight).length,
      filtersScrollH: document.querySelector('.catalog-filters') ? Math.round(document.querySelector('.catalog-filters').getBoundingClientRect().height) : null,
      searchVisible: !!document.querySelector('.catalog-search') }
  })
  await p.close()
}
// Tab into canvas then Enter
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(base + 'experiment/B05', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
  await p.evaluate(() => document.body.focus())
  const order = []
  for (let i = 0; i < 12; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => { const a = document.activeElement; return (a.getAttribute('aria-label') || a.textContent || a.tagName).trim().slice(0, 26) + (a.closest('svg') ? ' [canvas]' : '') })) }
  out.tabOrder = order
  // focus the canvas glyph via keyboard and press Enter
  await p.evaluate(() => document.querySelector('.lesson-canvas .file-glyph').focus())
  await p.keyboard.press('Enter'); await p.waitForTimeout(300)
  out.canvasKeyboardOpens = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? { open: true, title: d.querySelector('h2')?.textContent.slice(0, 30) } : { open: false } })
  await p.close()
}
// evidence page + home reachability
{
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(base, { waitUntil: 'networkidle' }); await p.waitForTimeout(400)
  out.home = await p.evaluate(() => ({ links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')), hasProgress: !!document.querySelector('a[href="/progress"]'), hasEvidence: !!document.querySelector('a[href="/evidence"]') }))
  await p.goto(base + 'evidence', { waitUntil: 'networkidle' }); await p.waitForTimeout(300)
  out.evidence = await p.evaluate(() => ({ title: document.querySelector('h1')?.textContent.trim(), hasNav: !!document.querySelector('a[href="/progress"]') }))
  await p.close()
}
console.log(JSON.stringify(out, null, 1))
await browser.close()
