/**
 * 侧栏底部的「重启 DSH」入口。
 *
 * 一个按钮 + 一行状态，全部走插件自己的同源端点，不碰官方服务：
 *  - 点按钮：POST /api/quick-restart/request（写重启请求）
 *  - 每 15 秒：GET /api/quick-restart/state（有没有排队、巡检日志尾巴）
 *  - 排队后按钮变成"已排队"状态色，鼠标悬停给出解释
 *
 * 组件只持有自己的局部状态（不跨 remount 存活），插槽注销即卸载。
 * @module @captain1275/dsh-quick-restart/client/entry
 */
import { useCallback, useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** 入口 props：侧栏底部座位提供的显示状态 + 词典。 */
export type QuickRestartEntryProps =
  PropsRuntime<'sidebar.footer.action'>
  & PropsLocale<'quick-restart'>

interface QuickRestartState {
  pending: boolean
  requestedAt?: string
  note?: string
  keeperTail?: string[]
}

const STATE_URL = '/api/quick-restart/state'
const REQUEST_URL = '/api/quick-restart/request'
const POLL_MS = 15_000

/** 一个 12px 的循环箭头。 */
function RestartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M13.5 8a5.5 5.5 0 1 1-1.7-3.95M13.5 2.5v3.2h-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** 把 ISO 时间显示成本地时分。 */
function clock(iso: string | undefined): string {
  if (iso === undefined) return '-'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleTimeString()
}

/**
 * 渲染侧栏重启入口。
 * @param props - 座位组合出的 props（wide = 侧栏展开态、t = 词典）。
 * @returns 入口元素树。
 */
export function QuickRestartEntry({ wide, t }: QuickRestartEntryProps) {
  const [state, setState] = useState<QuickRestartState>({ pending: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [hint, setHint] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(STATE_URL, { headers: { accept: 'application/json' } })
      if (!response.ok) return
      const body = await response.json() as QuickRestartState & { ok?: boolean }
      setState({ pending: body.pending === true, requestedAt: body.requestedAt, note: body.note, keeperTail: body.keeperTail })
      setError(undefined)
    } catch { /* 宿主重启中会短暂失败，下一次轮询补上 */ }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, POLL_MS)
    return () => { window.clearInterval(timer) }
  }, [refresh])

  const request = useCallback(async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      const response = await fetch(REQUEST_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: 'sidebar quick-restart' }),
      })
      const body = await response.json() as QuickRestartState & { ok?: boolean; error?: string }
      if (!response.ok || body.ok === false) throw new Error(body.error ?? `HTTP ${response.status}`)
      setState({ pending: body.pending === true, requestedAt: body.requestedAt, note: body.note, keeperTail: body.keeperTail })
      setError(undefined)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }, [busy])

  const label = state.pending ? t('entry.pending') : t('entry.label')
  const title = state.pending
    ? `${t('entry.pendingHint')}${state.requestedAt === undefined ? '' : ` (${clock(state.requestedAt)})`}`
    : t('entry.tooltip')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
      <button
        type="button"
        onClick={() => { void request() }}
        onMouseEnter={() => { setHint(true) }}
        onMouseLeave={() => { setHint(false) }}
        title={title}
        disabled={busy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: wide ? '6px 10px' : '6px 0',
          justifyContent: wide ? 'flex-start' : 'center',
          background: 'transparent',
          border: 'none',
          borderRadius: 8,
          color: state.pending ? 'var(--dsh-color-warning, #d09a2a)' : 'inherit',
          cursor: busy ? 'progress' : 'pointer',
          font: 'inherit',
        }}
      >
        <RestartIcon />
        {wide && <span>{label}</span>}
      </button>
      {wide && hint && (
        <div style={{ fontSize: 11, opacity: 0.7, padding: '0 10px 4px' }}>
          {error === undefined
            ? (state.pending
              ? t('entry.state.pending', { time: clock(state.requestedAt) })
              : t('entry.state.idle'))
            : `${t('entry.failed')}: ${error}`}
        </div>
      )}
    </div>
  )
}
