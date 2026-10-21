// ../hudi-visual-lab/src/engine/templates/flinkSql.ts
var FLINK_SQL_TEMPLATES = [
  {
    id: "flink-create-table",
    title: "\u521B\u5EFA Hudi \u8868\uFF08Flink SQL\uFF09",
    language: "flink-sql",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-FLINK17", "EV-COMM-CREATE-TABLE"],
    code: `CREATE TABLE IF NOT EXISTS \${database}.\${table} (
  \${primaryKey}      STRING,
  \${preCombineField} BIGINT,
  name  STRING,
  amount DOUBLE,
  PRIMARY KEY (\${primaryKey}) NOT ENFORCED
) WITH (
  'connector' = 'hudi',
  'path' = '\${tablePath}',
  'hoodie.datasource.write.recordkey.field' = '\${primaryKey}',
  'hoodie.datasource.write.precombine.field' = '\${preCombineField}',
  'hoodie.datasource.write.partitionpath.field' = '\${partitionKey}',
  'hoodie.datasource.write.table.type' = '\${tableType}',
  'hoodie.datasource.write.operation' = 'upsert',
  'hoodie.datasource.write.hive_style_partitioning' = 'true'
);`,
    note: "Flink \u4FA7\u7528 connector= hudi \u7684\u5EFA\u8868\u8BED\u6CD5\u3002PRIMARY KEY NOT ENFORCED \u8868\u793A\u4E3B\u952E\u7531 Hudi \u81EA\u5DF1\u4FDD\u8BC1\uFF0CFlink \u4E0D\u4F1A\u5728\u8FD0\u884C\u65F6\u6821\u9A8C\u3002",
    risks: ["r26 \u7684 hudi-flink1.17-bundle \u5B58\u5728\uFF08E3 \u5236\u54C1\u8BC1\u636E\uFF09\uFF0C\u4F46\u4E0A\u8FF0\u9009\u9879\u5728 r26 \u4E0A\u7684\u5B9E\u9645\u884C\u4E3A\u4ECD\u9700\u5B9E\u6D4B\u3002"]
  },
  {
    id: "flink-insert",
    title: "\u5199\u5165 Hudi \u8868\uFF08Flink SQL\uFF09",
    language: "flink-sql",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-FLINK17", "EV-COMM-MOR"],
    code: `INSERT INTO \${database}.\${table}
SELECT \${columns}
FROM \${sourceTable};`,
    note: "Flink \u7684\u6301\u7EED\u5199\u5165\u4EE5 log file \u5F62\u5F0F\u8FFD\u52A0\u5230 File Slice\uFF0C\u56E0\u6B64 Flink \u5199\u5165\u7684 MOR \u8868\u5728 compaction \u4E4B\u524D\uFF0C\u300C\u8BFB\u4F18\u5316\u67E5\u8BE2\u300D\u770B\u4E0D\u5230\u6700\u65B0\u6570\u636E\u3002"
  },
  {
    id: "flink-compaction-config",
    title: "Flink \u4FA7 Compaction \u53C2\u6570\uFF08\u53EA\u751F\u6210 plan\uFF09",
    language: "flink-sql",
    status: "verified",
    evidenceIds: ["EV-HW-RUN-COMPACTION"],
    code: `SET 'compaction.async.enabled' = 'false';
SET 'compaction.schedule.enabled' = 'true';
SET 'compaction.delta_commits' = '5';
SET 'clean.async.enabled' = 'false';
SET 'hoodie.archive.automatic' = 'false';`,
    note: "\u8FD9\u7EC4\u53C2\u6570\u662F\u534E\u4E3A\u300AHudi\u6570\u636E\u8868Compaction\u89C4\u8303\u300B\u660E\u786E\u63A8\u8350\u7684 Flink \u4FA7\u914D\u7F6E\uFF1A\u5173\u95ED compaction \u5F02\u6B65\u6267\u884C\u3001\u5F00\u542F compaction \u8C03\u5EA6\u3001\u7D2F\u79EF 5 \u4E2A delta commit \u540E\u89E6\u53D1\u4E00\u6B21\u8BA1\u5212\uFF0C\u5E76\u5173\u95ED Flink \u4FA7\u7684 clean \u4E0E archive\u3002\u76EE\u7684\u53EA\u6709\u4E00\u4E2A\uFF1A\u8BA9 Flink \u4F5C\u4E1A\u53EA\u8D1F\u8D23\u300C\u751F\u6210 compaction plan\u300D\uFF0C\u771F\u6B63\u7684\u5408\u5E76\u4EA4\u7ED9\u72EC\u7ACB Spark \u4F5C\u4E1A\u5F02\u6B65\u505A\u3002",
    prerequisites: [
      "\u9700\u5173\u95ED Flink \u4FA7 compaction.async.enabled\uFF0C\u5F00\u542F compaction.schedule.enabled",
      "\u9700\u8981\u72EC\u7ACB\u7684 Spark \u4F5C\u4E1A\u6D88\u8D39 plan \u5E76\u6267\u884C compaction"
    ]
  },
  {
    id: "flink-compaction-plan-only",
    title: "Flink \u4FA7\u53EA\u751F\u6210 Compaction Plan",
    language: "flink-sql",
    status: "conditional",
    evidenceIds: ["EV-HW-RUN-COMPACTION"],
    code: `-- Flink \u4F5C\u4E1A\u4FA7\uFF1A\u53EA\u751F\u6210 plan\uFF0C\u4E0D\u6267\u884C compaction
SET 'compaction.async.enabled' = 'false';
SET 'compaction.schedule.enabled' = 'true';
SET 'compaction.delta_commits' = '5';

-- \u4E4B\u540E\u7684\u5408\u5E76\u7531\u72EC\u7ACB Spark \u4F5C\u4E1A\u6267\u884C\uFF1A
--   SET hoodie.compact.inline = true;
--   SET hoodie.run.compact.only.inline = true;
--   RUN COMPACTION ON \${database}.\${table};`,
    note: "Flink \u4FA7\u4E0D\u6267\u884C compaction\uFF0C\u53EA\u628A\u300C\u54EA\u4E9B File Group \u9700\u8981\u5408\u5E76\u300D\u5199\u8FDB plan \u6587\u4EF6\uFF1B\u72EC\u7ACB Spark \u4F5C\u4E1A\u518D\u6D88\u8D39 plan \u5B8C\u6210\u5408\u5E76\u3002\u8FD9\u6837 Flink \u4F5C\u4E1A\u7684 checkpoint \u4E0E\u5EF6\u8FDF\u4E0D\u4F1A\u88AB compaction \u62D6\u57AE\u3002",
    prerequisites: ["\u5DF2\u6309\u300CFlink \u4FA7 Compaction \u53C2\u6570\u300D\u8BBE\u7F6E\u597D Flink \u53C2\u6570", "\u5DF2\u90E8\u7F72\u72EC\u7ACB\u7684 Spark compaction \u4F5C\u4E1A"]
  },
  {
    id: "flink-query",
    title: "\u67E5\u8BE2 Hudi \u8868\uFF08Flink SQL\uFF09",
    language: "flink-sql",
    status: "unverified",
    evidenceIds: ["EV-R26-ART-FLINK17", "EV-COMM-MOR"],
    code: `SELECT *
FROM \${database}.\${table};`,
    note: "Flink SQL \u8BFB Hudi \u9ED8\u8BA4\u662F\u5FEB\u7167\u8BFB\uFF0C\u5408\u5E76 base file \u4E0E log file\u3002"
  }
];
export {
  FLINK_SQL_TEMPLATES
};
