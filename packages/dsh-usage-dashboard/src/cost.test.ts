/**
 * Tests for the cost estimator: pricing-table lookup, alias resolution,
 * version-suffix stripping (M3), DeepSeek keyword fallback (M1), cache-write
 * pricing (M2), and the exact estimate math (M4).
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

const { DEEPSEEK_FLASH_RATES, DEEPSEEK_OFFICIAL_RATES, DEEPSEEK_RATES, DEEPSEEK_REASONER_RATES, GENERIC_RATES, estimateCost, ratesForModel } = await import('./cost.ts')

const GPT4O_RATES = { inputPerM: 18, outputPerM: 72, cachePerM: 9, cacheWritePerM: 18 }

describe('ratesForModel (pricing table)', () => {
  it('matches provider/model exactly against the bundled snapshot', () => {
    expect(ratesForModel('deepseek/deepseek-chat')).toEqual({ inputPerM: 2.016, outputPerM: 3.024, cachePerM: 0.2016, cacheWritePerM: 2.016 })
  })

  it('matches bare names through the alias table', () => {
    expect(ratesForModel('gpt-4o')).toEqual(GPT4O_RATES)
    expect(ratesForModel('kimi-k2-0711-preview')).toEqual({ inputPerM: 4.32, outputPerM: 18, cachePerM: 1.08, cacheWritePerM: 4.32 })
  })

  it('matches case-insensitively', () => {
    expect(ratesForModel('OpenAI/GPT-4o')).toEqual(GPT4O_RATES)
  })

  it('resolves unknown-provider prefixes via the bare-name alias', () => {
    expect(ratesForModel('mycorp-relay/gpt-4o')).toEqual(GPT4O_RATES)
  })

  it('matches snapshot rows for models outside the official DeepSeek table', () => {
    // deepseek-v4-flash 现在由官方表接管（见下一个 describe），这里用未被接管的
    // 快照行验证「快照精确匹配 -> entryToRates」链路仍然工作。
    expect(ratesForModel('deepseek/deepseek-reasoner')).toEqual({ inputPerM: 2.016, outputPerM: 3.024, cachePerM: 0.2016, cacheWritePerM: 2.016 })
  })
})

describe('ratesForModel (DeepSeek official model ids)', () => {
  it('prices deepseek-flash (DeepSeek-V4.1-Flash) at the official peak rates', () => {
    // 高峰：缓存未命中 2 / 输出 8 / 缓存命中 0.04，缓存写入按输入价。
    expect(ratesForModel('deepseek-flash')).toEqual({ inputPerM: 2, outputPerM: 8, cachePerM: 0.04, cacheWritePerM: 2 })
    expect(ratesForModel('deepseek-flash')).toBe(DEEPSEEK_FLASH_RATES)
  })

  it('prices deepseek-v4-pro (DeepSeek-V4-Pro-0813) at the official peak rates', () => {
    // 高峰：缓存未命中 9 / 输出 27 / 缓存命中 0.3。
    expect(ratesForModel('deepseek-v4-pro')).toEqual({ inputPerM: 9, outputPerM: 27, cachePerM: 0.3, cacheWritePerM: 9 })
    expect(ratesForModel('deepseek-v4-pro')).toBe(DEEPSEEK_RATES)
  })

  it('lets the official table win over the snapshot row for the same model', () => {
    // 快照里的 deepseek/deepseek-v4-pro 仍是转售商旧价（3.132/6.264），必须让位官方价；
    // 带 provider 前缀与大小写变体都归一到同一个官方条目。
    expect(ratesForModel('deepseek/deepseek-v4-pro')).toBe(DEEPSEEK_RATES)
    expect(ratesForModel('tencent/deepseek-v4-pro')).toBe(DEEPSEEK_RATES)
    expect(ratesForModel('deepseek-official/deepseek-flash')).toBe(DEEPSEEK_FLASH_RATES)
    expect(ratesForModel('DeepSeek-Flash')).toBe(DEEPSEEK_FLASH_RATES)
  })

  it('covers exactly the official ids the DSH deepseek-official catalog sends verbatim', () => {
    // flash 家族（deepseek-flash 与模型目录里的旧 id v4-flash / vision-exp）同价，
    // pro 单独一档。
    expect(Object.keys(DEEPSEEK_OFFICIAL_RATES).sort()).toEqual([
      'deepseek-flash',
      'deepseek-v4-flash',
      'deepseek-v4-flash-vision-exp',
      'deepseek-v4-pro',
    ])
  })

  it('prices the legacy v4-flash ids at the official flash peak rates, not the stale override', () => {
    // 用户级覆盖里的旧价 3/9/0.1 与官方账单矛盾（见 cost.ts 注释），必须让位官方价。
    expect(ratesForModel('deepseek-v4-flash')).toEqual({ inputPerM: 2, outputPerM: 8, cachePerM: 0.04, cacheWritePerM: 2 })
    expect(ratesForModel('deepseek-v4-flash-vision-exp')).toBe(DEEPSEEK_FLASH_RATES)
  })
})

describe('ratesForModel (version-suffix stripping, M3)', () => {
  it('strips date suffixes to find the bare model alias', () => {
    // 直接用快照里不存在的日期：剥掉 -2099-01-01 后命中 gpt-4o 别名。
    expect(ratesForModel('mycorp-relay/gpt-4o-2099-01-01')).toEqual(GPT4O_RATES)
    // 8 位紧凑日期同样剥离。
    expect(ratesForModel('mycorp-relay/gpt-4o-20990101')).toEqual(GPT4O_RATES)
  })

  it('prefers an existing dated alias over stripping', () => {
    expect(ratesForModel('gpt-4o-2024-11-20').inputPerM).toBe(18)
  })
})

describe('ratesForModel (fallbacks)', () => {
  it('keeps the official DeepSeek keyword fallback for DeepSeek models missing from the table', () => {
    expect(ratesForModel('deepseek-flash-zz9')).toBe(DEEPSEEK_FLASH_RATES)
    expect(ratesForModel('deepseek-reasoner-zz9').inputPerM).toBe(DEEPSEEK_REASONER_RATES.inputPerM)
    // 带 provider 前缀的同族名同样吃关键词兜底（快照里查不到该条目时）。
    expect(ratesForModel('mycorp/deepseek-reasoner-zz9').inputPerM).toBe(DEEPSEEK_REASONER_RATES.inputPerM)
    // -r1 规则按 deepseek 命名空间锚定（M1 的正则修正）。
    expect(ratesForModel('deepseek-r1-x9').inputPerM).toBe(DEEPSEEK_REASONER_RATES.inputPerM)
  })

  it('does NOT apply DeepSeek prices outside the DeepSeek namespace (M1)', () => {
    // 快照里查不到、名字带 reasoner/flash 的非 DeepSeek 模型必须走通用档。
    expect(ratesForModel('glm-5-reasoner').inputPerM).not.toBe(DEEPSEEK_REASONER_RATES.inputPerM)
    expect(ratesForModel('x/o1-r1').inputPerM).not.toBe(DEEPSEEK_REASONER_RATES.inputPerM)
    expect(ratesForModel('openrouter/some-flash-model')).toEqual(GENERIC_RATES)
  })

  it('falls back to the generic rate for unknown models', () => {
    expect(ratesForModel('acme/x-9000-turbo')).toEqual(GENERIC_RATES)
  })
})

describe('estimateCost', () => {
  it('computes 1M uncached input at the flash peak rate = 2 yuan', () => {
    expect(estimateCost('any-model', 1_000_000, 0, 0, 0, DEEPSEEK_FLASH_RATES)).toBe(2)
  })

  it('computes flash output and cache portions (output 8/M, cache 0.04/M)', () => {
    // 1M input(2) + 1M output(8) + 1M cache(0.04) = 10.04
    expect(estimateCost('any-model', 1_000_000, 1_000_000, 1_000_000, 0, DEEPSEEK_FLASH_RATES)).toBe(10.04)
  })

  it('bills cache writes at the cacheWritePerM rate (M2)', () => {
    // flash 写=读：1M cache write at 2/M = 2 yuan
    expect(estimateCost('any-model', 0, 0, 0, 1_000_000, DEEPSEEK_FLASH_RATES)).toBe(2)
    // Anthropic：快照 w 12.5 USD/M * 7.2 = 90? 用显式 rates 验证一点：
    // input 0 / write 1M at cacheWritePerM 32.4 = 32.4
    expect(estimateCost('any-model', 0, 0, 0, 1_000_000, { inputPerM: 25.92, outputPerM: 129.6, cachePerM: 2.592, cacheWritePerM: 32.4 })).toBe(32.4)
    // 写+读分开计：4M 输入 + 2M 写，input 25.92/M、write 32.4/M
    const cost = estimateCost('any-model', 4_000_000, 0, 0, 2_000_000, { inputPerM: 25.92, outputPerM: 129.6, cachePerM: 2.592, cacheWritePerM: 32.4 })
    expect(cost).toBeCloseTo(4 * 25.92 + 2 * 32.4, 6)
  })

  it('uses the snapshot cache-write rate for Anthropic rows (w field)', () => {
    // bedrock/anthropic.claude-3-5-sonnet-20240620-v1:0 的 w=32.4（输入 25.92）。
    const cost = estimateCost('bedrock/anthropic.claude-3-5-sonnet-20240620-v1:0', 0, 0, 0, 1_000_000)
    expect(cost).toBe(32.4)
  })

  it('handles fractional token counts', () => {
    expect(estimateCost('any-model', 250_000, 0, 0, 0, DEEPSEEK_FLASH_RATES)).toBe(0.5)
  })

  it('returns the exact value without intermediate rounding (M4)', () => {
    expect(estimateCost('any-model', 12345, 0, 0, 0, DEEPSEEK_FLASH_RATES)).toBe(12345 * 2 / 1_000_000)
    expect(estimateCost('any-model', 3, 7, 0, 0, DEEPSEEK_FLASH_RATES)).toBe(3 * 2 / 1_000_000 + 7 * 8 / 1_000_000)
  })

  it('uses table rates for snapshot-backed models (gpt-4o: 18/72/9/18)', () => {
    // 1M input(18) + 1M output(72) + 1M cache(9) = 99
    expect(estimateCost('gpt-4o', 1_000_000, 1_000_000, 1_000_000)).toBe(99)
  })
})