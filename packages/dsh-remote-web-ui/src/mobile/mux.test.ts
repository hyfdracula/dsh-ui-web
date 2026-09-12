/**
 * mux: the per-session live-event client — one `session.follow` SSE stream per
 * open chat, normalized frames, and the stall-driven polling fallback.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MuxClient, type EventSourceLike } from './mux.ts'
import type { HistoryPage } from './wire.ts'

/** A recorded fake EventSource (delivery driven by the test). */
interface FakeSource extends EventSourceLike {
  url: string
  closed: boolean
  close: () => void
}

/** Create an EventSource factory that records every opened source. */
function makeSources(): { factory: (url: string) => EventSourceLike; sources: FakeSource[] } {
  const sources: FakeSource[] = []
  const factory = (url: string): EventSourceLike => {
    const source: FakeSource = {
      url,
      onmessage: null,
      onerror: null,
      closed: false,
      close: () => { source.closed = true },
    }
    sources.push(source)
    return source
  }
  return { factory, sources }
}

/** One history page whose records carry sequential durable events. */
function pageOf(seqs: readonly number[]): HistoryPage {
  return {
    hasMore: false,
    records: seqs.map(seq => ({
      type: 'event',
      event: { type: 'user/message', seq, time: seq * 1_000, data: { text: String(seq) } },
    })),
  } as unknown as HistoryPage
}

/** One follow frame as the host adapter forwards it on the SSE channel. */
function frameOf(payload: unknown): string {
  return JSON.stringify(payload)
}

/** Options common to every test: tight clocks, injected data source. */
function baseOptions(
  pollLatest: (sessionId: string) => Promise<HistoryPage>,
  factory: (url: string) => EventSourceLike,
) {
  return { sourceFactory: factory, pollLatest, stallThresholdMs: 800, pollIntervalMs: 400 }
}

describe('MuxClient frames', () => {
  it('opens one stream per session and normalizes the follow frames', () => {
    const { factory, sources } = makeSources()
    const client = new MuxClient({ sourceFactory: factory })
    const frames: Array<{ type: string; sessionId?: string; key?: string; event?: { type: string; seq: number } }> = []
    client.onFrame(frame => { frames.push(frame as never) })
    client.open('s1')

    expect(sources).toHaveLength(1)
    expect(sources[0]?.url).toBe('/m/api/session.follow?sessionId=s1')

    // The opening snapshot delivers the newest window plus the projection
    // baseline the permission and model pickers read.
    sources[0]?.onmessage?.({
      data: frameOf({
        type: 'snapshot',
        header: { id: 's1', version: 3, createdAt: 1, isSeeded: false },
        cursor: 4,
        hasMore: true,
        records: [
          { type: 'event', event: { type: 'user/message', seq: 3, time: 3, data: {} } },
          { type: 'event', event: { type: 'assistant/message', seq: 4, time: 4, data: {} } },
        ],
        projections: { asOfSeq: 4, values: { permissions: { options: [], currentValue: 'default' } } },
      }),
    })
    expect(frames.filter(frame => frame.type === 'session/event')).toHaveLength(2)
    expect(frames[0]).toMatchObject({ type: 'session/event', sessionId: 's1', event: { seq: 3 } })
    expect(frames[2]).toMatchObject({ type: 'session/projection', sessionId: 's1', key: 'permissions' })

    // A durable event frame passes straight through.
    sources[0]?.onmessage?.({
      data: frameOf({ type: 'event', event: { type: 'assistant/message', seq: 5, time: 5, data: {} } }),
    })
    expect(frames[3]).toMatchObject({ type: 'session/event', sessionId: 's1', event: { seq: 5 } })

    // A newer host frame type is dropped instead of crashing the page.
    sources[0]?.onmessage?.({ data: frameOf({ type: 'unknown/future', whatever: 1 }) })
    expect(frames).toHaveLength(4)
    client.stop()
  })

  it('folds assistant stream chunks into a transient assistant/chunk event', () => {
    const { factory, sources } = makeSources()
    const client = new MuxClient({ sourceFactory: factory })
    const frames: Array<{ type: string; event?: { type: string; seq: number; data: unknown } }> = []
    client.onFrame(frame => { frames.push(frame as never) })
    client.open('s1')
    const source = sources[0]

    // start records the attempt's (turn, step) and its durable baseline.
    source?.onmessage?.({
      data: frameOf({
        type: 'assistant-stream',
        frame: { type: 'start', attemptId: 'a1', revision: 1, startedAfterSeq: 7, turn: 2, step: 0 },
      }),
    })
    expect(frames).toHaveLength(0)

    source?.onmessage?.({
      data: frameOf({
        type: 'assistant-stream',
        frame: {
          type: 'chunk', attemptId: 'a1', revision: 1, index: 0, time: 11,
          chunk: { type: 'text-delta', index: 0, text: 'he' },
        },
      }),
    })
    expect(frames).toHaveLength(1)
    const chunk = frames[0]?.event
    expect(chunk?.type).toBe('assistant/chunk')
    // The transient seq sits just above the durable cursor (7) and strictly
    // below the next durable seq, which is what the fold's watermark needs.
    expect(chunk?.seq).toBeGreaterThan(7)
    expect(chunk?.seq).toBeLessThan(8)
    expect(chunk?.data).toMatchObject({
      turn: 2,
      step: 0,
      chunk: { type: 'text-delta', index: 0, text: 'he' },
    })

    // A chunk whose attempt was never started is dropped (no turn/step).
    source?.onmessage?.({
      data: frameOf({
        type: 'assistant-stream',
        frame: { type: 'chunk', attemptId: 'ghost', revision: 1, index: 1, time: 12, chunk: { type: 'text-delta', index: 1, text: 'x' } },
      }),
    })
    expect(frames).toHaveLength(1)
    client.stop()
  })

  it('adopts a reply already streaming when the snapshot opens', () => {
    const { factory, sources } = makeSources()
    const client = new MuxClient({ sourceFactory: factory })
    const frames: Array<{ event?: { seq: number; data: unknown } }> = []
    client.onFrame(frame => { frames.push(frame as never) })
    client.open('s1')

    sources[0]?.onmessage?.({
      data: frameOf({
        type: 'snapshot',
        header: { id: 's1', version: 3, createdAt: 1, isSeeded: false },
        cursor: 9,
        hasMore: false,
        records: [],
        projections: { asOfSeq: 9, values: {} },
        assistantStream: {
          revision: 3,
          activeAttempt: { attemptId: 'live', startedAfterSeq: 8, turn: 1, step: 0, nextIndex: 4, stream: [] },
        },
      }),
    })
    sources[0]?.onmessage?.({
      data: frameOf({
        type: 'assistant-stream',
        frame: {
          type: 'chunk', attemptId: 'live', revision: 3, index: 4, time: 20,
          chunk: { type: 'reasoning-delta', index: 4, text: 'think' },
        },
      }),
    })
    expect(frames).toHaveLength(1)
    expect(frames[0]?.event?.seq).toBeGreaterThan(9)
    expect(frames[0]?.event?.seq).toBeLessThan(10)
    expect(frames[0]?.event?.data).toMatchObject({ turn: 1, step: 0 })
    client.stop()
  })

  it('switching sessions closes the old stream and opens the new address', () => {
    const { factory, sources } = makeSources()
    const client = new MuxClient({ sourceFactory: factory })
    client.open('s1')
    client.open('s2')
    expect(sources).toHaveLength(2)
    expect(sources[0]?.closed).toBe(true)
    expect(sources[1]?.url).toBe('/m/api/session.follow?sessionId=s2')
    client.open(undefined)
    expect(sources[1]?.closed).toBe(true)
    client.stop()
  })
})

describe('MuxClient polling fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('does not poll while the SSE channel is fresh', async () => {
    const { factory } = makeSources()
    const pollLatest = vi.fn(async (_sessionId: string) => pageOf([0]))
    const client = new MuxClient(baseOptions(pollLatest, factory))
    const frames: unknown[] = []
    client.onFrame(frame => { frames.push(frame) })
    client.open('s1')
    await vi.advanceTimersByTimeAsync(400) // well under the stall threshold
    expect(pollLatest).not.toHaveBeenCalled()
    expect(frames).toHaveLength(0)
    client.stop()
  })

  it('starts polling after silence and emits appended events as session/event frames', async () => {
    const { factory } = makeSources()
    const pages = [pageOf([0]), pageOf([0, 1])]
    const pollLatest = vi.fn(async (_sessionId: string) => pages.shift() ?? pageOf([]))
    const client = new MuxClient(baseOptions(pollLatest, factory))
    const frames: Array<{ type: string; sessionId: string; event?: { seq: number } }> = []
    client.onFrame(frame => { frames.push(frame as never) })
    client.open('s1')

    // Nothing live within a poll interval until the stall window passes.
    await vi.advanceTimersByTimeAsync(400)
    expect(pollLatest).not.toHaveBeenCalled()

    // Past the stall threshold the first poll runs and emits seq 0.
    await vi.advanceTimersByTimeAsync(700) // 1100ms total -> first stall-checker tick
    expect(pollLatest).toHaveBeenCalledWith('s1')
    expect(frames).toHaveLength(1)
    expect(frames[0]).toMatchObject({ type: 'session/event', sessionId: 's1' })
    expect(frames[0]?.event).toMatchObject({ seq: 0 })

    // The next poll emits only the appended event (seq 1), not seq 0 again.
    await vi.advanceTimersByTimeAsync(400)
    expect(frames).toHaveLength(2)
    expect(frames[1]?.event).toMatchObject({ seq: 1 })
    client.stop()
  })

  it('keeps the watermark so a repeated page never re-emits old events', async () => {
    const { factory } = makeSources()
    // Two calls return the same page: the second must emit nothing.
    const pollLatest = vi.fn(async (_sessionId: string) => pageOf([0, 1, 2]))
    const client = new MuxClient(baseOptions(pollLatest, factory))
    const frames: Array<{ type: string; event?: { seq: number } }> = []
    client.onFrame(frame => { frames.push(frame as never) })
    client.open('s1')

    await vi.advanceTimersByTimeAsync(1100) // first poll -> 3 events
    expect(frames).toHaveLength(3)

    await vi.advanceTimersByTimeAsync(400) // second poll -> same page, nothing new
    expect(frames).toHaveLength(3)
    client.stop()
  })

  it('stops polling when the session is cleared and keeps it stopped', async () => {
    const { factory } = makeSources()
    const pollLatest = vi.fn(async (_sessionId: string) => pageOf([0]))
    const client = new MuxClient(baseOptions(pollLatest, factory))
    client.open('s1')

    await vi.advanceTimersByTimeAsync(1100)
    expect(pollLatest).toHaveBeenCalled()

    client.open(undefined)
    const callsAfterClear = pollLatest.mock.calls.length
    await vi.advanceTimersByTimeAsync(2000)
    expect(pollLatest.mock.calls.length).toBe(callsAfterClear)
    client.stop()
  })

  it('stops polling on stop(), closing any live source', async () => {
    const { factory, sources } = makeSources()
    const pollLatest = vi.fn(async (_sessionId: string) => pageOf([0]))
    const client = new MuxClient(baseOptions(pollLatest, factory))
    client.open('s1')

    await vi.advanceTimersByTimeAsync(1100)
    expect(pollLatest).toHaveBeenCalled()

    client.stop()
    const callsAfterStop = pollLatest.mock.calls.length
    await vi.advanceTimersByTimeAsync(2000)
    expect(pollLatest.mock.calls.length).toBe(callsAfterStop)
    expect(sources[0]?.closed).toBe(true)
  })

  it('returns to SSE when a frame arrives, dropping the fallback poller', async () => {
    const { factory, sources } = makeSources()
    const pollLatest = vi.fn(async (_sessionId: string) => pageOf([0]))
    const client = new MuxClient(baseOptions(pollLatest, factory))
    const frames: Array<{ type?: string }> = []
    client.onFrame(frame => { frames.push(frame as never) })
    client.open('s1')

    // Stall into polling.
    await vi.advanceTimersByTimeAsync(1100)
    expect(pollLatest).toHaveBeenCalledTimes(1)

    // A live frame proves SSE delivers again -> fallback stops.
    sources[0]?.onmessage?.({
      data: frameOf({ type: 'event', event: { type: 'assistant/message', seq: 4, time: 4, data: {} } }),
    })

    await vi.advanceTimersByTimeAsync(2000)
    expect(pollLatest.mock.calls.length).toBe(1) // polling stopped after the live frame
    expect(frames).toHaveLength(2) // the fallback poll emitted seq 0; the live frame added seq 4
    const live = frames.filter(frame => (frame as { event?: { seq?: number } }).event?.seq === 4)
    expect(live).toHaveLength(1)
    client.stop()
  })
})
