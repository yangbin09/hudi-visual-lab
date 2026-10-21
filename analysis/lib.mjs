import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('D:/code/hudi演示/hudi-visual-lab/package.json')
export const { chromium } = require('@playwright/test')

export const BASE = 'http://127.0.0.1:5173'
export const SHOTS = 'D:/code/hudi演示/_analysis/shots/'
export const OUT = 'D:/code/hudi演示/_analysis/'

export async function launch() {
  return chromium.launch({ channel: 'msedge' })
}

export async function newPage(browser, viewport, opts = {}) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    locale: 'zh-CN',
    ...opts,
  })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console.error]', m.text().slice(0, 300))
  })
  page.on('pageerror', (e) => console.error('[pageerror]', String(e).slice(0, 300)))
  return page
}

export async function goto(page, path, wait = 'networkidle') {
  await page.goto(BASE + path, { waitUntil: wait, timeout: 90000 })
  await page.waitForTimeout(500)
}

/* ---------------- colour / contrast ---------------- */
function parseColor(c) {
  if (!c) return null
  const s = String(c).trim()
  if (s === 'transparent' || s === 'none') return { r: 0, g: 0, b: 0, a: 0 }
  let m = s.match(/^rgba?\(([^)]+)\)$/i)
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
  }
  m = s.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h.split('').map((x) => x + x).join('')
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
    }
  }
  return null
}
function blend(fg, bg) {
  const a = fg.a ?? 1
  return {
    r: Math.round(fg.r * a + bg.r * (1 - a)),
    g: Math.round(fg.g * a + bg.g * (1 - a)),
    b: Math.round(fg.b * a + bg.b * (1 - a)),
    a: 1,
  }
}
function lum(c) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
}
export function contrast(fgStr, bgStr) {
  const fg0 = parseColor(fgStr)
  const bg0 = parseColor(bgStr) || { r: 255, g: 255, b: 255, a: 1 }
  if (!fg0) return null
  const bg = bg0.a < 1 ? blend(bg0, { r: 255, g: 255, b: 255, a: 1 }) : bg0
  const fg = fg0.a < 1 ? blend(fg0, bg) : fg0
  const L1 = lum(fg)
  const L2 = lum(bg)
  const hi = Math.max(L1, L2)
  const lo = Math.min(L1, L2)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

/* ---------------- generic page measure ---------------- */
const MEASURE_SRC = `(() => {
  const out = {}
  const vw = innerWidth, vh = innerHeight
  out.viewport = { w: vw, h: vh }
  out.title = document.title
  out.doc = {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    bodyScrollWidth: document.body.scrollWidth,
    htmlOverflowX: getComputedStyle(document.documentElement).overflowX,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
  }
  function effBg(el) {
    let e = el
    const chain = []
    while (e && e.nodeType === 1) {
      const bg = getComputedStyle(e).backgroundColor
      chain.push(bg)
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg
      e = e.parentElement
    }
    const b = getComputedStyle(document.body).backgroundColor
    return b && b !== 'rgba(0, 0, 0, 0)' ? b : 'rgb(255,255,255)'
  }
  function path(el) {
    const parts = []
    let e = el
    for (let i = 0; i < 5 && e && e.nodeType === 1; i++) {
      let s = e.tagName.toLowerCase()
      if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\\s+/).slice(0, 3).join('.')
      parts.unshift(s)
      e = e.parentElement
    }
    return parts.join(' > ')
  }
  function visible(el) {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) return false
    return true
  }
  // --- text scan
  const texts = []
  const seen = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walker.nextNode())) {
    const t = n.nodeValue.replace(/\\s+/g, ' ').trim()
    if (t.length < 1) continue
    const el = n.parentElement
    if (!el || !visible(el)) continue
    if (el.closest('script,style,noscript')) continue
    const cs = getComputedStyle(el)
    const key = path(el) + '|' + cs.fontSize + '|' + cs.color + '|' + t.slice(0, 30)
    if (seen.has(key)) continue
    seen.add(key)
    const r = el.getBoundingClientRect()
    texts.push({
      t: t.slice(0, 120),
      size: parseFloat(cs.fontSize),
      lh: cs.lineHeight,
      color: cs.color,
      bg: effBg(el),
      weight: cs.fontWeight,
      path: path(el),
      top: Math.round(r.top),
      left: Math.round(r.left),
      w: Math.round(r.width),
      h: Math.round(r.height),
      inFold: r.top < vh && r.bottom > 0,
      svg: el instanceof SVGElement || !!el.closest('svg'),
    })
  }
  out.texts = texts
  out.textCount = texts.length
  const small = texts.filter((x) => x.size < 12)
  out.smallBySize = {}
  small.forEach((x) => { const k = x.size + 'px'; out.smallBySize[k] = (out.smallBySize[k] || 0) + 1 })
  out.smallSamples = {}
  small.forEach((x) => {
    const k = x.size + 'px'
    if (!out.smallSamples[k]) out.smallSamples[k] = []
    if (out.smallSamples[k].length < 6) out.smallSamples[k].push({ t: x.t, path: x.path, color: x.color, bg: x.bg })
  })
  // --- interactives
  const sel = 'a,button,input,select,textarea,[role="button"],[tabindex="0"]'
  const ints = []
  document.querySelectorAll(sel).forEach((el) => {
    if (!visible(el)) return
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    ints.push({
      tag: el.tagName.toLowerCase(),
      text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
      path: path(el),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      cursor: cs.cursor,
      inFold: r.top < vh && r.bottom > 0,
      disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true',
    })
  })
  out.interactives = ints
  out.interactiveCount = ints.length
  out.foldInteractives = ints.filter((i) => i.inFold)
  // --- overflow
  const over = []
  document.querySelectorAll('body *').forEach((el) => {
    if (!visible(el)) return
    const r = el.getBoundingClientRect()
    if (r.right > vw + 1 || r.left < -1) {
      if (el.children.length > 3) return
      over.push({ tag: el.tagName.toLowerCase(), path: path(el), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) })
    }
  })
  out.overflowEls = over.slice(0, 25)
  out.overflowCount = over.length
  // --- headings
  out.headings = [...document.querySelectorAll('h1,h2,h3,h4')].filter(visible).map((el) => ({
    tag: el.tagName.toLowerCase(), t: el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 100), size: parseFloat(getComputedStyle(el).fontSize), top: Math.round(el.getBoundingClientRect().top),
  }))
  // --- svg presence
  const svg = document.querySelector('svg.lesson-canvas') || document.querySelector('svg')
  if (svg) {
    const r = svg.getBoundingClientRect()
    out.svg = { w: Math.round(r.width), h: Math.round(r.height), vb: svg.getAttribute('viewBox'), scene: svg.dataset.scene, aria: svg.getAttribute('aria-label') }
    const svgTexts = [...svg.querySelectorAll('text')].filter(visible).map((el) => {
      const cs = getComputedStyle(el)
      const rr = el.getBoundingClientRect()
      return { t: el.textContent.trim().slice(0, 60), size: parseFloat(cs.fontSize), color: cs.color, bg: effBg(el), x: Math.round(rr.x), y: Math.round(rr.y), w: Math.round(rr.width), h: Math.round(rr.height) }
    })
    out.svgTexts = svgTexts
    out.svgTextSmall = svgTexts.filter((t) => t.size < 12).length
    out.svgGlyphButtons = [...svg.querySelectorAll('[role="button"]')].map((el) => {
      const rr = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { aria: el.getAttribute('aria-label'), w: Math.round(rr.width), h: Math.round(rr.height), cursor: cs.cursor, tabindex: el.getAttribute('tabindex'), title: el.querySelector('title') ? true : false }
    })
  }
  // --- scrollable containers that overflow horizontally
  const scrollers = []
  document.querySelectorAll('body *').forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
      const cs = getComputedStyle(el)
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || el.scrollWidth > el.clientWidth + 40) {
        scrollers.push({ path: path(el), sw: el.scrollWidth, cw: el.clientWidth, ox: cs.overflowX })
      }
    }
  })
  out.hScrollers = scrollers.slice(0, 15)
  return out
})()`

export async function measure(page) {
  return page.evaluate(MEASURE_SRC)
}

export function fold(line, max = 22) {
  return String(line ?? '').replace(/\s+/g, ' ').slice(0, max)
}

export function saveJson(name, data) {
  fs.writeFileSync(OUT + name, JSON.stringify(data, null, 2), 'utf8')
  console.log('wrote', OUT + name)
}
