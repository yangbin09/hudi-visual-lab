<script setup lang="ts">
/**
 * MainLayout —— 主框架布局
 * ---------------------------------------------------------------------------
 * 结构：
 *   顶栏：品牌 + 状态条（版本信息 / 纯浏览器模拟警示 / 主题切换）+ 主导航
 *   左栏：9 个模块的实验目录树（来自 experiments/catalog），当前项高亮，可折叠
 *   内容：默认渲染路由视图（也可由调用方通过默认插槽覆盖）
 *
 * 左侧目录直接消费 `MODULES` + `CATALOG`：
 * 目录是「要讲什么」的权威口径，注册表是「已经能点什么」的权威口径，两者都要展示。
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import StatusBar from '@/components/common/StatusBar.vue'
import { CATALOG, MODULES, type CatalogEntry } from '@/experiments/catalog'

/* -------------------------------------------------------------------------- */
/* 目录树                                                                        */
/* -------------------------------------------------------------------------- */

interface ModuleNode {
  id: string
  title: string
  shortTitle: string
  description: string
  total: number
  implemented: number
  entries: CatalogEntry[]
}

const modules = computed<ModuleNode[]>(() =>
  MODULES.map((m) => {
    const entries = CATALOG.filter((e) => e.moduleId === m.id)
    return {
      id: m.id,
      title: m.title,
      shortTitle: m.shortTitle,
      description: m.description,
      total: entries.length,
      implemented: entries.filter((e) => e.implemented).length,
      entries,
    }
  }),
)

/** 每个模块的展开状态；默认全部展开 */
const expanded = ref<Record<string, boolean>>(
  Object.fromEntries(MODULES.map((m) => [m.id, true])),
)

function toggleModule(id: string): void {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] }
}

/* -------------------------------------------------------------------------- */
/* 当前路由                                                                      */
/* -------------------------------------------------------------------------- */

const route = useRoute()

/** 当前实验 id（/experiment/:id） */
const currentExperimentId = computed<string>(() => {
  const id = route?.params?.id
  return typeof id === 'string' ? id : ''
})

/** 目录条目是否就是当前打开的实验 */
function isActive(entry: CatalogEntry): boolean {
  if (!currentExperimentId.value) return false
  return entry.id === currentExperimentId.value || entry.experimentId === currentExperimentId.value
}

/* -------------------------------------------------------------------------- */
/* 折叠状态                                                                      */
/* -------------------------------------------------------------------------- */

const sidebarCollapsed = ref(false)
const sidebarWidth = computed<string>(() => (sidebarCollapsed.value ? '52px' : '260px'))

/** 顶部导航 */
const navItems = [
  { to: '/', label: '总览' },
  { to: '/evidence', label: '证据库' },
  { to: '/progress', label: '学习进度' },
]
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-[var(--color-hudi-bg)] text-[var(--color-hudi-text)]">
    <!-- ============================ 顶栏 ============================ -->
    <header
      class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--color-hudi-border)] bg-[var(--color-hudi-panel)] px-4 py-2"
    >
      <RouterLink to="/" class="flex shrink-0 items-center gap-2 no-underline">
        <span
          class="flex h-7 w-7 items-center justify-center rounded bg-[var(--color-hudi-accent)] font-mono text-sm font-bold text-white"
        >
          H
        </span>
        <span class="text-base font-semibold tracking-wide">Hudi Lab</span>
      </RouterLink>

      <nav class="flex items-center gap-1 text-sm">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="rounded px-2 py-1 no-underline transition-colors"
          :class="
            route.path === item.to
              ? 'bg-[var(--color-hudi-accent)]/15 text-[var(--color-hudi-accent)]'
              : 'text-[var(--color-hudi-muted)] hover:text-[var(--color-hudi-text)]'
          "
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="ml-auto min-w-0 flex-1">
        <StatusBar />
      </div>
    </header>

    <!-- ============================ 主体 ============================ -->
    <div class="flex min-h-0 flex-1">
      <!-- ---------------------------- 左栏 ---------------------------- -->
      <aside
        class="flex min-h-0 shrink-0 flex-col border-r border-[var(--color-hudi-border)] bg-[var(--color-hudi-panel)] transition-[width] duration-200"
        :style="{ width: sidebarWidth }"
      >
        <div
          class="flex items-center justify-between border-b border-[var(--color-hudi-border)] px-3 py-2 text-xs font-semibold"
        >
          <span v-if="!sidebarCollapsed">实验目录</span>
          <button
            type="button"
            class="rounded px-1.5 py-0.5 text-[var(--color-hudi-muted)] transition-colors hover:bg-[var(--color-hudi-border)]/40 hover:text-[var(--color-hudi-text)]"
            :title="sidebarCollapsed ? '展开目录' : '折叠目录'"
            @click="sidebarCollapsed = !sidebarCollapsed"
          >
            {{ sidebarCollapsed ? '»' : '«' }}
          </button>
        </div>

        <div v-if="!sidebarCollapsed" class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          <section v-for="mod in modules" :key="mod.id" class="mb-1">
            <button
              type="button"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-hudi-border)]/30"
              :title="mod.description"
              @click="toggleModule(mod.id)"
            >
              <span class="font-mono text-[var(--color-hudi-accent)]">{{ mod.id }}</span>
              <span class="flex-1 truncate font-medium">{{ mod.shortTitle }}</span>
              <span class="text-[10px] text-[var(--color-hudi-muted)]">
                {{ mod.implemented }}/{{ mod.total }}
              </span>
              <span class="text-[10px] text-[var(--color-hudi-muted)]">
                {{ expanded[mod.id] ? '▾' : '▸' }}
              </span>
            </button>

            <ul v-show="expanded[mod.id]" class="mb-1 ml-2 space-y-0.5 border-l border-[var(--color-hudi-border)] pl-2">
              <li v-for="entry in mod.entries" :key="entry.id">
                <RouterLink
                  v-if="entry.implemented"
                  :to="`/experiment/${entry.experimentId ?? entry.id}`"
                  class="flex items-start gap-1.5 rounded px-1.5 py-1 text-[11px] leading-snug no-underline transition-colors"
                  :class="
                    isActive(entry)
                      ? 'bg-[var(--color-hudi-accent)]/15 text-[var(--color-hudi-accent)]'
                      : 'text-[var(--color-hudi-muted)] hover:bg-[var(--color-hudi-border)]/30 hover:text-[var(--color-hudi-text)]'
                  "
                  :title="entry.summary"
                >
                  <span class="font-mono">{{ entry.id }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ entry.title }}</span>
                </RouterLink>
                <span
                  v-else
                  class="flex items-start gap-1.5 px-1.5 py-1 text-[11px] leading-snug text-[var(--color-hudi-muted)]/60"
                  :title="entry.summary"
                >
                  <span class="font-mono">{{ entry.id }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ entry.title }}</span>
                </span>
              </li>
            </ul>
          </section>
        </div>
      </aside>

      <!-- ---------------------------- 内容 ---------------------------- -->
      <main class="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <slot>
          <RouterView />
        </slot>
      </main>
    </div>
  </div>
</template>
