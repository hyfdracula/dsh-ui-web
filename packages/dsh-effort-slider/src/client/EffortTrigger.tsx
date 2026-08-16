/**
 * EffortTrigger —— 独立档位入口。挂在 `conversation.input.right` 列表座位
 * （模型选择器右边、发送按钮前），不再触碰官方菜单 DOM。
 *
 * 触发器显示当前推理档位名，点击弹出浮动卡片形态的 EffortPanel（复用
 * 原有滑块 UI）。当前模型不提供多档推理时整个触发器自动退场。目录在
 * 弹层开合时重新拉取，拖完滑块后本地即时反映。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { EffortPanel, useDirectory } from './EffortPanel.tsx'
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
  const [reloadTick, setReloadTick] = useState(0)
  const directory = useDirectory(connection, sessionId, reloadTick)

  // 点击外部关闭弹层。
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => { document.removeEventListener('mousedown', onDown) }
  }, [open])

  // 目录不监听模型切换事件：定时兜底刷新，让换模型后按钮在几秒内同步，
  // 弹层打开期间暂停轮询（弹层自己加载目录）。
  useEffect(() => {
    if (open || sessionId === undefined) return
    const id = window.setInterval(() => { setReloadTick((n) => n + 1) }, 1000)
    return () => { window.clearInterval(id) }
  }, [open, sessionId])

  const current = directory?.current ?? null
  const group = current === null ? undefined : directory?.groups.find((entry) => entry.id === current.provider)
  const model = group?.models.find((entry) => entry.id === current?.model)
  const efforts = model?.reasoning?.efforts ?? []
  const usable = directory !== null && current !== null && efforts.length >= 2
  const highest = efforts[efforts.length - 1]

  // 默认最高档（用户要求）：未显式选档时自动把最高档写入会话，每会话
  // 每模型只写一次；写入失败清空钥匙，下一轮目录轮询重试。不再读
  // provider 的 defaultEffort——显示与生效都锚定最高档。
  const autoWriteKeyRef = useRef('')
  useEffect(() => {
    if (!usable || current === null || highest === undefined || sessionId === undefined) return
    if (current.reasoningEffort !== undefined && current.reasoningEffort !== '') return
    const key = `${sessionId}|${current.provider}|${current.model}`
    if (autoWriteKeyRef.current === key) return
    autoWriteKeyRef.current = key
    void connection.api.sessions
      .selectModel({
        sessionId: sessionId as SessionIdBrand,
        provider: current.provider,
        model: current.model,
        reasoningEffort: highest.id,
      })
      .catch(() => { autoWriteKeyRef.current = '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory, usable, sessionId, connection])

  if (sessionId === undefined) return null
  if (!usable) return null

  // 显式选档 > 最高档（与自动写入一致；不看 provider defaultEffort）。
  const currentEffortId = current?.reasoningEffort || highest?.id
  const level = efforts.find((entry) => entry.id === currentEffortId)
  const label = level?.name ?? '默认'

  return (
    <div ref={rootRef} className={css.root}>
      <button
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
        <div className={css.popup}>
          <EffortPanel sessionId={sessionId} connection={connection} onClose={() => { setOpen(false); setReloadTick((n) => n + 1) }} />
        </div>
      )}
    </div>
  )
}
