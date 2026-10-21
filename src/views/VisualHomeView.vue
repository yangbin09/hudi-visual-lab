<script setup lang="ts">
import TopicPreview from '@/components/visual/TopicPreview.vue'
import type { SceneKind } from '@/experiments/visual/types'
import { useLabStore } from '@/app/stores/lab'
const lab = useLabStore()
const topicIds = ['B08','B02','W02','I03','S04','S01','S06','S08']
const topicKinds: (SceneKind | 'compare')[] = ['schema','compare','files','index','files','timeline','files','timeline']
const topics = ['Hudi 是如何存储数据的？', 'COW 和 MOR 有什么区别？', 'Hudi 是如何更新数据的？', 'Bucket 索引如何定位记录？', 'Compaction 如何合并文件？', 'Timeline 如何管理事务？', 'Cleaner 如何清理旧文件？', '发生故障后如何恢复？']
</script>
<template>
  <div class="visual-home" :class="{ 'vl-light': !lab.darkMode }">
    <header class="vl-nav"><RouterLink to="/" class="vl-brand"><span class="vl-logo">h.</span> Hudi <b>Visual Lab</b></RouterLink><div class="vl-nav-actions"><RouterLink to="/catalog">完整实验目录 ↗</RouterLink><button aria-label="切换深浅主题" @click="lab.toggleTheme()">{{ lab.darkMode ? '☀' : '☾' }}</button></div></header>
    <main class="vh-main"><div class="vl-eyebrow">LEARN BY SEEING. UNDERSTAND BY DOING.</div><h1>让数据流动，<br/>让原理<span>看得见。</span></h1><p class="vh-intro">一个操作，一次变化。用交互动画建立你的 Hudi 直觉。</p>
      <RouterLink to="/experiment/B02" class="vh-feature"><div><span class="vl-eyebrow">精选实验 / 约 1 分钟建立直觉</span><h2>同一条更新，<br/>两种不同的写入方式。</h2><p>并排观察 COW 重写 Base、MOR 追加 Log，<br/>再亲手执行一次 Compaction。</p><span class="vh-start">开始 COW / MOR 实验 →</span></div><svg viewBox="0 0 430 230" aria-hidden="true"><path d="M20 115H105M105 115L175 60H240M105 115L175 180H240" fill="none" stroke="var(--vl-muted)" stroke-dasharray="5 7"/><circle r="6" fill="#bfe7b1"><animateMotion dur="4s" repeatCount="indefinite" path="M20 115H105L175 60H240"/></circle><circle r="6" fill="#d8b975"><animateMotion dur="4s" repeatCount="indefinite" path="M20 115H105L175 180H240"/></circle><rect x="240" y="20" width="160" height="80" rx="10" fill="var(--vl-base-bg)" stroke="#79a99a"/><text x="260" y="49" fill="var(--vl-ink)" font-size="16">COW · 新 Base</text><path d="M260 64H380M260 76H360" stroke="#79a99a"/><rect x="240" y="140" width="160" height="80" rx="10" fill="var(--vl-log-bg)" stroke="#c5a565"/><text x="260" y="173" fill="var(--vl-ink)" font-size="16">MOR · 追加 Log</text><path d="M260 190H370" stroke="#c5a565"/></svg></RouterLink>
      <div class="vh-topics-head"><h2>从一个问题开始</h2><RouterLink to="/catalog" class="vh-all-topics">全部 80 个动画 →</RouterLink></div><div class="vh-topics"><RouterLink v-for="(topic, i) in topics" :key="topic" :to="`/experiment/${topicIds[i]}`"><TopicPreview :kind="topicKinds[i]!"/><span class="vl-eyebrow">{{ String(i + 1).padStart(2, '0') }} / 动画实验</span><h3>{{ topic }} <span>↗</span></h3></RouterLink></div>
    </main><footer class="vl-footer"><span>HUAWEI MRS r26 · 纯浏览器模拟</span><span>看动画 → 亲手操作 → 解释 → 代码</span></footer>
  </div>
</template>
<style src="../styles/visual-lab.css"></style>
<style scoped>
.vh-main{max-width:1160px;margin:auto;padding:64px 32px}.vh-main>h1{font-size:52px;line-height:1.25;letter-spacing:-2px;margin:20px 0}.vh-main>h1 span{color:var(--vl-accent)}.vh-intro{color:var(--vl-muted);font-size:14px;margin-bottom:35px}.vh-feature{display:flex;align-items:center;justify-content:space-between;gap:40px;padding:36px 44px;background:var(--vl-panel);border:1px solid var(--vl-line);border-radius:16px;text-decoration:none}.vh-feature h2{font-size:29px;line-height:1.5;margin:18px 0 12px}.vh-feature p{font-size:13px;color:var(--vl-muted);line-height:1.8}.vh-feature svg{width:46%}.vh-start{display:inline-block;margin-top:18px;background:var(--vl-accent);color:var(--vl-bg);padding:11px 18px;border-radius:7px;font-size:13px}.vh-topics-head{display:flex;align-items:center;justify-content:space-between;margin:46px 0 20px}.vh-topics-head h2{font-size:20px}.vh-topics-head>span{font-size:12px;color:var(--vl-muted)}.vh-topics{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.vh-topics a{border:1px solid var(--vl-line);border-radius:10px;padding:18px;text-decoration:none}.vh-topics a:hover{background:var(--vl-panel)}.vh-topics svg{width:100%;height:65px;margin-bottom:20px}.vh-topics h3{font-size:13px;line-height:1.7;margin:10px 0}.vh-topics h3 span{float:right;color:var(--vl-muted)}.vh-topics .vl-eyebrow{font-size:9px;letter-spacing:.5px}@media(prefers-reduced-motion:reduce){svg circle{display:none}}@media(max-width:850px){.vh-main{padding:35px 20px}.vh-main>h1{font-size:40px}.vh-topics{grid-template-columns:repeat(2,1fr)}.vh-feature{padding:24px}.vh-feature h2{font-size:23px}.vh-feature svg{width:38%}}
</style>

<style scoped>.vh-all-topics{font-size:12px;text-decoration:none;color:var(--vl-muted)}.vh-topics .topic-preview{height:65px;margin-bottom:20px}</style>
