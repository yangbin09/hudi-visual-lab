# 02 · 教学内容审计报告（Hudi Visual Lab）

> 审计对象：`D:\code\hudi演示\hudi-visual-lab`（只读分析，未修改 `src/` 任何文件）
> 审计范围：80 条目录条目 / 78 个动画主题 / 315 条步骤旁白 / 24 个核心术语 / 42 条 note / 9 个模块
> 方法：`read` 通读 `lessons.ts`（91 行超长行）与 9 个 `modules/*.ts`；用 esbuild 把 TS 模块编译后导入，脚本化统计（脚本见附录）；用 Playwright（msedge）核对 5173 实站渲染。
> 实站核对结果：`/catalog` 渲染 80 张卡片、卡片正文中 `summary` 出现 **0 次**；`/experiment/B01` 整页正文仅 545 字符，无目标/前置/结论/自检；`/experiment/B02` 页面 902 字符，无 5 道已写好的测验题。

---

## 一句话结论

**内容"不直观/不清晰/不详细"在内容层面的三个根因：**

1. **教学骨架缺失**：80 个主题没有"目标 → 前置 → 结论 → 自检"这条学习闭环，学生不知道"我为什么要看这个、看完该会什么、我懂了没有"；每个主题的全部讲解文字平均只有 **53 个汉字**（84 字符），只是 4 句现象播报。
2. **术语先裸用、后不解释**：24 个核心术语里 **0 个**在步骤旁白中给出定义；File Group / File Slice 在**第一个主题第 3–4 步**就开始用，而"定义"要到第 4 个主题、且只写在**不展示的目录摘要**里；Checkpoint 被 5 个主题用了 9 次，全站没有定义。中英文同义异名（提交/Instant/commit、合并/Compaction/归并、文件组/File Group、桶/Bucket）进一步稀释理解。
3. **免责话术挤占了讲解位置**：18% 的步骤旁白（57/315）在讲"示意/模拟/待验证/未实现"，47% 的主题（37/78）正文里至少有一句边界声明；本来该讲"为什么"的句子，被写成了"本页不模拟…""待实测…"。同时 26% 的主题（20/78）**根本没有一次真实状态变化**（11 个零操作 + 9 个仅 1 次操作），"看动画"确实看不出东西。

---

## 一、量化统计表

### 1.1 总量与结构（数据源：`src/experiments/visual/lessons.ts`、`catalog.ts`）

| 指标 | 数值 | 说明 |
|---|---|---|
| 目录条目 | 80 | 9 模块：A8 / B8 / C10 / D8 / E8 / F12 / G8 / H10 / I8 |
| 有动画实现的主题 | 78（97.5%） | 缺 `B02`、`B03`；二者路由到 `VisualLabView`（`router/index.ts:28-29`）的双画布实验 |
| 步骤总数 | 315 | 75 个主题 4 步；仅 B04 / B05 / S01 为 5 步 |
| 每主题旁白总字数 | 53 – 131 字符 | 最少 W05 / I04 = 53，最多 W07 = 131；平均 84 字符 / 53 汉字 |
| 单步旁白长度 | 平均 20.8 字符（13.1 汉字），中位 20，p90 28，最长 62，最短 6 | 见 1.3 |
| 证据等级 | E1 60 / E2 13 / E0 7 | `supportState`：supported 42 / conditional 23 / unverified 15 |
| note（证据缺口） | 42/80 | 其中 18 条含"待实测"、2 条含"待验证" |

### 1.2 结构完整性（逐项统计，附证据）

| 结构项 | 有该结构的主题数 | 占比 | 现状与证据 |
|---|---|---|---|
| 一句话摘要（summary） | 80/80 有数据，**卡片展示 0/80** | 0% 可见 | 数据在 `modules/*.ts`，但卡片模板只渲染 title/徽标：`AnimatedCatalogView.vue:15`；实站 `.catalog-card p` = 0。仅 `LessonView.vue:130`「技术详情」抽屉里可见 |
| 学习目标 | **0/80** | 0% | `VisualLesson` 类型无该字段：`visual/types.ts:4-15`。全站唯一有目标的是 B02（`basics/B02CowVsMor.ts:467-473`，5 条），但其页面不渲染 |
| 前置知识 | **0/80** | 0% | 同上。B02 有 2 条（`B02CowVsMor.ts:476-479`），不展示 |
| 关键结论 / 一句话总结 | **0/80** | 0% | `types.ts` 无字段；动画链路中"关键结论/一句话/小结/总结"0 命中 |
| 已注册的 ExperimentDefinition | **1 个（仅 B02）** | 1.3% | `experiments/index.ts:16` 只注册 B02；78 个动画主题没有对应实验定义（也就没有目标/前置/测验数据） |
| 自检 / 测验 | **0/80 可达** | 0% | `QuizPanel` 仅被 `ExperimentView.vue:31,919` 使用，而 `ExperimentView` **不在路由表**（`router/index.ts:20-55`）；B02 写好的 5 题（`B02CowVsMor.ts:378-456`）在 /experiment/B02 页不渲染（实站核对 true） |
| 难度 / 预计时长 | **0/80** | 0% | 字段只存在于 `ExperimentDefinition`（`models/simulation.ts:93-96`），目录条目没有 |
| 步骤数 ≥ 4 | 78/78 | 100% | 无 1–2 步的"讲不清"主题（这点没问题） |
| 二级细节（moments） | 1/78（仅 E01） | 1.3% | `lessons.ts:70` 是唯一使用 `moments` 的主题；播放器支持逐帧解释（`LessonView.vue:118`），但只有 1 个主题用 |
| limitation 字段 | 0/78 | 0% | `types.ts:14` 定义了 `limitation`，无任何主题设置 |

> 关键判断：**"教学结构"的代码能力其实已经存在**——`models/simulation.ts:87-114` 定义了 `learningObjectives / difficulty / prerequisites / quiz / edgeCases`，`components/experiment/ExperimentShell.vue:180-198` 已实现「前置知识 / 学习目标」渲染，`QuizPanel.vue` 已实现判分与解析。但它们只服务 B02 一个（且未路由的）实验页；78 个动画主题走的是 `VisualLesson`，从数据模型上就不具备这些字段。

### 1.3 旁白质量分布

| 指标 | 数值 |
|---|---|
| 步骤旁白总数 | 315 |
| 平均 / 中位 | 20.8 / 20 字符（约 13 / 12 个汉字） |
| p90 / 最长 / 最短 | 28 / 62（E01#2 25 汉字）/ 6（B04#4「先生成计划。」） |
| 含因果/解释连接词（因为、所以、原因、否则、意味着、而不是…） | **3/315 = 1%**（I05#4、Q03#4、Q05#3） |
| 以"你会看到什么"开头 | **0** |
| 以操作指令动词开头（点击/观察/查看/选择/切换…） | 50/315 = 16% |
| 中文 ≤8 字 | 37/315 = 11.7% |
| 中文 ≤12 字 **且** 无因果解释词（纯现象/指令碎片） | **145/315 = 46%** |
| 每主题旁白合计 | 平均 84 字符（≈53 汉字），比一条微博还短 |

**各模块旁白长度（字符/步）——注意越到后期越短，与难度方向相反：**

| 模块 | 主题数 | 步骤 | 旁白字/步 | 特征 |
|---|---|---|---|---|
| A 基础原理 | 6 | 26 | 22.3 | 首课 5 个核心术语一次性出现 |
| B 建表分区 | 8 | 32 | 22.1 | — |
| C 数据写入 | 10 | 40 | 21.3 | — |
| D 索引机制 | 8 | 32 | 20.7 | 5/8 标 unverified |
| E 数据查询 | 8 | 32 | 20.7 | — |
| F Timeline/表服务 | 12 | 49 | 21.9 | 6/12 conditional |
| G Spark/Flink | 8 | 32 | 21.3 | 含 2 个 E0 主题 |
| H 故障实验室 | 10 | 40 | **19.2** | 6/10 conditional |
| I 高级专题 | 8 | 32 | **18.0** | 最难的模块，旁白最短 |

**最差的 3 个旁白例子（原文引用）：**

1. **B04「File Group、File ID、File Slice 结构」**（`lessons.ts:11`）——核心存储术语最密集的主题（File Group / File ID / File Slice / Base File / Log File 在同一画布出现），5 步旁白共 118 字符，第 4 步全文是：
   > 标题「重建 Slice」，旁白：「**先生成计划。**」（5 个汉字）
   第 5 步：「执行计划，新的 Base 取代旧 Slice 中的文件引用。」——"计划是什么、为什么要有计划、新 Base 和旧 Base 什么关系"全部缺席。
2. **T05「Hive Style Partitioning」**（`lessons.ts:20`）——旁白长度排第二（32.5 字符/步，仅次于 W07 的 32.8），但没有一句在讲三种模式的区别，第 2 步：
   > 「NONE、HIVE_STYLE_PARTITIONING、STYLE_PARTITIONING_ONLY 在配置卡片中对比。」
   第 4 步直接收尾：「该动画为配置机制示意，不模拟三种模式下真实文件编码。」——学生看完仍不知道"双写 vs 仅目录"对下游读取意味着什么。
3. **T08「建表、写入与 Schema 演进限制」**（`lessons.ts:23`）——主题承诺讲新增列/删列/改类型三类约束，实际 4 步里没有一类被讲清，最后一步是：
   > 标题「不伪造执行」，旁白：「当前引擎未实现 Schema 演进，动画只展示校验关口。」
   第 2 步仅「新消息可能携带可空字段。」——既没说"可空列为什么通常兼容"，也没说"删列/改类型为什么危险"。

### 1.4 核心术语统计（24 个必查术语 + 10 个补充）

> 统计口径：旁白命中 = 315 条 caption；标题/节点命中 = 315 个步骤标题 + 331 个画布节点；覆盖主题 = 78 个动画主题；"定义"指**出现能被学生读到的解释句**（含目录摘要，但摘要只在抽屉里可见，卡片不展示）。

| 术语 | 旁白命中 | 标题/节点 | 覆盖主题 | 首次出现（主题#步） | 首次定义处 | 定义可见性 |
|---|---|---|---|---|---|---|
| Commit / 提交 | 19 | 28 | **30** | B01#4（步骤标题「提交快照」） | 无（S02 摘要只说"COW 的一次性 commit 与 MOR 的 commit+delta commit 组合"） | ❌ |
| Record Key / 主键 | 21 | 18 | **24** | B06#1 | B06 摘要（`HoodieKey = Record Key + Partition Path`） | ⚠️ 仅抽屉 |
| Bucket / 桶 | 22 | 14 | 8 | I03#2 | I03 摘要（"主键哈希映射到固定数量的桶"） | ⚠️ 仅抽屉 |
| Snapshot / 快照 | 11 | 17 | 18 | B01#4 | Q01 摘要（描述"合并 base+log"的行为） | ⚠️ 晚 34 个主题 |
| Pending | 12 | 13 | 7 | S08#2 | S12 摘要 | ⚠️ 晚 4 个主题 |
| File Group / 文件组 | 11 | 13 | 18 | **B01#3** | 无（A 模块描述只列名字；B04 摘要"把散落的物理文件按 File Group 重新聚合"是循环解释） | ❌ |
| Timeline / 时间线 | 10 | 8 | 14 | **B01#1** | 无（S01 摘要"按 instant time 排序的一串 Instant"是循环定义） | ❌ |
| File Slice | 8 | 4 | 9 | **B01#4** | B04 摘要（`File Slice = Base File + 若干 Log File`） | ⚠️ 晚 3 个主题、仅抽屉 |
| Base File | 1 | 2 | 2 | B04#1（画布节点） | 无（只在 B04 摘要的结构式里被提及，未解释是什么） | ❌ |
| Log File | 0 | 2 | 2 | B04#1（画布节点） | 无（同上；B03 摘要有一句"更新写成 Log File"，但 B03 无动画课） | ❌ |
| Clean / Cleaner | 5 | 7 | 7 | W06#4 | S06 摘要（效果描述） | ⚠️ 晚 26 个主题 |
| Rollback / 回滚 | 4 | 8 | 4 | S08#2 | S08 摘要 | ⚠️ 仅抽屉 |
| Instant | 3 | 8 | 7 | **B05#2** | 无（S01 摘要循环定义） | ❌ 晚 38 个主题 |
| Checkpoint | 8 | 2 | 5 | B07#1 | **无任何主题定义**（42 条 note/80 条摘要均未解释） | ❌ |
| Partition Path / 分区路径 | 6 | 3 | 6 | B06#1 | B06 摘要 | ⚠️ 仅抽屉 |
| Archive / 归档 | 4 | 5 | 3 | S07#3 | S07 摘要 | ⚠️ 仅抽屉 |
| Clustering / 聚类 | 2 | 6 | 2 | S10#2 | S10 摘要（效果描述） | ⚠️ 仅抽屉 |
| Compaction | 4 | 3 | 6 | **B05#1** | S04 摘要（效果描述：log 合并成 base） | ⚠️ 晚 41 个主题 |
| Hive Sync / HMS | 2 | 5 | 3 | T06#1 | T06 摘要 | ⚠️ 仅抽屉 |
| HDFS | 2 | 5 | 5 | T03#4 | B08 摘要/模块 A 描述 | ⚠️ |
| MOR | 6 | 0 | 6 | **T01#3** | 仅 B03 摘要（B03 无动画课） | ❌ |
| Incremental / 增量 | 2 | 4 | 3 | W03#4 | Q03 摘要 | ⚠️ 晚 18 个主题 |
| Bulk Insert | 5 | 1 | 4 | W04#1 | W04 摘要 | ⚠️ 仅抽屉 |
| Precombine | 4 | 1 | 4 | **T01#1** | T02 摘要（下一主题） | ⚠️ |
| COW | 4 | 0 | 4 | **T01#3** | 仅 B02 摘要（B02 是另一页实验） | ❌ |
| Read Optimized / 读优化 | 1 | 3 | 2 | Q02#1 | Q02 摘要 | ⚠️ 仅抽屉 |
| Schema | 1 | 3 | 2 | T08#4 | 无（T08 只给边界声明） | ❌ |
| TTL | 0 | 2 | 1 | S11#2 | S11 摘要只给语法，未解释 TTL=Time To Live | ❌ |
| DeltaCommit | 1 | 1 | 1 | S02#1 | S02 摘要 | ⚠️ |
| HoodieKey | 0 | 1 | 1 | B06#1（节点） | B06 摘要 | ⚠️ 仅抽屉 |
| Metadata Table | 1 | 0 | 1 | A03#4 | A03 摘要 | ⚠️ 且页内声明"未实现" |
| OCC / 并发控制 | 1 | 0 | 1 | A04#4 | A04 摘要（概念性） | ⚠️ 且页内声明"未建模" |
| ReplaceCommit | 0 | 0 | 0 | 动画中从未出现 | S10 摘要提及 2 次 | ❌ 目录承诺、正文不存在 |
| File ID | 0 | 0 | 0 | 动画中从未出现 | 仅 B04 标题/摘要 | ❌ 同主题标题承诺、正文不存在 |

**结论：24 个必查术语中，步骤旁白里给出定义的 = 0 个；解释只存在于"目录摘要"（只在技术详情抽屉里可读）的 17 个；连摘要都没有的 7 个（File Group、Base File、Log File、Timeline、Instant、Commit、TTL）；再加上步骤里实际使用、但全站（旁白+摘要+note）都没有定义的 Checkpoint、Schema，共 9 个词是"裸用"。定义出现得最晚的是 Compaction（41 个主题后才解释）与 Snapshot（34 个主题后）。**

### 1.5 中英文混用 / 同义异名

| 概念 | 竞争写法（出现次数） | 问题 |
|---|---|---|
| commit / 提交 | **提交 43**、Instant 10、commit 1 | "提交"既是名词（commit instant）又是动词（提交快照/提交边界），学生无法区分"提交动作"和"提交记录" |
| Compaction / 合并 | **合并 28**、Compaction 7 | "合并"同时指 Compaction、查询归并（Q01#3「归并同键版本」、Q05#2「共同参与归并」）、文件合并，三种语义混用 |
| Bucket / 桶 | **桶 28**、Bucket 6、分桶 2 | 同一主题 I03 内标题用"分桶/桶"，节点用 `Bucket`，配置项用 `num.buckets` |
| File Group | File Group 19、**文件组 5** | 混用；且大小写不一致（`FileGroup`/`File Group`/`file group`） |
| Snapshot / 快照 | 快照 15、Snapshot 13 | 约 1:1 混用 |
| Clean / 清理 | Clean 7 / Cleaner、清理 5 | 动词与组件名混用 |
| Rollback / 回滚 | 回滚 7、Rollback 5 | — |
| Archive / 归档 | 归档 4、Archive 5 | — |
| Timeline / 时间线 | **Timeline 17、时间线 1** | 中文几乎不用，但正文其他名词又大量中文 → 术语体系不一致 |
| Record Key | 主键/Record Key 合计 21、`recordkey.field`、`primaryKey`、HoodieKey | 一个概念 5 种写法 |
| Base | Base、Base File、新 Base、旧 Base | "Base"单独出现 9 次未加 File |
| 节点标签语言 | 331 个画布节点中 153 个含英文（46%）；**60/78 个主题同一画布内中英混排** | 例：B01 节点 =「更新记录 / Hudi Writer / 文件版本 / Timeline」；B05 =「Base instant / Log v1 / Log v2 / 新 Base」 |

### 1.6 免责 / 限定话术计数

**A. 步骤旁白内（会直接打断讲解）：**

| 类型 | 次数 |
|---|---|
| 模拟（"本地模型/不模拟…"） | 16 |
| 不伪造 / 避免虚构 / 不宣称 / 不代表实测 | 14 |
| 示意 / 机制示意 | 13 |
| 未实现 / 未建模 / 未执行 | 6 |
| 仅展示 / 不能推断 / 不换算 | 6 |
| 不连接真实（集群/服务） | 4 |
| 假设 / 本案例 / 当前教学 | 4 |
| 待验证 / 待实测 | 4 |
| **合计命中步骤** | **57/315 = 18%**，覆盖 **37/78 主题（47%）** |
| 单主题最高 | T06 / I02 / E10 / A05 各 3 条（4 步里 3 步在讲边界） |

**B. 目录元数据（`summary` / `note`）：**

- `note` 42/80 条（52.5%）；其中 18 条含"待实测"、2 条含"待验证"。
- 每张目录卡底部固定 1 个徽标：15 张「r26 待验证」+ 65 张「教学模型」。
- 每个动画页 footer 固定 1 个：「教学模型 · r26 行为边界 ↗」或「待验证 · 查看依据 ↗」（`LessonView.vue:125`）；「技术详情」抽屉再重复 model 说明 + note 两段（`LessonView.vue:130`）。
- 全 `src` 关键词计数：模拟 67、需实测 40、示意 39、待验证 26、未实现 13、教学模型 8、不伪造 4、假设 4、本案例 4。

**判断：过载，且位置错误。** 学生需要理解的时刻（第 2–3 步讲机制时）被"不模拟/未实现/待实测"打断；真正需要这些边界说明的时刻（动手操作前、看证据时）反而只靠一个 footer 图标。**应把步骤级边界话术收敛为统一的 ⓘ 图标 tooltip（每主题 ≤1 处），把 note 集中在"技术详情"里，旁白只讲机制。**

### 1.7 重复与空洞

| 可疑类型 | 清单 |
|---|---|
| 画布节点列表**完全相同** | `B07 = Q01`（读取请求/选择文件/归并版本/返回记录）；`W01 = W02 = W10`（输入记录/Writer/定位 File Group/写入文件/提交 Timeline）；`S03 = S04`（当前文件/服务计划/执行合并/新 File Slice/提交 Timeline） |
| 目录标题高度相似（中文 bigram Jaccard） | F07「Kerberos、HDFS、HMS 权限链路」↔ E10「Kerberos、HMS、HDFS 权限故障」**0.79**；W05↔W06 0.56；I03↔I04 0.50；F05↔E09 0.48；S03↔S05 0.47；S04↔S05 0.45；S05↔F05 0.44；S05↔A05 0.43；S03↔S04 0.41；S07↔A07 0.36；T01↔F01 0.36；T02↔W08 0.38；W04↔E03 0.39 |
| 旁白用词最接近 | B07↔Q04 0.30；B05↔S04 0.26；S05↔F05 0.24；T02↔W08 0.22；W03↔Q08 0.22；S08↔E07 0.21；S03↔S12 0.20；S10↔A01 0.18 |
| **零操作主题**（4 步全是 observe，动画不高亮之外的任何状态变化） | **11 个**：T05、T06、T08、W07、F04、F07、F08、E01、E10、A03、A04 |
| 仅 1 次真实操作的主题 | 9 个：I02、Q01、Q03、Q06、Q07、S03、S07、F06、A02 |
| 合计"看动画≈没变化" | **20/78 = 26%** |
| 1–2 步的主题 | **0 个**（这不是问题） |

### 1.8 难度递进与"先用后定义"

- **认知负荷曲线是平的，甚至后期更轻**：全部主题 4 步（3 个 5 步）；旁白长度 A 22.3 → H 19.2 → I 18.0 字符/步。难度标签/前置提示为 0，学生无从判断"现在该不该看 I 模块"。
- **36 个术语首次出现在 78 个主题里，其中 13 个（36%）挤在前 6 个主题**：B01 一个主题首次引入 5 个（File Group、File Slice、Timeline、Snapshot、Commit），B04 再引入 2 个，B05 引入 2 个（Instant、Compaction），B06 引入 3 个（HoodieKey、Record Key、Partition Path），B07 引入 Checkpoint。
- **先用后定义的具体案例（按目录顺序）：**

| # | 使用处（原文） | 定义处 | 跨度 |
|---|---|---|---|
| 1 | **B01#3**「本次只更新目标 File Group，保留旧文件。」（`lessons.ts:10`） | B04（第 4 个主题，且全篇无定义） | 3 个主题 |
| 2 | **B01#4**「Timeline 与当前 File Slice 一起指向新版本。」（`lessons.ts:10`） | B04 摘要（仅抽屉） | 3 个主题 |
| 3 | **B01#4** 步骤标题「提交快照」 | Q01（第 35 个主题） | **34 个主题** |
| 4 | **B05#1**「Base 已由引擎的初始 Compaction 建立。」（`lessons.ts:12`） | S04（第 46 个主题） | **41 个主题** |
| 5 | **B05#2**「Log 携带本次更新记录与写入 Instant。」（`lessons.ts:12`） | S01（第 43 个主题） | **38 个主题** |
| 6 | **B07#1**「初始提交的 Checkpoint 记录旧文件版本。」（`lessons.ts:14`） | **全站无定义**（B07/Q04/S09/F03/F04 共 5 个主题用了 9 次） | ∞ |
| 7 | **T01#3**「文件落点由所选 COW/MOR 及引擎规则决定。」（`lessons.ts:16`） | 无动画主题定义（定义只在 B02/B03 的非课程页） | ∞ |
| 8 | **W03#4**「增量结果保留 D 标记，供下游处理删除。」（`lessons.ts:26`） | Q03（第 36 个主题） | 18 个主题 |

---

## 二、按严重度排序的问题清单

### P0 —— 直接导致"不清晰 / 不够详细"

**P0-1 80 个主题没有学习闭环（目标/前置/结论/自检全为 0），而相关组件与数据模型已经写好却没接上。**
- 证据：`visual/types.ts:4-15`（`VisualLesson` 无任何教学结构字段）；`experiments/index.ts:16`（全站只注册了 B02 一个 ExperimentDefinition）；`router/index.ts:20-55`（`ExperimentView` 无路由）；`ExperimentView.vue:31,919`（`QuizPanel` 唯一使用处）；`ExperimentShell.vue:180-198`（前置/目标组件）；`B02CowVsMor.ts:378-456,467-487`（B02 已写 5 道题 + 5 条目标 + 2 条前置，但 /experiment/B02 走 `VisualLabView`，不渲染）；实站核对：B01/B04/I03/S04 四页 `学习目标|前置知识|自测` 命中均为 false。
- 学生后果：点开任意主题只看到 4 个步骤标题和 4 句现象播报；不知道看完该会什么，也没有任何"我是否懂了"的反馈。学习进度页（`ProgressView`）与动画链路之间也没有记录点。
- 改法：给 `VisualLesson` 增加 `objective / prerequisites / takeaway / quiz` 四个字段；`LessonView` 顶部渲染目标与前置（复用 `ExperimentShell` 的样式），最后一步后追加「一句话结论 + 2 道自检题（复用 `QuizPanel`）」。数据先从 catalog 的 `summary/note` 自动生成，再逐主题人工改写（示范见第三节）。

**P0-2 术语零定义裸用，且首次出现就是最关键的几个词。**
- 证据：`lessons.ts:10`（B01#3 File Group、B01#4 File Slice/「提交快照」）；`lessons.ts:12`（B05#1 Compaction、#2 Instant）；`lessons.ts:14`（B07#1 Checkpoint）；`lessons.ts:16`（T01#3 COW/MOR）。全站 315 条旁白中带解释词的只有 3 条。
- 学生后果：从第一个主题第三帧开始，"File Group / File Slice / Timeline / 提交 / 快照"同时出现且都不解释，只能靠猜；到 S 模块（Timeline/表服务）时，前面 40 个主题里积累的误解已经无法纠正。
- 改法：①在每个术语**首次出现的那一步**加一句行内定义（≤18 字，如「File Group：同一 File ID 下的一组文件版本」）；②新增「术语表」页（24 个词，中英对照 + 首次出现主题 + 易混词）；③统一词表：`Compaction` 只写 Compaction、查询归并写"归并（merge）"、"提交"只在"提交动作"义使用，Instant/commit 一律写 Instant；④`ReplaceCommit`、`File ID` 两个目录承诺但正文缺失的术语补进 S10 / B04。

**P0-3 旁白过短且只描述现象，不解释原因。**
- 证据：315 条旁白平均 20.8 字符（13 汉字），**46%（145/315）** 是 ≤12 汉字且无因果词；最短 5 个汉字「先生成计划。」（`lessons.ts:11` B04#4）。最差三例见 1.3。
- 学生后果：动画里"文件变灰/出现新文件/状态从 REQUESTED 变 COMPLETED"这些现象没有任何一句解释"为什么"，学生只能记住画面、记不住机制——这正是"不够直观、不够详细"的体感来源。
- 改法：把每条旁白改为固定三段式：**「看到：… → 原因：… → 所以：…」**，长度 45–90 字；删除纯 UI 指令（点击/查看/高亮）——这些应放进控件旁的操作提示，而不是教学旁白。

**P0-4 26% 的主题（20/78）动画里"什么都没发生"。**
- 证据：11 个零操作主题 T05/T06/T08/W07/F04/F07/F08/E01/E10/A03/A04（`lessons.ts:20,21,23,30,65,68,69,70,79,82,83`）；9 个单操作主题 I02/Q01/Q03/Q06/Q07/S03/S07/F06/A02。
- 学生后果：这 20 个主题里，学生点开动画只看到节点被高亮或一条分支线，没有文件变化、没有 Timeline 变化、没有指标变化——"看动画"完全无法建立因果直觉。
- 改法：给每个主题设计**至少一次可观察的状态变化**（例：F07 Kerberos 改为"选择失败关口 → HDFS 目录权限被拒 → 作业停在提交前，文件数为 0"，用状态数字体现"被拦住"）；无法做出状态变化的主题（T05 三种分区模式）改为并排三列配置对照 + 同一批文件在三列下的字段/目录差异，而不是"分支高亮"。

**P0-5 免责话术进入讲解正文，挤掉了"为什么"。**
- 证据：57/315 步骤（18%）、37/78 主题；4 步里 3 步是边界声明的主题：T06（`lessons.ts:21`：第 1 步"HDFS 有数据，并不代表 HMS 已同步"、第 4 步"这是同步链路示意，未连接真实 HMS"）、I02（`lessons.ts:35`）、E10（`lessons.ts:79`）、A05（`lessons.ts:84`）。另有每卡/每页常驻徽标与 footer（1.6 B）。
- 学生后果：读到"待验证/不模拟/未实现"时，理解链被打断，且会产生"这个站什么都不可信"的逆反；真正值得警惕的点（例如 BUCKET+bulk_insert、MOR 首写落点）反而被淹没在通用免责句里。
- 改法：建立**分级披露**——步骤旁白只讲机制；所有边界统一为节点/术语旁的 ⓘ tooltip（hover/点击展开）+ 每主题至多 1 条"本主题边界"卡片（放在最后一步之后，与结论并列）；删掉"本页不模拟…"这类对理解零贡献的句子，保留"r26 未确认：具体是 X"这类可执行的信息。

### P1 —— 显著削弱清晰度

**P1-6 目录卡片不展示 summary（写好的解释学生看不到）。**
- 证据：`AnimatedCatalogView.vue:15` 卡片只渲染 id/模块/模型标签/标题/状态徽标；实站 `.catalog-card p` = 0；80 条 summary 只出现在 `LessonView.vue:130`「技术详情」抽屉。B01 卡片全文："B01 · 基础原理 / 引擎驱动 / Hudi 与 Hive 普通 Parquet 表的区别 / 教学模型 / 开始观察 →"。
- 改法：卡片增加 1 行 summary（截断 40 字）+ 1 行"学完你能…"（目标第一句）；标题下加难度/时长。

**P1-7 SQL / 命令抽屉按「场景类型」注入通用模板，而不是按主题——12 类命令永远看不到。**
- 证据：`LessonView.vue:74` 仅 12 个模板 id（query 4 个、create-cow/mor、upsert、delete、compaction×2、clean、flink-create），按 `lesson.kind` 选择；而四个模板文件共 **44 个模板**，其中 **32 个在动画页永远不出现**：`spark-archive`、`spark-clustering`、`spark-ttl-*`（4 个）、`spark-bulk-insert`、`spark-insert-overwrite-*`（2 个）、`spark-insert`、`spark-clean-automatic-3-1`、`spark-show-partitions`、全部 scala（8 个）与 shell（8 个）、大部分 Flink（4 个）。
- 具体后果：S07「Archive Timeline 归档」抽屉里显示 upsert/delete/compaction/clean（时间线类固定 5 条），**没有 `RUN ARCHIVELOG`**；S10 Clustering 看不到 `CALL run_clustering`；S11 TTL 看不到 `ttl_policy_save`；S08 Rollback 看不到任何回滚命令；T06 Hive Sync 看不到 `shell-hive-sync`；W04 Bulk Insert 看不到 `spark-bulk-insert`。学生学完仍不知道"这在真实集群上对应哪条命令/配置"。
- 改法：把模板映射改为"主题 → 模板 id"（在 `CatalogEntry` 或 `VisualLesson` 上加 `templateIds: string[]`），至少保证 1 条主命令 + 1 条排查命令；模板里的 `note/prerequisites/risks` 已经是全站质量最高的解释文本（例：`sparkSql.ts:189-203` 增量查询、`shell.ts:138-159` Hive Sync），应上移为步骤旁白素材。

**P1-8 同义异名与中英混用（详见 1.5）。**
- 证据：提交 43 / Instant 10 / commit 1；合并 28 / Compaction 7；文件组 5 / File Group 19；桶 28 / Bucket 6；主键 / Record Key / primaryKey / recordkey.field / HoodieKey 五种写法；60/78 主题画布中英混排。
- 改法：发布术语表（一次定义 + 全局唯一写法），并在播放器里对术语做 hover 释义；画布节点标签统一语言策略（术语保留英文，其余全中文）。

**P1-9 主题之间的重复与承诺不匹配。**
- 重复证据见 1.7（3 组节点完全相同 + **17 对**标题相似度 ≥0.35）。
- 承诺不匹配（summary 承诺 A，动画只给通用的 B）：
  - T05 承诺"对比三种配置的存储方式" → 实际"该动画为配置机制示意，不模拟三种模式下真实文件编码"（`lessons.ts:20`）。
  - W07 承诺"四种 SaveMode 的差异" → 实际只有分支高亮 + "不模拟 Spark SaveMode 的执行"（`lessons.ts:30`）。
  - I07/I08 承诺"兼容性矩阵" → 实际只测 BUCKET + bulk_insert 一个组合（`lessons.ts:40,41`）。
  - A03 承诺"Metadata Table 能替代哪些列举" → 实际"当前未实现 Metadata Table"（`lessons.ts:82`）。
  - S09 承诺"用 Restore 回滚到历史 instant" → 实际"当前引擎没有 Restore 动作"（`lessons.ts:58`）。
  - S11 承诺"TTL 分区过期与清理" → 只演示"仅支持 PARTITION"与 Cleaner 保留窗口，未讲 TTL spec 匹配语义（`lessons.ts:60`）。
- 改法：把 W01/W02/W10、S03/S04 这类"同节点同结构"合并成一个多步骤主题或明确分工（"W02 讲文件落点，W10 只讲幂等性判断，不重复动画"）；承诺与实现二选一——要么补内容，要么改 summary 说清"本主题只讲 X 的边界"。

**P1-10 难度不递进，前置关系不可见。**
- 证据：全部 4 步、后期模块旁白更短（1.3 表）；13/36 个术语挤在前 6 个主题；8 对"先用后定义"（1.8），最远跨 41 个主题。
- 改法：给每个主题标注难度（入门/进阶/高级）与前置主题 id（用 DAG，不只上一个/下一个），并在首次使用未定义术语时插入"先修提示：本主题用到 X，见 B04"。

### P2 —— 影响体验但不阻碍理解

**P2-11** 证据徽标信息密度低且机械重复：每卡 1 个 + 每页 footer 1 个 + 抽屉再 2 段（`AnimatedCatalogView.vue:15`、`LessonView.vue:125,130`）；15 张"r26 待验证"卡片标题相同，学生无法区分"待验证的是公式细节还是整体结论"。建议：徽标只在卡片出现一次，hover 显示"待验证的具体点"。
**P2-12** `moments`（步骤内二级细节解释）只有 E01 使用（`lessons.ts:70`），而播放器 `player.moments` 已支持在第 118 行显示"1/4 细节"；建议至少给 B01/B04/术语密集主题补 2–3 个 moments。
**P2-13** `limitation` 字段 0 使用（`types.ts:14`）；建议用它替代散落的步骤级免责句。
**P2-14** 术语密度：306 个英文 token / 111 种 / 4136 个汉字（约每 13.5 个汉字一个英文词），且 46% 的节点是英文——对中文学习者阅读成本高。

---

## 三、3 个主题的完整改写示范（可直接落库）

> 字段建议：`VisualLesson` 增加
> `objective: string; prerequisites: string[]; takeaway: string; quiz: QuizQuestion[]; templateIds: string[]`
> 下列文案按"看到 → 原因 → 所以"撰写，长度 45–90 字/步，术语首次出现处给行内定义，免责话术收进末尾「本主题边界」1 条。

### 示范 1 · B01「Hudi 与 Hive 普通 Parquet 表的区别」（`lessons.ts:10`）

**学习目标**
1. 说清 Hudi 表比普通 Parquet 表多出来的 Timeline 是什么、解决什么问题。
2. 用"文件版本 + Timeline"解释一次更新为什么不需要重写整张表。
3. 分清"HDFS 上存在的文件"与"当前表引用的文件"。

**前置知识**：知道 Parquet 是列式文件、一次写入不可原地改一行；知道 Hive 表的目录按分区组织。

**步骤旁白（4 步）**
1. 「同一份数据」——**看到**：左边 Hive 表只有一个 `part-0000.parquet`；右边 Hudi 表除了 parquet 还多一个 `.hoodie/` 目录。**原因**：Hudi 把"数据文件"和"这次写入算哪一版"分开存，版本记录就放在 `.hoodie` 的 **Timeline（按 instant 排序的提交记录）** 里。**所以**：Hudi 表 = 数据文件 + 一条版本账本。
   （行内定义：Timeline＝按时间排序的提交记录；instant＝一次带时间戳的原子提交。）
2. 「写入更新」——**看到**：更新记录进入 Hudi Writer。**原因**：Parquet 不能原地改一行，Hive 的做法只能是重写整个分区或整张表；Hudi 改成"写一份新的文件版本"。**所以**：更新不会修改旧文件，只会产生新文件 + 一条新 instant。
3. 「生成新版本」——**看到**：只有被更新记录所在的 **File Group（同一 File ID 下共享一组文件版本，是 Hudi 的最小重写单位）** 变灰、其他 File Group 不动。**原因**：重写范围由 File Group 而不是整表决定。**所以**：这就是 Hudi 写放大比"整表覆盖"小的原因。
4. 「提交快照」——**看到**：Timeline 上新增一个 COMPLETED 的 instant，它指向"新的文件清单"。**原因**：**Snapshot（快照）** 读的就是"最新 instant + 它引用的文件清单"这个组合。**所以**：旧文件还在 HDFS 上，但已经不属于当前快照；要等 Clean 才物理删除——"磁盘上的文件"≠"当前看到的数据"。

**一句话结论**：Hudi 用"不可变的数据文件 + 一条按 instant 排序的 Timeline"表达更新：写新版本、记新 instant，查询按 instant 取一整份一致的视图。

**自检（2 题）**
1. 单选：一次 upsert 之后，被更新记录以外的 File Group 的 parquet 文件发生了什么？A. 被重写；B. 内容不变、仍被当前快照引用；C. 被删除；D. 被移动到 .hoodie。
   答案 B。解析：重写单位是 File Group；其他 File Group 不参与本次写入，仍被当前 instant 引用。
2. 多选：以下哪些说法正确？A. HDFS 上有旧 parquet ≠ 当前快照能查到它；B. Timeline 记录的是文件版本而不是业务数据；C. 更新会原地修改 parquet 中的一行；D. Clean 之前旧文件仍占空间。
   答案 A、B、D。解析：parquet 不能原地改一行（C 错）；旧文件在 Clean 前物理存在但不再被引用。

**本主题边界（1 条）**：HDFS 上的实际目录/文件命名以 r26 现场为准（社区 0.15 语义，E1）。

---

### 示范 2 · I03「BUCKET 索引与哈希分桶」（`lessons.ts:36`）

**学习目标**
1. 说清 BUCKET 索引如何用"主键哈希 → 桶号 → File Group"把 upsert 的定位范围缩到一个桶。
2. 解释桶数为什么在建表时就要定对（改桶数不是扩容，是重映射）。
3. 分清"分区内索引"与"全局索引"的作用域差异。

**前置知识**：B06（Record Key / HoodieKey = 主键 + 分区路径）、B04（File Group / File Slice）、I01（SIMPLE 索引需要按主键在候选文件里查找）。

**步骤旁白（4 步）**
1. 「读取主键」——**看到**：表配置里 `hoodie.index.type=bucket`、`hoodie.bucket.index.num.buckets=4`，分区 `dt=2024-01-01`。**原因**：哈希索引不需要先找"旧记录在哪"，它直接由主键算出位置。**所以**：定位成本从"扫候选文件"变成"算一次哈希"。
2. 「计算桶号」——**看到**：`bucketNo = hash(recordKey) % 4`，1001 → 1 号桶。**原因**：分区先限定范围，桶号再在分区内选 File Group；两者合起来才是完整定位（HoodieKey = 主键 + 分区路径）。**所以**：同一个主键在任何时刻都算出同一个桶——这是更新能找到旧版本的前提。
3. 「写入目标桶」——**看到**：记录只落到 1 号桶对应的 File Group，其余 3 个桶的文件不动。**原因**：BUCKET 索引保证"一个桶 = 一个 File Group"（community 0.15 语义）。**所以**：upsert 的写放大从"整个分区"降到"一个桶"。
4. 「检查桶内记录」——**看到**：把桶数从 4 改成 6 后全部记录重新分配。**原因**：`hash % n` 的桶号依赖 n，n 变了所有主键的桶号都会变。**所以**：桶数不是运行时能随意调整的参数，建表时要按数据量和写入并行度一次定对；这也是"改桶数后为什么会出现重复记录"的根因。

**一句话结论**：BUCKET 索引 = 用 `hash(主键) % 桶数` 把一条记录固定到一个桶、一个桶固定到一个 File Group，从而把 upsert 的定位和重写范围都限制在单个桶内。

**自检（2 题）**
1. 单选：把 BUCKET 表的桶数从 4 改成 6，最直接的后果是？A. 只影响新写入；B. 所有主键的桶号重新映射，旧文件里的记录位置与新桶号不一致；C. 自动触发 Compaction；D. 不影响任何东西。
   答案 B。解析：桶号由 `hash % n` 决定，n 变化会导致全部映射变化；已有文件不会自动重排，因此可能产生重复/定位失败。
2. 多选：关于 BUCKET 索引，正确的是？A. 一个桶对应一个 File Group；B. 它能减少 upsert 的重写范围；C. 它的作用域默认跨分区（全局）；D. 同一主键跨分区写入时，分区级 BUCKET 索引定位不到另一个分区的记录。
   答案 A、B、D。解析：BUCKET 默认分区内生效（C 错）；跨分区同主键正是 E02/I06 里重复数据的来源。

**本主题边界（1 条 + tooltip）**：桶号计算用教学哈希（djb2）；r26 实际哈希算法与 File Group 分配规则未确认 ⓘ。

---

### 示范 3 · S04「Compaction 执行与文件合并」（`lessons.ts:53`）

**学习目标**
1. 说清 Compaction 到底合并了什么（base + log → 新 base），以及它不合并什么。
2. 解释"compaction 成功"与"空间释放"为什么是两件事。
3. 能从 Timeline 的 instant 状态判断一次 compaction 是否真正提交。

**前置知识**：B03（MOR 写入产生 Log File）、B04（File Slice = Base File + 若干 Log File）、S03（Compaction Plan 只生成计划、不改文件）。

**步骤旁白（4 步）**
1. 「准备计划」——**看到**：上一步生成的 plan 里记录 `{partition, fileId, 待合并 log 数}`，数据文件没有任何变化。**原因**：Plan 只回答"哪些 File Group 需要合并"，执行是独立的一步（华为规范要求生成与执行分两个作业）。**所以**：只看到 REQUESTED 的 plan、没看到新 parquet，是正常的中间状态。
2. 「读取 Base 与 Log」——**看到**：该 File Slice 的 base 与全部 log 一起读入合并过程。**原因**：MOR 的更新只存在于 log，必须把 base 与 log 按 HoodieKey 归并、按 precombine 取最新、丢弃 operation=D 的记录，才能得到一份完整的新版本。**所以**：Compaction 是"重放 + 归并"，不是把 log 文件拼接起来。
3. 「生成新 Base」——**看到**：产生新的 parquet base 文件（同一 File ID），形成新的 File Slice；Timeline 上的 compaction instant 变为 COMPLETED。**原因**：新 base 一旦提交，快照读就能只读 base 拿到最新数据，读放大随之下降。**所以**：判断合并是否成功要看 **Timeline 的 instant 是否为 COMPLETED**，而不是看 YARN/Spark 是否 SUCCEEDED（上层成功但 Hudi 事务未提交是真实故障，见 E05）。
4. 「旧文件仍在」——**看到**：旧 base 与 log 变为 SUPERSEDED，但仍出现在 HDFS 文件列表里。**原因**：Compaction 只改"Timeline 引用哪些文件"，物理删除由 Clean 负责。**所以**：合并成功不会立刻释放空间——"表变小了"要等 Clean 的保留窗口过去。

**一句话结论**：Compaction = 把"base + log"重放归并成一份新 base 并用新 instant 提交；它解决"读变慢"，Clean 才解决"占空间"。

**自检（2 题）**
1. 单选：Compaction 之后旧 base 文件的状态是？A. 立刻被删除；B. 变为 SUPERSEDED，等待 Clean；C. 被改名继续被引用；D. 内容被原地更新。
   答案 B。解析：Compaction 只改 Timeline 引用，物理删除是 Clean 的职责。
2. 多选：如何确认一次 Compaction 真的成功？A. YARN 应用状态 SUCCEEDED；B. Timeline 上 compaction instant 为 COMPLETED；C. 当前 File Slice 引用了新的 base 文件；D. 旧 log 文件已从 HDFS 消失。
   答案 B、C。解析：A 不足以判断（E05 场景）；D 是 Clean 的结果，不是 compaction 的判据。

**本主题边界（1 条）**：Compaction 语法来自华为规范（E2）；异步作业入口类名以 r26 发行包为准。

---

## 四、如果只改 5 处内容

1. **给 80 个主题补上"三件套 + 自检"**：学习目标（1–3 条）、前置主题 id（1–3 个）、一句话结论、2 道自检题。复用已有 `ExperimentDefinition` 字段 + `ExperimentShell.vue:180-198` + `QuizPanel.vue`，只需给 `VisualLesson` 加字段并在 `LessonView` 渲染；数据可先用 catalog 的 `summary/note` 生成初稿。**这是把"看动画"变成"学习"的唯一结构性改动。**
2. **术语首次出现处行内定义 + 一页术语表**：24 个核心术语统一中英写法（Instant/commit、Compaction/归并、File Group、Bucket、Record Key…），每个术语首次出现时给 ≤18 字定义，并补 `ReplaceCommit` / `File ID` 两个"目录承诺但正文没有"的词。
3. **重写 145 条"无因果短句"与 11 个零操作主题**：旁白统一"看到 → 原因 → 所以"三段式，长度 45–90 字；每个主题保证至少一次可观察的状态变化（文件/Timeline/指标数字）。
4. **把 summary 提到目录卡 + 按主题映射 SQL 模板**：卡片显示 1 行 summary + 1 行目标；`lesson.kind` 映射改为 `templateIds`，让 Archive→`RUN ARCHIVELOG`、Clustering→`CALL run_clustering`、TTL→`ttl_policy_save`、Rollback→`hoodie-cli rollback`、Hive Sync→`shell-hive-sync`、Bulk Insert→`spark-bulk-insert` 都能被看到。
5. **免责话术降噪**：步骤级"示意/模拟/未实现/待验证"收进 ⓘ tooltip，每主题正文最多 1 条边界说明（放最后一步之后）；保留可执行的具体信息（"未确认的是 X"），删掉零信息句（"本页不模拟…""未连接真实…"）。

---

## 附录：量化方法与原始数据

| 文件 | 内容 |
|---|---|
| `_analysis/parse-content.mjs` | 用 esbuild 编译 `lessons.ts` 与 9 个 `modules/*.ts` 后导入，输出 `02-data.json`（315 条步骤、术语、免责、重复、负荷） |
| `_analysis/stats2.mjs` | 因果句/指令句、最短旁白、operation 序列、节点中英混排、免责分布、前向引用 |
| `_analysis/stats3.mjs` | 标题/旁白相似度、步骤标题重复、节点列表完全相同的组、同义词组计数 |
| `_analysis/stats4.mjs` | 术语覆盖主题明细、模块统计、证据等级/supportState 分布 |
| `_analysis/verify-ui.mjs` | Playwright（msedge）核对 5173 实站：80 张卡片、卡片无 summary、B01/B04/I03/S04 无目标/前置/自检、B02 无测验 |
| `_analysis/02-data.json`、`02-stats2.json` | 全部原始统计结果 |
| `_analysis/shot-*.png` | catalog / B01 / B02 / S04 实站截图 |

**关键行号索引**：`lessons.ts` B01:10 / B04:11 / B05:12 / B06:13 / B07:14 / B08:15 / T01:16 / T05:20 / T06:21 / T08:23 / W03:26 / W04:27 / W06:29 / W07:30 / I03:36 / Q01:42 / Q02:43 / S02:51 / S03:52 / S04:53 / S07:56 / S08:57 / S09:58 / S10:59 / S11:60 / F05:66 / E01:70；`visual/types.ts:4-15`；`models/simulation.ts:87-114`；`router/index.ts:20-55`；`LessonView.vue:74,114,118,125,130`；`AnimatedCatalogView.vue:15`；`ExperimentShell.vue:180-198`；`ExperimentView.vue:31,919`；`basics/B02CowVsMor.ts:378-456,467-487`；`engine/templates/sparkSql.ts`、`shell.ts`。

> 本报告仅做只读审计，未修改 `src/` 下任何代码；所有写操作都限制在 `D:\code\hudi演示\_analysis\`。
