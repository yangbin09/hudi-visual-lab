# r26 版本矩阵

> 目标版本：**华为 FusionInsight / MRS 3.1.0-350-r26 定制版 Apache Hudi 0.15.0**
>
> ⚠️ 本文件记录的是**已确认的版本事实**与**尚未确认的能力状态**。
> 凡是标 `unverified` 的能力，表示本项目**没有**在 r26 上实测过，
> 界面上必须同时显示「待验证」徽标 —— 不得表述为「已验证」。

---

## 1. 组件版本表

| 组件 | 版本 | 证据等级 | 依据 |
| --- | --- | --- | --- |
| 平台 | Huawei FusionInsight / MRS 3.1.0-350-r26 | — | 目标版本定义 |
| Apache Hudi | `0.15.0-h0.cbu.mrs.350.r26` | E3 | `EV-R26-ART-SPARK3` 等制品坐标（镜像站 HTTP 200） |
| Apache Spark | `3.3.1-h0.cbu.mrs.350.r26` | E3 | `EV-R26-ART-SPARK3`（`hudi-spark3.3.x_2.12` 坐标） |
| Apache Flink | `1.17.x` | E3 | `EV-R26-ART-FLINK17`（`hudi-flink1.17-bundle` 坐标） |
| Scala | `2.12` | E3 | 与 `hudi-spark3.3.x_2.12` 坐标一致 |
| 存储 | HDFS | E0 | 平台默认；本项目仅建模目录结构，不做真实 IO |
| 元数据 | Hive Metastore | E0 | `EV-HW-KERBEROS` 记录权限链路，具体配置项待补 |
| 认证 | Kerberos | E0 | `EV-HW-KERBEROS`（该条当前为 E0，keytab / principal 细节待补） |
| Python / Node | 不适用 | — | 本项目为纯前端静态资源 |

> 口径说明：Hudi 与 Spark / Flink 的版本是**制品坐标级**确认（E3），
> 即「这个坐标在华为镜像站上存在」；它们**不能**直接支撑任何行为级断言。

---

## 2. 已确认的制品坐标

以下坐标在华为云开源镜像站（`mirrors.huaweicloud.com`）上确认存在（HTTP 200），
统一对应版本 `0.15.0-h0.cbu.mrs.350.r26`：

| 制品坐标 | 用途 | 证据 id |
| --- | --- | --- |
| `org.apache.hudi:hudi-spark3.3.x_2.12` | Spark 3.3.x 集成包 | `EV-R26-ART-SPARK3` |
| `org.apache.hudi:hudi-spark3-bundle_2.12` | Spark 作业提交用的 shaded bundle | `EV-R26-ART-SPARK3BUNDLE` |
| `org.apache.hudi:hudi-spark-client` | Spark 侧客户端 | `EV-R26-ART-SPARK-CLIENT` |
| `org.apache.hudi:hudi-common` | 公共层（Timeline / MetaClient / payload） | `EV-R26-ART-COMMON` |
| `org.apache.hudi:hudi-flink1.17-bundle` | Flink 1.17 集成包 | `EV-R26-ART-FLINK17` |
| `org.apache.hudi:hudi-flink1.17.x` | Flink 1.17 坐标族 | `EV-R26-ART-FLINK17` |
| `org.apache.hudi:hudi-flink-client` | Flink 侧客户端 | `EV-R26-ART-FLINK17` |
| `org.apache.hudi:hudi-hive-sync-bundle` | Hudi → Hive Metastore 同步工具 | `EV-R26-ART-HIVESYNC` |
| `org.apache.hudi:hudi-examples-spark` | 示例工程 | `EV-R26-ART-SPARK3` |

### 2.1 负向证据：`hudi-spark-common` 在 r26 **不存在**

| 项 | 内容 |
| --- | --- |
| 坐标 | `org.apache.hudi:hudi-spark-common:0.15.0-h0.cbu.mrs.350.r26` |
| 期望 | 按需求文档 §2.1 的列举，该坐标应当存在 |
| 实际 | **HTTP 404** —— 该版本目录下没有制品；镜像站仅有 0.7.0 / 0.8.0 的 `hw-ei` 旧坐标 |
| 证据 id | `EV-R26-ART-SPARKCOMMON-ABSENT`（E3） |
| 结论 | 需求文档里的这个坐标在 r26 下**不可获取**；实际应以 `hudi-spark-client` / `hudi-spark3.3.x_2.12` 为准 |

> 这条负向证据的价值在于：**它防止照抄需求文档里的坐标清单**。
> `R26_ARTIFACTS` 里因此**没有** `hudi-spark-common` 这一项，
> 并且 `tests/unit/capabilities.spec.ts` 有一条断言守着这件事。

---

## 3. 能力状态表

状态口径：

| 状态 | 含义 | 界面表现 |
| --- | --- | --- |
| `supported` | 有行为级文档依据（社区 0.15 / 华为官方文档） | 正常标签 |
| `conditional` | 有依据，但存在版本或环境前提 | 显示前置条件 |
| `unverified` | **r26 未确认** —— 只有社区文档或工程推演 | 显示「待验证」+ 待确认问题 |
| `unsupported` | 明确不可用 | 显示禁用原因 |

### 3.1 建表与写入

| 能力键 | 状态 | 依据 / 前提 |
| --- | --- | --- |
| `spark-sql-create-table` | supported | `EV-COMM-CREATE-TABLE`（E1）+ `EV-R26-ART-SPARK3`（E3，制品在位） |
| `spark-sql-write` | supported | `EV-COMM-CREATE-TABLE`（E1） |
| `dataframe-write` | supported | `EV-R26-ART-SPARK-CLIENT`（E3，组件在位） |
| `flink-sql-write` | supported | `EV-R26-ART-FLINK17`（E3）；前提：Flink 1.17.x + hudi-flink1.17-bundle 已在 MRS 安装 |
| `bulk-insert` | supported | `EV-COMM-BULK-INSERT`（E1）；与 BUCKET 索引的组合限制见 `bucket-with-bulk-insert` |

### 3.2 索引

| 能力键 | 状态 | 依据 / 前提 |
| --- | --- | --- |
| `index-simple` | supported | `EV-COMM-INDEX`（E1） |
| `index-bloom` | supported | `EV-COMM-INDEX`（E1） |
| `index-bucket` | **unverified** | 社区文档只说明「按 record key 哈希分桶」；**r26 是否启用 BUCKET 索引、其分桶哈希算法与 File Group 分配规则均未确认**。本项目实现的是教学示意算法（djb2 取模），界面必须显示 `BUCKET_ALGORITHM_NOTE` |
| `index-global` | **unverified** | r26 对 `GLOBAL_SIMPLE` / `GLOBAL_BLOOM` 的支持与行为需实测确认 |
| `bucket-with-bulk-insert` | **unverified** | 社区 0.15 文档未明确该组合的限制；本项目按**保守拦截**处理（`checkOperationCompatibility` 返回拒绝原因），并提示先在 r26 实测 |

### 3.3 表服务

| 能力键 | 状态 | 依据 / 前提 |
| --- | --- | --- |
| `run-compaction-sql` | supported | `EV-HW-RUN-COMPACTION`（E2，华为《Hudi数据表Compaction规范》） |
| `spark-async-compaction` | supported | 同上；前提：需显式设置 `hoodie.run.compact.only.inline=true` 并由调度平台触发 |
| `flink-plan-only-compaction` | supported | 同上；前提：关闭 `compaction.async.enabled`、开启 `compaction.schedule.enabled` |
| `run-archivelog-sql` | supported | `EV-HW-RUN-COMPACTION`（E2） |
| `run-clean-sql` | **conditional** | 华为文档把 `run clean on <db>.<table>` 标注为 **MRS 3.2.0 及之后**版本；**MRS 3.1.x（含目标版本 3.1.0-350-r26）需改用 `hoodie.clean.automatic=true`**。目标版本的可用性仍需实测确认 —— 界面上 `spark-clean` 模板的 status 必须是 `conditional` |
| `metadata-table` | **unverified** | r26 的 Metadata Table 开关、索引实现与限制需实测确认（`EV-COMM-METADATA-TABLE`，E1） |

### 3.4 TTL / 权限

| 能力键 | 状态 | 依据 / 前提 |
| --- | --- | --- |
| `ttl-policy` | supported | `EV-HW-TTL-POLICY`（E2）；前提：`level` 当前**仅支持 PARTITION**；`value` 与 `units` 必须同时提供 |
| `ttl-record-level` | **unsupported** | 华为文档原文：`level` 取值 PARTITION 或 RECORD，`Currently, only PARTITION is supported`。引擎对 RECORD 级直接抛 `SimulationError` |
| `kerberos-hdfs-hms` | supported | `EV-HW-KERBEROS`（当前 E0）；前提：需完成 keytab 配置与对应 principal 授权 |

### 3.5 统计

| 状态 | 能力数 | 说明 |
| --- | --- | --- |
| supported | 13 | — |
| conditional | 1 | `run-clean-sql` |
| unverified | 4 | `index-bucket` / `index-global` / `bucket-with-bulk-insert` / `metadata-table` |
| unsupported | 1 | `ttl-record-level` |
| **合计** | **19** | 另有未登记能力走 `capabilityOf` 的保守默认（`unverified`） |

---

## 4. 配置名映射（逻辑名 → r26 实际配置名）

| 逻辑名 | r26 实际配置名 |
| --- | --- |
| `compaction.async.enabled` | `compaction.async.enabled` |
| `compaction.schedule.enabled` | `compaction.schedule.enabled` |
| `compaction.delta.commits` | `compaction.delta_commits` |
| `compaction.inline` | `hoodie.compact.inline` |
| `compaction.only.inline` | `hoodie.run.compact.only.inline` |
| `clean.async.enabled` | `hoodie.clean.async` |
| `clean.automatic` | `hoodie.clean.automatic` |
| `archive.automatic` | `hoodie.archive.automatic` |
| `archive.async` | `hoodie.archive.async` |
| `cleaner.commits.retained` | `hoodie.cleaner.commits.retained` |
| `keep.max.commits` | `hoodie.keep.max.commits` |
| `keep.min.commits` | `hoodie.keep.min.commits` |
| `index.type` | `hoodie.index.type` |
| `record.key.field` | `hoodie.datasource.write.recordkey.field` |
| `precombine.field` | `hoodie.datasource.write.precombine.field` |
| `payload.class` | `hoodie.datasource.write.payload.class` |
| `table.type` | `hoodie.datasource.write.table.type` |
| `partition.field` | `hoodie.datasource.write.partitionpath.field` |
| `operation` | `hoodie.datasource.write.operation` |
| `bulk.insert` | `hoodie.datasource.write.bulk_insert.enable` |
| `bucket.index.num.buckets` | `hoodie.bucket.index.num.buckets` |

> 查表入口：`configName(logical)`（`src/engine/versions/HuaweiMRS350R26Profile.ts`）。
> 未登记的名字原样返回 —— 宁可暴露拼写错误，也不要静默失效。

---

## 5. 操作约束（版本档案里的硬约束）

| 约束键 | 内容 | 引擎行为 |
| --- | --- | --- |
| `BULK_INSERT+BUCKET` | BUCKET 索引与 bulk_insert 的组合限制尚未在 r26 确认 | `checkOperationCompatibility` 返回拒绝原因；`performWrite` 抛 `SimulationError`（capabilityKey = `bucket-with-bulk-insert`） |
| `RECORD_LEVEL_TTL` | 华为 r26 文档明确 `level` 仅支持 PARTITION | `applyTtl` 对 RECORD 级抛 `SimulationError`（capabilityKey = `ttl-record-level`） |
| `BUCKET_GLOBAL_INDEX` | GLOBAL 索引与 BUCKET 索引的组合行为需实测确认 | 档案中登记为待确认，当前不提供该组合的模拟 |

---

## 6. 版本差异的「不写死」原则

所有存在版本差异的分支都必须经由版本档案，示例：

```ts
// src/engine/versions/HuaweiMRS350R26Profile.ts
export function capabilityOf(key: string): Capability {
  return (
    HuaweiMRS350R26Profile.capabilities[key] ?? {
      key,
      state: 'unverified',                                  // 保守默认
      openQuestion: '该能力未登记在 r26 版本档案中，需先完成版本兼容性审核。',
    }
  )
}
```

**未登记的能力一律 `unverified`**，而不是「看起来像 supported 就先按 supported 处理」。
这一条由 `tests/unit/capabilities.spec.ts` 断言守着。
