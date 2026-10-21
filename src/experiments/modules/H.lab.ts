import type { CatalogEntry } from '../catalog'

/**
 * 模块 H —— 生产故障实验室（10 条）。
 *
 * 目标：每个故障条目都遵循同一个模板：
 *   症状（用户看到什么） → 根因（问题在哪一层） → 处置动作（怎么修） → 证据缺口（哪些还没在 r26 确认）。
 *
 * ⚠️ 证据口径：
 *   - Compaction 相关的两个故障（E05 / E06）有华为 Compaction 规范直接支撑（E2）。
 *   - BUCKET 表 Bulk Insert 的失败断言（BUCKET + bulk_insert 不兼容）在社区文档中
 *     没有明确说明、r26 也未确认，因此 E03 标 E0，绝不标 E3 / E4。
 *   - Kerberos / HMS / HDFS 权限故障（E10）证据本身为 E0。
 */
export const MODULE_H_ENTRIES: CatalogEntry[] = [
  {
    id: 'E01',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['索引报错', 'bucket simple'],
    moduleId: 'H',
    title: 'BUCKET 索引写入时报 SIMPLE 错误',
    summary:
      '复现「表配置了 BUCKET 索引，写入时却按 SIMPLE 索引报错」的现象，讲清配置没生效的常见原因与逐层排查顺序。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-INDEX'],
    note: '索引语义为社区 0.15；r26 上该错误的实际类名与文案需实测确认。',
  },
  {
    id: 'E02',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['默认分区', '跨分区', '重复数据'],
    moduleId: 'H',
    title: '默认分区写入与跨分区异常',
    summary:
      '让空分区值落到默认分区后再写入同名主键，讲清同主键出现在两个分区时索引定位不到旧记录、进而产生重复数据的成因。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-CREATE-TABLE', 'EV-COMM-INDEX'],
    note: '分区清洗与索引作用域为社区 0.15 语义；r26 上的实际报错与去重行为需实测确认。',
  },
  {
    id: 'E03',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['bulk insert 失败', 'bucket'],
    moduleId: 'H',
    title: 'BUCKET 表 Bulk Insert 失败',
    summary:
      '在 BUCKET 索引表上执行 bulk_insert 并观察引擎的拦截，讲清为什么这个组合风险最高，以及正确的初始化顺序应该是什么。',
    implemented: false,
    evidenceLevel: 'E0',
    supportState: 'unverified',
    evidenceIds: ['EV-COMM-BULK-INSERT'],
    note: '「BUCKET + bulk_insert 不兼容」这一断言在社区 0.15 文档中未明确说明、r26 也未确认，属待研究场景（E0）；本项目按拦截并提示实测处理。',
  },
  {
    id: 'E04',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['schema 缺失', '元数据不完整'],
    moduleId: 'H',
    title: 'Hudi 无 Schema 或元数据不完整',
    summary:
      '构造缺字段、缺分区字段、recordkey.field 与 primaryKey 不一致的表，讲清元数据不自洽时写入为什么必须被拒绝。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-COMM-CREATE-TABLE'],
    note: '配置约束为社区 0.15 语义；r26 上具体的校验时机与报错需实测确认。',
  },
  {
    id: 'E05',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['compaction 失败', 'yarn 成功'],
    moduleId: 'H',
    title: 'Compaction 失败但 YARN 显示成功',
    summary:
      '注入「Spark 任务结束但 Hudi 事务未提交」的故障，讲清为什么调度平台显示成功而表数据没变，以及该看哪个时间点的日志来发现。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'supported',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: '「调度成功但事务未提交」场景来自华为《Hudi数据表Compaction规范》中的故障描述。',
  },
  {
    id: 'E06',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['requested', 'inflight', '残留'],
    moduleId: 'H',
    title: 'Compaction Requested / Inflight 残留',
    summary:
      '留下一个未被消费的 Compaction Plan 与一个 INFLIGHT instant，讲清残留状态如何阻塞后续 Compaction，以及应当重跑计划还是先做 Rollback。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: 'Plan 一次性消费语义来自华为规范；r26 上残留 plan 的具体文件形态与清理方式需实测确认。',
  },
  {
    id: 'E07',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['rollback 残留', '文件残留'],
    moduleId: 'H',
    title: 'Rollback Requested 文件大量残留',
    summary:
      '统计回滚前后 HDFS 上仍存在的物理文件，讲清「Timeline 已经回滚了但文件没删干净」的原因，以及该由 Clean 还是人工介入来收尾。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-R26-ART-COMMON'],
    note: '回滚语义为社区 0.15；r26 上残留文件的判定与清理路径需实测确认。',
  },
  {
    id: 'E08',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['cleaner 阻塞', 'archive 阻塞'],
    moduleId: 'H',
    title: 'Cleaner / Archive 被异常状态阻塞',
    summary:
      '制造 pending instant 让 Archive 与 Cleaner 相继停摆，讲清「表服务被谁挡住」的判断方法与排查顺序。',
    implemented: false,
    evidenceLevel: 'E1',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION', 'EV-R26-ART-COMMON'],
    note: 'Archive 语法有华为文档支撑（E2），但「pending instant 阻塞 Archive」的行为为社区 0.15 语义、r26 未实测。',
  },
  {
    id: 'E09',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['flink 积压', '资源冲突'],
    moduleId: 'H',
    title: 'Flink 写入积压与 Compaction 资源冲突',
    summary:
      '让实时写入与 Compaction 抢同一批集群资源，讲清华为规范为什么要求 Flink 只生成 Plan，并用 CPU:内存 = 1:4~1:8 的配比说明依据。',
    implemented: false,
    evidenceLevel: 'E2',
    supportState: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    note: '调度建议来自华为规范；真实积压表现与资源指标需在 r26 集群实测。',
  },
  {
    id: 'E10',
    difficulty: 'L3',
    minutes: 6,
    aliases: ['kerberos 故障', 'hms 权限'],
    moduleId: 'H',
    title: 'Kerberos、HMS、HDFS 权限故障',
    summary:
      '按认证 → HDFS 目录权限 → HMS 库表权限三段拆解典型报错，讲清每一类故障的报错特征与对应的处置动作。',
    implemented: false,
    evidenceLevel: 'E0',
    supportState: 'unverified',
    evidenceIds: ['EV-HW-KERBEROS'],
    note: 'r26 环境下的具体配置项与报错文案尚未收集到现场记录，该证据本身为 E0，属待研究场景。',
  },
]
