import { describe, expect, it } from 'vitest'
import { buildLessonRun, defaultParameters } from '@/engine/visual/scenarios'
import { activeGroup, fileVersions, focusAmount, sliceFiles } from '@/engine/visual/basics'
import { visualLesson } from '@/experiments/visual/lessons'
import { BASIC_STORIES } from '@/experiments/visual/basics-story'
const run=(id:string)=>{const lesson=visualLesson(id)!;return buildLessonRun(lesson,defaultParameters(lesson))}
describe('基础原理场景与实际文件版本一致',()=>{
 it('每个普通基础课有逐步编写的教学节拍',()=>{
  for(const id of Object.keys(BASIC_STORIES)){const lesson=visualLesson(id)!;expect(BASIC_STORIES[id]).toHaveLength(lesson.steps.length);for(const step of lesson.steps){expect(step.moments).toHaveLength(3);expect(new Set(step.moments!.map(m=>m.explanation)).size).toBe(3)}}
 })
 it('B05 连续更新同一主键，两个 Log 同属一个 File Group，且有不同金额',()=>{
  const r=run('B05'),s=r.frames[2]!.after,g=activeGroup(s)!
  expect(s.fileGroups.filter(g=>!g.supersededBy)).toHaveLength(1)
  expect(g.fileSlice.logFiles.map(l=>l.version)).toEqual([1,2])
  expect(g.fileSlice.logFiles.map(l=>l.records[0]!.fields.amount)).toEqual([200,300])
  expect(fileVersions(s).map(f=>f.kind)).toEqual(['Base','Log','Log'])
  expect(new Set(fileVersions(s).map(f=>f.baseInstant)).size).toBe(1)
  expect(focusAmount(s,'1001')).toBe(300);expect(focusAmount(s,'1001','read-optimized')).toBe(100.5)
 })
 it('Compaction 保持 File ID，前移 Slice 边界，但保留旧物理文件',()=>{
  const r=run('B05'),before=r.frames[4]!.before,after=r.frames[4]!.after
  expect(activeGroup(after)!.fileId).toBe(activeGroup(before)!.fileId)
  expect(sliceFiles(before)).toHaveLength(3);expect(sliceFiles(after)).toHaveLength(1)
  expect(activeGroup(after)!.fileSlice.baseInstantTime).not.toBe(activeGroup(before)!.fileSlice.baseInstantTime)
  const versions=fileVersions(after)
  expect(versions).toHaveLength(4);expect(versions.filter(f=>f.active)).toHaveLength(1)
  expect(after.physicalFiles.filter(f=>f.status==='SUPERSEDED')).toHaveLength(3)
  expect(focusAmount(after,'1001','read-optimized')).toBe(300)
 })
 it('B06 记录身份按不同分区区分，B07 历史版本没有随更新变动',()=>{
  const identity=run('B06').frames.at(-1)!.after.records.filter(r=>r.recordKey==='1001')
  expect(identity).toHaveLength(2);expect(new Set(identity.map(r=>r.hoodieKey)).size).toBe(2)
  const mvcc=run('B07');expect(focusAmount(mvcc.initial,'1001')).toBe(100.5);expect(focusAmount(mvcc.frames[1]!.after,'1001')).toBe(200)
  expect(mvcc.frames[3]!.query!.rows.find(r=>String(r.id)==='1001')!.amount).toBe(100.5)
 })
})
