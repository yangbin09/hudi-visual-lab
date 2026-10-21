import type { Evidence } from '@/models/evidence'

/**
 * Apache Hudi 0.15.0 社区文档证据（E1）。
 * 注意：社区 0.15 支持 ≠ 华为 r26 支持，涉及 r26 行为时必须再叠加 E2/E3 证据。
 */
export const COMMUNITY_EVIDENCE: Evidence[] = [
  {
    evidenceId: 'EV-COMM-CREATE-TABLE',
    title: 'Hudi 0.15.0 Spark 快速开始：CREATE TABLE USING hudi 与 TBLPROPERTIES',
    evidenceLevel: 'E1',
    component: 'Hudi',
    version: '0.15.0',
    sourceType: 'community-doc',
    documentUrl: 'https://hudi.apache.org/docs/0.15.0/spark-quick-start-guide/',
    expectedResult:
      '支持 CREATE TABLE ... USING hudi，并通过 TBLPROPERTIES 指定 type / primaryKey / preCombineField / partitionKey 等。',
    actualResult:
      '社区文档给出完整示例：type=cow/mor、primaryKey、preCombineField、partitionKey、hoodie.datasource.write.recordkey.field 等。',
    verifiedAt: '2026-10-21',
  },
  {
    evidenceId: 'EV-COMM-INDEX',
    title: 'Hudi 0.15.0 索引机制：SIMPLE / BLOOM / BUCKET / GLOBAL',
    evidenceLevel: 'E1',
    component: 'Hudi',
    version: '0.15.0',
    sourceType: 'community-doc',
    documentUrl: 'https://hudi.apache.org/docs/0.15.0/indexes/',
    expectedResult:
      'hoodie.index.type 支持 SIMPLE、BLOOM、GLOBAL_SIMPLE、GLOBAL_BLOOM；0.14+ 引入 BUCKET 索引用于高效 upsert。',
    actualResult:
      '社区文档列出各索引类型定位文件的方式；BUCKET 索引按 record key 哈希分桶，文件组固定分配。',
    verifiedAt: '2026-10-21',
    notes: '分桶哈希算法本身需以 r26 源码为准，社区文档未给出算法细节。',
  },
  {
    evidenceId: 'EV-COMM-BULK-INSERT',
    title: 'Hudi 0.15.0 Bulk Insert 语义',
    evidenceLevel: 'E1',
    component: 'Hudi',
    version: '0.15.0',
    sourceType: 'community-doc',
    documentUrl: 'https://hudi.apache.org/docs/0.15.0/writing_data/',
    expectedResult:
      'bulk_insert 直接生成新的 base file，不做合并去重，适合初始化场景；与索引类型的组合限制需实测。',
    actualResult:
      '社区文档说明 bulk_insert 行为；与 BUCKET 索引的组合限制社区文档未明确说明。',
    verifiedAt: '2026-10-21',
  },
  {
    evidenceId: 'EV-COMM-METADATA-TABLE',
    title: 'Hudi 0.15.0 Metadata Table',
    evidenceLevel: 'E1',
    component: 'Hudi',
    version: '0.15.0',
    sourceType: 'community-doc',
    documentUrl: 'https://hudi.apache.org/docs/0.15.0/metadata_table/',
    expectedResult: '提供 listing/files 等元数据表加速文件列举。',
    actualResult: '社区文档描述 metadata table 的用途与开关（hoodie.metadata.enable）。',
    verifiedAt: '2026-10-21',
  },
  {
    evidenceId: 'EV-COMM-MOR',
    title: 'Hudi 0.15.0 Merge On Read 与 Compaction',
    evidenceLevel: 'E1',
    component: 'Hudi',
    version: '0.15.0',
    sourceType: 'community-doc',
    documentUrl: 'https://hudi.apache.org/docs/0.15.0/performance_queries/',
    expectedResult:
      'MOR 表更新写为 log file，查询时与 base file 合并；compaction 将 log 合并为新的 parquet base file。',
    actualResult: '社区文档说明读优化查询与 compaction 语义。',
    verifiedAt: '2026-10-21',
  },
]
