/**
 * dsh-usage-dashboard 费用估算。
 *
 * 单价来源：DeepSeek 官方价目表常量 + LiteLLM 全量价目快照（`pricing.ts`
 * 加载，元 / 每百万 token，已按快照内汇率换算）。匹配顺序：
 *  0. DeepSeek 官方模型 id 命中官方价（`DEEPSEEK_OFFICIAL_RATES`，高峰价）
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

/**
 * DeepSeek 官方定价（元/百万 token，来源 api-docs.deepseek.com 官方价目表）。
 *
 * 官方表按空闲时段 / 高峰时段两档报价；看板按累计 token 记账、无法区分时段，
 * 因此新模型一律取**高峰时段**价（保守上界，只高估不低估）。缓存写入价等于
 * 普通输入价（与 DeepSeek 计价口径一致）。
 */
/** deepseek-flash（DeepSeek-V4.1-Flash）高峰：缓存命中 0.04 / 缓存未命中 2 / 输出 8。 */
export const DEEPSEEK_FLASH_RATES: CostRates = { inputPerM: 2, outputPerM: 8, cachePerM: 0.04, cacheWritePerM: 2 }
/** deepseek-v4-pro（DeepSeek-V4-Pro-0813）高峰：缓存命中 0.3 / 缓存未命中 9 / 输出 27。 */
export const DEEPSEEK_RATES: CostRates = { inputPerM: 9, outputPerM: 27, cachePerM: 0.3, cacheWritePerM: 9 }
/** 旧 deepseek-chat / reasoner 定价参考（2025，元/百万 token）。 */
export const DEEPSEEK_LEGACY_RATES: CostRates = { inputPerM: 2, outputPerM: 8, cachePerM: 0.5, cacheWritePerM: 2 }
export const DEEPSEEK_REASONER_RATES: CostRates = { inputPerM: 4, outputPerM: 16, cachePerM: 1, cacheWritePerM: 4 }
/** 未知模型回退通用档。 */
export const GENERIC_RATES: CostRates = { inputPerM: 1, outputPerM: 2, cachePerM: 0.02, cacheWritePerM: 1 }

/**
 * DeepSeek 官方模型 id -> 官方价，优先于 LiteLLM 快照。
 *
 * 键是 DSH `deepseek-official` provider 目录里直接透传给官方 API 的模型名。
 * 快照里同名条目的价来自转售或聚合 provider（如 tencent/deepseek-v4-pro
 * 仍是旧价），且会随每次刷新整体变动，所以官方价必须在快照之前命中。
 *
 * flash 家族（`deepseek-flash`，以及模型目录里的旧 id `deepseek-v4-flash` /
 * `deepseek-v4-flash-vision-exp`）统一按官方价目表的 flash 档计价：用户账号
 * 账单可以反证 —— 某日 v4-flash 用量若按旧覆盖价 3/9/0.1 折算，仅这一个模型
 * 就超过官方当日全额，说明官方对这批 id 收的就是 flash 档价。未列入的
 * DeepSeek 模型仍走关键词兜底。
 */
export const DEEPSEEK_OFFICIAL_RATES: Record<string, CostRates> = {
  'deepseek-flash': DEEPSEEK_FLASH_RATES,
  'deepseek-v4-flash': DEEPSEEK_FLASH_RATES,
  'deepseek-v4-flash-vision-exp': DEEPSEEK_FLASH_RATES,
  'deepseek-v4-pro': DEEPSEEK_RATES,
}

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
  // 0. DeepSeek 官方模型 id（可带 provider 前缀）：官方价目表优先于快照，
  //    避免被转售商的旧价或一次刷新后的快照变动带偏。
  const bare = m.includes('/') ? m.split('/').pop() ?? m : m
  const official = DEEPSEEK_OFFICIAL_RATES[bare]
  if (official !== undefined) return official
  const { snapshot } = loadPricing()
  // 1. provider/model 精确匹配。
  const direct = snapshot.models[m]
  if (direct !== undefined) return entryToRates(direct)
  // 2. 裸名 / 剥离未知 provider 后走唯一别名。
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