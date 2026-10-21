import { expect, test } from '@playwright/test'

test('离开实验再返回不残留修改；B02 与 B03 进入同一原型', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/experiment/B02')
  await page.getByRole('button', { name: '↑ Upsert 更新记录' }).click()
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 200')
  await page.getByRole('link', { name: 'h. Hudi Visual Lab' }).click()
  await page.getByRole('link', { name: /精选实验/ }).click()
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 100.5')
  await page.goto('/experiment/B03')
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 100.5')
})

test('自定义输入通过同一引擎传播到文件和 Snapshot', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/experiment/B02')
  await page.getByRole('button', { name: '⚙ 设置' }).click()
  await page.getByRole('spinbutton', { name: '更新后的金额' }).fill('350')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: '↑ Upsert 更新记录' }).click()
  await expect(page.locator('.vl-query-value').first()).toHaveText('¥ 350')
  await page.locator('.file-glyph.fresh').last().click()
  await expect(page.getByRole('cell', { name: '350', exact: true })).toBeVisible()
})
