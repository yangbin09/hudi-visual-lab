import fs from 'node:fs'
const j = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
for (const [id, r] of Object.entries(j)) {
  console.log('\n========== ' + id + ' (' + r.kind + ', ' + r.model + ') ' + r.note)
  if (r.error) console.log('  ERROR', r.error.slice(0, 200))
  console.log('  title:', r.title, '| h1:', r.h1)
  if (r.initial) {
    console.log('  doc:', JSON.stringify(r.initial.doc))
    console.log('  stage:', JSON.stringify(r.initial.stage))
    console.log('  svgBox:', JSON.stringify(r.initial.svg), 'scale:', JSON.stringify(r.initial.svgScale))
    console.log('  svgTextCount:', r.initial.svgTextCount, 'small(<12user):', r.initial.svgTextSmall)
    console.log('  glyphBtns:', JSON.stringify(r.initial.glyphButtons))
    console.log('  svgRole:', JSON.stringify(r.initial.svgRole))
    console.log('  legend:', JSON.stringify(r.initial.legendCandidates))
    console.log('  playbar:', JSON.stringify(r.initial.playbar))
    console.log('  chapters:', JSON.stringify(r.initial.chapters))
    console.log('  bottom:', JSON.stringify(r.initial.bottomText))
    console.log('  nav:', JSON.stringify(r.initial.navButtons))
    console.log('  smallBySize:', JSON.stringify(r.initial.smallBySize), 'visibleText:', r.initial.visibleTextCount)
  }
  if (r.afterPlay) console.log('  afterPlay:', JSON.stringify({ stageBar: r.afterPlay.stageBar, primary: r.afterPlay.primaryLabel, explain: r.afterPlay.explainText, scale: r.afterPlay.svgScale, small: r.afterPlay.svgTextSmall, glyphs: r.afterPlay.glyphButtons, moved: r.afterPlay.movedEls }))
  if (r.feedback) console.log('  feedback:', JSON.stringify(r.feedback))
  if (r.finish) console.log('  finish:', JSON.stringify(r.finish))
  if (r.glyphHover) console.log('  glyphHover:', JSON.stringify(r.glyphHover), '-> dialog:', JSON.stringify(r.glyphClickDialog))
  if (r.engineerDiff) console.log('  engineerDiff:', JSON.stringify(r.engineerDiff))
  if (r.drawer) {
    console.log('  drawerTabs:', JSON.stringify(r.drawer.tabs))
    for (const [k, v] of Object.entries(r.drawer.tabData)) console.log('    tab[' + k + ']:', v ? `h=${v.h} scrollH=${v.scrollH} text=${v.text.length}` : null, '|', (v?.text || '').slice(0, 120))
  }
  if (r.paramPanel) console.log('  paramPanel:', JSON.stringify(r.paramPanel))
}
