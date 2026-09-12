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
/**
* DeepSeek 官方定价（元/百万 token，来源 api-docs.deepseek.com 官方价目表）。
*
* 官方表按空闲时段 / 高峰时段两档报价；看板按累计 token 记账、无法区分时段，
* 因此新模型一律取**高峰时段**价（保守上界，只高估不低估）。缓存写入价等于
* 普通输入价（与 DeepSeek 计价口径一致）。
*/
/** deepseek-flash（DeepSeek-V4.1-Flash）高峰：缓存命中 0.04 / 缓存未命中 2 / 输出 8。 */
const DEEPSEEK_FLASH_RATES = {
	inputPerM: 2,
	outputPerM: 8,
	cachePerM: .04,
	cacheWritePerM: 2
};
/** deepseek-v4-pro（DeepSeek-V4-Pro-0813）高峰：缓存命中 0.3 / 缓存未命中 9 / 输出 27。 */
const DEEPSEEK_RATES = {
	inputPerM: 9,
	outputPerM: 27,
	cachePerM: .3,
	cacheWritePerM: 9
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
const DEEPSEEK_OFFICIAL_RATES = {
	"deepseek-flash": DEEPSEEK_FLASH_RATES,
	"deepseek-v4-flash": DEEPSEEK_FLASH_RATES,
	"deepseek-v4-flash-vision-exp": DEEPSEEK_FLASH_RATES,
	"deepseek-v4-pro": DEEPSEEK_RATES
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
	const bare = m.includes("/") ? m.split("/").pop() ?? m : m;
	const official = DEEPSEEK_OFFICIAL_RATES[bare];
	if (official !== void 0) return official;
	const { snapshot } = loadPricing();
	const direct = snapshot.models[m];
	if (direct !== void 0) return entryToRates(direct);
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
//#region src/scan.ts
/** 本地日历日键（YYYY-MM-DD）。 */
function localDayKey(ts) {
	const d = new Date(ts);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
/** 空桶。 */
function emptyBucket() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		calls: 0
	};
}
/** 往归属表里记一笔（缺行即建行）。 */
function creditBucket(days, day, model, delta) {
	const byModel = days[day] ?? (days[day] = {});
	const bucket = byModel[model] ?? (byModel[model] = emptyBucket());
	bucket.inputTokens += delta.inputTokens ?? 0;
	bucket.outputTokens += delta.outputTokens ?? 0;
	bucket.cacheReadTokens += delta.cacheReadTokens ?? 0;
	bucket.cacheWriteTokens += delta.cacheWriteTokens ?? 0;
	bucket.calls += delta.calls ?? 0;
}
/** 该服务是否具备可用的读取能力（0.1.5 的 list+open，或 0.1.1 的 listSnapshots+readFrom）。 */
function canScan(persistence) {
	if (persistence === void 0) return false;
	const modern = typeof persistence.list === "function" && typeof persistence.open === "function";
	const legacy = typeof persistence.listSnapshots === "function" && typeof persistence.readFrom === "function";
	return modern || legacy;
}
/** 枚举全部会话快照（新旧接口统一）。 */
async function listSnapshots(persistence) {
	if (typeof persistence.list === "function") return await persistence.list();
	if (typeof persistence.listSnapshots === "function") return await persistence.listSnapshots();
	return [];
}
/** 读取一个会话的全部事件（新旧接口统一）。 */
async function readEvents(persistence, id) {
	if (typeof persistence.open === "function") {
		const handle = await persistence.open(id, "read");
		try {
			const { events } = await handle.read();
			return events ?? [];
		} finally {
			try {
				await handle.close?.();
			} catch {}
		}
	}
	if (typeof persistence.readFrom === "function") {
		const { events } = await persistence.readFrom(id, 0);
		return events ?? [];
	}
	return [];
}
/** 会话标题：子会话带标记，根会话用 id 前 8 位（已有标题由 host 保留）。 */
function scanTitle(header) {
	const bare = header.id.slice(0, 8);
	return header.origin === "subagent" || (header.delegationDepth ?? 0) > 0 ? `子会话 ${bare}` : `会话 ${bare}`;
}
/** 空累计。 */
function emptySessionUsage() {
	return {
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		steps: 0,
		model: "",
		days: {}
	};
}
/**
* 纯 fold：把一段事件日志折成会话累计用量 + 真实归属。
* - token：`assistant/chunk{type:'usage'}` 与 `assistant/message.usage` 都记；
*   同一 (turn,step) 的重度样本按「后者替换前者」处理，绝不双计（增量补记）。
* - 归属：按事件自身的 `time` 落到本地日历日，按当时的 `request/header` 模型
*   落到该模型 —— 历史补录落在真正发生的日期，而不是"扫描那一刻"。
* - 调用数：数 `step/end` 事件（含失败/取消），与 sessionStats 投影同口径。
* - model：取最后一条 `request/header` 的 `config.model`。
* @param events - 会话事件序列。
* @param fallbackTs - 事件缺 `time` 时使用的兜底时间戳（默认 now）。
*/
function foldSessionUsage(events, fallbackTs = Date.now()) {
	const out = emptySessionUsage();
	let lastKey = "";
	let last;
	/** 上一个样本归属到哪一天（同一步骤的后续增量沿用，避免一步跨天被拆开）。 */
	let lastDay = "";
	/** 当前生效模型（request/header 流式更新）。 */
	let currentModel = "";
	for (const ev of events) {
		const day = localDayKey(typeof ev.time === "number" && Number.isFinite(ev.time) ? ev.time : fallbackTs);
		if (ev.type === "request/header") {
			const config = ev.data?.header?.config;
			if (config !== void 0 && typeof config.model === "string" && config.model.length > 0) {
				out.model = config.model;
				currentModel = config.model;
			}
			continue;
		}
		if (ev.type === "assistant/message") {
			const declared = ev.data?.message?.source?.model;
			if (typeof declared === "string" && declared.length > 0) {
				out.model = declared;
				currentModel = declared;
			}
		}
		const model = currentModel === "" ? "unknown" : currentModel;
		const usage = ev.data?.chunk?.type === "usage" ? ev.data.chunk.usage : ev.type === "assistant/message" ? ev.data?.usage : void 0;
		const stepIsEnd = ev.type === "step/end";
		if (usage === void 0) {
			if (stepIsEnd) {
				out.steps += 1;
				creditBucket(out.days, day, model, { calls: 1 });
			}
			continue;
		}
		const turn = ev.data?.turn ?? -1;
		const step = ev.data?.step ?? -1;
		const b = {
			i: usage.inputTokens ?? 0,
			o: usage.outputTokens ?? 0,
			c: usage.cacheReadTokens ?? 0,
			w: usage.cacheWriteTokens ?? 0
		};
		const key = `${turn}:${step}`;
		let delta = {
			i: b.i,
			o: b.o,
			c: b.c,
			w: b.w
		};
		let dayOfDelta = day;
		if (lastKey === key && last !== void 0) {
			if (last.i === b.i && last.o === b.o && last.c === b.c && last.w === b.w) {
				if (stepIsEnd) {
					out.steps += 1;
					creditBucket(out.days, lastDay === "" ? day : lastDay, model, { calls: 1 });
				}
				last = b;
				continue;
			}
			delta = {
				i: b.i - last.i,
				o: b.o - last.o,
				c: b.c - last.c,
				w: b.w - last.w
			};
			dayOfDelta = lastDay === "" ? day : lastDay;
		}
		out.inputTokens += delta.i;
		out.outputTokens += delta.o;
		out.cacheReadTokens += delta.c;
		out.cacheWriteTokens += delta.w;
		creditBucket(out.days, dayOfDelta, model, {
			inputTokens: delta.i,
			outputTokens: delta.o,
			cacheReadTokens: delta.c,
			cacheWriteTokens: delta.w
		});
		lastKey = key;
		last = b;
		lastDay = dayOfDelta;
		if (stepIsEnd) {
			out.steps += 1;
			creditBucket(out.days, dayOfDelta, model, { calls: 1 });
		}
	}
	return out;
}
/**
* 扫描全部会话日志，重算「新增或 revision 变化」的会话累计。
* `knownRevisions` 为上次水位；冷启动（空对象）即全量补录。
* 单次最多处理 `limit` 个会话（0 = 不限），避免某次大扫阻塞宿主任意时长。
*/
async function scanAndBackfill(persistence, knownRevisions = {}, limit = 0) {
	const outcomes = [];
	const revisions = { ...knownRevisions };
	let errors = 0;
	let total = 0;
	if (!canScan(persistence)) return {
		outcomes,
		errors,
		revisions,
		total
	};
	const snapshots = await listSnapshots(persistence);
	total = snapshots.length;
	let handled = 0;
	for (const snap of snapshots) {
		const id = snap.header?.id;
		if (typeof id !== "string" || id.length === 0) continue;
		const rev = snap.revision === void 0 ? void 0 : String(snap.revision);
		if (limit > 0 && handled >= limit) break;
		if (rev !== void 0 && revisions[id] === rev) continue;
		handled += 1;
		try {
			const usage = foldSessionUsage(await readEvents(persistence, id));
			const parent = snap.header?.parentSession;
			outcomes.push({
				sessionId: id,
				...parent !== void 0 ? { parentSession: parent } : {},
				isSubagent: snap.header?.origin === "subagent" || (snap.header?.delegationDepth ?? 0) > 0,
				...usage
			});
		} catch (error) {
			errors += 1;
			console.warn(`[usage-dashboard] scan failed for ${id}:`, error instanceof Error ? error.message : String(error));
		}
		if (rev !== void 0) revisions[id] = rev;
	}
	return {
		outcomes,
		errors,
		revisions,
		total
	};
}
//#endregion
//#region src/index.ts
/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
const name = "ui-usage-dashboard";
/** 路由前缀。 */
const USAGE_API_PREFIX = "/api/usage";
/** 客户端时间戳相对服务器时间的最大允许偏差（±48h，H6 越界回退 Date.now()）。 */
const MAX_TS_SKEW_MS = 2880 * 60 * 1e3;
/** 全会话扫描间隔（ms）。 */
const SCAN_INTERVAL_MS = 6e4;
/** 会话扫描水位文件（独立于 usage.json，避免与 record 互相写脏）。 */
const SCAN_WATERMARK_FILENAME = "usage-scan.json";
/**
* 宿主侧全部「读 usage.json -> 改 -> 写 usage.json」的串行队列：record 上报
* 与全会话扫描共享，避免并发 read-modify-write 相互覆盖丢更新。
*/
let usageWriteChain = Promise.resolve();
/** apply 注入的 sessionPersistence 引用（handle 的 rescan 分支读取）。 */
let scanPersistence;
/** 扫描进行中标志（定时与手动触发去重）。 */
let scanning = false;
/** 写串行链：排队执行一次 usage.json 读改写。 */
function withUsageWrite(task) {
	const run = usageWriteChain.then(() => task());
	usageWriteChain = run.then(() => void 0, () => void 0);
	return run;
}
/** 当前存储版本。 */
const USAGE_STORE_VERSION = 2;
/**
* 「日期未知」归属键：v1 迁移时旧数据只有会话累计、没有按天归属，先整段记到
* 这个键下 —— 它参与 `total` 与 `byModel`（总额/模型分布不丢），但**不进**
* `byDay`（宁可不显示，也不把整个会话的历史伪造成"迁移那天"的用量）。
* 首次全量扫描按日志事件时间重建真实归属后，这批兜底数据即被整行替换。
*/
const UNATTRIBUTED_DAY = "unattributed";
/** 空聚合。 */
function emptyUsage() {
	return {
		version: 2,
		bySession: {},
		byDay: {},
		byModel: {},
		total: emptyBucket()
	};
}
/**
* 重算派生聚合：**唯一**的 byDay / byModel / total 来源。
*
* 旧实现把三者当独立累加器（每次上报按"新快照 - 旧快照"只增不减地加），
* 与 bySession 的覆盖语义分叉：客户端投影与宿主日志 fold 只要给同一会话
* 报出不同数字，差值就会被反复重加，聚合永远单调膨胀（实测总费用虚高
* 3 倍、输出 token 9.6 倍、调用数 4.6 倍）。派生后不可能再漂移：
* total = Σ 会话行，byDay/byModel = Σ 归属表，三者恒等。
*/
function recomputeAggregates(store) {
	const byDay = {};
	const byModel = {};
	const total = emptyBucket();
	const add = (target, key, source) => {
		const bucket = target[key] ?? (target[key] = emptyBucket());
		bucket.inputTokens += source.inputTokens;
		bucket.outputTokens += source.outputTokens;
		bucket.cacheReadTokens += source.cacheReadTokens;
		bucket.cacheWriteTokens += source.cacheWriteTokens;
		bucket.calls += source.calls;
	};
	for (const session of Object.values(store.bySession)) {
		total.inputTokens += session.inputTokens;
		total.outputTokens += session.outputTokens;
		total.cacheReadTokens += session.cacheReadTokens;
		total.cacheWriteTokens += session.cacheWriteTokens;
		total.calls += session.calls;
		for (const [day, models] of Object.entries(session.days ?? {})) for (const [model, bucket] of Object.entries(models)) {
			if (day !== "unattributed") add(byDay, day, bucket);
			add(byModel, model, bucket);
		}
	}
	store.byDay = byDay;
	store.byModel = byModel;
	store.total = total;
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
*
* v1（双账本：bySession 覆盖 + byDay/byModel/total 各自累加）在读取时一次性
* 迁移到 v2：旧文件先改名备份为 `usage.json.v1-<ts>`，聚合桶整体丢弃（它们
* 已被重复计数污染且无法还原），`byDay/byModel` 改由会话行派生；同时清空扫描
* 水位，让下一次全会话扫描按日志重建真实归属。
*/
function readUsage() {
	const path = usagePath();
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch {
		return emptyUsage();
	}
	let parsed;
	try {
		parsed = JSON.parse(raw);
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
	if (typeof parsed !== "object" || parsed === null) return emptyUsage();
	const store = migrateStore(parsed, path);
	recomputeAggregates(store);
	return store;
}
/**
* 归一化/迁移已解析的存储对象（纯函数，便于单测）。
* 逐会话补齐 `days` 与 `authority`：缺 `days` 的旧行按 `lastTs` 那一天 +
* `lastModel` 建一个兜底桶，保证「会话合计 == 归属合计」这一恒等式成立
* （真实归属等全量扫描用日志重建）。
*/
function migrateStore(parsed, path) {
	const version = typeof parsed.version === "number" ? parsed.version : 1;
	const rawSessions = typeof parsed.bySession === "object" && parsed.bySession !== null ? parsed.bySession : {};
	const store = emptyUsage();
	for (const [id, row] of Object.entries(rawSessions)) {
		if (typeof row !== "object" || row === null) continue;
		const bucket = {
			inputTokens: number(rawInput(row, "inputTokens")),
			outputTokens: number(rawInput(row, "outputTokens")),
			cacheReadTokens: number(rawInput(row, "cacheReadTokens")),
			cacheWriteTokens: number(rawInput(row, "cacheWriteTokens")),
			calls: number(rawInput(row, "calls"))
		};
		const days = typeof row.days === "object" && row.days !== null ? row.days : { [UNATTRIBUTED_DAY]: { [typeof row.lastModel === "string" && row.lastModel !== "" ? row.lastModel : "unknown"]: { ...bucket } } };
		store.bySession[id] = {
			title: typeof row.title === "string" && row.title !== "" ? row.title : `会话 ${id.slice(0, 8)}`,
			lastModel: typeof row.lastModel === "string" && row.lastModel !== "" ? row.lastModel : "unknown",
			lastTs: number(row.lastTs),
			...bucket,
			...typeof row.steps === "number" ? { steps: row.steps } : {},
			days,
			authority: row.authority === "scan" ? "scan" : "live"
		};
	}
	if (version < 2) {
		if (path !== void 0) {
			const backup = `${path}.v1-${Date.now()}`;
			try {
				renameSync(path, backup);
				writeUsage(store);
				writeScanWatermark({});
				console.warn(`[usage-dashboard] usage.json migrated to v2; old file kept at ${backup}; full rescan queued to rebuild per-day attribution`);
			} catch (error) {
				console.warn("[usage-dashboard] usage.json migration backup failed:", error instanceof Error ? error.message : String(error));
			}
		}
	}
	return store;
}
/** 读字段的宽松数值转换（非有限值 → 0）。 */
function number(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
/** 读旧行字段（v1 行没有 days/authority）。 */
function rawInput(row, key) {
	return number(row[key]);
}
/**
* 写入聚合数据（原子写：先写同目录 `usage.json.tmp` 再 rename 覆盖，
* 进程崩溃/断电不会留下截断的目标文件；H1）。
* 只落盘 `version` + `bySession`（唯一真相）；聚合桶读时派生，落盘反而会
* 制造第二份可能漂移的账（v1 的教训）。
* 失败至少 console.warn 一次，宿主不再误以为已持久化。
*/
function writeUsage(store) {
	const path = usagePath();
	const tmp = `${path}.tmp`;
	try {
		writeFileSync(tmp, JSON.stringify({
			version: 2,
			bySession: store.bySession
		}, null, 2), "utf8");
		renameSync(tmp, path);
	} catch (error) {
		console.warn("[usage-dashboard] writeUsage failed:", error instanceof Error ? error.message : String(error));
	}
}
/** 会话扫描水位文件路径（$DSH_HOME/usage-scan.json）。 */
function usageScanPath() {
	return join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), SCAN_WATERMARK_FILENAME);
}
/** 读扫描水位（sessionId -> revision）；缺失/损坏回退空表。 */
function readScanWatermark() {
	try {
		const parsed = JSON.parse(readFileSync(usageScanPath(), "utf8"));
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
	} catch {}
	return {};
}
/** 写扫描水位（原子写）。 */
function writeScanWatermark(watermark) {
	const path = usageScanPath();
	try {
		writeFileSync(`${path}.tmp`, JSON.stringify(watermark), "utf8");
		renameSync(`${path}.tmp`, path);
	} catch (error) {
		console.warn("[usage-dashboard] writeScanWatermark failed:", error instanceof Error ? error.message : String(error));
	}
}
/**
* 跑一次全会话扫描并补差并入 usage.json。
* 队列化（withUsageWrite）避免与 record 并发读改写冲突；`limit` 为单次最大
* 会话处理数（0 = 不限）。返回本次并入的会话数（0 = 无变化）。
*/
async function runScan(persistence, limit = 0) {
	if (persistence === void 0 || scanning) return 0;
	scanning = true;
	try {
		readUsage();
		const res = await scanAndBackfill(persistence, readScanWatermark(), limit);
		if (res.outcomes.length === 0 || res.outcomes.reduce((acc, o) => acc + o.inputTokens + o.outputTokens + o.cacheReadTokens + o.cacheWriteTokens + o.steps, 0) === 0) {
			writeScanWatermark(res.revisions);
			return 0;
		}
		const backfilled = await withUsageWrite(() => {
			const store = readUsage();
			for (const o of res.outcomes) {
				const existing = store.bySession[o.sessionId];
				const header = {
					id: o.sessionId,
					...o.isSubagent ? { origin: "subagent" } : {}
				};
				applyRecord(store, {
					sessionId: o.sessionId,
					sessionTitle: existing === void 0 ? scanTitle(header) : "",
					model: o.model || "unknown",
					ts: Date.now(),
					inputTokens: o.inputTokens,
					outputTokens: o.outputTokens,
					cacheReadTokens: o.cacheReadTokens,
					cacheWriteTokens: o.cacheWriteTokens,
					steps: o.steps,
					reset: true,
					days: o.days
				});
			}
			writeUsage(store);
			return res.outcomes.length;
		});
		writeScanWatermark(res.revisions);
		return backfilled;
	} finally {
		scanning = false;
	}
}
/**
* 把一条记录并入账本（v2：单一账本 + 派生聚合）。
*
* 两种记录：
* - **权威记录**（`record.days` 存在，只可能来自会话日志扫描）：整行替换 ——
*   累计 token、调用数、归属表全部以日志 fold 为准，会话标记
*   `authority: 'scan'`。
* - **上报记录**（recorder）：只更新标题/模型/时间/steps，token 与调用数一律
*   单调取大（钳零，永不缩水）；若该会话已被扫描覆盖（`authority === 'scan'`），
*   上报值**不再参与 token/调用记账**。客户端投影与宿主日志 fold 口径不同，
*   两边反复"补差"正是 v1 聚合膨胀 3 倍的根因。
*
* 不变量：会话行 token 合计恒等于其 `days` 各项之和 —— 本函数先算出新的合计，
* 再把 (新 - 旧) 作为增量记进 `days`，「取大」与「补差」由构造保证一致。
*/
function applyRecord(store, record) {
	const sessionId = record.sessionId || "default";
	const existing = store.bySession[sessionId];
	const model = (record.model === "" || record.model === "unknown" ? void 0 : record.model) ?? existing?.lastModel ?? "unknown";
	const prev = {
		inputTokens: existing?.inputTokens ?? 0,
		outputTokens: existing?.outputTokens ?? 0,
		cacheReadTokens: existing?.cacheReadTokens ?? 0,
		cacheWriteTokens: existing?.cacheWriteTokens ?? 0,
		calls: existing?.calls ?? 0
	};
	if (record.days !== void 0) {
		const steps = record.steps;
		store.bySession[sessionId] = {
			title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
			lastModel: model,
			lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
			inputTokens: record.inputTokens,
			outputTokens: record.outputTokens,
			cacheReadTokens: record.cacheReadTokens,
			cacheWriteTokens: record.cacheWriteTokens,
			...steps !== void 0 ? { steps } : {},
			calls: steps !== void 0 ? steps : prev.calls,
			days: record.days,
			authority: "scan"
		};
		recomputeAggregates(store);
		return;
	}
	const authoritative = existing?.authority === "scan";
	const grewTokens = record.inputTokens > prev.inputTokens || record.outputTokens > prev.outputTokens || record.cacheReadTokens > prev.cacheReadTokens || record.cacheWriteTokens > prev.cacheWriteTokens;
	const reportedCalls = record.steps !== void 0 ? Math.max(prev.calls, record.steps) : prev.calls + (record.reset === true ? 0 : grewTokens ? 1 : 0);
	const next = authoritative ? prev : {
		inputTokens: Math.max(prev.inputTokens, record.inputTokens),
		outputTokens: Math.max(prev.outputTokens, record.outputTokens),
		cacheReadTokens: Math.max(prev.cacheReadTokens, record.cacheReadTokens),
		cacheWriteTokens: Math.max(prev.cacheWriteTokens, record.cacheWriteTokens),
		calls: reportedCalls
	};
	const days = existing?.days ?? {};
	const delta = {
		inputTokens: next.inputTokens - prev.inputTokens,
		outputTokens: next.outputTokens - prev.outputTokens,
		cacheReadTokens: next.cacheReadTokens - prev.cacheReadTokens,
		cacheWriteTokens: next.cacheWriteTokens - prev.cacheWriteTokens,
		calls: next.calls - prev.calls
	};
	const progressed = delta.inputTokens + delta.outputTokens + delta.cacheReadTokens + delta.cacheWriteTokens + delta.calls > 0;
	if (progressed) creditBucket(days, dayKey(record.ts), model, delta);
	const steps = record.steps !== void 0 ? record.steps : existing?.steps;
	store.bySession[sessionId] = {
		title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
		lastModel: model,
		lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
		...next,
		...steps !== void 0 ? { steps } : {},
		days,
		authority: existing?.authority ?? "live"
	};
	if (progressed) recomputeAggregates(store);
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
/**
* 日 -> 模型 -> 桶（按天算费用用；与 byDay / byModel 同源，恒等）。
* `store.byDay` 只保留「日 -> 桶」的合计，这里保留模型维度以便按天计价。
*/
function dayModelBuckets(store) {
	const out = {};
	for (const session of Object.values(store.bySession)) for (const [day, models] of Object.entries(session.days ?? {})) {
		if (day === "unattributed") continue;
		for (const [model, bucket] of Object.entries(models)) creditBucket(out, day, model, bucket);
	}
	return out;
}
/** 「日期未知」那部分用量折算的费用（元）：总额里含它、按天图表里不含它。 */
function unattributedCost(store) {
	let sum = 0;
	for (const session of Object.values(store.bySession)) for (const [model, bucket] of Object.entries(session.days?.["unattributed"] ?? {})) sum += estimateCost(model, bucket.inputTokens, bucket.outputTokens, bucket.cacheReadTokens, bucket.cacheWriteTokens);
	return sum;
}
/** 按模型估算费用（元，精确值；展示层最后舍入）。 */
function modelCosts(byModel) {
	return Object.fromEntries(Object.entries(byModel).map(([model, b]) => [model, estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens)]));
}
/** 按天估算费用（元）：Σ 该天各模型桶 × 模型单价。 */
function dayCosts(days) {
	const out = {};
	for (const [day, models] of Object.entries(days)) {
		let sum = 0;
		for (const [model, b] of Object.entries(models)) sum += estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens);
		out[day] = sum;
	}
	return out;
}
/**
* 单个会话的费用（元）：按该会话归属表**逐模型**计价。
*
* 不能用行上的单一 `lastModel` 计价：一个会话经常跨模型（实测某会话 1996 次
* deepseek-flash + 421 次 deepseek-v4-flash），而 `lastModel` 只是最后一条记录的
* 模型，甚至可能是 unknown —— 那样整段会话会被按通用档估价（1050M tokens 算成
* ¥28，真值近 ¥70）。逐模型计价与会话排行、模型分布、按天费用口径完全一致。
*/
function sessionCost(row) {
	let sum = 0;
	for (const models of Object.values(row.days ?? {})) for (const [model, b] of Object.entries(models)) sum += estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens);
	return sum;
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
	const steps = typeof raw.steps === "number" && Number.isFinite(raw.steps) ? Math.max(0, Math.round(raw.steps)) : void 0;
	if (inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens <= 0 && (steps ?? 0) <= 0 && raw.reset !== true) return void 0;
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
		...steps !== void 0 ? { steps } : {},
		reset: raw.reset === true
	};
}
/** 请求分发：POST /api/usage/record, GET /api/usage/summary, POST /api/usage/rescan。 */
function handle(req, res) {
	const url = new URL(req.url ?? "/", "http://dsh.local");
	if (url.pathname === `/api/usage/record` && req.method === "POST") {
		readBody(req).then(async (body) => {
			const record = normalizeRecord(JSON.parse(body));
			if (record === void 0) {
				sendJson(res, 200, {
					ok: true,
					skipped: true
				});
				return;
			}
			await withUsageWrite(() => {
				const store = readUsage();
				applyRecord(store, record);
				writeUsage(store);
			});
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
	if (url.pathname === `/api/usage/rescan` && req.method === "POST") {
		runScan(scanPersistence).then((scanned) => sendJson(res, 200, {
			ok: true,
			scanned
		})).catch((error) => sendJson(res, 502, {
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		}));
		return;
	}
	if (url.pathname === `/api/usage/summary` && req.method === "GET") {
		const store = readUsage();
		const round4 = (value) => Math.round(value * 1e4) / 1e4;
		const round2 = (value) => Math.round(value * 100) / 100;
		const perModel = modelCosts(store.byModel);
		const perDay = dayCosts(dayModelBuckets(store));
		const totalCost = Object.values(perModel).reduce((a, b) => a + b, 0);
		const sessions = sessionRanking(store, 20).map((s) => {
			const row = store.bySession[s.id];
			return {
				...s,
				cost: round4(row === void 0 ? 0 : sessionCost(row))
			};
		});
		const recent = recentDays(store, 14).map((d) => ({
			...d,
			cost: round4(perDay[d.day] ?? 0)
		}));
		sendJson(res, 200, {
			ok: true,
			total: store.total,
			byModel: store.byModel,
			recent,
			sessions,
			byDayCount: Object.keys(store.byDay).length,
			cost: {
				total: round2(totalCost),
				byModel: Object.fromEntries(Object.entries(perModel).map(([m, v]) => [m, round4(v)])),
				byDay: Object.fromEntries(Object.entries(perDay).map(([d, v]) => [d, round4(v)])),
				today: round4(perDay[dayKey(Date.now())] ?? 0),
				unattributed: round4(unattributedCost(store))
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
		const persistence = ctx.get?.("sessionPersistence");
		if (persistence !== void 0) {
			scanPersistence = persistence;
			runScan(persistence);
			const timer = setInterval(() => {
				runScan(persistence);
			}, SCAN_INTERVAL_MS);
			httpCtx.effect(() => () => {
				clearInterval(timer);
				scanPersistence = void 0;
			}, "ui-usage-dashboard: scan timer");
		} else console.warn("[usage-dashboard] sessionPersistence unavailable; all-session backfill disabled (recorder path stays on)");
		if (persistence !== void 0 && !canScan(persistence)) console.warn("[usage-dashboard] sessionPersistence has no readable API (expected list()+open() or listSnapshots()+readFrom()); all-session backfill disabled");
	});
}
//#endregion
export { UNATTRIBUTED_DAY, USAGE_API_PREFIX, USAGE_PRICING_API_PREFIX, USAGE_STORE_VERSION, apply, applyRecord, dayCosts, dayKey, dayModelBuckets, emptyUsage, migrateStore, modelCosts, name, normalizeRecord, readScanWatermark, readUsage, recentDays, recomputeAggregates, runScan, sessionCost, sessionRanking, unattributedCost, usagePath, usageScanPath, writeScanWatermark, writeUsage };
