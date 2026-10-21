# 03 · 交互结构 · 信息架构 · 前端实现审计

> 审计对象：`D:\code\hudi演示\hudi-visual-lab`（Vue 3 + Vite + Pinia + Element Plus）
> 审计方式：只读源码审阅 + Playwright(msedge) 对运行中站点 `http://127.0.0.1:5173/` 实测
> 桌面视口 1440×900 / 1366×768 / 768×1024，移动端 375×812；主题默认深色，另测浅色
> 复现材料：`_analysis/ia-probe.mjs`、`_analysis/ia-probe2.mjs`、`_analysis/ia-probe.json`、`_analysis/shots/ia-*.png`
> 约束遵守：未修改 `src/` 下任何文件

---

## 一句话结论

**「不直观、不清晰、不详细」不是文案问题，是三层结构塌陷：**

1. **内容与界面被砍到最小公约数**：80 个主题的数据模型只有「约 4 步 × 每步 1 句平均 21 字的 caption」（`src/experiments/visual/lessons.ts`，315 步/78 主题，caption 中位 20 字），而项目里真正"详细"的界面（FileTreeView、TimelineView、RecordTable、QuizPanel、StepRunner、ControlPanel…约 5900 行）全部挂在**没有路由的死视图** `ExperimentView.vue` 上——**详细内容存在，但在 DOM 之外**。
2. **讲解层被折叠到抽屉第 2 层**：首屏 47% 面积给画布，最重要的"为什么"只占 70px×13px 一行旁白；参数 1 击可达但是覆盖式 620px 抽屉，技术详情要 2 击 + 7 个 tab，Timeline 还只是 `JSON.stringify` 原文。学生看完动画**没有地方能继续追问**。
3. **全局学习结构缺失**：80 个主题页不写任何进度（访问 3 个主题后 `localStorage` 仍为空），`/progress` 与 `/evidence` 在视觉实验室里没有入口（`App.vue:23,31-33` 只给非 visual 路由套 MainLayout），首页只有 8 个手挑主题 + 1 个 B02 精选，没有学习路径、难度、术语表、自测——**没有"我学到哪、下一步学什么"的坐标系**。

---

## 审计口径与关键测量（问题清单的证据基线）

### A. `/experiment/:id`（78 个主题走 `LessonView`）首屏 DOM 顺序与实测尺寸（1440×900，B05）

| # | DOM 节点 | class | 首屏位置/高度 | 字号 | 备注 |
|---|---|---|---|---|---|
| 1 | header | `.vl-nav` | y0 h68 | 17/12px | 品牌、←全部动画、模式、主题、⚙参数 |
| 2 | 标题行 | `.lesson-heading` | y90 h72 | eyebrow 10px / h1 27px | 标题 + 「引擎驱动 ↗」11px |
| 3 | 画布舞台 | `.lesson-stage` | y179 **h531** | 舞台条 10px | 内含画布/旁白/技术详情入口 |
| 3.1 | 画布 | `.lesson-canvas` svg | y219 **h420 · 1366×420** | 场景内 SVG 文字 11–17px | 占视口 46.7%，画 1 个 Base 文件 + 1 个 Writer |
| 3.2 | 旁白 | `.lesson-explanation` | y639 **h70** | 正文 13px，1 行 21px | 唯一讲解区；左侧 27px 步骤号 |
| 4 | 播放条 | `.lesson-playbar` | y710 h65 | 12px / range 4px | 播放、单步、进度、速度、重置、跳到结果 |
| 5 | 章节导航 | `.lesson-chapters` | y775 h50 | 11px | 5 个 button，等宽 |
| 6 | 底部信息 | `.lesson-bottom` | y825 h32 | 10px | 指标 + 上一/下一主题 |
| 7 | footer | `.vl-footer` | y865 h35 | **9px** | 版本、证据入口、快捷键提示 |

- 无滚动：`scrollHeight = 900 = innerHeight`；1366×768 下画布压缩到 327px 仍完整可见；768×1024 下画布 549px。
- 结论：**画布占 47% 视口高度（含舞台条 59%），讲解只占 8%**；首屏没有任何"本课目标 / 术语 / 图例 / 为什么"，学生视线落点是中间的大面积空白和一个小文件卡片。

### B. 两套 `/experiment` 实现（同一条路由族）

| 路由 | 组件 | 实测结构 | 交互语法 |
|---|---|---|---|
| `/experiment/B02`、`/experiment/B03` | `src/views/VisualLabView.vue`（148 行，硬编码 COW/MOR） | 标题行 h87 → 双泳道画布 h543 → 播放条 h59 → 动作条 h52（无章节导航） | Writer/文件块、5 个动作按钮、6 个 tab |
| 其余 78 个 | `src/views/LessonView.vue`（142 行承载全部 78 主题） | 标题行 h72 → 单场景画布 h531 → 播放条 h65 → 章节导航 h50 | 画布图元、播放、参数、7 个 tab |

- B03 与 B02 渲染**同一个组件、同一个面包屑"02 · COW 与 MOR"**（`VisualLabView.vue:80`），B03 没有独立内容。
- 首页精选卡与 8 个主题直链推的正是 B02（`VisualHomeView.vue:14-15`）——这是全站信息密度最高的唯一页面，其余 78 页明显更薄，**首因效应 = 期待落差**。

### C. 数据模型深度（"不详细"的量化根因）

| 指标 | 实测值 | 来源 |
|---|---|---|
| 有 animation 的主题 | 78（+B02/B03 定制 = 80） | `lessons.ts` |
| 每主题步骤数 | 平均 4.04 步（315 步 / 78 主题） | `lessons.ts` 正则统计 |
| 每步讲解文案 | 平均 21 字、中位 20 字、最长 62 字 | 同上 |
| 每主题教学节点 | 平均 4.2 个 | 同上 |
| 主题级学习字段 | 无目标/无难度/无前置/无术语/无自测 | `CatalogEntry` 仅 10 字段（`catalog.ts:38-59`） |
| 已被写出但无入口的"详细"字段 | difficulty / estimatedMinutes / prerequisites / learningObjectives / quiz / edgeCases | `models/simulation.ts`，仅 `ExperimentDefinition` 拥有 |

**一个主题在数据层能提供的全部解释 ≈ 4 × 21 = 84 个汉字**；UI 再精致也不可能"详细"。

---

## 逐题速答（8 问索引）

| 问题 | 结论摘要 | 详见 |
|---|---|---|
| 1 首屏信息优先级 | 结构倒置：画布 420px / 讲解 70px；技术详情入口 10px；无学习目标与图例 | P0-1、P0-2 |
| 2 模式切换语义 | **假开关**：LessonView 仅 2 处文案、DOM 节点数变化 0；VisualLabView 仅多 1 个「模拟失败」按钮 | P0-3 |
| 3 可发现性 | 参数 1 击（覆盖式抽屉）；技术详情 2 击 + 7 tab；Timeline 是 JSON；源码透视渲染出字面 `\n`；HDFS 下钻丢失 tab 且无返回 | P1-1 |
| 4 图元交互语义 | 6 个实测图形：文件块可点/有可见提示；时间轴点、流程节点可点但无提示；指标柱、配置卡可点无提示；Writer/Input/泳道标题"像能点"实际不可点；进度未提交时结果行 `cursor:pointer` 但点击无效 | P1-2 |
| 5 进度与反馈 | 80 主题不写进度；`localStorage` 空；`/progress` 恒为 0；动画状态不持久化；无"已看/已掌握" | P0-4 |
| 6 无障碍与键盘 | Enter 打开图元详情后**立刻被自身关闭**；焦点陷阱会漏；对话框无 accessible name；浅色 muted 对比度 3.75/4.09；9–11px 文本大量存在 | P1-3 |
| 7 移动端策略 | 只有 3 个断点（1600/850/550），<850 仅缩字号+换行；画布 0.32 缩放（17px→5.5px 实际像素）；章节横向滚动 636>351；22 个触控目标 <44px | P1-4 |
| 8 实现层可维护性 | 模板最长单行 1522 字符；CSS 单行 7538 字符；4 份重复导航；324 处硬编码色；80 处 inline style；无 i18n；约 5900 行死代码 | P0-1、P2-1、P2-2、§代码重构前置项 |

---

## 问题清单（按严重度）

### P0-1 内容与界面被"最小化"：最详细的教学 UI 全部不在路由里

**证据**

- 路由表只有 7 条（`src/app/router/index.ts:20-55`），`/experiment/:id` 全部指向 `LessonView.vue` 或 `VisualLabView.vue`；`ExperimentView.vue`（960 行）、`DashboardView.vue`（280 行）**没有任何路由引用**。
- 实测组件引用图：`ExperimentShell.vue(299)`、`StepRunner.vue(219)`、`ControlPanel(103)`、`EdgeCasePanel(137)`、`QuizPanel(231)`、`FileTreeView(740)`、`TimelineView(516)`、`TimelineTable(338)`、`RecordTable(376)`、`SqlPanel(89)`、`SqlBlock(348)`、`LogPanel(66)` 只被 `ExperimentView.vue` 引用；`FileDetail.vue(546)`、`BucketView(572)`、`CapabilityBadge(86)`、`ExperimentShell` 连引用都没有。合计约 **5900 行已实现但不可达**。
- 这些组件承载的恰是"详细"：HDFS 文件树、文件内记录表、Timeline 表、SQL 代码块、练习题、边界场景、学习目标、难度、预计时长、前置知识（`ExperimentShell.vue:165-198` 有完整字段渲染）。
- 首屏唯一讲解是 13px 单行（见测量 A）；每主题内容深度只有 4×21 字（测量 C）。
- 死代码直接造成误导：`/progress` 的"难度"列对 80 主题永远显示 `—`（`ProgressView.vue:58`），因为难度只存在于死掉的 `ExperimentDefinition`。

**改法（组件级）**

1. 新建 `src/views/lesson/` 目录，把 `LessonView` 拆成 5 个块（见重构前置项 1），其中新增 `LessonDetailDock.vue` 作为**页内常驻详情区**（桌面右侧 320–360px / 移动端底部 sheet），默认显示"本步解释 + 关键数字 + 术语"，而不是只放一行旁白。
2. 复活死代码：`FileTreeView`/`TimelineView`/`RecordTable`/`SqlBlock`/`QuizPanel` 适配为 `LessonDetailDock` 的 tab 内容（它们的数据源是 `HudiTableState`，与 `LessonCanvas` 同源，改造成本低）；`ExperimentShell` 的"学习目标 / 难度 / 前置知识"字段提升为 `CatalogEntry` + `VisualLesson` 的正式字段，在标题下方常驻。
3. 内容层：`lessons.ts` 的 `LessonStep` 增加 `detail`（3–5 句）、`why`、`termIds[]`、`check`（1 题自测）；至少先把 315 条 caption 扩写成 2 段（现象 + 原因）。没有内容字段，任何 UI 重构都会回到"一行字"。

---

### P0-2 首屏信息优先级倒置：画布 70%，讲解 8%，入口 10px

**证据**

- 测量 A：画布 420px（46.7% 视口）+ 舞台条 39px；讲解 70px；"技术详情"按钮字号 **10px**、颜色 muted（`LessonView.vue:116`），参数按钮在导航 12px（`:112`）。
- DOM 顺序把"技术详情"放在画布**上方**的舞台条里（y219 前），但视觉上只有 10px 灰字，实测对比度不低（6.04:1）但字号/层级不足以被发现。
- 同一处文案在 B02 页面是 12px 白色（`VisualLabView.vue:84` 的 `.vl-details`），排版也不一致。
- B05 画布中只有 1 个 Base 文件 + 1 个 Writer + 1 个预览文件；`AnimatedFiles.vue:41` 明确写"图中最多显示四个文件"，但大多数步骤只画 1–2 个，**画布大而空**。
- `lesson-chapters`（章节导航，11px，y775）在播放条**下方**，逻辑上应属于"我正在看第几步"，却排在最不显眼的底部。

**改法**

- 重排 `.lesson-main` 为：`课程头（目标 + 难度/时长/前置 + 证据徽标）→ 三段式主区（左：术语/图例/前置回顾；中：画布；右：本步讲解+关键数字+"为什么"）→ 播放条 → 章节（横条或下拉，移到播放条上方并加当前步高亮）→ 详情 dock → 自测 → 上下主题`。
- 画布内补：①图例常驻（当前只有 B02 舞台条有 `● Base / ● Log / ● 旧版本`，见 `VisualLabView.vue:86`；LessonView 78 个主题无图例）；②本步"变化量"数字卡（记录数/文件数/instant 状态，复用 `stateMetrics`）；③"上一步 / 下一步"文案化。
- 技术详情入口字号 ≥12px、放在画布右上与讲解区底部两处，并标出"包含 Timeline / HDFS / SQL"（现在工程师模式下才改文案，等于把发现成本转嫁给用户先点一个假开关）。

---

### P0-3 基础模式 / 工程师模式是**近乎空开关**

**精确 diff（实测 + 源码）**

| 项目 | LessonView（78 主题） | VisualLabView（B02/B03） |
|---|---|---|
| 状态定义 | `engineer = ref(false)`（`:24`）**不持久化、不进 URL、刷新即丢失** | `engineer = ref(false)`（`:17`） |
| 模板条件 | 仅 2 处：`:112` 按钮文案、`:116` 舞台条按钮文案 | 仅 3 处：`:81` 按钮文案、`:84` 详情按钮文案、`:125` `v-if="engineer"` 显隐「模拟失败」按钮 |
| 实测 DOM 节点数变化 | **0** | **+1**（模拟失败按钮） |
| 实测文本变化 | 只增 `工程师模式 / SQL / HDFS / Timeline`，只减 `基础模式 / 技术详情` | 同上 + `模拟失败` |
| 参数面板 | 不变（同样 2–3 个控件） | 不变（同样 1 个金额输入） |
| 抽屉 tab 集合 | 不变（恒为 7 个） | 不变（恒为 6 个） |
| 画布/旁白/日志 | 完全不变 | 完全不变 |
| CSS 类切换 | 无 | 无（`.active` 只是按钮高亮，`:81`） |

**结论：这是"假开关"**——用户点它只会看到两个按钮换字，认知上被承诺了"模式差异"，实际什么也没发生，反而降低了信任。

**值得做成什么样的双模式（建议）**

| 维度 | 基础模式（默认，学生） | 工程师模式（排障/对照源码） |
|---|---|---|
| 旁白 | 现象 + 原因（2 段）+ 1 个比喻 + 术语内联解释 | 保留基础旁白，追加引擎动作名 / instant / 文件全名 |
| 画布 | 只画 3–5 个核心图元 + 图例 + 变化箭头 | 叠加 File ID、instant time、bucket、log version、记录级 ts |
| 参数 | 1–2 个"试一试"参数（主键/金额），应用后自动重放 | 全量参数常驻右栏（表类型、分区、桶数、保留数、失败注入） |
| 详情 | 常驻"本步解释 / 术语 / 自测"3 个入口 | 展开全部 7 tab：Timeline 表、HDFS 文件树、运行日志、SQL、源码透视、证据 |
| 失败注入 | 不出现 | 「模拟失败」+ 错误卡 + 回滚路径 |
| 状态 | `ui.mode` 存 store + `?mode=` query，可分享 | 同左 |

实现：新增 `src/app/stores/ui.ts`（`mode: 'basic' | 'engineer'`，持久化），`LessonView` 只消费该状态；模式必须**同时**影响 5 个渲染块（旁白/画布/参数/详情/失败），而不是只改 `v-if` 文案。

---

### P0-4 学习进度对 80 主题永久为空，且入口不可达 —— 「学完了没有」无从回答

**证据**

- `lab.progress` 仅由两处写入：`loadExperiment()` 内的 `markVisited`（`lab.ts:188,305-317`）与 `setQuizScore`（`lab.ts:289-302`）；`loadExperiment` 只被**死视图** `ExperimentView.vue:262-264` 调用。
- 80 主题页 `LessonView.vue` 对 store 的使用只有主题（`import useLabStore` `:8`、`lab.darkMode`/`toggleTheme` `:111-112`），**从不 markVisited、从不写进度**。
- 实测：连续访问 B05（完整播放）、T01、S01 后 `localStorage` keys = `[]`，`hudi-lab-progress` = `null`；`/progress` 显示 `已访问实验 0 / 已完成 0 / 平均得分 0 / 满分 0`，表格 0 行，空态文案"还没有任何学习记录"。
- 进度页分母是 80（`ProgressView.vue:96-100` 遍历 `CATALOG`），分子永远 0 → **所有模块恒为 0%**。
- 入口：视觉页面（首页/目录/主题页）到 `/progress` 的链接数实测 **0**（首页 links 只有 `/`、`/catalog`、`/experiment/*`）；`/progress`、`/evidence` 只在 `MainLayout` 左栏有入口（`MainLayout.vue:83-87`），而 `App.vue:23,31-33` 只在**非 visual 路由**才渲染 MainLayout → 两页实际必须手输 URL。
- 动画状态：`useLessonPlayer` 只有内存中的 `position/started`，无持久化（全文件 56 行）；离开页面即回到 0；没有 `step-completed` 之类事件可供记录。
- store 字段清单：`currentExperimentId, initialState, state, history, running, lastError, progress{done,visited,quizScore}, darkMode`（`lab.ts:129-146`）——**没有 watched / mastered / stepReached / lastSeenAt**。

**改法**

1. `LessonView` 挂载即 `markVisited(id)`；`player.done` 变 true 时 `markWatched(id)`；记录 `furthestStep`。
2. `LabProgressEntry` 扩为 `{ visited, watched, done, stepReached, stepCount, quizScore, updatedAt }`（`lab.ts:37-41`），并区分"已看 ≠ 已掌握"（掌握 = 完成自测）。
3. 新增 `LessonProgress` store 持久化播放位置（`hudi-lab-lesson-state:<id>`），返回主题时可提示"上次看到第 3 步，继续？"。
4. `/progress` 与 `/evidence` 并入视觉实验室体系：统一 `VisualNav`（含"学习进度/术语表/证据库"），并在首页增加"继续学习"卡与模块完成度；`ProgressView.vue` 的难度列改为读新 `CatalogEntry.difficulty`。
5. 侧栏 `implemented` 口径修正（见 P1-5），否则即便进度修好，用户仍会看到 78 个"未实现"条目。

---

### P1-1 可发现性：参数与技术详情分别藏在"覆盖式抽屉"的第 1、2 层，Timeline 主干没有前置

**点击路径实测**

| 目标内容 | 路径 | 层级 | 实测 |
|---|---|---|---|
| 参数面板 | 导航栏「⚙ 参数」（12px）→ 覆盖在画布右侧的 620px `<dialog>`（播放暂停） | 1 击 | 表单只有 2 输入 + 1 复选框（B05）；含"应用后重新建立场景并重置演示"（`:127`） |
| 技术详情 | ①舞台条「技术详情 ↗」（**10px**）或 ②标题右侧「引擎驱动 ↗」（11px，**标签语义误导**：看起来是模型徽标）→ 抽屉 620px → 再点 tab | 2 击 | 7 tab：技术详情/运行日志/HDFS/Timeline/SQL/源码透视/证据（`:129`） |
| Timeline（本主题主干） | 上述 2 击 → 点第 4 个 tab | 3 层 | 内容是 `<pre>{{ JSON.stringify(state.timeline,null,2) }}</pre>`（`:133`）——不是时间轴，而是一段原始 JSON；B02 页却是表格（`VisualLabView.vue:136`） |
| HDFS 文件详情 | 技术详情 → HDFS tab → 点文件行 | 4 层 | 抽屉内容被替换成"查看对象"（`:132`→`:128`），**tab 栏消失、无返回、无面包屑**，只能关闭重开 |
| 源码透视 | 技术详情 → 源码透视 | 3 层 | 模板里写的是字面 `\n`（`:135`），渲染为一行 353 字符的连续文本（实测 `literalBackslashN: true`；`VisualLabView.vue:137` 同样问题） |
| 证据 | ①footer「教学模型…↗」（**9px**）或 ②技术详情→证据 tab | 1–3 层 | 两套入口文案不同（`:125` vs `:129`），同一内容 |
| 学习进度 / 证据库 | **无入口**（见 P0-4） | ∞ | 实测 0 链接 |

- 舞台条提示"点击图形查看数据"（`:116`）是**全局承诺**，但实测并非所有图形可点（见 P1-2），属于"承诺 > 实现"。
- 首次使用者不可能在 5 秒内找到 Timeline，而 Timeline 恰是 Hudi 最核心的心智模型（项目自己在首页写"Timeline 如何管理事务"）。

**改法（组件级）**

1. 画布右侧常驻 `LessonTimelineStrip.vue`：横向 Instant 条 + 当前 instant 高亮 + action/state 文案（数据来自 `state.timeline`），点击展开完整表（复用死代码 `TimelineView.vue`）。**先把主干前置，再谈 tab。**
2. 抽屉改为"页内 dock"（桌面右栏 / 移动端底部 sheet），tab 用任务语言命名并分组：`解释`（本步解释/为什么/术语）｜`数据`（HDFS/Timeline/记录）｜`代码`（SQL/源码）｜`依据`（证据/版本）；默认展开"解释"。
3. HDFS 下钻改为 dock 内二级面板（带面包屑与返回键），不要替换整个抽屉。
4. 「引擎驱动 ↗」改为纯徽标（`<span>` + tooltip），详情入口统一为一个；修复 `\n` 为真实换行（改成数组 + `v-for`）。
5. 参数面板：基础参数放进讲解区下方常驻"试一试"卡（改金额→自动重放），高级参数（桶数/保留/失败注入）只在工程师模式侧栏出现；应用后给出"参数已生效"的 `role=status` 提示（现在只有底部 10px notice）。

---

### P1-2 图元与交互语义：6 个实测图形里 4 个"能点但没提示"，3 类"看起来能点却不可点"

**实测（Playwright，B05 / B07 / S01 / F04 / T01 / A01，5 类图形）**

| 主题/图形 | 可点 | 命中后 | 光标 | 可见提示 | 可访问名 | tooltip |
|---|---|---|---|---|---|---|
| B05 文件块 `g.file-glyph` | ✅ | 抽屉「文件名 · 记录表」（343 字） | pointer | ✅ "当前版本 · 点击查看" | aria-label | ❌ `title=""` |
| B05 未提交的输出文件 | ❌（正确） | 无 | default | ✅ "生成预览 · 尚未提交" | `aria-disabled=true` | ❌ |
| B05 Writer 方框 `.ac-worker` | ❌ | 无 | auto | ❌ 无 | 无 | ❌ |
| B07 查询文件块 | ✅ | 抽屉（文件 + 读取判断） | pointer | ✅ "✓ 打开文件" | aria-label | ❌ |
| S01 Timeline 圆点 | ✅ | 抽屉「instant · action」 | pointer | ❌（只有舞台条泛提示） | aria-label | ❌ |
| F04 流程节点 | ✅ | 抽屉「节点说明」 | pointer | ✅ "点击查看" | aria-label | ❌ |
| T01 配置卡（`AnimatedSchema` 右侧 3 卡） | ✅（JS 命中实测） | 抽屉「配置值」 | pointer | ❌ 无 | aria-label | ❌ |
| A01 指标柱（`AnimatedMetrics`） | ✅（JS 命中实测） | 抽屉「指标 前后值」 | pointer | ❌ 无 | aria-label | ❌ |
| B02 Writer/Input 方框、泳道标题 | ❌ | 无 | auto | ❌ | 无 | ❌ |

- **"看起来能点但点不动"**：`AnimatedQuery.vue:33` 的结果行、`RecordWalkthrough.vue:44` 的输出行在未提交前 `tabindex=-1` 且点击 no-op，但类名仍是 `.ac-clickable` → `cursor:pointer`（`lessons.css:58`），没有任何 `aria-disabled` 的视觉/光标反馈（对比 `FileGlyph` 有专门规则 `lessons.css:135`）。
- **"能点但没提示"**：时间轴圆点、指标柱、配置卡没有可见交互提示；只有 `aria-label`，鼠标用户没有任何线索。
  - 验证口径：T01/A01 的图形用「合成 click 命中 `<g>`」确认 `inspect` 链路可用；Playwright 对 `<g>` 包围盒中心做强制点击时未触发（SVG 命中测试/合成事件差异，非应用逻辑缺陷），故不据此判为 bug，只保留"无可见提示"这一确定结论。
- 焦点顺序实测（前 12 个 Tab）：品牌 → ←全部动画 → 基础模式 → **主题切换** → ⚙参数 → 引擎驱动 → 技术详情 → 画布文件块 → 播放演示 → 下一步 → 进度 → 速度。
- **没有图例**：78 个主题的画布没有"Base/Log/旧版本/新文件"图例（B02 有，`VisualLabView.vue:86`），颜色语义（绿=Base、棕=Log、灰=旧）只能靠猜。
- **无 hover tooltip**：全部 SVG 图元实测 `title` 为空；`FileGlyph` 只有 aria-label。
- 图元数量少（平均 4.2 个节点）+ 无交互提示 → 画布"可玩性"远低于预期。

**改法**

1. 建立统一交互契约组件 `src/components/visual/InteractiveNode.vue`（Vue 包装 `<g>`）：统一 `role="button"`、`tabindex`、`aria-disabled`、`title`、hover 描边、`:focus-visible`、`data-hint`；所有 `Animated*.vue` 改用该组件，删除 6 处各自实现的 `@click/@keydown`。
2. 顶部加 `CanvasLegend.vue`（常驻、可折叠），从 lesson 数据推导（有无 Log、有无旧版本）。
3. 所有可点图元加 `title`/tooltip：`文件名 · 状态 · 记录数`、`Instant · action · state`、`指标 前→后`。
4. 未就绪态统一 `aria-disabled + cursor:default + 半透明 + "提交后可查看"`（把 `AnimatedQuery`/`RecordWalkthrough` 的 `.ac-clickable` 条件化）。
5. 舞台条提示改为由画布上报"本步有几处可交互"（如"3 处可点：文件 ×1，节点 ×2"），避免泛承诺。

---

### P1-3 无障碍与键盘：Enter 打开详情会被自己关闭、焦点陷阱会漏、浅色主题多处 <4.5:1

**实测**

1. **Enter 激活图元的 bug（P1）**：键盘聚焦画布文件块后按 Enter，事件序列为 `keydown(Enter) → dialog OPEN → 浏览器合成 click 落在对话框内的「关闭详情」按钮 → dialog CLOSED`——抽屉"一闪而过"。Space 正常。原因是 `FileGlyph.vue:7` / `AnimatedProcess.vue:39` / `AnimatedTimeline.vue:20` 等用 `@keydown.enter` 打开抽屉，而 `showModal()` 把焦点放到第一个可聚焦元素（关闭按钮），Enter 默认动作在同一按键周期内点击它。修复：在 `open()` 中 `event.preventDefault()` + 打开后 `focus()` 到面板标题/内容区，或改用 `@keydown.enter.prevent`。
2. **快捷键在按钮聚焦后失效**：实测点击播放按钮后按 →，进度条 `0.17 → 0.17`（不变）；原因是全局 `keyboard()` 遇到 `button`/`[role=button]` 直接 return（`LessonView.vue:100-106`）。快捷键应只排除文本输入，或在 window 层处理并 `preventDefault`。
3. **焦点顺序**：实测 Tab 序列（前 12 个）：品牌 → ←全部动画 → 基础模式 → 主题 → ⚙参数 → 引擎驱动 → 技术详情 → **画布文件块** → 播放演示 → 下一步 → 进度 → 速度。即"技术详情/参数"排在主内容之前，且画布图元夹在播放控件之前；画布内可聚焦图元只有 1–5 个，尚可，但没有 skip-link（实测 0 个）。
4. **对话框**：原生 `<dialog>` 无 `aria-labelledby`/`aria-label`（`LessonView.vue:126`）→ 无 accessible name；焦点落在「关闭详情」按钮；16 次 Tab 的焦点位置序列 `1111011111011111` → **有 2 次落出 dialog**（inert 之外/BODY），焦点陷阱不完整。
5. **aria-live**：仅 1 处 `aria-live="polite"`（旁白，`:118`）；动画播放时每帧/每步刷新文本，无 `aria-atomic`，屏幕阅读器会被连续打断；播放状态（正在演示/暂停/完成）无 live 区；`role=status` 仅用于参数提示（`:122`）。
6. **SVG 语义**：`<svg role="img" aria-label="…动画">`（`LessonCanvas.vue:20`）内部又放 `g role="button"`——`role=img` 会把后代当 presentational，AT 可能读不到可交互节点；`svg[role=img]` 无 `<title>`（实测 hasTitle=false）。
7. **prefers-reduced-motion**：根节点加 `vl-reduced`（实测 className 含 `vl-reduced`），CSS 关闭动画（`visual-lab.css:89`），`play()` 改为单步（`useLessonPlayer.ts:29`）；但参数面板里的"减少动态效果"是 local 状态与系统偏好共用，系统偏好下用户取消勾选会覆盖 media（可接受，需在文档说明）。
8. **对比度（实测计算值）**：

| 前景/背景 | 比值 | 用在哪些组件 |
|---|---|---|
| 浅色 `--vl-muted #738178` / `--vl-bg #f4f6f0` | **3.75:1** ❌ | `.vl-breadcrumb`、`.vl-eyebrow`、`.lesson-nav-link`、`.lesson-model`、`.lesson-bottom` 链接、`.vl-footer`（9px）、`lesson-chapters` 外框、首页/目录次级文案 |
| 浅色 `--vl-muted` / `--vl-panel #fff` | **4.09:1** ❌ | `.lesson-stage-bar`（10px）、`.lesson-explanation small`（11px）、SVG `.ac-section`（13px）/`.ac-meta`（11–12px）、`.index-case-tools` |
| 深色 `--vl-muted #93a49e` / panel `#1b2429` | 6.04:1 ✅ | 同上（深色安全） |
| `--color-ev-E0 #6e7681` 文字 / 深色 panel `#161b22` | **3.77:1** ❌ | `EvidencePanel.vue:133-139` 徽标；`text-slate-900 #0f172a` on `#6e7681` = **3.89:1** ❌ |
| `.ac-status-icon` #fff / 完成点 `#578365` | **4.34:1** ❌ | `AnimatedTimeline.vue:21` 的 ✓（14px） |
| 深色 `--vl-line #34413f` / bg | 1.62（仅边框，不适用文本） | — |

- **字号**：两份 CSS 共 **19 种字号**（9–34px），其中 9px 8 处、10px 13 处、11px 20 处、12px 18 处；首屏的"技术详情/参数/证据/快捷键说明"全部落在 9–11px。
- `input[type=range]` 有 `aria-label` 但无 `aria-valuetext`（步骤语义缺失）；select 有 `aria-label`；移动端 22 个触控目标 <44×44px（主题按钮 22×30、上一步 26×32）。

**改法**

1. 统一 `InteractiveNode` 的键盘处理（`.enter.prevent` + 打开后聚焦面板标题），并加回归测试。
2. 全局快捷键改为 window 捕获 + 输入框黑名单，保留 Space/←/→。
3. 对话框加 `aria-labelledby="drawer-title"`，`open()` 后聚焦 `h2`（`tabindex=-1`），退出时恢复焦点（现有 `focusBefore` 逻辑保留）；补充焦点循环。
4. 旁白 live 区改 `aria-atomic="true"` 且只在"步骤切换"时更新（节流到 step，不是每帧），另设 `role="status"` 播放状态区。
5. 浅色主题 `--vl-muted` 改到 ≥4.5:1（如 `#5b6b60`，约 5.6:1），或把 9–11px 文案统一提升到 12px + `--vl-muted-strong`；E0 徽标改深底浅字；完成图标改 `#3f6a4a`。
6. 触控目标最小 44×44（播放/单步/章节/主题按钮）。

---

### P1-4 移动端：只有"等比缩小"，没有重排 —— 画布文字实际 3.5–5.5px

**证据（断点集中，无 640px 级）**

- `visual-lab.css`：`@media(min-width:1600px)`、`@media(max-width:850px)`、`@media(min-width:851px) and (max-height:850px)`；`lessons.css`：`max-width:850px`、`max-width:550px`。**没有 <640px 的独立布局，也没有横/竖屏区分**。
- 375×812 实测 B05：视口无横向溢出；画布 `349×312`，viewBox `1080×335` → 缩放 **0.323**。CSS 里 `.ac-worker-title` 17px、`.ac-meta` 12px 的 SVG 文字，屏幕上分别约 **5.5px / 3.9px**——不可读。
- 章节导航：`scrollWidth 636 > clientWidth 351`，`overflow-x:auto`，无滚动提示/渐变遮罩；第 3 个章节文案已被截断（截图 `shots/ia-B05-375.png`）。
- 播放条：`flex-wrap` 后 88px 高，分两行（y591 与 y631）；上一步/下一步 26×32，主题按钮 22×30；22 个触控目标 <44px。
- B02 移动端：画布 `341×287`，viewBox `1120×290` → 缩放 **0.304**，泳道标题 29px→8.8px，小标签 11px→3.3px；播放条仍单行但进度条容器仅 69px。
- 目录页 375：80 张卡单列，`scrollHeight 21458px`，首屏只看到 2 张卡；筛选条高 111px。
- `.visual-lab{height:100dvh;overflow:hidden}`（`visual-lab.css:3`）在 ≤850px 被改成 `overflow:auto;min-height:760px`（`:117`）——只是允许滚动，DOM 顺序、信息层级、字号策略都没变。

**改法**

1. 新增 `<640px` 布局：画布全宽 + 支持双指缩放/全屏；把"本步讲解"移到画布**上方**（先读现象再操作）；章节改为 `<select>` 或底部 sheet，不横向滚动。
2. SVG 不靠整体缩放：为移动端提供 `mobileViewBox` 或节点级 `v-if` 精简（只画当前步骤涉及的 2–3 个图元 + 大字标签 ≥12 CSS px）。
3. 播放条只保留 播放/上一步/下一步/进度 4 项，速度与重置收进"更多"；按钮 ≥44px。
4. 目录页移动端改 2 列紧凑卡 + 模块折叠 + 每模块"展开全部"，或改为按章节的分页。

---

### P1-5 目录/首页信息架构缺路径与状态，且 `implemented` 口径三处互相矛盾

**证据**

- 首页 `VisualHomeView.vue` 只有：hero、1 张 B02 精选、**手写的 8 个主题数组**（`topics`/`topicIds`/`topicKinds`，`:6-8`）——没有难度、没有学习路径、没有术语表、没有"继续学习"、没有进度；数据与 `CATALOG` 重复维护。
- 目录 `AnimatedCatalogView.vue`：80 张等权卡片，只有"模块筛选 + 演示范围"两个筛选器（`:13-14`），没有难度/时长/完成状态/推荐顺序；卡片信息仅编号、模块、模型类型、标题（`:15`）。
- **口径矛盾**：
  - `/catalog` 声称"80 个主题 · 9 个模块"，80 张卡全部可点（实测 80）；
  - `CATALOG_STATS.implemented = 2`（`catalog.ts:201-204`，只有 A02/A03 的 `implemented: true`，见 `modules/A.basics.ts:27,40`）；
  - `MainLayout` 侧栏按 `entry.implemented` 渲染，实测 `/progress` 页面里 **78 个主题是灰色不可点的 `<span>`**（`MainLayout.vue:167-188`）；
  - 但 `visualLesson(id)` 对 80 个 id 全部有实现（`lessons.ts`，78 + B02/B03 定制）——字段是过期口径。
- 结果：从 `/progress`、`/evidence` 侧栏看，"只有 2 个主题做完了"；从视觉首页看"80 个都能学"。用户无法建立可信的知识地图。
- `CatalogEntry` 模型（`catalog.ts:38-59`）没有 `difficulty`/`estimatedMinutes`/`prerequisites`/`objectives`/`quiz`，所以目录页**在数据层就无法展示难度标签**；这些字段只存在于死掉的 `ExperimentDefinition`。

**改法**

1. 统一 `implemented` 口径：改为 `visualLesson(id) !== undefined` 或删除该字段（路由存在即可播）。
2. `CatalogEntry` 增加 `difficulty: 'L1'|'L2'|'L3'`、`estimatedMinutes`、`objectives: string[]`、`prerequisites: string[]`、`termIds: string[]`、`pathIds: string[]`；`lessons.ts` 按主题补。
3. 首页新增：①3 条学习路径（写入链路 / 查询链路 / 表服务与运维）②"继续学习"（读 progress）③术语表入口（File Group/File Slice/Base/Log/Timeline/Instant…，带一句话定义 + 首次出现处）④模块完成度条 ⑤难度筛选。
4. 目录新增：路径/难度/时长筛选 + 卡片完成状态 + "推荐顺序"开关 + 每模块折叠（默认展开第一个未完成模块）。
5. `/evidence` 从页脚与术语解释处进入；证据等级用统一徽标组件（复活 `CapabilityBadge`/`ExperimentShell` 里的徽标逻辑）。

---

### P2-1 代码可维护性：压缩成一行的模板/CSS 直接阻断"把页面改清楚"

**证据（具体行号/长度）**

| 文件 | 问题 | 数值 |
|---|---|---|
| `src/views/LessonView.vue:110-140` | 全部 80 主题的页面模板压进 31 行；最长单行 **1522 字符**（`:127`，参数表单 7 个控件 + 复选框 + 错误提示一行写完）；`:120` 播放条 957 字符；`:130` 技术详情 783 字符；`:112` 导航 533 字符 | 模板 ≈6.1KB / 31 行 |
| `src/views/LessonView.vue` script | 33 个 `const/function`；19 个内联事件；10 个 `drawer===` 分支；E01 专属教学逻辑（`:28-47`）硬编码在通用页里 | — |
| `src/views/VisualLabView.vue:103` | SVG 图层内联表达式 **759 字符**；`:121` 637；`:108` 600；整文件模板 13.7KB | 148 行 |
| `src/styles/visual-lab.css:1` | **整份文件 7538 字符写在 1 行** | 197 个选择器 |
| `src/styles/lessons.css:1` | **5367 字符 1 行**；`:8` 1427 字符 | — |
| `src/views/AnimatedCatalogView.vue:23` | 作用域 CSS 单行 **2682 字符**；`:24` 剩余 | 24 行文件 |
| `src/views/VisualHomeView.vue:21` | 1641 字符单行；`:14` 内联 SVG 场景 1115 字符 | 24 行文件 |
| `src/components/visual/RecordWalkthrough.vue:48` | 单行 1147 字符；`:40` 999 | — |
| `src/components/visual/IndexConfigWalkthrough.vue:48` | 1351 字符 scoped CSS 单行 | — |
| 全局 | `style="` 内联样式 **80 处**；`.vue` 内硬编码 `#hex` **324 处**；两份共享 CSS 中 61 种不同硬编码色 | — |
| 全局 | 无 i18n（`package.json` 无 `vue-i18n`）；`.vue` 内中文 **12545 字**；`MODEL_LABEL`/tab 名/按钮文案分散硬编码 | — |
| 全局 | `.vl-nav` 品牌/操作区 **4 份重复实现**：`LessonView.vue:112`、`VisualLabView.vue:78`、`VisualHomeView.vue:12`、`AnimatedCatalogView.vue:11` | 4 份 |
| 全局 | 死代码 ≈5900 行（见 P0-1） | — |

**改法**

- 先做"可读化"而不是大重写：CSS 全部展开为多行（`visual-lab.css` 拆 `tokens.css` / `layout.css` / `canvas.css` / `drawer.css`），Vue 模板按语义换行，长表达式抽成 computed 或子组件；这一步不改视觉，但让后续所有改动可 review、可 diff。
- 抽出 `VisualNav.vue`、`LessonStageBar.vue`、`PlaybackBar.vue`、`DetailTabs.vue`、`CanvasLegend.vue`，删除 4 份导航与 2 套播放条实现。
- 建立 `src/content/labels.ts`（或轻量 i18n）：tab 名、按钮文案、状态文案、术语名统一来源，供两套页面共用。

---

### P2-2 设计 token 缺失与"语义色硬编码"

**证据**

- 现有 token 只有 8 个颜色（`visual-lab.css:2-3`：bg/panel/ink/muted/line/base-bg/log-bg/accent）+ main.css 的 6 个 hudi token/5 个证据等级色；**没有**：focus 色、accent hover、success/warning/danger、Base/Log 描边色、高亮行色、删除色、图表对比色。
- 因为没有 token，出现了 `#79a99a/#c5a565/#bfe7b1/#77b48d/#86ab8a/#aad19e/#7ab49a/#426e58/#bcebd2/#396687…` 等硬编码补丁；同一语义在不同文件不同值（如 Base 描边在 `FileGlyph.vue:20` 是 `#79a99a`、`TopicPreview.vue:27` 是 `#79a28d`、`AnimatedSchema.vue` 用 `#79a99a`）。
- 没有字号/间距/圆角 token：共享 CSS 里字号 19 种、圆角 5 种（5/6/7/8/12px，组件内另有 9/10/11/14/16px）、间距全部散落在 `padding/margin` 字面值里（如 `.vl-nav{padding:0 36px}`、`.lesson-main{padding:22px 36px 8px}`、`@media(min-width:1600px)` 再调 padding）。
- 三套设计语言并存：`visual-lab.css` 的绿灰手写体系、`main.css` 的 Tailwind/Element Plus 体系（`/progress`、`/evidence`）、死视图里的 Tailwind 页面；同一个"面板"有 `.vl-panel`、`.hudi-panel`、`bg-[var(--color-hudi-panel)]` 三种写法。

**改法**：建立 `src/styles/tokens.css`（颜色/字号/间距/圆角/层级/动效时长），把 `--vl-*` 与 `--color-hudi-*` 合并为单一前缀；组件只允许 `var(--token)`；在 CI 加 stylelint 禁止 `.vue`/CSS 出现字面色值（白名单：`#000`/`#fff`）。

---

### P2-3 "考试/证据/答案"层面的信息被折叠或缺失

- 练习题只存在于死代码 `QuizPanel.vue`（231 行，被 `ExperimentView.vue:919` 使用），80 主题页没有任何自测；"已掌握"因此没有判定依据。
- 证据：80 主题页 footer 的「教学模型 · r26 行为边界 ↗」（9px）与技术详情→证据 tab 内容重复；`EvidencePanel` 在 620px 抽屉里塞 6–8 条卡片（每条 5–8 行元信息），移动端几乎不可读。
- 建议：自测 1–2 题/主题（数据来自 `lesson.steps` 的 `check` 字段）；证据改为"结论 + 缺口 + 一句话来源 + 展开原文"，默认折叠，与"本步解释"并排而非深层 tab。

---

## 建议的目标信息架构

### `/experiment/:id`（80 主题统一页，替代 LessonView + VisualLabView 两套）

```
[全局导航]  Hudi Visual Lab │ 学习路径 │ 全部主题 │ 术语表 │ 学习进度 │ 证据库 │ 主题切换
────────────────────────────────────────────────────────────────────────────
[课程头 · 紧凑]
  eyebrow：B05 · 基础原理 · 难度 L2 · 约 6 分钟
  H1：Base File 与 Log File 的版本关系
  一句话目标：学完你能回答「为什么更新后旧 Base 还在、Snapshot 却已读到新值」
  前置：File Group ／ File Slice（点击跳转） │ 证据等级 E1 徽标 │ 模式切换（基础/工程师）

[三段式主区] 左 240~280px │ 中 auto │ 右 320~380px（≤1100px 时右栏折叠到画布下方）
  左栏 学习支架
     · 本课 3 个问题（可折叠）
     · 术语卡（File Slice / Base File / Log File / Instant，带一句话定义）
     · 图例（Base / Log / 旧版本 / 本次新增）
     · 本模块进度（3/8）
  中栏 画布
     · 舞台条：状态（准备/演示中/完成）＋「本步可交互 N 处」＋ 缩放/全屏
     · 画布（当前步骤高亮；未就绪图元半透明 + "提交后可查看"）
     · 画布下方：Timeline 常驻条（Instant 方块，当前闪烁，hover 显示 action/state）
  右栏 讲解 dock（替代抽屉）
     · 本步标题 + 现象（2–3 句）+ 原因（2–3 句）
     · 关键数字：可见记录 / 有效文件 / Log / pending（前后对比）
     · "为什么不是 X" 反例卡（1 条）
     · 术语/证据链接
     · 自测 1 题（选完即时判定）

[播放控制条]  ▶ 播放/暂停 │ 上一步 │ 下一步 │ 进度 range（含步骤刻度） │ 速度 │ 重播
[章节条] 章节下拉（桌面横条 + 当前步高亮，移动端下拉）——放在播放条上方

[详情 Tabs · 页内，非抽屉，URL 可寻址 ?tab=timeline]
  解释 │ 数据（HDFS 文件树 / 记录表 / Timeline 表 / Compaction 计划）│ 代码（SQL / Scala / Flink / 源码映射）│ 依据（证据 / r26 差距 / 待验证清单）
  · 默认展开"解释"；工程师模式默认展开"数据"
  · HDFS 下钻在 dock 内二级页面，带面包屑

[结尾]
  本课小结（3 条要点 + 1 张"前后对比"图）
  自测结果 + "标记为已掌握"
  上一主题 / 下一主题 / 返回学习路径
[footer] 版本 / 证据 / 快捷键 / 反馈
```

### 首页（`/`）

```
Hero：一句话价值 + "从哪个问题开始"（不是直接推一个实验）
继续学习卡：上次主题 + 步骤 + 进度条（读 progress）
学习路径（3 条纵向路线，每条 5–8 个节点，显示完成状态与预计时长）
  · 写入路径：B01 → B04 → W01 → W02 → … （COW/MOR 对比放在第 3 站）
  · 查询路径：B07 → Q01 → Q02 → Q03 → Q04 → …
  · 表服务与运维：S01 → S03 → S04 → S06 → S07 → S08 → A05/A06
按模块浏览（9 个模块卡：模块目标、主题数、完成度、难度分布）
术语表入口（按字母/中文分组，每个术语有定义 + 首次出现主题链接）
证据与版本（E0–E4 解释、r26 差距总览）
```

### 目录（`/catalog`）

- 顶部：搜索 + 路径筛选 + 难度筛选（L1/L2/L3）+ 时长 + 完成状态（未开始/进行中/已完成）+ 视图切换（按路径/按模块）。
- 卡片：编号、模块、难度、时长、标题、一行"学完能回答"、演示类型徽标、完成状态、`继续/开始`。
- 分组：按模块折叠，默认展开"下一个未完成模块"；每模块显示 `已完成 3/8`。
- 空态/重置筛选保留；移动端 2 列紧凑卡。

### `/progress`（并入视觉体系）

- 顶部：总进度（已看 / 已掌握 / 自测均分）、连续学习天数（可选）。
- 学习路径视图：每条路径的节点完成状态（比模块百分比更有意义）。
- 主题表：已看/已掌握/自测分/最后访问时间/继续按钮（去掉永远 `—` 的难度列或补齐数据）。
- 错题/待复习：来自主题自测（而不是死的 QuizPanel）。

### `/evidence`

- 按主题/模块反向索引：每个主题关联的证据与"未验证点"；E0–E4 图例；与主题页 dock 的"依据"tab 双向链接。

---

## 代码重构前置项（为提升清晰度必须先做的 5 项）

| # | 重构项 | 涉及 file:line | 完成标准 |
|---|---|---|---|
| 1 | **拆解 LessonView 单体页**为 `LessonShell.vue` + `LessonHeader.vue` + `LessonStage.vue` + `StepNarration.vue` + `PlaybackBar.vue` + `ChapterNav.vue` + `LessonDetailDock.vue` + `CanvasLegend.vue`；E01 专属逻辑移到 `E01IndexCase.vue`，`templates` 计算移到 `useLessonTemplates.ts`，参数表单移到 `LessonParametersForm.vue` | `src/views/LessonView.vue:110-140`（最长行 1522 字符 `:127`、957 `:120`、783 `:130`）；E01 逻辑 `:28-47,117`；模板 tabs `:129-136` | `LessonView.vue` ≤80 行、模板单行 ≤120 字符；7 个组件单测/快照；行为不变 |
| 2 | **统一 80 主题的渲染入口**：删除 `/experiment/B02|B03` 特例路由，把 B02 的双泳道对比下沉为 `LessonCanvas` 的 `kind: 'compare'`；B03 独立内容或重定向 | `src/app/router/index.ts:28-29`；`src/views/VisualLabView.vue:80,84,125`；`src/components/visual/LessonCanvas.vue:20-31` | 所有 80 个 id 走同一 page shell；B03 不再显示"02 · COW 与 MOR" |
| 3 | **复活"详情层"并路由化**：把 Tab 从 `<dialog>` 改为页内 dock，tab 状态进 URL（`/experiment/:id?tab=timeline#step-3`）；用死代码 `FileTreeView/TimelineView/RecordTable/SqlBlock/QuizPanel` 替换现有的 JSON dump 与手写列表 | `LessonView.vue:126-138`（对话框与 7 tab）；死代码 `components/filesystem/FileTreeView.vue`、`components/timeline/TimelineView.vue`、`components/records/RecordTable.vue`、`components/quiz/QuizPanel.vue`、`views/ExperimentView.vue:686-920` | Timeline 主干在画布旁常驻；HDFS/记录不再 JSON/无返回；URL 可分享；源码透视 `\n` 修复（`:135`） |
| 4 | **建立课程/进度状态层**：新增 `src/app/stores/lesson.ts`（`mode`、`activeStep`、`drawerTab`、`visited/watched/mastered`、`lastSeen`）；`LabStore.progress` 扩字段并统一 key 为 catalog id；`useLessonPlayer` 持久化 position；`LessonView` 挂载/完成时写入 | `src/app/stores/lab.ts:37-41,143,177-189,288-317`；`src/animation/useLessonPlayer.ts:5-56`；`LessonView.vue:8,15,21`；`ProgressView.vue:46-64,96-118` | 访问 3 个主题后 `/progress` 显示 3 个已看；刷新主题页可恢复步骤；模式/进度跨页一致 |
| 5 | **样式与文案单一来源**：`visual-lab.css`（1 行 7538 字符）拆为 tokens/layout/components 三文件并补齐语义 token（focus/hover/success/warning/danger/base-stroke/log-stroke/字号/间距/圆角）；`lessons.css`（1 行 5367 字符）同样拆分；抽 `VisualNav.vue` 取代 4 份导航；建 `src/content/labels.ts`（或 vue-i18n）统一 tab/按钮/状态/术语文案；补 <640px 断点 | `src/styles/visual-lab.css:1`；`src/styles/lessons.css:1`；`src/styles/main.css:15-55`；重复导航 `LessonView.vue:112`、`VisualLabView.vue:78`、`VisualHomeView.vue:12`、`AnimatedCatalogView.vue:11`；硬编码色统计见 P2-1 | stylelint 禁止字面色值；导航仅 1 份实现；字号/圆角 token 化；375px 有独立布局 |

> 顺序建议：**5 → 1 → 4 → 3 → 2**（先可读化样式与文案，再拆页面，再补状态，再做详情层，最后合并两套渲染入口）；每步都要求 `pnpm typecheck` + `pnpm test` 通过，并用 `_analysis/ia-probe.mjs` 的测量脚本做前后对比。

---

## 附：本次实测的关键数字（供整改验收对照）

| 项目 | 现状 | 目标参考 |
|---|---|---|
| 首屏画布/讲解面积比 | 420px vs 70px（≈6:1） | ≤3:1，且讲解区含目标/现象/原因/数字 |
| 技术详情入口字号 | 10px（LessonView）/12px（B02） | ≥13px，双入口 |
| 到 Timeline 的点击数 | 2（且内容为 JSON） | 0（画布旁常驻）/1（dock tab） |
| 模式切换 DOM 变化 | 0 / +1 节点 | 影响 5 个渲染块（旁白/画布/参数/详情/失败） |
| 每主题内容量 | 4 步 × 21 字 ≈ 84 字 | ≥4 步 ×（2 段 + 数字 + 1 题） |
| 进度写入 | 0/80 主题 | 100% 主题写入 visited/watched/mastered |
| 视觉页到 /progress 链接 | 0 | 每页导航 1 个 |
| 移动端画布实际字号 | 3.5–5.5px（0.32 缩放） | ≥12px（移动专用布局） |
| 移动端触控目标 <44px | 22 个 | 0 |
| 浅色 muted 对比度 | 3.75:1 / 4.09:1 | ≥4.5:1 |
| 死代码 | ≈5900 行 | 0（复活或删除） |
| 最长模板单行 | 1522 字符 | ≤120 字符 |
| `.vue` 硬编码色 | 324 处 | 0（全部 token） |
