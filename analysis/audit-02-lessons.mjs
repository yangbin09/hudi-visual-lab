import { launch, newPage, goto, measure, saveJson, SHOTS } from './lib.mjs'

const browser = await launch()
const report = {}
const pages = [
  { id: 'B02', kind: 'compare', model: '双路径对比(专用页)', note: 'COW/MOR' },
  { id: 'B05', kind: 'files', model: 'engine', note: 'File Group/FileID/FileSlice' },
  { id: 'W02', kind: 'files', model: 'engine', note: 'Upsert' },
  { id: 'I03', kind: 'index', model: 'engine', note: 'Bucket 索引' },
  { id: 'Q02', kind: 'query', model: 'engine', note: '查询' },
  { id: 'S04', kind: 'files', model: 'engine', note: 'Compaction' },
  { id: 'S01', kind: 'timeline', model: 'engine', note: 'Timeline' },
  { id: 'E01', kind: 'flow', model: 'concept', note: '故障/索引配置' },
  { id: 'B06', kind: 'index', model: 'engine', note: 'HoodieKey' },
  { id: 'T01', kind: 'schema', model: 'engine', note: '建表' },
  { id: 'A05', kind: 'metrics', model: 'engine', note: 'Compaction 指标' },
  { id: 'W09', kind: 'flow', model: 'mixed', note: 'SQL/DataFrame 双入口' },
]

const collectTexts = async (page) =>
  page.evaluate(() => {
    const arr = []
    const seen = new Set()
    document.querySelectorAll('body *').forEach((el) => {
      if (el.children.length > 1) return
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim()
      if (!t || t.length < 2) return
      const r = el.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') return
      const k = t + '|' + cs.fontSize + '|' + Math.round(r.x) + ',' + Math.round(r.y)
      if (seen.has(k)) return
      seen.add(k)
      arr.push({ t: t.slice(0, 160), size: parseFloat(cs.fontSize) })
    })
    return arr
  })

const drawerText = async (page) =>
  page.evaluate(() => {
    const d = document.querySelector('dialog[open] .vl-drawer')
    return d ? { text: d.innerText.replace(/\s+/g, ' ').slice(0, 4000), scrollH: d.scrollHeight, clientH: d.clientHeight, w: Math.round(d.getBoundingClientRect().width), h: Math.round(d.getBoundingClientRect().height) } : null
  })

function svgScale(m) {
  if (!m.svg) return null
  const [vw, vh] = (m.svg.vb || '0 0 1080 425').split(' ').slice(2).map(Number)
  const s = Math.min(m.svg.w / vw, m.svg.h / vh)
  return { scale: Math.round(s * 1000) / 1000, vbW: vw, vbH: vh, boxW: m.svg.w, boxH: m.svg.h, aspectBox: +(m.svg.w / m.svg.h).toFixed(2), aspectVB: +(vw / vh).toFixed(2) }
}

for (const p of pages) {
  const id = p.id
  const page = await newPage(browser, { width: 1440, height: 900 })
  const rec = { id, kind: p.kind, model: p.model, note: p.note }
  try {
    await goto(page, `/experiment/${id}`)
    await page.waitForTimeout(700)
    rec.url = page.url()
    rec.title = await page.title()
    rec.h1 = await page.locator('h1').first().innerText().catch(() => '')
    const m0 = await measure(page)
    rec.initial = {
      doc: m0.doc,
      stage: await page.evaluate(() => {
        const el = document.querySelector('.lesson-stage')
        const cv = document.querySelector('.lesson-canvas-area')
        const ex = document.querySelector('.lesson-explanation')
        const bar = document.querySelector('.lesson-stage-bar')
        const r = el?.getBoundingClientRect()
        const rc = cv?.getBoundingClientRect()
        const re = ex?.getBoundingClientRect()
        const rb = bar?.getBoundingClientRect()
        return {
          stage: r && { w: Math.round(r.width), h: Math.round(r.height) },
          canvasArea: rc && { w: Math.round(rc.width), h: Math.round(rc.height) },
          explanation: re && { w: Math.round(re.width), h: Math.round(re.height) },
          bar: rb && { w: Math.round(rb.width), h: Math.round(rb.height) },
          stageBarText: bar?.innerText.replace(/\s+/g, ' ').trim(),
          explainText: ex?.innerText.replace(/\s+/g, ' ').trim(),
        }
      }),
      svg: m0.svg,
      svgScale: svgScale(m0),
      svgTextCount: m0.svgTexts?.length ?? 0,
      svgTextSmall: m0.svgTextSmall ?? 0,
      svgTextSamples: (m0.svgTexts || []).slice(0, 30),
      glyphButtons: m0.svgGlyphButtons,
      svgRole: await page.evaluate(() => {
        const svg = document.querySelector('svg.lesson-canvas')
        if (!svg) return null
        const btns = [...svg.querySelectorAll('[role="button"]')]
        return {
          rootRole: svg.getAttribute('role'),
          rootAria: svg.getAttribute('aria-label'),
          nestedButtons: btns.length,
          nestedInsideImg: btns.filter((b) => !!b.closest('[role="img"]')).length,
          hasTitleChild: btns.filter((b) => b.querySelector(':scope > title')).length,
        }
      }),
      legendCandidates: await page.evaluate(() => {
        const txt = document.body.innerText
        return {
          hasLegendWord: /图例|legend/i.test(txt),
          legendLikeEls: [...document.querySelectorAll('[class*=legend],[class*=Legend]')].map((e) => e.className).slice(0, 5),
          baseLogExplanation: (txt.match(/[^。\n]{0,40}(Log 文件|Log File|日志文件)[^。\n]{0,40}/g) || []).slice(0, 6),
        }
      }),
      playbar: await page.evaluate(() => {
        const pb = document.querySelector('.lesson-playbar')
        if (!pb) return null
        return [...pb.querySelectorAll('button,input,select')].map((el) => {
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          return { tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height), size: cs.fontSize, value: el.value }
        })
      }),
      chapters: await page.evaluate(() => [...document.querySelectorAll('.lesson-chapters button')].map((b) => ({ t: b.innerText.replace(/\s+/g, ' ').trim(), w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height) }))),
      bottomText: (await page.locator('.lesson-bottom').innerText().catch(() => '')).replace(/\s+/g, ' '),
      navButtons: await page.evaluate(() => [...document.querySelectorAll('.vl-nav-actions button, .vl-nav-actions a')].map((b) => b.textContent.trim())),
      smallBySize: m0.smallBySize,
      visibleTextCount: m0.textCount,
      allText: (await collectTexts(page)).length,
    }
    await page.screenshot({ path: SHOTS + `20-${id}-desktop-start.png` })

    // ---- play ----
    const playBtn = page.locator('.lesson-playbar .lesson-primary')
    await playBtn.click()
    await page.waitForTimeout(1800)
    const mPlay = await measure(page)
    rec.afterPlay = {
      stageBar: await page.locator('.lesson-stage-bar span').first().innerText(),
      primaryLabel: await page.locator('.lesson-playbar .lesson-primary').innerText(),
      explainText: (await page.locator('.lesson-explanation').innerText()).replace(/\s+/g, ' '),
      svgScale: svgScale(mPlay),
      svgTexts: (mPlay.svgTexts || []).slice(0, 40),
      svgTextSmall: mPlay.svgTextSmall,
      glyphButtons: mPlay.svgGlyphButtons,
      movedEls: await page.evaluate(() => {
        // rough count of svg elements with animation/opacity changes
        const svg = document.querySelector('svg.lesson-canvas')
        return svg ? { circles: svg.querySelectorAll('circle').length, paths: svg.querySelectorAll('path').length, rects: svg.querySelectorAll('rect').length, texts: svg.querySelectorAll('text').length } : null
      }),
      statuses: await page.evaluate(() => [...document.querySelectorAll('.lesson-playbar button,input,select')].map((el) => ({ text: (el.getAttribute('aria-label') || '').slice(0, 20), disabled: el.disabled === true, value: el.value }))),
    }
    await page.screenshot({ path: SHOTS + `21-${id}-desktop-playing.png` })

    // ---- pause / seek / reset feedback ----
    const fb = {}
    await page.locator('.lesson-playbar .lesson-primary').click()
    await page.waitForTimeout(200)
    fb.afterPause = { status: await page.locator('.lesson-stage-bar span').first().innerText(), primary: await page.locator('.lesson-playbar .lesson-primary').innerText(), explain: (await page.locator('.lesson-explanation p').innerText()).slice(0, 120) }
    const range = page.locator('.lesson-playbar input[type=range]')
    await range.evaluate((el) => { el.value = String(Number(el.max) * 0.5); el.dispatchEvent(new Event('input', { bubbles: true })) })
    await page.waitForTimeout(400)
    fb.afterSeek = { status: await page.locator('.lesson-stage-bar span').first().innerText(), stepNum: await page.locator('.lesson-step').innerText(), explain: (await page.locator('.lesson-explanation p').innerText()).slice(0, 160), rangeValue: await range.inputValue() }
    await page.screenshot({ path: SHOTS + `22-${id}-desktop-seek50.png` })
    // click next
    await page.locator('.lesson-playbar button[aria-label="下一步"]').click().catch(() => {})
    await page.waitForTimeout(300)
    fb.afterNext = { stepNum: await page.locator('.lesson-step').innerText(), explain: (await page.locator('.lesson-explanation p').innerText()).slice(0, 120) }
    // reset
    const resetBtn = page.locator('.lesson-playbar button', { hasText: '重置' })
    await resetBtn.click()
    await page.waitForTimeout(400)
    fb.afterReset = { status: await page.locator('.lesson-stage-bar span').first().innerText(), primary: await page.locator('.lesson-playbar .lesson-primary').innerText(), stepNum: await page.locator('.lesson-step').innerText(), bottom: (await page.locator('.lesson-bottom').innerText()).replace(/\s+/g, ' ').slice(0, 160), explain: (await page.locator('.lesson-explanation p').innerText()).slice(0, 160) }
    rec.feedback = fb

    // ---- finish + click a glyph ----
    await page.locator('.lesson-playbar button', { hasText: '跳到结果' }).click().catch(() => {})
    await page.waitForTimeout(600)
    rec.finish = { status: await page.locator('.lesson-stage-bar span').first().innerText(), executeDisabled: await page.locator('.lesson-playbar button', { hasText: '跳到结果' }).isDisabled().catch(() => null) }
    const glyph = page.locator('svg.lesson-canvas [role="button"]').first()
    if (await glyph.count()) {
      const hov = await glyph.evaluate((el) => ({ cursor: getComputedStyle(el).cursor, titleAttr: el.getAttribute('title'), aria: el.getAttribute('aria-label'), hasTitle: !!el.querySelector(':scope > title') }))
      await glyph.hover()
      await page.waitForTimeout(250)
      rec.glyphHover = hov
      await glyph.click()
      await page.waitForTimeout(500)
      const dlg = await page.evaluate(() => {
        const d = document.querySelector('dialog[open]')
        if (!d) return null
        const dr = d.querySelector('.vl-drawer')
        const h2 = dr?.querySelector('h2')?.textContent?.trim()
        return { title: h2, text: dr?.innerText.replace(/\s+/g, ' ').slice(0, 1200), w: Math.round(dr.getBoundingClientRect().width), h: Math.round(dr.getBoundingClientRect().height), scrollH: dr.scrollHeight, clientH: dr.clientHeight }
      })
      rec.glyphClickDialog = dlg
      await page.screenshot({ path: SHOTS + `23-${id}-desktop-inspect.png` })
      await page.locator('dialog[open] button[aria-label="关闭详情"]').click().catch(() => {})
      await page.waitForTimeout(300)
    } else {
      rec.glyphHover = null
      rec.glyphClickDialog = null
    }

    // ---- engineer mode diff ----
    const beforeTexts = await collectTexts(page)
    await page.locator('.vl-nav-actions button', { hasText: '基础模式' }).click()
    await page.waitForTimeout(500)
    const afterTexts = await collectTexts(page)
    const bset = new Set(beforeTexts.map((x) => x.t))
    const aset = new Set(afterTexts.map((x) => x.t))
    rec.engineerDiff = {
      beforeCount: beforeTexts.length,
      afterCount: afterTexts.length,
      added: afterTexts.filter((x) => !bset.has(x.t)).map((x) => x.t).slice(0, 20),
      removed: beforeTexts.filter((x) => !aset.has(x.t)).map((x) => x.t).slice(0, 20),
      visibleTextDiffCount: afterTexts.filter((x) => !bset.has(x.t)).length + beforeTexts.filter((x) => !aset.has(x.t)).length,
      navButtonLabel: await page.locator('.vl-nav-actions button').first().innerText(),
      stageBarBtn: await page.locator('.lesson-stage-bar button').first().innerText(),
    }
    await page.screenshot({ path: SHOTS + `24-${id}-desktop-engineer.png` })

    // ---- drawer: 技术详情 ----
    await page.locator('.lesson-stage-bar button').first().click()
    await page.waitForTimeout(600)
    const tabs = await page.locator('.vl-drawer-tabs button').allInnerTexts()
    const tabData = {}
    for (const tab of tabs.slice(0, 5)) {
      await page.locator('.vl-drawer-tabs button', { hasText: tab }).first().click()
      await page.waitForTimeout(250)
      tabData[tab] = await drawerText(page)
    }
    rec.drawer = { tabs, tabData, screenshot: `25-${id}-desktop-drawer.png` }
    if (id === 'B05') { await page.locator('.vl-drawer-tabs button', { hasText: '技术详情' }).first().click(); await page.waitForTimeout(200) }
    await page.screenshot({ path: SHOTS + `25-${id}-desktop-drawer.png` })
    await page.locator('dialog[open] button[aria-label="关闭详情"]').click().catch(() => {})
    await page.waitForTimeout(300)

    // ---- param panel ----
    await page.locator('.vl-nav-actions button', { hasText: '参数' }).click()
    await page.waitForTimeout(400)
    rec.paramPanel = await page.evaluate(() => {
      const form = document.querySelector('dialog[open] .lesson-settings')
      if (!form) return null
      return {
        fields: [...form.querySelectorAll('label')].map((l) => ({ label: l.childNodes[0]?.textContent?.trim().slice(0, 30), type: l.querySelector('input,select')?.type || l.querySelector('select') ? 'select' : 'text' })),
        html: form.innerHTML.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|').slice(0, 500),
        dialogW: Math.round(document.querySelector('dialog[open] .vl-drawer').getBoundingClientRect().width),
      }
    })
    await page.screenshot({ path: SHOTS + `26-${id}-desktop-params.png` })
    await page.locator('dialog[open] button[aria-label="关闭详情"]').click().catch(() => {})
    await page.waitForTimeout(200)
    rec.misc = { textCount: await page.evaluate(() => document.body.innerText.length), bodyText: (await page.locator('body').innerText()).slice(0, 600) }
  } catch (e) {
    rec.error = String(e).slice(0, 400)
  }
  report[id] = rec
  await page.close()
  console.log('done', id, rec.error ? 'ERR ' + rec.error : '')
}

saveJson('raw-02-lessons-desktop.json', report)
await browser.close()
