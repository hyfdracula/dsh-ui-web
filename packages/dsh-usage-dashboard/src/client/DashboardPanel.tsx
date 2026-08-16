/**
 * Usage dashboard panel — the colorful full-screen overlay. Reads the host
 * `/api/usage/summary` and renders: rainbow stat cards, a 14-day bar chart,
 * a model-donut chart, and a session ranking table. Hand-drawn SVG, no chart
 * library.
 * @module @captain1275/dsh-usage-dashboard/client/DashboardPanel
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import css from './usage.module.css'
import { t } from './locales.ts'

/** 看板聚合数据（与 host /api/usage/summary 对应）。 */
export interface UsageSummary {
  total: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; calls: number }
  byModel: Record<string, { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; calls: number }>
  recent: Array<{ day: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens?: number; calls: number }>
  sessions: Array<{ id: string; title: string; model: string; lastTs: number; totalTokens: number; calls: number; cost: number }>
  byDayCount: number
  cost: { total: number; byModel: Record<string, number> }
}

/** 一个聚合桶的总 token（输入 + 输出 + 缓存读 + 缓存写），与会话排行口径一致。 */
function bucketTokens(b: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens?: number }): number {
  return b.inputTokens + b.outputTokens + b.cacheReadTokens + (b.cacheWriteTokens ?? 0)
}

/** 看板色板：Aqua 蓝系（同一色相族内区分系列，避免彩虹噪点）。 */
const PALETTE = ['#3f76d8', '#6e9be8', '#4a9eda', '#8fb5ef', '#2f62c4', '#7bc4e8', '#5b8fe6', '#a8ccf2']

/** 数值格式化：千分位 + 大数缩写。 */
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

/** 十六进制颜色转 rgba。 */
function hexToRgba(hex: string, alpha: number): string {
  const v = parseInt(hex.slice(1), 16)
  const r = (v >> 16) & 255
  const g = (v >> 8) & 255
  const b = v & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 费用格式化：¥X.XX，小额保留 4 位。 */
function fmtCost(n: number): string {
  if (n >= 100) return `¥${Math.round(n)}`
  if (n >= 1) return `¥${n.toFixed(2)}`
  return `¥${n.toFixed(4)}`
}

/** 拉取看板数据。 */
async function fetchSummary(): Promise<UsageSummary> {
  const res = await fetch('/api/usage/summary')
  if (!res.ok) throw new Error(`usage summary failed: ${res.status}`)
  const data = (await res.json()) as { ok: boolean } & UsageSummary
  return data
}

/** 彩色统计卡片。 */
function StatCard(props: { label: string; value: string; sub: string; color: string }): ReactElement {
  return (
    <div className={css.statCard} style={{ background: `linear-gradient(135deg, ${hexToRgba(props.color, 0.22)}, ${hexToRgba(props.color, 0.05)})`, borderColor: hexToRgba(props.color, 0.4) }}>
      <div className={css.statValue} style={{ color: props.color }}>{props.value}</div>
      <div className={css.statLabel}>{props.label}</div>
      <div className={css.statSub}>{props.sub}</div>
    </div>
  )
}

/** 单日 token 总量（输入 + 输出 + 缓存读 + 缓存写），与看板其它口径一致。 */
function dayTotal(d: UsageSummary['recent'][number]): number {
  return d.inputTokens + d.outputTokens + d.cacheReadTokens + (d.cacheWriteTokens ?? 0)
}

/** 近 14 天柱状图（SVG）。含右侧参考轴（0 / 半高 / 满高）。 */
function TrendChart(props: { recent: UsageSummary['recent'] }): ReactElement {
  const W = 560
  const H = 160
  const PAD = { left: 8, right: 40, top: 12, bottom: 24 }
  const max = Math.max(1, ...props.recent.map(dayTotal))
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const barW = innerW / props.recent.length
  const gridValues = Array.from(new Set([max, Math.round(max / 2), 0]))
  return (
    <svg className={css.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('usage.trend')}>
      {gridValues.map((v) => {
        const y = PAD.top + innerH - (v / max) * innerH
        return (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              className={css.gridLine}
            />
            <text
              x={W - 4}
              y={y + 3}
              textAnchor="end"
              className={css.axisValue}
            >
              {fmt(v)}
            </text>
          </g>
        )
      })}
      {props.recent.map((d, i) => {
        const total = dayTotal(d)
        const h = total === 0 ? 0 : Math.max(2, (total / max) * innerH)
        const x = PAD.left + i * barW
        const y = PAD.top + innerH - h
        const color = PALETTE[i % PALETTE.length]
        return (
          <g key={d.day}>
            <rect x={x + barW * 0.18} y={y} width={barW * 0.64} height={h} rx={3} fill={color}>
              <title>{`${d.day}: ${fmt(total)} tokens\n${t('usage.input')} ${fmt(d.inputTokens)} / ${t('usage.output')} ${fmt(d.outputTokens)} / ${t('usage.cache')} ${fmt(d.cacheReadTokens)}`}</title>
            </rect>
            {props.recent.length <= 14 && (i % 2 === 0) && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className={css.axisLabel}>
                {d.day.slice(5)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** 模型分布环形图（SVG）。口径与会话排行一致：输入 + 输出 + 缓存读 + 缓存写。 */
function ModelDonut(props: { byModel: UsageSummary['byModel'] }): ReactElement {
  const entries = Object.entries(props.byModel).sort((a, b) => bucketTokens(b[1]) - bucketTokens(a[1]))
  const total = entries.reduce((acc, [, v]) => acc + bucketTokens(v), 0)
  const R = 56
  const CX = 90
  const CY = 90
  const STROKE = 26
  const CIRC = 2 * Math.PI * R
  let acc = 0
  return (
    <div className={css.donutWrap}>
      <svg viewBox="0 0 180 180" className={css.donut} role="img" aria-label={t('usage.models')}>
        {entries.map(([name, v], i) => {
          const frac = total === 0 ? 0 : bucketTokens(v) / total
          const dash = frac * CIRC
          const offset = -(acc * CIRC)
          acc += frac
          return (
            <circle
              key={name}
              cx={CX}
              cy={CY}
              r={R}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${CIRC - dash}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${CX} ${CY})`}
            >
              <title>{`${name}: ${fmt(bucketTokens(v))} tokens`}</title>
            </circle>
          )
        })}
        <text x={CX} y={CY - 2} textAnchor="middle" className={css.donutTotal}>{fmt(total)}</text>
        <text x={CX} y={CY + 14} textAnchor="middle" className={css.donutLabel}>{t('usage.tokens')}</text>
      </svg>
      <div className={css.legend}>
        {entries.map(([name, v], i) => (
          <div key={name} className={css.legendRow}>
            <span className={css.legendDot} style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className={css.legendName}>{name}</span>
            <span className={css.legendVal}>{fmt(bucketTokens(v))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The dashboard overlay panel.
 * @param props - onClose callback.
 * @returns portal element tree.
 */
export function DashboardPanel(props: { onClose: () => void }): ReactElement {
  const [summary, setSummary] = useState<UsageSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback((): void => {
    setError(null)
    fetchSummary()
      .then(setSummary)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const hasData = summary !== null && summary.total.calls > 0
  const totalTokens = summary === null ? 0 : bucketTokens(summary.total)

  return createPortal((
    <div className={css.overlay} role="presentation">
      <div className={css.mask} aria-hidden="true" onClick={props.onClose} />
      <div className={css.panel} role="dialog" aria-modal="true" aria-label={t('usage.title')}>
        <div className={css.header}>
          <h2 className={css.title}>{t('usage.title')}</h2>
          <button type="button" className={css.close} aria-label={t('usage.close')} onClick={props.onClose}>
            <svg viewBox="0 0 16 16" width="16" height="16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        {error !== null && <div className={css.error}>{error}</div>}

        {summary !== null && !hasData && (
          <div className={css.empty}>
            <div className={css.emptyTitle}>{t('usage.empty')}</div>
            <div className={css.emptyHint}>{t('usage.noData')}</div>
          </div>
        )}

        {summary !== null && hasData && (
          <div className={css.body}>
            <div className={css.statGrid}>
              <StatCard label={t('usage.total')} value={fmt(totalTokens)} sub={`${fmt(summary.total.inputTokens)} in / ${fmt(summary.total.outputTokens)} out`} color={PALETTE[0]} />
              <StatCard label={t('usage.calls')} value={fmt(summary.total.calls)} sub={t('usage.daysRecorded', { days: summary.byDayCount })} color={PALETTE[1]} />
              <StatCard label={t('usage.cache')} value={fmt(summary.total.cacheReadTokens)} sub={t('usage.cacheHit')} color={PALETTE[2]} />
              <StatCard label={t('usage.cost')} value={fmtCost(summary.cost?.total ?? 0)} sub={t('usage.costHint')} color={PALETTE[3]} />
            </div>

            <div className={css.section}>
              <div className={css.sectionTitle}>{t('usage.trend')}</div>
              <div className={css.sectionSub}>{t('usage.trendDetail')}</div>
              <TrendChart recent={summary.recent} />
            </div>

            <div className={css.twoCol}>
              <div className={css.section}>
                <div className={css.sectionTitle}>{t('usage.models')}</div>
                <ModelDonut byModel={summary.byModel} />
              </div>
              <div className={css.section}>
                <div className={css.sectionTitle}>{t('usage.sessions')}</div>
                <div className={css.sessionList}>
                  {summary.sessions.map((s, i) => {
                    const max = summary.sessions[0]?.totalTokens ?? 1
                    const pct = Math.max(2, Math.round((s.totalTokens / max) * 100))
                    const color = PALETTE[i % PALETTE.length]
                    return (
                      <div key={s.id} className={css.sessionRow}>
                        <span className={css.sessionRank} style={{ color }}>{i + 1}</span>
                        <div className={css.sessionInfo}>
                          <div className={css.sessionName}>{s.title}</div>
                          <div className={css.sessionMeta}>{s.model} · {s.calls} {t('usage.calls')}</div>
                          <div className={css.sessionBar}>
                            <div className={css.sessionBarFill} style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </div>
                        <div className={css.sessionTokens}>
                          <span>{fmt(s.totalTokens)}</span>
                          {s.cost !== undefined && <span className={css.sessionCost}>{fmtCost(s.cost)}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}
