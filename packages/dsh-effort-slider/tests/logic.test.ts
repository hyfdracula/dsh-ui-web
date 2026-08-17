/**
 * Pure-logic tests for the effort slider plugin.
 *
 * Covers the review items that are unit-testable without DOM/React:
 * - pickHighest 语义匹配与回退（条目 8 的"最后一项"假设）
 * - step100 / rawIndex / 档位下标边界（2 档、1 档、空、越界夹取）
 * - 自动写去重/退避/上限（条目 2/4：失败时间戳 + index retry + 5 次上限）
 * - '' 视为显式值、OFF 语义判定（条目 16）
 * - 档位标签不硬编码 OFF（条目 20）
 * - 槽位/thumb 行程对齐公式（条目 17）
 */
import { describe, expect, it } from 'vitest'

import {
  AUTO_WRITE_MAX_ATTEMPTS,
  effortIndexForId,
  effortIndexForRaw,
  isEffortUnset,
  levelLabel,
  nextAutoWriteDelay,
  pickHighest,
  rawForEffortIndex,
  retryDelayMs,
  slotLeftPx,
  step100ForCount,
  THUMB_HALF,
  TRACK_W,
  THUMB_SIZE,
} from '../src/client/logic.ts'

describe('pickHighest', () => {
  it('picks the semantic max entry over the last item when names match', () => {
    const efforts = [
      { id: 'off', name: 'OFF' },
      { id: 'low', name: 'Low' },
      { id: 'medium', name: 'Medium' },
      { id: 'high', name: 'High' },
      { id: 'max', name: 'Max' },
    ]
    expect(pickHighest(efforts)?.id).toBe('max')
  })

  it('prefers the strongest hint (max over high)', () => {
    const efforts = [
      { id: 'low', name: '低' },
      { id: 'high', name: '高' },
      { id: 'max', name: 'Max' },
    ]
    expect(pickHighest(efforts)?.id).toBe('max')
  })

  it('falls back to the last item when no hint matches', () => {
    const efforts = [
      { id: 'balanced', name: '平衡' },
      { id: 'precise', name: '精确' },
    ]
    expect(pickHighest(efforts)?.id).toBe('precise')
  })

  it('matches hints case-insensitively and by id', () => {
    const efforts = [
      { id: 'off', name: '关闭' },
      { id: 'ultra', name: 'Ultra' },
    ]
    expect(pickHighest(efforts)?.id).toBe('ultra')
  })

  it('keeps working for descending adapter order (max first)', () => {
    const efforts = [
      { id: 'max', name: 'MAX' },
      { id: 'medium', name: 'MEDIUM' },
      { id: 'low', name: 'LOW' },
    ]
    expect(pickHighest(efforts)?.id).toBe('max')
  })

  it('picks the last of multiple same-hint entries (ascending display order)', () => {
    const efforts = [
      { id: 'high-1', name: 'High A' },
      { id: 'high-2', name: 'High B' },
    ]
    expect(pickHighest(efforts)?.id).toBe('high-2')
  })

  it('returns undefined for an empty list', () => {
    expect(pickHighest([])).toBeUndefined()
  })
})

describe('step100ForCount / rawIndex / effortIndexForRaw', () => {
  it('computes the 0..100 step for 2+ levels', () => {
    expect(step100ForCount(2)).toBe(100)
    expect(step100ForCount(3)).toBe(50)
    expect(step100ForCount(5)).toBe(25)
  })

  it('degenerates to filling the track for 1 or 0 levels', () => {
    expect(step100ForCount(1)).toBe(100)
    expect(step100ForCount(0)).toBe(100)
  })

  it('maps an index to a raw slider value', () => {
    expect(rawForEffortIndex(0, 50)).toBe(0)
    expect(rawForEffortIndex(2, 50)).toBe(100)
  })

  it('rounds raw values to the nearest level and clamps to bounds', () => {
    // 2 levels, step 100
    expect(effortIndexForRaw(0, 100, 2)).toBe(0)
    expect(effortIndexForRaw(49, 100, 2)).toBe(0)
    expect(effortIndexForRaw(50, 100, 2)).toBe(1)
    expect(effortIndexForRaw(99.9, 100, 2)).toBe(1)
    expect(effortIndexForRaw(120, 100, 2)).toBe(1)
    expect(effortIndexForRaw(-10, 100, 2)).toBe(0)
  })

  it('rounds on the half-step boundary for 3 levels', () => {
    // 3 levels, step 50: raw 25 rounds to index 1
    expect(effortIndexForRaw(25, 50, 3)).toBe(1)
    expect(effortIndexForRaw(24, 50, 3)).toBe(0)
    expect(effortIndexForRaw(75, 50, 3)).toBe(2)
  })

  it('returns -1 for an invalid count and guards zero step', () => {
    expect(effortIndexForRaw(50, 100, 0)).toBe(-1)
    expect(effortIndexForRaw(50, 0, 3)).toBe(0)
  })

  it('finds an effort by id and reports -1 when missing', () => {
    const efforts = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    expect(effortIndexForId(efforts, 'b')).toBe(1)
    expect(effortIndexForId(efforts, 'zzz')).toBe(-1)
  })
})

describe('retry/backoff', () => {
  it('returns the base poll delay for zero prior failures', () => {
    expect(retryDelayMs(0)).toBe(1000)
  })

  it('grows exponentially and caps at 30s (1s -> 5s -> 25s -> 30s)', () => {
    expect(retryDelayMs(1)).toBe(5000)
    expect(retryDelayMs(2)).toBe(25000)
    expect(retryDelayMs(3)).toBe(30000)
    expect(retryDelayMs(9)).toBe(30000)
  })

  it('lets an unknown record write immediately', () => {
    expect(nextAutoWriteDelay(undefined, Date.now())).toBe(0)
  })

  it('gives up permanently after AUTO_WRITE_MAX_ATTEMPTS failures', () => {
    const record = { key: 'k', attempts: AUTO_WRITE_MAX_ATTEMPTS, lastFailureAt: Date.now() - 100000 }
    expect(nextAutoWriteDelay(record, Date.now())).toBeNull()
    // 即使时间早已超过退避，也不再重试同 key
    const record2 = { key: 'k', attempts: AUTO_WRITE_MAX_ATTEMPTS, lastFailureAt: Date.now() }
    expect(nextAutoWriteDelay(record2, Date.now())).toBeNull()
  })

  it('waits for the backoff window based on the failure timestamp', () => {
    const now = 1_000_000
    expect(nextAutoWriteDelay({ key: 'k', attempts: 1, lastFailureAt: now }, now)).toBe(1000)
    expect(nextAutoWriteDelay({ key: 'k', attempts: 2, lastFailureAt: now }, now)).toBe(5000)
    expect(nextAutoWriteDelay({ key: 'k', attempts: 4, lastFailureAt: now }, now)).toBe(30000)
    // 退避时间已过 -> 立刻可写
    expect(nextAutoWriteDelay({ key: 'k', attempts: 1, lastFailureAt: now - 5000 }, now)).toBe(0)
  })

  it('does not count a key-switch (model change) against the old record', () => {
    // 新 key（模型切换/换档）没有记录，立即允许重试
    expect(nextAutoWriteDelay(undefined, Date.now())).toBe(0)
  })
})

describe('isEffortUnset (entry 16)', () => {
  it('treats undefined/null as unset', () => {
    expect(isEffortUnset(undefined)).toBe(true)
    expect(isEffortUnset(null)).toBe(true)
  })

  it('treats the empty string as an explicit value', () => {
    expect(isEffortUnset('')).toBe(false)
    expect(isEffortUnset('low')).toBe(false)
  })
})

describe('levelLabel (entry 20)', () => {
  it('uses the entry name and does not hard-code OFF for the first slot', () => {
    expect(levelLabel({ id: 'low', name: '低' })).toBe('低')
    expect(levelLabel({ id: 'medium', name: 'Medium' })).toBe('Medium')
    expect(levelLabel({ id: 'max', name: 'Max' })).toBe('Max')
  })

  it('keeps OFF only for entries that carry off semantics', () => {
    expect(levelLabel({ id: 'off', name: 'OFF' })).toBe('OFF')
    expect(levelLabel({ id: 'off', name: '关闭' })).toBe('OFF')
    expect(levelLabel({ id: 'no-reasoning', name: 'Off' })).toBe('OFF')
  })
})

describe('slotLeftPx (entry 17)', () => {
  it('aligns slots with the thumb centre travel', () => {
    // thumb 中心从 THUMB_HALF 走到 TRACK_W - THUMB_HALF
    expect(slotLeftPx(0)).toBe(THUMB_HALF)
    expect(slotLeftPx(1)).toBe(TRACK_W - THUMB_HALF)
    expect(slotLeftPx(0.5)).toBe(THUMB_HALF + 0.5 * (TRACK_W - THUMB_SIZE))
  })

  it('clamps the fraction into 0..1', () => {
    expect(slotLeftPx(-1)).toBe(THUMB_HALF)
    expect(slotLeftPx(2)).toBe(TRACK_W - THUMB_HALF)
  })
})