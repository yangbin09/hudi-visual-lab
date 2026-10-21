import { teachingHash, bucketOf } from '@/engine/indexes/bucket'
import { mergeRecords } from '@/engine/core/state'
import { fileRecords } from './records'
import type { HudiPhysicalFile, HudiRecord, HudiTableState } from '@/models/hudi'
import type { InputRecord, SimulationAction } from '@/models/actions'
import type { QueryRequest, QueryResult } from '@/engine/queries/types'
import type { LessonOperation, LessonParameters } from '@/experiments/visual/types'

export interface TeachingMoment { at: number; title: string; explanation: string }
export interface VersionRow {
  record: HudiRecord; fileName: string; source: 'BASE' | 'LOG'; selected: boolean
  reason: string; winner: boolean; returned: boolean
}
export interface FileJudgment { file: HudiPhysicalFile; selected: boolean; removed: boolean; reason: string }
export interface TeachingTrace {
  kind: 'write' | 'merge' | 'clean' | 'query' | 'index' | 'plan' | 'transaction' | 'overview'
  moments: TeachingMoment[]
  input: InputRecord[]
  focusKey: string
  sourceFile?: HudiPhysicalFile
  outputFile?: HudiPhysicalFile
  sourceRecords: HudiRecord[]
  outputRecords: HudiRecord[]
  comparison?: { prior: string; incoming: string; relation: string; result: string }
  copiedKeys: string[]
  changedKeys: string[]
  versions: VersionRow[]
  files: FileJudgment[]
  result?: QueryResult
  queryRequest?: QueryRequest
  hash?: { key: string; value: number; count: number; bucket: number }
  retention?: { count: number; keepInstants: string[] }
  affectedGroups: string[]
  summary: string
}
export interface TraceRequest {
  before: HudiTableState; after: HudiTableState; operation?: LessonOperation
  action?: SimulationAction; input?: InputRecord[]; request?: QueryRequest; query?: QueryResult
  parameters: LessonParameters; error?: string
}
const identity = (r: { recordKey: string; partitionPath: string }) => `${r.partitionPath}::${r.recordKey}`
const sameVersion = (a: HudiRecord, b: HudiRecord) => identity(a) === identity(b) && a.commitTime === b.commitTime && a.preCombineValue === b.preCombineValue && a.operation === b.operation && JSON.stringify(a.fields) === JSON.stringify(b.fields)
function physicalVersions(state: HudiTableState): VersionRow[] {
  const names = new Set(state.fileGroups.filter(g=>!g.supersededBy).flatMap(g=>[g.fileSlice.baseFile?.fileName, ...g.fileSlice.logFiles.map(l=>l.fileName)].filter(Boolean)))
  return state.physicalFiles.filter(f=>names.has(f.fileName)).flatMap(file=>fileRecords(state,file.fileName).map(record=>({record,fileName:file.fileName,source:file.type,selected:true,reason:'当前 File Slice 引用',winner:false,returned:false})))
}
function moment(at: number, title: string, explanation: string): TeachingMoment { return {at,title,explanation} }
/** Derives teaching evidence from actual requests and snapshots; never changes a simulation result. */
export function buildTeachingTrace(r: TraceRequest): TeachingTrace {
  const {before,after,operation:op,parameters:p}=r
  const input = r.input ?? (r.action && 'records' in r.action ? r.action.records : [])
  const focusKey = input[0]?.recordKey ?? p.recordKey
  const changed = after.records.filter(record=>!before.records.some(prior=>sameVersion(prior,record)))
  const added = after.physicalFiles.filter(f=>!before.physicalFiles.some(b=>b.fileName===f.fileName))
  const targetPartition = input[0]?.partitionPath ?? String(input[0]?.fields.dt ?? p.partition)
  const affected = before.fileGroups.filter(g=>!g.supersededBy && g.partitionPath===targetPartition && [...(g.fileSlice.baseFile?.records??[]),...g.fileSlice.logFiles.flatMap(f=>f.records)].some(row=>row.recordKey===focusKey))
  const sourceFile = before.physicalFiles.find(f=>f.type==='BASE' && affected.some(g=>g.fileSlice.baseFile?.fileName===f.fileName))
  const outputFile = added.find(f=>fileRecords(after,f.fileName).some(row=>row.recordKey===focusKey)) ?? added[0]
  const sourceRecords = sourceFile ? fileRecords(before,sourceFile.fileName) : []
  const outputRecords = outputFile ? fileRecords(after,outputFile.fileName) : []
  const copiedKeys = outputRecords.filter(record=>sourceRecords.some(prior=>sameVersion(prior,record))).map(row=>row.recordKey)
  const trace: TeachingTrace = {kind:'overview',moments:[],input,focusKey,sourceFile,outputFile,sourceRecords,outputRecords,copiedKeys,changedKeys:changed.map(row=>row.recordKey),versions:physicalVersions(before),files:[],affectedGroups:affected.map(g=>g.fileId),summary:''}
  if (before.table.indexType==='BUCKET') trace.hash={key:focusKey,value:teachingHash(focusKey),count:p.bucketCount,bucket:bucketOf(focusKey,p.bucketCount)}
  if(r.error){trace.summary=r.error;trace.moments=[moment(.08,'检查输入','写入先经过配置与兼容性校验。'),moment(.35,'在校验处停止',r.error),moment(.86,'没有提交','原文件、记录和 Timeline 保持不变。')];return trace}
  if(r.query && r.request){
    trace.kind='query';trace.result=r.query;trace.queryRequest=r.request
    const historical = r.request.mode==='time-travel' ? before.checkpoints.find(c=>c.instantTime===r.request!.asOfInstant)?.state : undefined
    const source = historical ?? before
    trace.versions=physicalVersions(source)
    const fileNames=new Set(trace.versions.map(v=>v.fileName))
    for(const v of trace.versions){
      if(r.request.mode==='read-optimized' && v.source==='LOG'){v.selected=false;v.reason='读优化不打开 Log'}
      else if(op==='partition-read' && v.record.partitionPath!==p.partition){v.selected=false;v.reason='分区条件不匹配'}
      else if(r.request.mode==='incremental' && (v.record.commitTime<(r.request.beginInstantTime??'') || v.record.commitTime>(r.request.endInstantTime??'99999999999999'))){v.selected=false;v.reason='提交时间不在所选窗口'}
    }
    const winners=mergeRecords(trace.versions.filter(v=>v.selected).map(v=>v.record))
    for(const v of trace.versions){
      v.winner=v.selected && winners.some(w=>sameVersion(w,v.record))
      v.returned=v.winner && (r.request.mode==='incremental' || v.record.operation!=='D')
      if(v.selected)v.reason=!v.winner?'同键的另一版本胜出':!v.returned?'最新版本为 D，快照过滤该主键':'在本次读取范围内胜出'
    }
    trace.files=source.physicalFiles.filter(f=>fileNames.has(f.fileName)).map(file=>({file,selected:trace.versions.some(v=>v.fileName===file.fileName&&v.selected),removed:false,reason:r.request!.mode==='read-optimized'&&file.type==='LOG'?'跳过 Log':op==='partition-read'&&file.partitionPath!==p.partition?'跳过其他分区':'读取当前引用'}))
    const focus=trace.versions.filter(v=>v.record.recordKey===focusKey)
    const returned=focus.find(v=>v.returned)
    trace.summary=`${r.query.mode} 返回 ${r.query.rowCount} 条记录${returned ? `，${focusKey} 金额为 ${returned.record.fields.amount}` : focus.some(v=>v.record.operation==='D')?'，删除主键不在快照结果中':''}。`
    trace.moments=[moment(.06,'先选文件',r.request.mode==='read-optimized'?'只打开 Base，Log 先被排除。':r.request.mode==='time-travel'?`找到历史 Checkpoint ${r.request.asOfInstant} 的文件引用。`:'从有效 File Slice 中选择文件，不读取灰色旧文件。'),moment(.27,'读出具体版本',`${focusKey} 的候选版本有 ${focus.filter(v=>v.selected).length} 条；查看金额、ts 和提交时间。`),moment(.52,'按同键比较版本',focus.some(v=>!v.selected)?'被跳过的版本不参与本次归并；不等于该版本不存在。':'同分区同主键按 precombine 归并，较旧版本不进入结果。'),moment(.86,'返回查询结果',trace.summary)]
    return trace
  }
  if(op==='clean'){
    trace.kind='clean'
    const keep=before.timeline.filter(i=>i.state==='COMPLETED').slice(-Math.max(1,p.retention)).map(i=>i.instantTime)
    trace.retention={count:p.retention,keepInstants:keep}
    trace.files=before.physicalFiles.map(file=>{
      const removed=!after.physicalFiles.some(f=>f.fileName===file.fileName)
      return {file,removed,selected:removed,reason:removed?'已被取代，且 supersededAt 不在本地保留集合':file.status==='ACTIVE'?'仍被当前 File Slice 引用':file.supersededAt && keep.includes(file.supersededAt)?'supersededAt 在保留集合中，暂不删除':'引擎本次没有删除该文件'}
    })
    const n=trace.files.filter(f=>f.removed).length
    trace.summary=`本次删除 ${n} 个文件；有效文件和保留窗口内的旧文件继续保留。`
    trace.moments=[moment(.06,'检查当前引用','有效文件仍在使用，不能因为文件旧就删除。'),moment(.28,'划定保留窗口',`当前教学模型保留最近 ${p.retention} 个已完成 Instant，并检查旧文件的 supersededAt。`),moment(.55,'逐个判断是否可删',`只有引擎判定的 ${n} 个候选文件进入回收区。`),moment(.86,'物理回收',trace.summary)]
    return trace
  }
  if(op==='schedule'){
    trace.kind='plan'
    const plan=after.compactionPlans.at(-1)
    trace.affectedGroups=plan?.entries.map(e=>e.fileId)??[]
    trace.summary=`计划选中 ${plan?.entries.length??0} 个 File Group；新增数据文件 ${added.length} 个。`
    trace.moments=[moment(.06,'查看各文件组的 Log','先检查哪些 File Group 具有可合并 Log。'),moment(.3,'将候选写入计划',trace.summary),moment(.58,'保存计划与输入引用','计划记录 fileId、Log 数和记录数，尚不生成新 Base。'),moment(.86,'停在 REQUESTED','请求已保存，等待执行；数据仍由原 Slice 提供。')]
    return trace
  }
  if(op==='compact'||op==='cluster'){
    trace.kind='merge'
    const usedGroups=op==='compact'?before.compactionPlans.filter(plan=>plan.state==='PLANNED').at(-1)?.entries.map(e=>e.fileId)??[]:before.fileGroups.filter(g=>!g.supersededBy).map(g=>g.fileId)
    trace.affectedGroups=usedGroups
    trace.versions=physicalVersions(before).filter(v=>before.fileGroups.some(g=>usedGroups.includes(g.fileId)&&(g.fileSlice.baseFile?.fileName===v.fileName||g.fileSlice.logFiles.some(f=>f.fileName===v.fileName))))
    const winners=mergeRecords(trace.versions.map(v=>v.record))
    for(const v of trace.versions){v.winner=winners.some(w=>sameVersion(w,v.record));v.returned=v.winner;v.reason=v.winner?'保留本键胜出版本':'被同键的胜出版本取代'}
    trace.outputFile=added.find(f=>f.type==='BASE');trace.outputRecords=trace.outputFile?fileRecords(after,trace.outputFile.fileName):[]
    trace.summary=`${trace.versions.length} 条输入版本生成 ${added.length} 个新 Base；旧文件转为 SUPERSEDED，尚未删除。`
    trace.moments=[moment(.06,op==='compact'?'读取计划与输入文件':'读取待重组文件',`选中 ${usedGroups.length} 个 File Group，逐份打开其输入文件。`),moment(.25,'把同键版本放在一起',`追踪 ${focusKey}，对比 Base / Log 中的金额和 ts。`),moment(.49,'保留胜出版本','不同主键继续保留；同键旧版本不再进入新文件。'),moment(.67,'逐行生成新 Base',`新文件展示 ${trace.outputRecords.length} 条记录，而不是把多个文件原样拼接。`),moment(.86,'切换文件引用',trace.summary)]
    return trace
  }
  if(input.length || op==='delete'){
    trace.kind=trace.hash?'index':'write'
    const prior=before.records.find(row=>row.recordKey===focusKey&&row.partitionPath===(input[0]?.partitionPath??String(input[0]?.fields.dt??p.partition)))
    const newest=after.records.find(row=>row.recordKey===focusKey&&row.partitionPath===(input[0]?.partitionPath??String(input[0]?.fields.dt??p.partition)))
    if(input[0] && (prior || op==='duplicates')){
      const a=op==='duplicates'?Number(input[0].fields.ts):prior?.preCombineValue
      const b=Number((op==='duplicates'?input.at(-1):input[0])?.fields.ts)
      trace.comparison={prior:String(a),incoming:String(b),relation:b>Number(a)?'>':b<Number(a)?'<':'=',result:`引擎保留金额 ${newest?.fields.amount}`}
    }
    const mode=outputFile?.type==='LOG'?'追加 Log':outputFile?.type==='BASE'?'生成 Base':op==='stale'?'忽略较旧输入':'不生成文件'
    trace.summary=op==='delete'?`${focusKey} 写入 D 标记；物理文件仍在，快照不再返回它。`:op==='stale'?`输入 ts=${input[0]?.fields.ts}，已有 ts=${prior?.preCombineValue}；引擎保持原值。`:`${mode}：新文件 ${outputRecords.length} 条${copiedKeys.length?`，其中 ${copiedKeys.length} 条原样保留`:''}。`
    trace.moments=[moment(.05,'看清输入记录',op==='delete'?`本次删除 ${focusKey}，不是删除整个文件。`:`输入主键 ${focusKey}，金额 ${input[0]?.fields.amount}，ts=${input[0]?.fields.ts}。`),moment(.23,'找到实际写入位置',prior?`主键已存在，定位到 ${prior.partitionPath} 的已有 File Group。`:'主键在当前分区不存在，走新增路径。'),moment(.44,op==='duplicates'?'比较同批次候选':'比较记录版本',op==='duplicates'?`${input.length} 条同键输入按 precombine 比较，结果保留金额 ${newest?.fields.amount}。`:prior?`已有金额 ${prior.fields.amount}，已有 ts=${prior.preCombineValue}；和输入版本比较。`:'没有旧记录需要更新，不应重写无关主键。'),moment(.65,mode,trace.summary),moment(.86,'核对提交与保留的数据',op==='stale'?`旧输入未写入文件；本地引擎仍记录 ${after.timeline.length-before.timeline.length} 个空提交，不能把空提交当成数据更新。`:outputFile?.type==='LOG'?'Base 中的旧值仍不变；最新值现在位于 Log。':`输出中保留 ${copiedKeys.join('、')||'本次写入'}；被取代的旧文件仍待 Cleaner。`)]
    return trace
  }
  if(op==='fail'||op==='rollback'||op==='archive'){
    trace.kind='transaction';trace.summary=op==='fail'?'观察未完成事务，而不是将作业日志成功当成提交成功。':op==='rollback'?'撤销引擎识别的未完成事务，保留其他已完成提交。':`本次将 ${after.archivedInstants.length-before.archivedInstants.length} 个 Instant 移入 Archive，数据文件不变。`
    trace.moments=[moment(.06,'核对目标与边界','查看要处理的真实 Instant 和当前文件引用。'),moment(.42,'处理事务元数据',trace.summary),moment(.86,'检查实际返回状态',trace.summary)]
  }
  return trace
}
