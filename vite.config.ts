import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vite 配置
 * ---------------------------------------------------------------------------
 * 约定（CONTRACT.md 铁律 7）：路径别名 `@` → `src`，tsconfig.json 与本文件保持一致。
 *
 * Tailwind v4 走 `@tailwindcss/vite` 插件，**不**使用 postcss.config.js ——
 * 两套同时启用会重复注入 Tailwind 的处理管线。
 */
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    watch: {
      // Windows 上编辑器原子写入会产生临时文件，fs.watch 偶发 EBUSY 让 dev server 崩掉；
      // 轮询模式更稳（开发期文件量不大，开销可接受）。
      usePolling: true,
      interval: 400,
    },
  },
  build: {
    manifest: true,
    // 把体积大且很少变动的第三方库拆成独立 chunk，便于浏览器缓存复用
    chunkSizeWarningLimit: 350,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-codemirror': [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/lang-sql',
            '@codemirror/theme-one-dark',
          ],
        },
      },
    },
  },
})
