/**
 * Tests for the locale helper (locales.ts): key lookup in the zh default and
 * single-pass placeholder replacement (X2).
 * @module @captain1275/dsh-usage-dashboard/client/locales
 */
import { describe, expect, it } from 'vitest'
import { t } from './locales.ts'

describe('locale t()', () => {
  it('resolves zh keys by default (node environment has no document)', () => {
    expect(t('usage.entry')).toBe('用量')
    expect(t('usage.retry')).toBe('重试')
    expect(t('usage.pricingFx')).toBe('固定汇率')
  })

  it('replaces placeholders in a single pass', () => {
    expect(t('usage.daysRecorded', { days: 3 })).toBe('3 天有记录')
  })

  it('does not re-scan parameter values for placeholders (X2)', () => {
    // 参数值里带占位符文本，也不会被第二轮替换改写。
    expect(t('usage.pricingCoverage', { providers: '{models}', models: 3 })).toBe('覆盖 {models} 个 provider / 3 个模型')
  })

  it('leaves unknown placeholders untouched', () => {
    expect(t('usage.daysRecorded', { missing: 1 })).toBe('{days} 天有记录')
  })
})