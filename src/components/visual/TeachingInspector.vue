<script setup lang="ts">
import { computed } from 'vue'
const props=defineProps<{value:unknown}>()
const object=computed(()=>props.value && typeof props.value==='object' ? props.value as Record<string,unknown> : {})
const records=computed(()=>Array.isArray(object.value.records)?object.value.records as Record<string,unknown>[]:undefined)
const hashSteps=computed(()=>Array.isArray(object.value.steps)?object.value.steps as {character:string;code:number;before:number;after:number}[]:undefined)
const fields=(record:Record<string,unknown>)=>record.fields && typeof record.fields==='object'?record.fields as Record<string,unknown>:record
const note=computed(()=>object.value.判断??object.value.读取判断??object.value.reason??object.value.说明??object.value.note)
const scalar=computed(()=>Object.entries(object.value).filter(([key,value])=>!['records','fileGroups','note','说明','模拟日志','判断','读取判断','reason','steps'].includes(key)&&value!==null&&typeof value!=='object'))
const labels:Record<string,string>={initial:'初始 h',hashValue:'哈希绝对值',bucketCount:'桶数量',recordKey:'记录主键',partitionPath:'分区路径',amount:'金额',ts:'precombine / ts',preCombineValue:'precombine',operation:'操作类型',commitTime:'记录提交时间',type:'文件类型',status:'文件状态',recordCount:'文件记录数',fileName:'物理文件名',createdInstant:'文件创建时间',instantTime:'事务 Instant',action:'事务动作',state:'事务状态',bucket:'桶号',winner:'是否为胜出版本',returned:'是否进入结果',selected:'是否参与读取',source:'来源文件类型'}
const statusExplanation=computed(()=>object.value.status==='SUPERSEDED'?'这个文件已不被当前 Slice 引用，但仍物理存在，是否可删还要看保留窗口。':object.value.status==='ACTIVE'?'这个文件仍被当前 File Slice 引用，Cleaner 不应把它当作旧文件删除。':object.value.state==='REQUESTED'?'请求或计划已经保存；这不代表文件合并已经完成。':object.value.state==='INFLIGHT'?'事务尚未完成，不能把上层作业的结束当成已提交。':object.value.state==='COMPLETED'?'这个 Instant 已在当前模拟 Timeline 中完成。':'')
</script>
<template>
  <section class="teaching-inspector"><p v-if="note">{{ note }}</p><p v-if="statusExplanation" class="inspector-reason">{{ statusExplanation }}</p>
    <dl v-if="scalar.length" class="inspector-properties"><template v-for="([key,value]) in scalar" :key="key"><dt>{{ labels[key]??key }}</dt><dd>{{ typeof value==='boolean'?value?'是':'否':value }}</dd></template></dl>
    <template v-if="records"><h3>文件 / Bucket 中的具体记录</h3><table><thead><tr><th>主键</th><th>金额</th><th>ts</th><th>操作</th></tr></thead><tbody><tr v-for="(record,i) in records" :key="i" :class="{'inspector-tombstone':record.operation==='D'}"><td>{{ record.recordKey??fields(record).id }}</td><td>{{ fields(record).amount }}</td><td>{{ record.preCombineValue??fields(record).ts }}</td><td>{{ record.operation??'—' }}</td></tr></tbody></table><p v-if="!records.length">这里目前没有记录。</p><p v-if="records.some(r=>r.operation==='D')">D 是删除标记。物理文件中可见，不代表 Snapshot 仍会返回这条记录。</p></template>
    <template v-else-if="object.record && typeof object.record==='object'"><h3>该候选版本的记录</h3><dl class="inspector-properties"><template v-for="(value,key) in fields(object.record as Record<string,unknown>)" :key="key"><dt>{{ labels[key]??key }}</dt><dd>{{ value }}</dd></template></dl></template>
    <template v-else-if="object.fields && typeof object.fields==='object'"><h3>业务字段</h3><dl class="inspector-properties"><template v-for="(value,key) in object.fields" :key="key"><dt>{{ labels[key]??key }}</dt><dd>{{ value }}</dd></template></dl></template>
    <h3 v-if="Array.isArray(object.fileGroups)">当前关联 {{ object.fileGroups.length }} 个 File Group</h3>
<template v-if="hashSteps"><h3>逐字符计算（32 位有符号整数）</h3><table><thead><tr><th>字符</th><th>编码</th><th>原 h</th><th>新 h</th></tr></thead><tbody><tr v-for="(step,i) in hashSteps" :key="i"><td>{{ step.character }}</td><td>{{ step.code }}</td><td>{{ step.before }}</td><td>{{ step.after }}</td></tr></tbody></table></template>
    <details class="inspector-raw"><summary>查看完整原始数据</summary><pre>{{ JSON.stringify(value,null,2) }}</pre></details>
  </section>
</template>
<style scoped>
.inspector-properties{display:grid;grid-template-columns:130px minmax(0,1fr);font-size:12px;gap:0;margin:18px 0}.inspector-properties dt,.inspector-properties dd{padding:10px 0;border-bottom:1px solid var(--vl-line);margin:0}.inspector-properties dt{color:var(--vl-muted)}.inspector-properties dd{overflow-wrap:anywhere}.inspector-reason{padding:13px 15px;border-left:3px solid #83aa89;background:var(--vl-bg);border-radius:0 5px 5px 0}.inspector-tombstone td{color:#db9f8b}.inspector-raw{margin-top:25px;font-size:12px;color:var(--vl-muted)}.inspector-raw summary{cursor:pointer}.teaching-inspector table{font-size:12px}
</style>
