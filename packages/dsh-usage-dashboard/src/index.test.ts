/**
 * Smoke tests for dsh-usage-dashboard: aggregation math, day keys, session
 * ranking, and the recent-days window (the CI gate requires at least one
 * test file per package).
 * @module @captain1275/dsh-usage-dashboard
 */
import { describe, expect, it } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import {
  applyRecord,
  dayKey,
  emptyUsage,
  recentDays,
  sessionRanking,
  type UsageRecord,
} from './index.ts'
import { mergeFreshSnapshot } from './pricing.ts'

const base: UsageRecord = {
  sessionId: 's1',
  sessionTitle: '会话 A',
  model: 'deepseek/deepseek-chat',
  ts: Date.now(),
  inputTokens: 100,
  outputTokens: 50,
  cacheReadTokens: 20,
  cacheWriteTokens: 0,
}

describe('usage aggregation', () => {
  it('accumulates records into session/day/model buckets and totals', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    applyRecord(store, { ...base, sessionId: 's2', sessionTitle: '会话 B', model: 'deepseek/deepseek-reasoner', inputTokens: 200, outputTokens: 30 })

    expect(store.total.inputTokens).toBe(300)
    expect(store.total.outputTokens).toBe(80)
    expect(store.total.cacheReadTokens).toBe(40)
    expect(store.total.calls).toBe(2)

    expect(store.bySession['s1']?.inputTokens).toBe(100)
    expect(store.bySession['s2']?.outputTokens).toBe(30)

    const day = dayKey(base.ts)
    expect(store.byDay[day]?.calls).toBe(2)

    expect(store.byModel['deepseek/deepseek-chat']?.calls).toBe(1)
    expect(store.byModel['deepseek/deepseek-reasoner']?.calls).toBe(1)
  })

  it('replaces the session snapshot on repeat uploads (no double counting)', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    // Second upload: same session, higher cumulative snapshot.
    applyRecord(store, { ...base, inputTokens: 150, outputTokens: 75, cacheReadTokens: 30 })
    // Session bucket holds the LATEST snapshot.
    expect(store.bySession['s1']?.inputTokens).toBe(150)
    expect(store.bySession['s1']?.outputTokens).toBe(75)
    expect(store.bySession['s1']?.cacheReadTokens).toBe(30)
    // Day/model/total buckets accumulated the GROWTH only (150-100 input).
    const day = dayKey(base.ts)
    expect(store.byDay[day]?.inputTokens).toBe(150)
    expect(store.byModel['deepseek/deepseek-chat']?.inputTokens).toBe(150)
    expect(store.total.inputTokens).toBe(150)
  })

  it('clamps at zero when a projection resets (no subtraction)', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    const before = store.total.inputTokens
    // A reset snapshot (smaller) must not subtract from totals.
    applyRecord(store, { ...base, inputTokens: 10, outputTokens: 5 })
    expect(store.total.inputTokens).toBe(before)
    expect(store.bySession['s1']?.inputTokens).toBe(10)
  })

  it('does not inflate calls on a re-uploaded identical snapshot', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    // Same snapshot again (baseline re-sync after a page refresh or a
    // session round-trip): tokens unchanged, calls must not grow.
    applyRecord(store, { ...base, ts: base.ts + 1000 })
    expect(store.total.calls).toBe(1)
    expect(store.bySession['s1']?.calls).toBe(1)
    // But a title that lands later still updates the stored session row.
    applyRecord(store, { ...base, sessionTitle: '真正的标题', ts: base.ts + 2000 })
    expect(store.bySession['s1']?.title).toBe('真正的标题')
    expect(store.bySession['s1']?.calls).toBe(1)
  })

  it('accumulates cache-write tokens into every bucket', () => {
    const store = emptyUsage()
    applyRecord(store, { ...base, cacheWriteTokens: 30 })
    expect(store.total.cacheWriteTokens).toBe(30)
    expect(store.byModel['deepseek/deepseek-chat']?.cacheWriteTokens).toBe(30)
    expect(store.bySession['s1']?.cacheWriteTokens).toBe(30)
    // Ranking total includes cache writes.
    expect(sessionRanking(store, 10)[0]?.totalTokens).toBe(100 + 50 + 20 + 30)
  })

  it('ranks sessions by total tokens descending', () => {
    const store = emptyUsage()
    applyRecord(store, base) // s1: 170 total
    applyRecord(store, { ...base, sessionId: 's2', sessionTitle: 'B', inputTokens: 500, outputTokens: 100 }) // s2: 620
    const ranked = sessionRanking(store, 10)
    expect(ranked[0]?.id).toBe('s2')
    expect(ranked[0]?.totalTokens).toBe(620)
    expect(ranked[1]?.id).toBe('s1')
  })

  it('fills the recent-days window with zeros for empty days', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    const days = recentDays(store, 14)
    expect(days).toHaveLength(14)
    // The recorded day has the tokens; at least one other day is zero.
    const today = dayKey(Date.now())
    const todayEntry = days.find((d) => d.day === today)
    expect(todayEntry?.calls).toBe(1)
    expect(todayEntry?.cacheReadTokens).toBe(base.cacheReadTokens)
    expect(days.some((d) => d.calls === 0)).toBe(true)
  })
})

describe('usage helpers', () => {
  it('formats day keys in local time', () => {
    expect(dayKey(0)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('preserves custom pricing entries across a LiteLLM refresh', () => {
    const existing = {
      _source: 'user-custom', _unit: 'CNY per 1M tokens', _fx: 7.2, _fetchedAt: 'x',
      models: {
        'k3-256k': { i: 10.8, o: 54, c: 1.08 },
        'deepseek/deepseek-chat': { i: 1, o: 2, c: 0.05 }, // 与官方同名：以官方价为准
      },
      aliases: { 'my-k3': 'k3-256k' },
    }
    const fresh = {
      _source: 'litellm', _unit: 'CNY per 1M tokens', _fx: 7.2, _fetchedAt: 'y',
      models: { 'deepseek/deepseek-chat': { i: 2.016, o: 3.024, c: 0.2016 } },
      aliases: {},
    }
    const merged = mergeFreshSnapshot(existing, fresh)
    // 官方同名列被最新价覆盖；自定义条目保留。
    expect(merged.models['deepseek/deepseek-chat']).toEqual({ i: 2.016, o: 3.024, c: 0.2016 })
    expect(merged.models['k3-256k']).toEqual({ i: 10.8, o: 54, c: 1.08 })
    expect(merged.aliases['my-k3']).toBe('k3-256k')
    expect(merged._fetchedAt).toBe('y')
  })

  it('mergeFreshSnapshot passes a fresh-only snapshot through', () => {
    const fresh = {
      _source: 'litellm', _unit: 'CNY per 1M tokens', _fx: 7.2, _fetchedAt: 'z',
      models: { a: { i: 1, o: 2 } }, aliases: {},
    }
    expect(mergeFreshSnapshot(null, fresh)).toBe(fresh)
    expect(mergeFreshSnapshot(fresh, fresh)).toBe(fresh)
  })

  it('tolerates missing usage file', () => {
    const home = join(tmpdir(), `usage-test-${process.pid}-${Date.now()}`)
    process.env.DSH_HOME = home
    try {
      // readUsage returns empty when the file is absent.
      const { readUsage } = require('./index.ts') as typeof import('./index.ts')
      expect(readUsage().total.calls).toBe(0)
    } finally {
      delete process.env.DSH_HOME
      rmSync(home, { recursive: true, force: true })
    }
  })
})
