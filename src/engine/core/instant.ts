/**
 * Instant Time 生成器。
 *
 * Hudi 的 instant time 形如 20240101120000（yyyyMMddHHmmss），且必须单调递增。
 * 模拟器用固定的起始时间 + 秒级递增，保证：
 *   - 相同输入 → 相同输出（确定性）
 *   - 不会出现重复 instant
 */
export const SIMULATION_EPOCH = '20240101120000'

/** 把 yyyyMMddHHmmss 格式化成可读时间 */
export function prettyInstant(t: string): string {
  if (!t || t.length !== 14) return t
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)} ${t.slice(8, 10)}:${t.slice(10, 12)}:${t.slice(12, 14)}`
}

/** 基于 epoch 与偏移秒数生成 instant time */
export function instantAt(offsetSeconds: number, epoch = SIMULATION_EPOCH): string {
  const base = Date.UTC(
    Number(epoch.slice(0, 4)),
    Number(epoch.slice(4, 6)) - 1,
    Number(epoch.slice(6, 8)),
    Number(epoch.slice(8, 10)),
    Number(epoch.slice(10, 12)),
    Number(epoch.slice(12, 14)),
  )
  const d = new Date(base + offsetSeconds * 1000)
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  )
}

/** 下一个 instant time */
export function nextInstant(counter: number, epoch = SIMULATION_EPOCH): string {
  return instantAt(counter, epoch)
}

/** 判断 instant 是否为该格式 */
export function isInstantTime(v: string): boolean {
  return /^\d{14}$/.test(v)
}
