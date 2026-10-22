import type { ActionType } from './actions'
import type { Evidence } from './evidence'
import type { HudiTableState } from './hudi'

/** 被影响的对象类型 */
export type ChangeTarget =
  | 'table'
  | 'records'
  | 'fileGroups'
  | 'timeline'
  | 'compactionPlans'
  | 'ttlPolicies'
  | 'filesystem'

export interface StateDelta {
  target: ChangeTarget
  added: string[]
  updated: string[]
  removed: string[]
}

/**
 * SimulationEvent：一次动作产生的可追溯事件。
 * 满足需求 §13.3「所有状态变化可追溯」。
 */
export interface SimulationEvent {
  eventId: string
  action: ActionType
  /** 人类可读的中文说明 */
  title: string
  /** 发生时间（instant time） */
  instantTime: string | null
  deltas: StateDelta[]
  /** 过程日志（模拟终端输出） */
  logs: string[]
  /** 原理解释 */
  explanation: string
  /** 依据的证据 id */
  evidenceIds: string[]
  warnings: string[]
  /** 该动作是否成功 —— 失败不得产生虚假的成功状态 */
  success: boolean
  /** 失败时的错误信息 */
  error?: string
}

export interface ActionResult {
  nextState: unknown
  events: SimulationEvent[]
  changes: StateDelta[]
  logs: string[]
  explanation: string
  evidence: Evidence[]
  warnings: string[]
  success: boolean
  error?: string
}

/** 实验步骤定义：页面上的一个「下一步」 */
export interface ExperimentStep {
  stepId: string
  title: string
  description: string
  /** 该步骤触发的动作 */
  action?: { type: ActionType } & Record<string, unknown>
  /** 该步骤对应的能力键 */
  capabilityKey?: string
}

export interface QuizOption {
  id: string
  text: string
  correct?: boolean
  explanation?: string
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: QuizOption[]
  multiple?: boolean
  requiredForMastery?: boolean
  answerIds: string[]
  explanation: string
}

/** 实验定义：一个可交互实验页面的完整描述 */
export interface ExperimentDefinition {
  id: string
  title: string
  moduleId: string
  /** 对应需求 §4 中的实验编号 */
  catalogIds: string[]
  learningObjectives: string[]
  difficulty: '入门' | '进阶' | '高级'
  estimatedMinutes: number
  prerequisites: string[]
  targetVersion: string
  /** 功能支持状态 */
  supportState: 'supported' | 'conditional' | 'unverified' | 'unsupported'
  /** 技术证据等级 */
  evidenceLevel: 'E0' | 'E1' | 'E2' | 'E3' | 'E4'
  /** 步骤 */
  steps: ExperimentStep[]
  /** 交互参数定义 */
  controls?: ExperimentControl[]
  /** 边界场景 */
  edgeCases: EdgeCase[]
  /** 练习题 */
  quiz: QuizQuestion[]
  /** 证据 id 列表 */
  evidenceIds: string[]
  /** 引擎实现该实验的工厂 */
  createState: () => HudiTableState
}

export interface ExperimentControl {
  key: string
  label: string
  kind: 'select' | 'number' | 'text' | 'switch' | 'records'
  options?: { label: string; value: string | number }[]
  defaultValue: string | number | boolean
  hint?: string
  min?: number
  max?: number
}

export interface EdgeCase {
  id: string
  title: string
  description: string
  /** 预期结果 —— 必须明确，不得用随机变化代替 */
  expected: string
}

export interface ModuleDefinition {
  id: string
  order: number
  title: string
  shortTitle: string
  description: string
}
