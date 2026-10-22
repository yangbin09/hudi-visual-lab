import { expect, test } from '@playwright/test'

test('画布居中且控件首屏可见，复杂信息默认隐藏', async ({ page }) => {
  await page.goto('/experiment/B02')
  await expect(page.locator('.vl-canvas')).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector('.vl-stage')!.getBoundingClientRect()
    // 整改后所有主题共用 .lesson-main 外壳（B02/B03 也不再是另一套 .vl-main）
    const main = document.querySelector('.lesson-main')!.getBoundingClientRect()
    const action = document.querySelector('.vl-action-bar')!.getBoundingClientRect()
    return {
      canvasHeight: document.querySelector('.vl-canvas')!.getBoundingClientRect().height,
      actionBottom: action.bottom,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }
  })
  expect(geometry.overflow).toBe(false)
  if (page.viewportSize()!.width >= 1366) {
    // 操作条仍在首屏内
    expect(geometry.actionBottom).toBeLessThan(geometry.height)
    // 画布像素高度应足够阅读，不用整张长页面的高度作为分母。
    expect(geometry.canvasHeight).toBeGreaterThan(180)
  }
  await page.getByRole('button', { name: '切换深浅主题' }).click()
  await expect(page.locator('.visual-lab')).toHaveClass(/vl-light/)
  // 整改后详细视图是页内详情区（dock），不再是抽屉
  await page.getByRole('button', { name: '数据 / 代码 / 依据 ↗' }).click()
  await expect(page.locator('.lesson-dock')).toBeVisible()
  await expect(page.getByRole('dialog')).not.toBeVisible()
})
