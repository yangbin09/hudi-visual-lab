import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { CATALOG } from '@/experiments/catalog'
import { visualLesson } from '@/experiments/visual/lessons'
import { lessonQuiz, ASSESSED_TOPIC_IDS } from '@/experiments/visual/quiz'
import { ASSESSMENT_VERSION } from '@/experiments/visual/assessment-version'
import { buildLessonRun, defaultParameters } from '@/engine/visual/scenarios'
import { runQuery } from '@/engine/queries'
import { checkpointTrace, conflictTrace } from '@/engine/visual/mechanisms'
import { useLessonStore } from '@/app/stores/lesson'

describe('理解验证覆盖全部主题',()=>{
  it('每课有三道有效题，全部选第一项不会通过，也不把步骤标题当答案',()=>{
    expect([...ASSESSED_TOPIC_IDS].sort()).toEqual(CATALOG.map(e=>e.id).sort())
    for(const entry of CATALOG){
      const lesson=visualLesson(entry.id)
      const run=lesson?buildLessonRun(lesson,defaultParameters(lesson)):undefined
      const questions=lessonQuiz(entry.id,lesson,run)
      expect(questions,entry.id).toHaveLength(3)
      expect(new Set(questions.map(q=>q.id)).size).toBe(3)
      for(const q of questions){
        expect(new Set(q.options.map(o=>o.text)).size).toBe(3)
        expect(q.options.filter(o=>q.answerIds.includes(o.id))).toHaveLength(1)
        expect(q.explanation.length).toBeGreaterThan(8)
        expect(q.prompt).not.toMatch(/^第 \d+ 步/)
      }
      expect(questions.filter(q=>q.answerIds.includes(q.options[0]!.id)).length,entry.id).toBe(1)
    }
  })
  it('结果题使用本次参数重建的真实终态，不依赖固定记录数',()=>{
    const lesson=visualLesson('W03')!
    const p={...defaultParameters(lesson),recordKey:'不存在的键'}
    const run=buildLessonRun(lesson,p)
    const q=lessonQuiz('W03',lesson,run)[1]!
    // The final query here is incremental, not the current full snapshot.
    expect(runQuery(run.frames.at(-1)!.after,{mode:'snapshot'}).rowCount).toBe(3)
    expect(run.frames.at(-1)!.query!.rowCount).toBe(0)
    expect(q.options.find(o=>q.answerIds.includes(o.id))!.text).toBe('0 条')
  })
  it('分区查询题随参数改变结果，不能用全表 Snapshot 代替最后查询',()=>{
    const lesson=visualLesson('Q06')!
    for(const [partition,count] of [['2024-01-01',3],['2020-01-01',5]] as const){
      const run=buildLessonRun(lesson,{...defaultParameters(lesson),partition})
      const q=lessonQuiz('Q06',lesson,run)[1]!
      expect(run.frames.filter(f=>f.query).at(-1)!.query!.rowCount).toBe(count)
      expect(q.options.find(o=>q.answerIds.includes(o.id))!.text).toBe(`${count} 条`)
    }
  })

})

describe('教学机制的条件与结果',()=>{
  it.each([101,102,103])('确认边界 %i 之后才重放，每条消息恰好属于一个集合',(offset)=>{
    const t=checkpointTrace(offset)
    expect(t.confirmed.every(m=>m.offset<=offset)).toBe(true)
    expect(t.replay.every(m=>m.offset>offset)).toBe(true)
    expect([...t.confirmed,...t.replay].map(m=>m.offset)).toEqual([101,102,103,104])
  })
  it('同文件组旧候选冲突；重读新版本或不同目标改变结果',()=>{
    expect(conflictTrace('same',false)).toMatchObject({conflict:true,accepted:false,amount:200,outputVersion:undefined})
    expect(conflictTrace('same',true)).toMatchObject({accepted:true,retryReadVersion:8,outputVersion:9,amount:300})
    expect(conflictTrace('different',false)).toMatchObject({conflict:false,accepted:true,committedVersion:7,outputVersion:8})
  })
})

describe('学习进度可信度与续播',()=>{
  beforeEach(()=>{localStorage.clear();setActivePinia(createPinia())})
  it('旧自动题的成绩失效，保留访问与观看记录',()=>{
    localStorage.setItem('hudi-lab-lesson-progress',JSON.stringify({W02:{visited:true,watched:true,mastered:true,quizScore:100,position:2.44}}))
    expect(useLessonStore().entry('W02')).toMatchObject({visited:true,watched:true,mastered:false,quizScore:0,position:2.44})
  })
  it('保存并恢复精确位置、输入和有效自测版本',()=>{
    const store=useLessonStore(),parameters={...defaultParameters(visualLesson('W02')!),amount:750}
    store.saveBookmark('W02',{position:2.44,step:2,parameters,jobIndex:'BUCKET'})
    store.setQuizScore('W02',67,true)
    setActivePinia(createPinia())
    expect(useLessonStore().entry('W02')).toMatchObject({position:2.44,parameters:{amount:750},jobIndex:'BUCKET',mastered:true,assessmentVersion:ASSESSMENT_VERSION})
  })
  it('损坏的参数和比较历史不进入执行引擎',()=>{
    localStorage.setItem('hudi-lab-lesson-progress',JSON.stringify({W02:{parameters:{recordKey:null},comparison:{operations:[{kind:'arbitrary'}],position:0},position:'invalid'}}))
    expect(useLessonStore().entry('W02')).toMatchObject({parameters:undefined,comparison:undefined,position:0})
  })
  it('原理题未通过不能靠其他题获得掌握，平均分包含零分尝试',()=>{
    const store=useLessonStore()
    store.setQuizScore('W02',67,false)
    expect(store.entry('W02').mastered).toBe(false)
    store.setQuizScore('W02',100,true)
    store.setQuizScore('W03',0,false)
    expect(store.averageScore).toBe(50)
  })

})
