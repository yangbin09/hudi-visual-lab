import { describe, expect, it } from 'vitest'
import { CATALOG } from '@/experiments/catalog'
import { VISUAL_LESSONS } from '@/experiments/visual/lessons'
import { buildLessonRun, defaultParameters, fileRecords } from '@/engine/visual/scenarios'
import { runQuery } from '@/engine/queries'
import { bucketOf } from '@/engine/indexes/bucket'

describe('全部动画场景覆盖与执行一致性', () => {
  it('80 个主题都有专属路由与步骤，没有落回未实现页面', () => {
    expect(Object.keys(VISUAL_LESSONS)).toHaveLength(78)
    expect(CATALOG.filter(e=>e.id!=='B02'&&e.id!=='B03').filter(e=>!VISUAL_LESSONS[e.id])).toEqual([])
    expect(new Set(Object.values(VISUAL_LESSONS).map(l=>l.steps.map(s=>s.caption).join('|'))).size).toBe(78)
  })
  for (const lesson of Object.values(VISUAL_LESSONS)) {
    it(`${lesson.id}：初始化、执行、拒绝边界与文件引用可核对`, () => {
      const p = defaultParameters(lesson)
      const run = buildLessonRun(lesson,p)
      expect(run.frames.length).toBeGreaterThanOrEqual(4)
      let previous = run.initial
      for(const frame of run.frames){
        expect(frame.before).toBe(previous)
        if(frame.error){
          expect(['invalid-bulk','invalid-schema']).toContain(frame.step.operation)
          expect(frame.after).toBe(frame.before)
        }
        if(lesson.model==='concept')expect(frame.after).toBe(run.initial)
        if(!frame.step.operation)expect(frame.after).toBe(frame.before)
        if(frame.query)expect(frame.after).toBe(frame.before)
        const current = frame.after
        for(const group of current.fileGroups.filter(g=>!g.supersededBy)){
          for(const file of [group.fileSlice.baseFile,...group.fileSlice.logFiles].filter(Boolean)){
            expect(current.physicalFiles.find(pf=>pf.fileName===file!.fileName)?.status).toBe('ACTIVE')
            expect(fileRecords(current,file!.fileName)).toEqual(file!.records)
          }
        }
        expect(new Set(current.timeline.map(i=>i.instantTime)).size).toBe(current.timeline.length)
        previous=current
      }
    })
  }
  it('Snapshot、Read Optimized、Time Travel 的金额具有实际差异', () => {
    const lesson=VISUAL_LESSONS.Q02!, run=buildLessonRun(lesson,defaultParameters(lesson))
    const optimized=run.frames.find(f=>f.step.operation==='optimized')!.query!
    const snapshot=run.frames.find(f=>f.step.operation==='snapshot')!.query!
    expect(optimized.rows.find(r=>r.id===1001)?.amount).toBe(100.5)
    expect(snapshot.rows.find(r=>r.id===1001)?.amount).toBe(200)
    const history=buildLessonRun(VISUAL_LESSONS.Q04!,defaultParameters(VISUAL_LESSONS.Q04!)).frames.find(f=>f.query?.mode==='time-travel')!.query!
    expect(history.rows.find(r=>r.id===1001)?.amount).toBe(100.5)
  })
  it('改变桶数重新建立映射，所有实际文件组与教学函数一致', () => {
    const lesson=VISUAL_LESSONS.I03!
    for(const count of [1,3,8,12]){
      const p={...defaultParameters(lesson),bucketCount:count,recordKey:'alpha'}
      const run=buildLessonRun(lesson,p), end=run.frames.at(-1)!.after
      const group=end.fileGroups.find(g=>!g.supersededBy&&[...(g.fileSlice.baseFile?.records??[]),...g.fileSlice.logFiles.flatMap(l=>l.records)].some(r=>r.recordKey==='alpha'))!
      expect(group.bucket).toBe(bucketOf('alpha',count))
    }
  })
  it('Clustering 不改变业务快照，Archive 不删数据文件', () => {
    for(const id of ['S10','A01']){
      const run=buildLessonRun(VISUAL_LESSONS[id]!,defaultParameters(VISUAL_LESSONS[id]!))
      const normalize=(rows:Record<string,unknown>[])=>rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)))
      expect(normalize(runQuery(run.frames.at(-1)!.after,{mode:'snapshot'}).rows)).toEqual(normalize(runQuery(run.initial,{mode:'snapshot'}).rows))
    }
    const run=buildLessonRun(VISUAL_LESSONS.S07!,defaultParameters(VISUAL_LESSONS.S07!))
    expect(run.frames.at(-1)!.after.physicalFiles).toEqual(run.initial.physicalFiles)
    expect(run.frames.at(-1)!.after.archivedInstants.length).toBeGreaterThan(0)
  })
})
