<script setup lang="ts">
/**
 * App.vue —— 应用根组件
 * ---------------------------------------------------------------------------
 * 整改说明（2026-10-21）：
 *   整改前这里有两套外壳 —— 视觉实验室用精简外壳，/progress 与 /evidence 走
 *   MainLayout（Element Plus 壳），两套 UI 互不相通，而且 MainLayout 里的
 *   「学习进度」读的是一个永远为空的 store。
 *
 *   现在全站只有**一套**外壳：
 *   · 视觉页面（首页 / 目录 / 学习路径 / 术语表 / 学习进度 / 证据库 / 动画页）
 *     共用 VisualNav 与 --vl-* 设计变量；
 *   · 旧外壳与旧实验页（约 2500 行不可达代码）已删除，页内详情区改由
 *     components/lesson/LessonDock.vue 承担。
 *
 * 主题切换由 store 的 toggleTheme() 负责，它会同时维护
 * `<html data-theme>`（Tailwind token）与 `<html class="dark">`（Element Plus 变量）。
 */
import { computed } from 'vue'

import zhCn from 'element-plus/es/locale/lang/zh-cn'

import { useLabStore } from '@/app/stores/lab'

const lab = useLabStore()

/** 深色主题时给根节点加 dark class，Element Plus 的深色变量才会生效 */
const rootClass = computed<string>(() => (lab.darkMode ? 'dark' : 'light'))
</script>

<template>
  <el-config-provider :locale="zhCn" :class="rootClass" class="h-full">
    <RouterView />
  </el-config-provider>
</template>
