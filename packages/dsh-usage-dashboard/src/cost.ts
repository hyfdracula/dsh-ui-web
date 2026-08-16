/**
 * dsh-usage-dashboard 费用估算。
 *
 * 单价来源：LiteLLM 全量价目快照（`pricing.ts` 加载，元 / 每百万 token，
 * 已按快照内汇率换算）。匹配顺序：
 *  1. `provider/model` 精确匹配（大小写不敏感）
 *  2. 裸模型名走唯一别名表（如 `gpt-4o` -> `openai/gpt-4o`）
 *  3. 带未知 provider 前缀时退到裸名别名（如 `openrouter/deepseek-chat`）
 *  4. DeepSeek 家族关键词兜底（快照缺失时保住官方价）
 *  5. 通用档
 * 估算仅用于看板展示，非计费依据。
 * @module @captain1275/dsh-usage-dashboard/cost
 */
import { loadPricing } from './pricing.ts'

/** 单模型单价（元 / 每百万 token）。 */
export interface CostRates {
  /** 未命中缓存的输入。 */
  inputPerM: number
  /** 输出。 */
  outputPerM: number
  /** 缓存命中输入。 */
  cachePerM: number
}

/** DeepSeek 官方定价（2026-08，元/百万 token，来源 api-docs.deepseek.com/quick_start/pricing）。 */
/** deepseek-v4-flash：缓存命中 0.02 / 缓存未命中 1 / 输出 2。 */
export const DEEPSEEK_FLASH_RATES: CostRates = { inputPerM: 1, outputPerM: 2, cachePerM: 0.02 }
/** deepseek-v4-pro：缓存命中 0.025 / 缓存未命中 3 / 输出 6。 */
export const DEEPSEEK_RATES: CostRates = { inputPerM: 3, outputPerM: 6, cachePerM: 0.025 }
/** 旧 deepseek-chat / reasoner 定价参考（2025，元/百万 token）。 */
export const DEEPSEEK_LEGACY_RATES: CostRates = { inputPerM: 2, outputPerM: 8, cachePerM: 0.5 }
export const DEEPSEEK_REASONER_RATES: CostRates = { inputPerM: 4, outputPerM: 16, cachePerM: 1 }
/** 未知模型回退通用档。 */
export const GENERIC_RATES: CostRates = { inputPerM: 1, outputPerM: 2, cachePerM: 0.02 }

/** 快照条目转 CostRates（缺 input/output 时回退通用档对应字段）。 */
function entryToRates(entry: { i?: number; o?: number; c?: number }): CostRates {
  return {
    inputPerM: entry.i ?? GENERIC_RATES.inputPerM,
    outputPerM: entry.o ?? GENERIC_RATES.outputPerM,
    cachePerM: entry.c ?? GENERIC_RATES.cachePerM,
  }
}

/** DeepSeek 家族关键词兜底（快照里没有对应条目时才走到这里）。 */
function deepseekKeywordRates(m: string): CostRates | null {
  if (m.includes('flash')) return DEEPSEEK_FLASH_RATES
  if (m.includes('reasoner') || m.includes('/r1') || m.includes('-r1')) return DEEPSEEK_REASONER_RATES
  if (m.includes('v4-pro')) return DEEPSEEK_RATES
  if (m.includes('deepseek')) return DEEPSEEK_LEGACY_RATES
  return null
}

/**
 * 按模型名取单价。
 * @param model - 模型标识（如 deepseek/deepseek-chat 或 gpt-4o）。
 * @returns 单价。
 */
export function ratesForModel(model: string): CostRates {
  const m = model.trim().toLowerCase()
  const { snapshot } = loadPricing()
  // 1. provider/model 精确匹配。
  const direct = snapshot.models[m]
  if (direct !== undefined) return entryToRates(direct)
  // 2. 裸名 / 剥离未知 provider 后走唯一别名。
  const bare = m.includes('/') ? m.split('/').pop() ?? m : m
  const aliasTarget = snapshot.aliases[bare]
  if (aliasTarget !== undefined) {
    const viaAlias = snapshot.models[aliasTarget]
    if (viaAlias !== undefined) return entryToRates(viaAlias)
  }
  // 3. DeepSeek 家族关键词兜底（官方价常量）。
  const keyword = deepseekKeywordRates(m)
  if (keyword !== null) return keyword
  // 4. 通用档。
  return GENERIC_RATES
}

/**
 * 估算一次用量的费用（元）。
 * @param model - 模型标识。
 * @param inputTokens - 输入 token（不含缓存）。
 * @param outputTokens - 输出 token。
 * @param cacheReadTokens - 缓存命中 token。
 * @param cacheWriteTokens - 缓存写入 token（按普通输入价计费）。
 * @param rates - 可选单价覆盖（测试用）。
 * @returns 估算费用（元，保留 4 位）。
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens = 0,
  rates: CostRates = ratesForModel(model),
): number {
  // 缓存写入按普通输入价计（DeepSeek/Kimi 均如此），不再漏计。
  const input = (inputTokens + cacheWriteTokens) / 1_000_000 * rates.inputPerM
  const output = outputTokens / 1_000_000 * rates.outputPerM
  const cache = cacheReadTokens / 1_000_000 * rates.cachePerM
  return Math.round((input + output + cache) * 10_000) / 10_000
}
