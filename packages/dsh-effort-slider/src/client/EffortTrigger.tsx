/**
 * EffortTrigger —— 独立档位入口。挂在 `conversation.input.right` 列表座位
 * （视觉上紧贴模型选择器、在其左侧），不再触碰官方菜单 DOM。
 *
 * 触发器显示当前推理档位名，点击弹出浮动卡片形态的 EffortPanel（复用
 * 原有滑块 UI）。当前模型不提供多档推理时整个触发器自动退场。
 *
 * 审查修复后的行为：
 * - 目录 SWR 轮询：刷新不闪空（条目 1）；可用时 1s 轮询、目录失败按
 *   1s->5s->30s 退避、不支持多档时降为 30s 低频兜底（换模型后能恢复显示），
 *   不再每秒空转（条目 4/7）；
 * - 自动写：弹层打开期间绝不写（条目 3）；同一 key 失败按时间戳退避重试、
 *   至多 5 次后放弃到下次模型切换（条目 2/4）；key 含 highest.id，目录换档
 *   后允许重写新最高档（条目 15）；'' 视为显式值不触发自动写（条目 16）；
 * - 最高档用 pickHighest 推断而不是盲信最后一项（条目 8）；
 * - 弹层为 role=dialog，打开聚焦滑块、关闭还焦点给触发器、Esc 关闭
 *   （条目 10）；面板复用本组件已拉的目录，不再重复请求（条目 11）；
 * - 会话 effort 在目录中找不到时，显示 effort id 原文而不是"默认"（条目 6）。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { EffortPanel, useDirectory } from './EffortPanel.tsx'
import {
  isEffortUnset,
  nextAutoWriteDelay,
  pickHighest,
  POLL_BASE_MS,
  RETRY_MAX_MS,
  retryDelayMs,
} from './logic.ts'
import css from './effort-trigger.module.css'

/** 注入面：由注册时的 inject(sessionId) 提供。 */
export interface EffortTriggerInjected {
  connection: ConnectionHandle
  sessionId?: string
}

/** 触发器 props：注入面成员由框架展开传入。 */
export type EffortTriggerProps = EffortTriggerInjected

/** 与 EffortPanel 同款品牌收窄：宿主注入的 sessionId 即合法 SessionId。 */
type SessionIdBrand = Parameters<ConnectionHandle['api']['sessions']['models']>[0]['sessionId']

/**
 * 渲染档位触发器 + 弹层。
 * @param props - connection 与会话 id（框架注入）。
 * @returns 触发器元素；不支持多档或无会话时为 null。
 */
export function EffortTrigger({ connection, sessionId }: EffortTriggerProps): ReactNode {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const sliderRef = useRef<HTMLInputElement | null>(null)
  const wasOpenRef = useRef(false)
  const [reloadTick, setReloadTick] = useState(0)

  const directoryState = useDirectory(connection, sessionId, { reloadTick })
  const directory = directoryState.value
  const current = directory?.current ?? null
  const group = current === null ? undefined : directory?.groups.find((entry) => entry.id === current.provider)
  const model = group?.models.find((entry) => entry.id === current?.model)
  const efforts = model?.reasoning?.efforts ?? []
  const usable = directory !== null && current !== null && efforts.length >= 2
  const highest = pickHighest(efforts)

  // 目录轮询：目录还没就绪时按失败次数退避；就绪且可用时 1s；就绪但不支持
  // 多档时降为 30s 低频兜底（停掉每秒空转，换模型后仍能恢复显示，条目 4/7）。
  const failuresRef = useRef(0)
  useEffect(() => {
    if (directoryState.status === 'ready') failuresRef.current = 0
    else if (directoryState.status === 'error' && directoryState.value === null) failuresRef.current += 1
  }, [directoryState.status, directoryState.value])

  const pollDelay = directory === null
    ? retryDelayMs(failuresRef.current)
    : usable ? POLL_BASE_MS : RETRY_MAX_MS

  useEffect(() => {
    if (open || sessionId === undefined) return
    const id = window.setInterval(() => { setReloadTick((n) => n + 1) }, pollDelay)
    return () => { window.clearInterval(id) }
  }, [open, sessionId, pollDelay])

  // 点击外部关闭弹层。
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('mousedown', onDown) }
  }, [open])

  // Esc 关闭（条目 10）。
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey) }
  }, [open])

  // 焦点管理：打开时焦点移到滑块，关闭时还焦点给触发器（条目 10）。
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      const id = window.setTimeout(() => { sliderRef.current?.focus() }, 0)
      return () => { window.clearTimeout(id) }
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false
      triggerRef.current?.focus()
    }
  }, [open])

  // 自动写最高档：弹层打开期间绝不写（条目 3）；失败按时间戳退避、同一 key
  // 至多 5 次后放弃到下次模型切换（key 变化重置，条目 2/4）；key 含
  // highest.id，目录换档后允许重写新最高档（条目 15）；'' 视为显式值（条目 16）。
  const autoWriteStateRef = useRef<{ key: string; attempts: number; lastFailureAt: number } | null>(null)
  const pendingWriteKeyRef = useRef<string | null>(null)
  const writtenKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (open) return
    if (!usable || current === null || highest === undefined || sessionId === undefined) return
    if (!isEffortUnset(current.reasoningEffort)) return
    const key = `${sessionId}|${current.provider}|${current.model}|${highest.id}`
    if (autoWriteStateRef.current !== null && autoWriteStateRef.current.key !== key) autoWriteStateRef.current = null
    const record = autoWriteStateRef.current
    const wait = record === null ? 0 : nextAutoWriteDelay(record, Date.now())
    if (wait === null) return // 同一 key 已失败 5 次：放弃到下次模型切换
    if (record !== null && wait > 0) return // 退避未到：等下一轮目录刷新再评估
    if (writtenKeyRef.current === key) return // 已成功写过的 key 不重复写
    if (pendingWriteKeyRef.current === key) return // 在途请求防重
    pendingWriteKeyRef.current = key
    void connection.api.sessions
      .selectModel({
        sessionId: sessionId as SessionIdBrand,
        provider: current.provider,
        model: current.model,
        reasoningEffort: highest.id,
      })
      .then((response) => {
        if (pendingWriteKeyRef.current === key) pendingWriteKeyRef.current = null
        if (response.result.ok) {
          writtenKeyRef.current = key
          autoWriteStateRef.current = null
        } else {
          autoWriteStateRef.current = { key, attempts: (record?.attempts ?? 0) + 1, lastFailureAt: Date.now() }
        }
      })
      .catch(() => {
        if (pendingWriteKeyRef.current === key) pendingWriteKeyRef.current = null
        autoWriteStateRef.current = { key, attempts: (record?.attempts ?? 0) + 1, lastFailureAt: Date.now() }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory, usable, sessionId, connection, open])

  if (sessionId === undefined) return null
  if (!usable) return null

  // 显式选档 > 适配器默认；会话 effort 在目录中找不到时显示 id 原文而不是
  // "默认"（条目 6）；'' 为显式 OFF，同样不伪装成默认。
  const explicit = !isEffortUnset(current?.reasoningEffort)
  const effortId: string | undefined = explicit ? current.reasoningEffort as string : highest?.id
  const knownLevel = effortId === undefined ? undefined : efforts.find((entry) => entry.id === effortId)
  let label: string
  if (!explicit) {
    label = highest?.name ?? '—'
  } else if (knownLevel !== undefined) {
    label = knownLevel.name
  } else {
    label = current?.reasoningEffort === '' ? '—' : (current?.reasoningEffort as string)
  }

  return (
    <div ref={rootRef} className={css.root}>
      <button
        ref={triggerRef}
        type="button"
        className={css.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="推理等级"
        onClick={() => { setOpen((v) => !v); if (!open) setReloadTick((n) => n + 1) }}
      >
        <span className={css.label}>{label}</span>
        <svg className={css.chevron} width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 6.5 5 3.5 8 6.5" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className={css.popup} role="dialog" aria-modal={false} aria-label="推理等级">
          <EffortPanel
            sessionId={sessionId}
            connection={connection}
            directory={directoryState}
            inputRef={sliderRef}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  )
}