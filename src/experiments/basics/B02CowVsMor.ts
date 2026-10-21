/**
 * B02 —— COW / MOR 对比实验
 * ---------------------------------------------------------------------------
 * 需求 P01（实验目录 B02 + B03）：把「COW 与 MOR 的文件落点差异」讲成可操作的事实，
 * 而不是一句口号。核心结论有三：
 *
 *   1. COW 每次写入都重写整个 File Group（写放大），旧文件在 Clean 之前仍在 HDFS；
 *   2. MOR 的普通写入只追加 log file，base file 要等 compaction 才产生；
 *   3. 删除不是「抹掉一行」，而是写一条 operation=D 的 tombstone。
 *
 * ⚠️ 诚实标注：
 *   - COW / MOR 的文件行为依据**社区 Hudi 0.15 文档（E1）**，不是 r26 实测；
 *   - MOR「首次写入落在 log-only File Group」这一条在 r26 上**尚未实测确认**，
 *     因此 supportState = 'conditional'，界面必须同时显示「待 r26 确认」。
 */

import type { InputRecord } from '@/models/actions'
import type { HudiTable, HudiTableState, IndexType, TableType } from '@/models/hudi'
import type {
  EdgeCase,
  ExperimentControl,
  ExperimentDefinition,
  ExperimentStep,
  QuizQuestion,
} from '@/models/simulation'
import { applyAction } from '@/engine/core/applyAction'
import { createInitialState } from '@/engine/core/state'
import { HuaweiMRS350R26Profile } from '@/engine/versions/HuaweiMRS350R26Profile'

/* -------------------------------------------------------------------------- */
/* 常量                                                                        */
/* -------------------------------------------------------------------------- */

export const B02_EXPERIMENT_ID = 'B02'
export const B02_DATABASE = 'hudi_demo'
export const B02_TABLE = 'hudi_cow_mor_demo'
export const B02_TARGET_VERSION = '0.15.0-h0.cbu.mrs.350.r26'
export const B02_DEFAULT_PARTITION = '2024-01-01'
export const B02_DEFAULT_BUCKET_COUNT = 4

/** 实验所属模块（目录里的模块 A「基础原理」；B02 / B03 都归在这一模块） */
export const B02_MODULE_ID = 'A'

/* -------------------------------------------------------------------------- */
/* 表定义与状态工厂                                                             */
/* -------------------------------------------------------------------------- */

export interface B02Options {
  /** 表类型：COW / MOR */
  tableType?: TableType
  /** 分区值（dt 字段的值） */
  partitionValue?: string
  /** 是否启用 precombine 字段（ts） */
  preCombineEnabled?: boolean
  /** 索引类型：BUCKET 索引在 r26 尚未验证 */
  indexType?: IndexType
  /** Bucket 数量：仅 indexType = BUCKET 时生效 */
  bucketCount?: number
}

/**
 * 构造 B02 的表定义。
 *
 * 说明：所有版本相关字段（表类型、主键、precombine、分区、索引）都写进 properties，
 * 这样页面上生成的 SQL 与引擎内部行为始终来自同一份定义，不会出现「SQL 与状态不一致」。
 */
export function buildB02Table(options: B02Options = {}): HudiTable {
  const tableType: TableType = options.tableType ?? 'COPY_ON_WRITE'
  const indexType: IndexType = options.indexType ?? 'SIMPLE'
  const bucketCount = indexType === 'BUCKET' ? options.bucketCount ?? B02_DEFAULT_BUCKET_COUNT : null
  // 关闭 precombine 时用空串而不是 null：
  // 引擎的建表通道（CREATE_TABLE）对 null 会回落成默认的 'ts'，空串才能真正表达「不启用」。
  const preCombineField = options.preCombineEnabled === false ? '' : 'ts'

  return {
    tableName: B02_TABLE,
    databaseName: B02_DATABASE,
    tableType,
    fields: [
      { name: 'id', type: 'INT', comment: '主键 / Record Key' },
      { name: 'name', type: 'STRING' },
      { name: 'amount', type: 'DOUBLE' },
      { name: 'ts', type: 'BIGINT', comment: 'precombine 字段，同主键多版本按它排序' },
      { name: 'dt', type: 'STRING', comment: '分区字段' },
    ],
    primaryKey: 'id',
    preCombineField,
    partitionFields: ['dt'],
    partitionType: 'PARTITIONED',
    indexType,
    bucketCount,
    isGlobalIndexed: indexType === 'GLOBAL_SIMPLE' || indexType === 'GLOBAL_BLOOM',
    payloadClass: 'org.apache.hudi.common.model.HoodiePayload.class',
    tablePath: `/user/hive/warehouse/${B02_DATABASE}.db/${B02_TABLE}`,
    hiveStylePartitioning: 'HIVE_STYLE_PARTITIONING',
    properties: {
      'hoodie.datasource.write.table.type': tableType,
      'hoodie.datasource.write.recordkey.field': 'id',
      'hoodie.datasource.write.precombine.field': preCombineField,
      'hoodie.datasource.write.partitionpath.field': 'dt',
      'hoodie.datasource.write.operation': 'upsert',
      'hoodie.datasource.write.hive_style_partitioning': 'true',
      'hoodie.index.type': indexType,
    },
    version: B02_TARGET_VERSION,
  }
}

/** 3 条种子记录：让「更新 / 删除 / precombine」三个场景一上来就有靶子 */
export function buildSeedRecords(options: B02Options = {}): InputRecord[] {
  const dt = options.partitionValue ?? B02_DEFAULT_PARTITION
  return [
    { recordKey: '1001', fields: { id: 1001, name: '订单A', amount: 100.5, ts: 20240101100000, dt } },
    { recordKey: '1002', fields: { id: 1002, name: '订单B', amount: 200, ts: 20240101100010, dt } },
    { recordKey: '1003', fields: { id: 1003, name: '订单C', amount: 300.25, ts: 20240101100020, dt } },
  ]
}

/**
 * 创建实验初始状态。
 *
 * 关键点：种子数据**必须走引擎的写入通道**（applyAction → performWrite），
 * 不能自己拼 records —— 否则初始状态里就没有 File Group / Timeline instant，
 * 后面的 COW 与 MOR 对比就失去了对照物。
 */
export function createB02State(options: B02Options = {}): HudiTableState {
  const state = createInitialState(buildB02Table(options))
  const result = applyAction(
    state,
    { type: 'UPSERT_RECORDS', records: buildSeedRecords(options) },
    HuaweiMRS350R26Profile,
  )
  if (!result.success) {
    throw new Error(`B02 初始数据写入失败：${result.error ?? '未知原因'}`)
  }
  return result.nextState as HudiTableState
}

/** COW 版初始状态 */
export function createCowState(options: B02Options = {}): HudiTableState {
  return createB02State({ ...options, tableType: 'COPY_ON_WRITE' })
}

/** MOR 版初始状态 */
export function createMorState(options: B02Options = {}): HudiTableState {
  return createB02State({ ...options, tableType: 'MERGE_ON_READ' })
}

/**
 * 表类型 → 状态工厂。
 * 界面上切换「表类型」控制项时，由 ExperimentView 调用这里的工厂重建状态。
 */
export const B02_STATE_FACTORIES: Record<string, (options?: B02Options) => HudiTableState> = {
  COPY_ON_WRITE: createCowState,
  MERGE_ON_READ: createMorState,
}

/* -------------------------------------------------------------------------- */
/* 控制项                                                                       */
/* -------------------------------------------------------------------------- */

export const B02_CONTROLS: ExperimentControl[] = [
  {
    key: 'tableType',
    label: '表类型（COW / MOR）',
    kind: 'select',
    options: [
      { label: 'COW（Copy On Write）', value: 'COPY_ON_WRITE' },
      { label: 'MOR（Merge On Read）', value: 'MERGE_ON_READ' },
    ],
    defaultValue: 'COPY_ON_WRITE',
    hint: '切换表类型会重建实验状态：COW 写入即产出 parquet，MOR 写入只产出 log file。',
  },
  {
    key: 'partitionValue',
    label: '分区值（dt）',
    kind: 'text',
    defaultValue: B02_DEFAULT_PARTITION,
    hint: '分区字段 dt 的取值。改成别的值即可观察「数据落在不同分区目录」的效果。',
  },
  {
    key: 'preCombineEnabled',
    label: '启用 precombine 字段（ts）',
    kind: 'switch',
    defaultValue: true,
    hint: '关闭后同主键多版本改为「后写入者胜」，并且「precombine 值更小的更新被忽略」这条规则不再成立。',
  },
  {
    key: 'indexType',
    label: '索引类型',
    kind: 'select',
    options: [
      { label: 'SIMPLE', value: 'SIMPLE' },
      { label: 'BLOOM', value: 'BLOOM' },
      { label: 'BUCKET（r26 待验证）', value: 'BUCKET' },
    ],
    defaultValue: 'SIMPLE',
    hint: '索引决定「怎么定位已存在主键所在的文件」。BUCKET 索引在 r26 上的行为尚未实测确认。',
  },
  {
    key: 'bucketCount',
    label: 'Bucket 数量（仅 BUCKET 索引生效）',
    kind: 'number',
    defaultValue: B02_DEFAULT_BUCKET_COUNT,
    min: 1,
    max: 16,
    hint: '只有索引类型为 BUCKET 时才生效；分桶哈希为教学示意算法，与 r26 实际实现不一定一致。',
  },
]

/* -------------------------------------------------------------------------- */
/* 步骤                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 步骤里的 `{{partitionValue}}` 由 ExperimentView 在派发前替换成当前控制项的值，
 * 这样「改分区控制项 → 重新执行步骤」的结果始终自洽。
 */
export const B02_STEPS: ExperimentStep[] = [
  {
    stepId: 'B02-S1',
    title: '插入：写入一个表里不存在的主键 1004',
    description:
      '主键不存在 → 走「新增」路径。COW 会新建一个 File Group 并产出 base parquet；' +
      'MOR 会新建一个**只含 log file** 的 File Group（此时还没有任何 parquet 文件）。',
    action: {
      type: 'UPSERT_RECORDS',
      records: [
        {
          recordKey: '1004',
          fields: {
            id: 1004,
            name: '新增订单D',
            amount: 400.75,
            ts: 20240101130000,
            dt: '{{partitionValue}}',
          },
        },
      ],
    },
    capabilityKey: 'spark-sql-write',
  },
  {
    stepId: 'B02-S2',
    title: '更新：把主键 1001 的 name / amount 改掉',
    description:
      '主键已存在 → 走「更新」路径。COW 重写整个 File Group（旧文件在 Clean 前仍在 HDFS）；' +
      'MOR 只向该 File Group 追加一个 log file，base file 完全不动。',
    action: {
      type: 'UPSERT_RECORDS',
      records: [
        {
          recordKey: '1001',
          fields: {
            id: 1001,
            name: '订单A-已更新',
            amount: 150.75,
            ts: 20240101140000,
            dt: '{{partitionValue}}',
          },
        },
      ],
    },
    capabilityKey: 'spark-sql-write',
  },
  {
    stepId: 'B02-S3',
    title: '删除：删除主键 1002',
    description:
      '删除在 Hudi 里不是抹掉一行，而是写入一条 _hoodie_operation = D 的 tombstone。' +
      '逻辑视图里查不到，物理文件里还在 —— 直到 compaction / clean 才回收空间。',
    action: { type: 'DELETE_RECORDS', recordKeys: ['1002'] },
    capabilityKey: 'spark-sql-write',
  },
  {
    stepId: 'B02-S4',
    title: '生成 Compaction Plan（仅 MOR 有意义）',
    description:
      'compaction 分为「生成计划」和「执行计划」两步 —— 这正是华为 r26 规范里异步 compaction 的基础：' +
      'Flink / 写入作业只写 plan，真正的合并由独立的 Spark 作业异步完成。' +
      'COW 表没有 log file，执行本步会被引擎拒绝。',
    action: { type: 'SCHEDULE_COMPACTION', deltaCommits: 1 },
    capabilityKey: 'run-compaction-sql',
  },
  {
    stepId: 'B02-S5',
    title: '执行 Compaction：把 log file 合并成 base parquet',
    description:
      '执行后 File Slice 的 logFiles 被清空、baseFile 被换成新的 parquet。' +
      '旧 base / log 文件只是「不再被引用」，物理上仍在 HDFS，要靠 Clean 真正删除。',
    action: { type: 'RUN_COMPACTION' },
    capabilityKey: 'run-compaction-sql',
  },
  {
    stepId: 'B02-S6',
    title: '重置：回到实验初始状态',
    description: '重置不会产生任何 instant —— 它只是把状态指针拨回实验开始时的快照。',
    action: { type: 'RESET_EXPERIMENT' },
  },
]

/* -------------------------------------------------------------------------- */
/* 边界场景                                                                     */
/* -------------------------------------------------------------------------- */

export const B02_EDGE_CASES: EdgeCase[] = [
  {
    id: 'B02-EC-01',
    title: '正常场景：主键不存在 → 新增记录',
    description:
      '写入主键 1004（表中不存在）。写入前：COW 与 MOR 都是 1 个有效 File Group、3 条可见记录。',
    expected:
      'COW：新增 1 个 File Group，产出 1 个 base parquet 文件；Timeline 追加 1 个 action=COMMIT 的 instant；可见记录 3 → 4。' +
      'MOR：新增 1 个 File Group，但只有 1 个 log file、baseFile=null（log-only group），Timeline 追加 1 个 action=DELTA_COMMIT 的 instant；可见记录 3 → 4。' +
      '两种表类型的可见记录数相同 —— 差异只体现在文件落点。',
  },
  {
    id: 'B02-EC-02',
    title: '正常场景：主键已存在 → 更新记录',
    description: '把主键 1001 的 name 改成「订单A-已更新」、ts 提到 20240101140000。',
    expected:
      'COW：目标 File Group 被重写 —— 新增 1 个 base parquet 文件，旧 base 文件被标记为 SUPERSEDED（物理仍在 HDFS，等待 Clean）；' +
      '有效 File Group 数不变（1 个新的取代 1 个旧的），Timeline 追加 1 个 COMMIT instant；可见记录数仍为 4。' +
      'MOR：base file 不动（本实验的 MOR 首写是 log-only，baseFile 仍为 null），目标 File Slice 的 logFiles 由 1 变 2（version=2），' +
      'deltaCommits +1，Timeline 追加 1 个 DELTA_COMMIT instant；可见记录数仍为 4。' +
      '读优化查询在 compaction 之前看不到这次更新（MOR 特有）。',
  },
  {
    id: 'B02-EC-03',
    title: '边界场景：同批次重复主键 → 按 precombine 取值大者胜',
    description:
      '一次写入里出现两条主键 1005：ts 分别为 20240101150000 与 20240101160000。' +
      '（可用中栏「同批次重复主键」按钮复现）',
    expected:
      '同批次只保留 1 条主键 1005：precombine 值更大的那条（ts=20240101160000，name=订单E-新）胜出，可见记录只 +1（4 → 5），' +
      '不是 +2。' +
      '若两条的 ts 相等 → 保留**后写入**的一条，并产生一条告警「同一批次内主键 1005 出现两次且 precombine 字段取值相同」。' +
      '若 precombine 被关闭 → 同样保留后写入者，并给出「precombine 字段存在空值」的告警。',
  },
  {
    id: 'B02-EC-04',
    title: '边界场景：precombine 值更小的更新 → 按 Hudi 语义被忽略',
    description:
      '主键 1001 当前版本的 ts = 20240101140000，此时写入 ts = 20240101130000（更旧）的版本。',
    expected:
      '逻辑记录视图保持旧版本不变：name 仍是「订单A-已更新」，不会退回「订单A」；' +
      '引擎产生一条告警「主键 1001 的新记录 precombine 值（20240101130000）小于已有版本（20240101140000），按 Hudi 语义忽略该次更新」。' +
      '注意：文件层仍然发生了写入（COW 重写文件 / MOR 追加 log file），这是引擎的「先落盘、再按 precombine 归并」模型。' +
      'precombine 关闭时本条规则不成立，后写入者直接胜出。',
  },
  {
    id: 'B02-EC-05',
    title: '正常场景：删除记录 → 产生 tombstone',
    description: '删除主键 1002。',
    expected:
      '逻辑记录视图中该记录被标记为 _hoodie_operation = D，可见记录 4 → 3，但物理记录仍然存在。' +
      'COW：重写目标 File Group，新 base file 中该记录以 operation=D 保留，旧 base 标记 SUPERSEDED，Timeline 追加 1 个 COMMIT instant。' +
      'MOR：向目标 File Group 追加 1 个 log file（内含 tombstone），base file 不变，Timeline 追加 1 个 DELTA_COMMIT instant。' +
      '两种表类型都要等 compaction / clean 之后，物理空间才真正被回收。',
  },
  {
    id: 'B02-EC-06',
    title: '边界场景：MOR 首次写入落点 → log-only File Group',
    description:
      'MOR 表的第一次普通写入（非 bulk_insert）。切到 MOR 后初始状态里就能直接看到：3 条种子记录已经落盘，但没有任何 parquet 文件。',
    expected:
      'File Slice 的 baseFile = null、logFiles = 1 —— 也就是 log-only File Group，HDFS 上一个 parquet 文件都没有。' +
      '必须执行一次 compaction 才会产生 base file（步骤 4 → 步骤 5）。' +
      'MOR 下唯一「一写即 parquet」的路径是 bulk_insert（规则表里的 MOR_BULK_INSERT）。' +
      '⚠️ 该落点在 r26 上尚未实测确认，界面会同时显示「待 r26 确认」告警（场景规则 needsVerification=true）。',
  },
]

/* -------------------------------------------------------------------------- */
/* 练习题                                                                       */
/* -------------------------------------------------------------------------- */

export const B02_QUIZ: QuizQuestion[] = [
  {
    id: 'B02-Q1',
    prompt: 'COW 表更新一条已存在的主键时，文件层面发生了什么？',
    options: [
      { id: 'A', text: '只追加一个 log file，base file 不动' },
      { id: 'B', text: '重写目标 File Group，生成新的 base parquet 文件，旧文件在 Clean 之前仍在 HDFS' },
      { id: 'C', text: '直接修改已有 parquet 文件中的那一行' },
      { id: 'D', text: '不写任何文件，查询时再动态合并' },
    ],
    answerIds: ['B'],
    explanation:
      'COW（Copy On Write）的名字就来自这里：parquet 是列式文件格式，无法局部修改一行，' +
      '所以任何更新都意味着「读旧文件 + 合并新记录 + 写新文件」。旧文件只是不再被引用（SUPERSEDED），' +
      '物理文件要等 Clean 才真正删除。A 是 MOR 的行为；C 误解了 parquet 的存储模型；D 是「没有索引」的臆想。',
  },
  {
    id: 'B02-Q2',
    prompt: 'MOR 表在第一次普通写入（bulk_insert 之外）之后，File Slice 的 base file 状态是？',
    options: [
      { id: 'A', text: '已经有一个完整的 base parquet 文件' },
      { id: 'B', text: '没有 base file，只有一个 log file，需要一次 compaction 才会产生 parquet' },
      { id: 'C', text: '有一个空的 base file' },
      { id: 'D', text: '取决于索引类型' },
    ],
    answerIds: ['B'],
    explanation:
      '这是 MOR 最容易被误解的一点：不是「MOR 永远不产生 parquet」，而是「MOR 的普通写入先产生 log，' +
      'parquet 要等 compaction」。MOR 下唯一一写即 parquet 的路径是 bulk_insert。' +
      '⚠️ 社区 0.15 文档与本项目的教学模型都指向 B，但 r26 上的实际首写落点仍需实测确认。',
  },
  {
    id: 'B02-Q3',
    prompt: '关于 precombine 字段，下列说法正确的有哪些？（多选）',
    multiple: true,
    options: [
      { id: 'A', text: '同主键出现多个版本时，precombine 值更大的版本胜出' },
      { id: 'B', text: 'precombine 值相同时，后写入的版本胜出' },
      { id: 'C', text: '新版本的 precombine 值更小时，这次更新会被忽略' },
      { id: 'D', text: '关闭 precombine 字段后，Hudi 会拒绝写入' },
    ],
    answerIds: ['A', 'B', 'C'],
    explanation:
      'precombine 字段是 Hudi 处理「同一主键多版本」的排序依据：值大者胜，相等时后写入者胜，' +
      '值更小的更新直接被忽略（用于抵御乱序到达的旧数据）。' +
      'D 是错的：不配置 precombine 字段完全合法，此时退化为「后写入者胜」，而不是拒绝写入。',
  },
  {
    id: 'B02-Q4',
    prompt: '关于删除记录（tombstone），下列说法正确的有哪些？（多选）',
    multiple: true,
    options: [
      { id: 'A', text: '删除不是把行从文件里抹掉，而是写入一条 _hoodie_operation = D 的记录' },
      { id: 'B', text: 'COW 删除会重写整个 File Group，MOR 删除只是追加一个 log file' },
      { id: 'C', text: '记录被删除后立即从 HDFS 上消失' },
      { id: 'D', text: '增量读会把删除记录以 operation=D 的形式返回，消费端必须自己处理删除语义' },
    ],
    answerIds: ['A', 'B', 'D'],
    explanation:
      'Hudi 的删除是「逻辑删除 + 物理待回收」：tombstone 让记录在查询中不可见，' +
      '但文件里的空间要等 compaction / clean 才回收，所以 C 错。' +
      'D 是 CDC 链路的经典坑：增量读会把 tombstone 一并吐出来，下游不做处理就会「删了没删干净」。',
  },
  {
    id: 'B02-Q5',
    prompt: '判断一次 compaction 是否真正成功，最应该看什么？',
    options: [
      { id: 'A', text: 'YARN 应用状态是否为 SUCCEEDED' },
      { id: 'B', text: 'Timeline 上是否出现 state = COMPLETED 的 compaction instant' },
      { id: 'C', text: 'Spark 日志里是否出现 "Job finished successfully"' },
      { id: 'D', text: '旧的 log file 是否已经从 HDFS 上消失' },
    ],
    answerIds: ['B'],
    explanation:
      '必须以 Hudi Timeline 为准：可能出现「YARN 显示 SUCCEEDED、Spark 正常结束，但 Hudi 事务没有提交」的' +
      '场景，此时 compaction instant 仍停留在 REQUESTED，文件没有被合并。' +
      'D 也不对 —— compaction 产生的旧文件要等 Clean 才真正删除。',
  },
]

/* -------------------------------------------------------------------------- */
/* 实验定义                                                                     */
/* -------------------------------------------------------------------------- */

export const B02: ExperimentDefinition = {
  id: B02_EXPERIMENT_ID,
  title: 'COW vs MOR：一次写入到底落在哪些文件上',
  moduleId: B02_MODULE_ID,
  catalogIds: ['B02', 'B03'],
  learningObjectives: [
    '说清 COW 与 MOR 在「插入 / 更新 / 删除」三种场景下的文件落点差异',
    '在 File Slice 层面区分 base file 与 log file，并解释为什么读优化查询在 compaction 前看不到最新数据',
    '解释 tombstone（_hoodie_operation = D）的产生方式与空间回收时机',
    '用 precombine 字段解释同主键多版本谁胜出，以及乱序旧数据为什么会被忽略',
    '理解「被取代（SUPERSEDED）」与「被删除（Clean）」是两个不同的动作',
  ],
  difficulty: '入门',
  estimatedMinutes: 25,
  prerequisites: [
    '知道 Hudi 表的基本概念：主键（Record Key）、分区、File Group / File Slice',
    '听说过 COW 与 MOR 的字面含义，但不清楚它们在文件层面的差别',
  ],
  targetVersion: B02_TARGET_VERSION,
  // COW / MOR 的文件行为只有社区 0.15 文档（E1）支撑；MOR 首写落点在 r26 未实测 → conditional
  supportState: 'conditional',
  evidenceLevel: 'E1',
  steps: B02_STEPS,
  controls: B02_CONTROLS,
  edgeCases: B02_EDGE_CASES,
  quiz: B02_QUIZ,
  evidenceIds: ['EV-COMM-MOR', 'EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
  createState: () => createCowState(),
}

export default B02
