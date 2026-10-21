<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { CATALOG, getCatalogEntry, MODULES } from '@/experiments/catalog'
import { visualLesson, MODEL_LABEL } from '@/experiments/visual/lessons'
import { buildLessonRun, defaultParameters, stateMetrics, fileRecords } from '@/engine/visual/scenarios'
import { useLessonPlayer } from '@/animation/useLessonPlayer'
import { useLabStore } from '@/app/stores/lab'
import TeachingInspector from '@/components/visual/TeachingInspector.vue'
import LessonCanvas from '@/components/visual/LessonCanvas.vue'
import IndexConfigWalkthrough from '@/components/visual/IndexConfigWalkthrough.vue'
import EvidencePanel from '@/components/evidence/EvidencePanel.vue'
import { buildSql, createTemplateContext, findTemplate } from '@/engine/templates'
import type { LessonParameters } from '@/experiments/visual/types'
const route = useRoute(), lab = useLabStore()
const id = String(route.params.id)
const entry = getCatalogEntry(id)
const lesson = visualLesson(id)
// Unknown routes are rendered explicitly; no unrelated fallback experiment is presented.
const run = shallowRef(lesson ? buildLessonRun(lesson, defaultParameters(lesson)) : undefined)
const player = run.value ? useLessonPlayer(() => run.value!) : undefined
const params = ref<LessonParameters | undefined>(run.value?.parameters)
const draft = ref<LessonParameters | undefined>(params.value ? { ...params.value } : undefined)
const engineer = ref(false), notice = ref(''), drawer = ref(''), inspection = ref<{ title: string; value: unknown }>()
const dialog = ref<HTMLDialogElement>()
let focusBefore: HTMLElement | null = null
const errorMessage = ref('')
const jobIndex=ref<'SIMPLE'|'BUCKET'>('SIMPLE')
function changeJobIndex(index:'SIMPLE'|'BUCKET') {
  notice.value=''
  jobIndex.value=index
  player?.reset()
  player?.play()
}
const configCaption=computed(()=> {
  if(current.value===3 && player && player.fraction.value<.86) {
    if(player.fraction.value<.36)return `输入相同的主键 ${params.value?.recordKey}；先看当前作业采用哪种定位策略。`
    if(player.fraction.value<.6)return jobIndex.value==='BUCKET'?'当前采用 BUCKET：主键进入哈希计算，而不是匹配已有键的位置。':'当前采用 SIMPLE：主键进入已有键与文件位置的匹配过程。'
    return jobIndex.value==='BUCKET'?'教学算法对哈希值取模，余数就是桶号；点击公式可逐字符查看计算。':'在示意的已有键列表中匹配相同 key，得到文件 B 的位置；这里不计算桶号。'
  }
  return [
  '表定义是 BUCKET：预期按主键计算桶，再定位该桶的 File Group。',
  `本案例假设作业采用手动选择的 ${jobIndex.value}；沿来源检查，不能仅凭报错文字判断表索引。`,
  jobIndex.value==='BUCKET'?'两份配置都是 BUCKET，已排除这个案例里的类型差异。':'表定义 BUCKET，作业选项 SIMPLE：定位策略不一致，这是需要验证的线索。',
  jobIndex.value==='BUCKET'?'配置已对齐；观察主键计算桶号的路径。真实作业是否恢复，仍要重跑验证。':'SIMPLE 按键匹配位置，BUCKET 计算桶号。点击“对齐为 BUCKET 并重演”，观察策略如何改变。',
][current.value]
})
const current = computed(() => player?.current.value ?? 0)
const frame = computed(() => player?.frame.value)
const state = computed(() => player?.state.value)
const stats = computed(() => state.value ? stateMetrics(state.value) : undefined)
const visibleQuery = computed(() => {
  if (!run.value || !player) return undefined
  const available = run.value.frames.slice(0, current.value + (player.committed.value ? 1 : 0))
  return available.filter(f=>f.query).at(-1)?.query
})
const visibleQueryTrace = computed(()=>{
  if(!run.value || !player)return undefined
  if(frame.value?.teaching?.kind==='query')return frame.value.teaching
  return run.value.frames.slice(0,current.value+(player.committed.value?1:0)).filter(f=>f.teaching?.kind==='query').at(-1)?.teaching
})
const teachingMoment = computed(()=>{
  if(!player?.started.value)return undefined
  const moments=player.moments.value
  return moments?.filter(m=>m.at<=player.fraction.value).at(-1)??moments?.[0]
})
const moduleName = MODULES.find(m => m.id === entry?.moduleId)?.shortTitle ?? '实验'
const listIndex = CATALOG.findIndex(e => e.id === id)
const previousLesson = CATALOG[listIndex-1], nextLesson = CATALOG[listIndex+1]
const stepCaption = computed(() => !player?.started.value ? `点击“${lesson?.actionLabel}”，先观察${lesson?.steps[0]?.title}。` : id==='E01' ? configCaption.value : frame.value?.error ? `本次被引擎拒绝：${frame.value.error}` : teachingMoment.value?.explanation ?? frame.value?.step.caption)
const evidenceIds = computed(() => [...new Set([...(entry?.evidenceIds ?? []), ...(frame.value?.events.flatMap(e=>e.evidenceIds) ?? [])])])
const templates = computed(() => {
  if (!lesson || !state.value || !params.value) return []
  const ids: string[] = lesson.kind === 'query' ? ['spark-query-snapshot','spark-query-read-optimized','spark-query-incremental','spark-query-time-travel'] : lesson.kind === 'index' ? ['spark-create-table-cow','spark-upsert'] : lesson.kind === 'files' || lesson.kind === 'metrics' || lesson.kind === 'timeline' ? ['spark-upsert','spark-delete','spark-compaction-plan-only','spark-compaction-inline','spark-clean'] : ['spark-create-table-cow','spark-create-table-mor','flink-create-table']
  const t = state.value.table
  const ctx = createTemplateContext({ database:t.databaseName, table:t.tableName, qualifiedTable:`${t.databaseName}.${t.tableName}`, tablePath:t.tablePath, tableType:t.tableType === 'COPY_ON_WRITE' ? 'cow' : 'mor', primaryKey:t.primaryKey ?? '', preCombineField:t.preCombineField ?? '', partitionFields:t.partitionFields.join(','), partitionKey:t.partitionFields[0] ?? '', partitionValue:params.value.partition, recordKey:params.value.recordKey, indexType:t.indexType, beginInstantTime:run.value?.initial.timeline[0]?.instantTime ?? '', asOfInstant:run.value?.initial.checkpoints[0]?.instantTime ?? '' })
  return ids.map(templateId => { const template = findTemplate(templateId); return template ? { ...template, code:buildSql(template.language, templateId,ctx) } : undefined }).filter(Boolean)
})
async function open(name: string) {
  player?.pause()
  if (!drawer.value) focusBefore = document.activeElement as HTMLElement
  drawer.value = name
  if (name === '参数') { draft.value = params.value ? { ...params.value } : undefined; errorMessage.value = '' }
  await nextTick(); if (!dialog.value?.open) dialog.value?.showModal()
}
function close() { drawer.value = ''; dialog.value?.close(); focusBefore?.focus() }
function inspect(title: string, value: unknown) { inspection.value = {title,value}; void open('查看对象') }
function applyParameters() {
  if (!draft.value || !lesson || !player) return
  const p = draft.value
  if (!p.recordKey.trim() || p.recordKey.length > 40 || !p.partition.trim() || p.partition.length > 80 || !Number.isFinite(p.amount) || p.amount < 0 || !Number.isInteger(p.bucketCount) || p.bucketCount < 1 || p.bucketCount > 12 || !Number.isInteger(p.retention) || p.retention < 1 || p.retention > 10) { errorMessage.value = '请输入有效参数：主键不能为空，金额不能为负，桶数 1–12，保留数 1–10。'; return }
  try {
    const updated = buildLessonRun(lesson, { ...p, recordKey:p.recordKey.trim(), partition:p.partition.trim() })
    player.reset(); run.value = updated; params.value = updated.parameters
    notice.value = '参数已应用，已重置到新的初始状态。'
    close()
  } catch (e) { errorMessage.value = `无法建立该场景：${e instanceof Error ? e.message : String(e)}` }
}
function toggle() { notice.value = ''; if (player?.playing.value) player.pause(); else player?.play() }
function keyboard(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (drawer.value || target.closest('button,a,input,select,textarea,[role="button"]')) return
  if (e.code === 'Space') { e.preventDefault(); toggle() }
  if (e.code === 'ArrowRight') { e.preventDefault(); player?.next() }
  if (e.code === 'ArrowLeft') { e.preventDefault(); player?.back() }
}
onMounted(() => window.addEventListener('keydown',keyboard))
onBeforeUnmount(() => window.removeEventListener('keydown',keyboard))
</script>
<template>
  <div class="visual-lab lesson-page" :class="{ 'vl-light': !lab.darkMode, 'vl-reduced': player?.reduced.value }">
    <header class="vl-nav"><RouterLink to="/" class="vl-brand"><span class="vl-logo">h.</span> Hudi <b>Visual Lab</b></RouterLink><RouterLink class="lesson-nav-link" to="/catalog">← 全部动画</RouterLink><span class="vl-breadcrumb">{{ moduleName }} / {{ id }}</span><div class="vl-nav-actions"><button @click="engineer = !engineer">{{ engineer ? '工程师模式' : '基础模式' }}</button><button aria-label="切换深浅主题" @click="lab.toggleTheme()">{{ lab.darkMode ? '☀' : '☾' }}</button><button v-if="lesson" @click="open('参数')">⚙ 参数</button></div></header>
    <main v-if="lesson && player && frame && state && params && stats" class="lesson-main">
      <div class="lesson-heading"><div><span class="vl-eyebrow">{{ id }} · {{ moduleName }}</span><h1>{{ entry?.title }}</h1></div><button class="lesson-model" @click="open('技术详情')">{{ MODEL_LABEL[lesson.model] }} ↗</button></div>
      <section class="lesson-stage" aria-label="交互动画画布">
        <div class="lesson-stage-bar"><span><i class="vl-dot"></i>{{ player.playing.value ? '正在演示' : player.done.value ? '演示完成' : player.started.value ? '已暂停 · 可单步操作' : '准备就绪' }}</span><span>{{ id==='E01' ? '修改作业选项，重演并比较两种策略' : lesson.kind === 'flow' || lesson.model === 'concept' ? '点击组件查看解释' : '点击图形查看数据' }}</span><button @click="open('技术详情')">{{ engineer ? 'SQL / HDFS / Timeline' : '技术详情' }} ↗</button></div>
        <div class="lesson-canvas-area"><IndexConfigWalkthrough v-if="id==='E01'" :job-index="jobIndex" :current="current" :progress="player.fraction.value" :started="player.started.value" :parameters="params" @change="changeJobIndex" @inspect="inspect"/><LessonCanvas v-else :lesson="lesson" :frame="frame" :state="state" :query="visibleQuery" :query-trace="visibleQueryTrace" :progress="player.fraction.value" :current="current" :started="player.started.value" :parameters="params" @inspect="inspect"/></div>
        <div class="lesson-explanation" aria-live="polite"><span class="lesson-step">{{ String(current+1).padStart(2,'0') }}</span><div><small>{{ player.started.value ? teachingMoment?.title ?? frame.step.title : '先看见变化，再展开原理' }}</small><p>{{ stepCaption }}</p></div><span>{{ current+1 }} / {{ player.total.value }}<small v-if="player.moments.value.length"> · {{ (player.moments.value.findIndex(m=>m===teachingMoment)+1)||1 }} / {{ player.moments.value.length }} 细节</small></span></div>
      </section>
      <div class="lesson-playbar" aria-label="动画播放控件"><button class="lesson-primary" :aria-label="player.playing.value ? '暂停演示' : '播放演示'" @click="toggle">{{ player.playing.value ? 'Ⅱ 暂停' : !player.started.value ? '▶ '+lesson.actionLabel : player.done.value ? '↺ 重放演示' : '▶ 继续播放' }}</button><button aria-label="上一步" :disabled="player.position.value===0" @click="player.back">|◀</button><button aria-label="下一步" :disabled="player.done.value" @click="player.next">▶|</button><input type="range" min="0" :max="player.total.value" :value="player.position.value" step=".01" aria-label="动画进度" @input="player.seek(Number(($event.target as HTMLInputElement).value))"/><select v-model.number="player.speed.value" aria-label="播放速度"><option :value=".5">0.5×</option><option :value="1">1×</option><option :value="2">2×</option></select><button @click="player.reset(); notice=''">重置</button><button :disabled="player.done.value" @click="player.finish">跳到结果</button></div>
      <nav class="lesson-chapters" aria-label="动画步骤"><button v-for="(item,i) in lesson.steps" :key="i" :class="{ active: current===i && player.started.value }" :aria-current="current===i ? 'step' : undefined" @click="player.seek(i===lesson.steps.length-1 ? player.total.value : i+.99)"><span>{{ i+1 }}</span>{{ item.title }}</button></nav>
      <div class="lesson-bottom"><span v-if="notice" role="status">{{ notice }}</span><span v-else>{{ lesson.model === 'concept' ? '机制示意 · 图形节点不代表真实服务的执行状态' : `可见记录 ${stats.records} · 有效文件 ${stats.active} · Log ${stats.logs}` }}</span><div><RouterLink v-if="previousLesson" :to="`/experiment/${previousLesson.id}`">← 上一主题</RouterLink><RouterLink v-if="nextLesson" :to="`/experiment/${nextLesson.id}`">下一主题 →</RouterLink></div></div>
    </main>
    <main v-else class="lesson-not-found"><h1>没有找到这个动画实验</h1><RouterLink to="/catalog">返回全部动画</RouterLink></main>
    <footer class="vl-footer"><span>HUAWEI MRS r26 · 纯浏览器模拟</span><button @click="open('证据')">{{ entry?.supportState === 'unverified' || entry?.evidenceLevel === 'E0' ? '待验证 · 查看依据 ↗' : '教学模型 · r26 行为边界 ↗' }}</button><span>空格播放 / 暂停 · ← → 单步</span></footer>
    <dialog ref="dialog" class="vl-dialog lesson-dialog" @cancel.prevent="close" @click="e=>{if(e.target===dialog)close()}"><div class="vl-drawer"><header><h2>{{ drawer === '查看对象' ? inspection?.title : drawer }}</h2><button aria-label="关闭详情" @click="close">✕</button></header>
      <form v-if="drawer==='参数' && draft && lesson" class="lesson-settings" @submit.prevent="applyParameters"><p>应用后重新建立场景并重置演示，不会在播放中途替换数据。</p><template v-for="control in lesson.controls" :key="control"><label v-if="control==='recordKey'">记录主键<input v-model="draft.recordKey" maxlength="40" required/></label><label v-else-if="control==='amount'">更新金额<input v-model.number="draft.amount" type="number" min="0" max="999999" required/></label><label v-else-if="control==='bucketCount'">Bucket 数量<input v-model.number="draft.bucketCount" type="number" min="1" max="12" required/></label><label v-else-if="control==='partition'">分区值<input v-model="draft.partition" maxlength="80" required/></label><label v-else-if="control==='retention'">保留提交数量<input v-model.number="draft.retention" type="number" min="1" max="10" required/></label><label v-else-if="control==='tableType'">表类型<select v-model="draft.tableType"><option value="COPY_ON_WRITE">COW</option><option value="MERGE_ON_READ">MOR</option></select></label><label v-else-if="control==='failureAt'">机制示意的阻断关口<select v-model.number="draft.failureAt"><option :value="-1">不设置阻断</option><option v-for="(node,i) in lesson.nodes" :key="i" :value="i">{{ node }}</option></select></label></template><label class="lesson-checkbox"><input v-model="player!.reduced.value" type="checkbox" @change="player?.pause"/>减少动态效果，改用单步观察</label><p v-if="errorMessage" role="alert" class="lesson-error">{{ errorMessage }}</p><button class="lesson-primary" type="submit">应用参数并重置</button></form>
      <TeachingInspector v-else-if="drawer==='查看对象'" :value="inspection?.value"/>
      <template v-else-if="lesson && state && frame"><nav class="vl-drawer-tabs"><button v-for="tab in ['技术详情','运行日志','HDFS','Timeline','SQL','源码透视','证据']" :key="tab" :class="{active:drawer===tab}" @click="drawer=tab">{{ tab }}</button></nav>
        <template v-if="drawer==='技术详情'"><h3>{{ entry?.title }}</h3><p>{{ entry?.summary }}</p><p>{{ MODEL_LABEL[lesson.model] }}。{{ lesson.model === 'concept' ? '当前主题没有可执行的完整底层模型；动画展示机制与校验关口，不改变表状态或伪造服务结果。' : lesson.model === 'mixed' ? '文件、查询和提交结果来自本地引擎；外部服务、调度及部分机制仅作示意。' : '操作前后状态来自同一引擎，回放和拖动不重复执行操作。' }}</p><p>{{ entry?.note ?? '沿用现有教学模型，真实 r26 文件与事务行为仍需现场核对。' }}</p><h3>本步解释</h3><p>{{ frame.step.caption }}</p><p v-if="frame.error" class="lesson-error">{{ frame.error }}</p><pre>{{ JSON.stringify({操作:frame.step.operation ?? '机制观察',新增文件:frame.added.map(f=>f.fileName),删除文件:frame.removed.map(f=>f.fileName),被取代文件:frame.retired.map(f=>f.fileName)},null,2) }}</pre><h3 v-if="visibleQuery">查询结果</h3><pre v-if="visibleQuery">{{ JSON.stringify(visibleQuery,null,2) }}</pre></template>
        <template v-if="drawer==='运行日志'"><p>以下是截至当前展示位置的本地模拟日志，未连接真实集群。</p><article v-for="(item,i) in run!.frames.slice(0,current+(player!.committed.value?1:0))" :key="i"><h3>{{ i+1 }} · {{ item.step.title }}</h3><pre>{{ item.logs.join('\n') || '机制观察，无执行日志。' }}</pre></article></template>
        <template v-if="drawer==='HDFS'"><p>{{ state.table.tablePath }}</p><button v-for="file in state.physicalFiles" :key="file.fileName" class="vl-file-row" @click="inspect(file.fileName,{...file,records:fileRecords(state,file.fileName)})">{{ file.type }} · {{ file.fileName }}<small>{{ file.status }}</small></button><pre v-if="!state.physicalFiles.length">空表，还没有数据文件。</pre></template>
        <template v-if="drawer==='Timeline'"><h3>活跃 Timeline</h3><pre>{{ JSON.stringify(state.timeline,null,2) }}</pre><h3>归档 Instant</h3><pre>{{ JSON.stringify(state.archivedInstants,null,2) }}</pre></template>
        <template v-if="drawer==='SQL'"><p>以下为参考模板，不是本次操作的真实执行脚本；SQL / Scala / Flink 未在浏览器中执行。</p><article v-for="template in templates" :key="template!.id"><h3>{{ template!.title }}</h3><p>{{ template!.note }}</p><pre>{{ template!.code }}</pre></article></template>
        <template v-if="drawer==='源码透视'"><p>本地实现位置；不是已核实的华为 Java / Scala 源码。</p><pre>src/experiments/visual/lessons.ts → 主题步骤\nsrc/engine/visual/scenarios.ts → buildLessonRun\nsrc/engine/core/applyAction.ts → applyAction\nsrc/engine/operations/writes.ts → performWrite\nsrc/engine/queries/index.ts → runQuery\nsrc/engine/indexes/bucket.ts → bucketOf</pre><p>{{ lesson.kind==='index' ? 'djb2 分桶仅为教学算法，r26 实际映射待验证。' : '未实现的机制不伪造状态变化；真实类名与执行路径需结合发行源码验证。' }}</p></template>
        <template v-if="drawer==='证据'"><p>{{ entry?.note ?? '当前目录证据不等同于 r26 集群行为实测。' }}</p><EvidencePanel :evidence-ids="evidenceIds"/></template>
      </template>
    </div></dialog>
  </div>
</template>
<style src="../styles/visual-lab.css"></style>
<style src="../styles/lessons.css"></style>
