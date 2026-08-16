/**
 * Effort slider panel — Aqua glass edition.
 *
 * 交互与 aurora EffortPanel 一致（连续 0..100 拖动、松手吸附最近档位、
 * 拖动中每帧最多一次写入、写入走 sessions.selectModel 只改
 * reasoningEffort）；视觉为 Aqua 玻璃：CSS 渐变填充轨道、发光玻璃
 * thumb，无 WebGL 依赖。
 *
 * 两种形态：
 * - inline：嵌在官方模型菜单里（原位替换「推理等级」行），无边框卡片、
 *   无关闭钮；目录未加载或模型不支持多档时渲染 null 并由 onResolved
 *   通知宿主还原官方行。
 * - 浮动卡片（默认）：玻璃卡片 + 关闭钮，供其它宿主复用。
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import css from './effort.module.css'

/** Panel props: owning session, wire face, layout mode, resolve/close verbs. */
export interface EffortPanelProps {
  sessionId: string
  connection: ConnectionHandle
  /** 内联模式：菜单内嵌，无边框、无关闭钮。 */
  inline?: boolean
  /** 目录解析结果回调（inline 宿主用它决定隐藏/还原官方行）。 */
  onResolved?: (usable: boolean) => void
  /** 关闭回调（仅浮动模式渲染关闭钮）。 */
  onClose?: () => void
}

/** One reasoning level as returned by the directory API. */
interface EffortLevel {
  id: string
  name: string
  description?: string
}

/** The advisory directory value (`sessions.models` response). */
interface DirectoryValue {
  current: { provider: string; model: string; reasoningEffort?: string } | null
  groups: Array<{
    id: string
    models: Array<{
      id: string
      reasoning?: { efforts?: EffortLevel[]; defaultEffort?: string }
    }>
  }>
}

/** 座位注入的 sessionId 字符串在宿主侧即合法 SessionId；此处收窄到品牌类型。 */
type SessionIdBrand = Parameters<ConnectionHandle['api']['sessions']['models']>[0]['sessionId']

/** Panel width (must match the CSS `.panel` width). */
const PANEL_W = 280

/** Load the per-session model directory once per panel open. */
export function useDirectory(connection: ConnectionHandle, sessionId: string | undefined, reloadTick = 0): DirectoryValue | null {
  const [directory, setDirectory] = useState<DirectoryValue | null>(null)

  useEffect(() => {
    if (sessionId === undefined) {
      setDirectory(null)
      return
    }
    let alive = true
    setDirectory(null)
    void connection.api.sessions
      .models({ sessionId: sessionId as SessionIdBrand })
      .then((response) => {
        if (alive && response.result.ok) setDirectory(response.result.value)
      })
      .catch(() => {
        /* 目录加载失败由 emptyOverlay / onResolved 呈现 */
      })
    return () => {
      alive = false
    }
  }, [connection, sessionId, reloadTick])

  return directory
}

/**
 * The effort slider panel (inline 或浮动卡片两种形态)。
 * @param props - session + wire face + mode + verbs.
 * @returns the panel element.
 */
export function EffortPanel(props: EffortPanelProps): ReactNode {
  const { sessionId, connection, onClose, inline = false, onResolved } = props
  const directory = useDirectory(connection, sessionId)
  const [dragging, setDragging] = useState(false)
  // Continuous 0..100 slider position; snaps to an effort level on release.
  const [rawValue, setRawValue] = useState(0)

  const disabled = directory === null
  const rawCurrent = directory?.current ?? null
  // 无 current 时回退到第一个分组的第一模型（目录数据总是可用的）。
  const fallback: DirectoryValue['current'] = directory !== null && directory.groups.length > 0 && directory.groups[0].models.length > 0
    ? { provider: directory.groups[0].id, model: directory.groups[0].models[0].id }
    : null
  const current = rawCurrent ?? fallback
  const group = current === null ? undefined : directory?.groups.find((entry) => entry.id === current.provider)
  const model = group?.models.find((entry) => entry.id === current?.model)
  const efforts = model?.reasoning?.efforts ?? []
  const usable = !disabled && current !== null && efforts.length >= 2

  // 默认最高档（与 EffortTrigger 一致）：未显式选档时滑块落在最高档，
  // 不再读 provider 的 defaultEffort。
  const currentEffortId = current?.reasoningEffort || efforts[efforts.length - 1]?.id
  const rawIndex = currentEffortId === undefined ? -1 : efforts.findIndex((level) => level.id === currentEffortId)
  const step100 = efforts.length > 1 ? 100 / (efforts.length - 1) : 100
  const initialRaw = usable ? (rawIndex >= 0 ? rawIndex : efforts.length - 1) * step100 : 0

  useEffect(() => {
    setRawValue(initialRaw)
    setDragging(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory])

  // 目录解析后上报可用性（inline 宿主据此隐藏/还原官方行）。
  const resolvedRef = useRef(false)
  useEffect(() => {
    if (disabled || resolvedRef.current) return
    resolvedRef.current = true
    onResolved?.(usable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory])

  const displayIndex = usable ? Math.round(rawValue / step100) : 0
  const level = efforts[displayIndex]
  const slider100 = usable ? rawValue : 0

  // CSS 填充轨道：前缘跟随滑块，松手吸附后收敛到档位位置。
  const fillStyle: CSSProperties = { width: `${slider100}%` }
  const pointLightStyle: CSSProperties = {
    left: `${22 + (slider100 / 100) * (PANEL_W - 44)}px`,
    top: inline ? '66px' : '76px',
  }

  /** 写入当前档位到会话（供拖动中节流调用）。 */
  const writeEffort = (v: number): void => {
    if (!usable || current === null) return
    const idx = Math.round(v / step100)
    const effort = efforts[idx]
    if (effort === undefined) return
    void connection.api.sessions
      .selectModel({
        sessionId: sessionId as SessionIdBrand,
        provider: current.provider,
        model: current.model,
        reasoningEffort: effort.id,
      })
      .catch(() => {
        /* the official picker keeps its own error surface */
      })
  }
  const lastWriteRef = useRef(0)

  const onInput = (event: React.FormEvent<HTMLInputElement>): void => {
    if (!usable) return
    const v = Number((event.target as HTMLInputElement).value)
    setRawValue(v)
    // 每帧最多一次写入，避免拖动中请求堆积造成尾部延迟。
    const now = performance.now()
    if (now - lastWriteRef.current >= 16) {
      lastWriteRef.current = now
      writeEffort(v)
    }
  }

  /** 松手/失焦/键盘结束时吸附到最近档位并补发一次确认。 */
  const commit = (event: React.SyntheticEvent<HTMLInputElement>): void => {
    if (!usable) return
    const v = Number((event.target as HTMLInputElement).value)
    const idx = Math.round(v / step100)
    setRawValue(idx * step100)
    setDragging(false)
    writeEffort(v)
  }

  // 内联模式：加载中/不可用时不出声，交给官方行兜底。
  if (inline && !usable) return null

  const head = (
    <div className={css.head}>
      <div className={css.headLeft}>
        <span className={css.labelText}>Effort</span>
        {usable && level !== undefined ? (
          <span
            key={level.name}
            className={`${css.status} ${css[`level${displayIndex}`] ?? ''} ${displayIndex === efforts.length - 1 ? css.statusGlow : ''}`}
          >
            {level.name}
          </span>
        ) : (
          <span className={css.status}>—</span>
        )}
      </div>
      {!inline && onClose !== undefined && (
        <button type="button" className={css.close} onClick={onClose} aria-label="关闭">
          ×
        </button>
      )}
    </div>
  )

  const track = (
    <>
      <div className={css.levelLabels}>
        {efforts.map((entry, labelIndex) => (
          <span
            key={entry.id}
            className={`${css.levelLabel}${labelIndex === displayIndex ? ` ${css.levelLabelActive}` : ''}`}
            style={{ left: `${10 + (labelIndex / Math.max(efforts.length - 1, 1)) * 80}%` }}
          >
            {labelIndex === 0 ? 'OFF' : labelIndex === efforts.length - 1 ? 'MAX' : entry.name}
          </span>
        ))}
      </div>
      <div className={css.trackWrapper}>
        <div className={css.trackBg} />
        <div className={css.fill} style={fillStyle} />
        <div className={css.dotsLayer}>
          {efforts.map((entry, dotIndex) => (
            <span
              key={entry.id}
              className={`${css.dot}${dotIndex === displayIndex ? ` ${css.dotActive}` : ''}`}
              style={{ left: `${10 + (dotIndex / Math.max(efforts.length - 1, 1)) * 80}%` }}
            />
          ))}
        </div>
        <div className={`${css.pointLight}${dragging ? ` ${css.pointLightOn}` : ''}`} style={pointLightStyle} />
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={usable ? rawValue : 0}
          disabled={!usable}
          className={`${css.range}${dragging ? ` ${css.rangeGlow}` : ''}`}
          onInput={onInput}
          onPointerDown={() => setDragging(true)}
          onPointerUp={commit}
          onPointerLeave={() => setDragging(false)}
          onBlur={commit}
        />
      </div>
    </>
  )

  if (inline) {
    return (
      <div className={css.inlinePanel} data-effort-panel="inline">
        {head}
        {track}
      </div>
    )
  }

  return (
    <div className={css.panel} data-effort-panel="true">
      <div className={css.glow} />
      <div className={css.inner}>
        {head}
        {track}
        {!usable && (
          <div className={css.emptyOverlay}>
            {disabled ? '模型目录加载中…' : '当前模型不提供多档推理等级'}
          </div>
        )}
      </div>
    </div>
  )
}
