// 给 modules/*.ts 的 80 条目录条目补 difficulty / minutes / aliases（一次性注入脚本）
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/modules'
const FILES = ['A.basics.ts', 'B.ddl.ts', 'C.write.ts', 'D.index.ts', 'E.query.ts', 'F.services.ts', 'G.integration.ts', 'H.lab.ts', 'I.advanced.ts']

const L1 = new Set(['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10'])
const L2 = new Set(['I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08'])
const FIVE_STEPS = new Set(['B04', 'B05', 'S01'])

const A = {
  B01: ['普通 parquet 表', 'hive 表区别'],
  B02: ['cow', 'copy on write', '写时复制'],
  B03: ['mor', 'merge on read', '读时合并'],
  B04: ['文件组', 'file group', 'file slice', 'file id'],
  B05: ['base file', 'log file', '文件版本'],
  B06: ['主键', 'record key', 'hoodiekey', '分区路径'],
  B07: ['mvcc', '快照可见性', 'snapshot'],
  B08: ['.hoodie', '目录结构', 'hdfs'],
  T01: ['建表', 'create table', 'cow', 'mor'],
  T02: ['主键', 'precombine', '预合并'],
  T03: ['分区', '多级分区', 'partition'],
  T04: ['默认分区', 'null 分区', '异常分区'],
  T05: ['hive style', '分区列', 'partitioning'],
  T06: ['hms', 'hive metastore', 'hive sync'],
  T07: ['hoodie.properties', '表配置'],
  T08: ['schema 演进', '加列', '删列'],
  W01: ['insert', '插入'],
  W02: ['upsert', '更新'],
  W03: ['delete', '删除', 'tombstone'],
  W04: ['bulk insert', '初始化'],
  W05: ['insert overwrite', '分区覆盖'],
  W06: ['overwrite table', '整表覆盖'],
  W07: ['savemode', 'append', 'overwrite'],
  W08: ['precombine', '主键冲突', '多版本'],
  W09: ['spark sql', 'dataframe'],
  W10: ['幂等', '重复写入'],
  I01: ['simple 索引', '索引定位'],
  I02: ['bloom', '布隆', '索引'],
  I03: ['bucket', '桶', '分桶', '哈希'],
  I04: ['分区桶', 'bucket 分区'],
  I05: ['桶数', 'file group 分配'],
  I06: ['global 索引', '全局索引'],
  I07: ['兼容性', '索引矩阵'],
  I08: ['索引异常', '排查'],
  Q01: ['snapshot', '快照读'],
  Q02: ['read optimized', '读优化'],
  Q03: ['incremental', '增量读'],
  Q04: ['time travel', '时间旅行', 'as.of.instant'],
  Q05: ['cow mor 查询', '可见性'],
  Q06: ['分区裁剪', '扫描文件'],
  Q07: ['_hoodie_', '元字段'],
  Q08: ['cdc', '增量消费'],
  S01: ['timeline', 'instant', '生命周期'],
  S02: ['commit', 'delta commit'],
  S03: ['compaction plan', '计划'],
  S04: ['compaction', '合并'],
  S05: ['异步 compaction', '调度'],
  S06: ['clean', '清理', '保留窗口'],
  S07: ['archive', '归档', 'archivelog'],
  S08: ['rollback', '回滚'],
  S09: ['restore', '恢复'],
  S10: ['clustering', '聚类', 'replacecommit'],
  S11: ['ttl', '过期'],
  S12: ['pending', '未完成', '文件引用'],
  F01: ['spark sql', '建表写入'],
  F02: ['scala', 'dataframe'],
  F03: ['flink', '实时写入'],
  F04: ['checkpoint', 'flink 提交'],
  F05: ['flink compaction', '异步'],
  F06: ['并行度', 'bucket'],
  F07: ['kerberos', '权限', 'keytab'],
  F08: ['spark flink 兼容'],
  E01: ['索引报错', 'bucket simple'],
  E02: ['默认分区', '跨分区', '重复数据'],
  E03: ['bulk insert 失败', 'bucket'],
  E04: ['schema 缺失', '元数据不完整'],
  E05: ['compaction 失败', 'yarn 成功'],
  E06: ['requested', 'inflight', '残留'],
  E07: ['rollback 残留', '文件残留'],
  E08: ['cleaner 阻塞', 'archive 阻塞'],
  E09: ['flink 积压', '资源冲突'],
  E10: ['kerberos 故障', 'hms 权限'],
  A01: ['小文件', '文件大小'],
  A02: ['数据倾斜', 'bucket 倾斜'],
  A03: ['metadata table', '元数据表'],
  A04: ['并发控制', 'occ', '锁'],
  A05: ['compaction 吞吐', '策略'],
  A06: ['cleaner 保留', '存储成本'],
  A07: ['timeline 规模', '归档性能'],
  A08: ['健康检查', '维护'],
}

const ALL_IDS = [...L1, ...L2, ...Object.keys(A).filter(id => !L1.has(id) && !L2.has(id))]
let injected = 0
for (const file of FILES) {
  const path = `${DIR}/${file}`
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const out = []
  for (const line of lines) {
    out.push(line)
    const m = line.match(/^\s+id: '([A-Z]\d{2})',$/)
    if (!m) continue
    const id = m[1]
    const difficulty = L1.has(id) ? 'L1' : L2.has(id) ? 'L2' : 'L3'
    const minutes = FIVE_STEPS.has(id) ? 7 : difficulty === 'L3' ? 6 : difficulty === 'L2' ? 5 : 4
    const aliases = A[id]
    if (!aliases) throw new Error(`缺少 aliases: ${id}`)
    out.push(`    difficulty: '${difficulty}',`)
    out.push(`    minutes: ${minutes},`)
    out.push(`    aliases: [${aliases.map(a => `'${a.replace(/'/g, "\\'")}'`).join(', ')}],`)
    injected++
  }
  writeFileSync(path, out.join('\n'), 'utf8')
}
const expected = 80
if (injected !== expected) throw new Error(`注入条目数 ${injected} != ${expected}`)
console.log(`OK: ${injected} 条目录条目已补 difficulty / minutes / aliases`)
