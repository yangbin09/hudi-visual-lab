<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { SceneKind } from '@/experiments/visual/types'
defineProps<{ kind: SceneKind | 'compare' }>()
const root = ref<SVGSVGElement>(), visible = ref(false), reduced = ref(false)
let observer: IntersectionObserver | undefined, media: MediaQueryList | undefined
function onReduced(e: MediaQueryListEvent) { reduced.value = e.matches }
onMounted(() => {
  media = matchMedia('(prefers-reduced-motion: reduce)'); reduced.value = media.matches; media.addEventListener('change',onReduced)
  observer = new IntersectionObserver(([entry])=>{visible.value=!!entry?.isIntersecting})
  if(root.value)observer.observe(root.value)
})
onBeforeUnmount(()=>{observer?.disconnect();media?.removeEventListener('change',onReduced)})
</script>
<template>
  <svg ref="root" viewBox="0 0 300 95" aria-hidden="true" class="topic-preview">
    <template v-if="kind==='index'"><path d="M32 18H134V43M134 43L80 75M134 43L160 75M134 43L240 75"/><rect x="15" y="8" width="54" height="27" rx="6"/><rect v-for="n in 3" :key="n" :x="52+(n-1)*80" y="64" width="58" height="25" rx="5"/><circle v-if="visible&&!reduced" r="4"><animateMotion dur="3.5s" repeatCount="indefinite" path="M32 18H134V43L160 75"/></circle></template>
    <template v-else-if="kind==='timeline'"><path d="M25 45H275"/><circle v-for="n in 5" :key="n" :cx="25+(n-1)*62" cy="45" r="9" class="preview-state"/><path d="M149 58Q149 90 246 86" class="preview-branch"/><circle v-if="visible&&!reduced" r="4"><animateMotion dur="4s" repeatCount="indefinite" path="M25 45H275"/></circle></template>
    <template v-else-if="kind==='query'"><rect x="18" y="9" width="54" height="30" rx="5"/><rect x="18" y="56" width="54" height="30" rx="5" class="preview-log"/><path d="M72 24L150 48L237 48M72 70L150 48"/><rect x="126" y="32" width="47" height="32" rx="7"/><rect x="237" y="26" width="44" height="46" rx="5"/><circle v-if="visible&&!reduced" r="4"><animateMotion dur="3s" repeatCount="indefinite" path="M72 70L150 48H237"/></circle></template>
    <template v-else-if="kind==='schema'"><rect v-for="n in 3" :key="n" x="18" :y="9+(n-1)*29" width="73" height="19" rx="4"/><path d="M91 19L160 48M91 48H160M91 77L160 48H215"/><rect x="215" y="16" width="64" height="64" rx="7"/><circle v-if="visible&&!reduced" r="4"><animateMotion dur="3s" repeatCount="indefinite" path="M91 19L160 48H215"/></circle></template>
    <template v-else-if="kind==='metrics'"><path d="M20 84H280"/><rect v-for="n in 5" :key="n" :x="36+(n-1)*49" :y="84-(n%3+1)*20" width="28" :height="(n%3+1)*20" rx="4"/></template>
    <template v-else-if="kind==='compare'"><path d="M25 48H115L195 20H246M115 48L195 76H246"/><rect x="17" y="34" width="45" height="28" rx="5"/><rect x="245" y="7" width="38" height="29" rx="5"/><rect x="245" y="62" width="38" height="29" rx="5" class="preview-log"/><circle v-if="visible&&!reduced" r="4"><animateMotion dur="3s" repeatCount="indefinite" path="M25 48H115L195 76H246"/></circle></template>
    <template v-else><path d="M30 48H272"/><rect v-for="n in 3" :key="n" :x="13+(n-1)*112" y="26" width="57" height="44" rx="7" :class="{ 'preview-log': n===3 && kind==='files' }"/><circle v-if="visible&&!reduced" r="4"><animateMotion dur="3s" repeatCount="indefinite" path="M30 48H272"/></circle></template>
  </svg>
</template>
<style scoped>
.topic-preview{width:100%;height:95px;color:var(--vl-muted)}path{fill:none;stroke:var(--vl-line);stroke-width:2;stroke-dasharray:4 6}rect{fill:var(--vl-base-bg);stroke:#79a28d;stroke-width:1}.preview-log{fill:var(--vl-log-bg);stroke:#b5a06d}circle{fill:#acd09f;stroke:#7f9f77}.preview-state{fill:var(--vl-base-bg);stroke:#79a28d}.preview-branch{stroke:#b5a06d}
</style>
