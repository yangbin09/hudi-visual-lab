import { expect, test } from '@playwright/test'

test('八课使用不同教学结构，完整播放与回退没有页面溢出或运行错误',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 for(const id of ['B01','B02','B03','B04','B05','B06','B07','B08']){
  await page.goto(`/experiment/${id}`)
  const scene=page.locator(`[data-detail="basics-${id}"]`);await expect(scene).toBeVisible()
  if(['B02','B03'].includes(id)){await page.getByRole('button',{name:'↑ Upsert 更新记录'}).click();await page.getByRole('button',{name:'跳过动画'}).click()}
  else await page.getByRole('button',{name:'跳到结果',exact:true}).click()
  await expect(scene.locator('svg')).toBeVisible()
  if(id==='B01'){await page.getByRole('slider',{name:'动画进度'}).fill('3.48');await expect(scene).toContainText('新提交已生效');await expect(scene).toContainText('当前 1001 的金额：200')}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id).toBe(true)
  const geometry=await scene.locator('svg').evaluate(el=>{const s=el as unknown as SVGSVGElement;const box=s.viewBox.baseVal;return [...s.querySelectorAll('text')].filter(t=>t.getBoundingClientRect().width>0).map(t=>{const r=t.getBBox(),matrix=t.getCTM(),parent=s.getCTM();if(!matrix||!parent)return '';const point=s.createSVGPoint();point.x=r.x+r.width;point.y=r.y+r.height;const p=point.matrixTransform(parent.inverse().multiply(matrix));return p.x>box.width+3||p.y>box.height+3?t.textContent:''}).filter(Boolean)})
  expect(geometry,`${id} 文本越出画布`).toEqual([])
  await page.getByRole('button',{name:'上一步',exact:true}).click()
  const frozen=await scene.locator('svg').getAttribute('data-progress');await page.waitForTimeout(80);expect(await scene.locator('svg').getAttribute('data-progress')).toBe(frozen)
 }
 expect(errors).toEqual([])
})

test('COW 清晰区分旧 Base、逐行复制、候选新 Base 与提交可见性',async({page})=>{
 await page.goto('/experiment/B02');await page.getByRole('button',{name:'↑ Upsert 更新记录'}).click()
 const slider=page.getByRole('slider',{name:'动画进度'}),scene=page.locator('[data-detail="basics-B02"]')
 await slider.fill('3.55');await expect(scene).toContainText('其中 2 条原样复制');await expect(scene.locator('.vl-query-value').first()).toHaveText('¥ 100.5')
 await expect(scene.locator('[data-detail="cow-mor-row-copy"] text')).toHaveCount(3)
 const before=await scene.innerHTML();await page.waitForTimeout(100);expect(await scene.innerHTML()).toBe(before)
 await page.getByRole('button',{name:'跳过动画'}).click();await expect(scene.locator('.vl-query-value').first()).toHaveText('¥ 200')
 await scene.getByRole('button',{name:'查看原 Base · 不原地修改',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('100.5');await page.keyboard.press('Escape')
 await scene.getByRole('button',{name:'查看新 Base · 完整记录',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('200')
})

test('MOR 累积两个版本，快照归并与只读 Base 不同，Compaction 后收束',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/experiment/B03')
 await page.getByRole('button',{name:'↑ Upsert 更新记录'}).click()
 await page.getByRole('button',{name:'⚙ 参数'}).click();await page.getByRole('spinbutton',{name:'更新后的金额'}).fill('450');await page.keyboard.press('Escape')
 await page.getByRole('button',{name:'↑ Upsert 更新记录'}).click()
 const scene=page.locator('[data-detail="basics-B03"]'),values=scene.locator('.vl-query-value')
 await expect(scene).toContainText('2 个 Log');await expect(scene).toContainText('v2');await expect(values.nth(0)).toHaveText('¥ 450');await expect(values.nth(1)).toHaveText('¥ 100.5')
 await page.getByRole('button',{name:'① Schedule'}).click();await page.getByRole('button',{name:'② Compaction'}).click()
 await expect(values.nth(0)).toHaveText('¥ 450');await expect(values.nth(1)).toHaveText('¥ 450');await expect(scene).toContainText('0 个 Log')
 await page.getByRole('slider',{name:'动画进度'}).fill('3.5');await expect(scene).toContainText('候选新 Base');await expect(values.nth(1)).toHaveText('¥ 100.5')
})

test('File Group 层级与版本时间轴分别展示稳定身份及新 Slice 边界',async({page})=>{
 await page.goto('/experiment/B04');const slider=page.getByRole('slider',{name:'动画进度'});await slider.fill('2.9')
 const scene=page.locator('[data-detail="basics-B04"]');await expect(scene).toContainText('1 个 Log File');await expect(scene).toContainText('稳定的 File ID')
 await page.getByRole('button',{name:'跳到结果'}).click();await expect(scene).toContainText('0 个 Log File');await expect(scene).toContainText('2 个旧物理文件仍保留')
 await page.goto('/experiment/B05');await page.getByRole('slider',{name:'动画进度'}).fill('2.9')
 const versions=page.locator('[data-detail="basics-B05"]');await expect(versions).toContainText('Log · version 2');await expect(versions).toContainText('+ 2 个 Log')
 await page.getByRole('button',{name:'跳到结果'}).click();await expect(versions).toContainText('+ 0 个 Log');await expect(versions.getByText('旧版本保留，等待 Cleaner',{exact:true})).toHaveCount(3)
})

test('两个读者在提交前后选择不同文件，历史路径可以独立突出',async({page})=>{
 await page.goto('/experiment/B07');const slider=page.getByRole('slider',{name:'动画进度'}),scene=page.locator('[data-detail="basics-B07"]')
 await slider.fill('1.6');await expect(scene).toContainText('Snapshot · 最新已提交时刻1001 → ¥ 100.5')
 await slider.fill('1.9');await expect(scene).toContainText('Snapshot · 最新已提交时刻1001 → ¥ 200');await expect(scene).toContainText('历史读取 · 固定旧时刻1001 → ¥ 100.5')
 await page.getByLabel('突出读取路径',{exact:true}).selectOption('old');await expect(scene.locator('g[transform="translate(800,101)"]')).toHaveAttribute('opacity','0.3')
})

test('目录树可用键盘展开，写入后实际文件与提交同时可核对',async({page})=>{
 await page.goto('/experiment/B08');const scene=page.locator('[data-detail="basics-B08"]'),data=scene.getByRole('button',{name:'展开或收起数据目录'})
 await expect(scene.getByRole('button',{name:/^目录文件/})).toHaveCount(1);await data.focus();await page.keyboard.press('Enter');await expect(scene.getByRole('button',{name:/^目录文件/})).toHaveCount(0)
 await page.keyboard.press('Space');await page.getByRole('button',{name:'跳到结果'}).click();await expect(scene.getByRole('button',{name:/^目录文件/})).toHaveCount(2);await expect(scene).toContainText('物理文件 2 · 已完成 2 次提交')
 await scene.getByRole('button',{name:/^目录文件/}).last().click();await expect(page.getByRole('dialog')).toContainText('1004')
})
