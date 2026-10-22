<script setup lang="ts">
/**
 * DockPanel —— LessonDock 内的分区容器
 * ---------------------------------------------------------------------------
 * 统一「标题 + 一句话说明 + 内容 / 空状态」的结构，避免每个分区各写一套边框与空态。
 * 颜色只使用 --vl-* 变量（缺省时回退到全局 --color-hudi-*），不在这里写死色值。
 */
withDefaults(
  defineProps<{
    /** 分区标题 */
    title: string
    /** 标题下方的一句话说明（可选） */
    description?: string
    /** 标题右侧的补充提示（例如统计值） */
    hint?: string
    /** 是否展示空状态（true 时渲染空态而不是默认插槽） */
    empty?: boolean
    /** 空状态标题 */
    emptyTitle?: string
    /** 空状态补充说明 */
    emptyText?: string
  }>(),
  {
    description: '',
    hint: '',
    empty: false,
    emptyTitle: '暂无数据',
    emptyText: '',
  },
)
</script>

<template>
  <section class="dock-panel">
    <header class="dock-panel-head">
      <div class="dock-panel-title-row">
        <h3 class="dock-panel-title">{{ title }}</h3>
        <span v-if="hint" class="dock-panel-hint">{{ hint }}</span>
      </div>
      <div v-if="$slots.actions" class="dock-panel-actions">
        <slot name="actions" />
      </div>
      <p v-if="description" class="dock-panel-desc">{{ description }}</p>
    </header>

    <div v-if="empty" class="dock-empty" role="status">
      <p class="dock-empty-title">{{ emptyTitle }}</p>
      <p v-if="emptyText" class="dock-empty-text">{{ emptyText }}</p>
    </div>
    <div v-else class="dock-panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.dock-panel {
  min-width: 0;
  border: 1px solid var(--vl-line, var(--color-hudi-border));
  border-radius: 10px;
  background: var(--vl-panel, var(--color-hudi-panel));
  padding: 12px 14px;
}

.dock-panel-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 10px;
  row-gap: 2px;
  margin-bottom: 10px;
}

.dock-panel-title-row {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 10px;
  row-gap: 2px;
}

.dock-panel-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--vl-ink, var(--color-hudi-text));
}

.dock-panel-hint {
  font-size: 12px;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.dock-panel-actions {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 6px;
}

.dock-panel-desc {
  flex-basis: 100%;
  margin: 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-muted, var(--color-hudi-muted));
}

.dock-panel-body {
  min-width: 0;
}

.dock-empty {
  border: 1px dashed var(--vl-line, var(--color-hudi-border));
  border-radius: 8px;
  padding: 14px 16px;
  text-align: center;
}

.dock-empty-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--vl-ink, var(--color-hudi-text));
}

.dock-empty-text {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.7;
  color: var(--vl-muted, var(--color-hudi-muted));
}
</style>
