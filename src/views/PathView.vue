<script setup lang="ts">
/**
 * PathView —— 学习路径
 * ---------------------------------------------------------------------------
 * 整改前：80 个主题只能按 9 个模块平铺浏览，学生不知道「我该按什么顺序学」，
 * 也看不出哪些主题已经学过（本产品的进度此前甚至从不写入）。
 * 本页给出 4 条纵向学习路径 + 模块总览 + 继续学习入口。
 */
import { computed } from 'vue'

import { CATALOG, MODULES, getCatalogEntry } from '@/experiments/catalog'
import { useLessonStore } from '@/app/stores/lesson'
import VisualNav from '@/components/visual/VisualNav.vue'

interface PathStep {
  id: string
  /** 这一站要解决的问题（短句） */
  why: string
}

interface LearningPath {
  id: string
  title: string
  goal: string
  minutes: number
  steps: PathStep[]
}

const PATHS: LearningPath[] = [
  {
    id: 'write',
    title: '写入路径：一条记录是怎么落盘的',
    goal: '搞懂 COW 与 MOR 的差别、文件怎么落点、幂等与 precombine 怎么保证。',
    minutes: 60,
    steps: [
      { id: 'B01', why: 'Hudi 比普通 Parquet 表多了什么' },
      { id: 'B04', why: 'File Group / File Slice 的结构' },
      { id: 'B05', why: 'Base 与 Log 的版本关系' },
      { id: 'B06', why: '记录怎么被定位' },
      { id: 'T02', why: '主键与 precombine 怎么定胜负' },
      { id: 'B02', why: 'COW：更新时重写文件' },
      { id: 'B03', why: 'MOR：更新时追加 Log' },
      { id: 'W01', why: 'Insert 写入全过程' },
      { id: 'W02', why: 'Upsert 更新全过程' },
      { id: 'W03', why: 'Delete 删除全过程' },
      { id: 'W04', why: 'Bulk Insert 为什么会失败' },
      { id: 'W05', why: '分区覆盖与整表覆盖的区别' },
    ],
  },
  {
    id: 'query',
    title: '查询路径：同一张表有四种读法',
    goal: '搞懂快照读、读优化、增量读、时间旅行的可见性与代价差异。',
    minutes: 45,
    steps: [
      { id: 'B07', why: 'MVCC 与快照读' },
      { id: 'Q01', why: 'Snapshot 读当前版本' },
      { id: 'Q02', why: 'Read Optimized 为什么会漏数据' },
      { id: 'Q03', why: 'Incremental 只读增量' },
      { id: 'Q04', why: 'Time Travel 回到历史' },
      { id: 'Q05', why: '增量读的边界条件' },
      { id: 'Q06', why: '查询失败的排查路径' },
    ],
  },
  {
    id: 'service',
    title: '表服务路径：谁在后台收拾数据',
    goal: '搞懂 Timeline 与 Compaction / Clean / Archive / Rollback 的分工。',
    minutes: 55,
    steps: [
      { id: 'S01', why: 'Instant 的生命周期' },
      { id: 'S02', why: 'Commit 与 DeltaCommit 的差别' },
      { id: 'S03', why: 'Compaction Plan 怎么生成' },
      { id: 'S04', why: 'Compaction 怎么合并文件' },
      { id: 'S05', why: '异步 Compaction 怎么调度' },
      { id: 'S06', why: 'Cleaner 什么时候能删文件' },
      { id: 'S07', why: 'Archive 归档时间线' },
      { id: 'S08', why: 'Rollback 回滚未完成事务' },
      { id: 'A05', why: 'Compaction 吞吐怎么算' },
    ],
  },
  {
    id: 'index',
    title: '索引路径：定位一条记录有多难',
    goal: '搞懂 SIMPLE / BLOOM / BUCKET / GLOBAL 四类索引的定位原理与兼容性。',
    minutes: 40,
    steps: [
      { id: 'I01', why: 'SIMPLE 怎么定位' },
      { id: 'I02', why: 'BLOOM 过滤的作用' },
      { id: 'I03', why: 'BUCKET 怎么算桶号' },
      { id: 'I05', why: 'BUCKET 怎么分配 File Group' },
      { id: 'I06', why: 'GLOBAL 与非 GLOBAL 的差别' },
      { id: 'I08', why: '索引异常怎么诊断' },
    ],
  },
]

const lessonStore = useLessonStore()

/** 每个路径的完成度 */
function pathProgress(path: LearningPath) {
  const entries = path.steps.map((step) => lessonStore.entry(step.id))
  const done = entries.filter((e) => e.mastered).length
  const seen = entries.filter((e) => e.visited).length
  return { done, seen, total: path.steps.length }
}

/** 继续学习：最近访问过、且还没看完的主题 */
const continueTopic = computed(() => {
  const candidates = Object.entries(lessonStore.progress)
    .filter(([, entry]) => entry.visited && !entry.watched)
    .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
  const first = candidates[0]
  if (!first) return undefined
  const entry = getCatalogEntry(first[0])
  return entry ? { entry, progress: first[1] } : undefined
})

const moduleStats = computed(() =>
  MODULES.map((module) => {
    const topics = CATALOG.filter((e) => e.moduleId === module.id)
    const done = topics.filter((e) => lessonStore.entry(e.id).mastered).length
    const seen = topics.filter((e) => lessonStore.entry(e.id).visited).length
    return { module, total: topics.length, done, seen }
  }),
)
</script>

<template>
  <div class="visual-home path-page">
    <VisualNav :crumbs="[{ text: '学习路径' }]" />

    <main class="path-main">
      <header class="path-head">
        <span class="vl-eyebrow">4 条路径 · 80 个主题 · 先理解，再动手</span>
        <h1>学习路径</h1>
        <p>不知道从哪开始，就按下面的路线走；每条路线都标了「这一站要解决什么问题」。</p>
      </header>

      <section v-if="continueTopic" class="path-continue">
        <div>
          <span class="vl-eyebrow">继续学习</span>
          <h2>{{ continueTopic.entry.title }}</h2>
          <p>
            {{ continueTopic.entry.id }} · 已看到第 {{ continueTopic.progress.step + 1 }} 步
          </p>
        </div>
        <RouterLink class="path-continue-btn" :to="`/experiment/${continueTopic.entry.id}`">继续 →</RouterLink>
      </section>

      <section v-for="path in PATHS" :key="path.id" class="vl-path-card">
        <header class="path-card-head">
          <div>
            <h2>{{ path.title }}</h2>
            <p>{{ path.goal }}</p>
          </div>
          <div class="path-card-meta">
            <span>{{ path.steps.length }} 站 · 约 {{ path.minutes }} 分钟</span>
            <span :class="{ done: pathProgress(path).done === pathProgress(path).total }">
              已掌握 {{ pathProgress(path).done }} / {{ pathProgress(path).total }}
            </span>
          </div>
        </header>

        <ol class="path-steps">
          <li v-for="(step, i) in path.steps" :key="step.id" :class="lessonStore.entry(step.id).mastered ? 'is-done' : ''">
            <RouterLink :to="`/experiment/${step.id}`">
              <span class="path-step-index">{{ i + 1 }}</span>
              <span class="path-step-title">{{ getCatalogEntry(step.id)?.title ?? step.id }}</span>
              <span class="path-step-why">{{ step.why }}</span>
            </RouterLink>
          </li>
        </ol>
      </section>

      <section class="path-modules">
        <h2>按模块浏览</h2>
        <div class="path-module-grid">
          <RouterLink
            v-for="stat in moduleStats"
            :key="stat.module.id"
            class="path-module-card"
            :to="`/catalog?module=${stat.module.id}`"
          >
            <span class="path-module-title">{{ stat.module.shortTitle }}</span>
            <span class="path-module-desc">{{ stat.module.description }}</span>
            <span class="path-module-count">{{ stat.done }} / {{ stat.total }} 已掌握</span>
          </RouterLink>
        </div>
      </section>
    </main>

    <footer class="vl-footer">
      <span>HUAWEI MRS r26 · 纯浏览器模拟</span>
      <span>学习进度保存在浏览器本地</span>
    </footer>
  </div>
</template>

<style src="../styles/visual-lab.css"></style>

<style scoped>
.path-main {
  max-width: 1160px;
  margin: auto;
  padding: 42px 32px 60px;
}
.path-head h1 {
  font-size: 34px;
  letter-spacing: -1px;
  margin: 10px 0 8px;
}
.path-head p {
  color: var(--vl-muted);
  font-size: var(--vl-fs-md, 14px);
  margin: 0 0 26px;
}
.path-continue {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  margin-bottom: 26px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-accent);
  border-radius: 12px;
}
.path-continue h2 {
  font-size: var(--vl-fs-lg, 16px);
  margin: 8px 0 4px;
}
.path-continue p {
  margin: 0;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.path-continue-btn {
  background: var(--vl-accent);
  color: var(--vl-bg);
  padding: 10px 18px;
  border-radius: 8px;
  font-size: var(--vl-fs-sm, 13px);
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}
.vl-path-card {
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 12px;
  padding: 20px 22px;
  margin-bottom: 18px;
}
.path-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.path-card-head h2 {
  font-size: var(--vl-fs-lg, 16px);
  margin: 0 0 6px;
}
.path-card-head p {
  margin: 0;
  font-size: var(--vl-fs-sm, 13px);
  color: var(--vl-muted);
  line-height: 1.7;
}
.path-card-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.path-card-meta .done {
  color: var(--vl-accent);
}
.path-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
  counter-reset: path;
}
.path-steps a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--vl-line);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
}
.path-steps a:hover {
  border-color: var(--vl-accent);
}
.path-steps li.is-done a {
  border-color: var(--vl-accent);
}
.path-step-index {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--vl-surface-2, var(--vl-line));
  color: var(--vl-muted);
  font-size: var(--vl-fs-xs, 12px);
  flex: none;
}
.path-steps li.is-done .path-step-index {
  background: var(--vl-accent);
  color: var(--vl-bg);
}
.path-step-title {
  font-size: var(--vl-fs-sm, 13px);
  color: var(--vl-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.path-step-why {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  margin-left: auto;
  text-align: right;
  white-space: nowrap;
}
.path-modules h2 {
  font-size: var(--vl-fs-lg, 16px);
  margin: 30px 0 14px;
}
.path-module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.path-module-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 18px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
}
.path-module-card:hover {
  border-color: var(--vl-accent);
}
.path-module-title {
  font-size: var(--vl-fs-md, 14px);
  color: var(--vl-ink);
}
.path-module-desc {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  line-height: 1.7;
}
.path-module-count {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-accent);
}
@media (max-width: 850px) {
  .path-main {
    padding: 28px 18px 50px;
  }
  .path-step-why {
    display: none;
  }
}
/* 触屏：可点元素不小于 44×44 */
@media (pointer: coarse) {
  .path-continue-btn {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
  }
  .path-steps a {
    min-height: 44px;
  }
  .path-module-card {
    min-height: 44px;
  }
}
</style>
