import type { HudiTable, IndexType } from '@/models/hudi'

/**
 * 索引规则。
 *
 * ⚠️ BUCKET 索引的分桶哈希算法在 r26 尚未确认（见 HuaweiMRS350R26Profile.indexRules）。
 * 本模块实现的是「教学示意算法」，界面必须显著标注，不得声称与 r26 一致。
 */

export const BUCKET_ALGORITHM_NOTE =
  '教学示意算法（djb2 取模）。r26 的实际分桶哈希与 File Group 分配规则待源码/实测确认。'

export interface TeachingHashStep { character: string; code: number; before: number; after: number }
function walkTeachingHash(key: string, observe?: (step: TeachingHashStep)=>void): number {
  let h=5381
  for(let i=0;i<key.length;i++){
    const before=h, code=key.charCodeAt(i)
    h=((h<<5)+h+code)|0
    observe?.({character:key[i]!,code,before,after:h})
  }
  return Math.abs(h)
}
/** Teaching hash and its explanation use exactly the same 32-bit computation path. */
export function teachingHash(key: string): number { return walkTeachingHash(key) }
export function teachingHashSteps(key: string) {
  const steps: TeachingHashStep[]=[]
  const value=walkTeachingHash(key,step=>steps.push(step))
  return {initial:5381,steps,value}
}

/** 计算桶号 */
export function bucketOf(recordKey: string, bucketCount: number): number {
  if (bucketCount <= 0) return 0
  return teachingHash(recordKey) % bucketCount
}

/** 索引是否支持 upsert（定位已有文件） */
export function indexSupportsUpsert(indexType: IndexType): boolean {
  switch (indexType) {
    case 'SIMPLE':
    case 'BLOOM':
    case 'GLOBAL_SIMPLE':
    case 'GLOBAL_BLOOM':
    case 'BUCKET':
      return true
    default:
      return false
  }
}

/** 索引是否跨分区生效 */
export function isGlobalIndex(indexType: IndexType): boolean {
  return indexType === 'GLOBAL_SIMPLE' || indexType === 'GLOBAL_BLOOM'
}

/**
 * 索引能力描述 —— 用于在界面上解释「这个索引怎么定位文件」。
 */
export function indexDescription(indexType: IndexType): {
  title: string
  brief: string
  detail: string
  scope: 'partition' | 'global'
} {
  switch (indexType) {
    case 'SIMPLE':
      return {
        title: 'SIMPLE 索引',
        brief: '读取时全量扫描文件，仅在写入时用内存 HashMap 定位旧记录',
        detail:
          '写入路径上，Hudi 在内存中维护 RecordKey → FileId 的映射，用于找出待更新的文件；查询路径不依赖索引，会扫描分区下所有文件。适合写入后读全量、且分区文件数可控的场景。',
        scope: 'partition',
      }
    case 'BLOOM':
      return {
        title: 'BLOOM 索引',
        brief: '每个数据文件携带 Bloom Filter，读取时用 RecordKey 快速判断文件是否可能包含该记录',
        detail:
          'Bloom Filter 存放在每个 base file 的 footer 中。查询时先检查文件 Bloom Filter，不命中则跳过文件，避免打开无关文件。Bloom Filter 是概率结构，可能误判「可能包含」，但不会漏判。',
        scope: 'partition',
      }
    case 'GLOBAL_SIMPLE':
      return {
        title: 'GLOBAL SIMPLE 索引',
        brief: 'SIMPLE 的全局版本，索引在所有分区上生效',
        detail:
          '全局索引使同主键记录在跨分区场景下也能被正确定位，代价是索引构建与维护成本更高。r26 的具体行为需实测确认。',
        scope: 'global',
      }
    case 'GLOBAL_BLOOM':
      return {
        title: 'GLOBAL BLOOM 索引',
        brief: 'BLOOM 的全局版本',
        detail: '全局范围维护 Bloom Filter，跨分区定位能力更强，开销也更大。r26 的具体行为需实测确认。',
        scope: 'global',
      }
    case 'BUCKET':
      return {
        title: 'BUCKET 索引',
        brief: '按主键哈希固定分桶，主键到 File Group 的映射稳定不变',
        detail:
          'BUCKET 索引把主键哈希映射到固定数量的桶，每个桶对应一个 File Group。同一个主键永远落在同一个 File Group 中，因此 upsert 只需重写该桶对应的文件，避免了全局索引的扫描开销。r26 的分桶算法待确认。',
        scope: 'partition',
      }
    default:
      return { title: '未知索引', brief: '', detail: '', scope: 'partition' }
  }
}

/**
 * 检查写操作与索引的组合约束。
 * 返回 null 表示允许；返回字符串表示拒绝原因。
 */
export function checkOperationCompatibility(
  table: HudiTable,
  operation: 'UPSERT' | 'INSERT' | 'BULK_INSERT' | 'INSERT_OVERWRITE' | 'INSERT_OVERWRITE_TABLE',
): string | null {
  if (table.indexType === 'BUCKET' && operation === 'BULK_INSERT') {
    return (
      'BUCKET 索引表与 bulk_insert 的组合限制在 r26 尚未确认（社区 0.15 文档亦未明确说明）。' +
      '按保守策略拦截该组合，请先在 r26 环境实测。'
    )
  }
  if (table.indexType === 'BUCKET' && operation === 'INSERT_OVERWRITE') {
    return 'BUCKET 索引表执行 insert_overwrite 的行为需实测确认，当前不提供可执行模拟。'
  }
  return null
}
