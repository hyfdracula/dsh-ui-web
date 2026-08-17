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
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { DEFAULT_FX, mergeFreshSnapshot } from './pricing-normalize.mjs'
import type { PricingSnapshot } from './pricing-normalize.d.mts'

export { mergeFreshSnapshot } from './pricing-normalize.mjs'

/** 空快照（文件缺失/损坏时的兜底）。 */
const EMPTY_SNAPSHOT: PricingSnapshot = {
  _source: 'none',
  _unit: 'CNY per 1M tokens',
  _fx: 7.2,
  _fetchedAt: '',
  models: {},
  aliases: {},
}

/** 包内置快照路径（lib/index.js 旁一路向上到包根）。 */
export function builtinPricingPath(): string {
  return fileURLToPath(new URL('../pricing-default.json', import.meta.url))
}

/** 用户级覆盖路径：$DSH_HOME/usage-pricing.json。 */
export function userPricingPath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'usage-pricing.json')
}

/** 生效表来源标记。 */
export type PricingOrigin = 'user' | 'builtin' | 'empty'

/** 生效表 + 元信息。 */
export interface PricingTable {
  origin: PricingOrigin
  path: string | null
  snapshot: PricingSnapshot
}

/**
 * 校验快照形状（宽松：models 或 aliases 至少一个为对象即可，P2）。
 * 只写 models 的手写覆盖（无 aliases 字段）不算损坏；
 * 只有 JSON 解析失败（或完全非对象）才整文件回退。
 */
function isSnapshot(value: unknown): value is PricingSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PricingSnapshot>
  const modelsOk = typeof candidate.models === 'object' && candidate.models !== null && !Array.isArray(candidate.models)
  const aliasesOk = typeof candidate.aliases === 'object' && candidate.aliases !== null && !Array.isArray(candidate.aliases)
  return modelsOk || aliasesOk
}

/** 读取并归一化一个快照文件；缺失/损坏返回 null（不完整但合法的形状按缺失字段补空对象）。 */
function readSnapshot(path: string): PricingSnapshot | null {
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // 只有 JSON 解析失败才整文件回退 —— 下一轮 refresh 会以合并结果
    // 覆盖该文件，但读侧绝不把"不完整但合法"的文件当损坏处理（P2）。
    return null
  }
  if (!isSnapshot(parsed)) return null
  const candidate = parsed as Partial<PricingSnapshot>
  return {
    _source: typeof candidate._source === 'string' ? candidate._source : 'unknown',
    _unit: typeof candidate._unit === 'string' ? candidate._unit : 'CNY per 1M tokens',
    _fx: typeof candidate._fx === 'number' && Number.isFinite(candidate._fx) ? candidate._fx : DEFAULT_FX,
    _fetchedAt: typeof candidate._fetchedAt === 'string' ? candidate._fetchedAt : '',
    _url: typeof candidate._url === 'string' ? candidate._url : undefined,
    models: typeof candidate.models === 'object' && candidate.models !== null ? candidate.models : {},
    aliases: typeof candidate.aliases === 'object' && candidate.aliases !== null ? candidate.aliases : {},
  }
}

/** 读取用户级覆盖文件；缺失/损坏返回 null（形状校验宽松，宿主刷新路由复用）。 */
export function readUserPricingFile(): PricingSnapshot | null {
  return readSnapshot(userPricingPath())
}

let cache: PricingTable | null = null

/** 读取当前生效价目表（进程内缓存；刷新后需 invalidate）。 */
export function loadPricing(): PricingTable {
  if (cache !== null) return cache
  const builtinPath = builtinPricingPath()
  const fromBuiltin = readSnapshot(builtinPath)
  const userPath = userPricingPath()
  const fromUser = readSnapshot(userPath)
  if (fromUser !== null) {
    // 合并语义：内置快照打底，用户条目覆盖/新增。这样 usage-pricing.json
    // 可以只写少量自定义条目（如 k3-256k），其余模型仍吃内置表——整表
    // 替换会把没写进用户文件的模型全部打回通用档。
    const base = fromBuiltin ?? EMPTY_SNAPSHOT
    cache = {
      origin: 'user',
      path: userPath,
      snapshot: {
        ...fromUser,
        models: { ...base.models, ...fromUser.models },
        aliases: { ...base.aliases, ...fromUser.aliases },
      },
    }
    return cache
  }
  if (fromBuiltin !== null) {
    cache = { origin: 'builtin', path: builtinPath, snapshot: fromBuiltin }
    return cache
  }
  cache = { origin: 'empty', path: null, snapshot: EMPTY_SNAPSHOT }
  return cache
}

/** 价目缓存失效（刷新写入后调用）。 */
export function invalidatePricingCache(): void {
  cache = null
}

/** 写入用户级覆盖（刷新路由/CLI 共用）。 */
export function writeUserPricing(snapshot: PricingSnapshot): string {
  const path = userPricingPath()
  writeFileSync(path, JSON.stringify(snapshot), 'utf8')
  invalidatePricingCache()
  return path
}

/** 对外展示的元信息。 */
export interface PricingMeta {
  origin: PricingOrigin
  updatedAt: string
  fx: number
  unit: string
  source: string
  providers: number
  models: number
  aliases: number
}

/** 汇总当前生效表的元信息。 */
export function pricingMeta(): PricingMeta {
  const table = loadPricing()
  const keys = Object.keys(table.snapshot.models)
  return {
    origin: table.origin,
    updatedAt: table.snapshot._fetchedAt,
    fx: table.snapshot._fx,
    unit: table.snapshot._unit,
    source: table.snapshot._source,
    providers: new Set(keys.map((key) => key.split('/')[0])).size,
    models: keys.length,
    aliases: Object.keys(table.snapshot.aliases).length,
  }
}
