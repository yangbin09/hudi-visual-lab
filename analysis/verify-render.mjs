import { pathToFileURL } from 'node:url'
const pw = await import(pathToFileURL('D:/code/hudi演示/hudi-visual-lab/node_modules/playwright/index.js').href)
const chromium = pw.chromium ?? pw.default?.chromium
const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
const out = {}
for (const id of ['B01', 'B04', 'I03', 'S04']) {
  await page.goto(`http://127.0.0.1:5173/experiment/${id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const text = await page.locator('body').innerText()
  out[id] = {
    bodyLen: text.length,
    hasObjective: /学完|目标|你会/.test(text),
    hasTakeaway: /结论/.test(text),
    hasGlossary: /术语/.test(text),
    hasLimitations: /边界|待验证|r26 未确认/.test(text),
    hasSelfcheck: /自测|练习|答题/.test(text),
    caption: text.slice(0, 700),
  }
  await page.screenshot({ path: `D:/code/hudi演示/_analysis/shot-content-${id}.png`, fullPage: true })
}
console.log(JSON.stringify({ out, errors }, null, 1))
await browser.close()
