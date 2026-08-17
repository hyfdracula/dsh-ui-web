/**
 * dsh-usage-dashboard 费用估算。
 *
 * 单价来源：LiteLLM 全量价目快照（`pricing.ts` 加载，元 / 每百万 token，
 * 已按快照内汇率换算）。匹配顺序：
 *  1. `provider/model` 精确匹配（大小写不敏感）
 *  2. 裸模型名走唯一别名表（如 `gpt-4o` -> `openai/gpt-4o`）
 *  3. 别名 miss：剥日期/版本后缀逐级尝试（如 `gpt-4o-2024-11-20` -> `gpt-4o`）
 *  4. DeepSeek 家族关键词兜底（限 DeepSeek 命名空间，快照缺失时保住官方价）
 *  5. 通用档
 * 估算返回精确值（不做中间舍入），由宿主 summary / 面板在展示层做最后舍入（M4）。
 * 估算仅用于看板展示，非计费依据。
 * @module @captain1275/dsh-usage-dashboard/cost
 */
import { loadPricing } from './pricing.ts'
import type { PricingEntry, PricingSnapshot } from './pricing-normalize.d.mts'

/** 单模型单价（元 / 每百万 token）。 */
export interface CostRates {
  /** 未命中缓存的输入。 */
  inputPerM: number
  /** 输出。 */
  outputPerM: number
  /** 缓存命中输入。 */
  cachePerM: number
  /** 缓存写入（cache creation）单价（元/百万 token）。 */
  cacheWritePerM: number
}

/** DeepSeek 官方定价（2026-08，元/百万 token，来源 api-docs.deepseek.com/quick_start/pricing）。 */
/** deepseek-v4-flash：缓存命中 0.02 / 缓存未命中 1 / 输出 2，缓存写入按输入价。 */
export const DEEPSEEK_FLASH_RATES: CostRates = { inputPerM: 1, outputPerM: 2, cachePerM: 0.02, cacheWritePerM: 1 }
/** deepseek-v4-pro：缓存命中 0.025 / 缓存未命中 3 / 输出 6。 */
export const DEEPSEEK_RATES: CostRates = { inputPerM: 3, outputPerM: 6, cachePerM: 0.025, cacheWritePerM: 3 }
/** 旧 deepseek-chat / reasoner 定价参考（2025，元/百万 token）。 */
export const DEEPSEEK_LEGACY_RATES: CostRates = { inputPerM: 2, outputPerM: 8, cachePerM: 0.5, cacheWritePerM: 2 }
export const DEEPSEEK_REASONER_RATES: CostRates = { inputPerM: 4, outputPerM: 16, cachePerM: 1, cacheWritePerM: 4 }
/** 未知模型回退通用档。 */
export const GENERIC_RATES: CostRates = { inputPerM: 1, outputPerM: 2, cachePerM: 0.02, cacheWritePerM: 1 }

/**
 * 快照条目转 CostRates（缺 input/output 时回退通用档对应字段）。
 * 缓存写入优先用快照 `w`（Anthropic 等缓存写入远高于输入价）；
 * 缺省回退输入价 —— DeepSeek/Kimi 的缓存写入价等于普通输入价。
 */
function entryToRates(entry: { i?: number; o?: number; c?: number; w?: number }): CostRates {
  return {
    inputPerM: entry.i ?? GENERIC_RATES.inputPerM,
    outputPerM: entry.o ?? GENERIC_RATES.outputPerM,
    cachePerM: entry.c ?? GENERIC_RATES.cachePerM,
    cacheWritePerM: entry.w ?? entry.i ?? GENERIC_RATES.inputPerM,
  }
}

/** 标识是否属于 DeepSeek 命名空间（关键词兜底的前置条件，M1）。 */
function isDeepseekNamespace(m: string): boolean {
  return m.startsWith('deepseek') || m.includes('/deepseek') || m.includes('deepseek-')
}

/**
 * DeepSeek 家族关键词兜底（快照里没有对应条目时才走到这里）。
 * 先要求标识属于 DeepSeek 命名空间：`glm-5-reasoner` 之类非 DeepSeek 模型
 * 不会被套上 DeepSeek 官方价。`-r1` 规则用正则锚定 deepseek 命名空间，
 * 不再做裸子串匹配（M1）。
 */
function deepseekKeywordRates(m: string): CostRates | null {
  if (!isDeepseekNamespace(m)) return null
  if (m.includes('flash')) return DEEPSEEK_FLASH_RATES
  if (m.includes('reasoner') || /(^|\/)deepseek.*r1/.test(m)) return DEEPSEEK_REASONER_RATES
  if (m.includes('v4-pro')) return DEEPSEEK_RATES
  return DEEPSEEK_LEGACY_RATES
}

/** 剥掉常见的日期/版本后缀：gpt-4o-2024-11-20 -> gpt-4o（M3）。 */
function stripVersionSuffix(name: string): string {
  return name.replace(/-20\d{2}(?:-\d{1,2}(?:-\d{1,2})?|\d{4})?$/, '')
}

/**
 * 别名解析：命中唯一别名的目标条目才返回。
 * 裸名撞车（P6，snapshot._ambiguous）的别名目标条目不完整（缺 i/o）时不返回，
 * 让调用方继续走关键词/通用档兜底，避免给错误模型套用通用补位价。
 */
function resolveAlias(snapshot: PricingSnapshot, bare: string): PricingEntry | undefined {
  const target = snapshot.aliases[bare]
  if (target === undefined) return undefined
  const entry = snapshot.models[target]
  if (entry === undefined) return undefined
  const ambiguous = Array.isArray(snapshot._ambiguous) && snapshot._ambiguous.includes(bare)
  const complete = entry.i !== undefined || entry.o !== undefined
  if (ambiguous && !complete) return undefined
  return entry
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
  const viaAlias = resolveAlias(snapshot, bare)
  if (viaAlias !== undefined) return entryToRates(viaAlias)
  // 3. 别名 miss：剥日期/版本后缀逐级尝试（中继/带版本后缀的部署名，
  //    如 mycorp-relay/gpt-4o-2024-11-20 -> gpt-4o，M3）。
  let stripped = bare
  for (let i = 0; i < 3; i++) {
    const next = stripVersionSuffix(stripped)
    if (next === stripped) break
    stripped = next
    const viaStripped = resolveAlias(snapshot, stripped)
    if (viaStripped !== undefined) return entryToRates(viaStripped)
  }
  // 4. DeepSeek 家族关键词兜底（官方价常量，限 DeepSeek 命名空间）。
  const keyword = deepseekKeywordRates(m)
  if (keyword !== null) return keyword
  // 5. 通用档。
  return GENERIC_RATES
}

/**
 * 估算一次用量的费用（元，精确值；展示层负责最后舍入）。
 * @param model - 模型标识。
 * @param inputTokens - 输入 token（不含缓存）。
 * @param outputTokens - 输出 token。
 * @param cacheReadTokens - 缓存命中 token。
 * @param cacheWriteTokens - 缓存写入 token（按 cacheWritePerM 计费，M2）。
 * @param rates - 可选单价覆盖（测试用）。
 * @returns 估算费用（元）。
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheWriteTokens = 0,
  rates: CostRates = ratesForModel(model),
): number {
  const input = inputTokens / 1_000_000 * rates.inputPerM
  const output = outputTokens / 1_000_000 * rates.outputPerM
  const cache = cacheReadTokens / 1_000_000 * rates.cachePerM
  const cacheWrite = cacheWriteTokens / 1_000_000 * rates.cacheWritePerM
  return input + output + cache + cacheWrite
}