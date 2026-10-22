<script setup lang="ts">
import { useLabStore } from '@/app/stores/lab'
const lab = useLabStore()
</script>

<template>
  <div :class="lab.darkMode ? 'dark' : 'light'" class="h-full">
    <!-- Query changes (dock tabs) preserve playback; a different lesson gets fresh state. -->
    <RouterView v-slot="{ Component, route }">
      <component :is="Component" :key="route.path" />
    </RouterView>
  </div>
</template>
