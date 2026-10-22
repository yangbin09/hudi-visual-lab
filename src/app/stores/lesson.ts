import { defineStore } from 'pinia'
import type { LessonParameters } from '@/experiments/visual/types'
import type { ComparisonBookmark } from '@/animation/useVisualTimeline'
import { ASSESSMENT_VERSION } from '@/experiments/visual/assessment-version'

/**
 * useLessonStore —— 动画主题的学习进度与显示模式
 * ---------------------------------------------------------------------------
 * 背景：视觉实验室的 80 个动画主题此前**从不写入任何进度**，
 * `/progress` 因此恒为 0，而「学完了没有」这个问题在整个产品里无处回答。
 *
 * 本 store 负责：
 *   1. 每个主题的访问 / 看完 / 掌握 / 自测得分 / 上次播放位置；
 *   2. 全站的显示模式（基础模式 ↔ 工程师模式）——切换后必须真的改变内容，
 *      不再是一个只换文案的假开关；
 *   3. 所有状态落在 localStorage，刷新页面不丢。
 *
 * 铁律：store 只记录**行为**，不实现任何 Hudi 业务规则。
 */

/** localStorage key */
const PROGRESS_STORAGE_KEY = 'hudi-lab-lesson-progress'
const MODE_STORAGE_KEY = 'hudi-lab-lesson-mode'

/** 一个主题的学习记录 */
export interface LessonProgressEntry {
  /** 打开过这个主题 */
  visited: boolean
  /** 完整播放过一遍（到达最后一帧） */
  watched: boolean
  /** 完成自测（达到及格分） */
  mastered: boolean
  /** 自测得分 0–100 */
  quizScore: number
  /** 上次离开时的播放位置（帧） */
  position: number
  /** 上次离开时处于第几步（0 基） */
  step: number
  /** 最后一次访问时间戳（毫秒） */
  lastSeen: number
  parameters?: LessonParameters
  jobIndex?: 'SIMPLE' | 'BUCKET'
  comparison?: ComparisonBookmark
  assessmentVersion?: number
}

export type LessonMode = 'basic' | 'engineer'

const EMPTY_ENTRY: LessonProgressEntry = {
  visited: false,
  watched: false,
  mastered: false,
  quizScore: 0,
  position: 0,
  step: 0,
  lastSeen: 0,
}

function readStorage(key: string): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.setItem(key, value)
  } catch {
    /* 隐私模式 / 配额满：静默降级，不影响学习 */
  }
}

function readProgress(): Record<string, LessonProgressEntry> {
  const raw = readStorage(PROGRESS_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, LessonProgressEntry> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([id, value]) => {
      const v = (value ?? {}) as Partial<LessonProgressEntry>
      out[id] = {
        visited: Boolean(v.visited),
        watched: Boolean(v.watched),
        mastered: v.assessmentVersion === ASSESSMENT_VERSION && Boolean(v.mastered),
        quizScore: v.assessmentVersion === ASSESSMENT_VERSION && Number.isFinite(v.quizScore) ? Math.max(0, Math.min(100, v.quizScore!)) : 0,
        position: Number.isFinite(v.position) ? Math.max(0, v.position!) : 0,
        step: Number.isFinite(v.step) ? Math.max(0, Math.floor(v.step!)) : 0,
        parameters: validParameters(v.parameters) ? v.parameters : undefined,
        jobIndex: v.jobIndex === 'BUCKET' ? 'BUCKET' : 'SIMPLE',
        comparison: validComparison(v.comparison) ? v.comparison : undefined,
        assessmentVersion: v.assessmentVersion,
        lastSeen: typeof v.lastSeen === 'number' ? v.lastSeen : 0,
      }
    })
    return out
  } catch {
    return {}
  }
}

function validParameters(p: unknown): p is LessonParameters {
  if (!p || typeof p !== 'object') return false
  const v=p as LessonParameters
  return typeof v.recordKey==='string' && v.recordKey.trim().length>0 && v.recordKey.length<=40 && typeof v.partition==='string' && v.partition.trim().length>0 && v.partition.length<=80 && Number.isFinite(v.amount) && v.amount>=0 && Number.isInteger(v.bucketCount) && v.bucketCount>=1 && v.bucketCount<=12 && Number.isInteger(v.retention) && v.retention>=1 && v.retention<=10 && Number.isInteger(v.failureAt) && v.failureAt>=-1 && v.failureAt<=12 && ['COPY_ON_WRITE','MERGE_ON_READ'].includes(v.tableType) && (v.checkpointOffset===undefined || [101,102,103].includes(v.checkpointOffset)) && (v.writerTarget===undefined || ['same','different'].includes(v.writerTarget)) && (v.occRetry===undefined || typeof v.occRetry==='boolean')
}
function validComparison(value: unknown): value is ComparisonBookmark {
  if(!value || typeof value!=='object')return false
  const v=value as ComparisonBookmark
  return Number.isFinite(v.position) && v.position>=0 && (v.nextAmount===undefined || Number.isFinite(v.nextAmount)&&v.nextAmount>=0&&v.nextAmount<=999999) && Array.isArray(v.operations) && v.operations.length<=100 && v.operations.every(op=>op && ['update','schedule','compact','clean','snapshot','failure'].includes(op.kind) && Number.isFinite(op.amount) && op.amount>=0 && op.amount<=999999)
}

function readMode(): LessonMode {
  return readStorage(MODE_STORAGE_KEY) === 'engineer' ? 'engineer' : 'basic'
}

export const useLessonStore = defineStore('lesson', {
  state: () => ({
    /** 主题 id → 学习记录 */
    progress: readProgress() as Record<string, LessonProgressEntry>,
    /** 显示模式：基础模式（讲原理） / 工程师模式（讲实现） */
    mode: readMode() as LessonMode,
  }),

  getters: {
    /** 某个主题的记录（没有则返回一个空记录，不返回 undefined） */
    entry: (s) => (id: string): LessonProgressEntry => s.progress[id] ?? { ...EMPTY_ENTRY },
    /** 已访问过的主题数 */
    visitedCount: (s) => Object.values(s.progress).filter((e) => e.visited).length,
    /** 完整看完过的主题数 */
    watchedCount: (s) => Object.values(s.progress).filter((e) => e.watched).length,
    /** 掌握（自测通过）的主题数 */
    masteredCount: (s) => Object.values(s.progress).filter((e) => e.mastered).length,
    /** 自测平均分 */
    averageScore: (s) => {
      const scored = Object.values(s.progress).filter((e) => e.assessmentVersion === ASSESSMENT_VERSION)
      if (!scored.length) return 0
      return Math.round(scored.reduce((sum, e) => sum + e.quizScore, 0) / scored.length)
    },
    /** 工程师模式是否开启 */
    engineerMode: (s) => s.mode === 'engineer',
  },

  actions: {
    /** 打开主题时调用 */
    markVisited(id: string): void {
      if (!id) return
      const previous = this.progress[id] ?? { ...EMPTY_ENTRY }
      this.progress = {
        ...this.progress,
        [id]: { ...previous, visited: true, lastSeen: Date.now() },
      }
      this.persist()
    },

    /** 播放到最后一帧时调用 */
    markWatched(id: string): void {
      if (!id) return
      const previous = this.progress[id] ?? { ...EMPTY_ENTRY }
      this.progress = {
        ...this.progress,
        [id]: { ...previous, visited: true, watched: true, lastSeen: Date.now() },
      }
      this.persist()
    },

    /** 记录播放位置（离开页面时保存，便于「继续上次」） */
    savePosition(id: string, position: number, step: number): void {
      if (!id) return
      const previous = this.progress[id] ?? { ...EMPTY_ENTRY }
      this.progress = {
        ...this.progress,
        [id]: { ...previous, visited: true, position, step, lastSeen: Date.now() },
      }
      this.persist()
    },

    saveBookmark(id: string, bookmark: Pick<LessonProgressEntry, 'position' | 'step' | 'parameters' | 'jobIndex' | 'comparison'>): void {
      if(!id)return
      this.progress = {...this.progress, [id]: {...(this.progress[id] ?? EMPTY_ENTRY), ...bookmark, visited:true, lastSeen:Date.now()}}
      this.persist()
    },

    /** 记录当前测验得分；及格且通过原理题门槛才授予掌握。 */
    setQuizScore(id: string, score: number, masteryReady = false): void {
      if (!id) return
      const previous = this.progress[id] ?? { ...EMPTY_ENTRY }
      const normalized = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0
      this.progress = {
        ...this.progress,
        [id]: {
          ...previous,
          visited: true,
          quizScore: normalized,
          assessmentVersion: ASSESSMENT_VERSION,
          mastered: (normalized >= 60 && masteryReady) || previous.mastered,
          lastSeen: Date.now(),
        },
      }
      this.persist()
    },

    /** 切换显示模式 */
    setMode(mode: LessonMode): void {
      this.mode = mode
      writeStorage(MODE_STORAGE_KEY, mode)
    },

    toggleMode(): void {
      this.setMode(this.mode === 'basic' ? 'engineer' : 'basic')
    },

    /** 清空全部学习记录 */
    resetProgress(): void {
      this.progress = {}
      this.persist()
    },

    /** 写入 localStorage */
    persist(): void {
      writeStorage(PROGRESS_STORAGE_KEY, JSON.stringify(this.progress))
    },
  },
})

export default useLessonStore
