/**
 * 看板的纯格式化/归一化函数（与 React 解耦，便于单元测试）。
 * @module @captain1275/dsh-usage-dashboard/client/dashboard-format
 */

/** 数值格式化：千分位 + 大数缩写。 */
export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/** 费用格式化：¥X.XX，小额保留 4 位；0 显示 ¥0（D5）。 */
export function fmtCost(n: number): string {
  if (n <= 0) return '¥0'
  if (n >= 100) return `¥${Math.round(n)}`
  if (n >= 1) return `¥${n.toFixed(2)}`
  return `¥${n.toFixed(4)}`
}

/** 一天序列中的一行（与 host /api/usage/summary 的 recent 对应）。 */
export interface RecentDay {
  day: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens?: number
  calls: number
}

/**
 * 把 recent 序列补齐到至少 min 天：不足时在前面补零条目，键唯一
 * （pad-N，不会与 YYYY-MM-DD 冲突）。宿主旧版本可能返回不足 14 条
 * 或空数组，补齐后柱状图不会再出现除零/缺柱（D2/D3）。
 */
export function padRecentDays(recent: RecentDay[], min: number): RecentDay[] {
  if (recent.length >= min) return recent
  const pad = min - recent.length
  const zeros: RecentDay[] = Array.from({ length: pad }, (_, i) => ({
    day: `pad-${pad - i}`,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    calls: 0,
  }))
  return [...zeros, ...recent]
}