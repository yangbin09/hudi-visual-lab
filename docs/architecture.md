# Hudi Lab 架构说明

> 本文件描述 Hudi Lab（华为 MRS 定制版 Hudi 0.15.0 交互式学习实验室）的分层结构。
> 架构的核心约束只有一条：**Hudi 业务规则只允许存在于 `src/engine/`，UI 只负责渲染。**

---

## 1. 六层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│ L1 表现层 Presentation          src/views, src/components, src/app   │
│    职责：把状态画出来、把手势翻译成 action                            │
│    禁止：判断「这次写入该不该产生 log file」这类 Hudi 规则            │
├──────────────────────────────────────────────────────────────────────┤
│ L2 实验层 Experiment             src/experiments                       │
│    职责：定义「这个实验要讲什么」——标题、步骤、控制项、边界场景、练习  │
│    产物：ExperimentDefinition（纯数据 + createState 工厂）             │
├──────────────────────────────────────────────────────────────────────┤
│ L3 模拟引擎 Simulation Engine    src/engine/core, operations,         │
│                                  filesystem, indexes, queries,        │
│                                  templates                           │
│    职责：**唯一**能改变表状态的地方：文件落点、索引映射、Timeline 变化  │
│    产物：HudiTableState 的新快照 + 事件 + 告警 + 证据引用              │
├──────────────────────────────────────────────────────────────────────┤
│ L4 版本规则 Version Rules        src/engine/versions                  │
│    职责：把「这个版本支持什么」集中成一份档案（capability / 配置名 /  │
│          操作约束 / 索引规则 / TTL 范围）                              │
│    约束：任何存在版本差异的分支都必须先查这里，禁止在业务代码里硬编码    │
├──────────────────────────────────────────────────────────────────────┤
│ L5 证据仓库 Evidence Repository  src/evidence                         │
│    职责：结论 → 证据的映射，E0~E4 分级                                │
│    约束：只能引用库里已存在的 evidenceId；缺证据时标 E0 并写明缺口      │
├──────────────────────────────────────────────────────────────────────┤
│ L6 持久化 Persistence            src/app/stores (pinia) + localStorage│
│    职责：当前状态、初始快照、执行历史、学习进度                        │
│    约束：持久化的是「状态快照」，不是「行为规则」                        │
└──────────────────────────────────────────────────────────────────────┘
```

**依赖方向是单向的**（上层可以依赖下层，下层绝不依赖上层）：

```
Presentation → Experiment → Engine → Version Rules
                              ↘ Evidence Repository
Persistence → Engine（只存快照，不产生规则）
```

---

## 2. 目录结构

```
hudi/
├── docs/                       # 本目录：架构、版本矩阵、实验规范、验证矩阵
│   ├── CONTRACT.md             # 并行开发契约（唯一接口依据）
│   ├── architecture.md         # 本文件
│   ├── version-matrix.md       # r26 版本矩阵
│   ├── experiment-standard.md  # 实验页面统一模板
│   └── validation-matrix.md    # 能力 × 证据 × 验证方式
├── src/
│   ├── models/                 # 类型定义（纯 TS，无 Vue 依赖）
│   │   ├── hudi.ts             # 表 / 记录 / File Group / File Slice / Instant
│   │   ├── actions.ts          # SimulationAction 动作联合类型
│   │   ├── evidence.ts         # 证据与能力类型
│   │   └── simulation.ts       # 事件 / 结果 / 实验定义类型
│   ├── engine/                 # 模拟引擎（纯 TS，无 Vue 依赖）
│   │   ├── core/
│   │   │   ├── state.ts        # 状态创建 / 克隆 / 查询 / 分区推导
│   │   │   ├── instant.ts      # instant time 生成（固定 epoch，确定性）
│   │   │   ├── errors.ts       # SimulationError
│   │   │   └── applyAction.ts  # 统一动作调度器
│   │   ├── operations/
│   │   │   ├── rules.ts        # 场景规则表（写入场景 → 文件落点）
│   │   │   ├── writes.ts       # 写入（insert/upsert/bulk_insert/overwrite）
│   │   │   ├── deletes.ts      # 删除（tombstone）
│   │   │   └── services.ts     # compaction / clean / archive / rollback / clustering / ttl
│   │   ├── filesystem/layout.ts# HDFS 目录树与文件命名
│   │   ├── indexes/bucket.ts   # 索引定位规则与分桶
│   │   ├── queries/            # 四种读路径
│   │   ├── templates/          # Spark SQL / Flink SQL / Scala / Shell 模板
│   │   ├── versions/           # r26 版本档案
│   │   └── evidenceMap.ts      # 动作 → 证据 id
│   ├── evidence/               # 证据仓库（华为 r26 + 社区 0.15）
│   ├── experiments/            # 实验定义 + 目录（catalog）+ 注册表（registry）
│   ├── components/             # 可视化与面板组件
│   ├── views/                  # 路由级页面
│   ├── app/                    # 布局、路由、store
│   ├── testing/                # 测试用数据工厂（仅测试引用）
│   └── styles/                 # 设计 token 与全局样式
├── tests/
│   ├── unit/                   # Vitest 单元测试（引擎与目录）
│   └── e2e/                    # Playwright 交互测试
├── vitest.config.ts
├── playwright.config.ts
└── README.md
```

---

## 3. 状态流：action → applyAction → nextState → 渲染

一次交互的完整链路：

```
 用户点击「插入」
        │  （组件只做一件事：派发一个 action）
        ▼
 SimulationAction { type: 'UPSERT_RECORDS', records: [...] }
        │
        ▼
 applyAction(state, action, profile)                 ← src/engine/core/applyAction.ts
        │
        ├─ 1. cloneState(state)          先克隆：失败绝不允许污染原状态
        ├─ 2. dispatch(working, action)   按 action 类型分派到引擎函数
        │        ├─ UPSERT_RECORDS → performWrite()   → 文件落点 + Timeline
        │        ├─ DELETE_RECORDS → performDelete()  → tombstone
        │        ├─ SCHEDULE_COMPACTION → scheduleCompaction()
        │        ├─ RUN_COMPACTION      → runCompaction()
        │        └─ ...
        ├─ 3. 成功 → pushCheckpoint(state, instantTime)   供时间旅行回看
        ├─ 4. diffStates(before, after)   算出「哪些记录/文件/instant 变了」
        └─ 5. 返回 ActionResult
                { success, nextState, events, changes, logs, explanation,
                  evidence, warnings, error? }
        │
        ├─ 失败：nextState === 入参 state（同一个引用，一个字节都没变）
        │
        ▼
 store.dispatch(action)
        │
        ├─ 成功 → lab.state = result.nextState；lab.history.push(result.events[0])
        └─ 失败 → lab.lastError = result.error（界面显示红色告警）
        │
        ▼
 组件 computed → 重新渲染（目录树 / Timeline / 记录表 / 状态对比）
```

### 3.1 关键约定

| 约定 | 出处 | 目的 |
| --- | --- | --- |
| 失败时 `nextState` 与入参**严格相等** | applyAction | 失败绝不留下半截状态 |
| 成功即写 checkpoint | applyAction | 时间旅行 / restore 有据可依 |
| 每次成功都返回 `changes`（StateDelta[]） | diffStates | 「所有状态变化可追溯」 |
| 告警（warnings）与解释（explanation）随结果返回 | 各引擎函数 | UI 只负责展示，不重新推理 |
| 动作 → 证据 id 的映射写死在 `evidenceMap.ts` | 引擎 | 界面上的每个结论都能点到证据 |

### 3.2 状态的三层视图

引擎同时维护三份「真相」，它们刻意不完全等价，这正是教学点所在：

| 视图 | 存放位置 | 含义 |
| --- | --- | --- |
| 逻辑记录视图 | `state.records` | 每个主键的当前生效版本（查询结果的真相） |
| File Group / File Slice | `state.fileGroups` | 当前 Timeline 版本引用的文件集合（文件落点的真相） |
| 物理文件清单 | `state.physicalFiles` | HDFS 上真实存在的文件（含**已取代但尚未 Clean** 的旧文件） |

> 「被取代（SUPERSEDED）」是逻辑变化，「被删除」是物理变化 —— 两者发生在不同的 instant 上。
> 查询引擎刻意**只从 File Group 推导**（而不是直接读逻辑记录视图），
> 这样「读优化模式下看不到 log file 里的更新」才会自然浮现出来。

---

## 4. 引擎不做 UI 规则 —— 原则与反例

### 4.1 原则

1. **文件变化只能由引擎算出来。**
   UI 想知道「这次写入产生了几个文件」，只能读 `state.physicalFiles` / `state.fileGroups`，
   不能自己按「COW 就是重写、MOR 就是追加」去推。

2. **版本差异只能由版本档案查出来。**
   「run clean 在 MRS 3.1.x 能不能用」这类问题，答案来自 `capabilityOf('run-clean-sql')`，
   不是来自组件里写死的 `if`。

3. **结论必须挂证据。**
   引擎返回的每个结果都带 `evidenceIds`；证据 id 只能引用 `src/evidence/` 里已存在的条目。

4. **不确定的事必须显式说「不确定」。**
   r26 未实测的行为，引擎要么不实现，要么返回 `unverified` / `conditional` 并带上 `openQuestion`。
   **不允许**用「看起来对」的行为冒充已确认行为。

5. **失败要明确报错，不能静默降级。**
   不支持的组合（如 BUCKET 索引 + bulk_insert）抛 `SimulationError`，
   错误信息里带上「需要实测确认」的提示，而不是悄悄换个行为继续跑。

### 4.2 反例（这些都不允许出现在 UI 里）

```ts
// ✗ UI 里判断 COW 应该重写文件
if (table.tableType === 'COPY_ON_WRITE') { /* 推算出新文件数 */ }

// ✗ UI 里判断 log file 是否该被 compaction 合并
const shouldCompact = logFiles.length >= 5

// ✗ UI 里硬编码版本差异
const canRunClean = version >= '3.2.0'

// ✗ UI 里自己判断 precombine 谁胜出
const winner = records.sort((a, b) => b.ts - a.ts)[0]
```

正确做法一律是「问引擎」：

```ts
// ✓ 问引擎要结果
const result = lab.dispatch({ type: 'UPSERT_RECORDS', records })

// ✓ 问版本档案要支持状态
const cap = capabilityOf('run-clean-sql')   // → conditional + precondition

// ✓ 问规则表要场景落点
const rule = ruleByKey('MOR_INITIAL_INSERT') // → LOG_ONLY_GROUP
```

### 4.3 「模拟」这条底线的延伸

本项目是**纯浏览器模拟**：不连接任何真实集群，不提交任何 Spark / Flink 作业。
因此：

- 引擎返回的日志里会明确写「本项目为纯浏览器模拟，未连接真实 YARN / Spark 集群」；
- 证据库里 E4（集群实测）条目恒为 0，`hasFieldVerifiedEvidence()` 恒为 false；
- 实验目录里**不允许**出现 E3 / E4 条目（由 `tests/unit/catalog.spec.ts` 断言守住）。

---

## 5. 扩展点一览

| 想加什么 | 改哪里 | 注意 |
| --- | --- | --- |
| 新的写入场景 | `src/engine/operations/rules.ts` 的 `SCENARIO_RULES` | 需要同时补引擎行为与测试 |
| 新的表服务 | `src/engine/operations/services.ts` + `applyAction.ts` 的 dispatch | 失败必须抛 `SimulationError` |
| 新的查询模式 | `src/engine/queries/` | 读路径仍必须从 File Group 推导 |
| 新的 SQL 模板 | `src/engine/templates/` | `evidenceIds` 必须是库里已存在的 id |
| 新的版本能力 | `src/engine/versions/HuaweiMRS350R26Profile.ts` | 无证据的先标 `unverified` |
| 新的证据 | `src/evidence/` | 标注等级、来源、获取方式、验证时间 |
| 新的实验 | 见 [experiment-standard.md](./experiment-standard.md) | 定义 → 注册 → 视图 → 单测 |
