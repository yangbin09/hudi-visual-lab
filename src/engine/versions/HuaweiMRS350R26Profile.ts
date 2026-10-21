import type { Capability, Evidence } from '@/models/evidence'
import type { HudiVersionProfile } from '@/models/hudi'
import { HUAWEI_R26_EVIDENCE } from '@/evidence/huawei/mrs350r26'

/**
 * HuaweiMRS350R26Profile
 * ---------------------------------------------------------------------------
 * 所有存在版本差异的逻辑必须通过本 Profile 查询，禁止在业务代码里硬编码。
 *
 * 目标版本：
 *   平台  Huawei FusionInsight / MRS 3.1.0-350-r26
 *   Hudi  0.15.0-h0.cbu.mrs.350.r26
 *   Spark 3.3.1-h0.cbu.mrs.350.r26
 *   Flink 1.17.x
 *   Scala 2.12 / 存储 HDFS / 元数据 Hive Metastore / 认证 Kerberos
 *
 * 重要约定（需求 §2.2）：
 *   社区 Hudi 0.15 支持 ≠ 华为 r26 支持。
 *   无真实依据的能力一律标记 unverified / E0，不得伪造执行结果。
 * ========================================================================= */

const RELEASE = 'MRS 3.1.0-350-r26'
const HUDI_VERSION = '0.15.0-h0.cbu.mrs.350.r26'

/** r26 制品坐标（已通过华为 Maven 镜像站 HTTP 200 校验，见 evidence） */
export const R26_ARTIFACTS = {
  'hudi-spark3.3.x_2.12': `${HUDI_VERSION}`,
  'hudi-spark3-bundle_2.12': `${HUDI_VERSION}`,
  'hudi-spark-client': `${HUDI_VERSION}`,
  'hudi-common': `${HUDI_VERSION}`,
  'hudi-flink1.17-bundle': `${HUDI_VERSION}`,
  'hudi-flink1.17.x': `${HUDI_VERSION}`,
  'hudi-flink-client': `${HUDI_VERSION}`,
  'hudi-hive-sync-bundle': `${HUDI_VERSION}`,
  'hudi-examples-spark': `${HUDI_VERSION}`,
} as const

const capabilities: Record<string, Capability> = {
  /* ---------------- 建表与写入 ---------------- */
  'spark-sql-create-table': {
    key: 'spark-sql-create-table',
    state: 'supported',
    evidenceIds: ['EV-R26-ART-SPARK3', 'EV-COMM-CREATE-TABLE'],
  },
  'spark-sql-write': {
    key: 'spark-sql-write',
    state: 'supported',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
  },
  'dataframe-write': {
    key: 'dataframe-write',
    state: 'supported',
    evidenceIds: ['EV-R26-ART-SPARK-CLIENT'],
  },
  'flink-sql-write': {
    key: 'flink-sql-write',
    state: 'supported',
    precondition: 'Flink 1.17.x + hudi-flink1.17-bundle 已在 MRS 集群安装',
    evidenceIds: ['EV-R26-ART-FLINK17'],
  },
  'bulk-insert': {
    key: 'bulk-insert',
    state: 'supported',
    evidenceIds: ['EV-COMM-BULK-INSERT'],
  },

  /* ---------------- 索引 ---------------- */
  'index-simple': {
    key: 'index-simple',
    state: 'supported',
    evidenceIds: ['EV-COMM-INDEX'],
  },
  'index-bloom': {
    key: 'index-bloom',
    state: 'supported',
    evidenceIds: ['EV-COMM-INDEX'],
  },
  'index-bucket': {
    key: 'index-bucket',
    state: 'unverified',
    openQuestion:
      'r26 是否启用 BUCKET 索引、其分桶哈希算法与 File Group 分配规则需以 r26 源码/实测确认；本项目按教学示意实现并显式标注。',
    evidenceIds: ['EV-COMM-INDEX', 'EV-R26-ART-COMMON'],
  },
  'index-global': {
    key: 'index-global',
    state: 'unverified',
    openQuestion: 'r26 对 GLOBAL_SIMPLE / GLOBAL_BLOOM 的支持与行为需实测确认。',
    evidenceIds: ['EV-COMM-INDEX'],
  },
  'bucket-with-bulk-insert': {
    key: 'bucket-with-bulk-insert',
    state: 'unverified',
    openQuestion:
      'BUCKET 索引表使用 bulk_insert 的兼容性限制需在 r26 环境实测，本项目以故障实验形式呈现并标注待验证。',
    evidenceIds: ['EV-COMM-BULK-INSERT'],
  },

  /* ---------------- 表服务 ---------------- */
  'run-compaction-sql': {
    key: 'run-compaction-sql',
    state: 'supported',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
  },
  'run-clean-sql': {
    key: 'run-clean-sql',
    state: 'conditional',
    precondition:
      '华为文档中 `run clean on <db>.<table>` 明确标注为 MRS 3.2.0 及之后版本；MRS 3.1.x 使用 hoodie.clean.automatic=true 方式。目标 3.1.0-350-r26 需实测确认。',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
  },
  'run-archivelog-sql': {
    key: 'run-archivelog-sql',
    state: 'supported',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
  },
  'flink-plan-only-compaction': {
    key: 'flink-plan-only-compaction',
    state: 'supported',
    precondition: '需关闭 Flink 侧 compaction.async.enabled，开启 compaction.schedule.enabled',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
  },
  'spark-async-compaction': {
    key: 'spark-async-compaction',
    state: 'supported',
    precondition: '需显式设置 hoodie.run.compact.only.inline=true 并由调度平台触发',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
  },
  'metadata-table': {
    key: 'metadata-table',
    state: 'unverified',
    openQuestion: 'r26 的 Metadata Table 开关、索引实现与限制需实测确认。',
    evidenceIds: ['EV-COMM-METADATA-TABLE'],
  },
  'ttl-policy': {
    key: 'ttl-policy',
    state: 'supported',
    precondition: 'level 当前仅支持 PARTITION',
    evidenceIds: ['EV-HW-TTL-POLICY'],
  },
  'ttl-record-level': {
    key: 'ttl-record-level',
    state: 'unsupported',
    precondition: '华为文档明确：level 目前仅支持 PARTITION',
    evidenceIds: ['EV-HW-TTL-POLICY'],
  },
  'kerberos-hdfs-hms': {
    key: 'kerberos-hdfs-hms',
    state: 'supported',
    precondition: '需完成 keytab 配置与对应 principal 授权',
    evidenceIds: ['EV-HW-KERBEROS'],
  },
}

/** 逻辑配置名 → r26 实际配置名 */
const configMapping: Record<string, string> = {
  'compaction.async.enabled': 'compaction.async.enabled',
  'compaction.schedule.enabled': 'compaction.schedule.enabled',
  'compaction.delta.commits': 'compaction.delta_commits',
  'compaction.inline': 'hoodie.compact.inline',
  'compaction.only.inline': 'hoodie.run.compact.only.inline',
  'clean.async.enabled': 'hoodie.clean.async',
  'clean.automatic': 'hoodie.clean.automatic',
  'archive.automatic': 'hoodie.archive.automatic',
  'archive.async': 'hoodie.archive.async',
  'cleaner.commits.retained': 'hoodie.cleaner.commits.retained',
  'keep.max.commits': 'hoodie.keep.max.commits',
  'keep.min.commits': 'hoodie.keep.min.commits',
  'index.type': 'hoodie.index.type',
  'record.key.field': 'hoodie.datasource.write.recordkey.field',
  'precombine.field': 'hoodie.datasource.write.precombine.field',
  'payload.class': 'hoodie.datasource.write.payload.class',
  'table.type': 'hoodie.datasource.write.table.type',
  'partition.field': 'hoodie.datasource.write.partitionpath.field',
  'operation': 'hoodie.datasource.write.operation',
  'bulk.insert': 'hoodie.datasource.write.bulk_insert.enable',
  'bucket.index.num.buckets': 'hoodie.bucket.index.num.buckets',
}

const operationConstraints: Record<string, string> = {
  'BULK_INSERT+BUCKET':
    'BUCKET 索引与 bulk_insert 的组合限制尚未在 r26 确认，引擎以「待验证」方式拦截并提示实测。',
  'RECORD_LEVEL_TTL': '华为 r26 文档明确 level 仅支持 PARTITION，RECORD 级 TTL 不可用。',
  'BUCKET_GLOBAL_INDEX': 'GLOBAL 索引与 BUCKET 索引的组合行为需实测确认。',
}

export const HuaweiMRS350R26Profile: HudiVersionProfile = {
  release: RELEASE,
  components: {
    hudi: HUDI_VERSION,
    spark: '3.3.1-h0.cbu.mrs.350.r26',
    flink: '1.17.x',
    scala: '2.12',
    storage: 'HDFS',
    metadata: 'Hive Metastore',
    auth: 'Kerberos',
  },
  capabilities,
  configMapping,
  operationConstraints,
  indexRules: {
    bucketHashAlgorithm: 'teaching-approximation:djb2-mod',
    bucketHashVerified: false,
    bucketWithBulkInsertAllowed: false,
    bucketWithBulkInsertNote:
      '华为 r26 文档未直接说明该限制，社区 0.15 中 BUCKET 索引与 bulk_insert 的兼容性需实测；引擎按「拦截并提示实测」处理。',
    globalIndexSupported: false,
    globalIndexNote: 'r26 未确认支持 GLOBAL 索引，引擎按未验证能力处理。',
  },
  ttlSupport: {
    supported: true,
    levels: ['PARTITION'],
    units: ['YEARS', 'MONTHS', 'WEEKS', 'DAYS'],
    note: '华为文档：spec 使用正则匹配分区；value 与 units 必须同时给出；level 当前仅支持 PARTITION。',
  },
}

/** 查询单个能力，未登记的能力一律视为 unverified（保守默认） */
export function capabilityOf(key: string): Capability {
  return (
    HuaweiMRS350R26Profile.capabilities[key] ?? {
      key,
      state: 'unverified',
      openQuestion: '该能力未登记在 r26 版本档案中，需先完成版本兼容性审核。',
    }
  )
}

/** 解析 r26 实际配置名 */
export function configName(logical: string): string {
  return HuaweiMRS350R26Profile.configMapping[logical] ?? logical
}

export const R26_EVIDENCE: Evidence[] = HUAWEI_R26_EVIDENCE
