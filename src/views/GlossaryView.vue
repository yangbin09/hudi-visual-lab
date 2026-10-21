<script setup lang="ts">
/**
 * GlossaryView —— 术语表
 * ---------------------------------------------------------------------------
 * 审计结论：24 个核心术语在全部 315 条旁白里的定义数是 **0**；
 * 「MOR 的 Log File 是什么」需要跨 2 个页面、点 4–5 次仍拿不到答案。
 * 本页把术语集中定义一次，并标明每个术语第一次出现在哪个主题。
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { GLOSSARY } from '@/experiments/visual/glossary'
import { getCatalogEntry } from '@/experiments/catalog'
import VisualNav from '@/components/visual/VisualNav.vue'

const route = useRoute()
const keyword = ref(String(route.query.term ?? ''))
const active = ref(String(route.query.term ?? ''))

const groups = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const hit = (term: string, en: string, def: string, aliases: string[] = []) =>
    !kw ||
    [term, en, def, ...aliases].join(' ').toLowerCase().includes(kw)

  const buckets = new Map<string, typeof GLOSSARY>()
  for (const item of GLOSSARY) {
    if (!hit(item.term, item.en, item.def, item.aliases)) continue
    const key = item.aliases?.[0] ? groupOf(item.term) : groupOf(item.term)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(item)
  }
  return [...buckets.entries()].map(([group, items]) => ({ group, items }))
})

/** 按术语名粗分到六个语义组 */
function groupOf(term: string): string {
  const storage = ['File Group', 'File Slice', 'Base File', 'Log File', 'File ID']
  const timeline = ['Instant', 'Timeline', 'Checkpoint', 'Commit', 'DeltaCommit', 'Action']
  const service = ['Compaction', 'Clean', 'Archive', 'Rollback', 'Clustering', 'TTL', 'Metadata Table', 'Restore']
  const index = ['Index', 'BUCKET', 'SIMPLE', 'BLOOM', 'GLOBAL', 'Precombine', 'Record Key', 'Partition Path', 'HoodieKey']
  const query = ['Copy On Write', 'Merge On Read', 'Snapshot', 'Read Optimized', 'Incremental', 'Time Travel']
  if (storage.some((t) => term.includes(t))) return '存储结构'
  if (timeline.some((t) => term.includes(t))) return '事务与时间线'
  if (service.some((t) => term.includes(t))) return '表服务'
  if (index.some((t) => term.includes(t))) return '索引与主键'
  if (query.some((t) => term.includes(t))) return '写入与查询'
  return '集成与配置'
}
</script>

<template>
  <div class="visual-home glossary-page" :class="{ 'vl-light': false }">
    <VisualNav :crumbs="[{ text: '术语表' }]" />

    <main class="glossary-main">
      <header class="glossary-head">
        <div>
          <span class="vl-eyebrow">{{ GLOSSARY.length }} 个术语 · 中英对照 · 首次出现位置</span>
          <h1>术语表</h1>
          <p>每个术语只在这里定义一次；动画页的术语卡、证据页的引用都以本表为准。</p>
        </div>
        <label class="glossary-search">
          <span>⌕</span>
          <input v-model="keyword" type="search" placeholder="搜索术语（中文或英文）" aria-label="搜索术语" />
        </label>
      </header>

      <section v-for="group in groups" :key="group.group" class="glossary-group">
        <h2>{{ group.group }}</h2>
        <ul>
          <li
            v-for="item in group.items"
            :key="item.term"
            class="vl-glossary-item"
            :class="{ active: active === item.term }"
          >
            <button type="button" class="glossary-term" @click="active = active === item.term ? '' : item.term">
              <span class="glossary-term-name">{{ item.term }}</span>
              <span class="glossary-term-en">{{ item.en }}</span>
            </button>
            <p class="glossary-def">{{ item.def }}</p>
            <p class="glossary-alias" v-if="item.aliases?.length">
              也写作：{{ item.aliases.join(' / ') }}
            </p>
            <RouterLink
              v-if="getCatalogEntry(item.firstTopic)"
              class="glossary-first"
              :to="`/experiment/${item.firstTopic}`"
            >
              首次出现：{{ item.firstTopic }} {{ getCatalogEntry(item.firstTopic)?.title }} →
            </RouterLink>
          </li>
        </ul>
      </section>

      <p v-if="!groups.length" class="glossary-empty">
        没有匹配的术语。<button type="button" @click="keyword = ''">清除搜索</button>
      </p>
    </main>

    <footer class="vl-footer">
      <span>HUAWEI MRS r26 · 纯浏览器模拟</span>
      <span>术语口径以本页为准</span>
    </footer>
  </div>
</template>

<style src="../styles/visual-lab.css"></style>

<style scoped>
.glossary-main {
  max-width: 1160px;
  margin: auto;
  padding: 42px 32px 60px;
}
.glossary-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  flex-wrap: wrap;
  margin-bottom: 30px;
}
.glossary-head h1 {
  font-size: 34px;
  letter-spacing: -1px;
  margin: 10px 0 8px;
}
.glossary-head p {
  color: var(--vl-muted);
  font-size: var(--vl-fs-md, 14px);
  margin: 0;
}
.glossary-search {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--vl-line);
  border-radius: 8px;
  padding: 10px 14px;
  width: 280px;
}
.glossary-search input {
  background: transparent;
  outline: none;
  border: 0;
  color: var(--vl-ink);
  font-size: var(--vl-fs-sm, 13px);
  width: 100%;
}
.glossary-group {
  margin-bottom: 30px;
}
.glossary-group h2 {
  font-size: var(--vl-fs-lg, 16px);
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vl-line);
}
.glossary-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}
.vl-glossary-item {
  background: var(--vl-panel);
  border: 1px solid var(--vl-line);
  border-radius: 10px;
  padding: 14px 16px;
}
.vl-glossary-item.active {
  border-color: var(--vl-accent);
}
.glossary-term {
  display: flex;
  align-items: baseline;
  gap: 8px;
  background: none;
  border: 0;
  padding: 0;
  cursor: pointer;
  color: inherit;
  text-align: left;
}
.glossary-term-name {
  font-size: var(--vl-fs-md, 14px);
  font-weight: 600;
  color: var(--vl-ink);
}
.glossary-term-en {
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.glossary-def {
  margin: 8px 0 0;
  font-size: var(--vl-fs-sm, 13px);
  line-height: 1.75;
  color: var(--vl-ink);
}
.glossary-alias {
  margin: 6px 0 0;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.glossary-first {
  display: inline-block;
  margin-top: 8px;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-accent);
  text-decoration: none;
}
.glossary-empty {
  color: var(--vl-muted);
  font-size: var(--vl-fs-md, 14px);
}
.glossary-empty button {
  background: none;
  border: 0;
  color: var(--vl-accent);
  cursor: pointer;
  font-size: inherit;
}
@media (max-width: 850px) {
  .glossary-main {
    padding: 28px 18px 50px;
  }
  .glossary-search {
    width: 100%;
  }
}
/* 触屏：可点元素不小于 44×44 */
@media (pointer: coarse) {
  .glossary-first,
  .glossary-term {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
  .glossary-term {
    width: 100%;
  }
}
</style>
