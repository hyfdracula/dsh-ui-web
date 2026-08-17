/**
 * Tests for the recorder state machine (pure logic in recorder-core.ts):
 * baseline/reset protocol (C1/H3/C2), session-switch stale flush, projection
 * rollback realignment, and replay no-ops.
 * @module @captain1275/dsh-usage-dashboard/client/recorder-core
 */
import { describe, expect, it } from 'vitest'
import { decideRecorderStep, EMPTY_RECORDER_MEMORY, type RecorderSnapshot } from './recorder-core.ts'

function snap(sessionId: string, input: number): RecorderSnapshot {
  return { sessionId, input, output: 0, cache: 0, cacheWrite: 0 }
}

describe('decideRecorderStep', () => {
  it('first sight establishes a baseline (reset)', () => {
    const d = decideRecorderStep(EMPTY_RECORDER_MEMORY, 'a', snap('a', 500))
    expect(d.action).toBe('reset')
    expect(d.switched).toBe(false)
    expect(d.staleFlush).toBeNull()
    expect(d.next.lastTotal).toBe(500)
    expect(d.next.lastSeen).toEqual(snap('a', 500))
  })

  it('a zero total on first sight still establishes a baseline (C2)', () => {
    const d = decideRecorderStep(EMPTY_RECORDER_MEMORY, 'a', snap('a', 0))
    expect(d.action).toBe('reset')
    expect(d.next.lastTotal).toBe(0)
  })

  it('session switch flushes the stale snapshot and re-baselines with reset', () => {
    const fresh = decideRecorderStep(EMPTY_RECORDER_MEMORY, 'a', snap('a', 100)).next
    const grown = decideRecorderStep(fresh, 'a', snap('a', 150))
    expect(grown.action).toBe('arm-settle')
    expect(grown.next.lastSeen).toEqual(snap('a', 150))
    // 切到会话 B：staleFlush = A 的 150 快照（需先补发，C1），并对 B 建基线。
    const switched = decideRecorderStep(grown.next, 'b', snap('b', 0))
    expect(switched.switched).toBe(true)
    expect(switched.staleFlush).toEqual(snap('a', 150))
    expect(switched.action).toBe('reset')
    expect(switched.next.lastSeen).toEqual(snap('b', 0))
  })

  it('host stale snapshot cannot overcount after reset: growth is delta from the reset baseline', () => {
    // 模拟 C1 丢 flush：宿主 bySession 停在旧快照 600，客户端重新挂载后
    // 投影累计 800 → 首见 reset(800) 对齐基线；之后增长到 900 的差值
    // 以 800 为基准（=100），绝不按宿主旧快照算成 300。
    const mem1 = decideRecorderStep(EMPTY_RECORDER_MEMORY, 'a', snap('a', 800))
    expect(mem1.action).toBe('reset')
    const mem2 = decideRecorderStep(mem1.next, 'a', snap('a', 900))
    expect(mem2.action).toBe('arm-settle')
    expect(mem2.next.lastSeen).toEqual(snap('a', 900))
    expect(mem2.next.lastTotal).toBe(900)
  })

  it('equal snapshot is a noop (re-render / replay)', () => {
    const mem = decideRecorderStep(EMPTY_RECORDER_MEMORY, 'a', snap('a', 100)).next
    const d = decideRecorderStep(mem, 'a', snap('a', 100))
    expect(d.action).toBe('none')
    expect(d.staleFlush).toBeNull()
    expect(d.next).toBe(mem)
  })

  it('projection rollback re-aligns with reset (C3/C4 family)', () => {
    const mem = decideRecorderStep(EMPTY_RECORDER_MEMORY, 'a', snap('a', 300)).next
    const grown = decideRecorderStep(mem, 'a', snap('a', 500))
    const rolled = decideRecorderStep(grown.next, 'a', snap('a', 200))
    expect(rolled.action).toBe('reset')
    expect(rolled.next.lastTotal).toBe(200)
    expect(rolled.next.lastSeen).toEqual(snap('a', 200))
  })

  it('keeps memory unchanged while the projection is not ready', () => {
    const mem = decideRecorderStep(EMPTY_RECORDER_MEMORY, 'a', snap('a', 100)).next
    const d = decideRecorderStep(mem, 'a', undefined)
    expect(d.action).toBe('none')
    expect(d.next).toBe(mem)
    const d2 = decideRecorderStep(mem, undefined, snap('a', 100))
    expect(d2.action).toBe('none')
    expect(d2.next).toBe(mem)
  })
})