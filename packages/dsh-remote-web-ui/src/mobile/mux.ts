/**
 * Mobile-surface live-event client: one `session.follow` stream per open chat,
 * bridged by the host onto the plugin's `/m/api/session.follow` SSE channel
 * (Server-Sent Events — no WebSocket handshake or framing is needed on this
 * side). The host opens the official Remote stream with
 * `assistantStream: true`, so the phone receives, in order:
 *
 * - exactly one `snapshot` frame (the newest message window, the projection
 *   baseline, and the durable tail cursor),
 * - `{ type: 'event', event }` durable events, gap-free from the cursor, and
 * - `{ type: 'assistant-stream', frame }` process-local presentation frames
 *   (`start` / `chunk` / `end`) that make the reply stream token by token.
 *
 * This client normalizes all of that into the two mobile frames the surface
 * consumes ({@link MobileFrame}), so the views never see the Remote vocabulary:
 * durable events pass through as `session/event`, projection deltas arrive as
 * `session/projection` (the host pushes them when the durable fold moves a
 * value), and assistant chunks are re-emitted as `assistant/chunk` events
 * folded into the message they belong to.
 *
 * EventSource reconnects automatically — but only over a tunnel that actually
 * forwards frames. Public quick tunnels (Cloudflare quick tunnel / Tailscale
 * Serve) do not transparently pass Server-Sent Events: ordinary HTTP works,
 * yet the SSE connection stays open or reconnects with zero bytes, so no live
 * frame ever arrives. That is a transport-layer limit of the tunnel, not
 * something the host can fix. This client therefore degrades gracefully: once
 * the SSE channel has silently stalled (no frame for
 * {@link MuxClientOptions.stallThresholdMs}, or the EventSource reports an
 * error), it starts polling the open session's history over plain HTTP (the
 * `/m/api/session.page` RPC — unaffected by the SSE limitation) and re-emits
 * freshly appended events as `session/event` frames, so listeners (and the
 * message fold) behave exactly as if the frames had arrived over SSE. When the
 * SSE channel delivers again, fallback polling stops and the live stream takes
 * over.
 */

import { history as fetchHistory, type HistoryPage } from './api.ts'
import {
  parseFollowFrame,
  parseProjectionFrame,
  type AssistantStreamFrame,
  type MobileFrame,
} from './wire.ts'

/** Injectable seams for tests. */
export interface MuxClientOptions {
  /** EventSource factory (defaults to the browser EventSource). */
  sourceFactory?: (url: string) => EventSourceLike
  /**
   * Fetch one history page (tail) for a session — the polling fallback's
   * data source. Defaults to the mobile `session.page` RPC, which rides the
   * ordinary HTTP channel (unaffected by SSE-impairing tunnels).
   */
  pollLatest?: (sessionId: string) => Promise<HistoryPage>
  /** Poll cadence while SSE is stalled (default 3000 ms). */
  pollIntervalMs?: number
  /** How long SSE must go without a frame before fallback kicks in (default 12000 ms). */
  stallThresholdMs?: number
  /** Clock seam for tests (defaults to Date.now). */
  now?: () => number
  /** Stream URL (defaults to the host adapter's follow endpoint). */
  url?: string
}

/** The EventSource subset this client uses (browser EventSource fits). */
export interface EventSourceLike {
  onmessage: ((event: { data: string }) => void) | null
  onerror: ((event: unknown) => void) | null
  close(): void
}

/** Browser default source factory. */
function browserSource(url: string): EventSourceLike {
  // The DOM EventSource is structurally compatible; the `this`-typed handler
  // signatures differ, so the narrow face takes it through an adapter cast.
  return new EventSource(url) as unknown as EventSourceLike
}

const DEFAULT_URL = '/m/api/session.follow'
const DEFAULT_POLL_INTERVAL_MS = 3000
const DEFAULT_STALL_THRESHOLD_MS = 12000
/** Poll window: enough recent events to cover a few seconds of agent output. */
const DEFAULT_POLL_PAGE_SIZE = 50
/**
 * Divisor that turns a dense assistant chunk index into a durable-cursor
 * fractional sequence: transient rows sort after the durable event they follow
 * and still stay strictly below the next durable seq, which is what the
 * message fold's watermark needs to keep them ordered and idempotent.
 */
const TRANSIENT_SPAN = 1_000_000

/** One assistant attempt the stream is currently presenting. */
interface ActiveAttempt {
  turn: number
  step: number
  /** Durable cursor the attempt started after: the transient seq baseline. */
  baseSeq: number
}

/**
 * Keep one session's SSE subscription open, fanning normalized frames out to
 * subscribers. EventSource owns reconnection (with its own backoff); this
 * class owns the per-session subscription lifecycle plus the polling fallback
 * that keeps the open chat live when the SSE channel cannot deliver.
 */
export class MuxClient {
  private readonly sourceFactory: (url: string) => EventSourceLike
  private readonly pollLatest: (sessionId: string) => Promise<HistoryPage>
  private readonly pollIntervalMs: number
  private readonly stallThresholdMs: number
  private readonly now: () => number
  private readonly url: string
  private readonly listeners = new Set<(frame: MobileFrame) => void>()
  private source: EventSourceLike | undefined
  private stopped = false

  /** The session currently streamed (undefined = no chat open). */
  private sessionId: string | undefined
  /** Last durable seq this client emitted, for poll dedup and transient ordering. */
  private lastDurableSeq = -1
  /** Durable tail cursor from the opening snapshot (older-page anchor). */
  private cursor = -1
  /** Assistant attempts by id, so chunk frames find their (turn, step). */
  private readonly attempts = new Map<string, ActiveAttempt>()
  /** Last epoch ms the SSE channel produced a frame (or the stream opened). */
  private lastDataAt = 0
  /**
   * Whether the SSE channel has ever delivered a frame in this stream (a
   * delivered frame proves the tunnel forwards SSE; silence alone then means
   * the agent idle, not a dead channel — only an onerror re-arms fallback).
   */
  private sseAlive = false
  private stallTimer: ReturnType<typeof setInterval> | undefined
  private pollTimer: ReturnType<typeof setInterval> | undefined
  private polling = false

  /**
   * @param options - seams.
   */
  constructor(options: MuxClientOptions = {}) {
    this.url = options.url ?? DEFAULT_URL
    this.sourceFactory = options.sourceFactory ?? browserSource
    this.pollLatest = options.pollLatest ?? ((sessionId) => fetchHistory(sessionId, undefined, DEFAULT_POLL_PAGE_SIZE))
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    this.stallThresholdMs = options.stallThresholdMs ?? DEFAULT_STALL_THRESHOLD_MS
    this.now = options.now ?? (() => Date.now())
  }

  /** Subscribe to normalized frames; returns an unsubscribe function. */
  onFrame(listener: (frame: MobileFrame) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  /**
   * Point the stream at one open session (or `undefined` to close it). A new
   * id tears the old stream down first: the phone only ever watches one chat,
   * and per-session streams are what 0.1.5 exposes (`session.follow` takes an
   * address, not a global subscription).
   */
  open(sessionId: string | undefined): void {
    if (sessionId === this.sessionId) {
      if (sessionId !== undefined) this.startStallChecker()
      return
    }
    this.closeSource()
    this.stopPolling()
    this.attempts.clear()
    this.lastDurableSeq = -1
    this.cursor = -1
    this.sessionId = sessionId
    this.sseAlive = false
    this.lastDataAt = this.now()
    if (sessionId === undefined) {
      this.stopStallChecker()
      return
    }
    this.connect(sessionId)
    this.startStallChecker()
  }

  /** Close for good. */
  stop(): void {
    this.stopped = true
    this.stopStallChecker()
    this.stopPolling()
    this.closeSource()
    this.sessionId = undefined
    this.attempts.clear()
  }

  private connect(sessionId: string): void {
    // A fresh stream starts unknown; only a delivered frame proves it works.
    this.sseAlive = false
    const source = this.sourceFactory(`${this.url}?sessionId=${encodeURIComponent(sessionId)}`)
    this.source = source
    source.onmessage = (event) => {
      this.handleMessage(event.data)
    }
    source.onerror = () => {
      // EventSource reconnects by itself; when we are closing, detach first
      // so the native reconnect cannot outlive stop(). Otherwise an error is
      // a strong signal the transport is not delivering — degrade to polling.
      if (this.stopped && this.source === source) {
        this.closeSource()
        return
      }
      this.sseAlive = false
      if (this.sessionId !== undefined) this.startPolling()
    }
  }

  private startStallChecker(): void {
    this.stopStallChecker()
    this.stallTimer = setInterval(() => {
      if (this.stopped) return
      if (this.sessionId === undefined) return
      if (this.polling) return
      // A live SSE channel only goes silent while the agent idles; never
      // poll against it. Fallback arms again only via onerror or a stream
      // that has never delivered.
      if (this.sseAlive) return
      if ((this.now() - this.lastDataAt) > this.stallThresholdMs) this.startPolling()
    }, 1000)
  }

  private stopStallChecker(): void {
    if (this.stallTimer !== undefined) {
      clearInterval(this.stallTimer)
      this.stallTimer = undefined
    }
  }

  private startPolling(): void {
    if (this.polling || this.stopped) return
    this.polling = true
    void this.pollTick()
    this.pollTimer = setInterval(() => { void this.pollTick() }, this.pollIntervalMs)
  }

  private stopPolling(): void {
    this.polling = false
    if (this.pollTimer !== undefined) {
      clearInterval(this.pollTimer)
      this.pollTimer = undefined
    }
  }

  /**
   * Fetch the latest history page for the open session and re-emit any event
   * above the durable watermark as a `session/event` frame. Idempotent by
   * seq: listeners (and the fold) never see a duplicate.
   */
  private async pollTick(): Promise<void> {
    const sessionId = this.sessionId
    if (sessionId === undefined) {
      this.stopPolling()
      return
    }
    try {
      const page = await this.pollLatest(sessionId)
      if (this.sessionId !== sessionId) return
      if (page.records.length > 0 && this.sseAlive === false) {
        // A poll that answered proves the HTTP channel works; SSE stays the
        // preferred carrier and re-arms the moment a frame arrives.
        this.lastDataAt = this.now()
      }
      for (const record of page.records) {
        const seq = record.event.seq
        if (seq <= this.lastDurableSeq) continue
        this.lastDurableSeq = seq
        this.emit({ type: 'session/event', sessionId, event: record.event })
      }
    } catch {
      // Transient (network, pairing, paging); the next tick retries.
    }
  }

  private handleMessage(data: string): void {
    if (typeof data !== 'string' || data === '') return
    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    const sessionId = this.sessionId
    if (sessionId === undefined) return

    const projection = parseProjectionFrame(parsed)
    if (projection !== undefined) {
      this.markAlive()
      this.emit({ type: 'session/projection', sessionId, key: projection.key, value: projection.value })
      return
    }

    const frame = parseFollowFrame(parsed)
    if (frame === undefined) return
    this.markAlive()

    if (frame.type === 'snapshot') {
      this.cursor = frame.cursor
      for (const record of frame.records) {
        if (record.event.seq > this.lastDurableSeq) this.lastDurableSeq = record.event.seq
        this.emit({ type: 'session/event', sessionId, event: record.event })
      }
      for (const [key, value] of Object.entries(frame.projections.values)) {
        this.emit({ type: 'session/projection', sessionId, key, value })
      }
      // A reply already streaming when this phone connected has no `start`
      // frame ahead of it: adopt the baseline attempt so its chunks fold into
      // the right (turn, step). Its packed prefix stays out of scope — the
      // phone shows what arrives from here on.
      const active = frame.assistantStream?.activeAttempt
      if (active !== undefined) {
        this.attempts.set(active.attemptId, {
          turn: active.turn,
          step: active.step,
          baseSeq: Math.max(active.startedAfterSeq, frame.cursor, this.lastDurableSeq),
        })
      }
      return
    }

    if (frame.type === 'event') {
      this.lastDurableSeq = Math.max(this.lastDurableSeq, frame.event.seq)
      this.emit({ type: 'session/event', sessionId, event: frame.event })
      return
    }

    this.handleAssistantStream(sessionId, frame.frame)
  }

  /**
   * Fold one process-local assistant frame into a `assistant/chunk` event the
   * message fold already understands: `start` records the attempt's
   * `(turn, step)` and durable baseline, `chunk` re-emits the raw LLM chunk on
   * a transient seq just above that baseline, `end` releases the attempt (the
   * durable `assistant/message` that follows settles the rendered text).
   */
  private handleAssistantStream(sessionId: string, frame: AssistantStreamFrame): void {
    if (frame.type === 'start') {
      this.attempts.set(frame.attemptId, {
        turn: frame.turn,
        step: frame.step,
        baseSeq: Math.max(frame.startedAfterSeq, this.lastDurableSeq),
      })
      return
    }
    if (frame.type === 'end') {
      this.attempts.delete(frame.attemptId)
      return
    }
    const attempt = this.attempts.get(frame.attemptId)
    if (attempt === undefined) return
    this.emit({
      type: 'session/event',
      sessionId,
      event: {
        type: 'assistant/chunk',
        seq: attempt.baseSeq + (frame.index + 1) / TRANSIENT_SPAN,
        time: frame.time,
        data: { turn: attempt.turn, step: attempt.step, chunk: frame.chunk },
      },
    })
  }

  /** Record that the SSE channel is delivering (and stop the fallback). */
  private markAlive(): void {
    this.sseAlive = true
    this.lastDataAt = this.now()
    if (this.polling) this.stopPolling()
  }

  private emit(frame: MobileFrame): void {
    for (const listener of this.listeners) {
      try {
        listener(frame)
      } catch {
        // A throwing subscriber must not break the emit loop.
      }
    }
  }

  private closeSource(): void {
    const source = this.source
    this.source = undefined
    if (source !== undefined) {
      source.onmessage = null
      source.onerror = null
      try {
        source.close()
      } catch {
        // Already closed.
      }
    }
  }
}
