# Hudi Lab — 并行开发契约（CONTRACT）

> 本文件是阶段 0 各并行子任务的**唯一接口依据**。
> 每个子任务只允许写自己名下的文件，**不得修改**其它子任务的文件；
> 需要改动引擎语义时，走「需求澄清」反馈，不要自行改引擎。

---

## 0. 铁律

1. **UI 不实现 Hudi 业务规则**。所有文件变化、索引映射、Timeline 变化只能由 `src/engine/` 计算，UI 只渲染。
2. **不得新增 npm 依赖**。可用依赖已固定在 `package.json`：vue / vue-router / pinia / element-plus / tailwindcss / echarts / codemirror(@codemirror/*) / vitest / @playwright/test / @vue/test-utils / jsdom / typescript / vite / vue-tsc。
3. **所有 UI 文案中文**，技术术语保留英文（File Group / Timeline / Compaction 等）。
4. **不得伪造执行结果**。凡是 r26 未确认的行为，界面必须显示「待验证」徽标。
5. **不得执行 npm install / npm run build**（由主控统一执行，避免并发写 node_modules）。
6. 禁止在一个 Vue 文件里塞进整个实验的逻辑；实验定义放 `src/experiments/`。
7. 路径别名 `@` → `src`（已在 `vite.config.ts` / `tsconfig.json` 配置，勿重复定义）。

---

## 1. 已存在且**只读**的核心模型

以下为真实定义，**不要修改**，直接 import：

```ts
// src/models/hudi.ts
export type TableType = 'COPY_ON_WRITE' | 'MERGE_ON_READ'
export type IndexType = 'SIMPLE' | 'BLOOM' | 'BUCKET' | 'GLOBAL_SIMPLE' | 'GLOBAL_BLOOM'
export type WriteOperation = 'UPSERT' | 'INSERT' | 'BULK_INSERT' | 'INSERT_OVERWRITE' | 'INSERT_OVERWRITE_TABLE'
export type HiveStylePartitioning = 'NONE' | 'HIVE_STYLE_PARTITIONING' | 'STYLE_PARTITIONING_ONLY'
export type RecordOperation = 'I' | 'U' | 'D'
export type InstantAction = 'COMMIT'|'DELTA_COMMIT'|'COMPACTION'|'CLEAN'|'ARCHIVE'|'ROLLBACK'|'REPLACE_COMMIT'|'CLUSTERING'|'RESTORE'|'TTL'|'SAVEPOINT'
export type InstantState = 'REQUESTED' | 'INFLIGHT' | 'COMPLETED'

export interface HudiField { name: string; type: string; nullable?: boolean; comment?: string }

export interface HudiTable {
  tableName: string; databaseName: string; tableType: TableType
  fields: HudiField[]; primaryKey: string | null; preCombineField: string | null
  partitionFields: string[]; partitionType: 'PARTITIONED' | 'NON_PARTITIONED'
  indexType: IndexType; bucketCount: number | null; isGlobalIndexed: boolean
  payloadClass: string; tablePath: string
  hiveStylePartitioning: HiveStylePartitioning
  properties: Record<string, string>; version: string
}

export interface HudiRecord {
  recordKey: string; partitionPath: string; fields: Record<string, unknown>
  preCombineValue: number | null; commitTime: string; commitSeqNo: number
  operation: RecordOperation; hoodieKey: string
}

export interface HudiBaseFile {
  fileName: string; instantTime: string; sizeBytes: number; recordCount: number
  records: HudiRecord[]; storagePath: string; fileId: string; producedBy?: string
}
export interface HudiLogFile {
  fileName: string; instantTime: string; version: number; sizeBytes: number
  recordCount: number; records: HudiRecord[]; storagePath: string
}
export interface HudiFileSlice {
  baseFile: HudiBaseFile | null; logFiles: HudiLogFile[]
  baseInstantTime: string | null; deltaCommits: string[]; compactionRequested: boolean
}
export interface HudiFileGroup {
  fileId: string; partitionPath: string; fileSlice: HudiFileSlice
  recordCount: number; totalSizeBytes: number; bucket: number | null
  supersededBy?: string | null
}
export interface HudiPhysicalFile {
  fileName: string; partitionPath: string; type: 'BASE' | 'LOG'
  sizeBytes: number; recordCount: number; createdInstant: string
  status: 'ACTIVE' | 'SUPERSEDED'; supersededAt?: string; supersededBy?: string
}
export interface HudiInstant {
  instantTime: string; action: InstantAction; state: InstantState
  operation?: string; tableName?: string; partitionPath?: string
  files?: string[]; extraMetadata?: Record<string, unknown>
}
export interface CompactionPlanEntry { partitionPath: string; fileId: string; logFileCount: number; recordCount: number }
export interface CompactionPlan { instantTime: string; entries: CompactionPlanEntry[]; state: 'PLANNED'|'EXECUTED'|'FAILED' }
export interface TtlPolicy { spec: string; level: 'PARTITION'|'RECORD'; value: number; units: 'YEARS'|'MONTHS'|'WEEKS'|'DAYS' }

export interface HudiTableState {
  table: HudiTable
  records: HudiRecord[]
  fileGroups: HudiFileGroup[]
  physicalFiles: HudiPhysicalFile[]
  timeline: HudiInstant[]
  archivedInstants: HudiInstant[]
  pendingInstants: HudiInstant[]
  compactionPlans: CompactionPlan[]
  ttlPolicies: TtlPolicy[]
  instantCounter: number
  usedInstants: string[]
  checkpoints: { instantTime: string; state: HudiTableState }[]
}
```

```ts
// src/models/actions.ts
export type ActionType =
  | 'CREATE_TABLE' | 'INSERT_RECORDS' | 'UPSERT_RECORDS' | 'DELETE_RECORDS'
  | 'OVERWRITE_PARTITION' | 'OVERWRITE_TABLE' | 'SCHEDULE_COMPACTION'
  | 'RUN_COMPACTION' | 'RUN_CLEAN' | 'RUN_ARCHIVE' | 'RUN_ROLLBACK'
  | 'RUN_CLUSTERING' | 'APPLY_TTL' | 'INJECT_FAILURE' | 'RESET_EXPERIMENT'

export interface InputRecord { recordKey: string; partitionPath?: string; fields: Record<string, unknown> }
export type CompactionFailureMode =
  | 'NONE' | 'SPARK_TASK_FAILED' | 'YARN_KILLED' | 'SPARK_OK_BUT_TX_INCOMPLETE'
  | 'PLAN_NOT_FOUND' | 'STALE_PLAN' | 'SCHEDULER_TIMEOUT'

export interface SimulationAction { type: ActionType; [k: string]: unknown }
// 实际为 discriminated union，字段见文件
```

```ts
// src/models/evidence.ts
export type EvidenceLevel = 'E0' | 'E1' | 'E2' | 'E3' | 'E4'
export type CapabilityState = 'supported' | 'unsupported' | 'unverified' | 'conditional'
export interface Capability {
  key: string; state: CapabilityState
  precondition?: string; openQuestion?: string; evidenceIds?: string[]
}
export interface Evidence {
  evidenceId: string; title: string; evidenceLevel: EvidenceLevel
  component: string; version: string; sourceType: EvidenceSourceType
  documentUrl?: string; artifactCoordinate?: string; className?: string
  methodName?: string; testCommand?: string; expectedResult?: string
  actualResult?: string; environment?: string; verifiedAt?: string; notes?: string
}
```

```ts
// src/models/simulation.ts
export interface StateDelta { target: ChangeTarget; added: string[]; updated: string[]; removed: string[] }
export interface SimulationEvent {
  eventId: string; action: ActionType; title: string; instantTime: string | null
  deltas: StateDelta[]; logs: string[]; explanation: string
  evidenceIds: string[]; warnings: string[]; success: boolean; error?: string
}
export interface ActionResult {
  nextState: unknown; events: SimulationEvent[]; changes: StateDelta[]
  logs: string[]; explanation: string; evidence: Evidence[]
  warnings: string[]; success: boolean; error?: string
}
export interface ExperimentControl {
  key: string; label: string
  kind: 'select' | 'number' | 'text' | 'switch' | 'records'
  options?: { label: string; value: string | number }[]
  defaultValue: string | number | boolean; hint?: string; min?: number; max?: number
}
export interface EdgeCase { id: string; title: string; description: string; expected: string }
export interface QuizOption { id: string; text: string; correct?: boolean; explanation?: string }
export interface QuizQuestion {
  id: string; prompt: string; options: QuizOption[]; multiple?: boolean
  answerIds: string[]; explanation: string
}
export interface ExperimentDefinition {
  id: string; title: string; moduleId: string; catalogIds: string[]
  learningObjectives: string[]; difficulty: '入门'|'进阶'|'高级'
  estimatedMinutes: number; prerequisites: string[]; targetVersion: string
  supportState: 'supported'|'conditional'|'unverified'|'unsupported'
  evidenceLevel: EvidenceLevel
  steps: ExperimentStep[]; controls?: ExperimentControl[]
  edgeCases: EdgeCase[]; quiz: QuizQuestion[]; evidenceIds: string[]
  createState: () => HudiTableState
}
export interface ModuleDefinition { id: string; order: number; title: string; shortTitle: string; description: string }
```

---

## 2. 引擎 API（`src/engine/`，**只读**，除非被分配到该子任务）

```ts
// src/engine/core/state.ts
export function createInitialState(table: HudiTable): HudiTableState
export function cloneState(state: HudiTableState): HudiTableState
export function pushCheckpoint(state: HudiTableState, instantTime: string): void
export function findRecord(state, recordKey): HudiRecord | undefined
export function findRecordInPartition(state, recordKey, partitionPath): HudiRecord | undefined
export function partitionsOfRecord(state, recordKey): string[]
export function findFileGroupForKey(state, recordKey, partitionPath): HudiFileGroup | undefined
export function fileGroupsOfPartition(state, partitionPath): HudiFileGroup[]
export function allPartitions(state): string[]
export function visibleRecords(state): HudiRecord[]
export function totalRecords(state): number
export function hoodieKeyOf(recordKey, partitionPath): string
export function recomputeFileGroupStats(group: HudiFileGroup): void
export function derivePartitionPath(table, fields): string
export function isDefaultPartition(partitionPath): boolean
export function materializeLogicalRecords(state): HudiRecord[]

// src/engine/core/instant.ts
export const SIMULATION_EPOCH: string        // '20240101120000'
export function prettyInstant(t: string): string
export function instantAt(offsetSeconds: number, epoch?: string): string
export function nextInstant(counter: number, epoch?: string): string
export function isInstantTime(v: string): boolean

// src/engine/core/errors.ts
export class SimulationError extends Error { capabilityKey?: string }

// src/engine/filesystem/layout.ts
export const SIMPLIFIED_NOTE: string
export interface HoodieDirEntry { path: string; type: 'dir'|'file'; size?: number; children?: HoodieDirEntry[] }
export function tableRoot(table): string
export function makeFileGroupId(writeToken, taskPartitionId, fileId): string
export function baseFileName(fileGroupId, baseInstantTime): string
export function logFileName(fileGroupId, baseInstantTime, version, writeToken): string
export function estimateBaseFileSize(recordCount): number
export function estimateLogFileSize(recordCount): number
export function partitionDirName(table, partitionPath): string
export function partitionRelativeDir(table, partitionPath): string
export function partitionFullPath(table, partitionPath): string
export function hoodieDir(table): string
export function instantFileName(instantTime, action, state): string
export function buildDirectoryTree(table, groups, extraHoodieFiles?): HoodieDirEntry
export function renderTree(entry): string[]

// src/engine/indexes/bucket.ts
export const BUCKET_ALGORITHM_NOTE: string
export function teachingHash(key: string): number
export function bucketOf(recordKey: string, bucketCount: number): number
export function indexSupportsUpsert(indexType): boolean
export function isGlobalIndex(indexType): boolean
export function indexDescription(indexType): { title; brief; detail; scope: 'partition'|'global' }
export function checkOperationCompatibility(table, operation): string | null

// src/engine/operations/rules.ts
export type LandingKind = 'BASE_FILE'|'LOG_ONLY_GROUP'|'APPEND_LOG'|'NEW_LOG_ONLY_GROUP'|'REWRITE_FILE_GROUP'|'NEW_BASE_FILE'
export interface ScenarioRule {
  key: string; tableType: 'COPY_ON_WRITE'|'MERGE_ON_READ'; scenario: string
  landing: LandingKind; landingText: string; note: string; needsVerification: boolean
}
export const SCENARIO_RULES: ScenarioRule[]
export function rulesFor(tableType): ScenarioRule[]
export function ruleByKey(key): ScenarioRule | undefined
export const SCENARIO_RULES_NOTE: string

// src/engine/operations/writes.ts
export interface WriteOutcome {
  state: HudiTableState; instantTime: string; action: InstantAction; operation: string
  logs: string[]; explanation: string; warnings: string[]
  filesAdded: string[]; filesRemoved: string[]; recordsChanged: string[]
  appliedRules: ScenarioRule[]
}
export function performWrite(state, input: InputRecord[], operation, profile, opts?): WriteOutcome
export function morInitialLanding(table): LandingKind

// src/engine/operations/services.ts
export interface ServiceOutcome {
  state: HudiTableState; instantTime: string; logs: string[]; explanation: string
  warnings: string[]; filesAdded: string[]; filesDeleted: string[]; events: string[]
}
export function mergeRecords(records: HudiRecord[]): HudiRecord[]
export function scheduleCompaction(state, deltaCommits?): ServiceOutcome
export function runCompaction(state, planInstant?, failWith?): ServiceOutcome
export function runClean(state, commitsRetained?): ServiceOutcome
export function runArchive(state, maxCommitsToKeep?): ServiceOutcome
export function runRollback(state, instantTime?): ServiceOutcome
export function runClustering(state, targetFileSizeMb?): ServiceOutcome
export function applyTtl(state, policy: TtlPolicy, executeNow?): ServiceOutcome
export function snapshotAt(state, instantTime): HudiTableState | undefined

// src/engine/versions/HuaweiMRS350R26Profile.ts
export const R26_ARTIFACTS: Record<string, string>
export const HuaweiMRS350R26Profile: HudiVersionProfile
export function capabilityOf(key: string): Capability
export function configName(logical: string): string

// src/evidence/index.ts
export const EVIDENCE_REPOSITORY: Evidence[]
export function getEvidence(id): Evidence | undefined
export function getEvidenceList(ids: string[]): Evidence[]
export function evidenceByLevel(level): Evidence[]
export function hasFieldVerifiedEvidence(): boolean
export const EVIDENCE_STATS: { total: number; E0: number; E1: number; E2: number; E3: number; E4: number }
```

---

## 3. 待新建：引擎调度器 `src/engine/core/applyAction.ts`（**归属子任务 B**）

```ts
export function applyAction(
  state: HudiTableState,
  action: SimulationAction,
  profile: HudiVersionProfile = HuaweiMRS350R26Profile,
): ActionResult
```

行为约定（**必须严格遵守**）：
- 成功 → 返回 `{ success: true, nextState, events, logs, explanation, warnings, evidence }`
- 失败 → 捕获 `SimulationError`，返回 `{ success: false, nextState: state（**原样不变**）, error: message, logs: [...], warnings: [...] }`
  - **失败绝不能产生任何状态变更**，绝不能写入 `state`（先 clone 再操作）
- `RESET_EXPERIMENT` → `nextState` 为调用方传入的 `initialState`（见 §4 store）
- 每个 action 成功后调用 `pushCheckpoint(state, instantTime)`
- `evidence` 字段由 `getEvidenceList(action 对应的 evidenceIds)` 得到，evidenceIds 写在 `src/engine/evidenceMap.ts`（子任务 B 新建）

---

## 4. Store API `src/app/stores/lab.ts`（**归属子任务 A**）

```ts
export const useLabStore = defineStore('lab', {
  state: () => ({
    currentExperimentId: '' as string,
    initialState: null as HudiTableState | null,
    state: null as HudiTableState | null,
    history: [] as SimulationEvent[],
    running: false,
    lastError: '' as string,
    progress: {} as Record<string, { done: boolean; visited: boolean; quizScore: number }>,
    darkMode: true,
  }),
  getters: {
    table: (s) => s.state?.table ?? null,
    records: (s) => s.state?.records ?? [],
    visibleRecords: (s) => (s.state ? visibleRecords(s.state) : []),
    fileGroups: (s) => s.state?.fileGroups ?? [],
    physicalFiles: (s) => s.state?.physicalFiles ?? [],
    timeline: (s) => s.state?.timeline ?? [],
    pendingInstants: (s) => s.state?.pendingInstants ?? [],
    compactionPlans: (s) => s.state?.compactionPlans ?? [],
    ttlPolicies: (s) => s.state?.ttlPolicies ?? [],
  },
  actions: {
    loadExperiment(id: string): void          // 从 experiments/catalog 找定义 → createState() → initialState + state
    dispatch(action: SimulationAction): void  // 调 applyAction，成功则写 state + history，失败写 lastError
    reset(): void                             // state = clone(initialState)，清空 history
    stepBack(): void                          // 从 history 回退到上一个事件
    setQuizScore(expId: string, score: number): void
    toggleTheme(): void
  },
})
```

`loadExperiment` 的数据来源是 `src/experiments/catalog.ts` 导出的 `getExperimentById(id)`（子任务 C 提供）。子任务 A **只调用它**，不要自己实现查找逻辑。

---

## 5. 路由（子任务 C 拥有 `src/app/router/index.ts`）

```
/            → DashboardView
/experiment/:id → ExperimentView
/evidence    → EvidenceView
/progress    → ProgressView
```
用 `createWebHistory`；`/experiment/:id` 的 id 来自 `catalog.ts` 的 `getExperimentById`。

---

## 6. 组件清单与签名

### 子任务 D 拥有（可视化）
```vue
<!-- components/filesystem/FileTreeView.vue -->
props: { table: HudiTable; physicalFiles: HudiPhysicalFile[]; fileGroups: HudiFileGroup[]; selectedFile?: string }
emits:  (e:'select', file: HudiPhysicalFile): void
// 用 SVG/原生 DOM 渲染 HDFS 目录树；区分 BASE/LOG、ACTIVE/SUPERSEDED；显示 SIMPLIFIED_NOTE

<!-- components/timeline/TimelineView.vue -->
props: { timeline: HudiInstant[]; pending: HudiInstant[]; archived?: HudiInstant[]; selected?: string }
emits:  (e:'select', instant: HudiInstant): void
// SVG 横向时间轴，标注 action + state；REQUESTED/INFLIGHT 用警示色

<!-- components/timeline/TimelineTable.vue -->
props: { timeline: HudiInstant[] }
emits:  (e:'select', instant: HudiInstant): void

<!-- components/records/RecordTable.vue -->
props: { records: HudiRecord[]; primaryKey: string | null; preCombineField: string | null; showMetaFields?: boolean }
emits:  (e:'select-record', record: HudiRecord): void
// 表格展示业务字段 + _hoodie_* 元字段；I/U/D 用不同徽标

<!-- components/records/BucketView.vue -->
props: { table: HudiTable; fileGroups: HudiFileGroup[]; records: HudiRecord[] }
// BUCKET 索引时展示 主键→桶→FileGroup 映射；必须显示 BUCKET_ALGORITHM_NOTE
```

### 子任务 E 拥有（面板）
```vue
<!-- components/sql/SqlPanel.vue -->
props: { blocks: SqlBlock[] }   // SqlBlock = { id; title; language: 'spark-sql'|'flink-sql'|'scala'|'shell'; code: string; note?: string; status: 'verified'|'unverified'|'conditional'; evidenceIds?: string[] }
emits:  (e:'copy', code: string): void
// CodeMirror 6 只读展示 + 复制按钮 + 状态徽标 + 证据链接

<!-- components/sql/SqlBlock.vue -->
props: { block: SqlBlock }
emits:  (e:'copy', code: string): void

<!-- components/evidence/EvidencePanel.vue -->
props: { evidenceIds: string[] }
emits:  (e:'select', evidence: Evidence): void
// 按证据等级 E0~E4 分色展示；链接可点开原文

<!-- components/evidence/CapabilityBadge.vue -->
props: { capabilityKey: string }  // 内部用 capabilityOf() 查询
// 显示 CAPABILITY_LABEL[state]，conditional 展开显示 precondition，unverified 显示 openQuestion

<!-- components/quiz/QuizPanel.vue -->
props: { questions: QuizQuestion[] }
emits:  (e:'submit', score: number): void
// 选择 → 判分 → 展示 explanation

<!-- components/common/LogPanel.vue -->
props: { logs: string[]; title?: string }
// 等宽字体终端风格

<!-- components/experiment/EdgeCasePanel.vue -->
props: { edgeCases: EdgeCase[] }
// 折叠面板，每条含「预期结果」
```

### 子任务 A 拥有
```vue
<!-- components/experiment/ExperimentShell.vue -->
props: { experiment: ExperimentDefinition }
emits:  (e:'dispatch', action: SimulationAction): void
// 三栏骨架：左=实验元信息+步骤，中央=插槽，右侧=参数/原理解释/证据；底部=Tab 插槽
// 提供 slot: default（中央）、controls（右侧）、tabs（底部）

<!-- components/experiment/ControlPanel.vue -->
props: { controls: ExperimentControl[]; values: Record<string, unknown> }
emits:  (e:'update', key: string, value: unknown): void

<!-- components/experiment/StepRunner.vue -->
props: { steps: ExperimentStep[]; currentIndex: number }
emits:  (e:'run', step: ExperimentStep, index: number): void
       (e:'reset'): void
       (e:'goto', index: number): void
// 单步执行 / 自动播放 / 暂停 / 重新执行 / 恢复初始状态 / 回看历史
```

### 子任务 C 拥有
```vue
<!-- views/ExperimentView.vue -->   组合 ExperimentShell + 上述组件
<!-- views/DashboardView.vue -->     首页：模块卡片、实验入口、证据统计
<!-- views/EvidenceView.vue -->      证据库总览：按等级/来源/组件筛选
<!-- views/ProgressView.vue -->      学习进度：按模块统计完成率、错题回顾
```

---

## 7. 样式约定

- Tailwind v4，通过 `@tailwindcss/vite` 插件；`src/styles/main.css` 里 `@import "tailwindcss";`
- 设计 token 定义在 `src/styles/main.css` 的 `@theme` 里：
  `--color-hudi-bg / --color-hudi-panel / --color-hudi-border / --color-hudi-text / --color-hudi-muted / --color-hudi-accent`
  以及 `--color-ev-E0 … --color-ev-E4`（证据等级色）
- 深色为默认，浅色通过 `:root[data-theme='light']` 覆盖
- 禁止使用 emoji 作为主要图标；用 Element Plus 的 `<el-icon>` 或纯 CSS/SVG

---

## 8. 命名与风格

- 组件文件 `PascalCase.vue`，组合式 API + `<script setup lang="ts">`
- 引擎/模型层：纯 TS，无 Vue 依赖
- 中文注释只在解释「为什么」时写，不写废话
- 所有对外 props/emit 用显式类型

---

## 9. 文件归属表（**越界即冲突**）

| 子任务 | 独占文件 |
|---|---|
| **A 脚手架/布局/Store** | `index.html` `vite.config.ts` `tsconfig.json` `tsconfig.node.json` `tailwind.config.js` `postcss.config.js` `src/main.ts` `src/App.vue` `src/styles/**` `src/app/stores/**` `src/app/layouts/**` `src/components/common/StatusBar.vue` `src/components/experiment/ExperimentShell.vue` `src/components/experiment/ControlPanel.vue` `src/components/experiment/StepRunner.vue` |
| **B 引擎调度 + 模板** | `src/engine/core/applyAction.ts` `src/engine/evidenceMap.ts` `src/engine/operations/deletes.ts` `src/engine/templates/**` `src/engine/queries/**` |
| **C 实验目录 + 视图** | `src/experiments/**` `src/app/router/**` `src/views/**` |
| **D 可视化组件** | `src/components/filesystem/**` `src/components/timeline/**` `src/components/records/**` |
| **E 面板组件** | `src/components/sql/**` `src/components/evidence/**` `src/components/quiz/**` `src/components/common/LogPanel.vue` `src/components/experiment/EdgeCasePanel.vue` |
| **F 测试 + 文档** | `tests/**` `docs/**` `README.md` `vitest.config.ts` `playwright.config.ts` `src/testing/**` |

> `src/models/**`、`src/evidence/**`、`src/engine/{core,filesystem,indexes,operations/rules.ts,operations/services.ts,operations/writes.ts,versions/**}` **已完成，任何人不得修改**。

---

## 10. 交付自查

每个子任务完成后必须自检并在回复里给出：
1. 新建/修改了哪些文件（路径列表）
2. 关键设计决策（3–5 条）
3. 已知问题 / 未完成项
4. 用到的公开 API 是否与本契约一致（是/否）
