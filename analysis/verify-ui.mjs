import { pathToFileURL } from 'node:url'
const pw = await import(pathToFileURL('D:/code/hudi演示/hudi-visual-lab/node_modules/playwright/index.js').href)
const chromium = pw.chromium ?? pw.default?.chromium

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const out = {}

await page.goto('http://127.0.0.1:5173/catalog', { waitUntil: 'networkidle' })
out.catalogCards = await page.locator('.catalog-card').count()
out.firstCardText = await page.locator('.catalog-card').first().innerText()
out.catalogHasSummaryClass = await page.locator('.catalog-card p').count()
await page.screenshot({ path: 'D:/code/hudi演示/_analysis/shot-catalog.png', fullPage: false })

for (const id of ['B01', 'B04', 'I03', 'S04']) {
  await page.goto(`http://127.0.0.1:5173/experiment/${id}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const t = await page.locator('body').innerText()
  out[id] = {
    hasGoal: /学习目标|本节目标|你将学会/.test(t),
    hasPrereq: /前置知识|先修/.test(t),
    hasQuiz: /自测|练习|测验|答题/.test(t),
    hasTakeaway: /一句话|关键结论|小结/.test(t),
    bodyLen: t.length,
    h1: await page.locator('h1').first().innerText().catch(() => ''),
    chapters: await page.locator('.lesson-chapters button').allInnerTexts(),
    explanation: await page.locator('.lesson-explanation').innerText().catch(() => ''),
    footer: await page.locator('.vl-footer').innerText().catch(() => ''),
  }
  if (id === 'B01') await page.screenshot({ path: 'D:/code/hudi演示/_analysis/shot-B01.png', fullPage: true })
  if (id === 'S04') await page.screenshot({ path: 'D:/code/hudi演示/_analysis/shot-S04.png', fullPage: true })
}
// B02 特殊页
await page.goto('http://127.0.0.1:5173/experiment/B02', { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const b02 = await page.locator('body').innerText()
out.B02 = { bodyLen: b02.length, hasQuiz: /自测|练习|测验|答题/.test(b02), hasGoal: /学习目标|本节目标/.test(b02), text: b02.slice(0, 1200) }
await page.screenshot({ path: 'D:/code/hudi演示/_analysis/shot-B02.png' })
console.log(JSON.stringify(out, null, 1))
await browser.close()
