/**
 * Effort slider panel — Aqua glass edition.
 *
 * 交互与 aurora EffortPanel 一致（连续 0..100 拖动、松手吸附最近档位、
 * 写入走 sessions.selectModel 只改 reasoningEffort）；视觉为 Aqua 玻璃。
 *
 * 审查修复后的数据流：
 * - 目录默认由本组件自取（useDirectory）；宿主若已持有目录（EffortTrigger
 *   传入 directory prop），则完全复用、不再发起重复请求（条目 11）；
 * - 目录采用 stale-while-revalidate：轮询刷新期间保留旧值不闪空，
 *   仅 sessionId 变化或首次加载才清空（条目 1）；失败进入 error 态并在
 *   overlay 提供重试按钮，挂起超过 10s 视为失败（条目 5）；
 * - 写入必须检查 response.result.ok（业务失败 resolve 而非 reject）：失败时
 *   滑块回弹到最近一次成功档位并给出可见提示（条目 2）；commit 幂等去重、
 *   键盘/指针取消兜底补写（条目 9）；
 * - current.reasoningEffort 在目录中找不到时，保持当前 rawValue 并显示
 *   "未知档位"，绝不落回 MAX（条目 6）；
 * - current 缺失时直接判定不可用，不再回退到无关模型（条目 13）。
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import css from './effort.module.css'
import {
  DIRECTORY_TIMEOUT_MS,
  effortIndexForId,
  effortIndexForRaw,
  isEffortUnset,
  levelLabel,
  slotLeftPx,
  step100ForCount,
} from './logic.ts'

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
  /** 复用调起方已拉取的目录状态；传入后本组件不再自行拉取（条目 11）。 */
  directory?: DirectoryState | null
  /** 滑块的受控引用（弹层打开时聚焦，条目 10）。 */
  inputRef?: RefObject<HTMLInputElement>
}

/** One reasoning level as returned by the directory API. */
export interface EffortLevel {
  id: string
  name: string
  description?: string
}

/** The advisory directory value (`sessions.models` response). */
export interface DirectoryValue {
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

/** 目录加载状态：value 始终尽量保留最近一次成功数据（stale-while-revalidate）。 */
export interface DirectoryState {
  value: DirectoryValue | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** status==='error' 时最近一次失败时间戳。 */
  errorAt?: number
  /** 重新拉取目录（失败 overlay 的重试按钮 / 外部轮询兜底）。 */
  retry: () => void
}

/** hook 内部存储形态（retry 在返回时合成，不进 state）。 */
interface DirectoryStoreState {
  value: DirectoryValue | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  errorAt?: number
}

export interface UseDirectoryOptions {
  /** 外部触发的刷新序号（轮询方递增）。 */
  reloadTick?: number
  /** false 时停止拉取（目录由外部持有则不再重复请求，条目 11）。 */
  enabled?: boolean
}

/**
 * 目录加载 hook：stale-while-revalidate + 失败态 + 挂起超时。
 * 刷新期间不把 value 置空：只有 sessionId 变化或首次加载才清空，数据回来
 * 才替换（条目 1）；失败（传输错误或 result.ok=false）进入 error 态（条目 5），
 * 挂起超过 DIRECTORY_TIMEOUT_MS（10s）视为失败。
 */
export function useDirectory(
  connection: ConnectionHandle,
  sessionId: string | undefined,
  options?: UseDirectoryOptions,
): DirectoryState {
  const { reloadTick = 0, enabled = true } = options ?? {}
  const [state, setState] = useState<DirectoryStoreState>({ status: 'idle', value: null })
  const [internalTick, setInternalTick] = useState(0)
  const lastSessionRef = useRef<string | undefined>(undefined)

  const retry = useCallback(() => { setInternalTick((n) => n + 1) }, [])

  useEffect(() => {
    if (!enabled) return
    if (sessionId === undefined) {
      lastSessionRef.current = undefined
      setState({ status: 'idle', value: null })
      return
    }
    const sessionChanged = lastSessionRef.current !== sessionId
    lastSessionRef.current = sessionId
    // SWR：仅首次加载 / sessionId 变化才清空；轮询刷新保留旧值。
    if (sessionChanged) setState({ status: 'loading', value: null })
    let alive = true
    const hangTimer = window.setTimeout(() => {
      if (!alive) return
      setState((prev) => (prev.status === 'ready' ? prev : { status: 'error', value: prev.value, errorAt: Date.now() }))
    }, DIRECTORY_TIMEOUT_MS)
    void connection.api.sessions
      .models({ sessionId: sessionId as SessionIdBrand })
      .then((response) => {
        if (!alive) return
        window.clearTimeout(hangTimer)
        if (response.result.ok) {
          setState({ status: 'ready', value: response.result.value })
        } else {
          // 业务失败（result.ok=false）：保留旧值（可能有 stale 数据），标 error。
          setState((prev) => ({ status: 'error', value: prev.value, errorAt: Date.now() }))
        }
      })
      .catch(() => {
        if (!alive) return
        window.clearTimeout(hangTimer)
        setState((prev) => ({ status: 'error', value: prev.value, errorAt: Date.now() }))
      })
    return () => {
      alive = false
      window.clearTimeout(hangTimer)
    }
  }, [connection, sessionId, reloadTick, internalTick, enabled])

  return { value: state.value, status: state.status, errorAt: state.errorAt, retry }
}

/**
 * The effort slider panel (inline 或浮动卡片两种形态)。
 * @param props - session + wire face + mode + verbs.
 * @returns the panel element.
 */
export function EffortPanel(props: EffortPanelProps): ReactNode {
  const { sessionId, connection, onClose, inline = false, onResolved, inputRef } = props
  const externalDirectory = props.directory ?? null
  const ownDirectory = useDirectory(connection, sessionId, { enabled: externalDirectory === null })
  const directory = externalDirectory ?? ownDirectory
  const [dragging, setDragging] = useState(false)
  // Continuous 0..100 slider position; snaps to an effort level on release.
  const [rawValue, setRawValue] = useState(0)
  // 写入失败可见提示（状态文字短暂变红），条目 2。
  const [writeFailed, setWriteFailed] = useState(false)

  const hasValue = directory.value !== null
  const loading = directory.status === 'loading'
  const failed = directory.status === 'error' && directory.value === null

  const current = directory.value?.current ?? null
  const group = current === null ? undefined : directory.value?.groups.find((entry) => entry.id === current.provider)
  const model = group?.models.find((entry) => entry.id === current?.model)
  const efforts = model?.reasoning?.efforts ?? []
  const usable = hasValue && current !== null && efforts.length >= 2
  const step100 = step100ForCount(efforts.length)
  const rawIndex = current === null || isEffortUnset(current.reasoningEffort)
    ? -1
    : effortIndexForId(efforts, current.reasoningEffort)
  // 已确认的档位下标：未知 effort 时维持当前 rawValue，绝不落 MAX（条目 6）。
  const settledIdxRef = useRef(0)

  useEffect(() => {
    if (!usable) return
    let idx: number
    if (rawIndex >= 0) {
      idx = rawIndex
    } else if (current === null || isEffortUnset(current.reasoningEffort)) {
      // 未设置：落在最高档（与触发器的自动写一致）。
      idx = efforts.length - 1
    } else {
      // 已设置但目录中找不到：维持当前 rawValue，绝不落 MAX（条目 6）。
      idx = settledIdxRef.current
    }
    settledIdxRef.current = idx
    setRawValue(step100 * idx)
    setDragging(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory.value])

  const displayIndex = usable ? effortIndexForRaw(rawValue, step100, efforts.length) : 0
  const level = efforts[displayIndex]
  const unknownEffort = usable && rawIndex === -1 && !isEffortUnset(current?.reasoningEffort)
  const slider100 = usable ? rawValue : 0

  const labelFraction = (index: number): number => (efforts.length > 1 ? index / (efforts.length - 1) : 0)

  // CSS 填充轨道：前缘与 thumb 中心对齐（同 slotLeftPx 公式，条目 17）。
  const fillStyle: CSSProperties = { width: `${slotLeftPx(slider100 / 100)}px` }
  const pointLightStyle: CSSProperties = {
    left: `${slotLeftPx(slider100 / 100)}px`,
    top: inline ? '66px' : '76px',
  }

  const lastWrittenRef = useRef<string | null>(null)
  const errorTimerRef = useRef<number | null>(null)
  const trailingTimerRef = useRef<number | null>(null)
  const pendingRef = useRef<number | null>(null)
  const lastWriteAtRef = useRef(0)

  const markWriteError = (on: boolean): void => {
    setWriteFailed(on)
    if (on) {
      if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current)
      errorTimerRef.current = window.setTimeout(() => setWriteFailed(false), 2500)
    }
  }

  /** 写入失败：回弹到最近一次成功档位并给可见提示（条目 2）。 */
  const revertToSettled = (): void => {
    setRawValue(settledIdxRef.current * step100)
    markWriteError(true)
  }

  /** 写当前档位到会话；检查 result.ok，失败回弹；与当前值一致则跳过（幂等）。 */
  const writeEffort = (v: number): void => {
    if (!usable || current === null) return
    const idx = effortIndexForRaw(v, step100, efforts.length)
    const effort = efforts[idx]
    if (effort === undefined) return
    if (effort.id === lastWrittenRef.current) return
    // 值与会话当前档位一致：无需重发（同时避免 onPointerUp + onBlur 双写，条目 9）。
    if (effort.id === current.reasoningEffort) {
      settledIdxRef.current = idx
      return
    }
    void connection.api.sessions
      .selectModel({
        sessionId: sessionId as SessionIdBrand,
        provider: current.provider,
        model: current.model,
        reasoningEffort: effort.id,
      })
      .then((response) => {
        if (response.result.ok) {
          lastWrittenRef.current = effort.id
          settledIdxRef.current = idx
          markWriteError(false)
        } else {
          revertToSettled()
        }
      })
      .catch(() => { revertToSettled() })
  }

  /** 节流补写：把节流窗口内最后记录的帧值写出去（条目 9 末帧保证）。 */
  const flushPending = (): void => {
    trailingTimerRef.current = null
    const v = pendingRef.current
    if (v === null) return
    pendingRef.current = null
    lastWriteAtRef.current = performance.now()
    writeEffort(v)
  }

  const onInput = (event: FormEvent<HTMLInputElement>): void => {
    if (!usable) return
    const v = Number((event.target as HTMLInputElement).value)
    setRawValue(v)
    pendingRef.current = v
    const now = performance.now()
    if (now - lastWriteAtRef.current >= 16) {
      // 节流窗口外：首帧直接写，并清掉 pending。
      lastWriteAtRef.current = now
      pendingRef.current = null
      writeEffort(v)
    } else if (trailingTimerRef.current === null) {
      // 节流窗口内：记录 pending，请求结束后补写最后一帧。
      trailingTimerRef.current = window.setTimeout(flushPending, 24)
    }
  }

  /** 松手/失焦/键盘结束/指针取消时吸附到最近档位并补发一次确认（条目 9）。 */
  const commit = (event: SyntheticEvent<HTMLInputElement>): void => {
    if (!usable) return
    if (trailingTimerRef.current !== null) {
      window.clearTimeout(trailingTimerRef.current)
      trailingTimerRef.current = null
    }
    pendingRef.current = null
    const v = Number((event.target as HTMLInputElement).value)
    const idx = effortIndexForRaw(v, step100, efforts.length)
    setRawValue(idx * step100)
    setDragging(false)
    writeEffort(v)
  }

  useEffect(() => {
    return () => {
      if (trailingTimerRef.current !== null) window.clearTimeout(trailingTimerRef.current)
      if (errorTimerRef.current !== null) window.clearTimeout(errorTimerRef.current)
    }
  }, [])

  // 目录解析后上报可用性（inline 宿主据此隐藏/还原官方行）。
  const resolvedRef = useRef(false)
  useEffect(() => {
    if (!hasValue || resolvedRef.current) return
    resolvedRef.current = true
    onResolved?.(usable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directory.value])

  // 内联模式：加载中/不可用时不出声，交给官方行兜底。
  if (inline && !usable) return null

  const head = (
    <div className={css.head}>
      <div className={css.headLeft}>
        <span className={css.labelText}>Effort</span>
        {writeFailed ? (
          <span className={`${css.status} ${css.statusError}`}>写入失败</span>
        ) : unknownEffort ? (
          <span className={`${css.status} ${css.statusUnknown}`}>未知档位</span>
        ) : usable && level !== undefined ? (
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
            style={{ left: `${slotLeftPx(labelFraction(labelIndex))}px` }}
          >
            {levelLabel(entry)}
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
              style={{ left: `${slotLeftPx(labelFraction(dotIndex))}px` }}
            />
          ))}
        </div>
        <div className={`${css.pointLight}${dragging ? ` ${css.pointLightOn}` : ''}`} style={pointLightStyle} />
        <input
          ref={inputRef}
          type="range"
          min={0}
          max={100}
          step={1}
          value={usable ? rawValue : 0}
          disabled={!usable}
          aria-label="推理等级滑块"
          className={`${css.range}${dragging ? ` ${css.rangeGlow}` : ''}`}
          onInput={onInput}
          onPointerDown={() => setDragging(true)}
          onPointerUp={commit}
          onPointerCancel={commit}
          onKeyUp={commit}
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
            {failed ? (
              <div className={css.failedBox}>
                <span>目录加载失败</span>
                <button type="button" className={css.retry} onClick={() => directory.retry()}>
                  重试
                </button>
              </div>
            ) : loading || directory.value === null ? (
              '模型目录加载中…'
            ) : current === null ? (
              '模型不可用'
            ) : (
              '当前模型不提供多档推理等级'
            )}
          </div>
        )}
      </div>
    </div>
  )
}