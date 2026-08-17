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
  /** 裸名撞车（多 provider 同一裸名）的清单；cost.ts 命中此类别名且条目不完整时跳过（P6）。 */
  _ambiguous?: string[]
  models: Record<string, PricingEntry>
  aliases: Record<string, string>
}

export interface NormalizeStats {
  providers: number
  models: number
  aliases: number
  aliasConflicts: number
  skipped: number
  /** 数值越出合理区间而被跳过的字段数（P5 钳制）。 */
  outOfRange: number
}

export declare const LITELLM_PRICING_URLS: string[]
export declare const DEFAULT_FX: number
export declare function normalizeLiteLLM(rawText: string, fx?: number): { snapshot: PricingSnapshot; stats: NormalizeStats }
export declare function fetchLiteLLMPricing(fetchImpl?: typeof fetch): Promise<{ text: string; url: string }>
export declare function mergeFreshSnapshot(existing: PricingSnapshot | null, fresh: PricingSnapshot): PricingSnapshot
