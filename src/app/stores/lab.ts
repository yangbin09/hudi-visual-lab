import { defineStore } from 'pinia'
import { toRaw } from 'vue'

import type { SimulationAction } from '@/models/actions'
import type { HudiTableState } from '@/models/hudi'
import type { SimulationEvent } from '@/models/simulation'

import { applyAction } from '@/engine/core/applyAction'
import { cloneState, visibleRecords as visibleRecordsOf } from '@/engine/core/state'
import { HuaweiMRS350R26Profile } from '@/engine/versions/HuaweiMRS350R26Profile'
import { getExperimentById } from '@/experiments/catalog'
// 副作用导入：触发 `src/experiments/index.ts` 里的 registerExperiment(...)，
// 否则实验定义不会进入注册表，getExperimentById 永远查不到东西。
import '@/experiments'

/**
 * useLabStore —— 全局实验状态仓库
 * ---------------------------------------------------------------------------
 * 铁律（CONTRACT.md §0.1）：**UI 不实现 Hudi 业务规则**。
 * 本 store 唯一对状态做的加工是「克隆」与「回放快照」，
 * 所有文件变化 / Timeline 变化 / 索引映射都来自 `src/engine/` 的计算结果。
 *
 * 三条硬约束：
 *   1. 失败的动作**绝不**改变 state（引擎已保证 nextState === 入参 state）；
 *   2. 成功的动作必须留下 event（history）与 checkpoint（state.checkpoints）；
 *   3. 复位永远回到 initialState 的克隆，而不是复用同一个对象引用。
 */

/** localStorage key */
const THEME_STORAGE_KEY = 'hudi-lab-theme'
const PROGRESS_STORAGE_KEY = 'hudi-lab-progress'

/** 练习得分达到该分数即视为「该实验已完成」 */
const QUIZ_PASS_SCORE = 60

/** 每个实验的学习进度条目 */
export interface LabProgressEntry {
  done: boolean
  visited: boolean
  quizScore: number
}

/** 主题名 */
export type LabTheme = 'dark' | 'light'

/* -------------------------------------------------------------------------- */
/* 浏览器存储读写（全部做防御性处理：SSR / 隐私模式 / 配额满 都不应让应用崩溃） */
/* -------------------------------------------------------------------------- */

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
    /* 配额满或隐私模式：静默降级，不影响实验功能 */
  }
}

/** 读取已保存的主题；缺省为深色 */
function readStoredTheme(): LabTheme {
  const raw = readStorage(THEME_STORAGE_KEY)
  return raw === 'light' ? 'light' : 'dark'
}

/** 读取已保存的学习进度 */
function readStoredProgress(): Record<string, LabProgressEntry> {
  const raw = readStorage(PROGRESS_STORAGE_KEY)
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, LabProgressEntry> = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([id, value]) => {
      const v = (value ?? {}) as Partial<LabProgressEntry>
      out[id] = {
        done: Boolean(v.done),
        visited: Boolean(v.visited),
        quizScore: typeof v.quizScore === 'number' ? v.quizScore : 0,
      }
    })
    return out
  } catch {
    return {}
  }
}

/** 把主题同步到 <html>：data-theme 供 Tailwind token 使用，dark 类供 Element Plus 使用 */
function applyThemeToDocument(theme: LabTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = theme
  root.classList.toggle('dark', theme === 'dark')
}

/* -------------------------------------------------------------------------- */
/* 状态克隆                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 安全克隆一份状态。
 *
 * ⚠️ Pinia 的 state 是 **Vue 响应式代理**，而 `structuredClone` 无法克隆 Proxy
 *    （浏览器与 Node 都会抛 `DataCloneError: could not be cloned`）。
 *    因此凡是交给引擎的克隆体，都必须先用 `toRaw` 脱掉代理层。
 */
function cloneOf(state: HudiTableState): HudiTableState {
  return cloneState(toRaw(state))
}

/* -------------------------------------------------------------------------- */
/* Store                                                                        */
/* -------------------------------------------------------------------------- */

export const useLabStore = defineStore('lab', {
  state: () => {
    // 主题在 store 首次创建时同步到 DOM，保证首屏就是用户上次选的主题
    const theme = readStoredTheme()
    applyThemeToDocument(theme)

    return {
      /** 当前加载的实验 id（通常是目录编号，如 'B02'） */
      currentExperimentId: '' as string,
      /** 实验的初始状态快照；reset() 回到这里 */
      initialState: null as HudiTableState | null,
      /** 当前状态；所有展示都从这里派生 */
      state: null as HudiTableState | null,
      /** 执行历史（成功与失败都记录，失败事件 success=false） */
      history: [] as SimulationEvent[],
      /** 是否有动作正在执行（同步动作，仅用于 UI 反馈） */
      running: false,
      /** 最近一次失败原因；成功即清空 */
      lastError: '' as string,
      /** 学习进度（持久化在 localStorage） */
      progress: readStoredProgress() as Record<string, LabProgressEntry>,
      /** 深色主题 */
      darkMode: theme === 'dark',
    }
  },

  getters: {
    /** 当前表定义 */
    table: (s) => s.state?.table ?? null,
    /** 全部记录（含 tombstone） */
    records: (s) => s.state?.records ?? [],
    /** 可见记录（过滤掉 operation = D） */
    visibleRecords: (s) => (s.state ? visibleRecordsOf(s.state) : []),
    /** File Group 列表 */
    fileGroups: (s) => s.state?.fileGroups ?? [],
    /** HDFS 物理文件清单 */
    physicalFiles: (s) => s.state?.physicalFiles ?? [],
    /** 活跃 Timeline */
    timeline: (s) => s.state?.timeline ?? [],
    /** 未完成的 instant（REQUESTED / INFLIGHT） */
    pendingInstants: (s) => s.state?.pendingInstants ?? [],
    /** Compaction 计划 */
    compactionPlans: (s) => s.state?.compactionPlans ?? [],
    /** TTL 策略 */
    ttlPolicies: (s) => s.state?.ttlPolicies ?? [],
  },

  actions: {
    /**
     * 加载实验。
     *
     * 流程：查目录 → 造初始状态 → 克隆两份（initialState 供复位，state 供执行）。
     * 目录里查不到该 id 时**直接返回**，不破坏当前已有状态。
     */
    loadExperiment(id: string): void {
      const def = getExperimentById(id)
      if (!def) return

      // createState 的签名是 () => unknown，实验实现返回的是 HudiTableState
      const created = def.createState() as HudiTableState
      this.initialState = cloneOf(created)
      this.state = cloneOf(created)
      this.history = []
      this.lastError = ''
      this.currentExperimentId = id
      this.markVisited(id)
    },

    /**
     * 派发一个动作。
     *
     * 成功 → 写 state、记 history、清错误；
     * 失败 → 只写 lastError，**state 一律不动**。
     */
    dispatch(action: SimulationAction): void {
      const current = this.state
      if (!current) {
        this.lastError = '当前没有加载任何实验，无法派发动作。'
        return
      }

      this.running = true
      try {
        // 交给引擎的必须是**脱掉响应式代理**的原始对象：
        // 引擎内部第一件事就是 structuredClone，克隆 Proxy 会直接抛 DataCloneError。
        const result = applyAction(toRaw(current), action, HuaweiMRS350R26Profile)

        if (result.success) {
          this.state = result.nextState as HudiTableState
          if (result.events.length) this.history.push(...result.events)
          this.lastError = ''
        } else {
          // 失败：引擎已把 nextState 原样返回，这里**不赋值**，确保 state 保持不变。
          // 失败事件仍然进 history —— 界面上要能回看「哪一步失败了、为什么失败」。
          if (result.events.length) this.history.push(...result.events)
          this.lastError = result.error ?? '动作执行失败（引擎未给出错误信息）。'
        }
      } catch (err) {
        this.lastError = `引擎调用异常：${err instanceof Error ? err.message : String(err)}`
      } finally {
        this.running = false
      }
    },

    /** 复位：回到实验初始状态，并清空执行历史与错误 */
    reset(): void {
      if (!this.initialState) {
        this.lastError = '尚未加载实验，无法重置。'
        return
      }
      this.state = cloneOf(this.initialState)
      this.history = []
      this.lastError = ''
    },

    /**
     * 回退一步。
     *
     * 语义：撤销**最近一次成功的动作**。
     *   - 目标状态 = 上一次成功动作之后的 checkpoint 快照；
     *   - 若不存在上一次成功动作 → 回到 initialState。
     *
     * checkpoint 来自 `state.checkpoints`（引擎每次成功提交都会打一个）。
     * 回退时会把「时间点更早的 checkpoint 链」一并带回，
     * 否则快照内部的 checkpoints 被清空后就再也回退不了第二次。
     */
    stepBack(): void {
      const state = this.state
      if (!state) return

      // 只有「产生了 instant」的动作才会有 checkpoint，CREATE_TABLE 这类动作没有
      const succeeded = this.history
        .map((event, index) => ({ event, index }))
        .filter((item) => item.event.success && !!item.event.instantTime)
      if (!succeeded.length) return

      const last = succeeded[succeeded.length - 1]
      const prev = succeeded.length > 1 ? succeeded[succeeded.length - 2] : undefined

      let restored: HudiTableState | null = null
      if (prev) {
        const checkpoint = toRaw(state).checkpoints.find(
          (c) => c.instantTime === prev.event.instantTime,
        )
        restored = checkpoint ? cloneOf(checkpoint.state) : null
        // 上一次成功的动作没有对应 checkpoint（状态被 CREATE_TABLE 换过）→ 退回实验起点
        if (!restored && this.initialState) restored = cloneOf(this.initialState)
      } else if (this.initialState) {
        restored = cloneOf(this.initialState)
      }
      if (!restored) return

      // 保留更早的 checkpoint 链，保证还能继续往回退。
      // 这里必须从原始对象里取并重新克隆 —— 响应式代理无法被 structuredClone。
      const targetInstant = prev?.event.instantTime ?? ''
      restored.checkpoints = toRaw(state)
        .checkpoints.filter((c) => c.instantTime <= targetInstant)
        .map((c) => ({ instantTime: c.instantTime, state: cloneOf(c.state) }))

      this.state = restored
      // history 截断到最后一次成功动作为止（其后发生的失败事件一并丢弃）
      this.history = this.history.slice(0, last.index)
      this.lastError = ''
    },

    /** 记录练习得分；得分达到及格线即视为该实验已完成 */
    setQuizScore(expId: string, score: number): void {
      if (!expId) return
      const previous = this.progress[expId]
      const normalized = Math.max(0, Math.min(100, Math.round(score)))
      this.progress = {
        ...this.progress,
        [expId]: {
          done: normalized >= QUIZ_PASS_SCORE || Boolean(previous?.done),
          visited: true,
          quizScore: normalized,
        },
      }
      this.persistProgress()
    },

    /** 标记实验已访问（打开实验页即调用） */
    markVisited(expId: string): void {
      if (!expId) return
      const previous = this.progress[expId]
      this.progress = {
        ...this.progress,
        [expId]: {
          done: Boolean(previous?.done),
          visited: true,
          quizScore: typeof previous?.quizScore === 'number' ? previous.quizScore : 0,
        },
      }
      this.persistProgress()
    },

    /** 切换深色 / 浅色主题，并写入 localStorage */
    toggleTheme(): void {
      this.darkMode = !this.darkMode
      const theme: LabTheme = this.darkMode ? 'dark' : 'light'
      applyThemeToDocument(theme)
      writeStorage(THEME_STORAGE_KEY, theme)
    },

    /** 把学习进度写入 localStorage */
    persistProgress(): void {
      writeStorage(PROGRESS_STORAGE_KEY, JSON.stringify(this.progress))
    },
  },
})

export default useLabStore
