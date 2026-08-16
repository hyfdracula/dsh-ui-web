/**
 * Usage recorder — an invisible conversation-dock seat that watches the
 * `tokenUsage` projection and uploads per-response snapshots to the host.
 *
 * Semantics:
 *  - The projection is a session-cumulative total that may already be large
 *    when this component mounts (page refresh, session switch, HMR reload).
 *    The FIRST sight only establishes a baseline — never uploaded, so a
 *    mount never counts the whole history as new usage.
 *  - While the total GROWS (a response is streaming), uploads are debounced
 *    to one per second. When growth stops for SETTLE_MS, the recorder
 *    flushes one final snapshot — one completed response = one upload, so
 *    the host's calls counter tracks real response rounds.
 *  - The host stores the LATEST snapshot per session (replace semantics);
 *    repeated uploads overwrite instead of double counting.
 *  - The session title rides the live `title` projection (per-session,
 *    real-time); a title that lands AFTER the last growth flush triggers one
 *    metadata-only re-upload (zero growth, so it never inflates calls).
 *  - A session switch re-baselines the recorder: switching back to a larger
 *    session is never mistaken for growth.
 * @module @captain1275/dsh-usage-dashboard/client/UsageRecorder
 */
import { memo, useEffect, useRef } from 'react'
import type {} from '@deepseek-ai/dsh-token-meter/client'

/** tokenUsage 投影值结构（与 full-stats 同源声明）。 */
interface TokenUsageProjection {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** Props injected by the conversation dock (framework runtime share). */
export interface UsageRecorderProps {
  useSession: <S>(selector: (s: { sessionId?: string }) => S) => S
  useProjection: <K extends string>(key: K) => unknown
}

/** 一轮响应结束判定的静默时长（ms）。 */
const SETTLE_MS = 2000

/** 上报当前快照到宿主（replace 语义：同会话覆盖，不累加）。 */
async function postSnapshot(snapshot: {
  sessionId: string
  sessionTitle: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}): Promise<void> {
  try {
    await fetch('/api/usage/record', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...snapshot, ts: Date.now() }),
    })
  } catch {
    /* 上报失败静默：不打断对话 */
  }
}

/** 当前模型（由入口从连接层更新，尽力而为）。 */
let currentModel = 'unknown'

/** 当前活跃会话 id（recorder 每次渲染同步；入口的模型轮询按它查询）。 */
let activeSessionId: string | undefined

/** 供入口设置当前模型（连接层回调）。 */
export function setCurrentModel(model: string | undefined): void {
  if (typeof model === 'string' && model.length > 0) currentModel = model
}

/** 读当前活跃会话 id（入口的模型轮询用）。 */
export function getActiveSessionId(): string | undefined {
  return activeSessionId
}

/**
 * The invisible recorder seat.
 * @param props - framework runtime share.
 * @returns null (renders nothing).
 */
export const UsageRecorder = memo(function UsageRecorder(props: UsageRecorderProps): null {
  const session = props.useSession((s) => ({ sessionId: s.sessionId }))
  const usage = props.useProjection('tokenUsage') as TokenUsageProjection | undefined
  // 标题走会话投影：实时、按会话隔离，不轮询、不猜列表第一项。
  const title = props.useProjection('title') as string | null | undefined
  const lastTotalRef = useRef<number>(-1)
  const lastSidRef = useRef<string | undefined>(undefined)
  const settleTimerRef = useRef<number | null>(null)
  const lastSeenRef = useRef<{ sessionId: string; input: number; output: number; cache: number; cacheWrite: number } | null>(null)
  const titleRef = useRef<string>('')
  const uploadedTitleRef = useRef<string>('')

  activeSessionId = session.sessionId

  // Flush one snapshot after growth settles (a response completed).
  const flush = (): void => {
    settleTimerRef.current = null
    const seen = lastSeenRef.current
    if (seen === null) return
    const snapshotTitle = titleRef.current
    uploadedTitleRef.current = snapshotTitle
    void postSnapshot({
      sessionId: seen.sessionId,
      sessionTitle: snapshotTitle,
      model: currentModel,
      inputTokens: seen.input,
      outputTokens: seen.output,
      cacheReadTokens: seen.cache,
      cacheWriteTokens: seen.cacheWrite,
    })
  }

  useEffect(() => {
    const sid = session.sessionId
    if (sid === undefined || usage === undefined) return
    // Session switch: re-baseline so the other session's larger total is
    // never read as growth (which would also ghost-increment calls).
    if (lastSidRef.current !== sid) {
      lastSidRef.current = sid
      lastTotalRef.current = -1
      lastSeenRef.current = null
      uploadedTitleRef.current = ''
    }
    const total = usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const prev = lastTotalRef.current
    if (prev === -1) {
      // Baseline only — never upload a pre-existing cumulative total.
      lastTotalRef.current = total
      return
    }
    lastTotalRef.current = total
    if (total <= 0) return
    if (total <= prev) return
    // Growth observed: remember the latest snapshot and (re)arm the settle
    // timer. Debounce 1s of streaming growth, then flush once settled.
    // inputTokens = UNCACHED input only; cache read/write are reported
    // separately so cost estimation never double-bills cached tokens.
    lastSeenRef.current = {
      sessionId: sid,
      input: usage.uncachedInputTokens,
      output: usage.outputTokens,
      cache: usage.cacheReadTokens,
      cacheWrite: usage.cacheWriteTokens,
    }
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(flush, SETTLE_MS)
  }, [session.sessionId, usage])

  // Title projection: keep the latest value for flush. A title that lands
  // after the last growth flush (LLM title generation trails the first
  // response) triggers one metadata-only re-upload — zero token growth, so
  // the host's calls counter does not move.
  useEffect(() => {
    const next = typeof title === 'string' ? title : ''
    titleRef.current = next
    const seen = lastSeenRef.current
    if (next === '' || seen === null) return
    if (seen.sessionId !== session.sessionId) return
    if (next === uploadedTitleRef.current) return
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    settleTimerRef.current = window.setTimeout(flush, SETTLE_MS)
  }, [title, session.sessionId])

  // Unmount: drop a pending settle timer.
  useEffect(() => {
    return () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    }
  }, [])

  return null
})
