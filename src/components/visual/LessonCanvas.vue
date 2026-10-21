<script setup lang="ts">
import RecordWalkthrough from './RecordWalkthrough.vue'
import CleanerWalkthrough from './CleanerWalkthrough.vue'
import AnimatedFiles from './AnimatedFiles.vue'
import AnimatedIndex from './AnimatedIndex.vue'
import AnimatedQuery from './AnimatedQuery.vue'
import AnimatedProcess from './AnimatedProcess.vue'
import AnimatedSchema from './AnimatedSchema.vue'
import AnimatedTimeline from './AnimatedTimeline.vue'
import AnimatedMetrics from './AnimatedMetrics.vue'
import type { TeachingTrace } from '@/engine/visual/teachingTrace'
import type { LessonFrame } from '@/engine/visual/scenarios'
import type { HudiTableState } from '@/models/hudi'
import type { QueryResult } from '@/engine/queries/types'
import type { LessonParameters, VisualLesson } from '@/experiments/visual/types'
defineProps<{ lesson: VisualLesson; frame: LessonFrame; state: HudiTableState; query?: QueryResult; queryTrace?:TeachingTrace; progress: number; current: number; started: boolean; parameters: LessonParameters }>()
defineEmits<{ inspect: [title: string, value: unknown] }>()
</script>
<template>
  <svg class="lesson-canvas" :viewBox="lesson.kind==='query'||frame.teaching?.kind==='clean'||(lesson.kind!=='index'&&['write','merge'].includes(frame.teaching?.kind??'')) ? '0 0 1080 335' : '0 0 1080 425'" role="img" :aria-label="`${lesson.id} ${frame.step.title} 动画`" :data-scene="lesson.kind" :data-progress="progress.toFixed(3)">
    <defs><pattern id="lesson-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="currentColor" opacity=".1"/></pattern></defs><rect width="1080" height="425" fill="url(#lesson-grid)"/>
    <CleanerWalkthrough v-if="frame.teaching?.kind==='clean'" :frame="frame" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <RecordWalkthrough v-else-if="lesson.kind!=='index' && ['write','merge'].includes(frame.teaching?.kind??'')" :frame="frame" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <AnimatedFiles v-else-if="lesson.kind === 'files'" :parameters="parameters" :frame="frame" :state="state" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <AnimatedIndex v-else-if="lesson.kind === 'index'" :lesson="lesson" :frame="frame" :state="state" :parameters="parameters" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <AnimatedQuery v-else-if="lesson.kind === 'query'" :trace="queryTrace" :frame="frame" :state="state" :query="query" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <AnimatedTimeline v-else-if="lesson.kind === 'timeline'" :frame="frame" :state="state" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <AnimatedSchema v-else-if="lesson.kind === 'schema'" :parameters="parameters" :lesson="lesson" :frame="frame" :state="state" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <AnimatedMetrics v-else-if="lesson.kind === 'metrics'" :frame="frame" :progress="progress" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
    <AnimatedProcess v-else :lesson="lesson" :frame="frame" :parameters="parameters" :progress="progress" :current="current" :started="started" @inspect="(a,b)=>$emit('inspect',a,b)"/>
  </svg>
</template>
