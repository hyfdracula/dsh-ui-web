import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
//#region src/pricing-normalize.mjs
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
const LITELLM_PRICING_URLS = ["https://cdn.jsdelivr.net/gh/BerriAI/litellm@main/model_prices_and_context_window.json", "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"];
/** 默认 USD -> CNY 汇率（换算进快照，展示层不再处理币种）。 */
const DEFAULT_FX = 7.2;
/** 元/百万 token 的合理性区间：越出区间的字段视为脏数据跳过（P5）。 */
const PRICE_MIN_CNY_PER_M = 1e-4;
const PRICE_MAX_CNY_PER_M = 5e3;
/** 四舍五入到 4 位小数。 */
function round4(value) {
	return Math.round(value * 1e4) / 1e4;
}
/** 单模型换算：USD/token -> 元/百万 token。 */
function toCnyPerMillion(usdPerToken, fx) {
	return round4(usdPerToken * 1e6 * fx);
}
/** 换算后若超出合理区间返回 null（调用方跳过该字段，防个别条目单位写错爆表）。 */
function toCnyPerMillionClamped(usdPerToken, fx) {
	const value = toCnyPerMillion(usdPerToken, fx);
	if (value >= PRICE_MIN_CNY_PER_M && value <= PRICE_MAX_CNY_PER_M) return value;
	return null;
}
/** 一手官方 provider：别名冲突时优先（rank 0）。 */
const FIRST_PARTY_PROVIDERS = /* @__PURE__ */ new Set([
	"openai",
	"anthropic",
	"deepseek",
	"gemini",
	"moonshot",
	"xai",
	"mistral",
	"cohere",
	"zai",
	"dashscope",
	"volcengine",
	"tencent",
	"minimax",
	"meta_llama",
	"ai21",
	"amazon_nova",
	"perplexity",
	"palm",
	"stability",
	"black_forest_labs",
	"recraft",
	"elevenlabs",
	"deepgram",
	"assemblyai",
	"jina_ai",
	"voyage",
	"fal_ai",
	"runwayml",
	"morph"
]);
/** 聚合/转售 provider：别名冲突时排在一手之后（rank 1）。 */
const AGGREGATOR_PROVIDERS = /* @__PURE__ */ new Set([
	"azure",
	"azure_ai",
	"azure_text",
	"openrouter",
	"sagemaker",
	"github",
	"github_copilot",
	"together_ai",
	"huggingface",
	"anyscale",
	"deepinfra",
	"replicate",
	"cloudflare",
	"novita",
	"featherless_ai",
	"lambda_ai",
	"nebius",
	"nscale",
	"wandb",
	"friendliai",
	"galadriel",
	"ollama",
	"ollama_chat",
	"vllm",
	"hosted_vllm",
	"lm_studio",
	"lemonade",
	"baseten",
	"modal",
	"predibase",
	"runpod",
	"infinity",
	"fireworks_ai",
	"groq",
	"cerebras",
	"sambanova",
	"gmi",
	"crusoe",
	"hyperbolic",
	"nlp_cloud",
	"publicai",
	"oci",
	"snowflake",
	"databricks",
	"aiml",
	"apiserpent",
	"scaleway",
	"ovhcloud",
	"heroku",
	"vercel_ai_gateway",
	"llamagate",
	"libertai",
	"gradient_ai",
	"watsonx",
	"tensormesh",
	"pinstripes",
	"darkbloom",
	"exa_ai",
	"linkup",
	"serper",
	"searxng",
	"tavily",
	"you_com",
	"firecrawl",
	"tinyfish",
	"duckduckgo",
	"dataforseo",
	"parallel_ai",
	"google_pse",
	"soniox",
	"sarvam",
	"v0",
	"inception",
	"reducto",
	"chatgpt"
]);
/** 聚合商内部的可靠性顺序（无一手候选时按此挑，未列出的排最后）。 */
const PREFERRED_AGGREGATOR_ORDER = [
	"openrouter",
	"together_ai",
	"fireworks_ai",
	"deepinfra",
	"groq",
	"cerebras",
	"sambanova",
	"novita",
	"nebius",
	"baseten",
	"cloudflare",
	"replicate"
];
/** provider 偏好分：一手 0，聚合 1，其余（含脏数据）2。 */
function providerRank(provider) {
	if (FIRST_PARTY_PROVIDERS.has(provider)) return 0;
	if (AGGREGATOR_PROVIDERS.has(provider)) return 1;
	if (provider.startsWith("vertex_ai") || provider.startsWith("bedrock")) return 1;
	if (provider.startsWith("text-completion-")) return 1;
	return 2;
}
/** 同档内的次序：聚合档按可靠顺序，其余按 provider 名长度升序。 */
function providerTieBreak(a, b) {
	const pa = a.split("/")[0];
	const pb = b.split("/")[0];
	const ia = PREFERRED_AGGREGATOR_ORDER.indexOf(pa);
	const ib = PREFERRED_AGGREGATOR_ORDER.indexOf(pb);
	if (ia !== ib) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
	if (pa.length !== pb.length) return pa.length - pb.length;
	return a < b ? -1 : 1;
}
/** 取 key 的最后一段作为裸模型名（openrouter/openai/gpt-4o -> gpt-4o）。 */
function bareName(key) {
	const parts = key.split("/");
	return parts[parts.length - 1].toLowerCase();
}
/**
* 归一化 LiteLLM 价目文本。
* @param {string} rawText - 原始 JSON 文本。
* @param {number} [fx] - USD -> CNY 汇率。
* @returns {{ snapshot: object, stats: object }} 快照与统计。
*/
function normalizeLiteLLM(rawText, fx = DEFAULT_FX) {
	const data = JSON.parse(rawText);
	const models = {};
	const aliasCandidates = /* @__PURE__ */ new Map();
	let skipped = 0;
	let outOfRange = 0;
	for (const [key, value] of Object.entries(data)) {
		if (key === "sample_spec" || typeof value !== "object" || value === null) continue;
		const provider = typeof value.litellm_provider === "string" ? value.litellm_provider.toLowerCase() : "";
		if (provider === "") {
			skipped += 1;
			continue;
		}
		const inputUsd = value.input_cost_per_token;
		const outputUsd = value.output_cost_per_token;
		if (typeof inputUsd !== "number" && typeof outputUsd !== "number") {
			skipped += 1;
			continue;
		}
		const bare = bareName(key);
		const canonical = `${provider}/${bare}`;
		const entry = {};
		let fieldSkips = 0;
		for (const [field, usd] of [
			["i", inputUsd],
			["o", outputUsd],
			["c", value.cache_read_input_token_cost],
			["w", value.cache_creation_input_token_cost]
		]) {
			if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) continue;
			const cny = toCnyPerMillionClamped(usd, fx);
			if (cny === null) {
				fieldSkips += 1;
				continue;
			}
			entry[field] = cny;
		}
		if (Object.keys(entry).length === 0) {
			skipped += 1;
			continue;
		}
		outOfRange += fieldSkips;
		models[canonical] = entry;
		if (!aliasCandidates.has(bare)) aliasCandidates.set(bare, /* @__PURE__ */ new Set());
		aliasCandidates.get(bare).add(canonical);
	}
	const aliases = {};
	const ambiguousNames = [];
	let aliasConflicts = 0;
	for (const [bare, candidates] of aliasCandidates) {
		if (candidates.size > 1) {
			aliasConflicts += 1;
			ambiguousNames.push(bare);
		}
		aliases[bare] = [...candidates].sort((a, b) => {
			const rankDiff = providerRank(a.split("/")[0]) - providerRank(b.split("/")[0]);
			if (rankDiff !== 0) return rankDiff;
			return providerTieBreak(a, b);
		})[0];
	}
	const providers = new Set(Object.keys(models).map((key) => key.split("/")[0]));
	return {
		snapshot: {
			_source: "litellm",
			_unit: "CNY per 1M tokens",
			_fx: fx,
			_fetchedAt: (/* @__PURE__ */ new Date()).toISOString(),
			models,
			aliases,
			...ambiguousNames.length > 0 ? { _ambiguous: ambiguousNames } : {}
		},
		stats: {
			providers: providers.size,
			models: Object.keys(models).length,
			aliases: Object.keys(aliases).length,
			aliasConflicts,
			skipped,
			outOfRange
		}
	};
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
function mergeFreshSnapshot(existing, fresh) {
	if (existing === null) return fresh;
	const existingModels = typeof existing.models === "object" && existing.models !== null ? existing.models : {};
	const existingAliases = typeof existing.aliases === "object" && existing.aliases !== null ? existing.aliases : {};
	const freshModels = typeof fresh.models === "object" && fresh.models !== null ? fresh.models : {};
	const freshAliases = typeof fresh.aliases === "object" && fresh.aliases !== null ? fresh.aliases : {};
	const customModels = {};
	for (const [key, value] of Object.entries(existingModels)) if (!(key in freshModels)) customModels[key] = value;
	const customAliases = {};
	for (const [key, value] of Object.entries(existingAliases)) if (!(key in freshAliases)) customAliases[key] = value;
	if (Object.keys(customModels).length === 0 && Object.keys(customAliases).length === 0) return fresh;
	return {
		...fresh,
		models: {
			...freshModels,
			...customModels
		},
		aliases: {
			...freshAliases,
			...customAliases
		}
	};
}
/**
* 依次尝试各源拉取价目文本。
* @param {typeof fetch} [fetchImpl] - fetch 实现（测试注入用）。
* @returns {Promise<{ text: string, url: string }>} 首个成功源。
*/
async function fetchLiteLLMPricing(fetchImpl = fetch) {
	let lastError;
	for (const url of LITELLM_PRICING_URLS) try {
		const res = await fetchImpl(url, { signal: AbortSignal.timeout(3e4) });
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const text = await res.text();
		if (text.length < 1e4) throw new Error("response too small");
		return {
			text,
			url
		};
	} catch (error) {
		lastError = error;
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
//#endregion
//#region src/pricing.ts
/**
* 价目表加载器（宿主侧）。
*
* 生效规则：包内置快照 `pricing-default.json`（随包分发）打底，用户级
* `$DSH_HOME/usage-pricing.json` 的 models/aliases 逐条覆盖或新增（合并
* 语义，用户文件可以只写自定义条目）。两者都不可用时回退空表，cost.ts
* 的关键词/通用档兜底仍然工作。
*
* 刷新流程（/api/usage-pricing/refresh 或 scripts/refresh-pricing.mjs）
* 写用户级文件后调用 invalidatePricingCache() 立即生效。
* @module @captain1275/dsh-usage-dashboard/pricing
*/
/** 空快照（文件缺失/损坏时的兜底）。 */
const EMPTY_SNAPSHOT = {
	_source: "none",
	_unit: "CNY per 1M tokens",
	_fx: 7.2,
	_fetchedAt: "",
	models: {},
	aliases: {}
};
/** 包内置快照路径（lib/index.js 旁一路向上到包根）。 */
function builtinPricingPath() {
	return fileURLToPath(new URL("../pricing-default.json", import.meta.url));
}
/** 用户级覆盖路径：$DSH_HOME/usage-pricing.json。 */
function userPricingPath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "usage-pricing.json");
}
/**
* 校验快照形状（宽松：models 或 aliases 至少一个为对象即可，P2）。
* 只写 models 的手写覆盖（无 aliases 字段）不算损坏；
* 只有 JSON 解析失败（或完全非对象）才整文件回退。
*/
function isSnapshot(value) {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value;
	const modelsOk = typeof candidate.models === "object" && candidate.models !== null && !Array.isArray(candidate.models);
	const aliasesOk = typeof candidate.aliases === "object" && candidate.aliases !== null && !Array.isArray(candidate.aliases);
	return modelsOk || aliasesOk;
}
/** 读取并归一化一个快照文件；缺失/损坏返回 null（不完整但合法的形状按缺失字段补空对象）。 */
function readSnapshot(path) {
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return null;
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return null;
	}
	if (!isSnapshot(parsed)) return null;
	const candidate = parsed;
	return {
		_source: typeof candidate._source === "string" ? candidate._source : "unknown",
		_unit: typeof candidate._unit === "string" ? candidate._unit : "CNY per 1M tokens",
		_fx: typeof candidate._fx === "number" && Number.isFinite(candidate._fx) ? candidate._fx : DEFAULT_FX,
		_fetchedAt: typeof candidate._fetchedAt === "string" ? candidate._fetchedAt : "",
		_url: typeof candidate._url === "string" ? candidate._url : void 0,
		models: typeof candidate.models === "object" && candidate.models !== null ? candidate.models : {},
		aliases: typeof candidate.aliases === "object" && candidate.aliases !== null ? candidate.aliases : {}
	};
}
/** 读取用户级覆盖文件；缺失/损坏返回 null（形状校验宽松，宿主刷新路由复用）。 */
function readUserPricingFile() {
	return readSnapshot(userPricingPath());
}
let cache = null;
/** 读取当前生效价目表（进程内缓存；刷新后需 invalidate）。 */
function loadPricing() {
	if (cache !== null) return cache;
	const builtinPath = builtinPricingPath();
	const fromBuiltin = readSnapshot(builtinPath);
	const userPath = userPricingPath();
	const fromUser = readSnapshot(userPath);
	if (fromUser !== null) {
		const base = fromBuiltin ?? EMPTY_SNAPSHOT;
		cache = {
			origin: "user",
			path: userPath,
			snapshot: {
				...fromUser,
				models: {
					...base.models,
					...fromUser.models
				},
				aliases: {
					...base.aliases,
					...fromUser.aliases
				}
			}
		};
		return cache;
	}
	if (fromBuiltin !== null) {
		cache = {
			origin: "builtin",
			path: builtinPath,
			snapshot: fromBuiltin
		};
		return cache;
	}
	cache = {
		origin: "empty",
		path: null,
		snapshot: EMPTY_SNAPSHOT
	};
	return cache;
}
/** 价目缓存失效（刷新写入后调用）。 */
function invalidatePricingCache() {
	cache = null;
}
/** 写入用户级覆盖（刷新路由/CLI 共用）。 */
function writeUserPricing(snapshot) {
	const path = userPricingPath();
	writeFileSync(path, JSON.stringify(snapshot), "utf8");
	invalidatePricingCache();
	return path;
}
/** 汇总当前生效表的元信息。 */
function pricingMeta() {
	const table = loadPricing();
	const keys = Object.keys(table.snapshot.models);
	return {
		origin: table.origin,
		updatedAt: table.snapshot._fetchedAt,
		fx: table.snapshot._fx,
		unit: table.snapshot._unit,
		source: table.snapshot._source,
		providers: new Set(keys.map((key) => key.split("/")[0])).size,
		models: keys.length,
		aliases: Object.keys(table.snapshot.aliases).length
	};
}
//#endregion
//#region src/cost.ts
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
/** DeepSeek 官方定价（2026-08，元/百万 token，来源 api-docs.deepseek.com/quick_start/pricing）。 */
/** deepseek-v4-flash：缓存命中 0.02 / 缓存未命中 1 / 输出 2，缓存写入按输入价。 */
const DEEPSEEK_FLASH_RATES = {
	inputPerM: 1,
	outputPerM: 2,
	cachePerM: .02,
	cacheWritePerM: 1
};
/** deepseek-v4-pro：缓存命中 0.025 / 缓存未命中 3 / 输出 6。 */
const DEEPSEEK_RATES = {
	inputPerM: 3,
	outputPerM: 6,
	cachePerM: .025,
	cacheWritePerM: 3
};
/** 旧 deepseek-chat / reasoner 定价参考（2025，元/百万 token）。 */
const DEEPSEEK_LEGACY_RATES = {
	inputPerM: 2,
	outputPerM: 8,
	cachePerM: .5,
	cacheWritePerM: 2
};
const DEEPSEEK_REASONER_RATES = {
	inputPerM: 4,
	outputPerM: 16,
	cachePerM: 1,
	cacheWritePerM: 4
};
/** 未知模型回退通用档。 */
const GENERIC_RATES = {
	inputPerM: 1,
	outputPerM: 2,
	cachePerM: .02,
	cacheWritePerM: 1
};
/**
* 快照条目转 CostRates（缺 input/output 时回退通用档对应字段）。
* 缓存写入优先用快照 `w`（Anthropic 等缓存写入远高于输入价）；
* 缺省回退输入价 —— DeepSeek/Kimi 的缓存写入价等于普通输入价。
*/
function entryToRates(entry) {
	return {
		inputPerM: entry.i ?? GENERIC_RATES.inputPerM,
		outputPerM: entry.o ?? GENERIC_RATES.outputPerM,
		cachePerM: entry.c ?? GENERIC_RATES.cachePerM,
		cacheWritePerM: entry.w ?? entry.i ?? GENERIC_RATES.inputPerM
	};
}
/** 标识是否属于 DeepSeek 命名空间（关键词兜底的前置条件，M1）。 */
function isDeepseekNamespace(m) {
	return m.startsWith("deepseek") || m.includes("/deepseek") || m.includes("deepseek-");
}
/**
* DeepSeek 家族关键词兜底（快照里没有对应条目时才走到这里）。
* 先要求标识属于 DeepSeek 命名空间：`glm-5-reasoner` 之类非 DeepSeek 模型
* 不会被套上 DeepSeek 官方价。`-r1` 规则用正则锚定 deepseek 命名空间，
* 不再做裸子串匹配（M1）。
*/
function deepseekKeywordRates(m) {
	if (!isDeepseekNamespace(m)) return null;
	if (m.includes("flash")) return DEEPSEEK_FLASH_RATES;
	if (m.includes("reasoner") || /(^|\/)deepseek.*r1/.test(m)) return DEEPSEEK_REASONER_RATES;
	if (m.includes("v4-pro")) return DEEPSEEK_RATES;
	return DEEPSEEK_LEGACY_RATES;
}
/** 剥掉常见的日期/版本后缀：gpt-4o-2024-11-20 -> gpt-4o（M3）。 */
function stripVersionSuffix(name) {
	return name.replace(/-20\d{2}(?:-\d{1,2}(?:-\d{1,2})?|\d{4})?$/, "");
}
/**
* 别名解析：命中唯一别名的目标条目才返回。
* 裸名撞车（P6，snapshot._ambiguous）的别名目标条目不完整（缺 i/o）时不返回，
* 让调用方继续走关键词/通用档兜底，避免给错误模型套用通用补位价。
*/
function resolveAlias(snapshot, bare) {
	const target = snapshot.aliases[bare];
	if (target === void 0) return void 0;
	const entry = snapshot.models[target];
	if (entry === void 0) return void 0;
	const ambiguous = Array.isArray(snapshot._ambiguous) && snapshot._ambiguous.includes(bare);
	const complete = entry.i !== void 0 || entry.o !== void 0;
	if (ambiguous && !complete) return void 0;
	return entry;
}
/**
* 按模型名取单价。
* @param model - 模型标识（如 deepseek/deepseek-chat 或 gpt-4o）。
* @returns 单价。
*/
function ratesForModel(model) {
	const m = model.trim().toLowerCase();
	const { snapshot } = loadPricing();
	const direct = snapshot.models[m];
	if (direct !== void 0) return entryToRates(direct);
	const bare = m.includes("/") ? m.split("/").pop() ?? m : m;
	const viaAlias = resolveAlias(snapshot, bare);
	if (viaAlias !== void 0) return entryToRates(viaAlias);
	let stripped = bare;
	for (let i = 0; i < 3; i++) {
		const next = stripVersionSuffix(stripped);
		if (next === stripped) break;
		stripped = next;
		const viaStripped = resolveAlias(snapshot, stripped);
		if (viaStripped !== void 0) return entryToRates(viaStripped);
	}
	const keyword = deepseekKeywordRates(m);
	if (keyword !== null) return keyword;
	return GENERIC_RATES;
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
function estimateCost(model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens = 0, rates = ratesForModel(model)) {
	const input = inputTokens / 1e6 * rates.inputPerM;
	const output = outputTokens / 1e6 * rates.outputPerM;
	const cache = cacheReadTokens / 1e6 * rates.cachePerM;
	const cacheWrite = cacheWriteTokens / 1e6 * rates.cacheWritePerM;
	return input + output + cache + cacheWrite;
}
//#endregion
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-usage-dashboard";
/** 路由前缀。 */
const USAGE_API_PREFIX = "/api/usage";
/** 客户端时间戳相对服务器时间的最大允许偏差（±48h，H6 越界回退 Date.now()）。 */
const MAX_TS_SKEW_MS = 2880 * 60 * 1e3;
/** 空聚合。 */
function emptyUsage() {
	return {
		bySession: {},
		byDay: {},
		byModel: {},
		total: {
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			calls: 0
		}
	};
}
/** 配置文件路径：$DSH_HOME/usage.json。 */
function usagePath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "usage.json");
}
/** 日期键（本地时区）。 */
function dayKey(ts) {
	const d = new Date(ts);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
/**
* 读取聚合数据。
* 文件缺失 → 空表；JSON 解析失败 / 形状非法 → 先把损坏文件改名备份为
* `usage.json.corrupt-<ts>` 再回退空表，绝不"读坏 -> 写入空表 -> 旧数据
* 永远消失"（H1）。
*/
function readUsage() {
	const path = usagePath();
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return emptyUsage();
	}
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null) return emptyUsage();
		return {
			bySession: parsed.bySession ?? {},
			byDay: parsed.byDay ?? {},
			byModel: parsed.byModel ?? {},
			total: parsed.total ?? {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				calls: 0
			}
		};
	} catch {
		const backup = `${path}.corrupt-${Date.now()}`;
		try {
			renameSync(path, backup);
			console.warn(`[usage-dashboard] usage.json is corrupt; backed up to ${backup}`);
		} catch {
			console.warn(`[usage-dashboard] usage.json is corrupt and could not be backed up: ${path}`);
		}
		return emptyUsage();
	}
}
/**
* 写入聚合数据（原子写：先写同目录 `usage.json.tmp` 再 rename 覆盖，
* 进程崩溃/断电不会留下截断的目标文件；H1）。
* 失败至少 console.warn 一次，宿主不再误以为已持久化。
*/
function writeUsage(store) {
	const path = usagePath();
	const tmp = `${path}.tmp`;
	try {
		writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
		renameSync(tmp, path);
	} catch (error) {
		console.warn("[usage-dashboard] writeUsage failed:", error instanceof Error ? error.message : String(error));
	}
}
/** 把一条记录并入聚合（replace 语义：同会话以最新快照覆盖，避免双计）。 */
function applyRecord(store, record) {
	const sessionId = record.sessionId || "default";
	if (record.reset === true) {
		const existing = store.bySession[sessionId];
		store.bySession[sessionId] = {
			title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
			lastModel: record.model || existing?.lastModel || "unknown",
			lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
			inputTokens: record.inputTokens,
			outputTokens: record.outputTokens,
			cacheReadTokens: record.cacheReadTokens,
			cacheWriteTokens: record.cacheWriteTokens,
			calls: existing?.calls ?? 0
		};
		return;
	}
	const existing = store.bySession[sessionId];
	const prevInput = existing?.inputTokens ?? 0;
	const prevOutput = existing?.outputTokens ?? 0;
	const prevCache = existing?.cacheReadTokens ?? 0;
	const prevCacheWrite = existing?.cacheWriteTokens ?? 0;
	const dInput = Math.max(0, record.inputTokens - prevInput);
	const dOutput = Math.max(0, record.outputTokens - prevOutput);
	const dCache = Math.max(0, record.cacheReadTokens - prevCache);
	const dCacheWrite = Math.max(0, record.cacheWriteTokens - prevCacheWrite);
	const grew = dInput + dOutput + dCache + dCacheWrite > 0;
	const session = {
		title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
		lastModel: record.model || existing?.lastModel || "unknown",
		lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
		inputTokens: record.inputTokens,
		outputTokens: record.outputTokens,
		cacheReadTokens: record.cacheReadTokens,
		cacheWriteTokens: record.cacheWriteTokens,
		calls: (existing?.calls ?? 0) + (grew ? 1 : 0)
	};
	store.bySession[sessionId] = session;
	if (!grew) return;
	const day = dayKey(record.ts);
	const dayBucket = store.byDay[day] ?? {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		calls: 0
	};
	dayBucket.inputTokens += dInput;
	dayBucket.outputTokens += dOutput;
	dayBucket.cacheReadTokens += dCache;
	dayBucket.cacheWriteTokens = (dayBucket.cacheWriteTokens ?? 0) + dCacheWrite;
	dayBucket.calls += 1;
	store.byDay[day] = dayBucket;
	const model = record.model || "unknown";
	const modelBucket = store.byModel[model] ?? {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		calls: 0
	};
	modelBucket.inputTokens += dInput;
	modelBucket.outputTokens += dOutput;
	modelBucket.cacheReadTokens += dCache;
	modelBucket.cacheWriteTokens = (modelBucket.cacheWriteTokens ?? 0) + dCacheWrite;
	modelBucket.calls += 1;
	store.byModel[model] = modelBucket;
	store.total.inputTokens += dInput;
	store.total.outputTokens += dOutput;
	store.total.cacheReadTokens += dCache;
	store.total.cacheWriteTokens = (store.total.cacheWriteTokens ?? 0) + dCacheWrite;
	store.total.calls += 1;
}
/** 最近 N 天的按天序列（缺失日补零，便于画图）。 */
function recentDays(store, days) {
	const out = [];
	const cursor = /* @__PURE__ */ new Date();
	cursor.setDate(cursor.getDate() - (days - 1));
	for (let i = 0; i < days; i++) {
		const key = dayKey(cursor.getTime());
		const bucket = store.byDay[key];
		out.push({
			day: key,
			inputTokens: bucket?.inputTokens ?? 0,
			outputTokens: bucket?.outputTokens ?? 0,
			cacheReadTokens: bucket?.cacheReadTokens ?? 0,
			cacheWriteTokens: bucket?.cacheWriteTokens ?? 0,
			calls: bucket?.calls ?? 0
		});
		cursor.setDate(cursor.getDate() + 1);
	}
	return out;
}
/** 会话排行（按总 token 降序）。 */
function sessionRanking(store, limit) {
	return Object.entries(store.bySession).map(([id, s]) => ({
		id,
		title: s.title,
		model: s.lastModel,
		lastTs: s.lastTs,
		totalTokens: s.inputTokens + s.outputTokens + s.cacheReadTokens + (s.cacheWriteTokens ?? 0),
		calls: s.calls
	})).sort((a, b) => b.totalTokens - a.totalTokens).slice(0, limit);
}
/** 发送 JSON 响应（防御：连接已关/已结束时静默跳过，避免写已销毁 socket 抛错，H7）。 */
function sendJson(res, status, data) {
	if (res.destroyed || res.writableEnded) return;
	try {
		res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify(data));
	} catch {}
}
/** 读取请求体（上限 1MB；超限 reject 并销毁连接，走 413 分支）。 */
function readBody(req) {
	return new Promise((resolveBody, reject) => {
		let body = "";
		let tooLarge = false;
		req.on("data", (chunk) => {
			body += chunk.toString("utf8");
			if (body.length > 1e6 && !tooLarge) {
				tooLarge = true;
				reject(/* @__PURE__ */ new Error("body too large"));
				req.destroy();
			}
		});
		req.on("end", () => {
			if (!tooLarge) resolveBody(body);
		});
		req.on("error", reject);
	});
}
/** 规范化上报载荷。 */
function normalizeRecord(raw) {
	const inputTokens = typeof raw.inputTokens === "number" && Number.isFinite(raw.inputTokens) ? Math.max(0, Math.round(raw.inputTokens)) : 0;
	const outputTokens = typeof raw.outputTokens === "number" && Number.isFinite(raw.outputTokens) ? Math.max(0, Math.round(raw.outputTokens)) : 0;
	const cacheReadTokens = typeof raw.cacheReadTokens === "number" && Number.isFinite(raw.cacheReadTokens) ? Math.max(0, Math.round(raw.cacheReadTokens)) : 0;
	const cacheWriteTokens = typeof raw.cacheWriteTokens === "number" && Number.isFinite(raw.cacheWriteTokens) ? Math.max(0, Math.round(raw.cacheWriteTokens)) : 0;
	if (inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens <= 0 && raw.reset !== true) return void 0;
	const now = Date.now();
	const rawTs = typeof raw.ts === "number" && Number.isFinite(raw.ts) ? raw.ts : NaN;
	const ts = Number.isFinite(rawTs) && Math.abs(rawTs - now) <= MAX_TS_SKEW_MS ? rawTs : now;
	return {
		sessionId: typeof raw.sessionId === "string" ? raw.sessionId : "default",
		sessionTitle: typeof raw.sessionTitle === "string" ? raw.sessionTitle : "",
		model: typeof raw.model === "string" ? raw.model : "unknown",
		ts,
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		reset: raw.reset === true
	};
}
/** 请求分发：POST /api/usage/record, GET /api/usage/summary。 */
function handle(req, res) {
	const url = new URL(req.url ?? "/", "http://dsh.local");
	if (url.pathname === `/api/usage/record` && req.method === "POST") {
		readBody(req).then((body) => {
			const record = normalizeRecord(JSON.parse(body));
			if (record === void 0) {
				sendJson(res, 200, {
					ok: true,
					skipped: true
				});
				return;
			}
			const store = readUsage();
			applyRecord(store, record);
			writeUsage(store);
			sendJson(res, 200, {
				ok: true,
				skipped: false
			});
		}).catch((e) => {
			const tooLarge = e instanceof Error && e.message === "body too large";
			sendJson(res, tooLarge ? 413 : 400, {
				ok: false,
				error: tooLarge ? "request body too large" : e instanceof Error ? e.message : String(e)
			});
		});
		return;
	}
	if (url.pathname === `/api/usage/summary` && req.method === "GET") {
		const store = readUsage();
		const modelCosts = Object.fromEntries(Object.entries(store.byModel).map(([model, b]) => [model, estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens ?? 0)]));
		const totalCost = Object.values(modelCosts).reduce((a, b) => a + b, 0);
		const sessions = sessionRanking(store, 20).map((s) => {
			const bucket = store.bySession[s.id];
			const cost = estimateCost(s.model, bucket?.inputTokens ?? 0, bucket?.outputTokens ?? 0, bucket?.cacheReadTokens ?? 0, bucket?.cacheWriteTokens ?? 0);
			return {
				...s,
				cost: Math.round(cost * 1e4) / 1e4
			};
		});
		sendJson(res, 200, {
			ok: true,
			total: store.total,
			byModel: store.byModel,
			recent: recentDays(store, 14),
			sessions,
			byDayCount: Object.keys(store.byDay).length,
			cost: {
				total: Math.round(totalCost * 100) / 100,
				byModel: Object.fromEntries(Object.entries(modelCosts).map(([m, v]) => [m, Math.round(v * 1e4) / 1e4]))
			}
		});
		return;
	}
	sendJson(res, 404, {
		ok: false,
		error: "not found"
	});
}
/** 价目表路由前缀。 */
const USAGE_PRICING_API_PREFIX = "/api/usage-pricing";
/**
* 价目表请求分发：
* - GET  /api/usage-pricing         当前生效表元信息（来源/更新时间/覆盖量）
* - POST /api/usage-pricing/refresh 拉取 LiteLLM 最新价目并写用户级覆盖。
*   refresh 要求 `content-type: application/json` 且 body 为可解析的 JSON
*   对象（哪怕空对象）：no-cors 的跨站表单 POST 默认 text/plain 会被拒绝，
*   是本机端口的 CSRF 防护（H8）。
*/
function handlePricing(req, res) {
	const url = new URL(req.url ?? "/", "http://dsh.local");
	if (url.pathname === "/api/usage-pricing" && req.method === "GET") {
		sendJson(res, 200, {
			ok: true,
			pricing: pricingMeta()
		});
		return;
	}
	if (url.pathname === `/api/usage-pricing/refresh` && req.method === "POST") {
		(async () => {
			if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
				sendJson(res, 415, {
					ok: false,
					error: "content-type must be application/json"
				});
				return;
			}
			const body = await readBody(req);
			let parsedBody;
			try {
				parsedBody = JSON.parse(body);
			} catch {
				parsedBody = void 0;
			}
			if (typeof parsedBody !== "object" || parsedBody === null) {
				sendJson(res, 400, {
					ok: false,
					error: "body must be a JSON object"
				});
				return;
			}
			const { text, url: sourceUrl } = await fetchLiteLLMPricing();
			const { snapshot, stats } = normalizeLiteLLM(text, DEFAULT_FX);
			snapshot._url = sourceUrl;
			const path = writeUserPricing(mergeFreshSnapshot(readUserPricingFile(), snapshot));
			sendJson(res, 200, {
				ok: true,
				pricing: pricingMeta(),
				stats,
				path
			});
		})().catch((error) => {
			const tooLarge = error instanceof Error && error.message === "body too large";
			sendJson(res, tooLarge ? 413 : 502, {
				ok: false,
				error: tooLarge ? "request body too large" : error instanceof Error ? error.message : String(error)
			});
		});
		return;
	}
	sendJson(res, 404, {
		ok: false,
		error: "not found"
	});
}
/** 宿主插件体：注册配置路由（无 webServer 服务时为空操作）。 */
function apply(ctx) {
	ctx.inject(["webServer"], (httpCtx) => {
		const dispose = httpCtx.webServer.register({
			kind: "prefix",
			path: USAGE_API_PREFIX,
			handler: handle
		});
		httpCtx.effect(() => dispose, "ui-usage-dashboard: usage route");
		const disposePricing = httpCtx.webServer.register({
			kind: "prefix",
			path: USAGE_PRICING_API_PREFIX,
			handler: handlePricing
		});
		httpCtx.effect(() => disposePricing, "ui-usage-dashboard: pricing route");
	});
}
//#endregion
export { USAGE_API_PREFIX, USAGE_PRICING_API_PREFIX, apply, applyRecord, dayKey, emptyUsage, name, normalizeRecord, readUsage, recentDays, sessionRanking, usagePath, writeUsage };
