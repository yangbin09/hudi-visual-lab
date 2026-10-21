import { defineConfig, devices } from '@playwright/test'

/**
 * E2E 配置。
 *
 * 需求 §3.1 要求站点适配 1920×1080 / 1440×900 / 1366×768 三种分辨率，
 * 使用四种 viewport 验证动画画布、控件与抽屉的适配。
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    locale: 'zh-CN',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: '1920x1080',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: '1440x900',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: '1366x768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'narrow-800',
      // 低于 xl 断点，用于验证纵向单列降级布局不塌陷
      use: { ...devices['Desktop Chrome'], viewport: { width: 800, height: 900 } },
    },
  ],
})
