<script setup lang="ts">
/**
 * AnimatedCatalogView —— 全部 80 个动画主题
 * ---------------------------------------------------------------------------
 * 整改前：卡片只有「编号 / 模块 / 标题 / 状态徽标」，写好的 summary 一句都不显示；
 * 搜索只匹配 `id + title`，搜「文件组」「日志」0 命中；没有任何学习状态。
 * 现在：卡片显示一行 summary + 难度 + 时长 + 学习状态，搜索覆盖
 * id / 标题 / summary / 别名 / 术语表（含中文别名）。
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { CATALOG, MODULES } from '@/experiments/catalog'
import { MODEL_LABEL, visualLesson } from '@/experiments/visual/lessons'
import { GLOSSARY } from '@/experiments/visual/glossary'
import type { SceneKind } from '@/experiments/visual/types'
import { useLabStore } from '@/app/stores/lab'
import { useLessonStore } from '@/app/stores/lesson'
import TopicPreview from '@/components/visual/TopicPreview.vue'
import VisualNav from '@/components/visual/VisualNav.vue'

const lab = useLabStore()
const lessonStore = useLessonStore()
const route = useRoute()

const search = ref('')
const selected = ref(typeof route.query.module === 'string' ? route.query.module : 'all')
const model = ref('all')
const showDone = ref<'all' | 'todo' | 'done'>('all')

/** 术语表里的词条也参与搜索：搜「文件组」能命中 File Group 首次出现的主题 */
const glossaryIndex = computed(() => {
  const map = new Map<string, string[]>()
  for (const item of GLOSSARY) {
    const keys = [item.term, item.en, ...(item.aliases ?? [])]
    map.set(item.firstTopic, [...(map.get(item.firstTopic) ?? []), ...keys])
  }
  return map
})

const lessons = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return CATALOG.filter((entry) => {
    if (selected.value !== 'all' && entry.moduleId !== selected.value) return false
    if (model.value !== 'all' && (visualLesson(entry.id)?.model ?? 'engine') !== model.value) return false

    const progress = lessonStore.entry(entry.id)
    if (showDone.value === 'todo' && progress.mastered) return false
    if (showDone.value === 'done' && !progress.mastered) return false

    if (!kw) return true
    const corpus = [
      entry.id,
      entry.title,
      entry.summary ?? '',
      ...(entry.aliases ?? []),
      ...(glossaryIndex.value.get(entry.id) ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return corpus.includes(kw)
  })
})

function modelOf(id: string): SceneKind | 'compare' {
  if (id === 'B02' || id === 'B03') return 'compare'
  return visualLesson(id)?.kind ?? 'files'
}

function typeLabel(id: string): string {
  return id === 'B02' || id === 'B03' ? '双路径对比' : MODEL_LABEL[visualLesson(id)?.model ?? 'engine']
}

function statusOf(id: string): { text: string; kind: string } {
  const progress = lessonStore.entry(id)
  if (progress.mastered) return { text: '已掌握', kind: 'is-done' }
  if (progress.watched) return { text: '已看完', kind: 'is-watched' }
  if (progress.visited) return { text: '已访问', kind: 'is-visited' }
  return { text: '未开始', kind: '' }
}
</script>

<template>
  <div class="visual-home animated-catalog" :class="{ 'vl-light': !lab.darkMode }">
    <VisualNav :crumbs="[{ text: '全部主题' }]" />

    <main class="catalog-main">
      <div class="catalog-heading">
        <div>
          <span class="vl-eyebrow">{{ CATALOG.length }} 个主题 · {{ MODULES.length }} 个模块 · 先观察，再操作</span>
          <h1>Hudi Lab 动画实验</h1>
          <p>选一个你想弄懂的问题，从动画开始。</p>
        </div>
        <label class="catalog-search">
          <span>⌕</span>
          <input v-model="search" type="search" placeholder="搜索主题、编号、术语或关键词" aria-label="搜索动画实验" />
        </label>
      </div>

      <nav class="catalog-filters" aria-label="模块筛选">
        <button :class="{ active: selected === 'all' }" @click="selected = 'all'">全部 <span>{{ CATALOG.length }}</span></button>
        <button
          v-for="module in MODULES"
          :key="module.id"
          :class="{ active: selected === module.id }"
          @click="selected = module.id"
        >
          {{ module.shortTitle }} <span>{{ CATALOG.filter((e) => e.moduleId === module.id).length }}</span>
        </button>
      </nav>

      <div class="catalog-status">
        <span>{{ lessons.length }} 个可播放主题</span>
        <div class="catalog-status-controls">
          <label>
            演示范围
            <select v-model="model" aria-label="演示范围">
              <option value="all">全部类型</option>
              <option value="engine">引擎驱动</option>
              <option value="mixed">引擎 + 机制示意</option>
              <option value="concept">机制示意</option>
            </select>
          </label>
          <label>
            学习状态
            <select v-model="showDone" aria-label="学习状态">
              <option value="all">全部</option>
              <option value="todo">未掌握</option>
              <option value="done">已掌握</option>
            </select>
          </label>
        </div>
      </div>

      <div class="catalog-grid">
        <RouterLink
          v-for="entry in lessons"
          :key="entry.id"
          :to="`/experiment/${entry.id}`"
          class="catalog-card"
          :class="statusOf(entry.id).kind"
        >
          <div class="catalog-card-meta">
            <span>{{ entry.id }} · {{ MODULES.find((m) => m.id === entry.moduleId)?.shortTitle }}</span>
            <span>{{ typeLabel(entry.id) }}</span>
          </div>
          <TopicPreview :kind="modelOf(entry.id)" />
          <h2>{{ entry.title }}</h2>
          <p class="catalog-card-summary">{{ entry.summary }}</p>
          <div class="catalog-card-tags">
            <span v-if="entry.difficulty" class="catalog-tag">难度 {{ entry.difficulty }}</span>
            <span v-if="entry.minutes" class="catalog-tag">约 {{ entry.minutes }} 分钟</span>
            <span
              class="catalog-tag"
              :class="entry.supportState === 'unverified' || entry.evidenceLevel === 'E0' ? 'is-warn' : ''"
            >
              {{ entry.supportState === 'unverified' || entry.evidenceLevel === 'E0' ? 'r26 待验证' : '教学模型' }}
            </span>
          </div>
          <div class="catalog-card-bottom">
            <span :class="statusOf(entry.id).kind">{{ statusOf(entry.id).text }}</span>
            <span>{{ lessonStore.entry(entry.id).visited ? '继续' : '开始观察' }} →</span>
          </div>
        </RouterLink>
      </div>

      <div v-if="!lessons.length" class="catalog-empty">
        <p>没有找到匹配的动画。</p>
        <button @click="search = ''; selected = 'all'; model = 'all'; showDone = 'all'">清除筛选</button>
      </div>

      <p class="catalog-footnote">
        引擎驱动展示本地模拟结果；机制示意展示组件关系与处理关口，未执行真实集群服务。点击卡片上的范围标签可查看边界。
      </p>
    </main>

    <footer class="vl-footer">
      <span>HUAWEI MRS r26 · 纯浏览器模拟</span>
      <span>看动画 → 亲手操作 → 解释 → 代码</span>
    </footer>
  </div>
</template>

<style src="../styles/visual-lab.css"></style>

<style scoped>
.catalog-main {
  max-width: 1320px;
  padding: 45px 36px;
  margin: auto;
}
.catalog-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 25px;
  flex-wrap: wrap;
}
.catalog-heading h1 {
  font-size: 34px;
  letter-spacing: -1px;
  margin: 12px 0 8px;
}
.catalog-heading p {
  color: var(--vl-muted);
  font-size: var(--vl-fs-md, 14px);
  margin: 0;
}
.catalog-search {
  display: flex;
  align-items: center;
  border: 1px solid var(--vl-line);
  border-radius: 8px;
  padding: 10px 14px;
  width: 300px;
  gap: 12px;
}
.catalog-search input {
  background: transparent;
  outline: none;
  border: 0;
  color: var(--vl-ink);
  font-size: var(--vl-fs-sm, 13px);
  width: 100%;
}
.catalog-search span {
  font-size: 24px;
  color: var(--vl-muted);
}
.catalog-filters {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin: 28px 0 18px;
}
.catalog-filters button {
  font-size: var(--vl-fs-xs, 12px);
  padding: 8px 12px;
}
.catalog-filters button.active {
  background: var(--vl-accent);
  color: var(--vl-bg);
}
.catalog-filters button span {
  opacity: 0.6;
  margin-left: 8px;
  font: var(--vl-fs-xs, 12px) ui-monospace, monospace;
}
.catalog-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  border-top: 1px solid var(--vl-line);
  padding: 15px 0;
  color: var(--vl-muted);
  font-size: var(--vl-fs-xs, 12px);
}
.catalog-status-controls {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.catalog-status select {
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 5px;
  color: var(--vl-ink);
  font-size: var(--vl-fs-xs, 12px);
  margin-left: 8px;
  padding: 6px;
}
.catalog-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 17px;
}
.catalog-card {
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid var(--vl-line);
  border-radius: 11px;
  background: var(--vl-panel);
  text-decoration: none;
  transition: border-color 0.15s, transform 0.15s;
}
.catalog-card:hover {
  border-color: #86ab8a;
  transform: translateY(-2px);
}
.catalog-card-meta {
  display: flex;
  justify-content: space-between;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  gap: 6px;
}
.catalog-card .topic-preview {
  margin: 16px 0;
}
.catalog-card h2 {
  font-size: var(--vl-fs-md, 14px);
  font-weight: 500;
  line-height: 1.6;
  margin: 0 0 8px;
  color: var(--vl-ink);
}
.catalog-card-summary {
  margin: 0 0 12px;
  font-size: var(--vl-fs-xs, 12px);
  line-height: 1.7;
  color: var(--vl-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.catalog-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.catalog-tag {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  border: 1px solid var(--vl-line);
  border-radius: 999px;
  padding: 2px 9px;
}
.catalog-tag.is-warn {
  color: var(--vl-warn, #d9a441);
  border-color: currentColor;
}
.catalog-card-bottom {
  display: flex;
  justify-content: space-between;
  margin-top: auto;
  color: var(--vl-muted);
  font-size: var(--vl-fs-xs, 12px);
}
.catalog-card-bottom > span:last-child {
  color: var(--vl-accent);
}
.catalog-card-bottom > span.is-done {
  color: var(--vl-accent);
}
.catalog-empty {
  padding: 40px 0;
  text-align: center;
  color: var(--vl-muted);
}
.catalog-empty button {
  margin-top: 12px;
  background: none;
  border: 1px solid var(--vl-line);
  color: var(--vl-ink);
  padding: 8px 16px;
  border-radius: 7px;
  cursor: pointer;
  font-size: var(--vl-fs-sm, 13px);
}
.catalog-footnote {
  margin-top: 26px;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
  line-height: 1.8;
}
@media (max-width: 1100px) {
  .catalog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 700px) {
  .catalog-main {
    padding: 28px 18px 50px;
  }
  .catalog-search {
    width: 100%;
  }
  .catalog-grid {
    grid-template-columns: 1fr;
  }
}
</style>
