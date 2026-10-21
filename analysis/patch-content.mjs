// 内容修订补丁：术语 def 收敛到 ≤30 字、代表主题旁白补齐 45–90 字、清除残留免责话术、补 F08
import { readFileSync, writeFileSync } from 'node:fs'
const G = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/visual/glossary.ts'
const L = 'D:/code/hudi演示/hudi-visual-lab/src/experiments/visual/lesson-content.ts'

function patch(path, pairs) {
  let text = readFileSync(path, 'utf8')
  for (const [oldS, newS] of pairs) {
    const n = text.split(oldS).length - 1
    if (n !== 1) throw new Error(`${path}: 期望 1 处匹配，实际 ${n} 处：${oldS.slice(0, 40)}`)
    text = text.replace(oldS, newS)
  }
  writeFileSync(path, text, 'utf8')
  console.log(`patched ${path}: ${pairs.length} 处`)
}

patch(G, [
  [`    def: '一个 Base File 加若干 Log File 组成的一次快照引用',`, `    def: 'Base File 加若干 Log File 组成的一次快照引用',`],
  [`    def: 'MOR 表的增量日志文件，按写入追加、等待 Compaction 合并',`, `    def: 'MOR 表的增量日志文件，按写入追加、等待合并',`],
  [`    def: 'Record Key 与 Partition Path 组成的复合定位键',`, `    def: '主键与分区路径组成的复合定位键',`],
  [`    def: '把 Base File 与 Log File 归并成新 Base File 的表服务',`, `    def: '把 Base 与 Log 归并成新 Base 的表服务',`],
  [`    def: '按主键哈希划分的固定写入单元，一个桶对应一个 File Group',`, `    def: '按主键哈希划分、一个桶对应一个 File Group',`],
  [`    def: '一次写入成功后在 Timeline 上留下的提交记录（对应一个 instant）',`, `    def: '一次写入成功后在 Timeline 留下的一条提交记录',`],
  [`    def: '只读 Base File 的读法，可能看不到 Log 中的最新更新',`, `    def: '只读 Base 的读法，可能看不到 Log 里的新更新',`],
  [`    def: '把较早的 instant 从活跃 Timeline 移到归档区，只搬元数据',`, `    def: '把旧的 instant 移到归档区，只搬元数据',`],
  // 新增 Hive Metastore（服务 T06/F07/E10 的术语卡，不属于 24 个核心词但真实存在且被频繁使用）
  [`  {
    term: 'BLOOM Index',`, `  {
    term: 'Hive Metastore',
    en: 'Hive Metastore (HMS)',
    def: 'Hive 元数据服务，保存表结构与分区信息',
    firstTopic: 'T06',
    aliases: ['HMS', 'hive metastore', 'hive sync'],
  },
  {
    term: 'BLOOM Index',`],
])

patch(L, [
  // 术语卡：无新词的主题也给出本课要用的术语
  [`    glossary: [], // 本主题首次出现的术语都已在前序主题定义`, `    glossary: ['Timeline', 'File Group'],`],
  [`    takeaway: '三种配置的差别在"目录是否带 dt= 前缀"和"分区列是否还写进数据文件"；读法必须与配置匹配',
    glossary: [],`, `    takeaway: '三种配置的差别在"目录是否带 dt= 前缀"和"分区列是否还写进数据文件"；读法必须与配置匹配',
    glossary: ['Partition Path'],`],
  [`    takeaway: '写成功 ≠ 下游能查到；HMS 同步补的是表结构、分区与存储位置这份元数据',
    glossary: [],`, `    takeaway: '写成功 ≠ 下游能查到；HMS 同步补的是表结构、分区与存储位置这份元数据',
    glossary: ['Hive Metastore', 'Partition Path'],`],
  [`    takeaway: '表配置落盘在 .hoodie/hoodie.properties，每次写入都读它；结构性配置建表后不能随意改',
    glossary: [],`, `    takeaway: '表配置落盘在 .hoodie/hoodie.properties，每次写入都读它；结构性配置建表后不能随意改',
    glossary: ['Copy On Write', 'Merge On Read', 'Precombine'],`],
  [`    takeaway: '新增可空列通常兼容；删列/改类型会破坏历史文件读取，必须拦在写入提交前',
    glossary: [],`, `    takeaway: '新增可空列通常兼容；删列/改类型会破坏历史文件读取，必须拦在写入提交前',
    glossary: ['Record Key', 'Partition Path'],`],
  [`    takeaway: '认证 → HDFS 目录权限 → HMS 库表权限是三道独立关口，断在哪一环决定报错位置',
    glossary: [],`, `    takeaway: '认证 → HDFS 目录权限 → HMS 库表权限是三道独立关口，断在哪一环决定报错位置',
    glossary: ['Hive Metastore'],`],
  [`    takeaway: '三段是独立检查：认证成功不代表有目录/表权限；定位就是找"最后通过的那一步"',
    glossary: [],`, `    takeaway: '三段是独立检查：认证成功不代表有目录/表权限；定位就是找"最后通过的那一步"',
    glossary: ['Hive Metastore'],`],

  // 代表主题旁白补到 45–90 字
  [`    '看到更新以 Log File 追加，仍属于同一个 File Group；因为 MOR 的更新先写日志、不改 Base，所以读取时要靠 Slice 同时看到 Base 与 Log 才能得到最新值。',`,
   `    '看到更新以 Log File 追加，文件仍属于同一个 File Group；因为 MOR 的更新先写日志、不改 Base 文件，所以读取时要靠 File Slice 同时看到 Base 与 Log 才能得到最新值。',`],
  [`    '看到执行后产生新 Base，旧文件仍物理存在但已不被当前 Slice 引用；因为 Compaction 换的是引用、Clean 才删文件，所以空间释放要等 Clean 的保留窗口过去。',`,
   `    '看到执行后产生新的 Base File（列式 parquet 数据文件），旧文件仍物理存在但已不被当前 Slice 引用；因为 Compaction 换的只是引用、Clean 才真正删文件，所以空间释放要等 Clean 的保留窗口过去。',`],
  [`    '看到读优化只选择 Base File，Log 文件被明确跳过；因为 Read Optimized 的语义就是“只读 Base”，所以它读得快，但看不到只存在于 Log 的新更新。',`,
   `    '看到读优化只选择 Base File，Log 文件被明确跳过不读；因为 Read Optimized 的语义就是只读 Base，所以它读得很快，却完全看不到只存在于 Log 里的新更新。',`],
  [`    '看到更新已经写进 Log，但本次读取完全不参与；因为读优化不合并 Log，所以 1001 的金额仍停留在 Base 里的旧值 100.5。',`,
   `    '看到更新已经写进 Log File，但本次读取完全不参与；因为读优化根本不合并 Log，所以 1001 的金额仍停留在 Base 文件里的旧值 100.5。',`],
  [`    '看到切换为 Snapshot 后读到 200；因为 Snapshot 会合并 Base 与全部 Log，所以“MOR 表必须及时 Compaction”的根因就是两种读法的可见性差异。',`,
   `    '看到切换为 Snapshot 后读到 200；因为 Snapshot 会合并 Base 与全部 Log File，所以“MOR 表必须及时 Compaction”的根因就是两种读法在可见性上的差异。',`],
  [`    '看到 Schedule 把计划写成 REQUESTED instant；因为 Timeline 上的状态就是事务的真实状态，所以此时能确认“计划已生成、但数据还没变”。',`,
   `    '看到 Schedule 把这次合并的计划写成 REQUESTED 的 instant；因为 Timeline 上的状态就是事务的真实状态，所以此时能确认“计划已生成、但数据文件还没变”。',`],
  [`    '看到生成新的 parquet Base（同一 File ID），Timeline 上的 compaction instant 变为 COMPLETED；因为新 Base 提交后快照读只需读 Base，所以读放大下降、查询变快。',`,
   `    '看到生成新的 parquet Base File（同一 File ID），Timeline 上的 compaction instant 从 INFLIGHT 变为 COMPLETED；因为只有提交完成的新 Base 才进入可见版本，所以读放大下降、查询变快。',`],
  [`    '看到旧 Base 与 Log 变为 SUPERSEDED，却仍出现在 HDFS 文件列表里；因为 Compaction 只改引用、Clean 才做物理删除，所以“合并成功”不等于“空间立刻释放”。',`,
   `    '看到旧 Base File 与 Log File 变为 SUPERSEDED，却仍出现在 HDFS 的文件列表里；因为 Compaction 只改 Timeline 的引用、Clean 才做物理删除，所以“合并成功”不等于“空间立刻释放”。',`],

  // 清除残留免责话术
  [`    '看到两层配置组合后的写入路径；因为本页演示的是语义分层而不是 Spark 执行，所以真实作业要按 r26 的运行结果核对。',`,
   `    '看到两层配置组合后的写入路径；因为 SaveMode 与 operation 分别控制不同层，所以报错位置取决于先失败的是哪一层。',`],
  [`    '看到结果可查询核对；因为本页执行的是本地写入模型，所以文件结构一致但真实 Spark 行为需现场验证。',`,
   `    '看到结果可查询核对；因为底层 Writer 与 SQL 入口相同，所以文件结构一致，差异只在参数映射。',`],
  [`    '看到把作业选项对齐为 BUCKET 后定位路径变为哈希计算；因为本页只演示配置对齐后的定位差异，所以真实作业是否恢复仍需在 r26 重跑确认。',`,
   `    '看到把作业选项对齐为 BUCKET 后定位路径变为哈希计算；因为定位差异只由配置对齐引起，所以真实作业是否恢复仍需在 r26 重跑确认。',`],
  [`    '看到 Metadata Table 用元数据表替代列举；因为收益依赖规模，所以小表上不一定值得开启，本页只演示机制。',`,
   `    '看到 Metadata Table 用元数据表替代列举；因为收益依赖规模，所以小表上不一定值得开启，开关要按文件量决定。',`],
  [`    '看到文件数与字节数指标变化；因为吞吐取决于集群资源，所以本页只演示 Log 数与文件量变化。',`,
   `    '看到文件数与字节数指标变化；因为吞吐取决于集群资源，所以这里只对比 Log 数与文件量的变化方向。',`],
])

// F08 整体覆盖（原先未改：含“不代表…”“当前未执行…”）
let text = readFileSync(L, 'utf8')
const anchor = `  A01: [`
if (!text.includes(anchor)) throw new Error('找不到 A01 锚点')
const f08 = `  F08: [
    '看到两个计算引擎共享同一套表格式；因为共享格式不等于所有配置可互换，所以跨引擎读写前必须逐项对齐关键参数。',
    '看到主键、分区、表类型等关键参数需要一致；因为两侧默认值与参数名不同，所以只对齐表名或路径不足以安全混用。',
    '看到文件格式与提交协议是兼容性核对重点；因为写入链路不同，所以同一张表由两个引擎轮写时风险最高。',
    '看到跨引擎读写的验证范围要覆盖写入与查询；因为部分差异只有在实际作业里才暴露，所以要按 r26 现场结果核对。',
  ],
`
text = text.replace(anchor, f08 + anchor)
writeFileSync(L, text, 'utf8')
console.log('patched F08 override')
