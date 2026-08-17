/**
 * Smoke tests for dsh-usage-dashboard: aggregation math, day keys, session
 * ranking, the recent-days window, the reset/baseline protocol (H3/C1),
 * atomic persistence (H1), and timestamp sanitizing (H6).
 * @module @captain1275/dsh-usage-dashboard
 */
import { describe, expect, it, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import {
  applyRecord,
  dayKey,
  emptyUsage,
  normalizeRecord,
  readUsage,
  recentDays,
  sessionRanking,
  usagePath,
  writeUsage,
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

describe('reset/baseline protocol (H3/C1)', () => {
  it('reset replaces only the session bucket, leaving day/model/total/calls untouched', () => {
    const store = emptyUsage()
    applyRecord(store, base)
    expect(store.total.inputTokens).toBe(100)
    expect(store.total.calls).toBe(1)
    // 基线对齐：客户端当前累计 300 → reset。宿主旧快照 100 不再参与差值。
    applyRecord(store, { ...base, reset: true, inputTokens: 300, outputTokens: 150, cacheReadTokens: 60 })
    expect(store.bySession['s1']?.inputTokens).toBe(300)
    expect(store.bySession['s1']?.calls).toBe(1) // 保留既有轮数
    expect(store.total.inputTokens).toBe(100) // 不累加
    expect(store.total.calls).toBe(1)
    const day = dayKey(base.ts)
    expect(store.byDay[day]?.inputTokens).toBe(100)
    // 从对齐后的基线起增长：只计差值（300 -> 350），绝不按宿主旧快照 100 超计。
    applyRecord(store, { ...base, inputTokens: 350, outputTokens: 160 })
    expect(store.total.inputTokens).toBe(150)
    expect(store.total.calls).toBe(2)
    expect(store.byDay[day]?.inputTokens).toBe(150)
  })

  it('first reset for a session starts the calls counter at zero', () => {
    const store = emptyUsage()
    applyRecord(store, { ...base, reset: true, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 })
    expect(store.bySession['s1']?.calls).toBe(0)
    expect(store.total.calls).toBe(0)
    // 首次真实增长从 0 基线起算。
    applyRecord(store, { ...base, inputTokens: 50 })
    expect(store.total.inputTokens).toBe(50)
    expect(store.total.calls).toBe(1)
  })
})

describe('normalizeRecord (H6 + reset passthrough)', () => {
  it('clamps client timestamps beyond a +-48h window to now', () => {
    const now = Date.now()
    const future = now + 48 * 3600_000 + 60_000
    const rec = normalizeRecord({ ...base, ts: future, inputTokens: 5 })
    expect(rec?.ts).not.toBe(future)
    expect(Math.abs((rec?.ts ?? 0) - now)).toBeLessThan(5000)
    const past = now - 49 * 3600_000
    const rec2 = normalizeRecord({ ...base, ts: past, inputTokens: 5 })
    expect(rec2?.ts).not.toBe(past)
    // 窗口内的时间戳保留。
    const within = now - 3600_000
    expect(normalizeRecord({ ...base, ts: within, inputTokens: 5 })?.ts).toBe(within)
  })

  it('rejects all-zero records unless reset is set (baseline may be zero)', () => {
    const zero = { ...base, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }
    expect(normalizeRecord(zero)).toBeUndefined()
    const resetZero = normalizeRecord({ ...zero, reset: true })
    expect(resetZero?.reset).toBe(true)
    expect(resetZero?.inputTokens).toBe(0)
  })
})

describe('persistence (H1)', () => {
  const freshHome = (): string => {
    const home = join(tmpdir(), `usage-persist-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(home, { recursive: true })
    return home
  }

  it('writes atomically and leaves no tmp file behind', () => {
    const home = freshHome()
    process.env.DSH_HOME = home
    try {
      const store = emptyUsage()
      applyRecord(store, base)
      writeUsage(store)
      const entries = readdirSync(home)
      expect(entries).toContain('usage.json')
      expect(entries.some((f) => f === 'usage.json.tmp')).toBe(false)
      const read = readUsage()
      expect(read.bySession['s1']?.inputTokens).toBe(100)
    } finally {
      delete process.env.DSH_HOME
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('backs up a corrupt file instead of silently wiping history', () => {
    const home = freshHome()
    process.env.DSH_HOME = home
    try {
      const store = emptyUsage()
      applyRecord(store, base)
      writeUsage(store)
      // 模拟崩溃留下的截断文件。
      writeFileSync(usagePath(), '{ "bySession": {"s1": {', 'utf8')
      const read = readUsage()
      expect(read.total.calls).toBe(0)
      const entries = readdirSync(home)
      expect(entries.some((f) => f.startsWith('usage.json.corrupt-'))).toBe(true)
      // 备份后再写入不会覆盖备份。
      writeUsage(read)
      const after = readdirSync(home)
      expect(after.filter((f) => f.startsWith('usage.json.corrupt-'))).toHaveLength(1)
    } finally {
      delete process.env.DSH_HOME
      rmSync(home, { recursive: true, force: true })
    }
  })
})

describe('recentDays (H4)', () => {
  it('walks strictly increasing local calendar days without duplicates or gaps', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-08-15T12:00:00'))
      const days = recentDays(emptyUsage(), 14)
      expect(days).toHaveLength(14)
      const keys = days.map((d) => d.day)
      expect(new Set(keys).size).toBe(14)
      // 用不受 DST 影响的单调日序号比较（14 天都在同一个月内）。
      const dayIndex = (key: string): number => {
        const [y, m, d] = key.split('-').map(Number)
        return y * 372 + m * 31 + d
      }
      expect(dayIndex(keys[0])).toBe(dayIndex('2026-08-15') - 13)
      for (let i = 1; i < keys.length; i++) {
        expect(dayIndex(keys[i]) - dayIndex(keys[i - 1])).toBe(1)
      }
    } finally {
      vi.useRealTimers()
    }
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
