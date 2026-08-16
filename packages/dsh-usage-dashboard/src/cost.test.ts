/**
 * Tests for the cost estimator: pricing-table lookup, alias resolution,
 * DeepSeek keyword fallback and the estimate math.
 *
 * 注意：表驱动断言跟踪随包提交的 pricing-default.json；用
 * scripts/refresh-pricing.mjs 重新生成快照后需同步更新这里的期望值。
 * vi.hoisted 把 DSH_HOME 指到不存在的目录，保证测试读到的是包内置快照
 * 而不是本机用户级覆盖。
 * @module @captain1275/dsh-usage-dashboard/cost
 */
import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DSH_HOME = 'dsh-test-home-nonexistent'
})

const { DEEPSEEK_FLASH_RATES, DEEPSEEK_REASONER_RATES, GENERIC_RATES, estimateCost, ratesForModel } = await import('./cost.ts')

describe('ratesForModel (pricing table)', () => {
  it('matches provider/model exactly against the bundled snapshot', () => {
    expect(ratesForModel('deepseek/deepseek-chat')).toEqual({ inputPerM: 2.016, outputPerM: 3.024, cachePerM: 0.2016 })
  })

  it('matches bare names through the alias table', () => {
    expect(ratesForModel('gpt-4o')).toEqual({ inputPerM: 18, outputPerM: 72, cachePerM: 9 })
    expect(ratesForModel('kimi-k2-0711-preview')).toEqual({ inputPerM: 4.32, outputPerM: 18, cachePerM: 1.08 })
  })

  it('matches case-insensitively', () => {
    expect(ratesForModel('OpenAI/GPT-4o')).toEqual({ inputPerM: 18, outputPerM: 72, cachePerM: 9 })
  })

  it('resolves unknown-provider prefixes via the bare-name alias', () => {
    expect(ratesForModel('mycorp-relay/gpt-4o')).toEqual({ inputPerM: 18, outputPerM: 72, cachePerM: 9 })
  })

  it('matches snapshot-native DeepSeek rows', () => {
    expect(ratesForModel('deepseek-v4-flash')).toEqual({ inputPerM: 1.008, outputPerM: 2.016, cachePerM: 0.0202 })
  })
})

describe('ratesForModel (fallbacks)', () => {
  it('keeps the official DeepSeek keyword fallback for models missing from the table', () => {
    expect(ratesForModel('deepseek-flash-zz9')).toBe(DEEPSEEK_FLASH_RATES)
    expect(ratesForModel('deepseek-reasoner-zz9').inputPerM).toBe(DEEPSEEK_REASONER_RATES.inputPerM)
  })

  it('falls back to the generic rate for unknown models', () => {
    expect(ratesForModel('acme/x-9000-turbo')).toEqual(GENERIC_RATES)
  })
})

describe('estimateCost', () => {
  it('computes 1M uncached input at the flash rate = 1 yuan', () => {
    expect(estimateCost('any-model', 1_000_000, 0, 0, 0, DEEPSEEK_FLASH_RATES)).toBe(1)
  })

  it('computes flash output and cache portions (output 2/M, cache 0.02/M)', () => {
    // 1M input(1) + 1M output(2) + 1M cache(0.02) = 3.02
    expect(estimateCost('any-model', 1_000_000, 1_000_000, 1_000_000, 0, DEEPSEEK_FLASH_RATES)).toBe(3.02)
  })

  it('bills cache writes at the input rate', () => {
    // 1M cache write at flash input rate (1/M) = 1 yuan
    expect(estimateCost('any-model', 0, 0, 0, 1_000_000, DEEPSEEK_FLASH_RATES)).toBe(1)
  })

  it('handles fractional token counts', () => {
    expect(estimateCost('any-model', 250_000, 0, 0, 0, DEEPSEEK_FLASH_RATES)).toBe(0.25)
  })

  it('rounds to 4 decimals', () => {
    expect(estimateCost('any-model', 123_456, 0, 0, 0, DEEPSEEK_FLASH_RATES)).toBeCloseTo(0.1235, 3)
  })

  it('uses table rates for snapshot-backed models (gpt-4o: 18/72/9)', () => {
    // 1M input(18) + 1M output(72) + 1M cache(9) = 99
    expect(estimateCost('gpt-4o', 1_000_000, 1_000_000, 1_000_000)).toBe(99)
  })
})
