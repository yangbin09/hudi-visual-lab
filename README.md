# Hudi Lab

> 动画界面已扩展：打开 `/catalog` 浏览全部 **80 个可播放主题**，或从首页八个问题进入。支持暂停、单步、回退、进度拖动、参数重算与按需详情。目录明确区分“引擎驱动”“引擎 + 机制示意”“机制示意”，不把外部服务示意当作 r26 实测。实现与边界见 [动画实验说明](docs/VISUAL_LAB.md)。


> **华为 FusionInsight / MRS 3.1.0-350-r26 定制版 Apache Hudi 0.15.0 交互式学习实验室**
>
> ⚠️ **纯浏览器模拟，不连接真实集群。**
> 本项目在浏览器里实现了一个 mini-Hudi 内核，真实复现 COW / MOR 的文件落点、
> Compaction / Clean / Archive / Rollback 的表服务语义，以及快照读 / 读优化 /
> 增量读 / 时间旅行四种查询模式。
> **它不提交任何 Spark / Flink 作业，也不连接任何华为 MRS 集群。**
> 凡是 r26 尚未实测的行为，界面上都会标注「待验证」。

---

## 目录

- [快速开始](#快速开始)
- [构建与部署](#构建与部署)
- [目录结构](#目录结构)
- [版本准确性原则](#版本准确性原则)
- [当前状态](#当前状态)
- [已知限制](#已知限制)
- [扩展一个新实验](#扩展一个新实验)
- [文档索引](#文档索引)

---

## 快速开始

环境要求：**Node.js ≥ 18**（推荐 20+）。依赖已由 `package.json` 固定，不引入新依赖。

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器（默认 http://127.0.0.1:5173）
npm run dev

# 3. 构建静态产物（输出到 dist/）
npm run build

# 4. 运行单元测试（Vitest）
npm run test

# 5. 运行端到端交互测试（Playwright）
#    首次运行需要先下载浏览器内核：
npx playwright install chromium
npm run test:e2e
```

其它脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run test:watch` | Vitest watch 模式 |
| `npm run typecheck` | `vue-tsc --noEmit` 类型检查 |
| `npm run preview` | 本地预览构建产物 |

> 单元测试只覆盖引擎与目录（`tests/unit/**`）；
> 端到端测试需要 `npm run dev` 能跑起来 —— Playwright 会通过 `webServer` 自动拉起它。

---

## 构建与部署

`npm run build` 产出的是**纯静态资源**（`dist/`：HTML + JS + CSS + 静态资源），
不依赖任何后端服务、不需要 Node 运行时，可以直接用 Nginx 托管。

最小 Nginx 配置：

```nginx
server {
    listen       80;
    server_name  hudi-lab.example.com;

    root  /var/www/hudi-lab;      # dist/ 的内容
    index index.html;

    # 单页应用：所有前端路由都回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 带 hash 的静态资源可以长期缓存
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;
}
```

部署步骤：

```bash
npm run build
# 把 dist/ 里的内容拷到 Nginx 的 root 目录
rsync -a --delete dist/ user@host:/var/www/hudi-lab/
```

> 整个站点是**纯前端**的：没有后端接口、没有数据库、没有鉴权。
> 学习进度保存在浏览器的 `localStorage` 里。

---

## 目录结构

```
hudi/
├── docs/                       # 文档
│   ├── CONTRACT.md             # 并行开发契约（唯一接口依据）
│   ├── architecture.md         # 六层架构 / 目录结构 / 状态流
│   ├── version-matrix.md       # r26 版本矩阵（组件 / 制品 / 能力状态）
│   ├── experiment-standard.md  # 实验页面统一模板 + 新增实验步骤
│   └── validation-matrix.md    # 能力 × 证据 × 验证方式 + 未完成验证项
├── src/
│   ├── models/                 # 类型定义（纯 TS）
│   │   ├── hudi.ts             # 表 / 记录 / File Group / File Slice / Instant
│   │   ├── actions.ts          # SimulationAction
│   │   ├── evidence.ts         # 证据与能力
│   │   └── simulation.ts       # 事件 / 结果 / 实验定义
│   ├── engine/                 # ★ 模拟引擎（纯 TS，唯一能改状态的地方）
│   │   ├── core/               # state / instant / errors / applyAction
│   │   ├── operations/         # rules / writes / deletes / services
│   │   ├── filesystem/         # HDFS 目录树与文件命名
│   │   ├── indexes/            # 索引规则与分桶
│   │   ├── queries/            # 四种读路径
│   │   ├── templates/          # Spark SQL / Flink SQL / Scala / Shell 模板
│   │   ├── versions/           # r26 版本档案
│   │   └── evidenceMap.ts      # 动作 → 证据 id
│   ├── evidence/               # 证据仓库（华为 r26 + 社区 0.15）
│   ├── experiments/            # 实验定义 + 目录（catalog）+ 注册表（registry）
│   ├── components/             # 可视化与面板组件
│   ├── views/                  # 路由级页面（Dashboard / Experiment / Evidence / Progress）
│   ├── app/                    # 布局、路由、pinia store
│   ├── testing/                # 测试数据工厂（仅测试引用）
│   └── styles/                 # 设计 token 与全局样式
├── tests/
│   ├── unit/                   # Vitest 单元测试（引擎 / 目录 / 模板）
│   └── e2e/                    # Playwright 交互测试
├── vitest.config.ts
├── playwright.config.ts
├── index.html
└── README.md
```

一句话概括分工：

- `src/engine/**` —— **唯一**能改变表状态的地方（文件落点、索引映射、Timeline 变化）。
- `src/views` + `src/components` —— 只渲染状态、只派发动作，**不实现任何 Hudi 业务规则**。
- `src/evidence/**` —— 结论到证据的映射，E0~E4 分级。
- `src/engine/versions/**` —— 唯一允许出现「版本差异」的地方。

详见 [docs/architecture.md](./docs/architecture.md)。

---

## 版本准确性原则

这个项目最容易出错的地方不是代码，而是**把「社区 Hudi 支持」说成「华为 r26 支持」**。
因此定下三条硬原则：

### 原则一：社区 0.15 支持 ≠ 华为 r26 支持

社区文档（E1）只能说明 **Apache Hudi 0.15.0** 的行为。
凡是要在 MRS 3.1.0-350-r26 上成立的结论，都必须叠加华为官方文档（E2），
否则一律标注「待 r26 实测」。

### 原则二：无证据不落结论

没有依据的能力一律标 `unverified`（并写明待确认的问题），
未登记的能力走保守默认（`capabilityOf` 返回 `unverified`），
**不允许**「先按 supported 处理，等以后再补证据」。

### 原则三：不伪造执行结果

本项目所有画面都是**本地模拟**的输出，不是集群执行结果。
因此：

- 证据库里 **E4（r26 集群实测）条目恒为 0**，`hasFieldVerifiedEvidence()` 恒为 `false`；
- 实验目录里**不出现 E3 / E4** 条目（由 `tests/unit/catalog.spec.ts` 断言守住）——
  E3 只到「制品坐标存在」这一层，不能支撑行为级结论；
- 界面上凡是 r26 未确认的行为，一律带「待验证」徽标。

### 证据分级 E0~E4

| 等级 | 含义 | 能支撑什么 | 不能支撑什么 |
| --- | --- | --- | --- |
| **E0** | 研究笔记 / 工程推演 | 只能作为「待确认」的提示 | 不能作为任何行为结论的依据 |
| **E1** | Apache Hudi 0.15 社区文档 | 社区 0.15 的语法与语义 | 不能代表华为 r26 的行为 |
| **E2** | 华为官方文档 | 文档里写明的行为与前提 | 不能替代实测；注意文档的版本分节（3.1.x / 3.2.0+） |
| **E3** | r26 制品坐标 / 版本目录 | 「该组件在 r26 中存在」 | 不能支撑行为级断言 |
| **E4** | r26 集群实测 | 行为级结论 | **本项目当前一条都没有** |

当前证据库：**15 条**（E0×1、E1×5、E2×2、E3×7、E4×0）。
详见 [docs/version-matrix.md](./docs/version-matrix.md)。

---

## 当前状态

### 阶段 0 已完成

| 交付物 | 状态 |
| --- | --- |
| 模拟引擎内核（状态 / instant / 写入 / 删除 / 表服务 / 目录布局 / 索引 / 查询 / 模板） | ✅ 完成 |
| 统一动作调度器 `applyAction`（失败零状态变更、成功写 checkpoint、产出可追溯差异） | ✅ 完成 |
| r26 版本档案（19 个能力键 + 配置名映射 + 操作约束） | ✅ 完成 |
| 证据仓库（15 条，E0~E3，含 `hudi-spark-common` 在 r26 **不存在**的负向证据） | ✅ 完成 |
| 实验目录（9 个模块 / 80 条，条目数 8/8/10/8/8/12/8/10/8） | ✅ 完成 |
| 可视化与面板组件（目录树 / Timeline / 记录表 / Bucket / SQL / 证据 / 练习 / 日志 / 边界场景） | ✅ 完成 |
| 第一个可交互实验 **B02**（COW vs MOR，对应目录条目 B02 与 B03） | ✅ 完成 |
| 单元测试 **153 条**（`tests/unit/**`，覆盖写入语义、文件模型、分区、分桶、Timeline、Compaction、Clean、能力拒绝、查询、模板、目录） | ✅ 全绿 |
| 端到端测试 **52 条**（`tests/e2e/**`：冒烟 + 交互 + 布局适配），跑 4 种分辨率（1920×1080 / 1440×900 / 1366×768 / 800 窄屏） | ✅ 全绿 |
| 文档（架构 / 版本矩阵 / 实验规范 / 验证矩阵 / 并行开发契约 / 本 README） | ✅ 完成 |

### 实验进度

需求规划首批交付 **15 个可交互实验**；当前进度：

| 状态 | 数量 | 说明 |
| --- | --- | --- |
| 已实现（可交互） | **1** | B02「COW vs MOR」——同时覆盖目录条目 **B02** 与 **B03** |
| 目录已登记但未实现 | 78 | 分布在 9 个模块（A~I） |
| 其中标记为 `implemented: true` 的目录条目 | 2 | B02、B03（均指向 B02 这一份实验定义） |

按模块的目录配额与完成情况：

| 模块 | 主题 | 目录条目 | 已实现 |
| --- | --- | --- | --- |
| A | 基础原理 | 8 | 2（B02、B03） |
| B | 建表与分区 | 8 | 0 |
| C | 数据写入 | 10 | 0 |
| D | 索引机制 | 8 | 0 |
| E | 数据查询 | 8 | 0 |
| F | Timeline 与表服务 | 12 | 0 |
| G | Spark / Flink 集成 | 8 | 0 |
| H | 生产故障实验室 | 10 | 0 |
| I | 高级专题 | 8 | 0 |
| **合计** | | **80** | **2** |

### 下一步计划

1. **按模块推进实验**：优先 C（写入）→ E（查询）→ F（表服务），
   每完成一个实验同步更新 `docs/validation-matrix.md`。
2. **r26 实测**：按 `docs/validation-matrix.md` §3.1 的 10 项待办逐条采集证据，
   把 E0/E1 的结论升级成 E2/E4，把 `unverified` 的能力逐个收敛。
3. **BUCKET 索引**：拿到 r26 实际分桶算法后替换教学示意实现。
4. **接入真实环境（可选，阶段 4）**：另建独立的 Java 17 / Spring Boot 只读服务，
   对接测试集群的 Spark SQL 执行入口、YARN RM API、HDFS 只读浏览与 Hudi Timeline 解析。
   **浏览器不得直接持有生产 Kerberos 凭据，写入类操作必须限定测试库与独立凭据。**

### 阶段 0 期间已修复的模拟内核缺陷

| 缺陷 | 现象 | 修复 |
| --- | --- | --- |
| `findFileGroupForKey` 未排除已被取代的 File Group | COW 连续两次更新同一主键时，新旧两个 File Group 同时「有效」，第二次更新丢记录 | 查找时过滤 `supersededBy` |
| COW 重写未按主键去重 | 新 base file 内同一主键出现两行（真实 Hudi 的 parquet 不允许） | 写盘前用 `mergeRecords` 归并为生效版本 |
| `precombine` 判定发生在写盘之后 | 文件层已写入新版本，逻辑视图才忽略，短暂不一致 | 判定前移到写盘之前，被忽略的记录不进入任何文件 |
| `renderTree` 丢失分区目录名 | 分区路径以 `/` 结尾，`split('/').pop()` 得到空串，目录行渲染成「`-- /」 | 先剥离尾部 `/` 再取名 |
| MOR `buildLogFile` 少传参数 | MOR 更新路径运行时抛 `Cannot read properties of undefined` | 补齐 `records` 参数 |
| `HudiVersionProfile` 导入路径错误 | `vue-tsc --noEmit` 编译失败 | 改为从 `@/models/hudi` 导入 |
| `instantFileName` 的 `never` 分支 | 同上，TS2339 | 改为 `const unreachable: never = action` |
| 三栏布局在窄屏塌陷 | 低于 `xl` 断点时 `min-h-0` 把行压扁，标题被裁切 | 窄屏改自然高度 + 整体滚动，宽屏保留 `grid-rows-1` |
| `el-alert` 在 flex 列容器里被压扁 | 「纯浏览器模拟」警示横幅只显示一半 | 关键横幅加 `shrink-0` |

---

## 已知限制

1. **全部是模拟**。
   页面上的文件树、Timeline、instant、查询结果都由本仓库的 mini-Hudi 内核在浏览器里算出，
   **没有提交过任何 Spark / Flink 作业**。它复现的是**语义**，不是 r26 的字节级行为。

2. **r26 行为待实测**。
   社区文档（E1）与华为文档（E2）都不是 r26 现场实测（E4）。
   例如 MOR 首次写入到底落在 log-only File Group 还是 base file、
   `run clean on` 在 MRS 3.1.x 上是否存在，都还需要现场确认。
   详见 [docs/validation-matrix.md](./docs/validation-matrix.md) §3.1。

3. **BUCKET 分桶算法是教学示意**。
   当前实现用 djb2 取模（`teachingHash`），
   **r26 的实际分桶哈希与 File Group 分配规则尚未确认**。
   界面上由 `BUCKET_ALGORITHM_NOTE` 显式标注，不得当作 r26 行为。

4. **时间旅行是近似实现**。
   有 checkpoint 时读的是该 instant 的完整快照；
   没有 checkpoint 时回退为「按 `commitTime ≤ asOf` 过滤当前记录」，
   只能还原到主键粒度的近似值 —— 界面已明确标注。

5. **文件名格式是简化教学显示**。
   真实文件名由 `HoodieFileNameParser` 决定，
   本项目的命名函数（`baseFileName` / `logFileName`）**未逐字节对齐**，
   界面上由 `SIMPLIFIED_NOTE` 显式标注。

6. **文件名/大小是估算值**。
   文件大小按固定 `AVG_RECORD_BYTES = 96` 估算，只影响「合计大小」显示，不影响任何语义。

7. **部分能力只登记未实现**。
   `metadata-table`（Metadata Table）与 Kerberos 权限链路目前只有档案与模板，没有模拟实现。

8. **并发写（OCC）未建模**。
   同一 File Group 的并发 upsert 冲突没有模拟，H 模块的并发实验尚未实现。

---

## 扩展一个新实验

以新增目录条目 `C07` 为例，完整步骤见
[docs/experiment-standard.md](./docs/experiment-standard.md) §2。速查：

1. **写定义文件** —— `src/experiments/write/C07Xxx.ts` 导出一个 `ExperimentDefinition`
   （标题、步骤、控制项、边界场景、练习题、证据 id、`createState` 工厂）。
   初始状态**必须走引擎写入通道**（`applyAction`），不能手工拼 `records`。
2. **注册** —— 在 `src/experiments/index.ts` 里 `registerExperiment(C07)`。
3. **登记目录** —— 在 `src/experiments/modules/C.write.ts` 里加一条 `CatalogEntry`
   （`implemented: true` + `experimentId` + 证据等级 + 支持状态 + `note`）。
4. **视图接入** —— 通用实验无需改视图代码；
   需要专属交互时导出「控制项 → 状态工厂」映射并在 `ExperimentView.vue` 里按 id 接入
   （**只写参数替换与工厂调用，不写 Hudi 规则**）。
5. **补单测** —— 引擎行为放 `tests/unit/<主题>.spec.ts`；
   可复用的表定义与种子数据放 `src/testing/factories.ts`；
   目录相关的断言（数量、等级、证据引用）在 `tests/unit/catalog.spec.ts` 里已自动覆盖。
6. **更新文档与证据** —— 补 `src/evidence/` 的证据条目，
   在 `docs/validation-matrix.md` 登记待实测点，涉及版本差异的先在版本档案里登记能力键。

自检：

```bash
npx vitest run tests/unit
```

---

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/CONTRACT.md](./docs/CONTRACT.md) | 并行开发契约（唯一接口依据） |
| [docs/architecture.md](./docs/architecture.md) | 六层架构、目录结构、状态流、引擎原则 |
| [docs/version-matrix.md](./docs/version-matrix.md) | r26 组件版本、制品坐标（含负向证据）、能力状态表 |
| [docs/experiment-standard.md](./docs/experiment-standard.md) | 实验页面六区域模板、新增实验步骤 |
| [docs/validation-matrix.md](./docs/validation-matrix.md) | 能力 × 证据 × 验证方式，未完成验证项清单 |

---

## 许可与免责

本项目是**教学演示**：所有行为均为本地模拟，**不构成对华为 FusionInsight / MRS
产品行为的权威描述**。生产环境的 Hudi 行为请以 r26 集群实测与官方文档为准。
