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
import type { PricingEntry, PricingSnapshot } from './pricing-normalize.d.mts'

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

/** 校验快照形状（宽松：models/aliases 是对象即可）。 */
function isSnapshot(value: unknown): value is PricingSnapshot {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PricingSnapshot>
  return typeof candidate.models === 'object' && candidate.models !== null
    && typeof candidate.aliases === 'object' && candidate.aliases !== null
}

function readSnapshot(path: string): PricingSnapshot | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return isSnapshot(parsed) ? parsed : null
  } catch {
    return null
  }
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

/**
 * 刷新合并：LiteLLM 全量快照打底，把现有用户文件里"新快照没有的"条目
 * （自定义模型价，如 k3-256k / kimi-for-coding-highspeed）原样保留。
 * 否则一次 refresh 会把手工维护的条目全部冲掉、打回通用兜底价。
 * 新快照里已有的同名条目以官方最新价为准（自定义价想压过官方价，
 * 刷新后再改 usage-pricing.json 即可）。
 */
export function mergeFreshSnapshot(existing: PricingSnapshot | null, fresh: PricingSnapshot): PricingSnapshot {
  if (existing === null) return fresh
  const customModels: Record<string, PricingEntry> = {}
  for (const [key, value] of Object.entries(existing.models)) {
    if (!(key in fresh.models)) customModels[key] = value
  }
  const customAliases: Record<string, string> = {}
  for (const [key, value] of Object.entries(existing.aliases)) {
    if (!(key in fresh.aliases)) customAliases[key] = value
  }
  if (Object.keys(customModels).length === 0 && Object.keys(customAliases).length === 0) return fresh
  return {
    ...fresh,
    models: { ...fresh.models, ...customModels },
    aliases: { ...fresh.aliases, ...customAliases },
  }
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
