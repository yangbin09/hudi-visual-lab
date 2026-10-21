const fs = require('fs');
const read = f => fs.readFileSync(f, 'utf8');
const out = {};
const lv = read('views/LessonView.vue');
const tpl = lv.slice(lv.indexOf('<template>'), lv.indexOf('</template>'));
out.lessonView = {
  totalLines: lv.split('\n').length,
  scriptLines: lv.slice(0, lv.indexOf('<template>')).split('\n').length,
  templateLines: tpl.split('\n').length,
  templateChars: tpl.length,
  longestTemplateLine: Math.max(...tpl.split('\n').map(l => l.length)),
  templateTopLevelNodes: (tpl.match(/<(div|section|nav|header|footer|main|dialog)/g) || []).length,
  drawerTabBranches: (lv.match(/drawer===/g) || []).length,
  inlineHandlers: (lv.match(/@(click|input|change|submit|cancel)=/g) || []).length,
  computedAndFunctions: (lv.match(/^(const|function|async function) /gm) || []).length,
};
const vlab = read('views/VisualLabView.vue');
out.visualLabView = { totalLines: vlab.split('\n').length, templateChars: vlab.slice(vlab.indexOf('<template>')).length, drawerTabBranches: (vlab.match(/drawer === /g) || []).length };
// font sizes and radii from css
const css = read('styles/visual-lab.css') + read('styles/lessons.css');
const fonts = [...css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?px)/g)].map(m => parseFloat(m[1]));
out.cssFontSizes = { distinct: [...new Set(fonts)].sort((a, b) => a - b), counts: fonts.reduce((a, v) => (a[v] = (a[v] || 0) + 1, a), {}) };
const radii = [...css.matchAll(/border-radius:\s*(\d+)px/g)].map(m => +m[1]);
out.cssRadii = [...new Set(radii)].sort((a, b) => a - b);
const media = [...css.matchAll(/@media\(([^)]*)\)/g)].map(m => m[1]);
out.breakpoints = media;
// hex colors in visual css
out.cssHexColors = [...new Set([...css.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(m => m[0].toLowerCase()))];
// all view/component hardcoded colors not via var
const files = [];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.(vue|ts|css)$/.test(e.name)) files.push(p) });
walk('.');
const hardHex = {};
for (const f of files) { const t = read(f); const m = [...t.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(x => x[0].toLowerCase()); if (m.length) hardHex[f.replace(/^\.\//, '')] = m.length }
out.hardHexByFile = Object.entries(hardHex).sort((a, b) => b[1] - a[1]).slice(0, 14);
// duplicate class definitions across css files
const defs = [...css.matchAll(/\.([a-z][\w-]+)\{/g)].map(m => m[1]);
const dup = defs.filter((v, i) => defs.indexOf(v) !== i);
out.duplicateCssSelectors = [...new Set(dup)].slice(0, 20);
out.cssSelectorCount = defs.length;
console.log(JSON.stringify(out, null, 1));
