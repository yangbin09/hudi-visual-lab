import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { applyAction } from '@/engine/core/applyAction'
import { createCowState, createMorState } from '@/experiments/basics/B02CowVsMor'
import type { HudiTableState } from '@/models/hudi'
import type { SimulationAction } from '@/models/actions'
import type { SimulationEvent } from '@/models/simulation'

export interface Scene { cow: HudiTableState; mor: HudiTableState }
export type Operation = 'update' | 'schedule' | 'compact' | 'clean' | 'snapshot' | 'failure'
export interface ComparisonBookmark { operations: {kind: Operation; amount: number}[]; position: number; nextAmount?: number }
export interface Sequence { kind: Operation; before: Scene; after: Scene; events: SimulationEvent[]; amount: number; actions: Partial<Record<'cow'|'mor',SimulationAction>>; captions: string[] }
function initial(): Scene {
  const mor = createMorState()
  const plan = applyAction(mor, { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 })
  const base = applyAction(plan.nextState as HudiTableState, { type: 'RUN_COMPACTION' })
  if (!plan.success || !base.success) throw new Error('无法通过引擎建立 MOR Base')
  return { cow: createCowState(), mor: base.nextState as HudiTableState }
}
export function useVisualTimeline(topicId = 'B02') {
  const origin = initial()
  const sequences = shallowRef<Sequence[]>([])
  const index = ref(-1)
  const position = ref(0)
  const playing = ref(false)
  const speed = ref(1)
  const reduced = ref(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const onReduce = (e: MediaQueryListEvent) => { reduced.value = e.matches; if (e.matches) skip() }
  media.addEventListener('change', onReduce)
  const sequence = computed(() => sequences.value[index.value])
  const duration = computed(() => sequence.value?.captions.length ?? 1)
  const step = computed(() => Math.min(Math.floor(position.value), duration.value - 1))
  const settled = computed(() => position.value >= duration.value)
  // Output files and Timeline always switch together to the exact engine snapshot.
  const scene = computed(() => !sequence.value ? origin : position.value >= duration.value - 1 ? sequence.value.after : sequence.value.before)
  const caption = computed(() => sequence.value?.captions[step.value] ?? (topicId==='B02'?'更新一条记录，展开 COW 如何复制旧行并生成完整新 Base。':'连续更新同一主键，观察 Log 累积和两种读取结果。'))
  let raf = 0
  let previous = 0
  function tick(now: number) {
    if (!playing.value) return
    if (previous) position.value = Math.min(duration.value, position.value + (now - previous) / 3600 * speed.value)
    previous = now
    if (settled.value) { playing.value = false; previous = 0; return }
    raf = requestAnimationFrame(tick)
  }
  function pause() { playing.value = false; cancelAnimationFrame(raf); previous = 0 }
  function play() {
    if (!sequence.value) return
    if (settled.value) position.value = 0
    if (reduced.value) { skip(); return }
    if (playing.value) return
    playing.value = true; previous = 0; raf = requestAnimationFrame(tick)
  }
  function skip() { pause(); position.value = duration.value }
  function next() { pause(); position.value = Math.min(duration.value, Math.floor(position.value) + 1) }
  function back() { pause(); position.value = Math.max(0, Math.ceil(position.value) - 1) }
  function reset() { pause(); sequences.value = []; index.value = -1; position.value = 0 }
  function run(kind: Operation, amount = 200) {
    if (sequence.value && !settled.value) return
    pause()
    const before = scene.value
    let cow = before.cow, mor = before.mor
    const events: SimulationEvent[] = []
    const actions: Partial<Record<'cow'|'mor',SimulationAction>> = {}
    function apply(side: 'cow' | 'mor', action: SimulationAction) {
      actions[side]=action
      const result = applyAction(side === 'cow' ? cow : mor, action)
      events.push(...result.events)
      if (side === 'cow') cow = result.nextState as HudiTableState
      else mor = result.nextState as HudiTableState
    }
    const captions: Record<Operation, string[]> = {
      update: ['同一条更新记录，进入两侧的 Hudi Writer。', '按主键 1001 定位已有的 File Group。', 'Parquet 不原地替换一行：COW 要复制未修改的行，MOR 只追加更新。', 'COW 复制 1002、1003 并写入新 1001；MOR 的 Base 不动，Log 只写 1001。', '提交完成：点击文件，对比新旧记录。灰色文件仍在存储中。'],
      schedule: ['读取 MOR 当前 File Slice 中的 Log。', '生成合并计划；此时还没有改写数据文件。', 'Timeline 进入 REQUESTED，等待执行。'],
      compact: ['读取已生成的 Compaction Plan。', 'Base 和 Log 中的记录流入合并过程。', '按主键与 precombine 归并记录。', '生成新的 Base，等待提交。', '合并完成；旧 Base 与 Log 仍等待 Cleaner 回收。'],
      failure: ['读取 Compaction Plan。', '模拟 Spark 执行失败，停止生成新 Base。', '查看引擎返回的未完成事务；没有成功合并的文件。'],
      clean: ['检查旧版本和提交保留窗口。', '只删除引擎判断为可回收的物理文件。', '清理完成；当前 File Slice 的记录保持不变。'],
      snapshot: ['Snapshot 查询读取当前 File Slice。', 'COW 直接读 Base；MOR 归并 Base 与 Log。', '两侧返回同样的最新记录；读优化查询只读取 Base。'],
    }
    if (kind === 'update') {
      const action: SimulationAction = { type: 'UPSERT_RECORDS', records: [{ recordKey: '1001', fields: { ...mor.records.find(r => r.recordKey === '1001')?.fields, amount, ts: 20240101140000 + sequences.value.length } }] }
      apply('cow', action); apply('mor', action)
    } else if (kind === 'schedule') apply('mor', { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 })
    else if (kind === 'compact' || kind === 'failure') apply('mor', { type: 'RUN_COMPACTION', failWith: kind === 'failure' ? 'SPARK_TASK_FAILED' : 'NONE' })
    else if (kind === 'clean') { apply('cow', { type: 'RUN_CLEAN', commitsRetained: 1 }); apply('mor', { type: 'RUN_CLEAN', commitsRetained: 1 }) }
    if(topicId==='B02'){
      captions.update=['更新主键 1001：先定位它所属的 File Group。','打开旧 Base，保留未修改的记录，比较更新行的 ts。','较新的输入替换同键旧值；其余行保持原值，但也要写入新文件。','逐行复制 1002、1003，和新 1001 一起生成完整的新 Base。','完成提交，当前引用切换到新 Base；旧文件仍保留，等待 Cleaner。']
      captions.snapshot=['从最新完成的提交选择当前 Base。','COW 直接读取 Base 中已合并的完整记录。','读取返回当前已提交金额；不会把旧文件中的版本重复读入。']
    }else{
      captions.update=['输入主键 1001 的新版本，先定位原来的 File Group。','Base 保持原样，本次更新准备写入 Log。','增量只携带变化的记录，不复制 Base 中的其他行。','把新版本追加到 Log，提交前仍不能作为最新快照返回。','完成 Delta Commit：Snapshot 归并 Base 与 Log；Read Optimized 仍只读 Base。']
      captions.snapshot=['分别观察 Snapshot 与 Read Optimized 两条读取路径。','Snapshot 按主键和 ts 归并 Base 与 Log；Read Optimized 跳过 Log。','读取文件范围不同，所以未合并更新时，两种读法可能返回不同金额。']
    }
    const failed = events.find(e => !e.success)
    const finalCaptions = failed ? [captions[kind][0]!, failed.error ?? failed.explanation] : captions[kind]
    sequences.value = [...sequences.value.slice(0, index.value + 1), { kind, before, after: { cow, mor }, events, amount, actions, captions: finalCaptions }]
    index.value++; position.value = 0; play()
  }
  function bookmark(): ComparisonBookmark {
    return {operations:sequences.value.slice(0,index.value+1).map(s=>({kind:s.kind,amount:s.amount})),position:position.value}
  }
  function restore(saved: ComparisonBookmark) {
    reset()
    // Replay the action history against the same deterministic engine, never a stored table blob.
    for(const op of saved.operations){run(op.kind,op.amount);skip()}
    pause();position.value=Math.max(0,Math.min(duration.value,saved.position))
  }
  onBeforeUnmount(() => { pause(); media.removeEventListener('change', onReduce) })
  return { bookmark, restore, scene, sequences, sequence, position, duration, step, settled, playing, speed, reduced, caption, run, play, pause, skip, next, back, reset }
}
