<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useVisualTimeline, type Operation } from '@/animation/useVisualTimeline'
import { buildTeachingTrace } from '@/engine/visual/teachingTrace'
import type { TeachingTrace } from '@/engine/visual/teachingTrace'
import FileGlyph from '@/components/visual/FileGlyph.vue'
import EvidencePanel from '@/components/evidence/EvidencePanel.vue'
import { useLabStore } from '@/app/stores/lab'
import { runQuery } from '@/engine/queries'
import { buildSql, createTemplateContext } from '@/engine/templates'
import type { HudiPhysicalFile, HudiRecord, HudiTableState } from '@/models/hudi'
const lab = useLabStore()
const tl = useVisualTimeline()
const { scene, sequence, position, duration, step, settled, playing, speed, reduced, caption } = tl
const amount = ref(200)
const drawer = ref('')
const engineer = ref(false)
const dialog = ref<HTMLDialogElement>()
let returnFocus: HTMLElement | null = null
watch(drawer, async value => {
  if (value) { returnFocus = document.activeElement as HTMLElement; await nextTick(); dialog.value?.showModal() }
  else { dialog.value?.close(); returnFocus?.focus() }
})
const selected = ref<{ file: HudiPhysicalFile; records: HudiRecord[] }>()
const busy = computed(() => !!sequence.value && !settled.value)
const lanes = computed(() => [{ key: 'cow' as const, title: 'COW', subtitle: 'Copy On Write', state: scene.value.cow }, { key: 'mor' as const, title: 'MOR', subtitle: 'Merge On Read', state: scene.value.mor }])
const hasLogs = computed(() => scene.value.mor.fileGroups.some(g => !g.supersededBy && g.fileSlice.logFiles.length))
const hasPlan = computed(() => scene.value.mor.compactionPlans.some(p => p.state === 'PLANNED'))
const events = computed(() => sequence.value?.events ?? [])
const evidenceIds = computed(() => [...new Set(['EV-COMM-MOR', 'EV-R26-ART-SPARK3', ...events.value.flatMap(e => e.evidenceIds)])])
const sequenceAmount=computed(()=>sequence.value?.amount??amount.value)
const teaching = computed<Partial<Record<'cow'|'mor',TeachingTrace>>>(()=>{
  if(!sequence.value)return {}
  const seq=sequence.value
  return Object.fromEntries((['cow','mor'] as const).map(side=>[side,buildTeachingTrace({before:seq.before[side],after:seq.after[side],action:seq.actions[side],operation:seq.kind==='update'?'upsert':seq.kind==='snapshot'?'snapshot':seq.kind==='failure'?'fail':seq.kind,parameters:{recordKey:'1001',amount:seq.amount,bucketCount:4,partition:'2024-01-01',retention:1,failureAt:-1,tableType:seq.before[side].table.tableType}})]))
})
function annotations(side:'cow'|'mor'){return Object.fromEntries((teaching.value[side]?.outputRecords??[]).map(r=>[r.recordKey,teaching.value[side]?.copiedKeys.includes(r.recordKey)?'复制':r.recordKey==='1001'?'更新':'保留']))}
function previewRows(side:'cow'|'mor'){return teaching.value[side]?.outputRecords??[]}
function copyProgress(n:number){return Math.max(0,Math.min(1,phaseProgress.value*1.45-n*.14))}
const phaseProgress = computed(() => position.value % 1)
function start(kind: Operation) {
  if (kind === 'update' && (!Number.isFinite(amount.value) || amount.value < 0 || amount.value > 999999)) { drawer.value = '参数设置'; return }
  tl.run(kind, amount.value)
}
function recordsFor(state: HudiTableState, file: HudiPhysicalFile): HudiRecord[] {
  // Old slice contents remain available in checkpoints even after compaction.
  for (const snapshot of [state, ...state.checkpoints.map(c => c.state).reverse()]) {
    for (const group of snapshot.fileGroups) {
      const files = [group.fileSlice.baseFile, ...group.fileSlice.logFiles]
      const match = files.find(f => f?.fileName === file.fileName)
      if (match) return match.records
    }
  }
  return []
}
function files(state: HudiTableState) {
  const all = state.physicalFiles
  // Keep all active output and the latest retired Base readable in the main canvas.
  const active = all.filter(f => f.status === 'ACTIVE')
  const old = all.filter(f => f.status === 'SUPERSEDED' && f.type === 'BASE').slice(-1)
  return [...old, ...active].slice(-4)
}
function selectFile(state: HudiTableState, file: HudiPhysicalFile) { selected.value = { file, records: recordsFor(state, file) }; drawer.value = '文件记录' }
function output(state: HudiTableState, mode: 'snapshot' | 'read-optimized') { return runQuery(state, { mode }).rows.find(r => Number(r.id) === 1001)?.amount }
const sql = computed(() => {
  const table = scene.value.mor.table
  const ctx = createTemplateContext({ qualifiedTable: `${table.databaseName}.${table.tableName}`, table: table.tableName, tablePath: table.tablePath, partitionValue: '2024-01-01' })
  return ['spark-create-table-mor', 'spark-upsert', 'spark-query-snapshot', 'spark-compaction-plan-only', 'spark-compaction-inline'].map(id => buildSql('spark-sql', id, ctx)).join('\n\n')
})
function packetX() {
  if (step.value === 0) return 90 + phaseProgress.value * 130
  if (step.value === 1) return 220 + phaseProgress.value * 160
  return 380
}
</script>
<template>
  <div class="visual-lab" :class="{ 'vl-light': !lab.darkMode, 'vl-reduced': reduced }">
    <header class="vl-nav">
      <RouterLink to="/" class="vl-brand"><span class="vl-logo">h.</span> Hudi <b>Visual Lab</b></RouterLink>
      <span class="vl-breadcrumb"><RouterLink to="/catalog">← 全部动画</RouterLink> <span>/</span> 02 · COW 与 MOR</span>
      <div class="vl-nav-actions"><RouterLink to="/catalog" class="vl-all-animations">全部动画 ↗</RouterLink><button :class="{ active: engineer }" @click="engineer = !engineer">{{ engineer ? '工程师模式' : '基础模式' }}</button><button aria-label="切换深浅主题" @click="lab.toggleTheme()">{{ lab.darkMode ? '☀' : '☾' }}</button><button @click="drawer = '参数设置'">⚙ 设置</button></div>
    </header>
    <main class="vl-main">
      <div class="vl-title-row"><div><div class="vl-eyebrow">THE WRITE PATH · 写入路径</div><h1>更新一条记录，文件会怎样变化<span>？</span></h1><p>同一份数据，两种策略。亲手写入，看见区别。</p></div><button class="vl-details" @click="drawer = '技术详情'">{{ engineer ? 'SQL / HDFS / Timeline' : '技术详情' }} ↗</button></div>
      <section class="vl-stage" aria-label="COW 与 MOR 交互动画画布">
        <div class="vl-stage-top"><span><i class="vl-dot"></i> {{ busy ? '正在演示' : '交互画布' }}</span><span>● Base File <span class="vl-log-legend">● Log File</span> <span class="vl-old-legend">● 旧版本</span></span><span>点击文件查看内部记录 ↗</span></div>
        <div class="vl-canvas-wrap">
          <svg viewBox="0 0 1120 290" class="vl-canvas" role="img" aria-label="COW 重写 Base，MOR 追加 Log 的双路径动画">
            <defs><pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".09"/></pattern><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="none" stroke="currentColor"/></marker></defs>
            <rect width="1120" height="290" fill="url(#grid)"/>
            <path d="M560 12V280" class="vl-divider"/>
            <g v-for="(lane, laneIndex) in lanes" :key="lane.key" :transform="`translate(${laneIndex * 560},0)`">
              <text x="28" y="30" class="vl-lane-title">{{ lane.title }}</text><text x="105" y="28" class="vl-svg-muted">{{ lane.subtitle }}</text>
              <rect x="408" y="9" width="124" height="28" rx="14" class="vl-strategy"/><text x="470" y="28" text-anchor="middle" class="vl-strategy-text">{{ lane.key === 'cow' ? '写入时合并' : '读取时合并' }}</text>
              <path d="M100 75H220 M320 75H475V125" class="vl-flow-path" marker-end="url(#arrow)"/>
              <rect x="28" y="53" width="128" height="44" rx="8" class="vl-input"/><text x="42" y="70" class="vl-small-label">UPDATE · 1001</text><text x="42" y="87" class="vl-svg-code">¥ {{ (sequence?.before[lane.key]??scene[lane.key]).records.find(r => r.recordKey === '1001')?.fields.amount }} → {{ sequenceAmount }}</text>
              <rect x="220" y="51" width="102" height="46" rx="10" class="vl-writer" :class="{ working: busy && step < 3 }"/><text x="271" y="72" text-anchor="middle" class="vl-writer-text">{{ sequence?.kind === 'compact' && lane.key === 'mor' ? 'Merger' : 'Writer' }}</text><text x="271" y="88" text-anchor="middle" class="vl-small-label">Hudi Engine</text>
              <text x="365" y="65" class="vl-small-label">{{ sequence?.kind === 'schedule' && lane.key === 'mor' ? 'COMPACTION PLAN' : 'INDEX → FILE GROUP' }}</text>
              <g v-if="busy && sequence?.kind === 'update' && step < 3" :transform="`translate(${packetX()},${step >= 2 ? 80 + phaseProgress * 43 : 60})`"><rect width="67" height="29" rx="6" class="vl-packet"/><text x="33" y="19" text-anchor="middle" class="vl-packet-text">1001 · {{ sequenceAmount }}</text></g>
              <rect x="20" y="115" width="520" height="135" rx="14" class="vl-group"/>
              <text x="34" y="132" class="vl-small-label">FILE GROUP · dt=2024-01-01</text>
              <g v-for="(file, fileIndex) in files(lane.state)" :key="file.fileName" :transform="`translate(${34 + fileIndex * (files(lane.state).length > 2 ? 124 : 235)},138) scale(${files(lane.state).length > 2 ? .72 : 1})`">
                <g :opacity="sequence && !sequence.before[lane.key].physicalFiles.some(f => f.fileName === file.fileName) && !settled ? Math.min(1, phaseProgress * 3) : 1" :transform="`translate(0,${sequence && !sequence.before[lane.key].physicalFiles.some(f => f.fileName === file.fileName) && !settled ? (1 - phaseProgress) * 22 : 0})`"><FileGlyph :file="file" :records="recordsFor(lane.state, file)" :x="0" :y="0" :fresh="!!sequence && !sequence.before[lane.key].physicalFiles.some(f => f.fileName === file.fileName)" :highlight="!!sequence && step >= 2" :annotations="sequence?.kind==='update' && !sequence.before[lane.key].physicalFiles.some(f=>f.fileName===file.fileName) ? annotations(lane.key) : undefined" @select="selectFile(lane.state, file)"/></g>
              </g>
              <g v-if="busy && sequence?.kind === 'compact' && lane.key === 'mor' && step > 0 && step < 4"><path d="M100 200Q250 90 420 200 M340 200Q380 140 420 200" class="vl-merge-path"/><circle :cx="100 + phaseProgress * 320" :cy="200 - Math.sin(phaseProgress * Math.PI) * 65" r="9" class="vl-packet"/><rect x="405" y="177" width="104" height="50" rx="8" class="vl-writer"/><text x="457" y="205" text-anchor="middle" class="vl-writer-text">MERGE</text></g>
              <g v-if="busy && (sequence?.kind==='update' || (sequence?.kind==='compact'&&lane.key==='mor')) && step===3" data-detail="cow-mor-row-copy">
                <FileGlyph v-if="teaching[lane.key]?.outputFile" :file="teaching[lane.key]!.outputFile!" :records="previewRows(lane.key)" :x="270" :y="138" :disabled="true" :reveal-count="Math.floor(phaseProgress*previewRows(lane.key).length*1.6)" :annotations="annotations(lane.key)" :fresh="true"/>
                <g v-for="(row,n) in previewRows(lane.key)" :key="row.recordKey" :transform="`translate(${teaching[lane.key]?.copiedKeys.includes(row.recordKey) ? 126+copyProgress(n)*235 : 271+copyProgress(n)*90},${teaching[lane.key]?.copiedKeys.includes(row.recordKey) ? 195+n*17 : 85+copyProgress(n)*(110+n*17)})`" :opacity="copyProgress(n)<1 ? 1:0"><rect x="-48" y="-11" width="96" height="21" rx="4" :fill="teaching[lane.key]?.copiedKeys.includes(row.recordKey)?'#bed8ed':'#bfe7b1'"/><text y="4" text-anchor="middle" class="vl-packet-text">{{ row.recordKey }} · {{ row.fields.amount }}</text></g>
              </g>
              <text v-if="sequence?.kind==='update' && step>=2" x="28" y="110" class="vl-teaching-note">{{ lane.key==='cow' ? '更新 1001；'+(teaching.cow?.copiedKeys.join('、')||'其余记录')+' 原样复制' : 'Base 不改写；只把 1001 的新版本写入 Log' }}</text>

              <text x="30" y="270" class="vl-query-label">SNAPSHOT <tspan class="vl-query-value">¥ {{ output(lane.state, 'snapshot') }}</tspan></text><text x="290" y="270" class="vl-query-label">READ OPTIMIZED <tspan class="vl-query-value">¥ {{ output(lane.state, 'read-optimized') }}</tspan></text>
              <path v-if="busy && sequence?.kind === 'snapshot' && step === 1" :d="`M90 230L${90 + phaseProgress * 150} ${230 + phaseProgress * 35}`" class="vl-merge-path"/>
              <text x="30" y="286" class="vl-small-label">{{ sequence?.kind==='update' ? lane.key==='cow' ? `本次写 ${teaching.cow?.outputRecords.length??0} 条到新 Base；旧文件等待 Cleaner` : `本次写 ${teaching.mor?.outputRecords.length??0} 条到 Log；读优化仍读旧 Base` : lane.key === 'cow' ? '重写受影响文件，读取直接得到最新值' : '追加更新日志，快照读取时归并最新值' }}</text>
            </g>
          </svg>
        </div>
        <div class="vl-caption" aria-live="polite"><span class="vl-step-number">{{ String(sequence ? step + 1 : 0).padStart(2, '0') }}</span><div><small>{{ sequence ? '观察正在发生的变化' : '从这里开始 · 约 1 分钟' }}</small><p>{{ caption }}</p></div><span class="vl-caption-count">{{ sequence ? `${step + 1} / ${duration}` : 'COW ↔ MOR' }}</span></div>
      </section>
      <section class="vl-controls" aria-label="动画播放控件">
        <div class="vl-playback"><button aria-label="上一步" :disabled="!sequence || position === 0" @click="tl.back">|◀</button><button class="vl-play" :aria-label="playing ? '暂停' : '播放'" @click="!sequence ? start('update') : playing ? tl.pause() : tl.play()">{{ playing ? 'Ⅱ' : '▶' }}</button><button aria-label="下一步" :disabled="!sequence || settled" @click="tl.next">▶|</button><button aria-label="重放" :disabled="!sequence" @click="tl.pause(); position = 0; tl.play()">↺</button><select v-model.number="speed" aria-label="播放速度"><option :value="0.5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option></select></div>
        <div class="vl-progress"><input v-model.number="position" type="range" min="0" :max="duration" step="0.01" aria-label="动画进度" :disabled="!sequence" @input="tl.pause()"/><button :disabled="!busy" @click="tl.skip">跳过动画</button></div>
        <button class="vl-reset" @click="tl.reset">重置实验</button>
      </section>
      <div class="vl-action-bar"><span>现在试试看</span><button class="vl-primary" :disabled="busy" @click="start('update')">↑ Upsert 更新记录</button><button :disabled="busy" @click="start('snapshot')">Snapshot 读取</button><span class="vl-action-divider"></span><button :disabled="busy || !hasLogs || hasPlan" @click="start('schedule')">① Schedule</button><button :disabled="busy || !hasPlan" @click="start('compact')">② Compaction</button><button :disabled="busy" @click="start('clean')">Cleaner</button><button v-if="engineer" :disabled="busy || !hasPlan" @click="start('failure')">模拟失败</button></div>
    </main>
    <footer class="vl-footer"><span>HUAWEI MRS 3.5.0 · r26 <span> / </span>纯浏览器模拟</span><button @click="drawer = '版本与证据'">MOR 更新路径待 r26 实测 · 查看依据 ↗</button><span>先看见，再理解。</span></footer>
    <dialog ref="dialog" class="vl-dialog" @cancel.prevent="drawer = ''" @click="e => { if (e.target === dialog) drawer = '' }">
      <div class="vl-drawer"><header><h2>{{ drawer }}</h2><button aria-label="关闭详情" @click="drawer = ''">✕</button></header>
        <template v-if="drawer === '参数设置'"><label class="vl-setting">更新后的金额 <input v-model.number="amount" type="number" min="0" max="999999" :disabled="busy"/></label><label class="vl-setting"><input v-model="reduced" type="checkbox" @change="reduced && tl.skip()"/>减少动态效果 / 直接显示结果</label><p>本实验使用 SIMPLE 索引及固定分区。MOR 初始 Base 由种子写入 → Schedule → Compaction 建立，全部通过同一模拟引擎。</p></template>
        <template v-else-if="drawer === '文件记录' && selected"><p class="vl-file-name">{{ selected.file.fileName }}</p><p>{{ selected.file.type }} · {{ selected.file.status }} · {{ selected.file.recordCount }} 条</p><table><thead><tr><th>主键</th><th>金额</th><th>precombine</th></tr></thead><tbody><tr v-for="record in selected.records" :key="record.recordKey"><td>{{ record.recordKey }}</td><td>{{ record.fields.amount }}</td><td>{{ record.preCombineValue }}</td></tr></tbody></table><p>这里展示所选物理文件自己的记录，旧版本不会被替换为最新查询结果。</p></template>
        <template v-else><nav class="vl-drawer-tabs"><button v-for="tab in ['技术详情', 'SQL', 'HDFS', 'Timeline', '源码透视', '版本与证据']" :key="tab" :class="{ active: drawer === tab }" @click="drawer = tab">{{ tab }}</button></nav>
          <template v-if="drawer === '技术详情'"><p>动画通过 applyAction 生成的事件及前后快照驱动；数据文件和 Timeline 在提交阶段同时切换为引擎结果。</p><article v-for="(event, n) in events" :key="n"><h3>{{ event.title }}</h3><p>{{ event.explanation }}</p><pre>{{ event.logs.join('\n') }}</pre><p v-for="warning in event.warnings" :key="warning">{{ warning }}</p></article><p v-if="!events.length">先执行更新，查看对应事件与运行日志。</p></template>
          <template v-if="drawer === 'SQL'"><p>以下为现有模板库生成的 Spark SQL 参考，浏览器中未执行 SQL。参数与执行方式需要在真实 r26 环境核实。</p><pre>{{ sql }}</pre></template>
          <template v-if="drawer === 'HDFS'"><section v-for="lane in lanes" :key="lane.key"><h3>{{ lane.title }} / {{ lane.state.table.tablePath }}</h3><button v-for="file in lane.state.physicalFiles" :key="file.fileName" class="vl-file-row" @click="selectFile(lane.state, file)">{{ file.type === 'BASE' ? '▤' : '≡' }} {{ file.fileName }}<small>{{ file.status }}</small></button></section></template>
          <template v-if="drawer === 'Timeline'"><section v-for="lane in lanes" :key="lane.key"><h3>{{ lane.title }}</h3><table><thead><tr><th>Instant</th><th>Action</th><th>State</th></tr></thead><tbody><tr v-for="instant in lane.state.timeline" :key="instant.instantTime"><td>{{ instant.instantTime }}</td><td>{{ instant.action }}</td><td>{{ instant.state }}</td></tr></tbody></table></section><p>只呈现引擎返回的真实模拟状态，动画处理中不会虚构已完成的 Instant。</p></template>
          <template v-if="drawer === '源码透视'"><h3>当前模拟步骤的实现位置</h3><p>本地 TypeScript 模拟实现，不代表已核实的华为 Java / Scala 源码。</p><pre>src/engine/core/applyAction.ts → applyAction\nsrc/engine/operations/writes.ts → performWrite\nsrc/engine/operations/services.ts → scheduleCompaction / runCompaction\nsrc/engine/core/state.ts → mergeRecords\nsrc/engine/queries/index.ts → runQuery</pre><p>关键参数：recordKey = 1001、precombine = ts、index = SIMPLE。r26 源码类名、方法和执行路径暂未核实，保留证据入口。</p></template>
          <template v-if="drawer === '版本与证据'"><p>沿用 HuaweiMRS350R26Profile 和现有证据库。MOR 普通写入落点为教学模型，尚未在 r26 集群实测，不能推导为所有写入场景的真实行为。</p><EvidencePanel :evidence-ids="evidenceIds"/></template>
        </template>
      </div>
    </dialog>
  </div>
</template>
<style src="../styles/visual-lab.css"></style>

<style scoped>.vl-all-animations{font-size:12px;align-self:center;text-decoration:none;margin-right:12px;color:var(--vl-muted)!important}@media(max-width:600px){.vl-all-animations{font-size:10px;margin-right:3px}.vl-nav-actions{gap:2px}}</style>

<style scoped>.vl-teaching-note{font:11px 'PingFang SC',sans-serif;fill:var(--vl-ink)}.vl-light .row-annotation{fill:#396687}</style>
