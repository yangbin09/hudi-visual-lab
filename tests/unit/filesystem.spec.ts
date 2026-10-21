import { describe, expect, it } from 'vitest'

import { buildMorTable, buildTable, seededState, stateOf, runUpsert, TEST_PARTITION } from '@/testing/factories'
import {
  baseFileName,
  buildDirectoryTree,
  hoodieDir,
  instantFileName,
  logFileName,
  makeFileGroupId,
  partitionDirName,
  partitionFullPath,
  partitionRelativeDir,
  renderTree,
  SIMPLIFIED_NOTE,
  tableRoot,
} from '@/engine/filesystem/layout'
import type { InstantAction, InstantState } from '@/models/hudi'

/**
 * COW / MOR 的文件模型：目录树、文件命名、instant 文件名。
 *
 * ⚠️ 命名格式是「简化教学显示」（见引擎常量 SIMPLIFIED_NOTE），
 *    本测试锁定的是**本项目自己的口径**，不代表 r26 的 HoodieFileNameParser 逐字节一致。
 */

describe('目录树', () => {
  it('buildDirectoryTree 产出 .hoodie 目录与分区目录', () => {
    const state = seededState()
    const tree = buildDirectoryTree(state.table, state.fileGroups)

    expect(tree.path).toBe('/user/hive/warehouse/hudi_demo.db/orders')
    expect(tree.type).toBe('dir')

    const paths = (tree.children ?? []).map((c) => c.path)
    expect(paths).toContain('/user/hive/warehouse/hudi_demo.db/orders/.hoodie')
    expect(paths).toContain('/user/hive/warehouse/hudi_demo.db/orders/dt=2024-01-01/')

    // .hoodie 里有元数据文件
    const hoodie = (tree.children ?? []).find((c) => c.path.endsWith('/.hoodie'))
    expect(hoodie?.type).toBe('dir')
    expect((hoodie?.children ?? []).length).toBeGreaterThan(0)

    // 分区目录里有 base file
    const partition = (tree.children ?? []).find((c) => c.path.endsWith('/dt=2024-01-01/'))
    const fileNames = (partition?.children ?? []).map((c) => c.path.split('/').pop())
    expect(fileNames.some((n) => n?.endsWith('.parquet'))).toBe(true)
  })

  it('renderTree 输出包含 .hoodie 与数据文件', () => {
    const state = seededState()
    const lines = renderTree(buildDirectoryTree(state.table, state.fileGroups))

    expect(lines[0]).toBe('/user/hive/warehouse/hudi_demo.db/orders')
    expect(lines.some((l) => l.includes('.hoodie'))).toBe(true)
    expect(lines.some((l) => l.includes('.parquet'))).toBe(true)
    // 目录以 / 结尾
    expect(lines.some((l) => l.trimEnd().endsWith('.hoodie/'))).toBe(true)
  })

  /**
   * 【已知缺陷】分区目录名在渲染时丢失。
   *
   * buildDirectoryTree 产出的分区目录 path 以 '/' 结尾
   * （'/user/.../orders/dt=2024-01-01/'），
   * 而 renderTree 用 `path.split('/').pop()` 取名字 —— 末尾的 '/' 会让结果变成空串，
   * 于是目录行渲染成「`-- /」而不是「`-- dt=2024-01-01/」。
   *
   * 缺陷位置：src/engine/filesystem/layout.ts 的 renderTree()
   * （src/components/filesystem/FileTreeView.vue 的行名计算有同样的问题）。
   *
   * 这里用 it.fails 把「期望行为」钉住：
   *   - 现在失败 = 缺陷仍在（符合预期，测试整体通过）；
   *   - 哪天缺陷被修好，这条用例会失败，提醒把 .fails 去掉。
   */
  it('renderTree 应显示分区目录名 dt=2024-01-01', () => {
    const state = seededState()
    const lines = renderTree(buildDirectoryTree(state.table, state.fileGroups))
    expect(lines.some((l) => l.includes('dt=2024-01-01'))).toBe(true)
  })

  it('extraHoodieFiles 会被放进 .hoodie 目录', () => {
    const state = seededState()
    const tree = buildDirectoryTree(state.table, state.fileGroups, ['20240101120000.commit'])
    const hoodie = (tree.children ?? []).find((c) => c.path.endsWith('/.hoodie'))
    const names = (hoodie?.children ?? []).map((c) => c.path.split('/').pop())
    expect(names).toContain('20240101120000.commit')
  })

  it('分区目录名遵循 Hive Style（字段=值）', () => {
    const table = buildTable()
    expect(partitionDirName(table, '2024-01-01')).toBe('dt=2024-01-01')
    expect(partitionRelativeDir(table, '2024-01-01')).toBe('dt=2024-01-01/')
    expect(partitionFullPath(table, '2024-01-01')).toBe(
      '/user/hive/warehouse/hudi_demo.db/orders/dt=2024-01-01/',
    )
    expect(hoodieDir(table)).toBe('/user/hive/warehouse/hudi_demo.db/orders/.hoodie')
    expect(tableRoot(table)).toBe('/user/hive/warehouse/hudi_demo.db/orders')
  })

  it('SIMPLIFIED_NOTE 明确声明命名是简化教学显示', () => {
    expect(SIMPLIFIED_NOTE).toContain('简化教学显示')
  })
})

describe('文件命名格式', () => {
  it('makeFileGroupId → {writeToken}_{taskPartitionId}-{fileId}', () => {
    expect(makeFileGroupId('20240101120000', 0, 3)).toBe('20240101120000_0-3')
    expect(makeFileGroupId('20240101120000', 1, 0)).toBe('20240101120000_1-0')
  })

  it('baseFileName → {fileGroupId}_{baseInstantTime}.parquet', () => {
    expect(baseFileName('20240101120000_0-3', '20240101120000')).toBe(
      '20240101120000_0-3_20240101120000.parquet',
    )
  })

  it('logFileName → {fileGroupId}_{baseInstantTime}.log.{version}_{writeToken}', () => {
    expect(logFileName('20240101120000_0-3', '20240101120000', 2, '20240101120100')).toBe(
      '20240101120000_0-3_20240101120000.log.2_20240101120100',
    )
  })

  it('引擎实际产出的文件符合上述命名格式', () => {
    const cow = seededState()
    const cowBase = cow.physicalFiles.find((f) => f.type === 'BASE')
    expect(cowBase?.fileName).toMatch(/^\d{14}_\d+-\d+_\d{14}\.parquet$/)

    const mor = stateOf(
      runUpsert(seededState(buildMorTable()), [
        {
          recordKey: '1001',
          fields: { id: 1001, name: '订单A-已更新', amount: 1, ts: 20240101140000, dt: TEST_PARTITION },
        },
      ]),
    )
    const logs = mor.physicalFiles.filter((f) => f.type === 'LOG')
    expect(logs.length).toBeGreaterThanOrEqual(2)
    logs.forEach((f) => {
      expect(f.fileName).toMatch(/^\d{14}_\d+-\d+_\d{14}\.log\.\d+_\d{14}$/)
    })
  })
})

describe('instant 文件名', () => {
  const cases: [InstantAction, string][] = [
    ['COMMIT', '20240101120000.commit'],
    ['DELTA_COMMIT', '20240101120000.deltacommit'],
    ['COMPACTION', '20240101120000.compaction'],
    ['CLEAN', '20240101120000.clean'],
    ['ARCHIVE', '20240101120000.archive'],
    ['ROLLBACK', '20240101120000.rollback'],
    ['REPLACE_COMMIT', '20240101120000.replacecommit'],
    ['CLUSTERING', '20240101120000.clustering'],
    ['RESTORE', '20240101120000.restore'],
    ['TTL', '20240101120000.ttl'],
    ['SAVEPOINT', '20240101120000.savepoint'],
  ]

  it.each(cases)('COMPLETED 的 %s → %s', (action, expected) => {
    expect(instantFileName('20240101120000', action, 'COMPLETED')).toBe(expected)
  })

  it('非 COMPLETED 状态带状态后缀', () => {
    expect(instantFileName('20240101120000', 'COMPACTION', 'REQUESTED')).toBe(
      '20240101120000.compaction.requested',
    )
    expect(instantFileName('20240101120000', 'COMPACTION', 'INFLIGHT')).toBe(
      '20240101120000.compaction.inflight',
    )
  })

  it('同一个 action 的不同状态产出不同的文件名', () => {
    const states: InstantState[] = ['REQUESTED', 'INFLIGHT', 'COMPLETED']
    const names = states.map((s) => instantFileName('20240101120000', 'COMPACTION', s))
    expect(new Set(names).size).toBe(names.length)
  })
})
