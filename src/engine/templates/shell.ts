import type { SqlBlock } from './types'

/**
 * Shell / 运维命令模板集。
 *
 * 这些命令是「出了 Spark SQL 之外还要做什么」的答案：
 * 看目录、跑异步 compaction、回滚事务、配 Kerberos、同步 Hive Metastore。
 */
export const SHELL_TEMPLATES: SqlBlock[] = [
  {
    id: 'shell-hdfs-ls',
    title: '查看 Hudi 表的物理目录',
    language: 'shell',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-COMMON'],
    code: `# 表根目录：.hoodie 放元数据，各分区目录放数据文件
hdfs dfs -ls -R \${tablePath}

# 只看数据文件（排除 .hoodie）
hdfs dfs -ls -R \${tablePath} | grep -v '/.hoodie/'`,
    note:
      'Hudi 的数据文件与元数据文件是分开的：数据文件在分区目录里，' +
      '元数据（timeline、plan、归档）都在 .hoodie 目录下。' +
      '排查「文件为什么还在」时先确认它是否已被 Clean 真正删除。',
  },
  {
    id: 'shell-hudi-cli-table-info',
    title: '查看表信息（hoodie-cli）',
    language: 'shell',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-COMMON'],
    code: `# hudi-cli.sh 在 MRS 上通常位于 $HADOOP_HOME/hudi/bin 或 /opt/hudi/bin
hudi-cli.sh table-info --path \${tablePath}

# 列出分区
hudi-cli.sh partitions --path \${tablePath}`,
    note: 'table-info 会打印表的 schema、partition、record key、precombine field 与 Timeline 概况。',
    risks: ['hoodie-cli 在 r26 环境中的安装路径与命令名需实测确认。'],
  },
  {
    id: 'shell-hudi-cli-compaction',
    title: 'hoodie-cli 生成并执行 Compaction Plan',
    language: 'shell',
    status: 'unverified',
    evidenceIds: ['EV-HW-RUN-COMPACTION', 'EV-R26-ART-COMMON'],
    code: `# 生成 plan
hudi-cli.sh compaction plan --path \${tablePath}

# 执行 plan
hudi-cli.sh compaction run --path \${tablePath}

# 取消尚未执行的 plan
hudi-cli.sh compaction unschedule --path \${tablePath}`,
    note:
      'plan 是一次性资源：被消费之后再次触发同一个 plan 不会有任何效果（stale plan）。' +
      '这正是「调度重复触发」类故障的根因。',
    risks: ['r26 的 hoodie-cli 子命令名（compaction plan/run）需实测确认。'],
  },
  {
    id: 'shell-hudi-cli-rollback',
    title: 'hoodie-cli 回滚未完成的 instant',
    language: 'shell',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-COMMON'],
    code: `# 回滚指定的未完成 instant
hudi-cli.sh rollback --commit \${beginInstantTime} --path \${tablePath}`,
    note:
      '回滚会删除该 instant 产生的残留文件，并写入 rollback instant 让 Timeline 重新自洽。' +
      '注意不要手工删除 .hoodie 目录下的元数据文件。',
    risks: ['r26 的 hoodie-cli rollback 参数名需实测确认。'],
  },
  {
    id: 'shell-spark-sql-compaction-plan',
    title: '异步 Compaction 第一步：生成 Plan（Spark SQL 作业）',
    language: 'shell',
    status: 'verified',
    evidenceIds: ['EV-HW-RUN-COMPACTION'],
    code: `# \${sqlFilePath} 内容：
#   SET hoodie.compact.inline = true;
#   SET hoodie.run.compact.only.inline = true;
#   RUN COMPACTION ON \${database}.\${table};

spark-sql --master yarn --deploy-mode cluster \\
  --conf spark.executor.cores=\${executorCores} \\
  --conf spark.executor.memory=\${executorMemory} \\
  --conf spark.executor.instances=\${executorInstances} \\
  -f \${sqlFilePath}`,
    note:
      '这一步只写出 compaction plan，不动数据文件。' +
      '华为规范建议每 2~4 小时调度一次，Compaction 作业 CPU:内存 = 1:4 ~ 1:8。',
  },
  {
    id: 'shell-spark-submit-compaction',
    title: '异步 Compaction 第二步：独立 Spark 作业执行 Plan',
    language: 'shell',
    status: 'conditional',
    evidenceIds: ['EV-HW-RUN-COMPACTION', 'EV-R26-ART-SPARK3BUNDLE'],
    code: `# 由独立 Spark 作业消费并执行 plan（华为规范：CPU:内存 = 1:4 ~ 1:8）
spark-submit --master yarn --deploy-mode cluster \\
  --conf spark.executor.cores=\${executorCores} \\
  --conf spark.executor.memory=\${executorMemory} \\
  --conf spark.executor.instances=\${executorInstances} \\
  --conf spark.executor.memoryOverhead=2g \\
  --class <异步 Compaction 入口类> \\
  \${jarPath} \\
  --table \${database}.\${table}`,
    note:
      '规范建议每 2~4 小时调度一次异步 compaction，并把 compaction 作业的 CPU:内存控制在 1:4 ~ 1:8。' +
      '这样 Flink / Spark 的实时写入链路就不会被 compaction 拖住。',
    prerequisites: [
      '已通过「生成 Plan」步骤产出 .hoodie 下的 compaction plan 文件',
      'r26 发行包中已包含异步 compaction 的作业入口（<异步 Compaction 入口类> 需以 r26 实际类名替换）',
    ],
    risks: [
      '异步 compaction 作业的入口类名与参数在华为文档中未给出，必须以 r26 实际发行包为准，' +
        '不能照抄社区 0.15 的类名。',
    ],
  },
  {
    id: 'shell-kinit-kerberos',
    title: 'Kerberos 认证（作业提交前）',
    language: 'shell',
    status: 'unverified',
    evidenceIds: ['EV-HW-KERBEROS'],
    code: `# 用 keytab 登录 HDFS / Hive Metastore
kinit -kt \${keytabPath} \${principal}

# 验证票据
klist

# 目录权限确认（HDFS）
hdfs dfs -ls /user/hive/warehouse/\${database}.db`,
    note:
      'MRS 集群默认开启 Kerberos：HDFS 读写与 Hive Metastore 建表都需要有效票据，' +
      '否则作业会在提交阶段就失败，而不是在 Hudi 层报错。',
    risks: ['MRS 3.1.0 环境下 keytab / principal / 目录权限的具体配置项待补充现场记录（该证据当前为 E0）。'],
  },
  {
    id: 'shell-hive-sync',
    title: '同步表结构到 Hive Metastore',
    language: 'shell',
    status: 'unverified',
    evidenceIds: ['EV-R26-ART-HIVESYNC'],
    code: `# Hudi → Hive 同步工具（hudi-hive-sync-bundle 已在 r26 制品中确认存在）
spark-submit --master yarn --deploy-mode cluster \\
  --conf spark.executor.cores=\${executorCores} \\
  --conf spark.executor.memory=\${executorMemory} \\
  --class org.apache.hudi.sync.tool.HoodieSyncTool \\
  \${jarPath} \\
  --table \${database}.\${table} \\
  --database \${database} \\
  --target-table \${table} \\
  --base-path \${tablePath} \\
  --parallelism 1`,
    note:
      'Hudi 表建在 HDFS 上，元数据在 Hive Metastore 里需要显式同步，否则 Hive 侧看不到这张表。' +
      '同步之后 Hive 才能按分区列对 Hudi 表做优化。',
    risks: ['同步工具的入口类名与参数需以 r26 实际发行包确认。'],
  },
]
