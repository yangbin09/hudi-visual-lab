import { chromium } from '@playwright/test'
const browser = await chromium.launch({ channel: 'msedge' })
const base = 'http://127.0.0.1:5173/'
for (const id of ['T01', 'A01']) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await p.goto(base + 'experiment/' + id, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  const info = await p.evaluate(() => {
    const g = document.querySelector('.lesson-canvas svg g[role="button"]') || document.querySelector('svg g[role="button"]')
    const r = g.getBoundingClientRect()
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2
    const hit = document.elementFromPoint(cx, cy)
    return { tag: g.tagName, bbox: { x: r.x, y: r.y, w: r.width, h: r.height }, cx, cy, hitTag: hit && hit.tagName, hitCls: hit && hit.getAttribute('class'), hitRole: hit && hit.getAttribute('role') }
  })
  // JS click (bubbles from g)
  const jsClick = await p.evaluate(() => {
    const g = document.querySelector('.lesson-canvas svg g[role="button"]') || document.querySelector('svg g[role="button"]')
    g.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return !!g
  })
  await p.waitForTimeout(400)
  const afterJs = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? { open: true, title: d.querySelector('h2')?.textContent } : { open: false } })
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  // Playwright click
  const g = p.locator('svg g[role="button"]').first()
  await g.click({ force: true }).catch(e => console.log('click err', e.message))
  await p.waitForTimeout(400)
  const afterPw = await p.evaluate(() => { const d = document.querySelector('dialog[open]'); return d ? { open: true, title: d.querySelector('h2')?.textContent, body: d.innerText.slice(0, 80) } : { open: false, active: document.activeElement?.tagName } })
  console.log(id, JSON.stringify({ info, jsClick, afterJs, afterPw }, null, 1))
  await p.close()
}
await browser.close()
