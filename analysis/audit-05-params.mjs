import { launch, newPage, goto, SHOTS } from './lib.mjs'
const browser = await launch()
const page = await newPage(browser, { width: 1440, height: 900 })
await goto(page, '/experiment/B05')
await page.waitForTimeout(700)
// apply recordKey 9999
await page.locator('.vl-nav-actions button', { hasText: '参数' }).click()
await page.waitForTimeout(400)
const inputs = page.locator('.lesson-settings input')
await inputs.first().fill('9999')
await page.locator('.lesson-settings button[type=submit]').click()
await page.waitForTimeout(700)
const afterApply = {
  notice: await page.locator('.lesson-bottom').innerText(),
  step: await page.locator('.lesson-step').innerText(),
  bodyHas9999: (await page.locator('body').innerText()).includes('9999'),
}
await page.locator('.lesson-playbar .lesson-primary').click()
await page.waitForTimeout(3000)
const afterPlay = {
  bodyHas9999: (await page.locator('body').innerText()).includes('9999'),
  step: await page.locator('.lesson-step').innerText(),
  explain: await page.locator('.lesson-explanation p').innerText(),
  svgTexts: await page.evaluate(() => [...document.querySelectorAll('svg.lesson-canvas text')].map((t) => t.textContent).join(' | ')),
}
await page.screenshot({ path: SHOTS + '56-B05-desktop-param-after-play.png' })
// engineer mode: count DOM changes more precisely with node count + class changes
const snap = async () => page.evaluate(() => {
  const els = [...document.querySelectorAll('body *')]
  return { count: els.length, html: document.getElementById('app')?.innerHTML.length || 0 }
})
const s0 = await snap()
await page.locator('.vl-nav-actions button', { hasText: '基础模式' }).click()
await page.waitForTimeout(400)
const s1 = await snap()
await page.screenshot({ path: SHOTS + '57-B05-desktop-engineer-vs-basic.png' })
// light toggle label/visibility
const themeBtn = await page.evaluate(() => {
  const b = document.querySelector('.vl-nav-actions button[aria-label="切换深浅主题"]')
  const cs = getComputedStyle(b)
  const r = b.getBoundingClientRect()
  return { text: b.textContent, color: cs.color, bg: cs.backgroundColor, w: Math.round(r.width), h: Math.round(r.height), font: cs.fontSize }
})
console.log(JSON.stringify({ afterApply, afterPlay, engineer: { before: s0, after: s1 }, themeBtn }, null, 1))
await browser.close()
