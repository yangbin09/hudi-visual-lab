# 05 · 内容层整改对照表（旁白三段式 + 术语定义 + 教学四字段 + 术语表）

> 范围：仅 `src/experiments/**`（`visual/types.ts`、`visual/lessons.ts`、`visual/lesson-content.ts`、`visual/glossary.ts`、`catalog.ts`、`modules/*.ts`）。未修改 `src/views`、`src/components`、`src/styles`、`src/app`。
> 校验脚本：`_analysis/verify-content.mjs`（字段完整性 / 术语长度 / 代表主题旁白字数 / 免责话术残留 / 模板 id 有效性）。

## 一、总览数字

| 指标 | 整改前 | 整改后 |
|---|---|---|
| 有 objective 的动画主题 | 0 / 78 | **78 / 78** |
| 有 takeaway 的动画主题 | 0 / 78 | **78 / 78** |
| 有前后置说明（prerequisites）的主题 | 0 / 78 | **78 / 78** |
| 主题级术语卡总数 | 0 | **162**（平均 2.08 个/主题，上限 4） |
| 主题级边界说明（limitations）总数 | 0（散落在 57 条旁白里） | **78**（每主题 1 条，正文免责话术 0 处） |
| 主题→模板映射（templateIds）总数 | 0（按场景固定 12 个） | **191**（引用 42 个真实模板，全量 44 个） |
| 步骤旁白汉字总数 | 4136 | **10074**（+144%） |
| 平均汉字/步 | 13.1 | **32.0** |
| 代表主题旁白（8 主题 / 35 步） | 5–26 字/步 | **45–75 字/步（全部落在 45–90 字）** |
| 术语表 | 无 | **30 个词**（term/en/def/firstTopic/aliases，def 均 ≤40 字） |
| 目录条目 difficulty / minutes / aliases | 0 / 0 / 0 | **80 / 80 / 80 条** |
| 单测 | 324 通过 | **324 通过（断言未改）** |

## 二、修改文件与职责

| 文件 | 改动 |
|---|---|
| `src/experiments/visual/types.ts` | `VisualLesson` 增加 6 个**可选**字段：`objective / prerequisites / takeaway / glossary[{term,def}] / limitations / templateIds`（缺失可降级） |
| `src/experiments/catalog.ts` | `CatalogEntry` 增加 `difficulty(L1/L2/L3) / minutes / aliases` |
| `src/experiments/modules/*.ts`（9 个） | 80 条目录条目逐条补 difficulty / minutes / aliases |
| `src/experiments/visual/lesson-content.ts`（新增） | 78 主题的 `LESSON_META`（目标/前置/结论/术语卡/边界/模板）+ `CAPTION_OVERRIDES`（49 个主题的旁白覆盖） |
| `src/experiments/visual/glossary.ts`（新增） | 全站术语表 `GLOSSARY`（30 词）+ `glossaryOf` / `glossaryByTopic` |
| `src/experiments/visual/lessons.ts` | 合并 `LESSON_META` 与 `CAPTION_OVERRIDES`；`make(...)` 场景骨架保持不动 |

## 三、80 个主题逐条对照表

> 「旁白」列 = 本主题全部步骤旁白的中文汉字总数 / 平均每步；括号内为整改前平均每步。B02/B03 走双画布实验页面，无 `VisualLesson`，其目标与测验由 `ExperimentDefinition` 提供（已有 learningObjectives 5 条 / quiz 5 题）。

| id | 标题 | 难度 | 分钟 | objective（截断） | takeaway（截断） | 术语卡 | 边界 | 模板 | 旁白字/步（前） |
|---|---|---|---|---|---|---|---|---|---|
| B01 | Hudi 与 Hive 普通 Parquet 表的区别 | L1 | 4 | 说清 Hudi 表比普通 Parquet 表多出来的 Timeli… | Hudi = 不可变的 Parquet 数据文件 + 按 instant 排序… | 4 | 1 | 3 | 244 / 61（10.8） |
| B02 | COW 表的数据写入与文件重写 | L1 | 4 | （B02/B03 由 ExperimentDefinition.l… | （B02/B03 由 ExperimentDefinition.learnin… | 0 | 0 | 0 | - |
| B03 | MOR 表的数据写入与 Log 合并 | L1 | 4 | （B02/B03 由 ExperimentDefinition.l… | （B02/B03 由 ExperimentDefinition.learnin… | 0 | 0 | 0 | - |
| B04 | File Group、File ID、File Slice 结构 | L1 | 7 | 能画出 File Group / File Slice / Bas… | File Group 是重写单位，File Slice 是某一时刻的文件引用组… | 4 | 1 | 3 | 284 / 56.8（10） |
| B05 | Base File 与 Log File 的版本关系 | L1 | 7 | 解释同一个 File Group 里 Base 与多个 Log 的… | 每次写入追加一个 Log 并留下 instant；Compaction 把 B… | 4 | 1 | 3 | 295 / 59（10.8） |
| B06 | Record Key、Partition Path、HoodieKey | L1 | 4 | 说清 Record Key、Partition Path 与 Ho… | HoodieKey = Record Key + Partition Path… | 3 | 1 | 2 | 156 / 39（17.8） |
| B07 | Hudi 的 MVCC 与 Snapshot 可见性 | L1 | 4 | 用两个 instant 的 Checkpoint 讲清快照读为什么… | 快照读 = 最新 instant + 它引用的文件清单；历史读取靠保留的 Ch… | 3 | 1 | 2 | 144 / 36（9.3） |
| B08 | Hudi 表在 HDFS 中的完整目录结构 | L1 | 4 | 逐层展开表根目录与 .hoodie，说清数据文件与元数据文件的分工 | 数据文件在分区目录、元数据在 .hoodie；排查"文件还在不在"要同时看两处 | 2 | 1 | 3 | 194 / 48.5（15） |
| T01 | 华为 Spark SQL 创建 COW / MOR 表 | L1 | 4 | 用 Spark SQL 建出 COW / MOR 表，并说清表类型… | 建表就是把 type / primaryKey / precombine / … | 3 | 1 | 3 | 210 / 52.5（13.8） |
| T02 | Hudi 主键与 Precombine 配置 | L1 | 4 | 分清 Precombine 与主键的职责：前者决定版本顺序，后者决… | 同主键多版本由 Precombine 值大者胜出；Precombine 选错会… | 2 | 1 | 2 | 184 / 46（14） |
| T03 | Hudi 单分区与多级分区 | L1 | 4 | 说清分区路径如何由字段值拼出，以及单层与多级分区的目录差异 | 分区路径 = 分区字段值按层级拼接；分区越细，文件数与元数据压力越大 | 1 | 1 | 2 | 177 / 44.3（16.3） |
| T04 | 默认分区、Null 分区与异常分区值 | L1 | 4 | 复现空分区值落默认分区，并解释它如何造成跨分区重复数据 | 空分区值会落到默认/非法分区；同主键因此在不同分区形成两条定位，产生重复 | 2 | 1 | 3 | 190 / 47.5（16.3） |
| T05 | Hive Style Partitioning | L1 | 4 | 对比三种 Hive Style Partitioning 配置下分… | 三种配置的差别在"目录是否带 dt= 前缀"和"分区列是否还写进数据文件"；读… | 1 | 1 | 2 | 225 / 56.3（15.3） |
| T06 | Hive Metastore 同步与分区元数据 | L1 | 4 | 说清 HDFS 数据与 HMS 元数据的分工，以及同步后下游才能发… | 写成功 ≠ 下游能查到；HMS 同步补的是表结构、分区与存储位置这份元数据 | 2 | 1 | 2 | 178 / 44.5（10.8） |
| T07 | Hudi 表配置与 .hoodie/hoodie.properties | L1 | 4 | 读懂 hoodie.properties 里的表级配置，并区分哪些… | 表配置落盘在 .hoodie/hoodie.properties，每次写入都读… | 3 | 1 | 2 | 173 / 43.3（11.8） |
| T08 | 建表、写入与 Schema 演进限制 | L1 | 4 | 说清新增列、删列、改类型三类 Schema 演进的兼容性边界 | 新增可空列通常兼容；删列/改类型会破坏历史文件读取，必须拦在写入提交前 | 2 | 1 | 2 | 173 / 43.3（13.3） |
| W01 | Insert 写入全过程 | L1 | 4 | 跟踪一次 INSERT 从落文件到提交 commit instan… | INSERT 不查重，只把新记录写进目标分区的一个 File Group，并留… | 2 | 1 | 2 | 150 / 37.5（10.3） |
| W02 | Upsert 更新全过程 | L1 | 4 | 说清 Upsert 先按主键定位 File Group，再按表类型… | Upsert = 定位 + 合并：COW 重写整个 File Group，MO… | 3 | 1 | 3 | 41 / 10.3（10.3） |
| W03 | Delete 删除全过程 | L1 | 4 | 说清 Hudi 的删除是写 tombstone，而不是把行从文件里… | 删除写 operation=D 的 tombstone：逻辑上立刻不可见，物理… | 3 | 1 | 3 | 55 / 13.8（13.8） |
| W04 | Bulk Insert 数据初始化 | L1 | 4 | 说清 Bulk Insert 为什么跳过索引、适合空表初始化 | Bulk Insert 跳过查重与合并、直接生成 Base；MOR 表"一写即… | 2 | 1 | 2 | 158 / 39.5（12.8） |
| W05 | Insert Overwrite 分区覆盖 | L1 | 4 | 演示只覆盖单个分区时的文件与 Timeline 变化，说清 rep… | 分区覆盖只作废目标分区的 File Group，产生 replacecommi… | 2 | 1 | 2 | 48 / 12（12） |
| W06 | Insert Overwrite Table 整表覆盖 | L1 | 4 | 对比整表覆盖与分区覆盖的代价与恢复难度 | 整表覆盖作废所有分区的 File Group，恢复难度与代价都远高于分区覆盖 | 2 | 1 | 2 | 43 / 10.8（10.8） |
| W07 | DataFrame SaveMode 四种模式 | L1 | 4 | 分清 Spark SaveMode 与 Hudi operatio… | SaveMode 管"能不能写"，operation 管"怎么写"；两层叠加才… | 1 | 1 | 3 | 162 / 40.5（10.8） |
| W08 | Precombine 与相同主键冲突处理 | L1 | 4 | 用同主键多版本数据解释 Precombine 如何决定胜出者 | Precombine 值大者胜、相等时后写入者胜；乱序旧消息因此不会覆盖新数据 | 2 | 1 | 2 | 54 / 13.5（13.5） |
| W09 | Spark SQL 与 DataFrame 写入差异 | L1 | 4 | 对比 Spark SQL 与 DataFrame 两条写入路径的差… | 两条入口最终汇入同一个 Writer；差异只在默认值与参数名，参数相同则文件结… | 1 | 1 | 2 | 176 / 44（15.3） |
| W10 | 重复写入、错误配置与幂等性分析 | L1 | 4 | 解释重跑为什么不一定幂等，以及幂等性由哪三件事共同决定 | 逻辑幂等 ≠ 无写入成本；幂等性取决于 operation、索引与并发控制三者… | 2 | 1 | 2 | 53 / 13.3（13.3） |
| I01 | SIMPLE 索引定位原理 | L2 | 5 | 说清 SIMPLE 索引靠内存 HashMap 定位旧记录、读取时… | SIMPLE 只在写入时按主键匹配位置，读取时不参与裁剪，因此适合写后读全量的… | 2 | 1 | 2 | 175 / 43.8（17） |
| I02 | BLOOM 索引定位原理 | L2 | 5 | 说清 Bloom Filter 的文件级概率剪枝：可能误判但不会漏判 | Bloom 被判"不包含"的文件可直接跳过；判"可能包含"的文件仍需精确确认 | 1 | 1 | 3 | 146 / 36.5（14.3） |
| I03 | BUCKET 索引与哈希分桶 | L2 | 5 | 说清 BUCKET 索引如何用主键哈希把 upsert 的定位与重… | BUCKET = hash(主键) % 桶数 → 桶 → File Group… | 3 | 1 | 3 | 221 / 55.3（13.5） |
| I04 | BUCKET 索引与分区路径 | L2 | 5 | 说清 BUCKET 索引的作用域是分区内，跨分区同主键会失效 | 桶号只在分区内唯一；同主键跨分区写入时，分区级索引定位不到另一个分区的旧记录 | 2 | 1 | 2 | 49 / 12.3（12.3） |
| I05 | BUCKET 数量与 File Group 分配 | L2 | 5 | 说清桶数如何决定 File Group 数量，以及桶数过大/过小的… | 桶数 = 每个分区的 File Group 数；桶数太小易倾斜、太大则小文件与… | 2 | 1 | 2 | 153 / 38.3（16） |
| I06 | GLOBAL 索引与非 GLOBAL 索引 | L2 | 5 | 对比 GLOBAL 与分区级索引的作用域和代价 | GLOBAL 索引解决"同主键跨分区"，代价是索引构建与维护成本更高 | 2 | 1 | 3 | 77 / 19.3（19.3） |
| I07 | 索引类型与写入操作兼容性 | L2 | 5 | 把索引类型 × 写入 operation 展开成兼容性判断，解释不… | 不兼容组合应在写文件之前被拦截；BUCKET + bulk_insert 是本… | 2 | 1 | 2 | 46 / 11.5（11.5） |
| I08 | 索引异常诊断实验 | L2 | 5 | 按"看错误类型 → 判断哪一层拒绝 → 改配置还是改 operat… | 索引异常先看是配置不一致还是组合不兼容；错误来自兼容性规则时改配置比重跑更有效 | 2 | 1 | 3 | 163 / 40.8（14.3） |
| Q01 | Snapshot 快照查询 | L2 | 5 | 说清快照读为什么能同时看到 Base 与 Log 的最新记录 | Snapshot 读合并 Base 与全部 Log，所以 MOR 在 Comp… | 2 | 1 | 2 | 53 / 13.3（13.3） |
| Q02 | Read Optimized 读优化查询 | L2 | 5 | 说清 Read Optimized 只读 Base、看不到 Log… | Read Optimized 只读 Base：读得快，但在 Compactio… | 3 | 1 | 2 | 202 / 50.5（11.3） |
| Q03 | Incremental 增量查询 | L2 | 5 | 用 begin/end instant 圈出时间窗口，说清增量查询… | 增量查询返回窗口内的新增、更新与删除标记；消费端必须自己识别 D，否则会漏删 | 2 | 1 | 2 | 60 / 15（15） |
| Q04 | Time Travel 时间旅行 | L2 | 5 | 说清 Time Travel 依赖 Timeline 上仍保留的历… | 时间旅行按历史 instant 读取当时的文件清单；instant 被 Arc… | 3 | 1 | 2 | 162 / 40.5（9.8） |
| Q05 | COW / MOR 查询数据可见性对比 | L2 | 5 | 并排对比 COW 与 MOR 在 Snapshot / Read … | 同一份数据，Snapshot 与 Read Optimized 可能给出不同结… | 4 | 1 | 2 | 40 / 10（10） |
| Q06 | 分区过滤与文件扫描 | L2 | 5 | 说清分区裁剪是 Hudi 最有效的读优化手段，以及它为什么依赖分区… | 分区条件先排除整批文件；分区设计不与查询模式对齐时，裁剪会立刻失效 | 2 | 1 | 2 | 158 / 39.5（16） |
| Q07 | _hoodie_* 元数据字段 | L2 | 5 | 逐项解释 _hoodie_* 元字段的来源与用途 | _hoodie_* 把主键、分区、提交时间与操作类型带进查询结果，可直接用于增… | 3 | 1 | 2 | 53 / 13.3（13.3） |
| Q08 | CDC 与增量数据消费场景 | L2 | 5 | 把增量查询接到"上游变更 → 下游落库"的链路，说清删除语义必须由… | 增量结果里混有新增、更新与删除；消费端不处理 D 就会漏删，造成下游数据不一致 | 1 | 1 | 2 | 157 / 39.3（12） |
| S01 | Timeline 与 Instant 生命周期 | L3 | 7 | 说清 Timeline 上 REQUESTED / INFLIGH… | 只有 COMPLETED 的 instant 才进入可见版本；REQUESTE… | 3 | 1 | 3 | 238 / 47.6（14.2） |
| S02 | Commit 与 DeltaCommit | L3 | 6 | 区分 COW 的 commit 与 MOR 的 commit + … | COW 一次写入产生一个 commit；MOR 的增量写入产生 delta c… | 2 | 1 | 2 | 35 / 8.8（8.8） |
| S03 | Compaction Plan 生成 | L3 | 6 | 说清 Compaction Plan 只记录"哪些 File Gr… | 生成计划只写 REQUESTED 与 plan 文件；真正合并由执行阶段完成 | 2 | 1 | 3 | 37 / 9.3（9.3） |
| S04 | Compaction 执行与文件合并 | L3 | 6 | 说清 Compaction 合并了什么、以及它与 Clean 的职… | Compaction 把 Base+Log 重放归并成新 Base 并提交 i… | 4 | 1 | 3 | 200 / 50（11.8） |
| S05 | 异步 Compaction 调度 | L3 | 6 | 说清为什么实时写入链路只生成 Plan，合并交给独立 Spark … | 生成与执行分离：写入侧只写 plan，独立作业按计划执行，避免合并拖慢实时写入 | 1 | 1 | 3 | 151 / 37.8（13.3） |
| S06 | Clean 策略与文件物理删除 | L3 | 6 | 说清 Clean 才真正物理删除被取代的旧文件，以及保留窗口的取舍 | Clean 按保留窗口删旧文件：窗口越长成本越高、可回溯范围越大 | 2 | 1 | 2 | 59 / 14.8（14.8） |
| S07 | Archive Timeline 归档 | L3 | 6 | 说清 Archive 只搬元数据、不动数据文件，以及它与 Clea… | Archive 把旧 instant 移到归档区，只影响元数据；被归档的 in… | 2 | 1 | 2 | 47 / 11.8（11.8） |
| S08 | Rollback 回滚 | L3 | 6 | 说清 Rollback 只撤销未完成事务，不撤销已完成提交 | Rollback 针对未完成事务：删除该 instant 残留文件并写一条 R… | 2 | 1 | 3 | 53 / 13.3（13.3） |
| S09 | Restore 恢复 | L3 | 6 | 说清 Restore 与 Rollback 的区别：一个撤销未完成… | Restore 撤销已提交的历史、Rollback 撤销未完成事务；Resto… | 3 | 1 | 2 | 169 / 42.3（15.5） |
| S10 | Clustering 与 ReplaceCommit | L3 | 6 | 说清 Clustering 只改物理布局、不改变业务数据，以及它与… | Clustering 重排文件并产生 replacecommit：文件数下降、… | 2 | 1 | 2 | 48 / 12（12） |
| S11 | TTL 分区过期与清理 | L3 | 6 | 说清分区级 TTL 如何按 spec 匹配分区并让过期分区不再被引用 | TTL 按正则匹配分区、把超期分区移出有效引用；物理文件回收仍受 Cleane… | 2 | 1 | 4 | 52 / 13（13） |
| S12 | Pending Instant 与文件版本引用 | L3 | 6 | 说清"Timeline 引用的文件"与"HDFS 上真实存在的文件… | pending instant 会让引用与真实文件长期不一致；只有 Clean… | 3 | 1 | 3 | 42 / 10.5（10.5） |
| F01 | Spark SQL 创建与写入 Hudi | L3 | 6 | 把建表、写入、查询三段 Spark SQL 串成一条完整链路 | Spark SQL 链路 = CREATE TABLE（表配置落盘）→ INS… | 1 | 1 | 3 | 38 / 9.5（9.5） |
| F02 | Scala DataFrame Writer | L3 | 6 | 用 DataFrameWriter 完成一次带分区的写入，并说清它… | DataFrameWriter 与 SQL 最终汇入同一 Writer；差异在… | 1 | 1 | 2 | 147 / 36.8（10.3） |
| F03 | Flink SQL 实时写入 | L3 | 6 | 说清 Flink SQL 实时写入的落点（Log 追加）与 che… | Flink 侧写入 MOR 以 Log 追加为主，提交节奏由 checkpoi… | 3 | 1 | 3 | 140 / 35（9） |
| F04 | Flink Checkpoint 与 Hudi 提交 | L3 | 6 | 说清 Flink checkpoint 边界与 Hudi inst… | 两侧边界必须对齐；"Hudi 已提交但 checkpoint 未成功"会导致数… | 2 | 1 | 2 | 155 / 38.8（13.8） |
| F05 | Flink 写入与 Spark 异步 Compaction | L3 | 6 | 按华为规范拆出"Flink 只生成 Plan、Spark 独立执行… | Flink 侧 compaction.schedule.enabled=tru… | 1 | 1 | 3 | 48 / 12（12） |
| F06 | Flink 并行度与 Bucket 分配 | L3 | 6 | 说清 Flink 并行度与桶数不匹配时，多个 Writer 争抢同… | 桶是并行写入的分配单位；并行度高于桶数会让多个 Writer 争抢同一个桶，引… | 1 | 1 | 2 | 163 / 40.8（12.5） |
| F07 | Kerberos、HDFS、HMS 权限链路 | L3 | 6 | 梳理作业提交前必须打通的三段认证/授权链路 | 认证 → HDFS 目录权限 → HMS 库表权限是三道独立关口，断在哪一环决… | 1 | 1 | 3 | 69 / 17.3（17.3） |
| F08 | Hudi 表的 Spark / Flink 兼容性 | L3 | 6 | 对比 Spark 与 Flink 对同一张表的参数与语义差异 | 两个引擎共享表格式，但默认值与参数名不同；跨引擎读写前必须逐项对齐关键配置 | 1 | 1 | 3 | 190 / 47.5（16.3） |
| E01 | BUCKET 索引写入时报 SIMPLE 错误 | L3 | 6 | 用"表定义 vs 作业选项"的差异定位索引行为与预期不一致的问题 | 索引行为由"表定义 + 作业选项"共同决定；先对齐两份配置，再判断是不是根因 | 1 | 1 | 2 | 211 / 52.8（20） |
| E02 | 默认分区写入与跨分区异常 | L3 | 6 | 复现默认分区 + 跨分区写入共同造成的重复数据，并给出排查顺序 | 同主键跨分区时索引定位不到旧记录；排查先看分区路径，再看主键，最后看索引类型 | 2 | 1 | 3 | 52 / 13（13） |
| E03 | BUCKET 表 Bulk Insert 失败 | L3 | 6 | 复现 BUCKET 表执行 bulk_insert 被拦截，并说清… | BUCKET 表不能直接用 bulk_insert 初始化；先建表、用 Ups… | 1 | 1 | 2 | 143 / 35.8（12） |
| E04 | Hudi 无 Schema 或元数据不完整 | L3 | 6 | 构造缺主键/缺分区字段/配置不一致的表，说清写入为什么必须被拒绝 | 元数据不自洽时写入必须停在提交之前；失败不产生文件、不产生成功 instant | 1 | 1 | 2 | 59 / 14.8（14.8） |
| E05 | Compaction 失败但 YARN 显示成功 | L3 | 6 | 解释"调度平台显示成功但 Hudi 事务未提交"的故障与判断依据 | 判断依据是 Timeline 上 instant 是否 COMPLETED，而… | 2 | 1 | 3 | 144 / 36（10） |
| E06 | Compaction Requested / Inflight 残留 | L3 | 6 | 说清 Requested / Inflight 残留如何阻塞后续 … | 残留 plan 与 INFLIGHT 会让后续合并无法推进；先确认 pendi… | 2 | 1 | 3 | 47 / 11.8（11.8） |
| E07 | Rollback Requested 文件大量残留 | L3 | 6 | 统计回滚前后 HDFS 上仍存在的物理文件，说清"Timeline… | Rollback 撤销事务、不负责清理所有历史旧文件；残留文件要靠 Clean… | 2 | 1 | 2 | 52 / 13（13） |
| E08 | Cleaner / Archive 被异常状态阻塞 | L3 | 6 | 说清 pending instant 如何让 Cleaner 与 … | 表服务会跳过被 pending 阻塞的清理与归档；先清 pending，再评估… | 2 | 1 | 3 | 134 / 33.5（16.3） |
| E09 | Flink 写入积压与 Compaction 资源冲突 | L3 | 6 | 说清实时写入与 Compaction 争用同一资源池时，积压与延迟… | 合并与写入同池会互相拖慢；把合并拆到独立队列/资源池是解耦的前提 | 1 | 1 | 2 | 152 / 38（13.5） |
| E10 | Kerberos、HMS、HDFS 权限故障 | L3 | 6 | 按认证 → HDFS 目录权限 → HMS 库表权限三段定位权限类… | 三段是独立检查：认证成功不代表有目录/表权限；定位就是找"最后通过的那一步" | 1 | 1 | 3 | 162 / 40.5（15.5） |
| A01 | Hudi 文件大小与小文件问题 | L3 | 6 | 说清小文件如何产生、如何拖慢查询，以及 Clustering 的治… | 小文件来自多次小批量写入；治理靠 Clustering 重排布局，收益看文件数… | 2 | 1 | 3 | 162 / 40.5（12） |
| A02 | Bucket 数据倾斜 | L3 | 6 | 说清哈希分桶下的数据倾斜现象，以及它与文件大小、Compactio… | 倾斜由键的哈希分布决定；热点桶的写入与合并负载会形成长尾任务 | 2 | 1 | 3 | 161 / 40.3（15.5） |
| A03 | Metadata Table | L3 | 6 | 说清 Metadata Table 用元数据索引替代 HDFS 列… | Metadata Table 把文件清单物化成表；文件越多收益越大，小表上收益… | 1 | 1 | 2 | 170 / 42.5（15.5） |
| A04 | 并发控制、锁与多 Writer | L3 | 6 | 说清并发写者如何冲突、OCC 如何检测，以及为什么必须收敛到同一 … | 两个写者基于同一旧版本提交会冲突；后提交方被要求重试，重试必须能安全重放 | 2 | 1 | 2 | 169 / 42.3（16.5） |
| A05 | Compaction 策略与吞吐量分析 | L3 | 6 | 说清"攒多久合一次"在延迟与吞吐之间的取舍 | 合并越频繁读越快但写越慢；阈值（如 delta_commits）决定两者的平衡点 | 2 | 1 | 2 | 151 / 37.8（13） |
| A06 | Cleaner 保留策略与存储成本 | L3 | 6 | 说清保留窗口如何同时决定存储成本与可回溯范围 | 保留窗口越长成本越高、可回溯范围越大；参数组合要按业务恢复需求定 | 2 | 1 | 2 | 54 / 13.5（13.5） |
| A07 | Timeline 规模与归档性能 | L3 | 6 | 说清 Timeline 为什么膨胀、Archive 如何控制它，以… | Archive 控制活跃 Timeline 规模，只搬元数据；归档过频也会带来… | 2 | 1 | 2 | 135 / 33.8（12.5） |
| A08 | Hudi 表健康检查与维护决策 | L3 | 6 | 把前面能力串成一张体检清单，并给出维护动作的优先级 | 体检顺序：pending → Log 堆积 → 文件数/小文件 → Timel… | 3 | 1 | 4 | 153 / 38.3（12.8） |

## 四、8 个代表主题的旁白改造（前后字数对照）

| 主题 | 整改前（字/步） | 整改后（字/步） | 覆盖步骤数 |
|---|---|---|---|
| B01 | 10.8 | 61.0 | 4 |
| B04 | 10.0 | 56.8 | 5 |
| B05 | 10.8 | 59.0 | 5 |
| I03 | 13.5 | 55.3 | 4 |
| Q02 | 11.3 | 50.5 | 4 |
| S01 | 14.2 | 47.6 | 5 |
| S04 | 11.8 | 50.0 | 4 |
| E01 | 20.0 | 52.8 | 4 |

**旁白覆盖到的主题（49 个）**：B01、B04、B05、B06、B07、B08、T01、T02、T03、T04、T05、T06、T07、T08、W01、W04、W07、W09、I01、I02、I03、I05、I08、Q02、Q04、Q06、Q08、S01、S04、S05、S09、F02、F03、F04、F06、F08、E01、E03、E05、E08、E09、E10、A01、A02、A03、A04、A05、A07、A08

代表主题示例（B04 第 4 步，整改前「先生成计划。」5 字 → 整改后）：

> 看到先生成 Compaction Plan，里面记录待合并的 partition、File ID 与 Log 数，数据文件不动；因为“决定合并哪些文件组”和“真正合并”是两个阶段，所以计划阶段只增加 REQUESTED，不会出现新 Base。

## 五、术语首现行内定义（前 12 个主题）

| 术语 | 首次出现主题 | 首次出现步骤的覆盖情况 |
|---|---|---|
| File Group | B04 | 已在该主题旁白出现并给出行内定义/解释 |
| File Slice | B04 | 已在该主题旁白出现并给出行内定义/解释 |
| Base File | B04 | 已在该主题旁白出现并给出行内定义/解释 |
| Log File | B04 | 已在该主题旁白出现并给出行内定义/解释 |
| File ID | B04 | 已在该主题旁白出现并给出行内定义/解释 |
| Instant | B05 | 已在该主题旁白出现并给出行内定义/解释 |
| Timeline | B01 | 已在该主题旁白出现并给出行内定义/解释 |
| Checkpoint | B07 | 已在该主题旁白出现并给出行内定义/解释 |
| Commit | B01 | 已在该主题旁白出现并给出行内定义/解释 |
| Compaction | B05 | 已在该主题旁白出现并给出行内定义/解释 |
| Precombine | T01 | 已在该主题旁白出现并给出行内定义/解释 |
| Record Key | B06 | 已在该主题旁白出现并给出行内定义/解释 |
| Partition Path | B06 | 已在该主题旁白出现并给出行内定义/解释 |
| HoodieKey | B06 | 已在该主题旁白出现并给出行内定义/解释 |
| Snapshot Read | B01 | 已在该主题旁白出现并给出行内定义/解释 |
| Hive Metastore | T06 | 已在该主题旁白出现并给出行内定义/解释 |

## 六、模板映射（主题 → 真实模板 id）

> 全部 id 均来自 `src/engine/templates/{sparkSql,flinkSql,scala,shell}.ts` 实际导出，脚本校验 0 个无效 id。之前按场景固定注入导致 Archive/TTL/Rollback/Clustering/Bulk Insert/Hive Sync 主题看不到对应命令，现已逐主题映射。

| 主题 | templateIds |
|---|---|
| B01 | `spark-create-table-cow`、`spark-upsert`、`shell-hdfs-ls` |
| B04 | `spark-create-table-mor`、`spark-upsert`、`spark-compaction-plan-only` |
| B05 | `spark-compaction-plan-only`、`spark-compaction-inline`、`shell-hudi-cli-table-info` |
| B06 | `spark-create-table-cow`、`spark-upsert` |
| B07 | `spark-query-snapshot`、`spark-query-time-travel` |
| B08 | `shell-hdfs-ls`、`shell-hudi-cli-table-info`、`spark-create-table-cow` |
| T01 | `spark-create-table-cow`、`spark-create-table-mor`、`flink-create-table` |
| T02 | `spark-create-table-cow`、`spark-upsert` |
| T03 | `spark-create-table-cow`、`spark-show-partitions` |
| T04 | `spark-create-table-cow`、`spark-show-partitions`、`spark-insert` |
| T05 | `spark-create-table-cow`、`spark-create-table-mor` |
| T06 | `shell-hive-sync`、`spark-create-table-cow` |
| T07 | `spark-create-table-mor`、`shell-hudi-cli-table-info` |
| T08 | `spark-create-table-cow`、`spark-insert` |
| W01 | `spark-insert`、`spark-query-snapshot` |
| W02 | `spark-upsert`、`spark-create-table-cow`、`spark-create-table-mor` |
| W03 | `spark-delete`、`spark-query-snapshot`、`spark-query-incremental` |
| W04 | `spark-bulk-insert`、`scala-df-write-bulk-insert` |
| W05 | `spark-insert-overwrite-partition`、`spark-clean` |
| W06 | `spark-insert-overwrite-table`、`spark-clean` |
| W07 | `scala-df-write-upsert`、`spark-insert`、`spark-upsert` |
| W08 | `spark-create-table-cow`、`spark-upsert` |
| W09 | `spark-insert`、`scala-df-write-upsert` |
| W10 | `spark-upsert`、`spark-create-table-cow` |
| I01 | `spark-create-table-cow`、`spark-upsert` |
| I02 | `spark-create-table-cow`、`spark-upsert`、`scala-df-write-upsert` |
| I03 | `spark-create-table-cow`、`spark-upsert`、`flink-create-table` |
| I04 | `spark-create-table-cow`、`spark-upsert` |
| I05 | `spark-create-table-cow`、`spark-upsert` |
| I06 | `spark-create-table-cow`、`spark-upsert`、`spark-show-partitions` |
| I07 | `spark-bulk-insert`、`spark-upsert` |
| I08 | `spark-bulk-insert`、`spark-upsert`、`scala-df-write-upsert` |
| Q01 | `spark-query-snapshot`、`scala-df-read-snapshot` |
| Q02 | `spark-query-read-optimized`、`scala-df-read-optimized` |
| Q03 | `spark-query-incremental`、`scala-df-read-incremental` |
| Q04 | `spark-query-time-travel`、`scala-df-read-time-travel` |
| Q05 | `spark-query-snapshot`、`spark-query-read-optimized` |
| Q06 | `spark-query-snapshot`、`spark-show-partitions` |
| Q07 | `spark-query-snapshot`、`spark-query-incremental` |
| Q08 | `spark-query-incremental`、`spark-delete` |
| S01 | `scala-metaclient-list-instants`、`shell-hudi-cli-table-info`、`spark-compaction-plan-only` |
| S02 | `spark-compaction-plan-only`、`spark-query-snapshot` |
| S03 | `spark-compaction-plan-only`、`shell-hudi-cli-compaction`、`shell-spark-sql-compaction-plan` |
| S04 | `spark-compaction-inline`、`shell-spark-sql-compaction-plan`、`spark-clean` |
| S05 | `shell-spark-sql-compaction-plan`、`shell-spark-submit-compaction`、`spark-compaction-plan-only` |
| S06 | `spark-clean`、`spark-clean-automatic-3-1` |
| S07 | `spark-archive`、`shell-hudi-cli-table-info` |
| S08 | `scala-metaclient-rollback`、`shell-hudi-cli-rollback`、`spark-query-snapshot` |
| S09 | `spark-query-time-travel`、`scala-metaclient-list-instants` |
| S10 | `spark-clustering`、`spark-query-snapshot` |
| S11 | `spark-ttl-save`、`spark-ttl-show`、`spark-ttl-empty`、`spark-clean` |
| S12 | `scala-metaclient-list-instants`、`spark-compaction-plan-only`、`spark-query-snapshot` |
| F01 | `spark-create-table-cow`、`spark-insert`、`spark-query-snapshot` |
| F02 | `scala-df-write-upsert`、`scala-df-read-snapshot` |
| F03 | `flink-create-table`、`flink-insert`、`flink-compaction-config` |
| F04 | `flink-insert`、`flink-compaction-plan-only` |
| F05 | `flink-compaction-config`、`flink-compaction-plan-only`、`shell-spark-submit-compaction` |
| F06 | `flink-insert`、`flink-create-table` |
| F07 | `shell-kinit-kerberos`、`shell-hdfs-ls`、`shell-hive-sync` |
| F08 | `spark-create-table-mor`、`flink-create-table`、`spark-query-snapshot` |
| E01 | `spark-create-table-cow`、`spark-upsert` |
| E02 | `spark-create-table-cow`、`spark-insert`、`shell-hive-sync` |
| E03 | `spark-bulk-insert`、`spark-upsert` |
| E04 | `spark-create-table-cow`、`spark-insert` |
| E05 | `spark-compaction-plan-only`、`shell-spark-sql-compaction-plan`、`scala-metaclient-list-instants` |
| E06 | `spark-compaction-plan-only`、`scala-metaclient-rollback`、`spark-compaction-inline` |
| E07 | `scala-metaclient-rollback`、`shell-hudi-cli-rollback` |
| E08 | `spark-clean`、`spark-archive`、`scala-metaclient-rollback` |
| E09 | `flink-compaction-config`、`shell-spark-submit-compaction` |
| E10 | `shell-kinit-kerberos`、`shell-hdfs-ls`、`shell-hive-sync` |
| A01 | `spark-clustering`、`spark-query-snapshot`、`spark-insert` |
| A02 | `spark-create-table-cow`、`spark-upsert`、`spark-clustering` |
| A03 | `spark-query-snapshot`、`shell-hdfs-ls` |
| A04 | `spark-upsert`、`spark-create-table-cow` |
| A05 | `spark-compaction-plan-only`、`spark-compaction-inline` |
| A06 | `spark-clean`、`spark-clean-automatic-3-1` |
| A07 | `spark-archive`、`shell-hudi-cli-table-info` |
| A08 | `spark-clean`、`spark-compaction-plan-only`、`spark-archive`、`scala-metaclient-list-instants` |

## 七、验收与外部说明

- `npm test`：**324 通过 / 13 文件**（未修改或弱化任何断言）。
- `npm run typecheck`：**通过（0 错误）**。期间外部文件 `src/components/visual/LessonSummary.vue:36` 一度报 TS2352，已由 Lead 侧修复，本任务最后一次复跑确认全绿。
- 模板 id 有效性：191 个引用、0 个无效。
- `VisualLesson` 新增字段全部为**可选**：渲染层缺失时自动降级；78 个动画主题已全部填充，B02/B03 走双画布实验页（`ExperimentDefinition` 已有 5 条 learningObjectives 与 5 道 quiz；若也要一句话结论，需在 `models/simulation.ts` 给 `ExperimentDefinition` 增加 `takeaway` 字段，属 Lead/渲染范围）。
