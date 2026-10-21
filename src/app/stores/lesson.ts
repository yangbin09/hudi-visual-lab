import { defineStore } from 'pinia'

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
        mastered: Boolean(v.mastered),
        quizScore: typeof v.quizScore === 'number' ? v.quizScore : 0,
        position: typeof v.position === 'number' ? v.position : 0,
        step: typeof v.step === 'number' ? v.step : 0,
        lastSeen: typeof v.lastSeen === 'number' ? v.lastSeen : 0,
      }
    })
    return out
  } catch {
    return {}
  }
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
      const scored = Object.values(s.progress).filter((e) => e.quizScore > 0)
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

    /** 记录自测得分；达到及格线即视为掌握 */
    setQuizScore(id: string, score: number): void {
      if (!id) return
      const previous = this.progress[id] ?? { ...EMPTY_ENTRY }
      const normalized = Math.max(0, Math.min(100, Math.round(score)))
      this.progress = {
        ...this.progress,
        [id]: {
          ...previous,
          visited: true,
          quizScore: normalized,
          mastered: normalized >= 60 || previous.mastered,
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
