# Hudi Visual Lab · UX 实测审计报告

> 审计对象：`http://127.0.0.1:5173/`（开发服务器由 Lead 启动，本报告未启动/重启/关闭它）
> 审计方式：Playwright 1.64.1 + 系统 Edge（`chromium.launch({ channel: 'msedge' })`），真实浏览器实测
> 视口：1440×900（桌面）与 390×844（移动端，`isMobile: true, hasTouch: true`）
> 时间：2026-10-21
> 约束：只读取与测量，**未修改 src 下任何代码、未安装依赖、未操作 git**
> 原始数据：`_analysis/raw-01-pages.json`、`raw-02-lessons-desktop.json`、`raw-03-interactions.json`、`raw-04-final.json`、`log-03.txt`；测量脚本：`audit-01-pages.mjs`、`audit-02-lessons.mjs`、`audit-03-interactions.mjs`、`audit-04-final.mjs`、`audit-05-params.mjs`、`lib.mjs`
> 截图：`_analysis/shots/`（本报告全部 `![]()` 均指向该目录）

---

## 一、覆盖页面与所选 ID

| 路由 | 主题 | 类型（lesson.kind / 特殊） | 模型（model） |
|---|---|---|---|
| `/` | 首页 | — | — |
| `/catalog` | 80 主题目录 | — | — |
| `/experiment/B02` | COW 与 MOR 双路径（专用页 `VisualLabView`） | compare（专用页，非 `VISUAL_LESSONS`） | 目录卡标「双路径对比」 |
| `/experiment/B05` | Base File 与 Log File 的版本关系 | `files` | `engine`（引擎驱动） |
| `/experiment/W02` | Upsert 更新全过程 | `files` | `engine` |
| `/experiment/I03` | BUCKET 索引与哈希分桶 | `index`（bucket 场景） | `engine` |
| `/experiment/Q02` | Read Optimized 读优化查询 | `query` | `engine` |
| `/experiment/S04` | Compaction 执行与文件合并 | `files` | `engine` |
| `/experiment/S01` | Timeline 与 Instant 生命周期 | `timeline` | `engine` |
| `/experiment/E01` | BUCKET 索引写入时报 SIMPLE 错误 | `flow` | `concept`（机制示意） |
| `/experiment/B06` | Record Key、Partition Path、HoodieKey | `index` | `engine` |
| `/experiment/T01`（补充） | Spark SQL 建表 | `schema` | `engine` |
| `/experiment/A05`（补充） | Compaction 策略与吞吐量分析 | `metrics` | `engine` |
| `/experiment/W09`（补充） | Spark SQL 与 DataFrame 写入差异 | `flow` | `mixed`（引擎 + 机制示意） |
| `/progress` | 学习进度 | — | — |
| `/evidence` | 证据库 | — | — |

> 8 个 `kind` 全覆盖：files（B05/W02/S04）、index（B06）、bucket（I03）、query（Q02）、timeline（S01）、flow（E01/W09）、schema（T01）、metrics（A05）。三个 `model` 全覆盖：engine / concept（E01）/ mixed（W09）。选这些 ID 的理由：`B02` 是首页唯一精选入口、其他页面都是「产品最常走的入口」——目录卡第一屏能点到的 B01–B06、以及每个模块第一条。

---

## 二、一句话结论

**这个项目最不直观的三个根因：**

1. **画布是"缩放到底"的 SVG，而不是为屏幕设计的界面。** 1440 下画布文字只有 10–12px、对象只占画布宽度的 12.7%；390 下整张 1080×425 的 SVG 被压到 0.337 倍，10px 文字渲染成 **3.4px**、12px 渲染成 **4.0px**——手机上整页动画不可读（唯一信息载体失效）。
2. **"看图"之前缺三样东西：图例、术语定义、本页目标。** 12 个动画页里只有 B02 有图例；`File Group / File Slice / Log File / Instant` 在首屏没有任何定义，仅在 10px 灰字「技术详情 ↗」背后的抽屉里有一句话；"MOR 的 Log 文件是什么"需要 **4–5 次点击跨 2 个页面，最终仍拿不到定义**。
3. **页面之间是断开的：** 动画页从不写学习进度（完成 B05 后 `localStorage['hudi-lab-progress']` 仍为 `null`，/progress 全 0「暂无数据」）；视觉实验室的导航里**没有任何入口指向 /progress 或 /evidence**；而这两页又是另一套 UI（MainLayout + Element Plus，移动端横向溢出 494>390）+ 另一个"工程师模式"开关实际只改 2 个文案。

---

## 三、关键测量摘要（所有问题引用的数字都来自这里）

| 指标 | 桌面 1440×900 | 移动 390×844 |
|---|---|---|
| 首页首屏可交互元素 | 9 个（唯一主 CTA：精选卡 1096×322） | 13 个（首屏 4 个 <44px） |
| 首页首次内容绘制 | FCP 308ms / DCL 174ms | DCL 151ms（wall 加载 ~1.2s） |
| 首页首屏文字 | 主标题 52px、说明 14px、eyebrow 10px、"80 个主题"到 y=745 | 9px 文本 11 处 |
| 目录页 | 80 卡 / 3 列 / 405×249 / 页高 7688px | 80 卡 / 2 列 / 页高 **21458px** |
| 目录卡字号 | 标题 15px、meta **9px**、底部 **10px** | 9px×86 处、11px×13、10px×7 |
| 动画画布（files） | 元素 1366×420，viewBox 1080×425，缩放 **0.988**，对象宽 174px（占画布 12.7%） | 元素 364×344，缩放 **0.337**，内容只占 364×143（高 42%） |
| 画布文字实际渲染 | 10px→9.9px / 11px→10.9px / 12px→11.9px | **10px→3.4px / 11px→3.7px / 12px→4.0px** |
| 动画页可交互元素 <44px | — | B05 24/24、I03 26/26、S04 25/25、Q02 26/26、S01 26/26、E01 24/24 = **100%** |
| 其它页 <44px | — | 首页 4/13、目录 14/94、/progress 17/18、/evidence 39/39 |
| 横向溢出 | 无（scrollWidth=1440） | 首页/目录/动画页无；**/progress、/evidence 为 494 > 390** |
| 深色对比度 | `#93a49e` on `#151c20`=6.6、on `#1b2429`=6.04、on `#203e35`=4.46、on `#423c2a`=**4.21** | 同色（画布同样 3.4px） |
| 浅色对比度 | `#738178` on `#f4f6f0`=**3.75**、on `#fff`=**4.09**、on `#e6f2e8`=**3.55**、on `#faf0d9`=**3.61** | 同色 |
| 浅色主题对比度不合格节点 | 首页 10/21、目录 10/22、动画页 **22/50** | — |
| 抽屉 | 620px 宽，7 tab，技术详情内容高 674–1451px | 367×844（94vw），tab 2 行，每个 76×37 |
| 模式开关 | 「工程师模式」切换后 DOM 元素 110→110、innerHTML 4537→4555（**+18 字符**） | 同 |
| 学习进度 | 完成 B05 后 localStorage 仍 `null`，进度表 0 行「暂无数据」 | 同 |

---

## 四、问题清单（按严重度）

### P0 · 移动端动画画布整张等比缩小，文字 3.4–4px，动画页在手机上不可读

**复现**：390×844 → `/experiment/B05`（I03 / S04 / Q02 / S01 / E01 同样）→ 观察画布任意文字。

**证据**：
- `svg.lesson-canvas` 实测 **364×344**，`viewBox="0 0 1080 425"`（[LessonCanvas.vue:20](../hudi-visual-lab/src/components/visual/LessonCanvas.vue#L20)），`scale = min(364/1080, 344/425) = 0.337`。
- 画布内文字声明值与手机实际渲染：`.file-format` 10px → **3.4px**、`.record-text` 11px → **3.7px**、`▤ BASE FILE` 12px → **4.0px**（[FileGlyph.vue:20](../hudi-visual-lab/src/components/visual/FileGlyph.vue#L20)）。文本实测 bbox 高 3–4px，等于不可读。
- 画布内容只占 **364×143**（高度是容器 344 的 42%），上下各约 100px 空白；文件卡在手机上只有 59×37px。
- 章节条 `.lesson-chapters` `overflow-x:auto`，`scrollWidth 636 / clientWidth 366`：5 个章节只露出前 3 个，无滚动提示（截图只能看到「1 初始 Base / 2 追加一版 Log / 3 追加更多记录」）。
- 桌面也不是"够大"：1366 宽画布里的文件卡只有 174px（占 12.7%），字号 9.9–11.9px。

**截图**：![](shots/32-B05-mobile.png) ![](shots/53-B05-mobile-fold.png) ![](shots/33-B05-mobile-playing.png)

**为什么这让人不直观**：移动端唯一的信息载体就是那张画布。3.4px 意味着用户只能看到几个色块，无法读到文件名、记录值、"Log / Base"标签，动画的"变化"完全不可见——等于手机上这个产品不存在。

**具体改法**：`LessonCanvas.vue` 增加显式的移动端分支（不要依赖缩放）：
1. ≤550px 时把 `<svg class="lesson-canvas">` 换成 **HTML 单步卡片**：每步只渲染 3 个节点（输入记录 → Hudi Writer → 目标文件/Log），字号 13–14px，颜色块用 6px 圆角 + 图例标签（`Base File` / `Log File` / `旧文件`），纵向排列，宽度撑满。移动端不需要"一屏看全流程"，需要"一步看懂"。
2. 如果坚持 SVG：给 `.lesson-canvas` 设 `min-width: 720px`，`.lesson-canvas-area{overflow-x:auto; scroll-snap-type:x mandatory}`，每屏 snap 一个区段，并在画布右下角常驻「← 左右滑动看完整画布 →」，章节条改成 5 个圆点 + 当前步骤标题（不横向滚动）。
3. 桌面上把文件卡从 174px 提到 ≥220px（画布对象占比 ≥16%），并把 `.file-format` 10px 提到 12px。

---

### P0 · 没有图例、没有术语定义：用户找不到「MOR 的 Log 文件到底是什么」

**复现**：`/` → 精选卡「开始 COW / MOR 实验」→ 播放 → 想知道 Log 是什么；或 `/catalog` 搜 `log` → B05 → 播放 → 点「技术详情 ↗」→ 逐个 tab。

**证据**：
- 12 个被测动画页中，**只有 B02 有图例**：`.vl-stage-top` 内 `● Base File ● Log File ● 旧版本`，实测 **179×16px、字号 10px**（[VisualLabView.vue:86](../hudi-visual-lab/src/views/VisualLabView.vue#L86)）。其余 11 个 `LessonView` 页 `hasLegendWord=false`、`legendLikeEls=[]`；`图例` 一词在 src 下只出现在 VisualLabView.vue:86 和两个不参与视觉实验室的组件注释里（FileTreeView / TimelineView）。
- `LessonCanvas.vue` 全文没有任何 legend/说明 DOM；文件卡里只有 12px 的 `▤ BASE FILE` / `≡ LOG FILE` 和 10px 的「当前版本 · 点击查看」——**颜色（绿=Base、棕=Log、半透明=旧版本）没有任何一处解释**。
- 术语定义只在抽屉里：B05「技术详情」抽屉内容高 674px，第一段 summary 是「用 log 文件的 version 号与 base instant 说明「一个 File Slice 引用了哪些物理文件」…」——**用 Log 解释 File Slice，没有反过来定义 Log**。全库 grep 无 glossary / 术语表条目。
- 实测理解路径（从首页出发，找"Log 文件是什么"）：① 点精选卡（1 次）→ ② 点「开始演示」（2 次）→ ③ 点 stage-bar 右侧「技术详情 ↗」（3 次，10px 灰字）→ ④ 在 7 个 tab 里找（4 次）→ ⑤ 滚 674px 读完 → **终点仍没有"Log 是追加写的增量文件"**。从目录页走还要多 1 跳。

**截图**：![](shots/30-B02-desktop.png)（唯一有图例的页面，可作为标准） ![](shots/20-B05-desktop-start.png) ![](shots/25-B05-desktop-drawer.png) ![](shots/01-home-desktop.png)

**为什么这让人不直观**：这是本次反馈"不清晰、不详细"的正中靶心。用户面对的是绿块棕块 + 英文缩写，画面上**没有任何"这是什么"的解释层**；唯一的解释藏在 10px 按钮后面的抽屉里，而抽屉里的文字仍然预设了"你已经知道 Log 是什么"。

**具体改法**：
1. **统一图例组件** `CanvasLegend.vue`，放在每个 `LessonCanvas` 左上角（复用 B02 的三项，字号 ≥12px、`--vl-ink` 色）：`▤ Base File 全量列存`、`≡ Log File 追加增量`、`◇ 旧版本 待清理`；颜色含义必须与 `FileGlyph` 的 `base-body/log-body/.old` 一一对应。
2. **首屏术语卡**：画布下方常驻一行「本步涉及的 3 个词」（可折叠，默认展开），每个词给 12–15 字定义 + 一个数字例子，例如：
   - `File Group`：同一主键的版本集合，本次是 `20240101120000_0-0`，含 1 Base + 2 Log
   - `File Slice`：当前可见的一组文件引用，指向最新 Base 与它之后的 Log
   - `Log File`：只追加的增量文件，Snapshot 读时合并，Read Optimized 忽略
3. 在 B05/B04/F03/Q02 首屏摘要里直接放一句白话结论：「MOR 的更新先写进 Log，查询时再和 Base 合并」。
4. 抽屉首屏先给"一句话定义"，再给 JSON（见 P2-抽屉问题）。

---

### P0 · 学习进度与 80 个动画完全没有打通

**复现**：`/experiment/B05` → 「开始演示」→「跳到结果」→ 打开 `/progress`。

**证据**：
- 应用前后 `localStorage.getItem('hudi-lab-progress')` 都是 **`null`**；`localStorage` 键列表为空。
- `/progress` 4 个统计卡全 0（「0个/0个/0分/0个」），实验表格 **0 行**、空态是 Element Plus 原生「暂无数据」，错题回顾「暂无需要重做的题目」。
- 代码路径：`ProgressView` 只读 `lab.progress`（[ProgressView.vue:46](../hudi-visual-lab/src/views/ProgressView.vue#L46)）；`markVisited` 只在 `loadExperiment` 内调用（[lab.ts:188](../hudi-visual-lab/src/app/stores/lab.ts#L188)），而动画页走 `buildLessonRun`（[LessonView.vue:6](../hudi-visual-lab/src/views/LessonView.vue#L6)）**从不调用 `loadExperiment`/`markVisited`**（全库 grep `markVisited` 仅 2 处：定义 + `loadExperiment` 内部）。
- 同时，视觉实验室的导航（首页/目录/动画页）**没有任何链接指向 `/progress` 或 `/evidence`**（grep `to="/progress"`、`to="/evidence"` 在 4 个视觉页面中 0 命中），这两页只能靠手输 URL 进入。

**截图**：![](shots/43-progress-after-lesson.png) ![](shots/06-progress-desktop.png)

**为什么这让人不直观**：产品承诺"看动画 → 亲手操作 → 解释 → 代码"的学习闭环（首页 footer），但用户看完 5 个动画后再打开进度页，得到的是"未开始、暂无数据"——**学习行为没有被承认**，这比"没有这个功能"更伤信任。

**具体改法**：
1. `LessonView` `onMounted` 调 `lab.markVisited(id)`；`player.done` 时置 `done=true`；步进到最后一章也记为 done。
2. 目录卡与首页主题卡显示进度角标（未看/在看/看完）。
3. 视觉壳导航加「学习进度」「证据库」两个入口（见 P1-progress/evidence 问题）。
4. `/progress` 按 80 个目录条目渲染（而不是"只显示 store 里有的"），每模块一张卡：`已看 x/8` + 最近 3 个主题。

---

### P1 · 「工程师模式」是空开关：只改 2 处文案，DOM 完全不变

**复现**：`/experiment/B05` → 播放到任意步 → 点右上「基础模式」。

**证据**：
- 切换前后 DOM 元素数 **110 → 110**，`#app.innerHTML` 长度 **4537 → 4555（+18 字符）**；可见文本差集只有 **2 处**：`技术详情 ↗` → `SQL / HDFS / Timeline ↗`、`基础模式` → `工程师模式`（[LessonView.vue:112](../hudi-visual-lab/src/views/LessonView.vue#L112)、[LessonView.vue:116](../hudi-visual-lab/src/views/LessonView.vue#L116)）。`engineer` 变量在 LessonView 里只被这两处使用。
- 而在 B02 专用页，同名开关会多出一个「模拟失败」动作按钮（[VisualLabView.vue:125](../hudi-visual-lab/src/views/VisualLabView.vue#L125)）——同名控件在两套页面语义不同。
- 截图 24 与 20 几乎逐像素一致（仅右上两个按钮文字不同）。

**截图**：![](shots/24-B05-desktop-engineer.png) ![](shots/57-B05-desktop-engineer-vs-basic.png)

**为什么这让人不直观**：按钮名"工程师模式"暗示"能看更多技术细节"，用户点了之后**画布、抽屉、参数、数据全都没变**，只会得出"这个功能坏了"或"我看不懂是正常的"两个结论，都是负面的。

**具体改法**：二选一。
- **A（推荐，成本低）**：删掉这个开关，把"技术细节"做成抽屉里的固定分层（讲解 / 数据 / SQL），不要用模式概念。
- **B（保留双层）**：让模式真的改变画布——基础模式=白话步骤 + 图形；工程师模式=在画布上叠加 `fileName`、`instantTime`、FileSlice 引用线、`operation` 标记，并把抽屉默认打开到「技术详情」。切换时给 toast：「已叠加 5 处技术标注（文件名/Instant/Slice）」。
- 无论选哪个，B02 与 LessonView 的同名控件必须统一语义。

---

### P1 · `/progress` 与 `/evidence` 是另一套产品：换肤 + 移动端横向溢出 494>390

**复现**：390×844 打开 `/progress`、`/evidence`；桌面打开同两页与首页对比。

**证据**：
- 移动端 `document.documentElement.scrollWidth = 494`、`clientWidth = 390`（两页都是），溢出元素 21 / 366 个；`.el-table` 在 progress 宽 **850px**、evidence 宽 **1650px**，整页被撑破。
- 路由分流：`App.vue` 把 `/progress`、`/evidence` 排除在 visual 壳之外（[App.vue:23](../hudi-visual-lab/src/App.vue#L23)）→ 套 `MainLayout`，左栏固定 **260px**（[MainLayout.vue:130](../hudi-visual-lab/src/app/layouts/MainLayout.vue#L130)）且无移动端折叠；`.vl-nav` 不存在（`hasVlNav=false`）。
- 观感/参数完全不同：progress/evidence 背景 `#0d1117`、字号 11px×165 处、Element Plus 控件；视觉实验室是 `#151c20`、9–13px、自绘按钮。导航词也不同：`总览/证据库/学习进度` vs 视觉页的 `← 全部动画 / 主题`。
- 移动端首屏：`MRS 3.1.0-350-r26` 被挤成竖排，统计卡「已访问实验 0 个」文字竖排断开，页面右侧内容被裁切（见截图）。

**截图**：![](shots/12-progress-mobile.png) ![](shots/13-evidence-mobile.png) ![](shots/06-progress-desktop.png) ![](shots/07-evidence-desktop.png)

**为什么这让人不直观**：用户在动画页建立的空间感（深绿、卡片、大标题）在两页之后完全丢失，像是跳到了另一个系统；手机上更是直接坏版、点不到、看不全。而这两页承载的正是"我学了什么""这些结论凭什么可信"两个关键问题。

**具体改法**：
1. 两页并入视觉壳：同一个 `vl-nav`（含 首页/目录/进度/证据 4 个入口），`--vl-*` token，去掉 `MainLayout` 固定侧栏。
2. `/progress`：9 个模块卡片（`A 基础原理 2/8` + 进度条 + 3 个最近主题），下面"进行中"列表；不要表格。
3. `/evidence`：卡片列表（证据 ID + 标题 + 等级 chip + 来源 + 一行结论），筛选 chips 放顶部 sticky；不要 8 列 `el-table`。
4. 如果暂时保留 MainLayout，至少 ≤850px 把侧栏收成抽屉（`position:fixed` + 遮罩），并给 `.el-table` 外层 `overflow-x:auto`。

---

### P1 · 字号体系整体过小：关键信息用 9–11px 承载

**复现**：1440 与 390 下查看首页/目录/任意动画页，用 DevTools 看字号（或用本报告脚本）。

**证据**（均为 computed style 实测）：
- 首页：`.vh-topics .vl-eyebrow` **9px**（移动端 11 处 9px 文本）、footer **9px**、「全部 80 个动画」12px（[VisualHomeView.vue:21](../hudi-visual-lab/src/views/VisualHomeView.vue#L21)）；hero eyebrow 10px。
- 目录：卡片 meta **9px**（移动端 86 处）、卡片底部 **10px**、模块筛选 11px、计数行 11px（[AnimatedCatalogView.vue:23](../hudi-visual-lab/src/views/AnimatedCatalogView.vue#L23)）。
- 动画页：`.lesson-stage-bar` 与其中按钮 **10px**（[lessons.css:1](../hudi-visual-lab/src/styles/lessons.css#L1)）、`.lesson-model` 11px、`.lesson-bottom` 10px；移动端 `.lesson-model` **9px**、`.vl-eyebrow` **9px**（[lessons.css:3](../hudi-visual-lab/src/styles/lessons.css#L3)、[visual-lab.css:3](../hudi-visual-lab/src/styles/visual-lab.css#L3)）。
- 承载关键状态的都是小字：「正在演示」「准备就绪」「技术详情 ↗」「引擎驱动 ↗」= 9–11px；桌面 B05 页有 **32 个** 9–11px 文本节点（`smallBySize={10px:16, 11px:14, 9px:2}`）。

**截图**：![](shots/01-home-desktop.png) ![](shots/03-catalog-desktop.png) ![](shots/11-catalog-mobile.png) ![](shots/20-B05-desktop-start.png)

**为什么这让人不直观**：9px 中文在 1440 屏上已经接近"看不清"，在移动端（视觉视角更远）几乎等同于装饰；而它们恰恰是"这是什么页面/这是什么模式/点这里看解释"的唯一提示。

**具体改法**：建立最小字号 token：正文 14px、次要 13px、元信息 **12px（下限）**、标签 chip 12px；删除 9px 与 10px 档。
- `.vl-eyebrow` 10→12，移动端 9→12；
- `.catalog-card-meta` 9→12，`.catalog-card-bottom` 10→12；
- `.lesson-stage-bar` 10→12，按钮 10→12；
- `.lesson-bottom` 10→12，`.vl-footer` 9→12，`.vh-topics .vl-eyebrow` 9→12；
- 移动端单独的 `font-size:9px` 覆盖全部删掉（见 lessons.css 的 550px 媒体查询）。

---

### P1 · 浅色主题对比度不合格（3.55–4.09，WCAG AA 需 4.5）

**复现**：任意视觉页点右上 ☀ 切到浅色（`vl-light`），再看首页/目录/B05 的次要文字。

**证据**：
- `--vl-muted` 浅色值 = `#738178`（[visual-lab.css:1](../hudi-visual-lab/src/styles/visual-lab.css#L1)），实测对比度：on `#f4f6f0` = **3.75**、on `#fff` = **4.09**、on `#e6f2e8`（Base 卡底）= **3.55**、on `#faf0d9`（Log 卡底）= **3.61**。
- 文本节点扫描失败数：首页 **10/21**、目录 **10/22**、动画页 **22/50**。被击中的全是"次要但必要"的文字：`一个操作，一次变化…`(14px)、`LEARN BY SEEING…`(10px)、`精选实验 / 约 1 分钟建立直觉`(10px)、卡片 meta(9px)、`B05 · 基础原理`、`引擎驱动 ↗`、`技术详情 ↗`、画布里的 `操作前 · 1 个物理文件`(13px)、`执行过程示意`(12px)。
- 深色下同 token 为 6.6（合格），所以这是"切换主题才出现"的回归。

**截图**：![](shots/40-home-light-audit.png) ![](shots/41-catalog-light-audit.png) ![](shots/42-B05-light-audit.png)

**为什么这让人不直观**：浅色是白天/投屏/打印场景的自然选择，但一切"解释性文字"在浅色下都变淡；用户会更看不清"这页在讲什么"，加剧本次反馈的"不清晰"。

**具体改法**：
1. 浅色 `--vl-muted` 改为 `#5b6a61`（对 `#f4f6f0` ≈5.4:1）或 `#55645b`；画布 Base/Log 底上的次要文字不要用 muted，用 `--vl-ink` 的 85%（如 `#3f5348`）。
2. 浅色下 `--vl-line` 当前 `#d9e1d7`（分隔线可接受），但文件卡描边 `#79a99a` 系在浅色底上对比过低，改为 `#4f7f6a`。
3. 把本报告的对比度扫描脚本落到 CI（或 `tests/` 里加一个 e2e），对 3 个视图 × 2 主题断言 `ratio >= 4.5`（≥18.66px 粗体除外）。

---

### P1 · 深色下彩色底上的小字仍不满足 AA（4.21–4.46）

**复现**：深色主题 → `/experiment/B05` → 播放到有 Log 的步骤（或 S04）→ 看文件卡底部说明。

**证据**：
- `.file-format` 用 `var(--vl-muted)` `#93a49e`、字号 10px（[FileGlyph.vue:20](../hudi-visual-lab/src/components/visual/FileGlyph.vue#L20)），实测：Log 卡底 `#423c2a` 上 = **4.21**、Base 卡底 `#203e35` 上 = **4.46**，均 < 4.5；`#bfa16c`（Log 卡描边）在 `#423c2a` 上 = 4.46、`#79a99a`（Base 描边）在 `#203e35` 上 = 4.41——描边不参与文字判定，但说明整套"彩色底 + 同色系文字"的低对比策略。
- 10px 属"正常文字"阈值（AA 4.5），不是大字 3:1；桌面缩放 0.988 后仍是 ~10px。

**截图**：![](shots/21-B05-desktop-playing.png) ![](shots/50-B05-desktop-result.png)

**具体改法**：文件卡内次要文字改成 `#cbd8d1`（对两种底色 ≥6.0）或用 `--vl-ink` 的 80%；字号 10→12px；`.file-format` 加 `font-weight:500`，并把"当前版本 · 点击查看"这句交互提示改成图标 + 文字（点击区 44px 高）。

---

### P1 · 移动端点击目标几乎全部 <44×44（动画页 100%）

**复现**：390×844 逐页量 `a/button/input/select/[role=button]` 的 boundingBox。

**证据**：
- 动画页：B05 **24/24**、I03 26/26、S04 25/25、Q02 26/26、S01 26/26、E01 24/24 个可交互元素中，宽<44 或 高<44 的比例 **100%**。
- 典型元素：「技术详情 ↗」**53×16**、「← 全部动画」**53×16**、「切换深浅主题」**22×30**、「引擎驱动 ↗」64×30、播放条按钮高 **32**、章节按钮高 **36**、抽屉 tab **76×37**、参数输入 **330×35**。
- B02 移动端更极端：进度条 `input[type=range]` **19×3**、「重放」24×36、「上一步」29×36。
- 其它页：`/progress` 17/18（94%）、`/evidence` 39/39（100%）、首页 4/13（导航/目录入口）、目录 14/94（筛选按钮高 34、搜索输入高 19）。

**截图**：![](shots/32-B05-mobile.png) ![](shots/31-B02-mobile.png) ![](shots/12-progress-mobile.png)

**为什么这让人不直观**：手指目标 16px 高基本必然点错（尤其「技术详情 ↗」是唯一的解释入口）；用户会反复点不到而放弃，体验上等价于"功能不存在"。

**具体改法**：
1. 移动端全局：`a,button,input,select{min-height:44px}`，图标按钮 `min-width:44px`；文字型小按钮加透明 padding（`padding:14px 12px; margin:-14px -12px` 保持视觉尺寸）。
2. `.lesson-stage-bar button`（技术详情）移到播放条作为第 1 个按钮，或做成 44×44 图标 + 文字。
3. 章节条改 `min-height:44px` 的分段控件（移动端显示 3 个 + 圆点）。
4. range `input` 用 `padding:20px 0` + 24px thumb，使可点高度 ≥44。
5. 目录筛选按钮、抽屉 tab、参数输入统一 44 高。

---

### P1 · 目录搜索只匹配编号+标题，中文/英文别名不互通

**复现**：`/catalog` → 搜索框依次输入下列词。

**证据**（实测返回卡片数）：`bucket`→7、`索引`→8、`compaction`→8、`Compaction`→8（大小写 OK）、`COW`→3、`MOR`→3、`log`→2、`timeline`→3、`E01`→1、`B02`→1、`小文件`→1、`File Group`→2；但 **`文件组`→0、`日志`→0**。
- 过滤字段只有 `` `${e.id} ${e.title}` ``（[AnimatedCatalogView.vue:8](../hudi-visual-lab/src/views/AnimatedCatalogView.vue#L8)），summary / 模块名 / 证据 / 同义词全不参与；placeholder 却写「搜索主题、编号或关键词」。
- 全库术语以英文为主：`File Group` 150 次 vs `文件组` 8 次；`Log File` 75 次 vs `Log 文件` 11 次——用户最可能输入的中文词恰恰命不中。
- 空结果状态本身是好的：显示「没有找到匹配的动画。＋ 清除筛选」，计数行同步为「0 个可播放主题」（[AnimatedCatalogView.vue:16](../hudi-visual-lab/src/views/AnimatedCatalogView.vue#L16)）。

**截图**：![](shots/04-catalog-search-bucket.png) ![](shots/04-catalog-search-suoyin.png) ![](shots/04-catalog-search-compaction.png) ![](shots/04-catalog-search-zzz.png)

**具体改法**：
1. `lessons` 过滤字段扩成 `id + title + summary + 模块 shortTitle + keywords[]`；给每个条目补 3–5 个中文关键词（`文件组/日志/提交/时间线/小文件/时间旅行/增量`…），同义词表统一放 `catalog.ts` 的一个 `KEYWORDS: Record<id, string[]>`。
2. placeholder 改「搜索编号 / 主题 / 关键词（如：文件组、bucket）」。
3. 空态加"试试：文件组、Compaction、Bucket"3 个可点 chip。
4. 搜索建议：输入时高亮命中片段（标题命中/关键词命中用不同颜色说明为什么命中）。

---

### P1 · 目录页 80 张卡、搜索与筛选不吸顶

**复现**：1440×900 打开 `/catalog`，向下滚 3 屏；390×844 同上。

**证据**：
- 80 张卡：桌面 3 列、卡片 405×249、页高 **7688px**；移动端 2 列、页高 **21458px**（约 25 屏）。
- 全库 grep 无 `position: sticky`（0 命中）：搜索框在 `.catalog-heading`、筛选在 `.catalog-filters`，滚动后全部离开视口，用户想换筛选必须回到顶部。
- 卡片预览是 95px 高的 `aria-hidden` 抽象图（见下一个问题），卡片除标题外没有可读信息。

**截图**：![](shots/03-catalog-desktop.png) ![](shots/11-catalog-mobile.png) ![](shots/11-catalog-mobile-full.png)

**具体改法**：
1. `.catalog-toolbar`（搜索 + 模块 chips + 计数）`position:sticky; top:0; z-index:10; background:var(--vl-bg); box-shadow:0 1px 0 var(--vl-line)`，高度控制在 ~112px。
2. 移动端模块筛选收成单行横向滚动 chips（44px 高），计数与"演示范围"合并到一行。
3. 增加"按模块分组"视图（9 个可折叠组），减少无目的长滚动；卡片按模块编号排序。

---

### P1 · 首页没有回答「这是什么、我该点哪、点了会看到什么」

**复现**：首次打开 `/`（1440×900 与 390×844 各一次）。

**证据**：
- 首屏 900px 内只有 **9 个可交互元素**，其中 3 个是顶部导航（品牌、「完整实验目录 ↗」、主题按钮）；主标题是口号（52px「让数据流动，让原理看得见。」），eyebrow 是英文 `LEARN BY SEEING. UNDERSTAND BY DOING.`（10px），唯一说明句 14px「一个操作，一次变化。用交互动画建立你的 Hudi 直觉。」——**没有一句"这是 80 个可交互的 Hudi 教学动画"**。
- 「80 个主题」相关文字到 **y=745** 才出现（12px「全部 80 个动画 →」），8 张问题卡从 **y=791** 开始；移动端首屏只到精选卡（y=310–691）+「从一个问题开始」(y=737)。
- 首屏唯一的主动作是整张精选卡（1096×322 的巨大链接），其内部 CTA 只有 13px；没有"先看这个/从这里开始"的编号或引导线。
- 唯一的流程说明「看动画 → 亲手操作 → 解释 → 代码」在 footer 10px（y≈884），且移动端被 `@media(max-width:850px){.vl-footer>span:last-child{display:none}}` 隐藏（[visual-lab.css:3](../hudi-visual-lab/src/styles/visual-lab.css#L3)）——**移动端没有任何"怎么用"的说明**。
- 首页/目录/动画页都没有到 `/progress`、`/evidence` 的链接。

**截图**：![](shots/01-home-desktop.png) ![](shots/10-home-mobile.png) ![](shots/52-home-mobile-fold.png)

**为什么这让人不直观**：用户落地 3 秒内能看到的只有"一句口号 + 一张大卡 + 半截卡片"，能做的只有点大卡。产品的范围（80 主题/9 模块）、路径（看→做→读代码）、身份（华为 MRS r26 教学模拟）都需要滚动或去别的页面才知道。

**具体改法**：
1. hero 下加一行 40 字以内的产品定义：`80 个可交互 Hudi 动画 · 先看变化，再亲手操作，最后读代码`（14px，`--vl-ink`）。
2. 把 footer 的四步流程提上来，做成 hero 下方的 4 段 stepper（每段 12–13px）：`① 看动画 → ② 亲手操作 → ③ 读解释 → ④ 看 SQL/源码`，并标注"平均 1–2 分钟/主题"。
3. 首屏加 3 个入口（一行按钮）：`开始第一个实验（B02）`、`按问题浏览（目录）`、`查看学习进度`；把"80 个主题 · 9 个模块"从 y=745 提到 hero。
4. 移动端恢复流程说明，并把精选卡 CTA 从 13px 提到 15px 加箭头。

---

### P1 · 动画页首屏缺少「本页讲什么 / 多久 / 证据等级」

**复现**：1440×900 打开 `/experiment/B05`（整页恰好一屏，`scrollHeight=900`，不滚动也能看全）。

**证据**：
- 首屏层级：h1 27px「Base File 与 Log File 的版本关系」→ 右上「引擎驱动 ↗」11px → stage-bar 10px（准备就绪 / 点击图形查看数据 / 技术详情 ↗）→ 画布 → 说明条 13px「点击"开始演示"，先观察初始 Base。」。
- **没有摘要、没有学习目标、没有预计时长**（"约 1 分钟"只在首页精选卡出现过）、**没有证据等级**；`entry.summary` 与 `entry.note`（"r26 待验证"）只存在于抽屉里。
- 「引擎驱动」是内部行话：点开抽屉才知道是"操作前后状态来自同一引擎，回放和拖动不重复执行操作"。
- 页脚「教学模型 · r26 行为边界 ↗」9px 是唯一暴露"这是模拟、不是真集群"的常驻提示（还有 footer 左 9px「HUAWEI MRS r26 · 纯浏览器模拟」）。

**截图**：![](shots/20-B05-desktop-start.png) ![](shots/53-B05-mobile-fold.png)

**为什么这让人不直观**：用户不知道这页要花多久、要学什么、结论可不可信；也不知道该看画布还是先看解释。"引擎驱动"这种词只会增加距离感。

**具体改法**：h1 下加一行元信息 + 一行摘要：
```
Base File 与 Log File 的版本关系
用 log 的 version 与 base instant 说明一个 File Slice 引用了哪些物理文件。
⏱ 约 1 分钟 · 5 步 · 引擎驱动 · 证据 E1（社区文档）/ r26 待验证
```
实现：`LessonView` 头部复用 `entry.summary`（现在只在抽屉），meta 用 chip 组；「引擎驱动」改「本地模拟引擎（点击看不模拟什么）」，点开抽屉对应段落。

---

### P1 · 播放 / 拖动 / 重置的反馈不充分

**复现**：`/experiment/B05` → 播放 → 暂停 → 拖进度条 → 下一步 → 重置。

**证据**：
- 状态只在 stage-bar 10px 里：`准备就绪 / 正在演示 / 已暂停 · 可单步操作 / 演示完成`；无百分比、无剩余步数（步骤 `1 / 5` 在说明条最右 11px）。
- 拖动进度条会自动暂停（实测 `status=已暂停 · 可单步操作`、按钮变`▶ 继续播放`），但**没有任何提示说明"拖动=暂停"**。
- 点「重置」后 `notice=''`（[LessonView.vue:120](../hudi-visual-lab/src/views/LessonView.vue#L120)），页面无任何 toast/文案，只有 stage-bar 回到"准备就绪"——用户不确定是否重置成功。
- 「跳到结果」执行后按钮 `disabled`（opacity 0.32，[visual-lab.css:1](../hudi-visual-lab/src/styles/visual-lab.css#L1)）但无说明；再次点击无效也无反馈。
- 移动端章节条 5 个只露出 3 个（`scrollWidth 636 / clientWidth 366`），无滚动提示；章节点击 seek 到 `i+.99`（[LessonView.vue:121](../hudi-visual-lab/src/views/LessonView.vue#L121)），即该步的**末尾**而非开头，点"第 4 章"看到的是第 4 步结束帧。

**截图**：![](shots/21-B05-desktop-playing.png) ![](shots/22-B05-desktop-seek50.png)

**具体改法**：
1. stage-bar 改成 `● 正在演示 · 第 2/5 步 · 35% · 预计剩 40 秒`；暂停时变为 `Ⅱ 已暂停（拖动进度条会自动暂停）`。
2. 拖动后 1 秒 toast：「已定位到第 3 步 · 只生成更新 Log」。
3. 重置：toast「已回到初始状态」+ 画布闪一下初始态；重置按钮二次确认可省，但必须有可见反馈。
4. 「跳到结果」完成后改为「✓ 已完成 · 再看一遍」，不要只 disabled。
5. 章节点击改为 seek 到该步起点（`i` 而不是 `i+.99`），并让移动端章节条可见（圆点 + 标题）或显示左右遮罩 + 可滑动提示。

---

### P1 · 参数面板改完参数后看不出差异

**复现**：`/experiment/B05` → ⚙ 参数 → 记录主键 `1001` 改成 `9999` → 「应用参数并重置」。

**证据**：
- 应用后：抽屉关闭、步骤回 `01`、状态「准备就绪」、**整页文本不含 9999**；唯一提示是 `.lesson-bottom` 里 10px 的「参数已应用，已重置到新的初始状态。」（移动端 9px）。
- 必须再点「开始演示」并推进到第 2 步，才能看到「输入主键 9999，金额 200，ts=…」和画布里的 `9999 ¥ 200`（实测 step 02 时 body 才包含 9999）。
- 参数面板没有任何"这个参数影响哪一步"的说明；也没有参数↔画布的视觉关联（哪些参数会被使用只有代码知道）。

**截图**：![](shots/54-B05-desktop-param-applied.png) ![](shots/56-B05-desktop-param-after-play.png) ![](shots/26-B05-desktop-params.png)

**为什么这让人不直观**：用户改参数是为了"看看差别"，但应用后画面完全静止——很像没生效。要发现差异必须完成"再播放 + 等 2 步"两次额外操作。

**具体改法**：
1. 应用后自动播放到"该参数生效"的那一步（B05 是 step 2），暂停并高亮受影响节点；或至少在画布上叠加"参数预览"浮层显示 `recordKey=9999`。
2. 参数面板每个字段加一句影响说明：「记录主键 → 影响第 2 步输入记录与生成的 Log」；并显示默认值来源。
3. 提交按钮文案改「应用参数并演示到生效处」；应用成功提示移到画布上方 toast（12px+），停留 2.5s。

---

### P1 · 目录/首页卡片预览图是无标签的抽象图形

**复现**：`/catalog` 看任意卡片上半部分；`/` 看「从一个问题开始」8 张卡。

**证据**：`TopicPreview.vue` 的 SVG 是 `aria-hidden="true"`（[TopicPreview.vue:16](../hudi-visual-lab/src/components/visual/TopicPreview.vue#L16)），只有绿/棕矩形 + 虚线 + 一个动画点，**没有任何文字标签**；80 张目录卡每张 95px 高（桌面 405×249 的卡里），手机 2 列卡片里同样 95px。绿色=Base、棕色=Log 的编码在卡片上从未解释（只在 B02 的图例出现）。
- 实测：卡片内可读信息只有标题 15px + meta 9px（编号/模块/模型）+ 底部 10px（教学模型/开始观察）。

**截图**：![](shots/03-catalog-desktop.png) ![](shots/11-catalog-mobile.png)

**具体改法**：二选一。
- **A（更省认知）**：卡片预览换成"一句话结论"文本（例如 B05 卡：「更新先写 Log，合并后才有新 Base」），字号 13px、灰但不低于 4.5:1。
- **B（保留图形）**：在预览角落加 2 个 8–10 字标签（`更新→重写 Base` / `更新→追加 Log`），并在卡片 hover 时显示"图中两个色块分别是什么"的 tooltip；颜色语义复用统一图例组件。

---

### P2 · 同一事物四个名字：术语与命名不一致

**证据**（全部为实测页面文本）：
- 导航单位：首页卡片「01 / **动画实验**」、首页链接「全部 80 个**动画** →」「完整**实验**目录 ↗」、目录 h1「Hudi Lab **动画实验**」+ eyebrow「80 个**主题** · 9 个**模块**」+ 计数「80 个**可播放主题**」、动画页「← 全部**动画**」、底部「上一**主题**/下一**主题**」、进度页「**实验**清单与练习得分」。
- 与"模型/证据"相关的标签口径有 6 种：`引擎驱动`（MODEL_LABEL）、`引擎 + 机制示意`、`机制示意`、`双路径对比`（B02/B03 专用）、`教学模型`（目录卡底部）、`r26 待验证`（同卡另一侧）。
- 中英术语混用：`File Group` 150 / `文件组` 8，`Log File` 75 / `Log 文件` 11，`Instant` 883 / `提交` 121；同一页内标题用 `Log File`、说明条用 `Log 文件`。

**截图**：![](shots/01-home-desktop.png) ![](shots/03-catalog-desktop.png) ![](shots/20-B05-desktop-start.png) ![](shots/06-progress-desktop.png)

**具体改法**：定一套词并写进 CONTEXT/术语表：导航单位统一「主题」（topic），「实验」只用于故障复现类（H 模块）；CTA 统一「开始观察」；模型标签收敛为 2 个 chip（`引擎驱动` / `机制示意`），`双路径对比` 作为 B02 的 kind 徽标；术语首次出现用「File Group（文件组）」，之后可用英文，并在术语卡里解释。

---

### P2 · B02/B03 落到同一个专用页，与其余 78 页像两个产品

**证据**：
- 路由把 B02、B03 都指向 `VisualLabView`，meta title 都是 `'COW 与 MOR · 动画实验'`（[router/index.ts:28](../hudi-visual-lab/src/app/router/index.ts#L28)）；目录里 B03 的卡叫「MOR 表的数据写入与 Log 合并」，但点进去 h1 是「更新一条记录，文件会怎样变化？」、面包屑「02 · COW 与 MOR」——**卡片标题与落地页标题不一致**。
- 控件与词汇完全不同：B02 用「实验 / 设置 / 跳过动画 / 重置实验」+ 进度条 928×3 + 5 个动作按钮的动作条（工程师模式下 +1「模拟失败」）；其他页用「主题 / 参数 / 跳到结果 / 重置」+ 5 步章节 + 6 个播放控件。
- 能力也不一致：B02 有图例（179×16、10px）+ 文件 hover 点击查看内部记录，其他页没有图例；B02 无「跳到结果」，其他页有。
- 移动端 B02 的进度条只有 **19×3px**（几乎点不到），「重放」24×36。

**截图**：![](shots/30-B02-desktop.png) ![](shots/20-B05-desktop-start.png)

**具体改法**：短期：B03 目录卡直接指向一个 MOR 专用动画（或在目录卡上标注"与 B02 同一页"），并把 B02 的 h1/面包屑改成与卡片标题一致。长期：把 B02 的双画布布局、图例、动作条抽成 `CompareScene` 共享组件，两套页面共用同一套词汇与控件（播放条/参数/技术详情入口）。

---

### P2 · 关键解释藏在抽屉里，入口都是 ≤11px 的灰字

**证据**：
- 三个入口：stage-bar 右侧「技术详情 ↗」**10px**（移动端 53×16）、标题右侧「引擎驱动 ↗」**11px**、footer「教学模型 · r26 行为边界 ↗」**9px**。三者都没有"解释/术语"字样。
- 抽屉：桌面 620px 宽（`.vl-dialog`），7 个 tab（技术详情/运行日志/HDFS/Timeline/SQL/源码透视/证据，[LessonView.vue:129](../hudi-visual-lab/src/views/LessonView.vue#L129)）；「技术详情」内容高 B05 674px、S04 1426px、I03 1451px，需要长滚动；正文 13px `--vl-muted`。
- 移动端：dialog 367×844（x=23，94vw），7 个 tab 占 **2 行**（每个 76×37），首屏只看到标题 + 2 段文字。
- 抽屉本身可用（不溢出、可滚动、关闭按钮正常）——问题是**可发现性**与**信息顺序**：重要的定义在第三段之后，JSON 在前。

**截图**：![](shots/34-B05-mobile-drawer.png) ![](shots/25-B05-desktop-drawer.png) ![](shots/23-B05-desktop-inspect.png)

**具体改法**：
1. 入口改成显式按钮（描边 + 12px）：`本步讲解 / 数据 ›`，放在说明条右侧（替代 10px 灰字）；画布 hover 时也显示"点击图形查看记录"。
2. 抽屉首屏重排：① 一句话定义（本步术语）→ ② 本步发生了什么（1–2 句）→ ③ 相关数字/文件清单 → ④ JSON（折叠）。
3. tab 收敛为 2 组：「讲解」（技术详情/证据/源码透视）与「数据」（HDFS/Timeline/运行日志/SQL），默认打开"讲解"；移动端 tab 高 44px。
4. 术语定义与图例不依赖抽屉（见 P0 图例问题）。

---

### P2 · 空态 / 错误态 / 状态提示文案粗糙或不可见

**证据**：
- `/progress` 实验表空态是 Element Plus 原生「暂无数据」（[ProgressView.vue:211](../hudi-visual-lab/src/views/ProgressView.vue#L211)），没有引导动作；上面统计卡全 0，表格下方只有一行 14px 的「还没有任何学习记录 —— 先去 B02（COW vs MOR）走一遍。」，没有按钮级 CTA。
- 参数校验错误只显示在抽屉底部 11px 红字（[LessonView.vue:127](../hudi-visual-lab/src/views/LessonView.vue#L127)），关掉抽屉即丢失，且不指向具体字段。
- 目录搜索空态是合格的（「没有找到匹配的动画。＋清除筛选」），但计数行与空态文案重复表达"0"。
- 未知 id 的 `lesson-not-found` 只有「没有找到这个动画实验」+ 返回链接，没有建议（目录/上一主题）。
- 「参数已应用」与「机制示意」等状态都放在 `.lesson-bottom` 10px（移动端 9px）里，极易错过。

**截图**：![](shots/04-catalog-search-zzz.png) ![](shots/43-progress-after-lesson.png)

**具体改法**：统一空态组件：`图标 + 一句解释 + 一个行动按钮`（progress：「还没有学习记录 → 从 B02 开始」；表格空：「暂无数据」→「这个模块还没有实验记录，去看 A 基础原理 的 8 个主题」）；错误提示移到画布上方常驻条（12px+、带具体字段名）；状态类文案统一 12–13px 并带图标。

---

### P2 · 画布的可访问性与交互提示

**证据**：
- `svg.lesson-canvas` 带 `role="img"` + `aria-label`，但内部有 2–5 个 `role="button"` 子节点（B05 nestedButtons=2、I03=5、S04=4、Q02=5、E01=1，全部 `nestedInsideImg=true`）——屏幕阅读器会把整个 SVG 当一个图，子按钮不可达。
- 所有可点 glyph 都没有 `<title>` 或 `title` 属性（B05 2 个中 0 个，全部页面 0），hover 仅把描边改成 `--vl-ink`（[FileGlyph.vue:20](../hudi-visual-lab/src/components/visual/FileGlyph.vue#L20)），没有 tooltip；B05 的 2 个 glyph 中 1 个 `cursor:pointer`、1 个 `default`（不可点的预览文件），但视觉上两者几乎一样（都是半透明），用户不知道哪个能点。
- 章节按钮有 `aria-current`（好），但播放条 range 的 `aria-label` 是"动画进度"（可接受），速度 select 无 label 关联。

**截图**：![](shots/21-B05-desktop-playing.png)

**具体改法**：去掉 SVG 的 `role="img"`（或把可点组抽到 SVG 之外的 HTML 列表，SVG 只做视觉）；每个可点节点加 `<title>` 与 `aria-label`（"Log File …log.1：含 1 条 U 记录，点击查看"）；hover 显示 120ms 延迟 tooltip；不可点节点统一 `opacity:.45 + cursor:default` 并在图例里说明"虚线/半透明=预览，不可点"。

---

## 五、如果只做 5 件事（按投入产出排序）

1. **修移动端画布**（P0-1）：≤550px 改 HTML 单步卡片布局，字号 ≥13px；章节条改圆点。**不修 = 手机端产品不可用**，且这是"不直观"最直观的放大器。
2. **加图例 + 首屏术语卡 + 每页一句话结论**（P0-2 + P1-首页/动画页首屏）：统一 `CanvasLegend` 组件、在 B05/B04/Q02/F03 首屏给"Log 是追加增量、Snapshot 合并、RO 忽略"的白话定义。**这是"不清晰、不详细"的直接解药**，改动集中在 1 个新组件 + 1 段模板。
3. **打通进度并收编两个孤儿页**（P0-3 + P1-progress/evidence）：`markVisited` 接入 `LessonView` + 视觉壳导航加"进度/证据"入口 + 两页换成 `--vl-*` 卡片布局（顺带修掉 494>390 溢出）。
4. **一次性重建字号/对比度 token**（P1-字号 + 浅色 + 深色彩底）：最小字号 12px、浅色 `--vl-muted` 改 `#5b6a61`、浅色彩底文字改 ink 系、文件卡字号 10→12。改 3 个 CSS 文件即可全局生效，影响面最大。
5. **目录可搜可筛可点**（P1-搜索 + 吸顶 + 44px）：搜索字段扩展 + 中文关键词表 + toolbar sticky + 移动端 44px 点击目标。让"80 个主题"真正能被找到。

---

## 六、附：证据文件索引

| 内容 | 文件 |
|---|---|
| 桌面/移动各页测量原始数据 | `_analysis/raw-01-pages.json` |
| 12 个动画页桌面逐项数据（画布/字号/图例/反馈/抽屉/参数） | `_analysis/raw-02-lessons-desktop.json` |
| 移动端动画页、浅色对比度、进度断层、B02 数据 | `_analysis/raw-03-interactions.json` |
| 画布占用率、首屏清单、参数生效测试 | `_analysis/raw-04-final.json` |
| 本轮运行日志（含逐条对比度失败明细） | `_analysis/log-03.txt` |
| 截图（本次共 120+ 张，报告引用 37 张） | `_analysis/shots/` |
