import { readFileSync, writeFileSync } from 'node:fs'
const G = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/visual/glossary.ts'
const L = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/visual/lesson-content.ts'

function patch(path, pairs) {
  let t = readFileSync(path, 'utf8')
  for (const [a, b] of pairs) {
    const n = t.split(a).length - 1
    if (n !== 1) throw new Error(`${path}: 命中 ${n} 处：${a.slice(0, 50)}`)
    t = t.replace(a, b)
  }
  writeFileSync(path, t, 'utf8')
  console.log(`patched ${path}: ${pairs.length}`)
}

// File Slice 在 B01 重写后不再出现 → 首现主题改为 B04（定义处）
patch(G, [["    firstTopic: 'B01',\n    aliases: ['文件切片'],", "    firstTopic: 'B04',\n    aliases: ['文件切片'],"]])

patch(L, [
  // B01#4：给 Commit / Instant / Snapshot Read 加行内定义
  [
    '看到 Timeline 新增一个 COMPLETED 的 instant 并指向新的文件清单；因为 Snapshot 读的就是“最新 instant + 它引用的文件”，所以旧文件虽仍在 HDFS 上，却已不属于当前快照，要等 Clean 才物理删除。',
    '看到 Timeline 新增一个 COMPLETED 的 Commit（一次提交记录，对应一个 instant）；因为 Snapshot 读（合并 Base 与 Log 的默认读法）读的就是“最新 instant + 它引用的文件”，所以旧文件虽仍在 HDFS 上，却已不属于当前快照，要等 Clean 才物理删除。',
  ],
  // B04#2：给 File Slice / Log File 加行内定义
  [
    '看到 File Slice = Base File + 若干 Log File，当前 Slice 引用 1 个 Base 和 0 个 Log；因为 Slice 是“某一时刻这一组文件的有效组合”，所以版本变化表现为 Slice 的引用变化，而不是文件被修改。',
    '看到 File Slice（Base File 加若干 Log File 组成的一次快照引用）当前引用 1 个 Base 和 0 个 Log File（MOR 的增量日志）；因为 Slice 是“某一时刻这一组文件的有效组合”，所以版本变化表现为引用变化，而不是文件被修改。',
  ],
  // B05#2：给 Instant 加行内定义
  [
    '看到第一次更新只新增一个 Log File，并带上写入它的 instant；因为更新不清空 Base，所以新数据先以增量形式存在 Log 中，等待后续合并。',
    '看到第一次更新只新增一个 Log File，并带上写入它的 instant（一次带时间戳的原子提交）；因为更新不清空 Base，所以新数据先以增量形式存在 Log 中，等待后续合并。',
  ],
  // T06#1：给 Hive Metastore 加行内定义
  [
    '看到 HDFS 上已有数据，但 HMS 里还没有这张表；因为数据落盘与元数据同步是两条链路，所以“写成功”不等于“下游能查到”。',
    '看到 HDFS 上已有数据，但 HMS（Hive Metastore：Hive 元数据服务）里还没有这张表；因为数据落盘与元数据同步是两条链路，所以“写成功”不等于“下游能查到”。',
  ],
])
