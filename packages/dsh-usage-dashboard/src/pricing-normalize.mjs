/**
 * LiteLLM 价目归一化（宿主刷新路由与 scripts/refresh-pricing.mjs 共用）。
 *
 * 输入：LiteLLM `model_prices_and_context_window.json` 的原始文本。
 * 输出：紧凑快照 —— canonical key 为 `provider/model`（小写），费率为
 * 元 / 百万 token（由 USD/token 乘 1e6 再乘汇率 fx 换算），另附唯一时
 * 才生成的裸模型名别名表。
 *
 * 保持纯 ESM、零依赖：CLI 直接 import，宿主经 tsdown 打包内联。
 * @module @captain1275/dsh-usage-dashboard/pricing-normalize
 */

/** LiteLLM 价目源（按可达性排序，逐一尝试）。 */
export const LITELLM_PRICING_URLS = [
  'https://cdn.jsdelivr.net/gh/BerriAI/litellm@main/model_prices_and_context_window.json',
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json',
]

/** 默认 USD -> CNY 汇率（换算进快照，展示层不再处理币种）。 */
export const DEFAULT_FX = 7.2

/** 元/百万 token 的合理性区间：越出区间的字段视为脏数据跳过（P5）。 */
const PRICE_MIN_CNY_PER_M = 0.0001
const PRICE_MAX_CNY_PER_M = 5000

/** 四舍五入到 4 位小数。 */
function round4(value) {
  return Math.round(value * 10_000) / 10_000
}

/** 单模型换算：USD/token -> 元/百万 token。 */
function toCnyPerMillion(usdPerToken, fx) {
  return round4(usdPerToken * 1_000_000 * fx)
}

/** 换算后若超出合理区间返回 null（调用方跳过该字段，防个别条目单位写错爆表）。 */
function toCnyPerMillionClamped(usdPerToken, fx) {
  const value = toCnyPerMillion(usdPerToken, fx)
  if (value >= PRICE_MIN_CNY_PER_M && value <= PRICE_MAX_CNY_PER_M) return value
  return null
}

/** 一手官方 provider：别名冲突时优先（rank 0）。 */
const FIRST_PARTY_PROVIDERS = new Set([
  'openai', 'anthropic', 'deepseek', 'gemini', 'moonshot', 'xai', 'mistral',
  'cohere', 'zai', 'dashscope', 'volcengine', 'tencent', 'minimax', 'meta_llama',
  'ai21', 'amazon_nova', 'perplexity', 'palm', 'stability', 'black_forest_labs',
  'recraft', 'elevenlabs', 'deepgram', 'assemblyai', 'jina_ai', 'voyage',
  'fal_ai', 'runwayml', 'morph',
])

/** 聚合/转售 provider：别名冲突时排在一手之后（rank 1）。 */
const AGGREGATOR_PROVIDERS = new Set([
  'azure', 'azure_ai', 'azure_text', 'openrouter', 'sagemaker', 'github',
  'github_copilot', 'together_ai', 'huggingface', 'anyscale', 'deepinfra',
  'replicate', 'cloudflare', 'novita', 'featherless_ai', 'lambda_ai', 'nebius',
  'nscale', 'wandb', 'friendliai', 'galadriel', 'ollama', 'ollama_chat', 'vllm',
  'hosted_vllm', 'lm_studio', 'lemonade', 'baseten', 'modal', 'predibase',
  'runpod', 'infinity', 'fireworks_ai', 'groq', 'cerebras', 'sambanova', 'gmi',
  'crusoe', 'hyperbolic', 'nlp_cloud', 'publicai', 'oci', 'snowflake',
  'databricks', 'aiml', 'apiserpent', 'scaleway', 'ovhcloud', 'heroku',
  'vercel_ai_gateway', 'llamagate', 'libertai', 'gradient_ai', 'watsonx',
  'tensormesh', 'pinstripes', 'darkbloom', 'exa_ai', 'linkup', 'serper',
  'searxng', 'tavily', 'you_com', 'firecrawl', 'tinyfish', 'duckduckgo',
  'dataforseo', 'parallel_ai', 'google_pse', 'soniox', 'sarvam', 'v0',
  'inception', 'reducto', 'chatgpt',
])

/** 聚合商内部的可靠性顺序（无一手候选时按此挑，未列出的排最后）。 */
const PREFERRED_AGGREGATOR_ORDER = [
  'openrouter', 'together_ai', 'fireworks_ai', 'deepinfra', 'groq', 'cerebras',
  'sambanova', 'novita', 'nebius', 'baseten', 'cloudflare', 'replicate',
]

/** provider 偏好分：一手 0，聚合 1，其余（含脏数据）2。 */
function providerRank(provider) {
  if (FIRST_PARTY_PROVIDERS.has(provider)) return 0
  if (AGGREGATOR_PROVIDERS.has(provider)) return 1
  if (provider.startsWith('vertex_ai') || provider.startsWith('bedrock')) return 1
  if (provider.startsWith('text-completion-')) return 1
  return 2
}

/** 同档内的次序：聚合档按可靠顺序，其余按 provider 名长度升序。 */
function providerTieBreak(a, b) {
  const pa = a.split('/')[0]
  const pb = b.split('/')[0]
  const ia = PREFERRED_AGGREGATOR_ORDER.indexOf(pa)
  const ib = PREFERRED_AGGREGATOR_ORDER.indexOf(pb)
  if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  if (pa.length !== pb.length) return pa.length - pb.length
  return a < b ? -1 : 1
}

/** 取 key 的最后一段作为裸模型名（openrouter/openai/gpt-4o -> gpt-4o）。 */
function bareName(key) {
  const parts = key.split('/')
  return parts[parts.length - 1].toLowerCase()
}

/**
 * 归一化 LiteLLM 价目文本。
 * @param {string} rawText - 原始 JSON 文本。
 * @param {number} [fx] - USD -> CNY 汇率。
 * @returns {{ snapshot: object, stats: object }} 快照与统计。
 */
export function normalizeLiteLLM(rawText, fx = DEFAULT_FX) {
  const data = JSON.parse(rawText)
  const models = {}
  const aliasCandidates = new Map()
  let skipped = 0
  let outOfRange = 0
  for (const [key, value] of Object.entries(data)) {
    if (key === 'sample_spec' || typeof value !== 'object' || value === null) continue
    const provider = typeof value.litellm_provider === 'string' ? value.litellm_provider.toLowerCase() : ''
    if (provider === '') {
      skipped += 1
      continue
    }
    const inputUsd = value.input_cost_per_token
    const outputUsd = value.output_cost_per_token
    if (typeof inputUsd !== 'number' && typeof outputUsd !== 'number') {
      skipped += 1
      continue
    }
    const bare = bareName(key)
    const canonical = `${provider}/${bare}`
    const entry = {}
    let fieldSkips = 0
    for (const [field, usd] of [
      ['i', inputUsd],
      ['o', outputUsd],
      ['c', value.cache_read_input_token_cost],
      ['w', value.cache_creation_input_token_cost],
    ]) {
      if (typeof usd !== 'number' || !Number.isFinite(usd) || usd <= 0) continue
      const cny = toCnyPerMillionClamped(usd, fx)
      if (cny === null) {
        fieldSkips += 1
        continue
      }
      entry[field] = cny
    }
    if (Object.keys(entry).length === 0) {
      skipped += 1
      continue
    }
    outOfRange += fieldSkips
    // 同名不同大小写的条目后者覆盖（与 JSON.parse 的重复键语义一致）。
    models[canonical] = entry
    if (!aliasCandidates.has(bare)) aliasCandidates.set(bare, new Set())
    aliasCandidates.get(bare).add(canonical)
  }
  // 裸名别名：唯一时直接用；冲突时挑偏好最高的 provider（一手优先于聚合，
  // 同档按 provider 名字长度升序、再按 canonical 字典序），保证确定性。
  // 撞车的裸名记进 `_ambiguous`，cost.ts 命中此类别名且条目不完整时跳过
  // 别名（P6），避免给错误模型套用通用补位价。
  const aliases = {}
  const ambiguousNames = []
  let aliasConflicts = 0
  for (const [bare, candidates] of aliasCandidates) {
    if (candidates.size > 1) {
      aliasConflicts += 1
      ambiguousNames.push(bare)
    }
    const ranked = [...candidates].sort((a, b) => {
      const rankDiff = providerRank(a.split('/')[0]) - providerRank(b.split('/')[0])
      if (rankDiff !== 0) return rankDiff
      return providerTieBreak(a, b)
    })
    aliases[bare] = ranked[0]
  }
  const providers = new Set(Object.keys(models).map((key) => key.split('/')[0]))
  const snapshot = {
    _source: 'litellm',
    _unit: 'CNY per 1M tokens',
    _fx: fx,
    _fetchedAt: new Date().toISOString(),
    models,
    aliases,
    ...(ambiguousNames.length > 0 ? { _ambiguous: ambiguousNames } : {}),
  }
  return {
    snapshot,
    stats: {
      providers: providers.size,
      models: Object.keys(models).length,
      aliases: Object.keys(aliases).length,
      aliasConflicts,
      skipped,
      outOfRange,
    },
  }
}

/**
 * 刷新合并：LiteLLM 全量快照打底，把现有用户文件里"新快照没有的"条目
 * （自定义模型价，如 k3-256k / kimi-for-coding-highspeed）原样保留。
 * 否则一次 refresh 会把手工维护的条目全部冲掉、打回通用兜底价。
 * 新快照里已有的同名条目以官方最新价为准（自定义价想压过官方价，
 * 刷新后再改 usage-pricing.json 即可）。
 * 宿主路由与 scripts/refresh-pricing.mjs 共用，杜绝两端行为分叉（P1）。
 * @param {PricingSnapshot|null} existing - 现有用户级快照（缺失/损坏为 null）。
 * @param {PricingSnapshot} fresh - 刚归一化的新快照。
 * @returns {PricingSnapshot} 合并结果。
 */
export function mergeFreshSnapshot(existing, fresh) {
  if (existing === null) return fresh
  const existingModels = typeof existing.models === 'object' && existing.models !== null ? existing.models : {}
  const existingAliases = typeof existing.aliases === 'object' && existing.aliases !== null ? existing.aliases : {}
  const freshModels = typeof fresh.models === 'object' && fresh.models !== null ? fresh.models : {}
  const freshAliases = typeof fresh.aliases === 'object' && fresh.aliases !== null ? fresh.aliases : {}
  const customModels = {}
  for (const [key, value] of Object.entries(existingModels)) {
    if (!(key in freshModels)) customModels[key] = value
  }
  const customAliases = {}
  for (const [key, value] of Object.entries(existingAliases)) {
    if (!(key in freshAliases)) customAliases[key] = value
  }
  if (Object.keys(customModels).length === 0 && Object.keys(customAliases).length === 0) return fresh
  return {
    ...fresh,
    models: { ...freshModels, ...customModels },
    aliases: { ...freshAliases, ...customAliases },
  }
}

/**
 * 依次尝试各源拉取价目文本。
 * @param {typeof fetch} [fetchImpl] - fetch 实现（测试注入用）。
 * @returns {Promise<{ text: string, url: string }>} 首个成功源。
 */
export async function fetchLiteLLMPricing(fetchImpl = fetch) {
  let lastError
  for (const url of LITELLM_PRICING_URLS) {
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      if (text.length < 10_000) throw new Error('response too small')
      return { text, url }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
