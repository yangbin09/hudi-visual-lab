// ../hudi-visual-lab/src/experiments/visual/glossary.ts
var GLOSSARY = [
  {
    term: "File Group",
    en: "File Group",
    def: "\u540C\u4E00 File ID \u4E0B\u5171\u4EAB\u4E00\u7EC4\u6587\u4EF6\u7248\u672C\u7684\u5B58\u50A8\u5355\u5143",
    firstTopic: "B04",
    aliases: ["\u6587\u4EF6\u7EC4"]
  },
  {
    term: "File Slice",
    en: "File Slice",
    def: "Base \u52A0\u82E5\u5E72 Log \u7EC4\u6210\u7684\u4E00\u6B21\u5FEB\u7167\u5F15\u7528",
    firstTopic: "B04",
    aliases: ["\u6587\u4EF6\u5207\u7247"]
  },
  {
    term: "Base File",
    en: "Base File",
    def: "\u5217\u5F0F parquet \u6570\u636E\u6587\u4EF6\uFF0C\u627F\u8F7D\u4E00\u6B21\u63D0\u4EA4\u540E\u7684\u5B8C\u6574\u8BB0\u5F55",
    firstTopic: "B04",
    aliases: ["\u57FA\u7840\u6587\u4EF6", "base \u6587\u4EF6"]
  },
  {
    term: "Log File",
    en: "Log File",
    def: "MOR \u8868\u7684\u589E\u91CF\u65E5\u5FD7\u6587\u4EF6\uFF0C\u6309\u5199\u5165\u8FFD\u52A0\u3001\u7B49\u5F85\u5408\u5E76",
    firstTopic: "B04",
    aliases: ["\u65E5\u5FD7\u6587\u4EF6", "log \u6587\u4EF6"]
  },
  {
    term: "File ID",
    en: "File ID",
    def: "File Group \u7684\u7A33\u5B9A\u6807\u8BC6\uFF0C\u5199\u5165\u4EA7\u751F\u65B0\u6587\u4EF6\u65F6\u4FDD\u6301\u4E0D\u53D8",
    firstTopic: "B04"
  },
  {
    term: "Instant",
    en: "Instant",
    def: "\u4E00\u6B21\u5E26\u65F6\u95F4\u6233\u7684\u539F\u5B50\u63D0\u4EA4\uFF0C\u662F Timeline \u4E0A\u7684\u4E00\u4E2A\u70B9",
    firstTopic: "B05",
    aliases: ["\u63D0\u4EA4\u65F6\u523B"]
  },
  {
    term: "Timeline",
    en: "Timeline",
    def: "\u6309 instant \u6392\u5E8F\u7684\u63D0\u4EA4\u8BB0\u5F55\uFF0C\u51B3\u5B9A\u5F53\u524D\u80FD\u8BFB\u5230\u54EA\u4E00\u7248\u6570\u636E",
    firstTopic: "B01",
    aliases: ["\u65F6\u95F4\u7EBF"]
  },
  {
    term: "Checkpoint",
    en: "Checkpoint",
    def: "\u67D0\u6B21\u63D0\u4EA4\u5B8C\u6210\u540E\u7684\u5B8C\u6574\u72B6\u6001\u5FEB\u7167\uFF0C\u4F9B\u65F6\u95F4\u65C5\u884C\u4E0E\u6062\u590D\u8BFB\u53D6",
    firstTopic: "B07",
    aliases: ["\u68C0\u67E5\u70B9"]
  },
  {
    term: "Commit",
    en: "Commit",
    def: "\u4E00\u6B21\u5199\u5165\u6210\u529F\u540E\u5728 Timeline \u7559\u4E0B\u7684\u4E00\u6761\u63D0\u4EA4\u8BB0\u5F55",
    firstTopic: "B01",
    aliases: ["\u63D0\u4EA4"]
  },
  {
    term: "Compaction",
    en: "Compaction",
    def: "\u628A Base \u4E0E Log \u5F52\u5E76\u6210\u65B0 Base \u7684\u8868\u670D\u52A1",
    firstTopic: "B05"
  },
  {
    term: "Clean",
    en: "Clean / Cleaner",
    def: "\u6309\u4FDD\u7559\u7A97\u53E3\u7269\u7406\u5220\u9664\u88AB\u53D6\u4EE3\u65E7\u6587\u4EF6\u7684\u8868\u670D\u52A1",
    firstTopic: "W06",
    aliases: ["\u6E05\u7406"]
  },
  {
    term: "Archive",
    en: "Archive",
    def: "\u628A\u65E7\u7684 instant \u79FB\u5230\u5F52\u6863\u533A\uFF0C\u53EA\u642C\u5143\u6570\u636E",
    firstTopic: "S07",
    aliases: ["\u5F52\u6863"]
  },
  {
    term: "Rollback",
    en: "Rollback",
    def: "\u64A4\u9500\u672A\u5B8C\u6210\u4E8B\u52A1\u5E76\u5220\u9664\u8BE5 instant \u6B8B\u7559\u6587\u4EF6",
    firstTopic: "S08",
    aliases: ["\u56DE\u6EDA"]
  },
  {
    term: "Clustering",
    en: "Clustering",
    def: "\u91CD\u6392\u6587\u4EF6\u5E03\u5C40\u3001\u5408\u5E76\u5C0F\u6587\u4EF6\uFF0C\u4E0D\u6539\u53D8\u4E1A\u52A1\u6570\u636E",
    firstTopic: "S10",
    aliases: ["\u805A\u7C7B", "\u5C0F\u6587\u4EF6\u5408\u5E76"]
  },
  {
    term: "TTL",
    en: "Time To Live",
    def: "\u6309\u5206\u533A\u8FC7\u671F\u65F6\u95F4\u81EA\u52A8\u6E05\u7406\u6570\u636E\u7684\u7B56\u7565",
    firstTopic: "S11",
    aliases: ["\u8FC7\u671F\u6E05\u7406", "\u751F\u547D\u5468\u671F"]
  },
  {
    term: "Metadata Table",
    en: "Metadata Table",
    def: "\u7528\u5143\u6570\u636E\u7D22\u5F15\u4EE3\u66FF\u9010\u6587\u4EF6\u5217\u4E3E\u7684\u52A0\u901F\u8868",
    firstTopic: "A03",
    aliases: ["\u5143\u6570\u636E\u8868"]
  },
  {
    term: "Precombine",
    en: "Precombine Field",
    def: "\u540C\u4E3B\u952E\u591A\u7248\u672C\u7684\u6392\u5E8F\u5B57\u6BB5\uFF0C\u503C\u66F4\u5927\u8005\u80DC\u51FA",
    firstTopic: "T01",
    aliases: ["\u9884\u5408\u5E76\u5B57\u6BB5"]
  },
  {
    term: "Bucket",
    en: "Bucket",
    def: "\u6309\u4E3B\u952E\u54C8\u5E0C\u5212\u5206\u3001\u4E00\u4E2A\u6876\u5BF9\u5E94\u4E00\u4E2A File Group",
    firstTopic: "I03",
    aliases: ["\u6876", "\u5206\u6876"]
  },
  {
    term: "Record Key",
    en: "Record Key",
    def: '\u8BB0\u5F55\u4E3B\u952E\uFF0C\u51B3\u5B9A"\u8FD9\u6761\u8BB0\u5F55\u662F\u8C01"',
    firstTopic: "B06",
    aliases: ["\u4E3B\u952E", "recordkey.field"]
  },
  {
    term: "Partition Path",
    en: "Partition Path",
    def: "\u8BB0\u5F55\u6240\u5C5E\u7684\u5206\u533A\u76EE\u5F55\uFF0C\u9650\u5B9A\u7D22\u5F15\u4E0E\u67E5\u8BE2\u7684\u67E5\u627E\u8303\u56F4",
    firstTopic: "B06",
    aliases: ["\u5206\u533A\u8DEF\u5F84"]
  },
  {
    term: "HoodieKey",
    en: "HoodieKey",
    def: "\u4E3B\u952E\u4E0E\u5206\u533A\u8DEF\u5F84\u7EC4\u6210\u7684\u590D\u5408\u5B9A\u4F4D\u952E",
    firstTopic: "B06"
  },
  {
    term: "Copy On Write",
    en: "Copy On Write (COW)",
    def: "\u5199\u5165\u65F6\u91CD\u5199\u6574\u4E2A File Group \u7684\u8868\u7C7B\u578B",
    firstTopic: "B02",
    aliases: ["COW"]
  },
  {
    term: "Merge On Read",
    en: "Merge On Read (MOR)",
    def: "\u5199\u5165\u8FFD\u52A0 Log File\u3001\u8BFB\u53D6\u65F6\u518D\u5F52\u5E76\u7684\u8868\u7C7B\u578B",
    firstTopic: "B03",
    aliases: ["MOR"]
  },
  {
    term: "Snapshot Read",
    en: "Snapshot Read",
    def: "\u5408\u5E76 Base \u4E0E Log \u7684\u9ED8\u8BA4\u8BFB\u6CD5\uFF0C\u80FD\u770B\u5230\u6700\u65B0\u63D0\u4EA4",
    firstTopic: "B01",
    aliases: ["\u5FEB\u7167\u8BFB", "Snapshot"]
  },
  {
    term: "Read Optimized",
    en: "Read Optimized",
    def: "\u53EA\u8BFB Base \u7684\u8BFB\u6CD5\uFF0C\u53EF\u80FD\u770B\u4E0D\u5230 Log \u91CC\u7684\u65B0\u66F4\u65B0",
    firstTopic: "Q02",
    aliases: ["\u8BFB\u4F18\u5316"]
  },
  {
    term: "Incremental Read",
    en: "Incremental Read",
    def: "\u53EA\u8FD4\u56DE\u6307\u5B9A instant \u7A97\u53E3\u5185\u65B0\u589E\u3001\u66F4\u65B0\u4E0E\u5220\u9664\u7684\u8BFB\u6CD5",
    firstTopic: "Q03",
    aliases: ["\u589E\u91CF\u8BFB"]
  },
  {
    term: "Time Travel",
    en: "Time Travel",
    def: "\u6309\u5386\u53F2 instant \u8BFB\u53D6\u5F53\u65F6\u7248\u672C\u6570\u636E\u7684\u8BFB\u6CD5",
    firstTopic: "Q04",
    aliases: ["\u65F6\u95F4\u65C5\u884C"]
  },
  {
    term: "SaveMode",
    en: "Spark SaveMode",
    def: "Spark \u5199\u5165\u65F6\u5BF9\u5DF2\u5B58\u5728\u76EE\u6807\u8868\u7684\u5904\u7406\u6A21\u5F0F",
    firstTopic: "W07"
  },
  {
    term: "Hive Metastore",
    en: "Hive Metastore (HMS)",
    def: "Hive \u5143\u6570\u636E\u670D\u52A1\uFF0C\u4FDD\u5B58\u8868\u7ED3\u6784\u4E0E\u5206\u533A\u4FE1\u606F",
    firstTopic: "T06",
    aliases: ["HMS", "hive metastore", "hive sync"]
  },
  {
    term: "BLOOM Index",
    en: "Bloom Index",
    def: "\u7528\u4F4D\u56FE\u505A\u6587\u4EF6\u7EA7\u6982\u7387\u526A\u679D\u7684\u7D22\u5F15\uFF0C\u53EF\u80FD\u8BEF\u5224\u4F46\u4E0D\u4F1A\u6F0F\u5224",
    firstTopic: "I02",
    aliases: ["Bloom", "\u5E03\u9686\u7D22\u5F15"]
  }
];
function glossaryOf(term) {
  const q = term.trim().toLowerCase();
  if (!q) return void 0;
  return GLOSSARY.find(
    (e) => e.term.toLowerCase() === q || e.en.toLowerCase() === q || (e.aliases ?? []).some((a) => a.toLowerCase() === q)
  );
}
function glossaryByTopic(topicId) {
  return GLOSSARY.filter((e) => e.firstTopic === topicId);
}
export {
  GLOSSARY,
  glossaryByTopic,
  glossaryOf
};
