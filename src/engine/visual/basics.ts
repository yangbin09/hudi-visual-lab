import type { HudiRecord, HudiTableState } from '@/models/hudi'
import { runQuery } from '@/engine/queries'
function sample(records:HudiRecord[],key:string){const r=records.find(r=>r.recordKey===key)??records[0];return r?`${r.recordKey} · ¥ ${r.fields.amount}`:'没有记录'}
/** Projections of actual engine state; presentation labels never create file versions. */
export function activeGroup(state:HudiTableState){return state.fileGroups.find(g=>!g.supersededBy)}
export function sliceFiles(state:HudiTableState){const slice=activeGroup(state)?.fileSlice;return slice?[...(slice.baseFile?[slice.baseFile]:[]),...slice.logFiles]:[]}
export function focusAmount(state:HudiTableState,key:string,mode:'snapshot'|'read-optimized'='snapshot'){return runQuery(state,{mode,includeMetaFields:true}).rows.find(r=>String(r._hoodie_record_key)===key)?.amount}
export function fileVersions(state:HudiTableState,key='1001'){
 const group=activeGroup(state)
 if(!group)return []
 const states=[...state.checkpoints.map(c=>c.state),state]
 const found=new Map<string,{fileName:string;instant:string;kind:'Base'|'Log';version?:number;baseInstant:string|null;active:boolean;sample:string}>()
 for(const snapshot of states){const g=snapshot.fileGroups.find(g=>g.fileId===group.fileId);if(!g)continue;const s=g.fileSlice
  if(s.baseFile)found.set(s.baseFile.fileName,{fileName:s.baseFile.fileName,instant:s.baseFile.instantTime,kind:'Base',baseInstant:s.baseInstantTime,active:false,sample:sample(s.baseFile.records,key)})
  for(const log of s.logFiles)found.set(log.fileName,{fileName:log.fileName,instant:log.instantTime,kind:'Log',version:log.version,baseInstant:s.baseInstantTime,active:false,sample:sample(log.records,key)})
 }
 const active=new Set(sliceFiles(state).map(f=>f.fileName))
 return [...found.values()].map(f=>({...f,active:active.has(f.fileName)})).sort((a,b)=>a.instant.localeCompare(b.instant))
}
