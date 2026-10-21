import { chromium } from '@playwright/test'
const b = await chromium.launch({ channel: 'msedge' })
const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto('http://127.0.0.1:5173/experiment/B05', { waitUntil: 'networkidle' }); await p.waitForTimeout(500)
const r = []
for (const k of ['Space', 'Enter']) {
  await p.keyboard.press('Escape').catch(() => {})
  await p.waitForTimeout(200)
  await p.evaluate(() => { const g = document.querySelector('.lesson-canvas .file-glyph'); g.focus(); window.__ev = []; })
  await p.keyboard.press(k); await p.waitForTimeout(400)
  r.push({ key: k, ev: await p.evaluate(() => window.__ev), open: await p.evaluate(() => !!document.querySelector('dialog[open]')), playBtn: await p.evaluate(() => document.querySelector('.lesson-primary')?.textContent.trim()) })
}
console.log(JSON.stringify(r, null, 1))
await b.close()
