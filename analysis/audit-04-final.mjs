import { launch, newPage, goto, measure, saveJson, SHOTS } from './lib.mjs'

const browser = await launch()
const report = {}

const canvasContent = `
(() => {
  const svg = document.querySelector('svg.lesson-canvas') || document.querySelector('.vl-canvas svg') || document.querySelector('.vl-canvas')?.querySelector('svg')
  if (!svg) return null
  const box = svg.getBoundingClientRect()
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9, count = 0
  svg.querySelectorAll('rect,text,path,circle,g[transform]').forEach((el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return
    // ignore full-canvas background rect / pattern
    if (r.width > box.width - 1 && r.height > box.height - 1) return
    if (r.width * r.height > box.width * box.height * 0.9) return
    minX = Math.min(minX, r.left); minY = Math.min(minY, r.top)
    maxX = Math.max(maxX, r.right); maxY = Math.max(maxY, r.bottom)
    count++
  })
  if (!count) return { box: { w: Math.round(box.width), h: Math.round(box.height) } }
  return {
    box: { w: Math.round(box.width), h: Math.round(box.height) },
    content: { x: Math.round(minX - box.left), y: Math.round(minY - box.top), w: Math.round(maxX - minX), h: Math.round(maxY - minY) },
    widthRatio: Math.round(((maxX - minX) / box.width) * 100),
    heightRatio: Math.round(((maxY - minY) / box.height) * 100),
    areaRatio: Math.round((((maxX - minX) * (maxY - minY)) / (box.width * box.height)) * 100),
    els: count,
  }
})()`

/* --- canvas occupancy desktop --- */
for (const [id, name] of [['B05', 'B05'], ['I03', 'I03'], ['Q02', 'Q02'], ['S04', 'S04'], ['S01', 'S01'], ['E01', 'E01'], ['B02', 'B02']]) {
  const page = await newPage(browser, { width: 1440, height: 900 })
  await goto(page, `/experiment/${id}`)
  await page.waitForTimeout(800)
  if (id !== 'B02') {
    await page.locator('.lesson-playbar .lesson-primary').click().catch(() => {})
    await page.waitForTimeout(1200)
    await page.locator('.lesson-playbar button', { hasText: '跳到结果' }).click().catch(() => {})
    await page.waitForTimeout(600)
  } else {
    await page.locator('.vl-action-bar button', { hasText: 'Upsert' }).click().catch(() => {})
    await page.waitForTimeout(1800)
  }
  const c = await page.evaluate(canvasContent)
  report['canvas_' + id] = c
  if (id === 'B05') await page.screenshot({ path: SHOTS + '50-B05-desktop-result.png' })
  if (id === 'B02') await page.screenshot({ path: SHOTS + '51-B02-desktop-after-upsert.png' })
  await page.close()
}

/* --- mobile fold inventory + canvas --- */
for (const [path, key, name] of [['/', 'foldHomeMobile', '52-home-mobile-fold'], ['/experiment/B05', 'foldLessonMobile', '53-B05-mobile-fold']]) {
  const page = await newPage(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true })
  const t0 = Date.now()
  await goto(page, path)
  report[key + 'LoadMs'] = Date.now() - t0
  report[key + 'Timing'] = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0]
    return n ? { dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null
  })
  report[key] = await page.evaluate(() => {
    const vh = innerHeight
    const items = []
    document.querySelectorAll('body *').forEach((el) => {
      if (el.children.length) return
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!t) return
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.top >= vh || r.bottom <= 0) return
      items.push({ t: t.slice(0, 50), y: Math.round(r.top), size: parseFloat(getComputedStyle(el).fontSize) })
    })
    const btns = [...document.querySelectorAll('a,button,input,select')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.top < vh && r.bottom > 0 }).map((el) => ({ t: (el.getAttribute('aria-label') || el.innerText || '').trim().slice(0, 24), y: Math.round(el.getBoundingClientRect().top), h: Math.round(el.getBoundingClientRect().height) }))
    return { items: items.sort((a, b) => a.y - b.y), buttonsInFold: btns }
  })
  await page.screenshot({ path: SHOTS + name + '.png' })
  if (path.startsWith('/experiment')) report[key + 'Canvas'] = await page.evaluate(canvasContent)
  await page.close()
}

/* --- param apply test + play controls --- */
{
  const page = await newPage(browser, { width: 1440, height: 900 })
  await goto(page, '/experiment/B05')
  await page.waitForTimeout(700)
  await page.locator('.lesson-playbar .lesson-primary').click().catch(() => {})
  await page.waitForTimeout(1500)
  // seek while playing
  const range = page.locator('.lesson-playbar input[type=range]')
  await range.evaluate((el) => { el.value = String(Number(el.max) * 0.7); el.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.waitForTimeout(500)
  report.seekWhilePlaying = { status: await page.locator('.lesson-stage-bar span').first().innerText(), playingLabel: await page.locator('.lesson-playbar .lesson-primary').innerText(), step: await page.locator('.lesson-step').innerText() }
  // param apply
  await page.locator('.vl-nav-actions button', { hasText: '参数' }).click()
  await page.waitForTimeout(400)
  const form = page.locator('.lesson-settings')
  const inputs = form.locator('input')
  report.paramBefore = { count: await inputs.count(), values: await inputs.evaluateAll((els) => els.map((e) => e.value)) }
  await inputs.first().fill('9999')
  await page.locator('.lesson-settings button[type=submit]').click()
  await page.waitForTimeout(900)
  report.paramAfter = {
    dialogOpen: await page.locator('dialog[open]').count(),
    notice: await page.locator('.lesson-bottom').innerText().catch(() => ''),
    step: await page.locator('.lesson-step').innerText(),
    status: await page.locator('.lesson-stage-bar span').first().innerText(),
    has9999: (await page.locator('body').innerText()).includes('9999'),
    primary: await page.locator('.lesson-playbar .lesson-primary').innerText(),
  }
  await page.screenshot({ path: SHOTS + '54-B05-desktop-param-applied.png' })
  // hover affordance count
  report.hoverAffordance = await page.evaluate(() => {
    const svg = document.querySelector('svg.lesson-canvas')
    const btns = [...svg.querySelectorAll('[role="button"]')]
    return { total: btns.length, withTitle: btns.filter((b) => b.querySelector(':scope > title') || b.getAttribute('title')).length, pointer: btns.filter((b) => getComputedStyle(b).cursor === 'pointer').length }
  })
  await page.close()
}

/* --- B02 mobile canvas content + legend --- */
{
  const page = await newPage(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true })
  await goto(page, '/experiment/B02')
  await page.waitForTimeout(800)
  await page.locator('.vl-action-bar button', { hasText: 'Upsert' }).click().catch(() => {})
  await page.waitForTimeout(1800)
  report.b02MobileCanvas = await page.evaluate(canvasContent)
  report.b02MobileLegend = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.vl-stage-top > span')].find((e) => /Base File/.test(e.innerText))
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { t: el.innerText.replace(/\s+/g, ' '), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 }
  })
  await page.screenshot({ path: SHOTS + '55-B02-mobile-after-upsert.png' })
  // check 首屏 in 844: is action bar visible?
  report.b02MobileFold = await page.evaluate(() => {
    const vh = innerHeight
    return {
      actionBarTop: Math.round(document.querySelector('.vl-action-bar')?.getBoundingClientRect().top ?? -1),
      canvasTop: Math.round(document.querySelector('.vl-canvas')?.getBoundingClientRect().top ?? -1),
      canvasH: Math.round(document.querySelector('.vl-canvas')?.getBoundingClientRect().height ?? -1),
      controlsTop: Math.round(document.querySelector('.vl-controls')?.getBoundingClientRect().top ?? -1),
      vh,
    }
  })
  await page.close()
}

saveJson('raw-04-final.json', report)
console.log(JSON.stringify(report, null, 1).slice(0, 12000))
await browser.close()
