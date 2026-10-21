/**
 * Tailwind v4 配置
 * ---------------------------------------------------------------------------
 * Tailwind v4 的主入口是 `@tailwindcss/vite` 插件 + `src/styles/main.css` 里的
 * `@import "tailwindcss";`，设计 token 定义在 main.css 的 `@theme` 块中。
 *
 * 本文件保留下来是为了让 IDE / ESLint 等工具能识别内容扫描范围，
 * 实际生效的 token 仍以 main.css 为准。
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [],
}
