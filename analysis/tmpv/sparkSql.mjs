// ../hudi-visual-lab/src/engine/templates/sparkSql.ts
var SPARK_SQL_TEMPLATES = [
  /* ------------------------------ 建表 ------------------------------ */
  {
    id: "spark-create-table-cow",
    title: "\u521B\u5EFA COW \u8868\uFF08Spark SQL\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-CREATE-TABLE", "EV-R26-ART-SPARK3"],
    code: `CREATE TABLE IF NOT EXISTS \${database}.\${table} (
  \${primaryKey}      STRING,
  \${preCombineField} BIGINT,
  name  STRING,
  amount DOUBLE
)
USING hudi
TBLPROPERTIES (
  'type' = 'cow',
  'primaryKey' = '\${primaryKey}',
  'preCombineField' = '\${preCombineField}',
  'partitionKey' = '\${partitionKey}',
  'hoodie.datasource.write.recordkey.field' = '\${primaryKey}',
  'hoodie.datasource.write.precombine.field' = '\${preCombineField}',
  'hoodie.datasource.write.partitionpath.field' = '\${partitionKey}',
  'hoodie.datasource.write.table.type' = 'COPY_ON_WRITE',
  'hoodie.datasource.write.operation' = 'upsert',
  'hoodie.datasource.write.hive_style_partitioning' = 'true',
  'hoodie.index.type' = '\${indexType}'
);`,
    note: "type=cow \u51B3\u5B9A\u540E\u7EED\u6BCF\u6B21\u5199\u5165\u90FD\u91CD\u5199\u6574\u4E2A parquet \u6587\u4EF6\uFF08\u5199\u653E\u5927\uFF09\u3002\u975E\u5206\u533A\u8868\u8BF7\u5220\u9664 partitionKey / partitionpath.field \u4E24\u9879\uFF0C\u5E76\u628A\u5206\u533A\u5217\u5E76\u5165\u4E0A\u9762\u7684\u5217\u5B9A\u4E49\u3002recordkey.field \u4E0E primaryKey \u5FC5\u987B\u4E00\u81F4\uFF0C\u5426\u5219\u7D22\u5F15\u65E0\u6CD5\u5B9A\u4F4D\u8BB0\u5F55\u3002",
    risks: ["\u793E\u533A 0.15 \u6587\u6863\u7ED9\u51FA\u4E86\u8BE5\u8BED\u6CD5\uFF0Cr26 \u4E0A\u7684\u5B9E\u9645\u884C\u4E3A\u4ECD\u9700\u5B9E\u6D4B\u786E\u8BA4\u3002"]
  },
  {
    id: "spark-create-table-mor",
    title: "\u521B\u5EFA MOR \u8868\uFF08Spark SQL\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-CREATE-TABLE", "EV-COMM-MOR", "EV-R26-ART-SPARK3"],
    code: `CREATE TABLE IF NOT EXISTS \${database}.\${table} (
  \${primaryKey}      STRING,
  \${preCombineField} BIGINT,
  name  STRING,
  amount DOUBLE
)
USING hudi
TBLPROPERTIES (
  'type' = 'mor',
  'primaryKey' = '\${primaryKey}',
  'preCombineField' = '\${preCombineField}',
  'partitionKey' = '\${partitionKey}',
  'hoodie.datasource.write.recordkey.field' = '\${primaryKey}',
  'hoodie.datasource.write.precombine.field' = '\${preCombineField}',
  'hoodie.datasource.write.partitionpath.field' = '\${partitionKey}',
  'hoodie.datasource.write.table.type' = 'MERGE_ON_READ',
  'hoodie.datasource.write.operation' = 'upsert',
  'hoodie.datasource.write.hive_style_partitioning' = 'true',
  'hoodie.index.type' = '\${indexType}'
);`,
    note: "type=mor \u65F6\u5199\u5165\u4EE5 log file \u8FFD\u52A0\uFF0C\u76F4\u5230 compaction \u624D\u4F1A\u5408\u5E76\u6210 parquet base file\u3002\u56E0\u6B64 MOR \u8868\u7684\u300C\u8BFB\u4F18\u5316\u67E5\u8BE2\u300D\u5728 compaction \u4E4B\u524D\u770B\u4E0D\u5230\u6700\u65B0\u6570\u636E\u3002",
    risks: ["MOR \u9996\u5199\u843D\u70B9\u5728 r26 \u4E0A\u672A\u5B9E\u6D4B\u786E\u8BA4\uFF08\u672C\u9879\u76EE\u7684\u6559\u5B66\u6A21\u578B\u89C1\u300C\u573A\u666F\u89C4\u5219\u300D\u8868\uFF09\u3002"]
  },
  /* ------------------------------ 写入 ------------------------------ */
  {
    id: "spark-insert",
    title: "\u63D2\u5165\u8BB0\u5F55\uFF08INSERT INTO\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-CREATE-TABLE", "EV-R26-ART-SPARK3"],
    code: `INSERT INTO \${database}.\${table} (\${columns})
SELECT \${columns}
FROM \${sourceTable};`,
    note: "Spark SQL \u7684 INSERT INTO \u843D\u5230 Hudi \u540E\u7531 hoodie.datasource.write.operation \u51B3\u5B9A\u8BED\u4E49\uFF1Aupsert\uFF08\u9ED8\u8BA4\uFF09\u4F1A\u5148\u6309\u4E3B\u952E\u67E5\u91CD\uFF0Cinsert \u4E0D\u67E5\u91CD\uFF0Cbulk_insert \u76F4\u63A5\u751F\u6210 base file\u3002"
  },
  {
    id: "spark-upsert",
    title: "\u66F4\u65B0\u8BB0\u5F55\uFF08upsert\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-INDEX", "EV-COMM-MOR"],
    code: `SET hoodie.datasource.write.operation = 'upsert';

INSERT INTO \${database}.\${table} (\${columns})
SELECT \${columns}
FROM \${sourceTable};`,
    note: "upsert \u4F9D\u8D56\u7D22\u5F15\u5B9A\u4F4D\u300C\u5DF2\u5B58\u5728\u4E3B\u952E\u300D\u6240\u5728\u7684\u6587\u4EF6\uFF1ACOW \u91CD\u5199\u6574\u4E2A File Group\uFF0CMOR \u53EA\u8FFD\u52A0\u4E00\u4E2A log file\u3002\u540C\u4E3B\u952E\u591A\u7248\u672C\u65F6\u7531 precombine \u5B57\u6BB5\u51B3\u5B9A\u8C01\u80DC\u51FA\u3002"
  },
  {
    id: "spark-bulk-insert",
    title: "\u6279\u91CF\u63D2\u5165\uFF08bulk_insert\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-BULK-INSERT"],
    code: `SET hoodie.datasource.write.operation = 'bulk_insert';
SET hoodie.datasource.write.bulk_insert.enable = 'true';

INSERT INTO \${database}.\${table} (\${columns})
SELECT \${columns}
FROM \${sourceTable};`,
    note: "bulk_insert \u8DF3\u8FC7\u67E5\u91CD\u4E0E\u5408\u5E76\uFF0C\u76F4\u63A5\u751F\u6210 base file\uFF0C\u9002\u5408\u7A7A\u8868\u521D\u59CB\u5316\u3002MOR \u8868\u7528 bulk_insert \u521D\u59CB\u5316\u662F\u300C\u4E00\u5199\u5373 parquet\u300D\u7684\u552F\u4E00\u8DEF\u5F84\u3002",
    risks: ["BUCKET \u7D22\u5F15\u8868\u4E0E bulk_insert \u7684\u7EC4\u5408\u9650\u5236\u5728 r26 \u5C1A\u672A\u786E\u8BA4\uFF0C\u672C\u9879\u76EE\u6309\u62E6\u622A\u5904\u7406\u3002"]
  },
  {
    id: "spark-insert-overwrite-partition",
    title: "\u8986\u76D6\u5206\u533A\uFF08INSERT OVERWRITE PARTITION\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-CREATE-TABLE", "EV-R26-ART-SPARK3"],
    code: `INSERT OVERWRITE TABLE \${database}.\${table}
PARTITION (\${partitionKey} = '\${partitionValue}')
SELECT \${columns}
FROM \${sourceTable};`,
    note: "\u8986\u76D6\u5199\u4F1A\u5728 Timeline \u4E0A\u4EA7\u751F replacecommit instant\uFF0C\u88AB\u8986\u76D6\u5206\u533A\u7684\u65E7\u6587\u4EF6\u5728 Clean \u4E4B\u524D\u4ECD\u7269\u7406\u5B58\u5728\u4E8E HDFS\u3002"
  },
  {
    id: "spark-insert-overwrite-table",
    title: "\u8986\u76D6\u6574\u8868\uFF08INSERT OVERWRITE TABLE\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-CREATE-TABLE", "EV-R26-ART-SPARK3"],
    code: `INSERT OVERWRITE TABLE \${database}.\${table}
SELECT \${columns}
FROM \${sourceTable};`,
    note: "\u6574\u8868\u8986\u76D6\u4F1A\u4F5C\u5E9F\u6240\u6709\u5206\u533A\u7684 File Group\uFF0C\u5386\u53F2\u6570\u636E\u5728 Clean \u4E4B\u524D\u4ECD\u5728 HDFS \u4E0A\u5360\u7A7A\u95F4\u3002"
  },
  {
    id: "spark-delete",
    title: "\u5220\u9664\u8BB0\u5F55\uFF08DELETE FROM\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `DELETE FROM \${database}.\${table}
WHERE \${primaryKey} = '\${recordKey}';`,
    note: "Hudi \u7684\u5220\u9664\u4E0D\u662F\u300C\u628A\u884C\u4ECE\u6587\u4EF6\u91CC\u62B9\u6389\u300D\uFF0C\u800C\u662F\u5199\u5165\u4E00\u6761 operation=DELETE \u7684\u8BB0\u5F55\uFF1ACOW \u91CD\u5199\u6574\u4E2A File Group\uFF0CMOR \u8FFD\u52A0\u4E00\u4E2A log file\u3002\u88AB\u5220\u8BB0\u5F55\u5728\u903B\u8F91\u89C6\u56FE\u91CC\u4E0D\u53EF\u89C1\uFF0C\u7269\u7406\u4E0A\u8981\u7B49 compaction / clean \u624D\u56DE\u6536\u3002"
  },
  /* ------------------------------ 查询 ------------------------------ */
  {
    id: "spark-query-snapshot",
    title: "\u5FEB\u7167\u67E5\u8BE2\uFF08Snapshot\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `SELECT *
FROM \${database}.\${table};`,
    note: "\u9ED8\u8BA4\u7684\u5FEB\u7167\u8BFB\u4F1A\u5408\u5E76 base file \u4E0E\u5168\u90E8 log file\uFF0C\u56E0\u6B64 MOR \u8868\u5728 compaction \u4E4B\u524D\u4E5F\u80FD\u67E5\u5230\u6700\u65B0\u6570\u636E\u3002\u4EE3\u4EF7\u662F\u8BFB\u653E\u5927\uFF1A\u8BFB\u4E00\u4E2A\u903B\u8F91\u8BB0\u5F55\u53EF\u80FD\u8981\u6253\u5F00\u591A\u4E2A\u7269\u7406\u6587\u4EF6\u3002"
  },
  {
    id: "spark-query-read-optimized",
    title: "\u8BFB\u4F18\u5316\u67E5\u8BE2\uFF08Read Optimized\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `SET hoodie.datasource.read.optimized = true;

SELECT *
FROM \${database}.\${table};`,
    note: "\u8BFB\u4F18\u5316\u53EA\u8BFB base file\uFF0C\u5B8C\u5168\u5FFD\u7565 log file \u2014\u2014 \u8BFB\u5F97\u5FEB\uFF0C\u4F46 MOR \u8868\u5728 compaction \u4E4B\u524D\u770B\u4E0D\u5230\u4EC5\u5B58\u5728\u4E8E log file \u7684\u66F4\u65B0\u3002\u8FD9\u662F\u300CMOR \u8868\u5FC5\u987B\u53CA\u65F6 compaction\u300D\u7684\u6839\u56E0\u3002"
  },
  {
    id: "spark-query-incremental",
    title: "\u589E\u91CF\u67E5\u8BE2\uFF08Incremental\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `SET hoodie.datasource.read.begin.instanttime = \${beginInstantTime};
SET hoodie.datasource.read.end.instanttime = \${endInstantTime};

SELECT *
FROM \${database}.\${table};`,
    note: "\u589E\u91CF\u67E5\u8BE2\u8FD4\u56DE\u8BE5\u65F6\u95F4\u7A97\u53E3\u5185**\u65B0\u589E/\u66F4\u65B0**\u7684\u8BB0\u5F55\uFF1B\u88AB\u5220\u9664\u7684\u8BB0\u5F55\u4F1A\u4EE5 operation=DELETE \u7684\u5F62\u5F0F\u8FD4\u56DE\uFF0C\u6D88\u8D39\u7AEF\u5FC5\u987B\u81EA\u5DF1\u5904\u7406\u5220\u9664\u8BED\u4E49\uFF0C\u5426\u5219\u4F1A\u6F0F\u5220\u3002"
  },
  {
    id: "spark-query-time-travel",
    title: "\u65F6\u95F4\u65C5\u884C\uFF08Time Travel\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-COMM-MOR"],
    code: `SET hoodie.datasource.read.as.of.instant = \${asOfInstant};

SELECT *
FROM \${database}.\${table};`,
    note: "as.of.instant \u8BFB\u53D6\u7684\u662F\u8BE5 instant \u63D0\u4EA4\u5B8C\u6210\u540E\u7684\u5FEB\u7167\u3002\u5B83\u4F9D\u8D56 Timeline \u4E0A\u4ECD\u7136\u4FDD\u7559\u8BE5 instant \u2014\u2014 \u4E00\u65E6\u88AB Archive \u5E76\u6E05\u7406\u4E86\u5386\u53F2\u6587\u4EF6\uFF0C\u5386\u53F2\u65F6\u523B\u5C31\u67E5\u4E0D\u5230\u4E86\u3002"
  },
  {
    id: "spark-show-partitions",
    title: "\u67E5\u770B\u5206\u533A\uFF08\u5199 TTL spec \u7684\u524D\u63D0\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-HW-TTL-POLICY"],
    code: `SHOW PARTITIONS \${database}.\${table};`,
    note: "TTL \u7B56\u7565\u7684 spec \u662F\u7528\u4E8E\u7B5B\u9009\u5206\u533A\u7684\u6B63\u5219\u8868\u8FBE\u5F0F\uFF0C\u5199\u4E4B\u524D\u5148\u7528 SHOW PARTITIONS \u770B\u6E05\u5206\u533A\u76EE\u5F55\u683C\u5F0F\u3002"
  },
  /* ------------------------------ 表服务 ------------------------------ */
  {
    id: "spark-compaction-plan-only",
    title: "\u751F\u6210 Compaction Plan\uFF08\u5F02\u6B65\u6A21\u5F0F\uFF09",
    language: "spark-sql",
    status: "verified",
    evidenceIds: ["EV-HW-RUN-COMPACTION"],
    code: `SET hoodie.compact.inline = true;
SET hoodie.run.compact.only.inline = true;

RUN COMPACTION ON \${database}.\${table};`,
    note: "\u8FD9\u662F\u534E\u4E3A\u300AHudi\u6570\u636E\u8868Compaction\u89C4\u8303\u300B\u7ED9\u51FA\u7684\u5199\u6CD5\uFF1Arun compaction on <db>.<table> \u4F1A\u751F\u6210 compaction plan\uFF1B\u914D\u5408 hoodie.run.compact.only.inline=true \u65F6**\u53EA\u5199\u8BA1\u5212\u4E0D\u6267\u884C**\uFF0C\u7531\u72EC\u7ACB\u7684 Spark \u4F5C\u4E1A\u5F02\u6B65\u6267\u884C\u3002Flink \u4FA7\u4E5F\u662F\u540C\u6837\u7684\u601D\u8DEF\uFF1A\u53EA\u751F\u6210 plan\uFF0C\u4E0D\u5728 Flink \u4F5C\u4E1A\u91CC\u505A compaction\u3002",
    prerequisites: ["\u8868\u7C7B\u578B\u5FC5\u987B\u662F MOR\uFF08COW \u6CA1\u6709 log file\uFF0C\u65E0\u9700 compaction\uFF09"]
  },
  {
    id: "spark-compaction-inline",
    title: "\u540C\u6B65\u6267\u884C Compaction",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-HW-RUN-COMPACTION", "EV-COMM-MOR"],
    code: `SET hoodie.compact.inline = true;
SET hoodie.run.compact.only.inline = false;

RUN COMPACTION ON \${database}.\${table};`,
    note: "hoodie.run.compact.only.inline=false \u65F6\uFF0C\u672C\u6B21 run compaction \u4F1A\u540C\u6B65\u628A log file \u5408\u5E76\u6210\u65B0\u7684 parquet base file\u3002\u540C\u6B65 compaction \u4F1A\u8BA9\u5199\u5165\u4F5C\u4E1A\u53D8\u6162\uFF0C\u751F\u4EA7\u4E0A\u901A\u5E38\u6539\u4E3A\u300C\u53EA\u751F\u6210\u8BA1\u5212 + \u72EC\u7ACB\u4F5C\u4E1A\u5F02\u6B65\u6267\u884C\u300D\u3002",
    risks: ["\u534E\u4E3A\u6587\u6863\u7ED9\u51FA\u7684\u793A\u4F8B\u7EC4\u5408\u662F only.inline=true\uFF08\u53EA\u751F\u6210\u8BA1\u5212\uFF09\uFF0Cfalse \u7684\u540C\u6B65\u6267\u884C\u8BED\u4E49\u6765\u81EA\u793E\u533A 0.15\uFF0Cr26 \u672A\u5B9E\u6D4B\u3002"]
  },
  {
    id: "spark-clean",
    title: "\u6267\u884C Clean\uFF08\u7269\u7406\u5220\u9664\u65E7\u6587\u4EF6\uFF09",
    language: "spark-sql",
    status: "conditional",
    evidenceIds: ["EV-HW-RUN-COMPACTION"],
    code: `RUN CLEAN ON \${database}.\${table};`,
    note: "Clean \u8D1F\u8D23\u771F\u6B63\u628A\u88AB\u53D6\u4EE3\u7684\u65E7\u6587\u4EF6\u4ECE HDFS \u4E0A\u5220\u6389\u3002\u5B83\u4E0E compaction \u662F\u4E24\u4EF6\u4E8B\uFF1Acompaction \u4EA7\u751F\u65B0 base file\uFF0Cclean \u624D\u56DE\u6536\u65E7\u6587\u4EF6\u7684\u7A7A\u95F4\u3002",
    prerequisites: [
      "MRS 3.2.0 \u53CA\u4E4B\u540E\u7248\u672C",
      "MRS 3.1.x\uFF08\u542B\u76EE\u6807\u7248\u672C MRS 3.1.0-350-r26\uFF09\u6CA1\u6709\u8BE5\u5B58\u50A8\u8FC7\u7A0B\uFF0C\u8BF7\u6539\u7528 hoodie.clean.automatic=true \u65B9\u5F0F\u81EA\u52A8\u6E05\u7406"
    ],
    risks: [
      "\u5728 3.1.0-350-r26 \u4E0A\u76F4\u63A5\u6267\u884C\u8BE5\u5B58\u50A8\u8FC7\u7A0B\u53EF\u80FD\u62A5\u300C\u5B58\u50A8\u8FC7\u7A0B\u4E0D\u5B58\u5728\u300D\uFF1B\u76EE\u6807\u7248\u672C\u7684\u53EF\u7528\u6027\u9700\u5B9E\u6D4B\u786E\u8BA4\u3002"
    ]
  },
  {
    id: "spark-clean-automatic-3-1",
    title: "\u5F00\u542F\u81EA\u52A8\u6E05\u7406\uFF08MRS 3.1.x \u65B9\u5F0F\uFF09",
    language: "spark-sql",
    status: "conditional",
    evidenceIds: ["EV-HW-RUN-COMPACTION"],
    code: `SET hoodie.clean.automatic = true;
SET hoodie.clean.async = true;
SET hoodie.cleaner.commits.retained = 500;`,
    note: "\u8FD9\u662F\u76EE\u6807\u7248\u672C MRS 3.1.0-350-r26 \u4E0A\u63A8\u8350\u7684\u6E05\u7406\u65B9\u5F0F\uFF1A\u5F00\u542F hoodie.clean.automatic \u540E\uFF0CHudi \u4F1A\u5728\u5199\u5165\u540E\u81EA\u52A8\u6E05\u7406\u4E0D\u518D\u88AB\u5F15\u7528\u7684\u65E7\u6587\u4EF6\uFF1Bcommits.retained=500 \u51B3\u5B9A\u4FDD\u7559\u591A\u5C11\u6B21\u63D0\u4EA4\u4E4B\u524D\u7684\u5386\u53F2\uFF08\u4FDD\u7559\u7A97\u53E3\u5185\u7684\u6587\u4EF6\u4E0D\u4F1A\u88AB\u5220\uFF0C\u4FDD\u8BC1\u65F6\u95F4\u65C5\u884C\u4ECD\u53EF\u67E5\uFF09\u3002",
    prerequisites: ["MRS 3.1.x\uFF08MRS 3.1.0-350-r26\uFF09\uFF1BMRS 3.2.0+ \u53EF\u76F4\u63A5\u4F7F\u7528 RUN CLEAN \u5B58\u50A8\u8FC7\u7A0B"]
  },
  {
    id: "spark-archive",
    title: "\u6267\u884C Archive\uFF08\u5F52\u6863\u65E7 instant\uFF09",
    language: "spark-sql",
    status: "verified",
    evidenceIds: ["EV-HW-RUN-COMPACTION"],
    code: `RUN ARCHIVELOG ON \${database}.\${table};`,
    note: "Archive \u628A\u8F83\u65E9\u7684 instant \u4ECE\u6D3B\u8DC3 Timeline \u79FB\u5230 .hoodie/archive/ \u4E0B\uFF0C\u907F\u514D Timeline \u65E0\u9650\u81A8\u80C0\u3002\u5B83\u53EA\u79FB\u52A8\u5143\u6570\u636E\u6587\u4EF6\uFF0C\u4E0D\u89E6\u78B0\u6570\u636E\u6587\u4EF6\u3002"
  },
  {
    id: "spark-clustering",
    title: "\u6267\u884C Clustering\uFF08\u5408\u5E76\u5C0F\u6587\u4EF6\uFF09",
    language: "spark-sql",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-COMMON", "EV-COMM-MOR"],
    code: `CALL run_clustering(table => '\${database}.\${table}', orderby => '\${preCombineField}', predicate => '');`,
    note: "Clustering \u91CD\u5199\u5206\u533A\u5185\u7684\u5C0F\u6587\u4EF6\uFF0C\u628A\u5B83\u4EEC\u5408\u5E76\u6210\u63A5\u8FD1\u76EE\u6807\u5927\u5C0F\u7684\u5927\u6587\u4EF6\uFF0C\u89E3\u51B3\u8BFB\u653E\u5927\u4E0E\u5143\u6570\u636E\u81A8\u80C0\u3002\u5B83\u4E0D\u6539\u53D8\u6570\u636E\u5185\u5BB9\uFF0C\u53EA\u6539\u53D8\u7269\u7406\u5E03\u5C40\u3002",
    risks: [
      "r26 \u4FA7 run_clustering \u5B58\u50A8\u8FC7\u7A0B\u7684\u53C2\u6570\u7B7E\u540D\uFF08\u542B orderby / predicate\uFF09\u9700\u5B9E\u6D4B\u786E\u8BA4\uFF1B\u6587\u6863\u4EC5\u8986\u76D6 run compaction / run archivelog / run clean\u3002"
    ]
  },
  /* ------------------------------ TTL ------------------------------ */
  {
    id: "spark-ttl-save",
    title: "\u4FDD\u5B58 TTL \u7B56\u7565",
    language: "spark-sql",
    status: "verified",
    evidenceIds: ["EV-HW-TTL-POLICY"],
    code: `CALL ttl_policy_save(table => '\${database}.\${table}', spec => '\${ttlSpec}', level => 'PARTITION', value => '\${ttlValue}', units => '\${ttlUnits}');`,
    note: "\u534E\u4E3A\u300AHudi TTL \u7B56\u7565\u300B\u6587\u6863\u7ED9\u51FA\u7684\u8BED\u6CD5\u3002spec \u662F\u5339\u914D\u5206\u533A\u7684\u6B63\u5219\u8868\u8FBE\u5F0F\uFF0Cvalue \u4E0E units \u5FC5\u987B\u540C\u65F6\u63D0\u4F9B\uFF0Clevel \u5F53\u524D**\u4EC5\u652F\u6301 PARTITION**\uFF08RECORD \u7EA7\u5728 r26 \u4E0D\u53EF\u7528\uFF09\u3002",
    prerequisites: ["level \u53EA\u80FD\u53D6 PARTITION"]
  },
  {
    id: "spark-ttl-show",
    title: "\u67E5\u770B TTL \u7B56\u7565",
    language: "spark-sql",
    status: "verified",
    evidenceIds: ["EV-HW-TTL-POLICY"],
    code: `CALL ttl_policy_show(table => '\${database}.\${table}');`,
    note: "\u67E5\u770B\u5F53\u524D\u8868\u4E0A\u751F\u6548\u7684\u6240\u6709 TTL \u7B56\u7565\u3002"
  },
  {
    id: "spark-ttl-delete",
    title: "\u5220\u9664\u5355\u6761 TTL \u7B56\u7565",
    language: "spark-sql",
    status: "verified",
    evidenceIds: ["EV-HW-TTL-POLICY"],
    code: `CALL ttl_policy_delete(
  table => '\${database}.\${table}',
  spec  => '\${ttlSpec}'
);`,
    note: "\u6309 spec \u7CBE\u786E\u5220\u9664\u4E00\u6761\u7B56\u7565\u3002"
  },
  {
    id: "spark-ttl-empty",
    title: "\u6E05\u7A7A TTL \u7B56\u7565",
    language: "spark-sql",
    status: "verified",
    evidenceIds: ["EV-HW-TTL-POLICY"],
    code: `CALL ttl_policy_empty(table => '\${database}.\${table}');`,
    note: "\u6E05\u7A7A\u8BE5\u8868\u4E0A\u7684\u5168\u90E8 TTL \u7B56\u7565\u3002"
  }
];
export {
  SPARK_SQL_TEMPLATES
};
