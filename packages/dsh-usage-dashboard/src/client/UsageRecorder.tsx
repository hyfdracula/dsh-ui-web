/**
 * Usage recorder — an invisible conversation-dock seat that watches the
 * `tokenUsage` projection and uploads per-response snapshots to the host.
 *
 * Semantics:
 *  - The projection is a session-cumulative total that may already be large
 *    when this component mounts (page refresh, session switch, HMR reload).
 *    The FIRST sight establishes a baseline: it is uploaded WITH `reset:
 *    true` so the host adopts the same baseline. Later growth deltas are
 *    then computed from that aligned baseline and can never overcount a gap
 *    the host never saw (C1/H3 family: lost pending flushes, restored old
 *    backups, clock skew).
 *  - While the total GROWS (a response is streaming) the recorder arms a
 *    settle timer; when growth stops for SETTLE_MS it flushes one final
 *    snapshot — one completed response = one upload, so the host's calls
 *    counter tracks real response rounds. A CHECKPOINT_MS interval re-uploads
 *    the latest snapshot during long streams: host replace semantics make
 *    repeats idempotent, so the loss window is capped at ~10s instead of the
 *    whole stream.
 *  - Unmount and session switch flush any pending snapshot instead of
 *    dropping it (keepalive on unmount, since the page may be closing).
 *  - A projection rollback (compression/recompute) re-sends `reset: true`
 *    with the smaller snapshot, re-aligning client and host baselines.
 *  - The session title rides the live `title` projection (per-session,
 *    real-time); a title that lands AFTER the last growth flush triggers one
 *    metadata-only re-upload (zero growth, so it never inflates calls).
 *  - A session switch re-baselines the recorder: switching back to a larger
 *    session is never mistaken for growth.
 *  - Model labels are best-effort: the entry polls the active session's
 *    model (2s, paused while no dock is mounted) and flush fetches the model
 *    once when it is still unknown (C5). Wrong attribution only affects the
 *    display model bucket, never the totals.
 * @module @captain1275/dsh-usage-dashboard/client/UsageRecorder
 */
import { memo, useEffect, useRef } from 'react'
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { decideRecorderStep, type RecorderMemory, type RecorderSnapshot } from './recorder-core.ts'
import { getActiveSessionId, getCurrentModel, refreshCurrentModel, setActiveSessionId } from './model.ts'

// 兼容导出：入口的模型轮询从 model.ts 取；这里保持旧 API 可用。
export { getActiveSessionId, setCurrentModel } from './model.ts'

/** tokenUsage 投影值结构（与 full-stats 同源声明）。 */
interface TokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** sessionStats 投影值结构（只取真实响应数用；steps = 整个日志已关闭 step 数）。 */
interface SessionStatsLike {
  steps?: number
}

/** Props injected by the conversation dock (framework runtime share). */
export interface UsageRecorderProps {
  useSession: <S>(selector: (s: { sessionId?: string }) => S) => S
  useProjection: <K extends string>(key: K) => unknown
}

/** 一轮响应结束判定的静默时长（ms）。 */
const SETTLE_MS = 2000

/** 长流检查点上报间隔（ms）：把丢失窗口从"整个流"缩到 10s。 */
const CHECKPOINT_MS = 10_000

/** 单条上报载荷。 */
interface UsageUpload {
  sessionId: string
  sessionTitle: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** 会话累计真实响应数（sessionStats steps）；宿主据此按差值计 calls。 */
  steps?: number
  /** true = 基线对齐：宿主替换会话桶并补差（见宿主 applyRecord）。 */
  reset?: boolean
}

/** 全局上报串行化链：保证同会话的快照按发起顺序到达宿主，旧快照不会晚到覆盖新快照（C4）。 */
let uploadChain: Promise<void> = Promise.resolve()

/** 真正发往宿主的 POST（失败静默）。 */
async function doPost(snapshot: UsageUpload, keepalive: boolean): Promise<void> {
  try {
    await fetch('/api/usage/record', {
      method: 'POST',
      keepalive,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...snapshot, ts: Date.now() }),
    })
  } catch {
    /* 上报失败静默：不打断对话；宿主 replace 语义下下次增长会自动补齐 */
  }
}

/**
 * 上报当前快照到宿主（replace 语义：同会话覆盖，不累加）。
 * 默认走串行链保证顺序；卸载补发（keepalive）绕过链直接发 —— 页面可能
 * 正在关闭，排在队列后面可能永远轮不到。
 */
async function postSnapshot(snapshot: UsageUpload, keepalive = false): Promise<void> {
  if (keepalive) {
    await doPost(snapshot, true)
    return
  }
  const task = uploadChain.then(() => doPost(snapshot, false))
  uploadChain = task.catch(() => undefined)
  return task
}

/**
 * The invisible recorder seat.
 * @param props - framework runtime share.
 * @returns null (renders nothing).
 */
export const UsageRecorder = memo(function UsageRecorder(props: UsageRecorderProps): null {
  const session = props.useSession((s) => ({ sessionId: s.sessionId }))
  const usage = props.useProjection('tokenUsage') as TokenUsageProjection | undefined
  // 真实响应数走 sessionStats 投影（整个日志已关闭 step 数，含失败/取消）。
  const stats = props.useProjection('sessionStats') as SessionStatsLike | undefined
  // 标题走会话投影：实时、按会话隔离，不轮询、不猜列表第一项。
  const title = props.useProjection('title') as string | null | undefined
  const lastTotalRef = useRef<number>(-1)
  const lastSidRef = useRef<string | undefined>(undefined)
  const lastStepsRef = useRef<number>(-1)
  const lastSeenRef = useRef<RecorderSnapshot | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const titleCacheRef = useRef<Record<string, string>>({})
  const uploadedTitleRef = useRef<string>('')

  const memoryRefs = (): RecorderMemory => ({
    lastSid: lastSidRef.current,
    lastTotal: lastTotalRef.current,
    lastSteps: lastStepsRef.current,
    lastSeen: lastSeenRef.current,
  })

  const syncMemory = (memory: RecorderMemory): void => {
    lastSidRef.current = memory.lastSid
    lastTotalRef.current = memory.lastTotal
    lastStepsRef.current = memory.lastSteps
    lastSeenRef.current = memory.lastSeen
  }

  // 上传一条快照（replace 语义幂等）。reset=true 时宿主只替换会话桶。
  const upload = (snap: RecorderSnapshot, opts: { reset?: boolean; keepalive?: boolean }): Promise<void> => {
    const snapshotTitle = titleCacheRef.current[snap.sessionId] ?? ''
    uploadedTitleRef.current = snapshotTitle
    return postSnapshot({
      sessionId: snap.sessionId,
      sessionTitle: snapshotTitle,
      model: getCurrentModel(),
      inputTokens: snap.input,
      outputTokens: snap.output,
      cacheReadTokens: snap.cache,
      cacheWriteTokens: snap.cacheWrite,
      ...snap.steps !== undefined ? { steps: snap.steps } : {},
      reset: opts.reset === true,
    }, opts.keepalive === true)
  }

  // 模型未知时先取一次当前会话模型再上报（C5/H2：避免整条响应落进 unknown 桶）。
  const uploadWithModel = (snap: RecorderSnapshot, opts: { reset?: boolean; keepalive?: boolean }): Promise<void> => {
    const attempt = async (): Promise<void> => {
      if (getCurrentModel() === 'unknown') await refreshCurrentModel(snap.sessionId)
      await upload(snap, opts)
    }
    return attempt()
  }

  // settle flush：一轮响应结束后上报最新快照。
  const flush = (): void => {
    settleTimerRef.current = null
    const seen = lastSeenRef.current
    if (seen === null) return
    void uploadWithModel(seen, { reset: false })
  }

  // X1：活跃会话 id 同步给入口（模型轮询按它启停）。
  useEffect(() => {
    const sid = session.sessionId
    setActiveSessionId(sid)
    return () => {
      if (getActiveSessionId() === sid) setActiveSessionId(undefined)
    }
  }, [session.sessionId])

  // 投影观察：基线 / 增长 / 回退 / 切换决策（纯逻辑见 recorder-core.ts）。
  useEffect(() => {
    const sid = session.sessionId
    if (sid === undefined || usage === undefined) return
    const snapshot: RecorderSnapshot = {
      sessionId: sid,
      input: usage.uncachedInputTokens,
      output: usage.outputTokens,
      cache: usage.cacheReadTokens,
      cacheWrite: usage.cacheWriteTokens,
      ...stats?.steps !== undefined ? { steps: stats.steps } : {},
    }
    const decision = decideRecorderStep(memoryRefs(), sid, snapshot)
    // 1) 切会话：先补发旧会话的未决快照（C1），避免旧会话最后一段丢失。
    if (decision.staleFlush !== null) {
      void uploadWithModel(decision.staleFlush, { reset: false })
    }
    // 2) 同步内存。
    syncMemory(decision.next)
    if (decision.switched) {
      uploadedTitleRef.current = ''
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }
    }
    // 3) 按动作执行。
    if (decision.action === 'reset') {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }
      if (decision.next.lastSeen !== null) {
        // 基线（可能为 0 累计）随 reset:true 上报（H3）。
        void uploadWithModel(decision.next.lastSeen, { reset: true })
      }
    } else if (decision.action === 'arm-settle') {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = window.setTimeout(flush, SETTLE_MS)
    }
  }, [session.sessionId, usage, stats])

  // 标题投影：按会话缓存；标题晚到触发一次 metadata-only 重传。
  useEffect(() => {
    const sid = session.sessionId
    const next = typeof title === 'string' ? title : ''
    if (sid === undefined) return
    if (next !== '') titleCacheRef.current[sid] = next
    const seen = lastSeenRef.current
    if (next === '' || seen === null) return
    if (seen.sessionId !== sid) return
    if (next === uploadedTitleRef.current) return
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(flush, SETTLE_MS)
  }, [title, session.sessionId])

  // 长流检查点：每 10s 上报一次最新快照。宿主 replace 语义幂等，
  // 重复上报不会双计，把"整个流只发一条"的丢失窗口缩到 10s（C1）。
  // 直接上传不等模型查询：检查点要在流内尽快把快照送出去。
  useEffect(() => {
    const timer = window.setInterval(() => {
      const seen = lastSeenRef.current
      if (seen === null) return
      void upload(seen, { reset: false })
    }, CHECKPOINT_MS)
    return () => window.clearInterval(timer)
  }, [])

  // 卸载：清定时器；若有未决快照用 keepalive 补发（C1），页面关闭也能送达。
  // 直接上传（keepalive 必须在关闭前发出，不再等待模型查询）。
  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      const seen = lastSeenRef.current
      if (seen !== null) {
        void upload(seen, { reset: false, keepalive: true })
      }
    }
  }, [])

  return null
})