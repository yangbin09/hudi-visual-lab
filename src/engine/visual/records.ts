import type { HudiRecord, HudiTableState } from '@/models/hudi'
/** Physical file contents, including historical versions. No logical-view substitution. */
export function fileRecords(state: HudiTableState, fileName: string): HudiRecord[] {
  for (const snapshot of [state, ...state.checkpoints.map(c => c.state).reverse()]) {
    for (const group of snapshot.fileGroups) {
      const found = [group.fileSlice.baseFile, ...group.fileSlice.logFiles].find(f => f?.fileName === fileName)
      if (found) return found.records
    }
  }
  return []
}
