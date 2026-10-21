import type { HudiFileGroup, HudiTable, InstantAction, InstantState } from '@/models/hudi'

/**
 * HDFS 目录与文件命名。
 *
 * ⚠️ 重要：本模块中的文件名格式属于「简化教学显示」。
 * 真实 r26 的文件命名由 HoodieFileNameParser 决定，
 * 细节（分隔符、baseInstant 位置、log 文件尾部字段含义）需以 r26 源码/实测校正。
 * 界面上必须区分「简化教学显示」与「r26 实际格式」（见需求 P03）。
 */

export const SIMPLIFIED_NOTE = '简化教学显示：文件名格式未逐字节对齐 r26 的 HoodieFileNameParser。'

export interface HoodieDirEntry {
  path: string
  type: 'dir' | 'file'
  size?: number
  children?: HoodieDirEntry[]
}

/** 物理常量（教学值） */
export const AVG_RECORD_BYTES = 96
export const BASE_FILE_OVERHEAD = 1024
export const LOG_BLOCK_SIZE = 1024 * 1024

export function tableRoot(table: HudiTable): string {
  return table.tablePath.replace(/\/+$/, '')
}

/** 文件组 ID：{writeToken}_{taskPartitionId}_{fileId} */
export function makeFileGroupId(writeToken: string, taskPartitionId: number, fileId: number): string {
  return `${writeToken}_${taskPartitionId}-${fileId}`
}

/** Base File 名：{fileGroupId}_{baseInstantTime}.parquet */
export function baseFileName(fileGroupId: string, baseInstantTime: string): string {
  return `${fileGroupId}_${baseInstantTime}.parquet`
}

/** Log File 名：{fileGroupId}_{baseInstantTime}.log.{version}_{writeToken} */
export function logFileName(fileGroupId: string, baseInstantTime: string, version: number, writeToken: string): string {
  return `${fileGroupId}_${baseInstantTime}.log.${version}_${writeToken}`
}

/** 估算 parquet 文件大小（教学估算，非真实压缩后大小） */
export function estimateBaseFileSize(recordCount: number): number {
  return BASE_FILE_OVERHEAD + recordCount * AVG_RECORD_BYTES
}

/** 估算 log 文件大小（按 log block 向上取整） */
export function estimateLogFileSize(recordCount: number): number {
  const raw = recordCount * AVG_RECORD_BYTES
  return Math.max(LOG_BLOCK_SIZE, Math.ceil(raw / LOG_BLOCK_SIZE) * LOG_BLOCK_SIZE)
}

/** 分区目录名 */
export function partitionDirName(table: HudiTable, partitionPath: string): string {
  if (!table.partitionFields.length) return ''
  if (table.hiveStylePartitioning === 'NONE') return partitionPath
  // HIVE_STYLE_PARTITIONING / STYLE_PARTITIONING_ONLY 均以 字段=值 形式组织目录
  const field = table.partitionFields[0]
  const value = partitionPath === '' ? 'null' : partitionPath
  return `${field}=${value}`
}

/** 分区路径 → HDFS 相对目录 */
export function partitionRelativeDir(table: HudiTable, partitionPath: string): string {
  const dir = partitionDirName(table, partitionPath)
  return dir ? `${dir}/` : ''
}

/** 完整的分区文件目录 */
export function partitionFullPath(table: HudiTable, partitionPath: string): string {
  return `${tableRoot(table)}/${partitionRelativeDir(table, partitionPath)}`
}

/** .hoodie 目录 */
export function hoodieDir(table: HudiTable): string {
  return `${tableRoot(table)}/.hoodie`
}

/** instant 文件名 */
export function instantFileName(instantTime: string, action: InstantAction, state: InstantState): string {
  if (state === 'COMPLETED') {
    switch (action) {
      case 'COMMIT':
        return `${instantTime}.commit`
      case 'DELTA_COMMIT':
        return `${instantTime}.deltacommit`
      case 'COMPACTION':
        return `${instantTime}.compaction`
      case 'CLEAN':
        return `${instantTime}.clean`
      case 'ARCHIVE':
        return `${instantTime}.archive`
      case 'ROLLBACK':
        return `${instantTime}.rollback`
      case 'REPLACE_COMMIT':
        return `${instantTime}.replacecommit`
      case 'CLUSTERING':
        return `${instantTime}.clustering`
      case 'RESTORE':
        return `${instantTime}.restore`
      case 'TTL':
        return `${instantTime}.ttl`
      case 'SAVEPOINT':
        return `${instantTime}.savepoint`
      default: {
        const unreachable: never = action
        return `${instantTime}.${String(unreachable).toLowerCase()}`
      }
    }
  }
  return `${instantTime}.${action.toLowerCase()}.${state.toLowerCase()}`
}

/** 构造完整 HDFS 目录树 */
export function buildDirectoryTree(table: HudiTable, groups: HudiFileGroup[], extraHoodieFiles: string[] = []): HoodieDirEntry {
  const root: HoodieDirEntry = {
    path: tableRoot(table),
    type: 'dir',
    children: [
      {
        path: `${tableRoot(table)}/.hoodie`,
        type: 'dir',
        children: [
          { path: `${tableRoot(table)}/.hoodie/.hoodie`, type: 'file', size: 512 },
          { path: `${tableRoot(table)}/.hoodie/.hoodie_0`, type: 'file', size: 512 },
          { path: `${tableRoot(table)}/.hoodie/.hoodie_r0`, type: 'file', size: 128 },
          ...extraHoodieFiles.map((f) => ({ path: `${tableRoot(table)}/.hoodie/${f}`, type: 'file' as const, size: 256 })),
        ],
      },
    ],
  }

  const partitionMap = new Map<string, HoodieDirEntry>()
  groups.forEach((g) => {
    const rel = partitionRelativeDir(table, g.partitionPath)
    if (!partitionMap.has(rel)) {
      const dir: HoodieDirEntry = {
        path: `${tableRoot(table)}/${rel}`,
        type: 'dir',
        children: [],
      }
      partitionMap.set(rel, dir)
      root.children!.push(dir)
    }
    const dir = partitionMap.get(rel)!
    const push = (name: string, size: number) => {
      dir.children!.push({ path: `${tableRoot(table)}/${rel}${name}`, type: 'file', size })
    }
    if (g.fileSlice.baseFile) push(g.fileSlice.baseFile.fileName, g.fileSlice.baseFile.sizeBytes)
    g.fileSlice.logFiles.forEach((l) => push(l.fileName, l.sizeBytes))
  })

  // 目录按名称排序，文件在后
  root.children!.sort((a, b) => {
    const ad = a.type === 'dir' ? 0 : 1
    const bd = b.type === 'dir' ? 0 : 1
    return ad - bd || a.path.localeCompare(b.path)
  })
  root.children!.forEach((c) => {
    if (c.children) c.children.sort((a, b) => a.path.localeCompare(b.path))
  })
  return root
}

/** 渲染成 `tree` 命令风格的文本 */
export function renderTree(entry: HoodieDirEntry): string[] {
  const lines: string[] = [entry.path]
  const nameOf = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? p
  const walk = (node: HoodieDirEntry, prefix: string) => {
    const children = node.children ?? []
    children.forEach((c, i) => {
      const last = i === children.length - 1
      lines.push(`${prefix}${last ? '`-- ' : '|-- '}${nameOf(c.path)}${c.type === 'dir' ? '/' : ''}`)
      if (c.type === 'dir') walk(c, prefix + (last ? '    ' : '|   '))
    })
  }
  walk(entry, '')
  return lines
}
