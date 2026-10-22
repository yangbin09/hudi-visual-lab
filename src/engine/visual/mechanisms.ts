import type { LessonParameters } from '@/experiments/visual/types'

export const MECHANISM_IDS = ['F04', 'A04']
/** Small, deterministic teaching models. They neither execute nor assert an r26 protocol. */
export function checkpointTrace(boundary = 102) {
  const messages = [101, 102, 103, 104].map(offset => ({offset,key:`订单 ${offset}`,amount:offset-90}))
  return {boundary,messages,confirmed:messages.filter(m=>m.offset<=boundary),replay:messages.filter(m=>m.offset>boundary)}
}
export function conflictTrace(target: 'same'|'different' = 'same', retry = false) {
  const same = target === 'same'
  const readVersion = 7
  const committedVersion = same ? 8 : 7
  const conflict = readVersion !== committedVersion
  return {
    target:same?'FG-A':'FG-B',key:same?'1001':'2001',readVersion,committedVersion,conflict,
    accepted:!conflict || retry,
    retryReadVersion:retry?committedVersion:undefined,
    outputVersion:!conflict || retry ? committedVersion+1 : undefined,
    amount:!conflict || retry ? 300 : 200,
  }
}
export function mechanismCaption(id:string,p:LessonParameters,stage:number,progress:number):string {
  if(id==='F04'){
    const t=checkpointTrace(p.checkpointOffset)
    return [
      '四条具体消息按 offset 排序进入缓冲；收到消息和检查点已确认是两个不同状态。',
      `本案例把检查点确认边界设置为 ${t.boundary}；确认集合是 ${t.confirmed.map(m=>m.offset).join('、')}。`,
      `收到 104 后发生示例故障；检查点仍停在 ${t.boundary}，后收到的消息不能当成已确认。`,
      progress<.6?`比较每个 offset 与 ${t.boundary}：边界内跳过，边界后的消息进入恢复重放。`:`恢复重放 ${t.replay.map(m=>m.offset).join('、')}；改变上方确认边界，对比重放集合。`,
    ][stage]??''
  }
  const t=conflictTrace(p.writerTarget,p.occRetry)
  return [
    '两个写者准备候选更新：A 写 1001=200，B 写自己的目标键=300。候选还不是已提交数据。',
    `A 与 B 都读取各自目标的 v7；B 目标为 ${t.target}。先记住各自的读版本。`,
    'A 先提交，FG-A 从 v7 变为 v8；B 的候选仍基于它先前读到的 v7。',
    progress<.6?`B 提交前比较：读版本 v7，当前目标 ${t.target} 为 v${t.committedVersion}。`:
      t.conflict&&!p.occRetry?'同目标的版本已变化，旧候选被拦截。点击“读取新版本并重试”，观察下一次校验。':
      p.occRetry?`B 重新读取 v${t.retryReadVersion}，重建候选后通过校验，产生 v${t.outputVersion}。`:
      `B 写的是另一文件组，目标仍是 v7，本案例通过校验并产生 v${t.outputVersion}。`,
  ][stage]??''
}
