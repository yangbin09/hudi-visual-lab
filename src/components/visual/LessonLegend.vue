<script setup lang="ts">
/**
 * LessonLegend —— 画布图例
 * ---------------------------------------------------------------------------
 * 整改前：12 个动画页里只有 B02 有图例（179×16、10px 字号），
 * Base / Log / 旧版本 / 本次新增 四个视觉符号没有任何解释。
 * 本组件把图例常驻在画布右上角，字号 ≥12px。
 */
defineProps<{
  /** 图元种类较多时（如索引/查询主题）可隐藏 */
  compact?: boolean
}>()
</script>

<template>
  <div class="vl-legend" role="note" aria-label="画布图例">
    <span class="vl-legend-item">
      <i class="vl-swatch vl-swatch-base" aria-hidden="true"></i>Base File（基准文件）
    </span>
    <span class="vl-legend-item">
      <i class="vl-swatch vl-swatch-log" aria-hidden="true"></i>Log File（增量日志）
    </span>
    <span class="vl-legend-item">
      <i class="vl-swatch vl-swatch-old" aria-hidden="true"></i>旧版本（待清理）
    </span>
    <span v-if="!compact" class="vl-legend-item">
      <i class="vl-swatch vl-swatch-new" aria-hidden="true"></i>本次新增
    </span>
  </div>
</template>

<style scoped>
.vl-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 8px 14px;
  background: var(--vl-legend-bg, var(--vl-panel));
  border: 1px solid var(--vl-line);
  border-radius: 8px;
  font-size: var(--vl-fs-xs, 12px);
  color: var(--vl-muted);
}
.vl-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  line-height: 1.6;
}
.vl-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1.5px solid;
  flex: none;
}
.vl-swatch-base {
  background: var(--vl-base-bg);
  border-color: #79a99a;
}
.vl-swatch-log {
  background: var(--vl-log-bg);
  border-color: #c5a565;
}
.vl-swatch-old {
  background: var(--vl-panel);
  border-color: var(--vl-line);
  opacity: 0.55;
}
.vl-swatch-new {
  background: var(--vl-panel);
  border-color: #38957a;
  box-shadow: inset 0 0 0 2px rgba(56, 149, 122, 0.35);
}
@media (max-width: 550px) {
  .vl-legend {
    font-size: 12px;
    gap: 6px 12px;
  }
}
</style>
