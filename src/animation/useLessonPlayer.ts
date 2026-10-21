import { computed, onBeforeUnmount, ref } from 'vue'
import type { LessonRun } from '@/engine/visual/scenarios'

/** One clock drives all SVG geometry. Pause and seek therefore freeze every moving object. */
export function useLessonPlayer(run: () => LessonRun) {
  const position = ref(0), playing = ref(false), started = ref(false), speed = ref(1)
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const reduced = ref(media.matches)
  const total = computed(() => run().frames.length)
  const current = computed(() => Math.min(Math.floor(position.value), total.value - 1))
  const fraction = computed(() => position.value >= total.value ? 1 : Math.round((position.value % 1) * 1e6) / 1e6)
  const frame = computed(() => run().frames[current.value]!)
  const moments = computed(() => frame.value.step.moments ?? frame.value.teaching?.moments ?? [])
  const committed = computed(() => fraction.value >= .82)
  const state = computed(() => committed.value ? frame.value.after : frame.value.before)
  const done = computed(() => position.value >= total.value)
  let raf = 0, previous = 0
  function pause() { playing.value = false; previous = 0; cancelAnimationFrame(raf) }
  function tick(time: number) {
    if (!playing.value) return
    if (previous) position.value = Math.min(total.value, position.value + (time - previous) / (moments.value.length ? moments.value.length * 1900 : 2600) * speed.value)
    previous = time
    if (done.value) { pause(); return }
    raf = requestAnimationFrame(tick)
  }
  function play() {
    if (done.value) position.value = 0
    started.value = true
    if (reduced.value) { next(); return }
    if (playing.value) return
    playing.value = true; previous = 0; raf = requestAnimationFrame(tick)
  }
  // Manual stepping stops at a real teaching decision before advancing to the next operation.
  function next() {
    pause(); started.value = true
    const marks=moments.value.map(m=>m.at)
    const nextMark=marks.find(at=>at>fraction.value+.015)
    if(nextMark!==undefined){position.value=current.value+nextMark;return}
    const nextFrame=current.value+1
    position.value=nextFrame>=total.value?total.value:nextFrame+((run().frames[nextFrame]!.step.moments ?? run().frames[nextFrame]!.teaching?.moments)?.[0]?.at??.01)
  }
  function back() {
    pause(); started.value=true
    const marks=moments.value.map(m=>m.at)
    const prior=marks.filter(at=>at<fraction.value-.015).at(-1)
    if(prior!==undefined){position.value=current.value+prior;return}
    position.value=current.value>0?current.value-1+((run().frames[current.value-1]!.step.moments ?? run().frames[current.value-1]!.teaching?.moments)?.at(-1)?.at??.99):0
  }
  function reset() { pause(); position.value = 0; started.value = false }
  function finish() { pause(); started.value = true; position.value = total.value }
  function seek(value: number) { pause(); started.value = true; position.value = Math.max(0, Math.min(total.value, value)) }
  function onReduced(e: MediaQueryListEvent) { reduced.value = e.matches; pause() }
  media.addEventListener('change', onReduced)
  onBeforeUnmount(() => { pause(); media.removeEventListener('change', onReduced) })
  return { moments, position, playing, started, speed, reduced, total, current, fraction, frame, committed, state, done, pause, play, next, back, reset, finish, seek }
}
