/**
 * Tests for the dashboard formatting helpers (dashboard-format.ts):
 * number/cost formatting and recent-days padding (D2/D3/D5).
 * @module @captain1275/dsh-usage-dashboard/client/dashboard-format
 */
import { describe, expect, it } from 'vitest'
import { fmt, fmtCost, padRecentDays, type RecentDay } from './dashboard-format.ts'

describe('fmt', () => {
  it('formats plain numbers', () => {
    expect(fmt(0)).toBe('0')
    expect(fmt(999)).toBe('999')
  })
  it('abbreviates thousands and millions', () => {
    expect(fmt(1234)).toBe('1.2k')
    expect(fmt(1_500_000)).toBe('1.50M')
  })
})

describe('fmtCost', () => {
  it('shows ¥0 for zero (D5)', () => {
    expect(fmtCost(0)).toBe('¥0')
  })
  it('keeps 4 decimals for small amounts', () => {
    expect(fmtCost(0.0001)).toBe('¥0.0001')
    expect(fmtCost(0.123456)).toBe('¥0.1235')
  })
  it('uses 2 decimals for normal amounts and integer for large ones', () => {
    expect(fmtCost(1.5)).toBe('¥1.50')
    expect(fmtCost(99.999)).toBe('¥100.00')
    expect(fmtCost(123.4)).toBe('¥123')
  })
})

describe('padRecentDays (D2/D3)', () => {
  const oneDay: RecentDay = { day: '2026-08-15', inputTokens: 1, outputTokens: 2, cacheReadTokens: 3, calls: 1 }

  it('passes through lists already at the minimum length', () => {
    const full: RecentDay[] = Array.from({ length: 14 }, (_, i) => ({ day: `d-${i}`, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, calls: 0 }))
    expect(padRecentDays(full, 14)).toBe(full)
  })

  it('pads short lists with unique zero days at the front', () => {
    const padded = padRecentDays([oneDay], 14)
    expect(padded).toHaveLength(14)
    expect(new Set(padded.map((d) => d.day)).size).toBe(14)
    expect(padded[padded.length - 1]).toEqual(oneDay)
    const padDays = padded.slice(0, 13)
    expect(padDays.every((d) => d.calls === 0 && d.inputTokens === 0)).toBe(true)
    expect(padDays.every((d) => d.day !== '2026-08-15')).toBe(true)
  })

  it('turns an empty array into 14 zero days instead of dividing by zero', () => {
    const padded = padRecentDays([], 14)
    expect(padded).toHaveLength(14)
    expect(padded.every((d) => d.calls === 0)).toBe(true)
  })
})