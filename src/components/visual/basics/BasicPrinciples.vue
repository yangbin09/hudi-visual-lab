<script setup lang="ts">
import { computed, ref } from 'vue'
import BasicsFile from './BasicsFile.vue'
import './basics.css'
import { activeGroup, fileVersions, focusAmount, sliceFiles } from '@/engine/visual/basics'
import { fileRecords, type LessonFrame, type LessonRun } from '@/engine/visual/scenarios'
import type { HudiTableState } from '@/models/hudi'
import type { LessonParameters } from '@/experiments/visual/types'
const props=defineProps<{id:string;frame:LessonFrame;run:LessonRun;state:HudiTableState;parameters:LessonParameters;current:number;progress:number;started:boolean}>()
const emit=defineEmits<{inspect:[title:string,value:unknown]}>()
const tree=ref({data:true,meta:true})
const reader=ref('both')
const committed=computed(()=>props.progress>=.82)
const group=computed(()=>activeGroup(props.state))
const slice=computed(()=>group.value?.fileSlice)
const versions=computed(()=>fileVersions(props.state,props.parameters.recordKey))
const candidateVersion=computed(()=>fileVersions(props.frame.after,props.parameters.recordKey).find(f=>props.frame.added.some(a=>a.fileName===f.fileName)))
const rows=computed(()=>props.run.initial.records)
const updated=computed(()=>props.run.frames.find(f=>f.step.operation==='upsert')?.after??props.state)
const oldAmount=computed(()=>focusAmount(props.run.initial,props.parameters.recordKey))
const newAmount=computed(()=>focusAmount(updated.value,props.parameters.recordKey))
const initialFiles=computed(()=>sliceFiles(props.run.initial))
const oldFile=computed(()=>initialFiles.value[0])
const newFile=computed(()=>sliceFiles(updated.value)[0])
const readableNew=computed(()=>props.current>1||props.current===1&&committed.value)
const show=computed(()=>props.started?props.current+props.progress:0)
const t=computed(()=>Math.max(0,Math.min(1,(props.progress-.15)/.62)))
const partitionRows=computed(()=>props.state.records.filter(r=>r.recordKey===props.parameters.recordKey))
const altPartition=computed(()=>props.parameters.partition==='2024-02-01'?'2024-03-01':'2024-02-01')
const viewFiles=computed(()=>props.state.physicalFiles.slice(-4))
const timeline=computed(()=>props.state.timeline.slice(-3))
const short=(s:string|undefined|null)=>s?.slice(-6)??'—'
const fileName=(s:string|undefined)=>s&&s.length>39?s.slice(0,20)+'…'+s.slice(-15):s??'尚未生成'
function inspectFile(fileName:string){emit('inspect',fileName,{...props.state.physicalFiles.find(f=>f.fileName===fileName),records:fileRecords(props.state,fileName)})}
const title=computed(()=>({B01:'相同的文件，谁来决定哪一版可读？',B04:'从分区向内看：身份稳定，文件组合会变化',B05:'沿时间追踪：写入时间、Log 版本、Slice 边界',B06:'主键回答“是谁”，分区回答“在哪里”',B07:'两个读者，各自选择可见的已提交版本',B08:'一次写入，在数据与元数据两处留下痕迹'}[props.id]))
</script>
<template>
<div class="basics-scene" :data-detail="`basics-${id}`">
  <div class="basics-tools">
    <strong>{{ title }}</strong>
    <label v-if="id==='B07'">突出读取路径<select v-model="reader" aria-label="突出读取路径"><option value="both">同时对照</option><option value="old">历史时刻</option><option value="latest">最新快照</option></select></label>
    <span v-else>点击文件或结构，检查对应数据</span>
  </div>
  <svg class="lesson-canvas" viewBox="0 0 1080 450" role="img" :aria-label="`${id} ${title}`" :data-scene="id==='B06'?'index':id==='B07'?'query':id==='B08'?'schema':'files'" :data-progress="progress.toFixed(3)">
    <defs><pattern :id="`bg-${id}`" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="currentColor" opacity=".12"/></pattern></defs><rect width="1080" height="450" :fill="`url(#bg-${id})`"/>
    <!-- B01: two storage systems, with an explicit version authority on the Hudi side. -->
    <g v-if="id==='B01'">
      <path d="M540 24V363" class="bs-rule"/>
      <text x="28" y="34" class="bs-heading">普通 Parquet 文件</text><text x="573" y="34" class="bs-heading">Hudi 表</text>
      <text x="28" y="61" class="bs-small">文件提供数据；版本与发布规则需要额外管理</text><text x="573" y="61" class="bs-small">数据文件 + Timeline，一起确定已提交的可读版本</text>
      <g transform="translate(28,86)"><BasicsFile title="原始 Parquet" subtitle="不可原地修改一行" :rows="rows" :focus="parameters.recordKey" @inspect="emit('inspect','原始记录',{records:rows})"/></g>
      <g v-if="current<2" transform="translate(306,104)"><rect width="203" height="145" rx="12" class="bs-panel"/><text x="15" y="29" class="bs-title">更新请求</text><text x="15" y="62" class="bs-code">{{ parameters.recordKey }} → ¥ {{ parameters.amount }}</text><text x="15" y="91" class="bs-small">需要生成替换文件</text><text x="15" y="117" class="bs-small">由外部流程决定何时发布</text></g>
      <g v-else transform="translate(306,104) scale(.8)"><BasicsFile title="替换文件示例" subtitle="相同更新后的业务数据" :rows="updated.records" :focus="parameters.recordKey" :reveal="current>=3?1:t" note="由外部发布策略管理" @inspect="emit('inspect','普通文件替换示意',{说明:'用相同的更新结果示意替换文件；不模拟 Hive 的具体写入协议。',records:updated.records})"/></g>
      <path d="M280 182H306" class="bs-path"/>
      <g transform="translate(573,86)"><BasicsFile :title="(current>2||current===2&&committed)?'新 Base':'原始 Base'" :subtitle="(current>2||current===2&&committed)?'新提交已生效':'保留已提交版本'" :rows="state.records" :focus="parameters.recordKey" @inspect="emit('inspect','当前 Hudi 快照',{records:state.records})"/></g>
      <g transform="translate(846,86)"><rect width="205" height="184" rx="12" class="bs-soft"/><text x="17" y="30" class="bs-title">Timeline 版本账本</text><g v-for="(instant,i) in state.timeline.slice(-3)" :key="instant.instantTime" :transform="`translate(17,${57+i*38})`"><circle cx="4" cy="0" r="4" class="bs-token"/><text x="17" y="4" class="bs-code">{{ short(instant.instantTime) }}</text><text x="17" y="21" class="bs-small">{{ instant.state }}</text></g></g>
      <path d="M846 205H825" class="bs-link"/><circle v-if="started&&current===2&&!committed" :cx="573+t*220" cy="287" r="7" class="bs-token"/>
      <rect x="28" y="300" width="481" height="59" rx="9" class="bs-panel"/><text x="44" y="325" class="bs-label">Parquet 文件本身没有 Hudi 提交账本</text><text x="44" y="345" class="bs-small">这里不把所有 Hive / Parquet 更新都等同于整表覆盖</text>
      <rect x="573" y="300" width="478" height="59" rx="9" class="bs-result"/><text x="589" y="325" class="bs-label">{{ (current>2||current===2&&committed)?'新文件 + 完成提交 → 新版本可读':'提交完成前 → 继续读取原来的已提交版本' }}</text><text x="589" y="345" class="bs-small">当前 {{ parameters.recordKey }} 的金额：{{ focusAmount(state,parameters.recordKey) }}</text>
    </g>
    <!-- B04: actual nested boundaries, not a generic input / engine / output diagram. -->
    <g v-else-if="id==='B04'">
      <rect x="25" y="24" width="1030" height="339" rx="18" class="bs-panel" :style="current===0?'stroke:var(--vl-accent);stroke-width:2':undefined"/><text x="45" y="52" class="bs-title">分区 / {{ group?.partitionPath }}</text>
      <rect x="45" y="72" width="991" height="273" rx="14" class="bs-soft"/><text x="65" y="99" class="bs-title">File Group</text><text x="208" y="99" class="bs-code">稳定的 File ID：{{ group?.fileId }}</text>
      <rect x="65" y="117" width="632" height="210" rx="12" class="bs-panel" :style="current===1?'stroke:var(--vl-accent);stroke-width:2':undefined"/><text x="83" y="144" class="bs-title">当前 File Slice</text><text x="301" y="144" class="bs-small">base instant {{ slice?.baseInstantTime }}</text>
      <g transform="translate(84,157) scale(.82)"><BasicsFile title="Base File" :subtitle="fileName(slice?.baseFile?.fileName)" :rows="slice?.baseFile?.records??[]" :focus="parameters.recordKey" @inspect="slice?.baseFile&&inspectFile(slice.baseFile.fileName)"/></g>
      <text x="310" y="237" class="bs-big">+</text>
      <g transform="translate(350,157)"><rect width="327" height="151" rx="10" class="bs-log-panel"/><text x="17" y="28" class="bs-title">{{ slice?.logFiles.length??0 }} 个 Log File</text><text v-if="!slice?.logFiles.length" x="17" y="65" class="bs-small">零个 Log 也是合法的 File Slice</text><g v-for="(log,i) in slice?.logFiles.slice(0,3)" :key="log.fileName" class="bs-hit" role="button" tabindex="0" :aria-label="`检查 Log v${log.version}`" :transform="`translate(13,${43+i*31})`" @click="inspectFile(log.fileName)" @keydown.enter="inspectFile(log.fileName)"><rect width="301" height="27" rx="5" class="bs-panel"/><text x="10" y="19" class="bs-code">v{{ log.version }} · {{ short(log.instantTime) }} · {{ log.recordCount }} 条记录</text></g></g>
      <g v-if="!(current===4&&!committed)" transform="translate(722,133)"><text y="14" class="bs-title">哪些会变，哪些不变？</text><text y="52" class="bs-label bs-green">✓ File ID 保持不变</text><text y="85" class="bs-label">{{ current>=4&&committed?'新 Base → 新 Slice 边界':'更新追加 Log → 仍在此 Slice' }}</text><text y="118" class="bs-small">{{ current===3?'计划阶段不替换任何数据文件':current===4?'合并提交后才切换文件引用':'分区包含 Group；Group 包含 Slice' }}</text><text y="153" class="bs-small">{{ state.physicalFiles.filter(f=>f.status==='SUPERSEDED').length }} 个旧物理文件仍保留</text></g>
      <g v-if="current===2&&!committed" transform="translate(371,263)" :opacity=".3+t*.6"><rect width="286" height="30" rx="6" class="bs-log-panel"/><text x="12" y="20" class="bs-code">{{ parameters.recordKey }} · ¥ {{ parameters.amount }} → 候选 Log</text><circle :cx="14+t*240" cy="-9" r="5" class="bs-token"/></g>
      <g v-if="current===4&&!committed" transform="translate(722,139) scale(.94)"><BasicsFile title="候选新 Base" subtitle="提交后将切换 Slice 边界" :rows="frame.after.records" :focus="parameters.recordKey" :reveal="t" note="预览，当前 Slice 尚未切换" @inspect="emit('inspect','Compaction 候选',{records:frame.after.records})"/></g>
    </g>
    <!-- B05: physical file versions on a chronological rail with a separate slice rail. -->
    <g v-else-if="id==='B05'">
      <text x="28" y="34" class="bs-title">同一 File ID：{{ group?.fileId }}</text><text x="28" y="61" class="bs-small">横向是写入顺序；Log version 与提交 instant 是不同维度</text>
      <path d="M58 99H1020" class="bs-path"/>
      <g v-for="(file,i) in versions.slice(-5)" :key="file.fileName" :transform="`translate(${28+i*205},83)`" class="bs-hit" role="button" tabindex="0" :aria-label="`版本 ${file.kind} ${file.instant}`" @click="inspectFile(file.fileName)" @keydown.enter="inspectFile(file.fileName)">
        <circle cx="24" cy="16" r="7" :class="file.kind==='Base'?'bs-token':'bs-gold-link'"/>
        <text x="10" y="53" class="bs-code">{{ file.instant }}</text>
        <rect y="69" width="190" height="150" rx="12" :class="file.kind==='Log'?'bs-log-panel':'bs-soft'" :opacity="file.active?1:.45"/>
        <text x="14" y="100" class="bs-title">{{ file.kind==='Base'?'Base File':`Log · version ${file.version}` }}</text>
        <text x="14" y="128" class="bs-small">Slice 的 base instant</text><text x="14" y="150" class="bs-code">{{ file.baseInstant }}</text><text x="14" y="176" class="bs-code">{{ file.sample }}</text><text x="14" y="204" class="bs-small">{{ file.active?'✓ 当前 Slice 引用':'旧版本保留，等待 Cleaner' }}</text>
      </g>
      <g v-if="frame.added.length&&!committed" :transform="`translate(${Math.min(4,versions.length)*205+28},152)`" :opacity=".2+t*.65"><rect width="190" height="129" rx="12" class="bs-panel"/><text x="14" y="38" class="bs-title">{{ candidateVersion?.kind==='Log'?`Log · v${candidateVersion.version}`:'新 Base 生成中' }}</text><text x="14" y="68" class="bs-small">预览 · 尚未切换引用</text><text x="14" y="93" class="bs-code">{{ candidateVersion?.instant }}</text></g>
      <circle v-if="started&&frame.added.length&&!committed" :cx="52+t*Math.min(4,versions.length)*205" cy="99" r="6" class="bs-token"/>
      <rect x="28" y="309" width="1024" height="54" rx="10" class="bs-result"/><text x="45" y="332" class="bs-label">当前 Slice：Base @ {{ short(slice?.baseInstantTime) }} + {{ slice?.logFiles.length }} 个 Log</text><text x="45" y="352" class="bs-small">{{ current>=4&&committed?'Compaction 新建 Base，当前 Slice 边界前移；旧 Base 与 Log 没有被删除。':'Log 写入有自己的提交时间，但引用的 Base 可以仍来自更早的提交。' }}</text>
    </g>
    <!-- B06: identity is composed visibly; partition-scoped lookup is shown as separate boxes. -->
    <g v-else-if="id==='B06'">
      <g v-for="(partition,i) in [parameters.partition,altPartition]" :key="partition" :transform="`translate(${28+i*535},25)`">
        <rect width="489" height="335" rx="16" class="bs-panel"/>
        <text x="20" y="32" class="bs-title">{{ i===0?'原分区':'另一分区' }} · {{ partition }}</text>
        <rect x="20" y="53" width="174" height="69" rx="10" class="bs-soft"/><text x="34" y="78" class="bs-small">Record Key</text><text x="34" y="104" class="bs-big">{{ parameters.recordKey }}</text>
        <text x="210" y="98" class="bs-big">+</text>
        <rect x="245" y="53" width="224" height="69" rx="10" class="bs-panel"/><text x="259" y="78" class="bs-small">Partition Path</text><text x="259" y="105" class="bs-code">{{ partition }}</text>
        <path d="M107 122V153H355V122M244 153V177" class="bs-link"/>
        <rect x="20" y="178" width="449" height="59" rx="10" :class="i===1?'bs-log-panel':'bs-soft'" :opacity="show>=1?1:.3"/><text x="34" y="202" class="bs-small">HoodieKey · 复合身份</text><text x="34" y="225" class="bs-code">({{ parameters.recordKey }}, {{ partition }})</text>
        <path d="M244 237V266" class="bs-path"/><text x="24" y="288" class="bs-label">{{ i===0?'在原分区内查找已有记录':current>=2?'只在新分区查找，不自动跨分区搬走旧记录':'切换分区后，将进入另一套查找范围' }}</text>
        <text x="24" y="316" class="bs-small">{{ partitionRows.some(r=>r.partitionPath===partition)?'✓ 此分区有该主键的记录':'此分区尚无该主键' }}</text>
        <circle v-if="started&&current===1" :cx="244" :cy="126+t*48" r="6" class="bs-token"/>
      </g>
      <text x="540" y="217" text-anchor="middle" class="bs-big bs-gold">≠</text>
    </g>
    <!-- B07: two simultaneous readers and two explicit immutable file versions. -->
    <g v-else-if="id==='B07'">
      <path d="M160 70H916" class="bs-path"/><circle cx="160" cy="70" r="8" class="bs-token"/><circle cx="916" cy="70" r="8" class="bs-token" :opacity="readableNew?1:.3"/>
      <text x="28" y="33" class="bs-title">旧提交 {{ props.run.initial.timeline.at(-1)?.instantTime }}</text><text x="700" y="33" class="bs-title">{{ readableNew?'新提交已完成':'新提交尚未完成' }}</text>
      <text x="470" y="63" class="bs-small">时间向前 →</text>
      <g transform="translate(28,101)" :opacity="reader==='latest'?.3:1"><BasicsFile title="历史 Base" :subtitle="fileName(oldFile?.fileName)" :rows="rows" :focus="parameters.recordKey" @inspect="emit('inspect','历史版本',props.run.initial)"/></g>
      <g transform="translate(800,101)" :opacity="readableNew?reader==='old'?.3:1:.25"><BasicsFile title="新的 Base" :subtitle="fileName(newFile?.fileName)" :rows="updated.records" :focus="parameters.recordKey" :note="readableNew?'提交完成 → 新读者可见':'候选文件 → 尚未提交'" @inspect="emit('inspect','新版本',updated)"/></g>
      <g transform="translate(317,111)"><rect width="446" height="70" rx="12" class="bs-panel"/><text x="20" y="26" class="bs-title bs-blue">历史读取 · 固定旧时刻</text><text x="20" y="53" class="bs-label">{{ parameters.recordKey }} → ¥ {{ oldAmount }} · 选择历史文件</text></g>
      <path d="M317 146H280" class="bs-link" :opacity="reader==='latest'?.2:1"/>
      <g transform="translate(317,215)"><rect width="446" height="70" rx="12" class="bs-result"/><text x="20" y="26" class="bs-title">Snapshot · 最新已提交时刻</text><text x="20" y="53" class="bs-label">{{ parameters.recordKey }} → ¥ {{ readableNew?newAmount:oldAmount }}</text></g>
      <path :d="readableNew?'M763 250H800':'M317 250H280'" class="bs-link" :opacity="reader==='old'?.2:1"/>
      <circle v-if="started&&current>=2" :cx="reader==='old'?317-t*37:763+t*37" :cy="reader==='old'?146:250" r="6" class="bs-token"/>
      <rect x="28" y="313" width="1024" height="50" rx="10" class="bs-panel"/><text x="46" y="343" class="bs-label">{{ readableNew?'新读取选新版本；历史读取仍选旧文件。旧文件物理存在，不代表它属于当前快照。':'新文件即使已在生成，提交完成前，Snapshot 仍然选择旧的已提交版本。' }}</text>
    </g>
    <!-- B08: a navigable directory, with the actual physical files and Timeline side by side. -->
    <g v-else-if="id==='B08'">
      <text x="28" y="34" class="bs-title">▣ {{ state.table.tablePath }}</text><path d="M46 49V337M46 89H78M46 249H78" class="bs-path"/>
      <g class="bs-hit" role="button" tabindex="0" aria-label="展开或收起数据目录" @click="tree.data=!tree.data" @keydown.enter="tree.data=!tree.data" @keydown.space.prevent="tree.data=!tree.data"><rect x="78" y="66" width="500" height="43" rx="8" class="bs-soft"/><text x="93" y="94" class="bs-title">{{ tree.data?'▾':'▸' }} {{ group?.partitionPath }}/ <tspan class="bs-small">数据目录</tspan></text></g>
      <g v-if="tree.data"><path d="M98 109V220" class="bs-path"/><g v-for="(file,i) in viewFiles" :key="file.fileName" :transform="`translate(116,${117+i*26})`" class="bs-hit" role="button" tabindex="0" :aria-label="`目录文件 ${file.fileName}`" @click="inspectFile(file.fileName)" @keydown.enter="inspectFile(file.fileName)"><rect width="462" height="24" rx="4" :class="frame.added.some(f=>f.fileName===file.fileName)?'bs-focus-row':'bs-quiet-row'"/><text x="10" y="17" class="bs-code">{{ fileName(file.fileName) }}</text></g></g>
      <g v-if="tree.data&&current===2&&!committed" :opacity=".25+t*.7"><rect x="116" :y="117+viewFiles.length*26" width="462" height="24" rx="4" class="bs-focus-row"/><text x="126" :y="134+viewFiles.length*26" class="bs-code">{{ fileName(frame.added[0]?.fileName) }} · 候选</text></g>
      <g class="bs-hit" role="button" tabindex="0" aria-label="展开或收起元数据目录" @click="tree.meta=!tree.meta" @keydown.enter="tree.meta=!tree.meta" @keydown.space.prevent="tree.meta=!tree.meta"><rect x="78" y="227" width="500" height="43" rx="8" class="bs-log-panel"/><text x="93" y="255" class="bs-title">{{ tree.meta?'▾':'▸' }} .hoodie/ <tspan class="bs-small">元数据目录</tspan></text></g>
      <g v-if="tree.meta"><path d="M98 270V356" class="bs-path"/><text x="126" y="294" class="bs-code">hoodie.properties</text><text v-for="(instant,i) in timeline.slice(-2)" :key="instant.instantTime" x="126" :y="318+i*24" class="bs-code">{{ instant.instantTime }} · {{ instant.action }} · {{ instant.state }}</text></g>
      <rect x="619" y="66" width="433" height="296" rx="14" class="bs-panel"/><text x="641" y="99" class="bs-title">同一次写入的两条线索</text>
      <text x="641" y="136" class="bs-label bs-green">① 分区里写入数据文件</text><text x="641" y="163" class="bs-small">记录在这里；文件不等于事务已经完成</text><path d="M833 179V206" class="bs-link"/>
      <text x="641" y="235" class="bs-label bs-gold">② Timeline 记录完成提交</text><text x="641" y="262" class="bs-small">提交状态与文件引用一起确定可读版本</text>
      <text x="641" y="302" class="bs-code">物理文件 {{ state.physicalFiles.length }} · 已完成 {{ state.timeline.filter(i=>i.state==='COMPLETED').length }} 次提交</text><text x="641" y="333" class="bs-small">这里展示逻辑目录；真实命名与布局需按版本核对</text>
      <circle v-if="started&&current===2&&!committed" :cx="590" :cy="105+t*146" r="7" class="bs-token"/>
    </g>
    <rect x="28" y="390" width="1024" height="39" rx="9" class="bs-result"/>
    <text x="45" y="415" class="bs-label">{{ id==='B01'?'关键区别：数据文件之外，Hudi 还维护提交与版本选择。':id==='B04'?'记住四层：分区 → File Group → File Slice → Base + Logs。':id==='B05'?'版本号不等于提交时间；生成新 Base 不等于物理删除旧文件。':id==='B06'?'相同 Record Key + 不同 Partition Path → 不同 HoodieKey；本课使用分区级索引。':id==='B07'?'可见性由读取时刻与完成提交决定；本地 Checkpoint 用于保存教学模型的历史状态。':'排查一次写入：既看分区中的文件，也看 .hoodie 中的提交状态。' }}</text>
  </svg>
  <div class="basics-key"><span><i></i>数据 / 当前有效引用</span><span><i class="log"></i>Log / 元数据</span><span><i class="blue"></i>历史版本</span><span>虚线表示关联，移动标记表示本步追踪</span></div>
</div>
</template>
