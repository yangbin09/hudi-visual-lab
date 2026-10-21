// ../hudi-visual-lab/src/engine/templates/scala.ts
var SCALA_TEMPLATES = [
  {
    id: "scala-df-write-upsert",
    title: "DataFrame \u5199\u5165 Hudi\uFF08upsert\uFF09",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-SPARK-CLIENT", "EV-COMM-INDEX"],
    code: `val df = spark.read.format("hudi").load("/user/hive/warehouse/hudi_demo.db/source_table")

df.write
  .format("hudi")
  .option("hoodie.datasource.write.table.type", "COPY_ON_WRITE")
  .option("hoodie.datasource.write.recordkey.field", "\${primaryKey}")
  .option("hoodie.datasource.write.precombine.field", "\${preCombineField}")
  .option("hoodie.datasource.write.partitionpath.field", "\${partitionKey}")
  .option("hoodie.datasource.write.operation", "upsert")
  .option("hoodie.index.type", "\${indexType}")
  .mode(SaveMode.Append)
  .save("\${tablePath}")`,
    note: "\u6BCF\u4E2A .option \u90FD\u4F1A\u843D\u5230 Spark SQL \u7684\u540C\u540D TBLPROPERTIES / SET \u4E0A\u3002\u6CE8\u610F\uFF1Aoption \u7684\u540D\u5B57\u5FC5\u987B\u548C r26 \u7684 configMapping \u4E00\u81F4\uFF0C\u5199\u9519\u4E0D\u4F1A\u62A5\u9519\uFF0C\u53EA\u4F1A\u9759\u9ED8\u5931\u6548\u3002"
  },
  {
    id: "scala-df-write-bulk-insert",
    title: "DataFrame \u5199\u5165 Hudi\uFF08bulk_insert\uFF09",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-COMM-BULK-INSERT", "EV-R26-ART-SPARK-CLIENT"],
    code: `df.write
  .format("hudi")
  .option("hoodie.datasource.write.table.type", "MERGE_ON_READ")
  .option("hoodie.datasource.write.recordkey.field", "\${primaryKey}")
  .option("hoodie.datasource.write.precombine.field", "\${preCombineField}")
  .option("hoodie.datasource.write.bulk_insert.enable", "true")
  .option("hoodie.datasource.write.operation", "bulk_insert")
  .mode(SaveMode.Append)
  .save("\${tablePath}")`,
    note: "bulk_insert \u8DF3\u8FC7\u67E5\u91CD\u4E0E\u5408\u5E76\uFF0C\u76F4\u63A5\u751F\u6210 base file\u3002MOR \u8868\u7528 bulk_insert \u521D\u59CB\u5316\u662F\u552F\u4E00\u300C\u4E00\u5199\u5373 parquet\u300D\u7684\u8DEF\u5F84\u3002",
    risks: ["BUCKET \u7D22\u5F15\u8868\u4E0E bulk_insert \u7684\u7EC4\u5408\u9650\u5236\u5728 r26 \u5C1A\u672A\u786E\u8BA4\u3002"]
  },
  {
    id: "scala-df-read-snapshot",
    title: "DataFrame \u5FEB\u7167\u8BFB",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `val snapshot = spark.read
  .format("hudi")
  .load("\${tablePath}")

snapshot.show(10, false)`,
    note: "\u9ED8\u8BA4\u884C\u4E3A\uFF1A\u5408\u5E76 base file \u4E0E\u5168\u90E8 log file \u7684\u5FEB\u7167\u8BFB\u3002"
  },
  {
    id: "scala-df-read-optimized",
    title: "DataFrame \u8BFB\u4F18\u5316\u8BFB",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `val readOptimized = spark.read
  .format("hudi")
  .option("hoodie.datasource.read.optimized", "true")
  .load("\${tablePath}")

readOptimized.show(10, false)`,
    note: "\u53EA\u8BFB base file\uFF0C\u5FFD\u7565 log file\u3002MOR \u8868\u5728 compaction \u4E4B\u524D\uFF0C\u6700\u65B0\u66F4\u65B0\u5728\u8FD9\u91CC\u662F\u770B\u4E0D\u5230\u7684 \u2014\u2014 \u8FD9\u662F\u300CMOR \u8868\u4E0D\u53CA\u65F6 compaction \u4F1A\u4E22\u6570\u636E\u300D\u7684\u6839\u56E0\u3002"
  },
  {
    id: "scala-df-read-incremental",
    title: "DataFrame \u589E\u91CF\u8BFB",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `val incremental = spark.read
  .format("hudi")
  .option("hoodie.datasource.read.begin.instanttime", "\${beginInstantTime}")
  .option("hoodie.datasource.read.end.instanttime", "\${endInstantTime}")
  .load("\${tablePath}")

incremental.show(10, false)`,
    note: "\u589E\u91CF\u8BFB\u8FD4\u56DE\u7A97\u53E3\u5185\u65B0\u589E/\u66F4\u65B0\u7684\u8BB0\u5F55\uFF0C\u88AB\u5220\u9664\u7684\u8BB0\u5F55\u4EE5 operation=DELETE \u7684\u5F62\u5F0F\u8FD4\u56DE\u3002\u6D88\u8D39\u7AEF\u5FC5\u987B\u5904\u7406\u5220\u9664\u8BED\u4E49\uFF0C\u5426\u5219\u4F1A\u6F0F\u5220\u3002"
  },
  {
    id: "scala-df-read-time-travel",
    title: "DataFrame \u65F6\u95F4\u65C5\u884C\u8BFB",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `val asOf = spark.read
  .format("hudi")
  .option("hoodie.datasource.read.as.of.instant", "\${asOfInstant}")
  .load("\${tablePath}")

asOf.show(10, false)`,
    note: "\u8BFB\u53D6 as.of.instant \u63D0\u4EA4\u5B8C\u6210\u540E\u7684\u5FEB\u7167\uFF1B\u8BE5 instant \u88AB\u5F52\u6863\u5E76\u6E05\u7406\u5386\u53F2\u540E\u5373\u4E0D\u53EF\u7528\u3002"
  },
  {
    id: "scala-metaclient-rollback",
    title: "\u56DE\u6EDA\u672A\u5B8C\u6210\u7684\u4E8B\u52A1\uFF08MetaClient API\uFF09",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-COMMON"],
    code: `import org.apache.hudi.common.table.HoodieTableMetaClient
import org.apache.hudi.common.config.HoodieConfig

val hadoopConf = spark.sparkContext.hadoopConfiguration
val metaClient = HoodieTableMetaClient
  .builder()
  .setConf(hadoopConf)
  .setBasePath("\${tablePath}")
  .build()

// \u56DE\u6EDA\u6307\u5B9A\u7684\u672A\u5B8C\u6210 instant\uFF08partial = true \u8868\u793A\u53EA\u56DE\u6EDA\u8BE5 instant \u7684\u6587\u4EF6\uFF09
metaClient.rollback("\${beginInstantTime}", true)`,
    note: "Rollback \u53EA\u80FD\u5904\u7406**\u672A\u5B8C\u6210**\u7684\u4E8B\u52A1\uFF1A\u5DF2\u63D0\u4EA4\u7684 instant \u8981\u7528 restore / \u65F6\u95F4\u65C5\u884C\u56DE\u770B\uFF0C\u4E0D\u80FD rollback\u3002Spark SQL \u6CA1\u6709 rollback \u5B58\u50A8\u8FC7\u7A0B\uFF0C\u53EA\u80FD\u8D70 Scala API \u6216 hoodie-cli\u3002",
    risks: [
      "r26 \u4FA7 HoodieTableMetaClient.rollback \u7684\u65B9\u6CD5\u7B7E\u540D\u9700\u4EE5 r26 \u6E90\u7801\u786E\u8BA4\uFF1B\u672C\u9879\u76EE\u7684 rollback \u5B9E\u9A8C\u4EE5 hoodie-cli \u65B9\u5F0F\u4E3A\u51C6\uFF08\u89C1 shell \u6A21\u677F\uFF09\u3002"
    ]
  },
  {
    id: "scala-metaclient-list-instants",
    title: "\u67E5\u770B Timeline\uFF08MetaClient API\uFF09",
    language: "scala",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-COMMON"],
    code: `import org.apache.hudi.common.table.HoodieTableMetaClient

val metaClient = HoodieTableMetaClient
  .builder()
  .setConf(spark.sparkContext.hadoopConfiguration)
  .setBasePath("\${tablePath}")
  .build()

// \u6D3B\u8DC3 Timeline\uFF1A\u5224\u65AD compaction \u6210\u8D25\u5C31\u770B\u8FD9\u91CC\u6709\u6CA1\u6709 state=COMPLETED \u7684 compaction instant
metaClient.getActiveTimeline
  .getInstants()
  .forEach(i => println(i.getTimestamp + "  " + i.getAction + "  " + i.getState))`,
    note: "\u6392\u67E5 compaction \u95EE\u9898\u7684\u7B2C\u4E00\u7AD9\uFF1A\u4E0D\u8981\u770B YARN \u72B6\u6001\uFF0C\u8981\u770B Timeline \u4E0A\u6709\u6CA1\u6709 completed \u7684 compaction instant\u3002YARN \u663E\u793A SUCCEEDED \u4F46 Hudi \u4E8B\u52A1\u672A\u63D0\u4EA4\u7684\u60C5\u51B5\u771F\u5B9E\u5B58\u5728\u3002"
  }
];
export {
  SCALA_TEMPLATES
};
