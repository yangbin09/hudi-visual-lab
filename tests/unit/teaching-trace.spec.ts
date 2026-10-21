import { describe, expect, it } from 'vitest'
import { VISUAL_LESSONS } from '@/experiments/visual/lessons'
import { buildLessonRun, defaultParameters } from '@/engine/visual/scenarios'
import { teachingHash, teachingHashSteps, bucketOf } from '@/engine/indexes/bucket'
const run=(id:string,overrides={})=>buildLessonRun(VISUAL_LESSONS[id]!,{...defaultParameters(VISUAL_LESSONS[id]!),...overrides})

describe('教学细节必须解释实际执行的数据，而不是编一个可看的过程',()=>{
  it('Insert 展示实际新增的 1004，不能把设置中的更新主键 1001 当成插入输入',()=>{
    const trace=run('W01').frames.find(f=>f.step.operation==='insert')!.teaching!
    expect(trace.focusKey).toBe('1004')
    expect(trace.input.map(r=>r.recordKey)).toEqual(['1004'])
    expect(trace.sourceRecords).toHaveLength(0)
    expect(trace.outputRecords.map(r=>r.recordKey)).toEqual(['1004'])
  })
  it('同一条更新：COW 实际复制两条未改记录，MOR 只写一条到 Log',()=>{
    const cow=run('W02').frames.find(f=>f.step.operation==='upsert')!.teaching!
    const mor=run('W02',{tableType:'MERGE_ON_READ'}).frames.find(f=>f.step.operation==='upsert')!.teaching!
    expect(cow.outputFile?.type).toBe('BASE')
    expect(cow.copiedKeys.sort()).toEqual(['1002','1003'])
    expect(cow.outputRecords).toHaveLength(3)
    expect(mor.outputFile?.type).toBe('LOG')
    expect(mor.outputRecords.map(r=>r.recordKey)).toEqual(['1001'])
    expect(mor.sourceRecords.find(r=>r.recordKey==='1001')?.fields.amount).toBe(100.5)
    expect(mor.outputRecords[0]?.fields.amount).toBe(200)
    expect(mor.copiedKeys).toEqual([])
  })
  it('乱序旧消息没有新文件，不能有输入流入新文件的动画',()=>{
    const frame=run('W08').frames.find(f=>f.step.operation==='stale')!
    expect(frame.teaching!.input[0]?.fields.amount).toBe(1)
    expect(frame.teaching!.outputFile).toBeUndefined()
    expect(frame.teaching!.outputRecords).toEqual([])
    expect(frame.after.physicalFiles).toEqual(frame.before.physicalFiles)
    expect(frame.after.timeline).toHaveLength(frame.before.timeline.length+1)
    expect(frame.after.timeline.at(-1)?.files).toEqual([])
    expect(frame.after.timeline.at(-1)?.extraMetadata?.recordsChanged).toBe(0)
    expect(frame.teaching!.moments.at(-1)?.explanation).toContain('空提交')
  })
  it('同批次候选和最终胜出值全部来自真实输入及输出',()=>{
    const t=run('W08').frames.find(f=>f.step.operation==='duplicates')!.teaching!
    expect(t.input.map(r=>r.fields.amount)).toEqual([150,200])
    expect(t.outputRecords.find(r=>r.recordKey==='1001')?.fields.amount).toBe(200)
    expect(t.moments.find(m=>m.title==='比较同批次候选')?.explanation).toContain('200')
  })
  it('Compaction 对相同主键展示淘汰旧版本，并保留其他主键',()=>{
    const t=run('S04').frames.find(f=>f.step.operation==='compact')!.teaching!
    const versions=t.versions.filter(v=>v.record.recordKey==='1001')
    expect(versions.map(v=>[v.record.fields.amount,v.winner])).toEqual([[100.5,false],[200,true]])
    expect(t.outputRecords.map(r=>r.recordKey).sort()).toEqual(['1001','1002','1003'])
    expect(t.outputFile?.type).toBe('BASE')
  })
  it('Read Optimized 跳过新 Log，所以旧 Base 值胜出；Snapshot 才选新值',()=>{
    const frames=run('Q02').frames
    const ro=frames.find(f=>f.step.operation==='optimized')!.teaching!
    const ss=frames.find(f=>f.step.operation==='snapshot')!.teaching!
    expect(ro.versions.find(v=>v.source==='LOG'&&v.record.recordKey==='1001')?.selected).toBe(false)
    expect(ro.versions.find(v=>v.record.recordKey==='1001'&&v.returned)?.record.fields.amount).toBe(100.5)
    expect(ss.versions.find(v=>v.record.recordKey==='1001'&&v.returned)?.record.fields.amount).toBe(200)
  })
  it('Time Travel 展开历史文件记录，不拿当前值冒充旧版本',()=>{
    const t=run('Q04').frames.find(f=>f.step.operation==='history')!.teaching!
    expect(t.versions.find(v=>v.record.recordKey==='1001'&&v.returned)?.record.fields.amount).toBe(100.5)
  })
  it('同一 D 标记在 Snapshot 被过滤，在 Incremental 中返回',()=>{
    const frames=run('W03').frames
    expect(frames.find(f=>f.step.operation==='snapshot')!.teaching!.versions.some(v=>v.record.operation==='D'&&v.returned)).toBe(false)
    expect(frames.find(f=>f.step.operation==='incremental')!.teaching!.versions.some(v=>v.record.operation==='D'&&v.returned)).toBe(true)
  })
  it('Cleaner 的逐文件删除判断必须与引擎实际删除集合一致',()=>{
    const f=run('S06').frames.find(f=>f.step.operation==='clean')!, t=f.teaching!
    expect(t.files.filter(x=>x.removed).map(x=>x.file.fileName).sort()).toEqual(f.removed.map(x=>x.fileName).sort())
    expect(t.files.filter(x=>x.file.status==='ACTIVE').every(x=>!x.removed)).toBe(true)
    expect(t.files.filter(x=>x.file.supersededAt&&t.retention!.keepInstants.includes(x.file.supersededAt)).every(x=>!x.removed)).toBe(true)
  })
  it('哈希展开与实际桶一致；跨分区新增不能错误定位到另一个分区的旧 Base',()=>{
    const t=run('I03',{recordKey:'alpha',bucketCount:8}).frames.find(f=>f.step.operation==='bucket-write')!.teaching!
    expect(t.hash).toEqual({key:'alpha',value:teachingHash('alpha'),count:8,bucket:bucketOf('alpha',8)})
    const cross=run('I04').frames.find(f=>f.step.operation==='cross-partition')!.teaching!
    expect(cross.sourceFile).toBeUndefined()
  })
  it('逐字符教学步骤与原有哈希使用同一条32位计算路径',()=>{
    for(const key of ['1001','alpha','订单甲','😀', 'x'.repeat(40)]){
      const walk=teachingHashSteps(key)
      expect(walk.value).toBe(teachingHash(key))
      expect(walk.steps).toHaveLength(key.length)
      let h=5381
      for(const step of walk.steps){
        expect(step.before).toBe(h)
        expect(step.code).toBe(step.character.charCodeAt(0))
        h=((h<<5)+h+step.code)|0
        expect(step.after).toBe(h)
      }
      expect(Math.abs(h)).toBe(walk.value)
    }
  })
  for(const id of Object.keys(VISUAL_LESSONS)){
    it(`${id}：任何查询版本的去留均能核对到实际查询结果`,()=>{
      for(const frame of run(id).frames){
        const t=frame.teaching!
        if(!t.result)continue
        const visual=t.versions.filter(v=>v.returned).map(v=>`${v.record.fields.id}|${v.record.fields.amount}|${v.record.fields.dt}`).sort()
        const actual=t.result.rows.map(r=>`${r.id}|${r.amount}|${r.dt}`).sort()
        expect(visual).toEqual(actual)
      }
    })
  }
})
