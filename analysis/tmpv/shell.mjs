// ../hudi-visual-lab/src/engine/templates/shell.ts
var SHELL_TEMPLATES = [
  {
    id: "shell-hdfs-ls",
    title: "\u67E5\u770B Hudi \u8868\u7684\u7269\u7406\u76EE\u5F55",
    language: "shell",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-COMMON"],
    code: `# \u8868\u6839\u76EE\u5F55\uFF1A.hoodie \u653E\u5143\u6570\u636E\uFF0C\u5404\u5206\u533A\u76EE\u5F55\u653E\u6570\u636E\u6587\u4EF6
hdfs dfs -ls -R \${tablePath}

# \u53EA\u770B\u6570\u636E\u6587\u4EF6\uFF08\u6392\u9664 .hoodie\uFF09
hdfs dfs -ls -R \${tablePath} | grep -v '/.hoodie/'`,
    note: "Hudi \u7684\u6570\u636E\u6587\u4EF6\u4E0E\u5143\u6570\u636E\u6587\u4EF6\u662F\u5206\u5F00\u7684\uFF1A\u6570\u636E\u6587\u4EF6\u5728\u5206\u533A\u76EE\u5F55\u91CC\uFF0C\u5143\u6570\u636E\uFF08timeline\u3001plan\u3001\u5F52\u6863\uFF09\u90FD\u5728 .hoodie \u76EE\u5F55\u4E0B\u3002\u6392\u67E5\u300C\u6587\u4EF6\u4E3A\u4EC0\u4E48\u8FD8\u5728\u300D\u65F6\u5148\u786E\u8BA4\u5B83\u662F\u5426\u5DF2\u88AB Clean \u771F\u6B63\u5220\u9664\u3002"
  },
  {
    id: "shell-hudi-cli-table-info",
    title: "\u67E5\u770B\u8868\u4FE1\u606F\uFF08hoodie-cli\uFF09",
    language: "shell",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-COMMON"],
    code: `# hudi-cli.sh \u5728 MRS \u4E0A\u901A\u5E38\u4F4D\u4E8E $HADOOP_HOME/hudi/bin \u6216 /opt/hudi/bin
hudi-cli.sh table-info --path \${tablePath}

# \u5217\u51FA\u5206\u533A
hudi-cli.sh partitions --path \${tablePath}`,
    note: "table-info \u4F1A\u6253\u5370\u8868\u7684 schema\u3001partition\u3001record key\u3001precombine field \u4E0E Timeline \u6982\u51B5\u3002",
    risks: ["hoodie-cli \u5728 r26 \u73AF\u5883\u4E2D\u7684\u5B89\u88C5\u8DEF\u5F84\u4E0E\u547D\u4EE4\u540D\u9700\u5B9E\u6D4B\u786E\u8BA4\u3002"]
  },
  {
    id: "shell-hudi-cli-compaction",
    title: "hoodie-cli \u751F\u6210\u5E76\u6267\u884C Compaction Plan",
    language: "shell",
    status: "unverified",
    evidenceIds: ["EV-HW-RUN-COMPACTION", "EV-R26-ART-COMMON"],
    code: `# \u751F\u6210 plan
hudi-cli.sh compaction plan --path \${tablePath}

# \u6267\u884C plan
hudi-cli.sh compaction run --path \${tablePath}

# \u53D6\u6D88\u5C1A\u672A\u6267\u884C\u7684 plan
hudi-cli.sh compaction unschedule --path \${tablePath}`,
    note: "plan \u662F\u4E00\u6B21\u6027\u8D44\u6E90\uFF1A\u88AB\u6D88\u8D39\u4E4B\u540E\u518D\u6B21\u89E6\u53D1\u540C\u4E00\u4E2A plan \u4E0D\u4F1A\u6709\u4EFB\u4F55\u6548\u679C\uFF08stale plan\uFF09\u3002\u8FD9\u6B63\u662F\u300C\u8C03\u5EA6\u91CD\u590D\u89E6\u53D1\u300D\u7C7B\u6545\u969C\u7684\u6839\u56E0\u3002",
    risks: ["r26 \u7684 hoodie-cli \u5B50\u547D\u4EE4\u540D\uFF08compaction plan/run\uFF09\u9700\u5B9E\u6D4B\u786E\u8BA4\u3002"]
  },
  {
    id: "shell-hudi-cli-rollback",
    title: "hoodie-cli \u56DE\u6EDA\u672A\u5B8C\u6210\u7684 instant",
    language: "shell",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-COMMON"],
    code: `# \u56DE\u6EDA\u6307\u5B9A\u7684\u672A\u5B8C\u6210 instant
hudi-cli.sh rollback --commit \${beginInstantTime} --path \${tablePath}`,
    note: "\u56DE\u6EDA\u4F1A\u5220\u9664\u8BE5 instant \u4EA7\u751F\u7684\u6B8B\u7559\u6587\u4EF6\uFF0C\u5E76\u5199\u5165 rollback instant \u8BA9 Timeline \u91CD\u65B0\u81EA\u6D3D\u3002\u6CE8\u610F\u4E0D\u8981\u624B\u5DE5\u5220\u9664 .hoodie \u76EE\u5F55\u4E0B\u7684\u5143\u6570\u636E\u6587\u4EF6\u3002",
    risks: ["r26 \u7684 hoodie-cli rollback \u53C2\u6570\u540D\u9700\u5B9E\u6D4B\u786E\u8BA4\u3002"]
  },
  {
    id: "shell-spark-sql-compaction-plan",
    title: "\u5F02\u6B65 Compaction \u7B2C\u4E00\u6B65\uFF1A\u751F\u6210 Plan\uFF08Spark SQL \u4F5C\u4E1A\uFF09",
    language: "shell",
    status: "verified",
    evidenceIds: ["EV-HW-RUN-COMPACTION"],
    code: `# \${sqlFilePath} \u5185\u5BB9\uFF1A
#   SET hoodie.compact.inline = true;
#   SET hoodie.run.compact.only.inline = true;
#   RUN COMPACTION ON \${database}.\${table};

spark-sql --master yarn --deploy-mode cluster \\
  --conf spark.executor.cores=\${executorCores} \\
  --conf spark.executor.memory=\${executorMemory} \\
  --conf spark.executor.instances=\${executorInstances} \\
  -f \${sqlFilePath}`,
    note: "\u8FD9\u4E00\u6B65\u53EA\u5199\u51FA compaction plan\uFF0C\u4E0D\u52A8\u6570\u636E\u6587\u4EF6\u3002\u534E\u4E3A\u89C4\u8303\u5EFA\u8BAE\u6BCF 2~4 \u5C0F\u65F6\u8C03\u5EA6\u4E00\u6B21\uFF0CCompaction \u4F5C\u4E1A CPU:\u5185\u5B58 = 1:4 ~ 1:8\u3002"
  },
  {
    id: "shell-spark-submit-compaction",
    title: "\u5F02\u6B65 Compaction \u7B2C\u4E8C\u6B65\uFF1A\u72EC\u7ACB Spark \u4F5C\u4E1A\u6267\u884C Plan",
    language: "shell",
    status: "conditional",
    evidenceIds: ["EV-HW-RUN-COMPACTION", "EV-R26-ART-SPARK3BUNDLE"],
    code: `# \u7531\u72EC\u7ACB Spark \u4F5C\u4E1A\u6D88\u8D39\u5E76\u6267\u884C plan\uFF08\u534E\u4E3A\u89C4\u8303\uFF1ACPU:\u5185\u5B58 = 1:4 ~ 1:8\uFF09
spark-submit --master yarn --deploy-mode cluster \\
  --conf spark.executor.cores=\${executorCores} \\
  --conf spark.executor.memory=\${executorMemory} \\
  --conf spark.executor.instances=\${executorInstances} \\
  --conf spark.executor.memoryOverhead=2g \\
  --class <\u5F02\u6B65 Compaction \u5165\u53E3\u7C7B> \\
  \${jarPath} \\
  --table \${database}.\${table}`,
    note: "\u89C4\u8303\u5EFA\u8BAE\u6BCF 2~4 \u5C0F\u65F6\u8C03\u5EA6\u4E00\u6B21\u5F02\u6B65 compaction\uFF0C\u5E76\u628A compaction \u4F5C\u4E1A\u7684 CPU:\u5185\u5B58\u63A7\u5236\u5728 1:4 ~ 1:8\u3002\u8FD9\u6837 Flink / Spark \u7684\u5B9E\u65F6\u5199\u5165\u94FE\u8DEF\u5C31\u4E0D\u4F1A\u88AB compaction \u62D6\u4F4F\u3002",
    prerequisites: [
      "\u5DF2\u901A\u8FC7\u300C\u751F\u6210 Plan\u300D\u6B65\u9AA4\u4EA7\u51FA .hoodie \u4E0B\u7684 compaction plan \u6587\u4EF6",
      "r26 \u53D1\u884C\u5305\u4E2D\u5DF2\u5305\u542B\u5F02\u6B65 compaction \u7684\u4F5C\u4E1A\u5165\u53E3\uFF08<\u5F02\u6B65 Compaction \u5165\u53E3\u7C7B> \u9700\u4EE5 r26 \u5B9E\u9645\u7C7B\u540D\u66FF\u6362\uFF09"
    ],
    risks: [
      "\u5F02\u6B65 compaction \u4F5C\u4E1A\u7684\u5165\u53E3\u7C7B\u540D\u4E0E\u53C2\u6570\u5728\u534E\u4E3A\u6587\u6863\u4E2D\u672A\u7ED9\u51FA\uFF0C\u5FC5\u987B\u4EE5 r26 \u5B9E\u9645\u53D1\u884C\u5305\u4E3A\u51C6\uFF0C\u4E0D\u80FD\u7167\u6284\u793E\u533A 0.15 \u7684\u7C7B\u540D\u3002"
    ]
  },
  {
    id: "shell-kinit-kerberos",
    title: "Kerberos \u8BA4\u8BC1\uFF08\u4F5C\u4E1A\u63D0\u4EA4\u524D\uFF09",
    language: "shell",
    status: "unverified",
    evidenceIds: ["EV-HW-KERBEROS"],
    code: `# \u7528 keytab \u767B\u5F55 HDFS / Hive Metastore
kinit -kt \${keytabPath} \${principal}

# \u9A8C\u8BC1\u7968\u636E
klist

# \u76EE\u5F55\u6743\u9650\u786E\u8BA4\uFF08HDFS\uFF09
hdfs dfs -ls /user/hive/warehouse/\${database}.db`,
    note: "MRS \u96C6\u7FA4\u9ED8\u8BA4\u5F00\u542F Kerberos\uFF1AHDFS \u8BFB\u5199\u4E0E Hive Metastore \u5EFA\u8868\u90FD\u9700\u8981\u6709\u6548\u7968\u636E\uFF0C\u5426\u5219\u4F5C\u4E1A\u4F1A\u5728\u63D0\u4EA4\u9636\u6BB5\u5C31\u5931\u8D25\uFF0C\u800C\u4E0D\u662F\u5728 Hudi \u5C42\u62A5\u9519\u3002",
    risks: ["MRS 3.1.0 \u73AF\u5883\u4E0B keytab / principal / \u76EE\u5F55\u6743\u9650\u7684\u5177\u4F53\u914D\u7F6E\u9879\u5F85\u8865\u5145\u73B0\u573A\u8BB0\u5F55\uFF08\u8BE5\u8BC1\u636E\u5F53\u524D\u4E3A E0\uFF09\u3002"]
  },
  {
    id: "shell-hive-sync",
    title: "\u540C\u6B65\u8868\u7ED3\u6784\u5230 Hive Metastore",
    language: "shell",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-HIVESYNC"],
    code: `# Hudi \u2192 Hive \u540C\u6B65\u5DE5\u5177\uFF08hudi-hive-sync-bundle \u5DF2\u5728 r26 \u5236\u54C1\u4E2D\u786E\u8BA4\u5B58\u5728\uFF09
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
    note: "Hudi \u8868\u5EFA\u5728 HDFS \u4E0A\uFF0C\u5143\u6570\u636E\u5728 Hive Metastore \u91CC\u9700\u8981\u663E\u5F0F\u540C\u6B65\uFF0C\u5426\u5219 Hive \u4FA7\u770B\u4E0D\u5230\u8FD9\u5F20\u8868\u3002\u540C\u6B65\u4E4B\u540E Hive \u624D\u80FD\u6309\u5206\u533A\u5217\u5BF9 Hudi \u8868\u505A\u4F18\u5316\u3002",
    risks: ["\u540C\u6B65\u5DE5\u5177\u7684\u5165\u53E3\u7C7B\u540D\u4E0E\u53C2\u6570\u9700\u4EE5 r26 \u5B9E\u9645\u53D1\u884C\u5305\u786E\u8BA4\u3002"]
  }
];
export {
  SHELL_TEMPLATES
};
