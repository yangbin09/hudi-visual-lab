import { expect, test } from '@playwright/test'

test('首页进入动画实验，并明确声明纯浏览器模拟', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('纯浏览器模拟', { exact: false })).toBeVisible()
  await page.getByRole('link', { name: /精选实验/ }).click()
  await expect(page).toHaveURL(/\/experiment\/B02/)
  await expect(page.locator('.vl-canvas')).toBeVisible()
  await expect(page).toHaveTitle(/COW/)
  await expect(page.getByText('纯浏览器模拟', { exact: false })).toBeVisible()
})

test('完整目录和证据库仍可访问', async ({ page }) => {
  await page.goto('/catalog')
  await expect(page.getByRole('heading', { name: /Hudi Lab/ })).toBeVisible()
  await page.goto('/evidence')
  await expect(page.locator('main')).toContainText('证据')
})
