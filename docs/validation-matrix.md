# 验证矩阵

> 本文件回答两个问题：
>   1. **每个能力目前是怎么验证的**（浏览器模拟 / 待 r26 实测）；
>   2. **还有哪些没验证**（待办清单）。
>
> ⚠️ 口径：本项目**全部为浏览器模拟**，
>    矩阵里的「模拟」指的是「在本仓库的 mini-Hudi 内核里跑通了对应语义」，
>    **不等于**在华为 MRS 3.1.0-350-r26 集群上跑通。

---

## 1. 能力 × 证据 × 验证方式

| 能力键 | 能力 | 证据等级 | 证据 id | 当前验证方式 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `spark-sql-create-table` | Spark SQL 建表 | E1 + E3 | `EV-COMM-CREATE-TABLE`、`EV-R26-ART-SPARK3` | 模拟（`CREATE_TABLE` 动作 + 建表模板） | supported |
| `spark-sql-write` | Spark SQL 写入（upsert / insert / overwrite） | E1 | `EV-COMM-CREATE-TABLE`、`EV-COMM-MOR` | 模拟（`performWrite`，含 COW / MOR / 覆盖 / 预组合） | supported |
| `dataframe-write` | DataFrame API 写入 | E3 | `EV-R26-ART-SPARK-CLIENT` | 模拟（Scala 模板） | supported |
| `flink-sql-write` | Flink SQL 写入 | E3 | `EV-R26-ART-FLINK17` | 模拟（Flink 模板 + MOR 追加 log 语义） | supported |
| `bulk-insert` | bulk_insert 语义 | E1 | `EV-COMM-BULK-INSERT` | 模拟（`BULK_INSERT` 走 `performWrite` 的独立分支） | supported |
| `index-simple` | SIMPLE 索引定位 | E1 | `EV-COMM-INDEX` | 模拟（`findFileGroupForKey` 的分区内存映射模型） | supported |
| `index-bloom` | BLOOM 索引定位 | E1 | `EV-COMM-INDEX` | 模拟（**仅建模**「按 record key 跳过无关文件」，不模拟 Bloom Filter 位图） | supported |
| `index-bucket` | BUCKET 索引分桶 | E1 | `EV-COMM-INDEX`、`EV-R26-ART-COMMON` | 模拟（**教学示意哈希 djb2 取模**，显式标注待确认） | **unverified** |
| `index-global` | GLOBAL 索引 | E1 | `EV-COMM-INDEX` | 模拟（`isGlobalIndex` 标记 + 跨分区定位分支） | **unverified** |
| `bucket-with-bulk-insert` | BUCKET + bulk_insert 组合限制 | E1 | `EV-COMM-BULK-INSERT` | 模拟（**按保守策略拦截**，抛 `SimulationError`） | **unverified** |
| `run-compaction-sql` | `RUN COMPACTION ON` | E2 | `EV-HW-RUN-COMPACTION` | 模拟（`scheduleCompaction` + `runCompaction` 两阶段） | supported |
| `spark-async-compaction` | 异步 compaction（只生成计划 + 独立作业执行） | E2 | `EV-HW-RUN-COMPACTION` | 模拟（plan 一次性资源 + stale plan 报错） | supported |
| `flink-plan-only-compaction` | Flink 侧只生成计划 | E2 | `EV-HW-RUN-COMPACTION` | 模拟（同一套 plan/execute 两阶段模型） | supported |
| `run-archivelog-sql` | `RUN ARCHIVELOG ON` | E2 | `EV-HW-RUN-COMPACTION` | 模拟（`runArchive` 归档旧 instant） | supported |
| `run-clean-sql` | `RUN CLEAN ON` | E2 | `EV-HW-RUN-COMPACTION` | 模拟（`runClean` 的 `commitsRetained` 保留窗口） | **conditional**（3.2.0+；3.1.x 需 `hoodie.clean.automatic=true`） |
| `metadata-table` | Metadata Table | E1 | `EV-COMM-METADATA-TABLE` | **未实现**（仅在能力档案里登记为 unverified） | **unverified** |
| `ttl-policy` | TTL 策略（PARTITION 级） | E2 | `EV-HW-TTL-POLICY` | 模拟（`applyTtl` 的正则匹配 + ReplaceCommit + 逻辑过期） | supported |
| `ttl-record-level` | TTL 策略（RECORD 级） | E2 | `EV-HW-TTL-POLICY` | 模拟（**明确拒绝**，抛 `SimulationError`） | **unsupported** |
| `kerberos-hdfs-hms` | Kerberos / HDFS / HMS 权限链路 | E0 | `EV-HW-KERBEROS` | **未实现**（仅模板与说明） | supported（前提未采集完整） |

---

## 2. 引擎行为的验证方式对照

| 行为 | 验证方式 | 测试位置 | 备注 |
| --- | --- | --- | --- |
| COW 写入 → 旧文件被取代、新文件产生 | 单元测试 | `tests/unit/writes.spec.ts` | 物理文件状态 `SUPERSEDED` |
| MOR 写入 → 只追加 log file | 单元测试 | `tests/unit/writes.spec.ts` | base file 保持不变 |
| precombine 值更小的更新被忽略 | 单元测试 | `tests/unit/writes.spec.ts` | 产生 warning，逻辑视图不变 |
| 同批次重复主键 → 取值大者胜 | 单元测试 | `tests/unit/writes.spec.ts` | 只落 1 条记录 |
| 跨分区同主键告警 | 单元测试 | `tests/unit/partition.spec.ts` | SIMPLE / BUCKET 两种措辞 |
| BUCKET + bulk_insert 被拒绝 | 单元测试 | `tests/unit/bucket.spec.ts` | 状态零变更 |
| Compaction 成功 → COMPLETED instant | 单元测试 | `tests/unit/timeline.spec.ts` | 计划两阶段 |
| Compaction 失败 → 无数据文件变化 + INFLIGHT | 单元测试 | `tests/unit/timeline.spec.ts` | 5 种失败场景 |
| Rollback 只对 pending 生效 | 单元测试 | `tests/unit/timeline.spec.ts` | 对 COMPLETED 抛错 |
| Clean 保留窗口 | 单元测试 | `tests/unit/clean.spec.ts` | 窗口内不删、窗口外删 |
| 失败动作零状态变更 | 单元测试 | `tests/unit/capabilities.spec.ts` | `nextState === 入参` |
| 快照读 vs 读优化读 | 单元测试 | `tests/unit/queries.spec.ts` | 读优化看不到 log 里的更新 |
| 增量读窗口过滤 | 单元测试 | `tests/unit/queries.spec.ts` | 必带 `_hoodie_operation` |
| 模板渲染无残留占位符 | 单元测试 | `tests/unit/templates.spec.ts` | 全语言全模板 |
| 模板证据 id 全部存在 | 单元测试 | `tests/unit/templates.spec.ts` | 不得引用不存在的 id |
| 目录 80 条 / 9 模块 / 无 E3E4 | 单元测试 | `tests/unit/catalog.spec.ts` | 过度声明护栏 |
| 页面交互（插入 / 切换 / 重置 / 隔离） | e2e | `tests/e2e/interaction.spec.ts` | Playwright |
| 「纯浏览器模拟」字样常驻 | e2e + 单元 | `tests/e2e/smoke.spec.ts` | 防误宣称护栏 |

---

## 3. 尚未完成的验证项清单

### 3.1 r26 集群实测待办（最高优先级）

| # | 待验证项 | 涉及能力 / 实验 | 建议验证方式 | 预期产出 |
| --- | --- | --- | --- | --- |
| 1 | `run clean on <db>.<table>` 在 MRS 3.1.0-350-r26 上是否存在 | `run-clean-sql`（conditional） | 在 r26 集群执行该存储过程 | 存储过程存在 → 升为 supported；不存在 → 维持 conditional 并把 `hoodie.clean.automatic=true` 写进正文 |
| 2 | MOR 表**首次普通写入**的文件落点（log-only File Group 还是 base file） | B02 / B03、MOR 全部实验 | 空表执行一次 upsert，`hdfs dfs -ls` 看分区目录 | 行为级证据，把场景规则 `MOR_INITIAL_INSERT` 的 `needsVerification` 置 false |
| 3 | MOR 表**新主键写入**（分区已有 File Group）的落点 | B03 / C 模块 | 同上，写入一个全新主键 | 行为级证据，收敛 `MOR_INSERT_NEW_KEY` 规则 |
| 4 | BUCKET 索引是否在 r26 启用、其分桶哈希算法与 File Group 分配规则 | `index-bucket`（unverified） | 建 BUCKET 索引表，写入若干主键，比对 `hoodie.bucket.index.num.buckets` 与落桶结果 | 替换教学示意算法（djb2），并把 `bucketHashVerified` 置 true |
| 5 | BUCKET 索引 + bulk_insert 的组合限制 | `bucket-with-bulk-insert`（unverified） | 在 BUCKET 表上执行 bulk_insert | 允许 → 去掉拦截；禁止 → 把原因写进约束表 |
| 6 | GLOBAL_SIMPLE / GLOBAL_BLOOM 在 r26 的支持与行为 | `index-global`（unverified） | 建 GLOBAL 索引表，跨分区写同一主键 | 行为级证据 |
| 7 | TTL 在 r26 上的实际触发时机与 ReplaceCommit 行为 | `ttl-policy` | 保存策略后观察 Timeline 是否出现 replacecommit | 行为级证据 |
| 8 | Metadata Table 的开关名、索引实现与限制 | `metadata-table`（unverified） | 开启 `hoodie.metadata.enable` 并查询元数据表 | 决定是否实现该实验 |
| 9 | Kerberos 链路的 keytab / principal / 目录权限具体配置项 | `kerberos-hdfs-hms`（E0） | 采集现场配置记录 | 把 `EV-HW-KERBEROS` 从 E0 升到 E2 |
| 10 | 真实文件名格式（`HoodieFileNameParser` 的分隔符 / baseInstant 位置 / log 尾部字段） | 目录树展示、文件命名 | 在 r26 上 `hdfs dfs -ls` 实际文件名并逐字段比对 | 校正 `src/engine/filesystem/layout.ts` 的命名函数，替换 `SIMPLIFIED_NOTE` |

### 3.2 模拟内核自身的待改进项

| # | 项 | 现状 | 影响 |
| --- | --- | --- | --- |
| A | COW **连续两次更新同一主键** | 第二次更新命中了已被取代的 File Group，导致：当前 base file 未被标记为 SUPERSEDED、新文件只含 1 条记录、同一张表出现两个「有效」File Group | 与 B02 边界场景 EC-02 的描述不一致。已在 `tests/unit/clean.spec.ts` 用 `it.fails` 钉住期望行为，待修 `findFileGroupForKey`（排除已 superseded 的 group） |
| B | `renderTree` 丢失分区目录名 | 分区目录 path 以 `/` 结尾，`split('/').pop()` 得到空串，目录行渲染成「`-- /」 | 目录树的「命令行视角」文本不可读；`FileTreeView` 的行名有同样问题。已在 `tests/unit/filesystem.spec.ts` 用 `it.fails` 钉住 |
| C | precombine「先落盘、后归并」的顺序 | 新版本 precombine 值更小时，文件层仍写入了新版本，逻辑层才忽略 | 文件内容与逻辑视图在那一刻不一致；与真实 Hudi「写入前比较」的顺序不同 |
| D | BUCKET 索引的分桶算法 | 教学示意 djb2，与 r26 实际实现不一定一致 | 已在界面用 `BUCKET_ALGORITHM_NOTE` 显式标注；待第 4 项实测后替换 |
| E | 文件大小估算 | 固定 `AVG_RECORD_BYTES = 96` 的教学估算 | 仅影响「合计大小」显示，不影响任何语义 |
| F | 时间旅行的精确性 | 有 checkpoint 时读快照；没有 checkpoint 时回退为「按 commitTime 过滤」的近似 | 界面已明确标注「近似值，不是真实快照」 |
| G | Bloom Filter 未真正建模 | 只表达「按 record key 跳过无关文件」的语义，不模拟位图 | 不影响教学目标（读优化的可见性差异） |
| H | 并发写（OCC）未建模 | 同一 File Group 的并发 upsert 冲突未模拟 | H 模块的并发实验尚未实现 |

### 3.3 覆盖度待补项

- [ ] C 模块（数据写入）其余 9 条目录条目：删除 / bulk_insert / insert_overwrite 的独立实验
- [ ] D 模块（BUCKET 索引教学实验）：需先补第 3.1 节第 4 项，才能给出可信结论
- [ ] E 模块（四种读法的对比实验）：查询引擎已就绪，缺页面实现
- [ ] F 模块：archive / rollback / clustering / TTL 的独立实验
- [ ] G 模块：Flink 只生成计划的端到端串联
- [ ] H 模块（故障实验室）：10 类故障场景的实验实现
- [ ] I 模块（高级专题）：小文件、倾斜、并发控制、Compaction 吞吐

---

## 4. 证据等级与「验证方式」的关系

| 证据等级 | 说明 | 能支撑什么 | 不能支撑什么 |
| --- | --- | --- | --- |
| E0 | 研究笔记 / 工程推演 | 只能作为「待确认」的提示 | 不能作为任何行为结论的依据 |
| E1 | Apache Hudi 0.15 社区文档 | 社区 0.15 的语法与语义 | **不能**代表华为 r26 的行为 |
| E2 | 华为官方文档 | 华为文档里写明的行为与前提 | 不能替代实测；文档按 3.1.2.5 / 3.2.0+ 分节时需注意目标版本 |
| E3 | r26 制品坐标 / 版本目录 | 「该组件在 r26 中存在」 | **不能**支撑行为级断言 |
| E4 | r26 集群实测 | 行为级结论 | 本项目当前**一条都没有**（`hasFieldVerifiedEvidence()` 恒为 false） |

> 「验证方式 = 模拟」与「证据等级 = E1/E2」是两件不同的事：
> 前者说明结论**在本项目里是怎么跑出来的**，后者说明结论**依据什么**。
> 二者都不等于「在 r26 上验证过」。
