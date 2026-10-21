import { defineConfig, configDefaults, type UserConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vitest 配置（单元测试）。
 *
 * 说明：
 *   - `tests/e2e/**` 由 Playwright 驱动（@playwright/test 的 `test()`），
 *     不能被 Vitest 收集，因此在 `exclude` 里显式排除；
 *     否则 `npm run test` 会把 e2e 用例当单元测试跑，直接报错。
 *   - 单元测试只覆盖 `src/engine` / `src/models` / `src/evidence` / `src/experiments`，
 *     不依赖浏览器 API；`jsdom` 环境保留是为了后续组件测试能直接复用同一份配置。
 *   - 插件类型做了显式收敛：项目用 Vite 6，而 vitest 2.x 内置的是 Vite 5，
 *     两边的 Plugin 类型不兼容（直接 `plugins: [vue()]` 会让 `vue-tsc --noEmit` 报错）。
 *     这里只做类型层面的收敛，运行时行为完全一致。
 */
type VitestPlugin = NonNullable<UserConfig['plugins']>[number]

export default defineConfig({
  plugins: [vue() as unknown as VitestPlugin],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.spec.ts'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
})
