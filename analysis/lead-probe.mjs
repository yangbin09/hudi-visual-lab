import { chromium } from '@playwright/test';
const base = 'http://127.0.0.1:5173/';
const out = 'D:/code/hudi演示/_analysis/shots/';
const browser = await chromium.launch({ channel: 'msedge' });

async function shot(path, name, viewport, action) {
  const page = await browser.newPage({ viewport });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(new URL(path, base).href, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1200);
  if (action) { try { await action(page); } catch (e) { errs.push('action:' + e.message); } }
  await page.screenshot({ path: out + name + '.png' });
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    scrollH: document.documentElement.scrollHeight,
    fonts: [...document.querySelectorAll('p,h1,h2,h3,small,button,a,span')].slice(0, 0),
  }));
  // smallest fonts
  const small = await page.evaluate(() => {
    const seen = {};
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      const fs = parseFloat(cs.fontSize);
      if (!el.textContent || !el.textContent.trim() || el.children.length) return;
      if (fs <= 11) {
        const k = fs + 'px';
        seen[k] = seen[k] || [];
        if (seen[k].length < 3) seen[k].push((el.tagName + '.' + (el.className || '')).slice(0, 60) + ' :: ' + el.textContent.trim().slice(0, 30));
      }
    });
    return seen;
  });
  const tap = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('button,a[href],input,select').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.width < 44 || r.height < 44)) bad.push({ t: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) });
    });
    return { total: document.querySelectorAll('button,a[href]').length, small: bad.length, sample: bad.slice(0, 12) };
  });
  await page.close();
  return { name, ...m, small, tap, errs };
}

const results = [];
results.push(await shot('/experiment/B05', 'mine-B05-desktop', { width: 1440, height: 900 }, async p => {
  const g = p.locator('.lesson-canvas-area svg g').first();
  await g.click({ force: true, timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(700);
  await p.screenshot({ path: out + 'mine-B05-inspector.png' });
}));
results.push(await shot('/experiment/B05', 'mine-B05-mobile', { width: 390, height: 844 }));
results.push(await shot('/progress', 'mine-progress', { width: 1440, height: 900 }));
results.push(await shot('/evidence', 'mine-evidence', { width: 1440, height: 900 }));
results.push(await shot('/catalog', 'mine-catalog-mobile', { width: 390, height: 844 }));
results.push(await shot('/experiment/W05', 'mine-W05', { width: 1440, height: 900 }, async p => {
  await p.getByRole('button', { name: /开始演示|开始探索/ }).click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(2500);
}));

console.log(JSON.stringify(results, null, 2));
await browser.close();
