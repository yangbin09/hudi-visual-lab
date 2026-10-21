import type { Evidence } from '@/models/evidence'

/**
 * 华为 MRS 3.1.0-350-r26 相关证据。
 *
 * 说明：以下条目的「实际结果」均由本人在本次开发中直接访问公开来源得到，
 * 证据等级最高只到 E3（制品坐标 / 官方文档确认），**没有任何一条经过 r26 集群实测**，
 * 因此全库不存在 E4 条目。
 */
export const HUAWEI_R26_EVIDENCE: Evidence[] = [
  {
    evidenceId: 'EV-R26-ART-SPARK3',
    title: 'r26 制品 org.apache.hudi:hudi-spark3.3.x_2.12 可从华为镜像站获取',
    evidenceLevel: 'E3',
    component: 'Hudi',
    version: '0.15.0-h0.cbu.mrs.350.r26',
    sourceType: 'maven-artifact',
    artifactCoordinate: 'org.apache.hudi:hudi-spark3.3.x_2.12:0.15.0-h0.cbu.mrs.350.r26',
    documentUrl:
      'https://mirrors.huaweicloud.com/mirrors_sdk/public/org/apache/hudi/hudi-spark3.3.x_2.12/0.15.0-h0.cbu.mrs.350.r26/',
    expectedResult: '目录存在且可下载',
    actualResult: 'HTTP 200，版本目录存在',
    verifiedAt: '2026-10-21',
    environment: '华为云开源镜像站 mirrors.huaweicloud.com',
    notes: '需求 §2.1 中列举的该坐标经核实真实存在。',
  },
  {
    evidenceId: 'EV-R26-ART-SPARK3BUNDLE',
    title: 'r26 制品 org.apache.hudi:hudi-spark3-bundle_2.12 可获取',
    evidenceLevel: 'E3',
    component: 'Hudi',
    version: '0.15.0-h0.cbu.mrs.350.r26',
    sourceType: 'maven-artifact',
    artifactCoordinate: 'org.apache.hudi:hudi-spark3-bundle_2.12:0.15.0-h0.cbu.mrs.350.r26',
    documentUrl:
      'https://mirrors.huaweicloud.com/mirrors_sdk/public/org/apache/hudi/hudi-spark3-bundle_2.12/0.15.0-h0.cbu.mrs.350.r26/',
    expectedResult: '目录存在',
    actualResult: 'HTTP 200',
    verifiedAt: '2026-10-21',
    environment: '华为云开源镜像站',
  },
  {
    evidenceId: 'EV-R26-ART-SPARK-CLIENT',
    title: 'r26 制品 org.apache.hudi:hudi-spark-client 可获取',
    evidenceLevel: 'E3',
    component: 'Hudi',
    version: '0.15.0-h0.cbu.mrs.350.r26',
    sourceType: 'maven-artifact',
    artifactCoordinate: 'org.apache.hudi:hudi-spark-client:0.15.0-h0.cbu.mrs.350.r26',
    documentUrl:
      'https://mirrors.huaweicloud.com/mirrors_sdk/public/org/apache/hudi/hudi-spark-client/0.15.0-h0.cbu.mrs.350.r26/',
    expectedResult: '目录存在',
    actualResult: 'HTTP 200',
    verifiedAt: '2026-10-21',
    environment: '华为云开源镜像站',
  },
  {
    evidenceId: 'EV-R26-ART-COMMON',
    title: 'r26 制品 org.apache.hudi:hudi-common 可获取',
    evidenceLevel: 'E3',
    component: 'Hudi',
    version: '0.15.0-h0.cbu.mrs.350.r26',
    sourceType: 'maven-artifact',
    artifactCoordinate: 'org.apache.hudi:hudi-common:0.15.0-h0.cbu.mrs.350.r26',
    documentUrl:
      'https://mirrors.huaweicloud.com/mirrors_sdk/public/org/apache/hudi/hudi-common/0.15.0-h0.cbu.mrs.350.r26/',
    expectedResult: '目录存在',
    actualResult: 'HTTP 200',
    verifiedAt: '2026-10-21',
    environment: '华为云开源镜像站',
  },
  {
    evidenceId: 'EV-R26-ART-FLINK17',
    title: 'r26 制品 org.apache.hudi:hudi-flink1.17-bundle 可获取',
    evidenceLevel: 'E3',
    component: 'Hudi',
    version: '0.15.0-h0.cbu.mrs.350.r26',
    sourceType: 'maven-artifact',
    artifactCoordinate: 'org.apache.hudi:hudi-flink1.17-bundle:0.15.0-h0.cbu.mrs.350.r26',
    documentUrl:
      'https://mirrors.huaweicloud.com/mirrors_sdk/public/org/apache/hudi/hudi-flink1.17-bundle/0.15.0-h0.cbu.mrs.350.r26/',
    expectedResult: '目录存在',
    actualResult: 'HTTP 200',
    verifiedAt: '2026-10-21',
    environment: '华为云开源镜像站',
  },
  {
    evidenceId: 'EV-R26-ART-HIVESYNC',
    title: 'r26 制品 org.apache.hudi:hudi-hive-sync-bundle 可获取',
    evidenceLevel: 'E3',
    component: 'Hudi',
    version: '0.15.0-h0.cbu.mrs.350.r26',
    sourceType: 'maven-artifact',
    artifactCoordinate: 'org.apache.hudi:hudi-hive-sync-bundle:0.15.0-h0.cbu.mrs.350.r26',
    documentUrl:
      'https://mirrors.huaweicloud.com/mirrors_sdk/public/org/apache/hudi/hudi-hive-sync-bundle/0.15.0-h0.cbu.mrs.350.r26/',
    expectedResult: '目录存在',
    actualResult: 'HTTP 200',
    verifiedAt: '2026-10-21',
    environment: '华为云开源镜像站',
  },
  {
    evidenceId: 'EV-R26-ART-SPARKCOMMON-ABSENT',
    title: 'r26 未发布 org.apache.hudi:hudi-spark-common（需求文档中的该坐标在镜像站 404）',
    evidenceLevel: 'E3',
    component: 'Hudi',
    version: '0.15.0-h0.cbu.mrs.350.r26',
    sourceType: 'maven-artifact',
    artifactCoordinate: 'org.apache.hudi:hudi-spark-common:0.15.0-h0.cbu.mrs.350.r26',
    documentUrl:
      'https://mirrors.huaweicloud.com/mirrors_sdk/public/org/apache/hudi/hudi-spark-common/0.15.0-h0.cbu.mrs.350.r26/',
    expectedResult: '按需求 §2.1 应存在',
    actualResult: 'HTTP 404 —— 该版本目录下无制品，镜像站仅有 0.7.0/0.8.0 的 hw-ei 旧坐标',
    verifiedAt: '2026-10-21',
    environment: '华为云开源镜像站',
    notes:
      '这是一条「负向证据」。需求 §2.1 列出的 hudi-spark-common 坐标在 r26 下不可获取，实际应以 hudi-spark-client / hudi-spark3.3.x_2.12 为准。',
  },
  {
    evidenceId: 'EV-HW-RUN-COMPACTION',
    title: '《Hudi数据表Compaction规范》—— Spark SQL 异步维护存储过程与 Flink 只生成计划',
    evidenceLevel: 'E2',
    component: 'Hudi / Spark SQL',
    version: 'MRS 3.1.x / 3.2.x',
    sourceType: 'huawei-doc',
    documentUrl: 'https://support.huaweicloud.com/devg-rule-mrs/mrs_07_450115.html',
    testCommand: `set hoodie.compact.inline = true;
set hoodie.run.compact.only.inline = true;
set hoodie.cleaner.commits.retained = 500;
set hoodie.keep.max.commits = 700;
set hoodie.keep.min.commits = 501;
run compaction on <database>.<table>;
run archivelog on <database>.<table>;`,
    expectedResult:
      'Spark SQL 侧支持 run compaction / run archivelog；MRS 3.2.0 及之后额外支持 run clean；Flink 侧建议只生成 compaction plan，由独立 Spark 作业异步执行。',
    actualResult:
      '文档明确列出上述存储过程与配置项。Flink 侧参数：compaction.async.enabled=false、compaction.schedule.enabled=true、compaction.delta_commits=5、clean.async.enabled=false、hoodie.archive.automatic=false。建议每 2~4 小时调度一次异步 compaction，Compaction 作业 CPU:内存 = 1:4~1:8。',
    environment: '华为云文档中心（国际站/中国站）',
    verifiedAt: '2026-10-21',
    notes:
      '文档按 MRS 3.1.2.5 与 3.2.0+ 分节给出差异，目标版本 3.1.0-350-r26 的可用性仍需实测（run clean 在 3.1.x 分节中未出现）。',
  },
  {
    evidenceId: 'EV-HW-TTL-POLICY',
    title: '《Hudi TTL 策略》—— ttl_policy_save / delete / empty / show 语法',
    evidenceLevel: 'E2',
    component: 'Hudi / Spark SQL',
    version: 'MRS LTS',
    sourceType: 'huawei-doc',
    documentUrl:
      'https://support.huaweicloud.com/intl/en-us/cmpntguide-lts-mrs/mrs_01_2493061.html',
    testCommand: `call ttl_policy_save(table => 'hudi_table', spec => 'dt=2023/05/*', units => 'DAYS', value => '1', level => 'PARTITION');
call ttl_policy_show(table => 'hudi_table');
call ttl_policy_delete(table => 'hudi_table', spec => 'dt=2023/05/*');
call ttl_policy_empty(table => 'hudi_table');`,
    expectedResult:
      '可新增/更新/删除/清空/查看 TTL 策略；spec 用正则匹配分区；value 与 units 必须同时提供；level 当前仅支持 PARTITION。',
    actualResult:
      '文档原文：level 取值 PARTITION 或 RECORD，Currently, only PARTITION is supported；units 取值 YEARS / MONTHS / WEEKS / DAYS；spec 为用于筛选分区的正则表达式，可用 show partitions 查看分区格式。',
    environment: '华为云文档中心（Component Operation Guide LTS / Using Hudi）',
    verifiedAt: '2026-10-21',
    notes:
      '文档位于 LTS 指南，目标是 MRS 3.1.0-350-r26（LTS 线）。TTL 的实际触发与 ReplaceCommit 行为需进一步在 r26 实测确认。',
  },
  {
    evidenceId: 'EV-HW-KERBEROS',
    title: 'MRS Kerberos / HDFS / Hive Metastore 权限链路配置',
    evidenceLevel: 'E0',
    component: 'MRS 平台',
    version: 'MRS 3.1.0',
    sourceType: 'research-note',
    documentUrl: 'https://support.huaweicloud.com/mrs/index.html',
    openQuestion:
      '尚未收集到 r26 环境下的 keytab / principal / HDFS 目录权限 / HMS 库表权限的具体配置项，待补充现场记录。',
    notes: 'F07 实验在补齐本条证据前，只能标注为待验证。',
  } as unknown as Evidence,
]
