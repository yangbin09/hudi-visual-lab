import { expect, test } from '@playwright/test'

test('画布居中且控件首屏可见，复杂信息默认隐藏', async ({ page }) => {
  await page.goto('/experiment/B02')
  await expect(page.locator('.vl-canvas')).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('.vl-stage')!.getBoundingClientRect()
    const main = document.querySelector('.vl-main')!.getBoundingClientRect()
    const action = document.querySelector('.vl-action-bar')!.getBoundingClientRect()
    return { ratio: stage.height / main.height, actionBottom: action.bottom, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth }
  })
  expect(geometry.overflow).toBe(false)
  if (page.viewportSize()!.width >= 1366) {
    expect(geometry.actionBottom).toBeLessThan(geometry.height)
    expect(geometry.ratio).toBeGreaterThan(0.60)
  }
  await page.getByRole('button', { name: '切换深浅主题' }).click()
  await expect(page.locator('.visual-lab')).toHaveClass(/vl-light/)
  await page.getByRole('button', { name: '技术详情 ↗', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
})
