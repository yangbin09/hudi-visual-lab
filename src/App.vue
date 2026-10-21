<script setup lang="ts">
/**
 * App.vue —— 应用根组件
 * ---------------------------------------------------------------------------
 * 只做三件事：
 *   1. 提供 Element Plus 的全局配置（中文 locale + 主题 class）；
 *   2. 套上 MainLayout（顶栏 + 左侧实验目录 + 内容区）；
 *   3. 在内容区渲染路由视图。
 *
 * 主题切换由 store 的 toggleTheme() 负责，它会同时维护
 * `<html data-theme>`（Tailwind token）与 `<html class="dark">`（Element Plus 变量）。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import zhCn from 'element-plus/es/locale/lang/zh-cn'

import MainLayout from '@/app/layouts/MainLayout.vue'
import { useLabStore } from '@/app/stores/lab'

const lab = useLabStore()
const route = useRoute()
const visualRoute = computed(() => route.path === '/' || route.path === '/catalog' || route.path.startsWith('/experiment/'))

/** 深色主题时给根节点加 dark class，Element Plus 的深色变量才会生效 */
const rootClass = computed<string>(() => (lab.darkMode ? 'dark' : 'light'))
</script>

<template>
  <el-config-provider :locale="zhCn" :class="rootClass" class="h-full">
    <RouterView v-if="visualRoute" :key="route.path" />
    <MainLayout v-else>
      <RouterView />
    </MainLayout>
  </el-config-provider>
</template>
