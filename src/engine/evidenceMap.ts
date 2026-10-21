import type { ActionType } from '@/models/actions'

/**
 * 动作 → 证据 id 映射。
 *
 * ⚠️ 铁律：只允许引用证据库中**已存在**的 evidenceId，
 *    不得凭空编造（本文件的 id 全部来自 src/evidence/ 下的两个证据文件）。
 *
 * 证据链接的强度分两类，注释里已逐条标明：
 *   - 行为级：证据文档 / 制品直接覆盖该动作的语法或行为；
 *   - 组件级：证据只能证明「该组件在 r26 中存在」，不能证明具体行为。
 *     组件级链接在界面上不得表述为「已验证该行为」。
 */
export const EVIDENCE_MAP: Record<ActionType, string[]> = {
  // 行为级：社区文档给出了 CREATE TABLE ... USING hudi + TBLPROPERTIES 的完整写法；
  // r26 制品侧证明 hudi-spark3.3.x_2.12 在位（语法本身仍属社区 0.15 语义）。
  CREATE_TABLE: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],

  // 行为级（写入语法为社区文档级，制品级证明 Spark 侧依赖在位）
  INSERT_RECORDS: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3', 'EV-COMM-MOR'],

  // 行为级：upsert 依赖索引定位（社区索引文档）+ MOR 落点语义（社区 MOR 文档）
  UPSERT_RECORDS: ['EV-COMM-INDEX', 'EV-COMM-MOR', 'EV-R26-ART-SPARK3'],

  // 行为级：删除写 tombstone 的语义由社区 MOR 文档覆盖；
  // 组件级：hudi-common 中承载 delete record / payload 的实现。
  DELETE_RECORDS: ['EV-COMM-MOR', 'EV-R26-ART-COMMON'],

  // 行为级：insert_overwrite 走 replacecommit，语义随社区写入文档
  OVERWRITE_PARTITION: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],
  OVERWRITE_TABLE: ['EV-COMM-CREATE-TABLE', 'EV-R26-ART-SPARK3'],

  // 行为级：华为《Hudi数据表Compaction规范》明确给出 compaction.delta_commits 与 run compaction 语法
  SCHEDULE_COMPACTION: ['EV-HW-RUN-COMPACTION', 'EV-COMM-MOR'],
  RUN_COMPACTION: ['EV-HW-RUN-COMPACTION', 'EV-COMM-MOR'],

  // 行为级（但有版本前提）：run clean 在华为文档中标注为 MRS 3.2.0+，
  // 3.1.x 需改用 hoodie.clean.automatic=true
  RUN_CLEAN: ['EV-HW-RUN-COMPACTION'],

  // 行为级：run archivelog 与 run compaction 同源文档
  RUN_ARCHIVE: ['EV-HW-RUN-COMPACTION'],

  // 组件级：rollback 由 hudi-common 中的 Timeline / HoodieRollback 实现，
  // 证据库暂无直接覆盖 rollback 语义的文档条目
  RUN_ROLLBACK: ['EV-R26-ART-COMMON'],

  // 组件级：clustering 由 hudi-common 的 clustering plan 实现，证据库暂无行为级条目
  RUN_CLUSTERING: ['EV-R26-ART-COMMON', 'EV-COMM-MOR'],

  // 行为级：华为《Hudi TTL 策略》文档给出 ttl_policy_save 完整语法与 level 仅支持 PARTITION 的约束
  APPLY_TTL: ['EV-HW-TTL-POLICY'],

  // 行为级：故障注入场景来自华为 Compaction 规范中「调度成功但事务未提交」等描述
  INJECT_FAILURE: ['EV-HW-RUN-COMPACTION'],

  // 重置实验不产生任何引擎行为，没有可挂靠的证据
  RESET_EXPERIMENT: [],
}

/** 取某个动作的证据 id 列表（未知动作返回空数组，绝不抛错） */
export function evidenceIdsFor(action: ActionType): string[] {
  return EVIDENCE_MAP[action] ?? []
}
