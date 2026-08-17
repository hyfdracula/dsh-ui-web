/**
 * Pricing snapshot settings card — shows which pricing table is in effect
 * (builtin snapshot vs user override), coverage stats and last refresh time,
 * with a one-click refresh that pulls the latest LiteLLM table through the
 * host route. Lives in the Web UI plugin group next to the dashboard card.
 * @module @captain1275/dsh-usage-dashboard/client/PricingCard
 */
import { useEffect, useState, type ReactNode } from 'react'
import { t } from './locales.ts'
import css from './usage-settings.module.css'

/** Props the settings slot binds (owner share; card renders standalone). */
export interface PricingCardProps {
  /** Marker field: no owner props are consumed. */
  children?: never
}

/** Host route meta payload (mirrors host pricing.ts PricingMeta). */
interface PricingMeta {
  origin: 'user' | 'builtin' | 'empty'
  updatedAt: string
  fx: number
  providers: number
  models: number
  aliases: number
}

/** GET /api/usage-pricing response shape. */
interface PricingMetaResponse {
  ok: boolean
  pricing?: PricingMeta
  error?: string
}

/** 格式化 ISO 时间为本地短格式；缺失/无效值显示 '—'（X3）。 */
function formatTime(iso: string | undefined | null): string {
  if (iso === undefined || iso === null || iso === '') return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Render the pricing snapshot card.
 * @returns the card element.
 */
export function PricingCard(_props: PricingCardProps): ReactNode {
  const [open, setOpen] = useState(false)
  const [meta, setMeta] = useState<PricingMeta | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState('')

  const load = (): void => {
    void fetch('/api/usage-pricing')
      .then(async (res) => (await res.json()) as PricingMetaResponse)
      .then((data) => {
        if (data.ok && data.pricing !== undefined) setMeta(data.pricing)
      })
      .catch(() => {
        /* 路由未就绪时保持空态 */
      })
  }

  // 展开时拉一次元信息。
  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const refresh = (): void => {
    if (refreshing) return
    setRefreshing(true)
    setMessage('')
    // 宿主 refresh 路由要求 application/json 载荷（H8 的 CSRF 防护），
    // 空对象即可触发。
    void fetch('/api/usage-pricing/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
      .then(async (res) => (await res.json()) as PricingMetaResponse)
      .then((data) => {
        if (data.ok && data.pricing !== undefined) {
          setMeta(data.pricing)
          setMessage(t('usage.pricingRefreshOk'))
        } else {
          setMessage(`${t('usage.pricingRefreshFail')}: ${data.error ?? 'unknown'}`)
        }
      })
      .catch((error: unknown) => {
        setMessage(`${t('usage.pricingRefreshFail')}: ${error instanceof Error ? error.message : String(error)}`)
      })
      .finally(() => {
        setRefreshing(false)
      })
  }

  const originText = meta === null
    ? '—'
    : meta.origin === 'user'
      ? t('usage.pricingOriginUser')
      : meta.origin === 'builtin'
        ? t('usage.pricingOriginBuiltin')
        : t('usage.pricingOriginEmpty')

  return (
    <li className={css.card}>
      <button
        type="button"
        className={css.header}
        aria-expanded={open}
        aria-label={`${open ? t('usage.collapse') : t('usage.expand')}: ${t('usage.pricingTitle')}`}
        onClick={() => { setOpen(!open) }}
      >
        <span className={css.headText}>
          <span className={css.name}>{t('usage.pricingTitle')}</span>
          <span className={css.description}>{t('usage.pricingHint')}</span>
        </span>
        <span className={open ? css.chevronOpen : css.chevron}>▾</span>
      </button>
      {open
        ? (
          <div className={css.body}>
            <div className={css.legendRow}>
              <span className={css.dot} style={{ background: '#3f76d8' }} />
              {t('usage.pricingSource')}: {originText}
            </div>
            <div className={css.legendRow}>
              <span className={css.dot} style={{ background: '#6e9be8' }} />
              {t('usage.pricingCoverage', {
                providers: meta?.providers ?? 0,
                models: meta?.models ?? 0,
              })}
            </div>
            <div className={css.legendRow}>
              <span className={css.dot} style={{ background: '#a8ccf2' }} />
              {t('usage.pricingUpdatedAt')}: {formatTime(meta?.updatedAt)}
            </div>
            <div className={css.legendRow}>
              <span className={css.dot} style={{ background: '#4a9eda' }} />
              {t('usage.pricingFx')}: {meta?.fx ?? '—'}
            </div>
            <div className={css.actionsRow}>
              <button
                type="button"
                className={css.refreshButton}
                disabled={refreshing}
                onClick={refresh}
              >
                {refreshing ? t('usage.pricingRefreshing') : t('usage.pricingRefresh')}
              </button>
              {message !== '' && <span className={css.refreshMessage}>{message}</span>}
            </div>
          </div>
        )
        : null}
    </li>
  )
}
