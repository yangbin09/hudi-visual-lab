<script setup lang="ts">
/**
 * ProgressView —— 学习进度（视觉实验室版）
 * ---------------------------------------------------------------------------
 * 整改前：这一页挂在旧 MainLayout 里，数据来自一个**永远为空**的 store.progress
 * （80 个动画主题从不写入进度），而且视觉页里没有任何入口能到这一页。
 *
 * 现在：
 *   · 数据来自 useLessonStore（打开即写、看完即写、自测及格即写）；
 *   · 页面与其它视觉页面同一套外壳与设计语言；
 *   · 提供「继续学习」与「回到学习路径」两个出口。
 */
import { computed } from 'vue'

import { CATALOG, MODULES } from '@/experiments/catalog'
import { useLessonStore } from '@/app/stores/lesson'
import VisualNav from '@/components/visual/VisualNav.vue'

const lessonStore = useLessonStore()

interface Row {
  id: string
  title: string
  module: string
  difficulty: string
  minutes: number
  visited: boolean
  watched: boolean
  mastered: boolean
  quizScore: number
  lastSeen: number
  step: number
}

const rows = computed<Row[]>(() =>
  CATALOG.map((entry) => {
    const p = lessonStore.entry(entry.id)
    const module = MODULES.find((m) => m.id === entry.moduleId)
    return {
      id: entry.id,
      title: entry.title,
      module: module?.shortTitle ?? '—',
      difficulty: entry.difficulty ?? '—',
      minutes: entry.minutes ?? 0,
      visited: p.visited,
      watched: p.watched,
      mastered: p.mastered,
      quizScore: p.quizScore,
      lastSeen: p.lastSeen,
      step: p.step,
    }
  }),
)

const touched = computed(() => rows.value.filter((r) => r.visited))
const finished = computed(() => rows.value.filter((r) => r.watched))
const mastered = computed(() => rows.value.filter((r) => r.mastered))

/** 最近 10 个访问过的主题 */
const recent = computed(() => [...touched.value].sort((a, b) => b.lastSeen - a.lastSeen).slice(0, 10))

function timeAgo(ts: number): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const min = Math.round(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.round(min / 60)
  if (hour < 24) return `${hour} 小时前`
  return `${Math.round(hour / 24)} 天前`
}

function reset(): void {
  if (typeof window !== 'undefined' && window.confirm('清空全部学习记录？此操作不可撤销。')) {
    lessonStore.resetProgress()
  }
}
</script>

<template>
  <div class="visual-home progress-page">
    <VisualNav :crumbs="[{ text: '学习进度' }]" />

    <main class="progress-main">
      <header class="progress-head">
        <div>
          <span class="vl-eyebrow">进度保存在浏览器本地</span>
          <h1>学习进度</h1>
          <p>打开主题会记「已访问」，播放到末尾记「已看完」，自测 60 分以上且原理题正确记「已掌握」。</p>
        </div>
        <RouterLink class="progress-path-btn" to="/path">按学习路径继续 →</RouterLink>
      </header>

      <section class="progress-kpis">
        <div class="progress-kpi">
          <b>{{ touched.length }}</b><span>已访问主题</span>
        </div>
        <div class="progress-kpi">
          <b>{{ finished.length }}</b><span>已看完</span>
        </div>
        <div class="progress-kpi">
          <b>{{ mastered.length }}</b><span>已掌握</span>
        </div>
        <div class="progress-kpi">
          <b>{{ lessonStore.averageScore }}</b><span>自测平均分</span>
        </div>
      </section>

      <section v-if="recent.length" class="progress-recent">
        <h2>最近学过</h2>
        <ul>
          <li v-for="row in recent" :key="row.id">
            <RouterLink :to="`/experiment/${row.id}`">
              <span class="progress-recent-id">{{ row.id }}</span>
              <span class="progress-recent-title">{{ row.title }}</span>
              <span class="progress-recent-meta">
                {{ row.mastered ? '已掌握' : row.watched ? '已看完' : `第 ${row.step + 1} 步` }} · {{ timeAgo(row.lastSeen) }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <section class="progress-table-wrap">
        <h2>全部主题</h2>
        <table class="progress-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>主题</th>
              <th>模块</th>
              <th>难度</th>
              <th>时长</th>
              <th>状态</th>
              <th>自测</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id" :class="{ 'is-visited': row.visited }">
              <td>{{ row.id }}</td>
              <td class="progress-cell-title">{{ row.title }}</td>
              <td>{{ row.module }}</td>
              <td>{{ row.difficulty }}</td>
              <td>{{ row.minutes ? `${row.minutes} 分钟` : '—' }}</td>
              <td>
                <span v-if="row.mastered" class="progress-badge is-done">已掌握</span>
                <span v-else-if="row.watched" class="progress-badge is-watched">已看完</span>
                <span v-else-if="row.visited" class="progress-badge is-visited">已访问</span>
                <span v-else class="progress-badge">未开始</span>
              </td>
              <td>{{ row.quizScore ? `${row.quizScore} 分` : '—' }}</td>
              <td>
                <RouterLink :to="`/experiment/${row.id}`">
                  {{ row.visited ? '继续' : '开始' }} →
                </RouterLink>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div class="progress-reset">
        <button @click="reset">清空学习记录</button>
      </div>
    </main>

    <footer class="vl-footer">
      <span>HUAWEI MRS r26 · 纯浏览器模拟</span>
      <span>学习进度保存在浏览器本地</span>
    </footer>
  </div>
</template>

<style src="../styles/visual-lab.css"></style>

<style scoped>
.progress-main {
  max-width: 1160px;
  margin: auto;
  padding: 42px 32px 60px;
}
.progress-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}
.progress-head h1 {
  font-size: 34px;
  letter-spacing: -1px;
  margin: 10px 0 8px;
}
.progress-head p {
  margin: 0;
  color: var(--vl-muted);
  font-size: var(--vl-fs-md, 14px);
}
.progress-path-btn {
  background: var(--vl-accent);
  color: var(--vl-bg);
  padding: 10px 18px;
  border-radius: 8px;
  font-size: var(--vl-fs-sm, 13px);
  text-decoration: none;
  font-weight: 600;
  white-space: nowrap;
}
.progress-kpis {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin-bottom: 28px;
}
.progress-kpi {
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.progress-kpi b {
  font-size: 28px;
  color: var(--vl-ink);
}
.progress-kpi span {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.progress-recent h2,
.progress-table-wrap h2 {
  font-size: var(--vl-fs-lg, 16px);
  margin: 0 0 12px;
}
.progress-recent ul {
  list-style: none;
  margin: 0 0 30px;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 8px;
}
.progress-recent a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
}
.progress-recent a:hover {
  border-color: var(--vl-accent);
}
.progress-recent-id {
  font-family: ui-monospace, monospace;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-accent);
}
.progress-recent-title {
  font-size: var(--vl-fs-sm, 13px);
  color: var(--vl-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.progress-recent-meta {
  margin-left: auto;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  white-space: nowrap;
}
.progress-table-wrap {
  overflow-x: auto;
}
.progress-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--vl-fs-sm, 13px);
}
.progress-table th,
.progress-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--vl-line);
  white-space: nowrap;
}
.progress-table th {
  color: var(--vl-muted);
  font-weight: 500;
  font-size: var(--vl-fs-xs, 12px);
}
.progress-cell-title {
  white-space: normal;
  min-width: 220px;
  color: var(--vl-ink);
}
.progress-table tr.is-visited .progress-cell-title {
  color: var(--vl-ink);
}
.progress-badge {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  border: 1px solid var(--vl-line);
  border-radius: 999px;
  padding: 2px 9px;
}
.progress-badge.is-visited {
  color: var(--vl-ink);
}
.progress-badge.is-watched {
  color: var(--vl-ink);
  border-color: var(--vl-accent);
}
.progress-badge.is-done {
  background: var(--vl-accent);
  border-color: transparent;
  color: var(--vl-bg);
}
.progress-table a {
  color: var(--vl-accent);
  text-decoration: none;
}
.progress-reset {
  margin-top: 20px;
}
.progress-reset button {
  background: none;
  border: 1px solid var(--vl-line);
  color: var(--vl-muted);
  font-size: var(--vl-fs-xs, 12px);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}
@media (max-width: 850px) {
  .progress-main {
    padding: 28px 18px 50px;
  }
}
/* 触屏：可点元素不小于 44×44 */
@media (pointer: coarse) {
  .progress-path-btn,
  .progress-reset button,
  .progress-table td a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 6px 12px;
  }
  .progress-table th,
  .progress-table td {
    padding-top: 14px;
    padding-bottom: 14px;
  }
  .progress-recent a {
    min-height: 44px;
  }
}
</style>
