import { describe, expect, it } from 'vitest'

import {
  ALL_TEMPLATES,
  buildSql,
  createTemplateContext,
  DEFAULT_TEMPLATE_CONTEXT,
  findTemplate,
  findTemplateIn,
  render,
  TEMPLATE_LANGUAGES,
  TEMPLATES,
  templateIds,
  templatesByStatus,
} from '@/engine/templates'
import { SQL_STATUS_LABEL } from '@/engine/templates/types'
import { EVIDENCE_REPOSITORY, getEvidence } from '@/evidence'
import { SimulationError } from '@/engine/core/errors'

/**
 * 模板引擎。
 *
 * 三条底线：
 *   1. 渲染后不能残留未替换的 `${}` 占位符 —— 模板渲染错了必须一眼看得出来；
 *   2. `run clean on` 模板的状态必须是 conditional（华为文档标注 MRS 3.2.0+ 才有）；
 *   3. 模板引用的 evidenceIds 必须**真实存在于证据库** —— 不得引用不存在的证据 id。
 */

/** 允许出现的模板状态 */
const ALLOWED_STATUS = ['verified', 'unverified', 'conditional']

describe('模板渲染', () => {
  it('所有模板渲染后都不含未替换的 ${} 占位符', () => {
    TEMPLATE_LANGUAGES.forEach((language) => {
      TEMPLATES[language].forEach((block) => {
        const rendered = buildSql(language, block.id)
        expect(rendered, `模板 ${language}/${block.id} 仍有未替换的占位符`).not.toMatch(/\$\{[^}]*\}/)
        expect(rendered.length).toBeGreaterThan(0)
      })
    })
  })

  it('默认上下文能填满模板里的每一个变量', () => {
    const ctx = DEFAULT_TEMPLATE_CONTEXT
    ALL_TEMPLATES.forEach((block) => {
      const rendered = render(block.code, ctx)
      expect(rendered, `模板 ${block.id} 仍有未替换的占位符`).not.toMatch(/\$\{[^}]*\}/)
    })
  })

  it('局部覆盖上下文后依然没有残留占位符', () => {
    const ctx = createTemplateContext({ database: 'db2', table: 't2', qualifiedTable: 'db2.t2' })
    const rendered = buildSql('spark-sql', 'spark-create-table-cow', ctx)
    expect(rendered).toContain('db2.t2')
    expect(rendered).not.toMatch(/\$\{[^}]*\}/)
  })

  it('未知变量原样保留（不静默替换成空串）', () => {
    const rendered = render('SELECT ${known}, ${unknownVar}', { known: '1' } as never)
    expect(rendered).toBe('SELECT 1, ${unknownVar}')
  })

  it('模板 id 不存在时抛 SimulationError', () => {
    expect(() => buildSql('spark-sql', 'no-such-template')).toThrow(SimulationError)
  })

  it('findTemplate / findTemplateIn 能按 id 找到模板', () => {
    expect(findTemplate('spark-clean')?.title).toContain('Clean')
    expect(findTemplateIn('spark-sql', 'spark-clean')?.id).toBe('spark-clean')
    expect(findTemplate('不存在的模板')).toBeUndefined()
    expect(templateIds('spark-sql')).toContain('spark-clean')
  })
})

describe('模板状态', () => {
  it('run clean on 模板的状态必须是 conditional', () => {
    const clean = findTemplateIn('spark-sql', 'spark-clean')
    expect(clean).toBeDefined()
    expect(clean?.status).toBe('conditional')
    // 有条件支持必须写明前置条件
    expect(clean?.prerequisites?.length).toBeGreaterThan(0)
    expect(clean?.prerequisites?.join('\n')).toContain('3.2.0')
    // 并说明 3.1.x 的替代做法
    expect(clean?.prerequisites?.join('\n')).toContain('hoodie.clean.automatic')
  })

  it('conditional 的模板必须带 prerequisites', () => {
    ALL_TEMPLATES.filter((b) => b.status === 'conditional').forEach((b) => {
      expect(b.prerequisites?.length, `模板 ${b.id} 缺少 prerequisites`).toBeGreaterThan(0)
    })
  })

  it('所有模板的状态都在允许集合内', () => {
    ALL_TEMPLATES.forEach((b) => {
      expect(ALLOWED_STATUS, `模板 ${b.id} 状态非法`).toContain(b.status)
    })
  })

  it('状态标签齐全', () => {
    expect(SQL_STATUS_LABEL.verified).toContain('确认')
    expect(SQL_STATUS_LABEL.conditional).toContain('条件')
    expect(SQL_STATUS_LABEL.unverified).toContain('待验证')
  })

  it('templatesByStatus 能按状态筛选', () => {
    expect(templatesByStatus('spark-sql', 'conditional').map((b) => b.id)).toContain('spark-clean')
    expect(templatesByStatus('spark-sql', 'verified').every((b) => b.status === 'verified')).toBe(true)
  })
})

describe('模板的证据引用', () => {
  it('所有模板的 evidenceIds 都能在 EVIDENCE_REPOSITORY 中找到', () => {
    ALL_TEMPLATES.forEach((block) => {
      const ids = block.evidenceIds ?? []
      ids.forEach((id) => {
        const evidence = getEvidence(id)
        expect(evidence, `模板 ${block.id} 引用了不存在的证据 id：${id}`).toBeDefined()
      })
    })
  })

  it('每个模板至少引用一条证据', () => {
    ALL_TEMPLATES.forEach((block) => {
      expect(block.evidenceIds?.length, `模板 ${block.id} 没有引用任何证据`).toBeGreaterThan(0)
    })
  })

  it('证据 id 在库中唯一', () => {
    const ids = EVIDENCE_REPOSITORY.map((e) => e.evidenceId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('模板内容的关键断言', () => {
  it('run clean 模板渲染后是真正的存储过程调用', () => {
    const rendered = buildSql('spark-sql', 'spark-clean')
    expect(rendered).toContain('RUN CLEAN ON')
    expect(rendered).toContain('hudi_demo.hudi_ro_t1')
  })

  it('compaction plan 模板包含 r26 规范里的关键配置', () => {
    const rendered = buildSql('spark-sql', 'spark-compaction-plan-only')
    expect(rendered).toContain('hoodie.compact.inline')
    expect(rendered).toContain('hoodie.run.compact.only.inline')
    expect(rendered).toContain('RUN COMPACTION ON')
  })

  it('TTL 模板的 level 固定为 PARTITION', () => {
    const rendered = buildSql('spark-sql', 'spark-ttl-save')
    expect(rendered).toContain('ttl_policy_save')
    expect(rendered).toContain("level => 'PARTITION'")
  })

  it('read-optimized 模板显式打开 hoodie.datasource.read.optimized', () => {
    const rendered = buildSql('spark-sql', 'spark-query-read-optimized')
    expect(rendered).toContain('hoodie.datasource.read.optimized')
  })
})
