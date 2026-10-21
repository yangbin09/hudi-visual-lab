# 实验页面统一模板

> 本文件规定「一个实验页长什么样」以及「怎么加一个新实验」。
> 目的：让 80 个目录条目里的每一个被实现出来时，**页面的骨架、交互口径与诚实标注都完全一致**。

---

## 1. 六区域骨架

每个实验页固定由六个区域组成。区域顺序即 DOM 顺序（自上而下、左而右）：

```
┌───────────────────────────────────────────────────────────────────────┐
│ ① 概览区                          （ExperimentView 顶部 header）        │
│   标题 · 实验编号 · 难度 · 证据等级徽标 · 支持状态徽标 · 目标版本 · 用时 │
├────────────────┬──────────────────────────────────┬───────────────────┤
│ ② 步骤区        │ ③ 操作区                        │ ⑤ 讲解区           │
│ （左栏）        │ （中栏顶部）                    │ （右栏）           │
│ · 学习目标      │ · 手动动作按钮组                 │ · 参数面板         │
│ · 实验步骤      │ · 当前表类型 / 分区 / 索引徽标   │ · 当前步骤原理解释 │
│   （单步执行 /  │                                  │ · 告警列表         │
│     自动播放 /   │                                  │ · 证据缺口说明     │
│     重新执行 /   │                                  │ · 版本证据面板     │
│     恢复初始）  │                                  │                   │
│ · 边界场景      │                                  │                   │
│  （折叠面板）    │                                  │                   │
├────────────────┴──────────────────────────────────┴───────────────────┤
│ ④ 可视化区                        （中栏中下部）                       │
│   HDFS 目录树 · Timeline 时间轴 · 逻辑记录表 · 执行前后状态对比         │
├───────────────────────────────────────────────────────────────────────┤
│ ⑥ 资源区                          （底部 Tab）                        │
│   SQL · HDFS · Timeline · 日志 · 版本证据 · 练习                       │
└───────────────────────────────────────────────────────────────────────┘
```

### ① 概览区

| 元素 | 要求 |
| --- | --- |
| 标题 | 中文，技术术语保留英文（`COW`、`File Group`、`Timeline`） |
| 证据等级徽标 | 显示 `E0`~`E4`；**本项目不会出现 E3 / E4**（纯模拟项目） |
| 支持状态徽标 | `supported` / `conditional` / `unverified`；`conditional` 时必须写明「待 r26 实测」的原因 |
| 目标版本 | `0.15.0-h0.cbu.mrs.350.r26` |
| 全局警示条 | 固定文案：「纯浏览器模拟，未连接真实集群」——**任何实验页都不得省略** |

### ② 步骤区

- 每个步骤是一个 `ExperimentStep`：`{ stepId, title, description, action, capabilityKey }`。
- 步骤的 `action` 里的 `{{占位符}}` 由控制项的值替换（参数替换，不是 Hudi 规则）。
- 步骤必须能**单独执行**、能**重新执行**、能**恢复初始状态**。
- 「边界场景」面板逐条给出：**现象描述** + **预期结果**（预期必须写死，不允许「可能」「视情况」）。

### ③ 操作区

- 按钮只做一件事：派发一个 `SimulationAction`。
- 按钮旁必须写清「每个按钮只做一件事：派发一个 SimulationAction 给引擎」。
- 手动动作按钮的命名格式：`动作（主键 1004）` / `动作（主键 1001）` 这种**带目标主键**的形式，
  避免学习者点完不知道动了哪条数据。

### ④ 可视化区

| 视图 | 必须能看出 | 备注 |
| --- | --- | --- |
| HDFS 目录树 | base / log 区分、ACTIVE / SUPERSEDED 区分、`.hoodie` 目录 | 必须显示 `SIMPLIFIED_NOTE`（简化教学显示） |
| Timeline | action + state；`REQUESTED` / `INFLIGHT` 用警示色 | 判断 compaction 成败只看这里 |
| 逻辑记录表 | 业务字段 + `_hoodie_*` 元字段；`I` / `U` / `D` 徽标 | tombstone 默认可见（并说明它仍然占空间） |
| 执行前后对比 | 有效 File Group / 被取代的 / 物理文件数 / 待 Clean 数 / 可见记录数 / instant 数 | 基准来自 `state.checkpoints` |

### ⑤ 讲解区

- 原理解释来自引擎返回的 `explanation`，**UI 不自己重写结论**。
- 告警区原样展示引擎返回的 `warnings`（例如「precombine 值更小，按 Hudi 语义忽略」）。
- 证据缺口：目录条目的 `note` 字段（如有）必须以警示条形式出现在页面上。
- 证据面板按 `E0`~`E4` 分色，链接可点开原文。

### ⑥ 资源区

| Tab | 内容 |
| --- | --- |
| SQL | 当前实验相关的模板（Spark SQL / Flink SQL / Scala / Shell），带状态徽标与证据链接 |
| HDFS | 目录树的全宽视图 |
| Timeline | 时间轴 + instant 明细表 |
| 日志 | 模拟执行日志（终端风格） |
| 版本证据 | 证据明细 |
| 练习 | 判分与解析；判分结果写回学习进度 |

---

## 2. 新增一个实验的步骤

以新增目录条目 `C07` 为例。

### 步骤 1：写定义文件

新建 `src/experiments/write/C07Xxx.ts`，导出一个 `ExperimentDefinition`：

```ts
export const C07: ExperimentDefinition = {
  id: 'C07',
  title: '中文标题，技术术语保留英文',
  moduleId: 'C',                       // 必须是目录里的模块 id
  catalogIds: ['C07'],                  // 关联的目录编号
  learningObjectives: ['……', '……'],
  difficulty: '入门' | '进阶' | '高级',
  estimatedMinutes: 20,
  prerequisites: ['……'],
  targetVersion: '0.15.0-h0.cbu.mrs.350.r26',
  supportState: 'supported' | 'conditional' | 'unverified' | 'unsupported',
  evidenceLevel: 'E0' | 'E1' | 'E2',   // 不得使用 E3 / E4
  steps: [...],
  controls: [...],
  edgeCases: [...],
  quiz: [...],
  evidenceIds: ['EV-...'],              // 必须是 src/evidence 里已存在的 id
  createState: () => createC07State(),
}
```

**初始状态必须走引擎的写入通道**（`applyAction`），不能自己拼 `records`：

```ts
export function createC07State(): HudiTableState {
  const state = createInitialState(buildC07Table())
  const result = applyAction(state, { type: 'UPSERT_RECORDS', records: buildSeedRecords() })
  if (!result.success) throw new Error(`C07 初始数据写入失败：${result.error}`)
  return result.nextState as HudiTableState
}
```

### 步骤 2：注册

在 `src/experiments/index.ts` 里注册：

```ts
import { C07 } from './write/C07Xxx'
registerExperiment(C07)
export { C07 }
```

注册是幂等的（同一个 id 重复注册以最后一次为准）；
`getExperimentById(id)` 支持按 `id` 精确匹配，也支持按 `catalogIds` 兜底匹配。

### 步骤 3：登记目录条目

在 `src/experiments/modules/C.write.ts` 里加一条 `CatalogEntry`：

```ts
{
  id: 'C07',
  moduleId: 'C',
  title: '……',
  summary: '……',
  implemented: true,
  experimentId: 'C07',
  evidenceLevel: 'E1',
  supportState: 'conditional',
  evidenceIds: ['EV-COMM-...'],
  note: 'r26 上的实际行为仍需实测校正。',   // conditional / unverified 时必填
}
```

### 步骤 4：视图接入

- 通用实验：只要 `ExperimentDefinition` 齐全，`ExperimentView` 会自动渲染六区域骨架，**不需要改视图代码**。
- 需要专属交互（例如参数改变要重建表状态）时：
  - 在 `src/experiments/<模块>/<ID>.ts` 里导出「控制项 → 状态工厂」的映射（参考 `B02_STATE_FACTORIES`）；
  - 在 `ExperimentView.vue` 里按 `experimentId` 接入（**只写参数替换与工厂调用，不写 Hudi 规则**）。

### 步骤 5：补单测

| 覆盖点 | 放在哪 |
| --- | --- |
| 引擎行为（新场景、新规则） | `tests/unit/<主题>.spec.ts` |
| 需要复用的表定义 / 种子数据 | `src/testing/factories.ts`（唯一的测试数据工厂） |
| 目录条目数量 / 等级 / 证据引用 | `tests/unit/catalog.spec.ts`（已覆盖，新增条目自动被断言） |
| 交互流程 | `tests/e2e/interaction.spec.ts` |

自检命令：

```bash
npx vitest run tests/unit
```

### 步骤 6：更新文档与证据

- 新增的证据条目写进 `src/evidence/`，并标好等级、来源、获取方式、验证时间。
- 在 [validation-matrix.md](./validation-matrix.md) 的「尚未完成的验证项」里登记待实测点。
- 涉及版本差异的行为，先在版本档案里登记能力键，再在引擎里查档案，不要硬编码。

---

## 3. 写作规范（避免 AI 味与过度声明）

| 规则 | 反例 | 正例 |
| --- | --- | --- |
| 技术术语保留英文 | 「重写文件组」 | 「重写 File Group」 |
| 预期结果写死 | 「通常会看到 4 条记录」 | 「可见记录 3 → 4」 |
| 不确定就说不确定 | 「r26 上也是这样」 | 「r26 上尚未实测确认，界面标注待验证」 |
| 不用 emoji 当主要图标 | 「🗑️ 删除」 | Element Plus `<el-icon>` 或纯 CSS/SVG |
| 讲「为什么」才写注释 | 「// 循环」 | 「// 失败绝不能留下状态变更：先克隆再操作」 |
| 每个结论挂证据 | 「Hudi 会自动 compaction」 | 「华为《Hudi数据表Compaction规范》建议每 2~4 小时调度一次（`EV-HW-RUN-COMPACTION`）」 |

---

## 4. 自查清单（提交前逐条过）

- [ ] 页面六区域齐全，警示条写着「纯浏览器模拟，未连接真实集群」
- [ ] 证据等级 ≤ E2，支持状态如实填写
- [ ] `conditional` / `unverified` 的条目都写了 `note` 说明缺口
- [ ] 边界场景的「预期结果」是确定的一句话，不是「可能」
- [ ] 练习题覆盖了本实验的核心结论，且解析说明了「为什么」
- [ ] 引用的 `evidenceIds` 都能在 `src/evidence/` 里找到
- [ ] 初始状态走引擎写入通道（File Group / Timeline 不是手工拼的）
- [ ] `npx vitest run tests/unit` 全绿
- [ ] 文档（验证矩阵 / 版本矩阵）里同步了本次新增的能力与证据
