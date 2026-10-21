/**
 * 模拟场景规则表。
 *
 * 需求 P01 要求：「MOR 初始写入和后续更新的具体文件落点应通过场景规则明确建模，
 * 不能简单规定 MOR 所有写入都只产生 Log。」
 *
 * 因此这里把「写入场景 → 文件落点」显式建模，界面会直接展示这张表，
 * 让学习者看到规则本身，而不是看到隐藏假设产生的结果。
 *
 * ⚠️ 这些规则用于教学建模。r26 的真实落点行为仍需实测校正，
 *    界面必须与「待 r26 确认」标签同时出现。
 */

export type LandingKind =
  | 'BASE_FILE'
  | 'LOG_ONLY_GROUP'
  | 'APPEND_LOG'
  | 'NEW_LOG_ONLY_GROUP'
  | 'REWRITE_FILE_GROUP'
  | 'NEW_BASE_FILE'

export interface ScenarioRule {
  key: string
  tableType: 'COPY_ON_WRITE' | 'MERGE_ON_READ'
  scenario: string
  landing: LandingKind
  landingText: string
  note: string
  /** 是否需要在界面上标注为待 r26 确认 */
  needsVerification: boolean
}

export const SCENARIO_RULES: ScenarioRule[] = [
  /* ------------------------------ COW ------------------------------ */
  {
    key: 'COW_INITIAL_INSERT',
    tableType: 'COPY_ON_WRITE',
    scenario: 'COW：分区首次写入（无既有 File Group）',
    landing: 'BASE_FILE',
    landingText: '生成 Base File（parquet）',
    note: 'COW 每次写入都直接产出完整的 parquet 文件。',
    needsVerification: false,
  },
  {
    key: 'COW_UPDATE_EXISTING',
    tableType: 'COPY_ON_WRITE',
    scenario: 'COW：更新已存在主键',
    landing: 'REWRITE_FILE_GROUP',
    landingText: '重写目标 File Group 整个文件',
    note:
      'COW 无法局部修改 parquet，必须读取旧文件 + 合并新记录 + 写出新文件。旧文件在 Clean 之前仍物理存在于 HDFS 上。',
    needsVerification: false,
  },
  {
    key: 'COW_INSERT_NEW_KEY',
    tableType: 'COPY_ON_WRITE',
    scenario: 'COW：写入全新主键',
    landing: 'NEW_BASE_FILE',
    landingText: '生成新的 Base File',
    note: '新主键落到新的 File Group，不影响其他文件。',
    needsVerification: false,
  },
  {
    key: 'COW_BULK_INSERT',
    tableType: 'COPY_ON_WRITE',
    scenario: 'COW：bulk_insert 初始化',
    landing: 'BASE_FILE',
    landingText: '直接生成 Base File（跳过合并去重）',
    note: 'bulk_insert 不做更新合并，适合空表初始化。',
    needsVerification: false,
  },

  /* ------------------------------ MOR ------------------------------ */
  {
    key: 'MOR_INITIAL_INSERT',
    tableType: 'MERGE_ON_READ',
    scenario: 'MOR：分区首次写入（无既有 File Group）',
    landing: 'LOG_ONLY_GROUP',
    landingText: '生成仅含 Log File 的 File Group',
    note:
      '非 bulk_insert 的 MOR 写入首盘产生 log-only 的 File Slice —— 该 File Group 没有 base file，需要一次 compaction 才会产生 parquet。',
    needsVerification: true,
  },
  {
    key: 'MOR_UPDATE_EXISTING',
    tableType: 'MERGE_ON_READ',
    scenario: 'MOR：更新已存在主键',
    landing: 'APPEND_LOG',
    landingText: '追加 Log File 到该主键所在 File Group',
    note: 'MOR 的更新成本与文件大小无关，这是它相对 COW 的核心优势。',
    needsVerification: false,
  },
  {
    key: 'MOR_INSERT_NEW_KEY',
    tableType: 'MERGE_ON_READ',
    scenario: 'MOR：写入全新主键（分区已有 File Group）',
    landing: 'NEW_LOG_ONLY_GROUP',
    landingText: '新建仅含 Log File 的 File Group',
    note: '新主键落在新的 File Group，同样没有 base file。',
    needsVerification: true,
  },
  {
    key: 'MOR_BULK_INSERT',
    tableType: 'MERGE_ON_READ',
    scenario: 'MOR：bulk_insert 初始化',
    landing: 'BASE_FILE',
    landingText: '直接生成 Base File（跳过合并去重）',
    note:
      '这是 MOR 下唯一「一写即 parquet」的路径，也是 spec P01 要求的区分点：不能笼统说 MOR 写入只产生 log。',
    needsVerification: false,
  },
]

export function rulesFor(tableType: 'COPY_ON_WRITE' | 'MERGE_ON_READ'): ScenarioRule[] {
  return SCENARIO_RULES.filter((r) => r.tableType === tableType)
}

export function ruleByKey(key: string): ScenarioRule | undefined {
  return SCENARIO_RULES.find((r) => r.key === key)
}

export const SCENARIO_RULES_NOTE =
  '上表为教学建模规则，用于解释「同一张表、不同场景下文件落点不同」。r26 实测行为待确认。'
