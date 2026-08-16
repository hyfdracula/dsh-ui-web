/** pricing-normalize.mjs 的类型声明。 */

export interface PricingEntry {
  /** 未命中缓存的输入（元/百万 token）。 */
  i?: number
  /** 输出（元/百万 token）。 */
  o?: number
  /** 缓存命中输入（元/百万 token）。 */
  c?: number
  /** 缓存创建输入（元/百万 token）。 */
  w?: number
}

export interface PricingSnapshot {
  _source: string
  _unit: string
  _fx: number
  _fetchedAt: string
  /** 覆盖层可能自带来源 URL。 */
  _url?: string
  models: Record<string, PricingEntry>
  aliases: Record<string, string>
}

export interface NormalizeStats {
  providers: number
  models: number
  aliases: number
  aliasConflicts: number
  skipped: number
}

export declare const LITELLM_PRICING_URLS: string[]
export declare const DEFAULT_FX: number
export declare function normalizeLiteLLM(rawText: string, fx?: number): { snapshot: PricingSnapshot; stats: NormalizeStats }
export declare function fetchLiteLLMPricing(fetchImpl?: typeof fetch): Promise<{ text: string; url: string }>
