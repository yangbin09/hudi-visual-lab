import { expect, test } from '@playwright/test'

test('离开实验后恢复本课历史；B02 与 B03 的状态各自独立', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/experiment/B02')
  await page.getByRole('button', { name: '↑ Upsert 更新记录' }).click()
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 200')
  await page.getByRole('link', { name: 'h. Hudi Visual Lab' }).click()
  await page.getByRole('link', { name: /精选实验/ }).click()
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 200')
  await page.getByRole('button',{name:'重置实验',exact:true}).click()
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 100.5')
  await page.goto('/experiment/B03')
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 100.5')
})

test('自定义输入通过同一引擎传播到文件和 Snapshot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/experiment/B02')
  // 整改后统一导航里的参数入口叫「⚙ 参数」；金额即时生效（与旧页一致）
  await page.getByRole('button', { name: '⚙ 参数' }).click()
  await page.getByRole('spinbutton', { name: '更新后的金额' }).fill('350')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '↑ Upsert 更新记录' }).click()
  // reducedMotion 下动画直接落定，不需要「跳过动画」
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 350')
  await page.getByRole('button', { name: '查看新 Base · 完整记录', exact: true }).click()
  await expect(page.getByRole('cell', { name: '350', exact: true })).toBeVisible()
})
