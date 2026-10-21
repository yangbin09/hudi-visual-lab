import { createRequire } from 'node:module'
const require = createRequire('D:/code/hudi演示/hudi-visual-lab/package.json')
const { chromium } = require('@playwright/test')

const browser = await chromium.launch({ channel: 'msedge' })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
console.log('title:', await page.title())
console.log('h1:', await page.locator('h1').first().innerText())
await page.screenshot({ path: 'D:/code/hudi演示/_analysis/shots/probe-home.png' })
await browser.close()
