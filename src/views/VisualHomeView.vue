<script setup lang="ts">
/**
 * VisualHomeView —— 首页
 * ---------------------------------------------------------------------------
 * 整改前：首页只有一句 slogan + 一张精选卡 + 8 个问题缩略图，
 * 没有学习路径、没有术语表入口、没有任何「我学到哪了」的反馈。
 * 现在补上：继续学习、学习路径、按模块浏览、术语表入口。
 */
import { computed } from 'vue'

import { CATALOG, MODULES } from '@/experiments/catalog'
import { useLabStore } from '@/app/stores/lab'
import { useLessonStore } from '@/app/stores/lesson'
import TopicPreview from '@/components/visual/TopicPreview.vue'
import VisualNav from '@/components/visual/VisualNav.vue'

const lab = useLabStore()
const lessonStore = useLessonStore()

/** 首页精选的八个问题 */
const topicIds = ['B08', 'B02', 'W02', 'I03', 'S04', 'S01', 'S06', 'S08']
const topicKinds = ['schema', 'compare', 'files', 'index', 'files', 'timeline', 'files', 'timeline'] as const
const topics = [
  'Hudi 是如何存储数据的？',
  'COW 和 MOR 有什么区别？',
  'Hudi 是如何更新数据的？',
  'Bucket 索引如何定位记录？',
  'Compaction 如何合并文件？',
  'Timeline 如何管理事务？',
  'Cleaner 如何清理旧文件？',
  '发生故障后如何恢复？',
]

/** 继续学习：最近访问过、还没看完的主题 */
const continueTopic = computed(() => {
  const candidates = Object.entries(lessonStore.progress)
    .filter(([, e]) => e.visited && !e.watched)
    .sort((a, b) => b[1].lastSeen - a[1].lastSeen)
  const first = candidates[0]
  if (!first) return undefined
  const entry = CATALOG.find((e) => e.id === first[0])
  return entry ? { entry, progress: first[1] } : undefined
})

/** 模块总览：每个模块的完成情况 */
const moduleStats = computed(() =>
  MODULES.map((module) => {
    const topicsInModule = CATALOG.filter((e) => e.moduleId === module.id)
    const done = topicsInModule.filter((e) => lessonStore.entry(e.id).mastered).length
    return { module, total: topicsInModule.length, done }
  }),
)
</script>

<template>
  <div class="visual-home" :class="{ 'vl-light': !lab.darkMode }">
    <VisualNav />

    <main class="vh-main">
      <div class="vl-eyebrow">LEARN BY SEEING. UNDERSTAND BY DOING.</div>
      <h1>让数据流动，<br />让原理<span>看得见。</span></h1>
      <p class="vh-intro">一个操作，一次变化。用交互动画建立你的 Hudi 直觉。</p>

      <!-- 继续学习 -->
      <RouterLink v-if="continueTopic" class="vh-continue" :to="`/experiment/${continueTopic.entry.id}`">
        <div>
          <span class="vl-eyebrow">继续学习</span>
          <h3>{{ continueTopic.entry.title }}</h3>
          <p>{{ continueTopic.entry.id }} · 上次看到第 {{ continueTopic.progress.step + 1 }} 步</p>
        </div>
        <span class="vh-continue-btn">继续 →</span>
      </RouterLink>

      <RouterLink to="/experiment/B02" class="vh-feature">
        <div>
          <span class="vl-eyebrow">精选实验 / 约 1 分钟建立直觉</span>
          <h2>同一条更新，<br />两种不同的写入方式。</h2>
          <p>并排观察 COW 重写 Base、MOR 追加 Log，<br />再亲手执行一次 Compaction。</p>
          <span class="vh-start">开始 COW / MOR 实验 →</span>
        </div>
        <svg viewBox="0 0 430 230" aria-hidden="true">
          <path d="M20 115H105M105 115L175 60H240M105 115L175 180H240" fill="none" stroke="var(--vl-muted)" stroke-dasharray="5 7" />
          <circle r="6" fill="#bfe7b1"><animateMotion dur="4s" repeatCount="indefinite" path="M20 115H105L175 60H240" /></circle>
          <circle r="6" fill="#d8b975"><animateMotion dur="4s" repeatCount="indefinite" path="M20 115H105L175 180H240" /></circle>
          <rect x="240" y="20" width="160" height="80" rx="10" fill="var(--vl-base-bg)" stroke="#79a99a" />
          <text x="260" y="49" fill="var(--vl-ink)" font-size="16">COW · 新 Base</text>
          <path d="M260 64H380M260 76H360" stroke="#79a99a" />
          <rect x="240" y="140" width="160" height="80" rx="10" fill="var(--vl-log-bg)" stroke="#c5a565" />
          <text x="260" y="173" fill="var(--vl-ink)" font-size="16">MOR · 追加 Log</text>
          <path d="M260 190H370" stroke="#c5a565" />
        </svg>
      </RouterLink>

      <!-- 学习路径入口 -->
      <section class="vh-paths">
        <div class="vh-section-head">
          <h2>按学习路径走</h2>
          <RouterLink to="/path" class="vh-more">全部 4 条路径 →</RouterLink>
        </div>
        <div class="vh-path-grid">
          <RouterLink
            v-for="path in [
              { to: '/path', title: '写入路径', desc: '一条记录是怎么落盘的：COW 与 MOR、文件落点、幂等与 precombine', count: '12 站' },
              { to: '/path', title: '查询路径', desc: '同一张表的四种读法：快照、读优化、增量、时间旅行', count: '7 站' },
              { to: '/path', title: '表服务路径', desc: '谁在后台收拾数据：Compaction / Clean / Archive / Rollback', count: '9 站' },
              { to: '/glossary', title: '术语表', desc: 'File Group、File Slice、Instant…… 每个术语只定义一次', count: '30 词' },
            ]"
            :key="path.title"
            :to="path.to"
            class="vh-path-card"
          >
            <span class="vh-path-count">{{ path.count }}</span>
            <h3>{{ path.title }}</h3>
            <p>{{ path.desc }}</p>
          </RouterLink>
        </div>
      </section>

      <div class="vh-topics-head">
        <h2>从一个问题开始</h2>
        <RouterLink to="/catalog" class="vh-all-topics">全部 {{ CATALOG.length }} 个动画 →</RouterLink>
      </div>
      <div class="vh-topics">
        <RouterLink v-for="(topic, i) in topics" :key="topic" :to="`/experiment/${topicIds[i]}`">
          <TopicPreview :kind="topicKinds[i]!" />
          <span class="vl-eyebrow">{{ String(i + 1).padStart(2, '0') }} / 动画实验</span>
          <h3>{{ topic }} <span>↗</span></h3>
        </RouterLink>
      </div>

      <!-- 模块总览 -->
      <section class="vh-modules">
        <div class="vh-section-head">
          <h2>按模块浏览</h2>
          <RouterLink to="/catalog" class="vh-more">全部 9 个模块 →</RouterLink>
        </div>
        <div class="vh-module-grid">
          <RouterLink
            v-for="stat in moduleStats"
            :key="stat.module.id"
            :to="`/catalog?module=${stat.module.id}`"
            class="vh-module-card"
          >
            <span class="vh-module-name">{{ stat.module.shortTitle }}</span>
            <span class="vh-module-desc">{{ stat.module.description }}</span>
            <span class="vh-module-count">{{ stat.done }} / {{ stat.total }} 已掌握</span>
          </RouterLink>
        </div>
      </section>
    </main>

    <footer class="vl-footer">
      <span>HUAWEI MRS r26 · 纯浏览器模拟</span>
      <span>看动画 → 亲手操作 → 解释 → 代码</span>
    </footer>
  </div>
</template>

<style src="../styles/visual-lab.css"></style>

<style scoped>
.vh-main {
  max-width: 1160px;
  margin: auto;
  padding: 64px 32px;
}
.vh-main > h1 {
  font-size: 52px;
  line-height: 1.25;
  letter-spacing: -2px;
  margin: 20px 0;
}
.vh-main > h1 span {
  color: var(--vl-accent);
}
.vh-intro {
  color: var(--vl-muted);
  font-size: var(--vl-fs-md, 14px);
  margin-bottom: 35px;
}
.vh-continue {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 24px;
  margin-bottom: 18px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-accent);
  border-radius: 12px;
  text-decoration: none;
}
.vh-continue h3 {
  font-size: var(--vl-fs-lg, 16px);
  margin: 8px 0 4px;
}
.vh-continue p {
  margin: 0;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.vh-continue-btn {
  background: var(--vl-accent);
  color: var(--vl-bg);
  padding: 10px 18px;
  border-radius: 8px;
  font-size: var(--vl-fs-sm, 13px);
  font-weight: 600;
  white-space: nowrap;
}
.vh-feature {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  padding: 36px 44px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 16px;
  text-decoration: none;
}
.vh-feature h2 {
  font-size: 29px;
  line-height: 1.5;
  margin: 18px 0 12px;
}
.vh-feature p {
  font-size: var(--vl-fs-sm, 13px);
  color: var(--vl-muted);
  line-height: 1.8;
}
.vh-feature svg {
  width: 46%;
}
.vh-start {
  display: inline-block;
  margin-top: 18px;
  background: var(--vl-accent);
  color: var(--vl-bg);
  padding: 11px 18px;
  border-radius: 7px;
  font-size: var(--vl-fs-sm, 13px);
}
.vh-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 46px 0 16px;
}
.vh-section-head h2 {
  font-size: 20px;
  margin: 0;
}
.vh-more {
  font-size: var(--vl-fs-xs, 12px);
  text-decoration: none;
  color: var(--vl-muted);
}
.vh-path-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}
.vh-path-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
}
.vh-path-card:hover {
  border-color: var(--vl-accent);
}
.vh-path-count {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-accent);
}
.vh-path-card h3 {
  font-size: var(--vl-fs-md, 14px);
  margin: 0;
}
.vh-path-card p {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  line-height: 1.7;
  margin: 0;
}
.vh-topics-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 46px 0 20px;
}
.vh-topics-head h2 {
  font-size: 20px;
  margin: 0;
}
.vh-all-topics {
  font-size: var(--vl-fs-xs, 12px);
  text-decoration: none;
  color: var(--vl-muted);
}
.vh-topics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.vh-topics a {
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  padding: 18px;
  text-decoration: none;
}
.vh-topics a:hover {
  background: var(--vl-panel);
}
.vh-topics svg {
  width: 100%;
  height: 65px;
  margin-bottom: 20px;
}
.vh-topics h3 {
  font-size: var(--vl-fs-sm, 13px);
  line-height: 1.7;
  margin: 10px 0;
}
.vh-topics h3 span {
  float: right;
  color: var(--vl-muted);
}
.vh-topics .vl-eyebrow {
  font-size: var(--vl-fs-xs, 12px);
  letter-spacing: 0.5px;
}
.vh-module-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.vh-module-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
}
.vh-module-card:hover {
  border-color: var(--vl-accent);
}
.vh-module-name {
  font-size: var(--vl-fs-md, 14px);
}
.vh-module-desc {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  line-height: 1.7;
}
.vh-module-count {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-accent);
}
@media (prefers-reduced-motion: reduce) {
  svg circle {
    display: none;
  }
}
@media (max-width: 850px) {
  .vh-main {
    padding: 35px 20px;
  }
  .vh-main > h1 {
    font-size: 40px;
  }
  .vh-topics {
    grid-template-columns: repeat(2, 1fr);
  }
  .vh-path-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .vh-module-grid {
    grid-template-columns: 1fr;
  }
  .vh-feature {
    padding: 24px;
  }
  .vh-feature h2 {
    font-size: 23px;
  }
  .vh-feature svg {
    width: 38%;
  }
}
</style>
