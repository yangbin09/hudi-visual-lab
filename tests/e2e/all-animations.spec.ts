import { expect, test } from '@playwright/test'
import { CATALOG } from '../../src/experiments/catalog'

// Traverse all topics at the target desktop size; other viewports exercise every renderer below.
test('80 个主题都可打开并完成演示，没有旧后台或空链接', async ({ page }, info) => {
  test.skip(info.project.name !== '1366x768', '完整目录遍历一次；各类画布另做四种分辨率验证。')
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror',e=>errors.push(e.message))
  await page.emulateMedia({ reducedMotion:'reduce' })
  for(const entry of CATALOG){
    await page.goto(`/experiment/${entry.id}`)
    if(entry.id==='B02'||entry.id==='B03'){
      await expect(page.locator('.vl-canvas')).toBeVisible()
      await page.getByRole('button',{name:'↑ Upsert 更新记录'}).click()
      continue
    }
    await expect(page.getByRole('heading',{level:1})).toHaveText(entry.title)
    await expect(page.locator('.lesson-canvas')).toBeVisible()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.getByRole('button',{name:'播放演示',exact:true}).click()
    await page.getByRole('button',{name:'跳到结果',exact:true}).click()
    await expect(page.getByRole('button',{name:'下一步',exact:true})).toBeDisabled()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),entry.id).toBe(true)
    expect(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight),entry.id).toBe(true)
  }
  expect(errors).toEqual([])
})

for(const [id,scene] of [['W03','files'],['I03','index'],['Q01','query'],['S07','timeline'],['T01','schema'],['F04','flow'],['A01','metrics']]){
  test(`${id} ${scene} 画布可播放、检查对象和使用键盘关闭详情`,async({page})=>{
    await page.goto(`/experiment/${id}`)
    await expect(page.locator('.lesson-canvas')).toHaveAttribute('data-scene',scene!)
    const heading=await page.getByRole('heading',{level:1}).textContent()
    const box=await page.locator('.lesson-playbar').boundingBox()
    expect(box!.y+box!.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    await page.getByRole('button',{name:'播放演示',exact:true}).click()
    await page.waitForTimeout(160)
    await page.getByRole('button',{name:'暂停演示',exact:true}).click()
    const at=await page.getByRole('slider',{name:'动画进度'}).inputValue()
    await page.waitForTimeout(100)
    expect(await page.getByRole('slider',{name:'动画进度'}).inputValue()).toBe(at)
    await page.getByRole('button',{name:'下一步',exact:true}).click()
    await page.getByRole('button',{name:'技术详情 ↗',exact:true}).click()
    await expect(page.getByRole('dialog')).toContainText(heading!)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await expect(page.getByRole('button',{name:'技术详情 ↗',exact:true})).toBeFocused()
    await page.getByRole('button',{name:'跳到结果'}).click()
    await page.screenshot({path:`/tmp/hudi-${id}-${test.info().project.name}.png`,fullPage:true})
  })
}

test('桶数和主键参数重算映射，查看 Bucket 的实际记录', async({page})=>{
  await page.goto('/experiment/I03')
  await page.getByRole('button',{name:'⚙ 参数'}).click()
  await page.getByLabel('Bucket 数量',{exact:true}).fill('8')
  await page.getByLabel('记录主键',{exact:true}).fill('alpha')
  await page.getByRole('button',{name:'应用参数并重置'}).click()
  await expect(page.getByRole('button',{name:/^Bucket \d+$/})).toHaveCount(8)
  await expect(page.getByRole('status')).toContainText('已重置')
  await page.getByRole('button',{name:'跳到结果'}).click()
  // djb2 teaching hash for alpha is recomputed by the engine, not a visual-only target.
  const target=await page.locator('.lesson-canvas text').filter({hasText:'bucketOf(key, 8)'}).textContent()
  const bucket=target!.match(/bucketOf\(key, 8\) = (\d+)/)![1]
  await page.getByRole('button',{name:`Bucket ${bucket}`,exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('alpha')
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'重置',exact:true}).click()
  await expect(page.getByRole('button',{name:'播放演示'})).toHaveText(/开始演示/)
})

test('目录筛选搜索与首页入口指向对应动画',async({page})=>{
  await page.goto('/catalog')
  await expect(page.locator('.catalog-card')).toHaveCount(80)
  await page.getByRole('searchbox',{name:'搜索动画实验'}).fill('I03')
  await expect(page.locator('.catalog-card')).toHaveCount(1)
  await page.locator('.catalog-card').click()
  await expect(page).toHaveURL(/\/experiment\/I03/)
  await page.goto('/')
  await page.getByRole('link',{name:/Bucket 索引如何定位记录/}).click()
  await expect(page).toHaveURL(/\/experiment\/I03/)
})

test('查询结果可检查，改变进度不会反复执行写入',async({page})=>{
  await page.goto('/experiment/Q02')
  await page.getByRole('navigation',{name:'动画步骤'}).getByRole('button',{name:/输出 Base 记录/}).click()
  await page.getByRole('button',{name:'结果记录 1001',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('100.5')
  await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'跳到结果'}).click()
  await page.getByRole('button',{name:'结果记录 1001',exact:true}).click()
  await expect(page.getByRole('dialog')).toContainText('200')
  await page.keyboard.press('Escape')
  const final=await page.locator('.lesson-bottom>span').textContent()
  await page.getByRole('button',{name:'播放演示'}).click()
  await page.getByRole('button',{name:'跳到结果'}).click()
  expect(await page.locator('.lesson-bottom>span').textContent()).toBe(final)
})

test('机制示意的阻断参数生效，回放与拖动不会偷偷恢复播放',async({page})=>{
  await page.goto('/experiment/F07')
  await page.getByRole('button',{name:'⚙ 参数'}).click()
  await page.getByLabel('机制示意的阻断关口').selectOption('3')
  await page.getByRole('button',{name:'应用参数并重置'}).click()
  await page.getByRole('button',{name:'跳到结果'}).click()
  await expect(page.locator('.lesson-canvas')).toContainText('当前拦截点：HMS 权限')
  await page.getByRole('button',{name:'播放演示'}).click()
  await page.getByRole('slider',{name:'动画进度'}).fill('1.4')
  await expect(page.getByRole('button',{name:'播放演示'})).toHaveText('▶ 继续播放')
  const frozen=await page.locator('.lesson-canvas').getAttribute('data-progress')
  await page.waitForTimeout(120)
  expect(await page.locator('.lesson-canvas').getAttribute('data-progress')).toBe(frozen)
})
