/**
 * dsh-usage-dashboard 宿主半区。
 * 注册 `/api/usage/*` 路由：client 端把每次响应的 token 用量上报（POST
 * /api/usage/record），看板读取聚合数据（GET /api/usage/summary）。
 * 持久化到 `~/.dsh/usage.json`（与 aurora/pet/full-stats 同模式，绕开
 * /api 设置桥命名空间白名单）。
 *
 * 记录协议（replace + 基线对齐）：
 *  - 普通上报是"会话累计快照"（replace 语义：同会话以最新快照覆盖）。
 *  - `reset: true` 由客户端在建立基线时（首次见到会话/换会话/投影回退）随
 *    快照发出：宿主只替换 bySession 桶，不碰 day/model/total 与 calls。
 *    这样之后"新快照 - 该基线"的差值就是真实新增，宿主的快照无论多旧
 *    都不会把客户端早已错过的一段重复计入（H3/C1 家族）。
 * @module @captain1275/dsh-usage-dashboard
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { estimateCost } from './cost.ts'
import { mergeFreshSnapshot, pricingMeta, readUserPricingFile, userPricingPath, writeUserPricing } from './pricing.ts'
import type { PricingSnapshot } from './pricing-normalize.d.mts'
import { fetchLiteLLMPricing, normalizeLiteLLM, DEFAULT_FX } from './pricing-normalize.mjs'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-usage-dashboard'

/** 路由前缀。 */
export const USAGE_API_PREFIX = '/api/usage'

/** 一天的毫秒数（仅作兜底参考；recentDays 实际按本地日历日走）。 */
const DAY_MS = 24 * 60 * 60 * 1000

/** 客户端时间戳相对服务器时间的最大允许偏差（±48h，H6 越界回退 Date.now()）。 */
const MAX_TS_SKEW_MS = 48 * 60 * 60 * 1000

/** 单次记录（client 上报的一次响应 token 用量增量）。 */
export interface UsageRecord {
  /** 会话 id（client 侧唯一标识）。 */
  sessionId: string
  /** 会话标题（便于看板识别）。 */
  sessionTitle: string
  /** 模型标识（provider/model）。 */
  model: string
  /** 时间戳（ms）。 */
  ts: number
  /** 输入 token（不含缓存）。 */
  inputTokens: number
  /** 输出 token。 */
  outputTokens: number
  /** 缓存命中 token。 */
  cacheReadTokens: number
  /** 缓存写入 token（费用按快照 w / 输入价估算，见 cost.ts）。 */
  cacheWriteTokens: number
  /** 基线对齐标志：true 时宿主只替换 bySession 桶（H3/C1 家族）。 */
  reset?: boolean
}

/** 持久化聚合数据。 */
export interface UsageStore {
  /** 按会话聚合（存最新累计快照，replace 语义）。 */
  bySession: Record<string, {
    title: string
    lastModel: string
    lastTs: number
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    calls: number
  }>
  /** 按天聚合（YYYY-MM-DD）。 */
  byDay: Record<string, {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    calls: number
  }>
  /** 按模型聚合。 */
  byModel: Record<string, {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    calls: number
  }>
  /** 全量累计。 */
  total: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    calls: number
  }
}

/** 空聚合。 */
export function emptyUsage(): UsageStore {
  return { bySession: {}, byDay: {}, byModel: {}, total: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 } }
}

/** 配置文件路径：$DSH_HOME/usage.json。 */
export function usagePath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'usage.json')
}

/** 日期键（本地时区）。 */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * 读取聚合数据。
 * 文件缺失 → 空表；JSON 解析失败 / 形状非法 → 先把损坏文件改名备份为
 * `usage.json.corrupt-<ts>` 再回退空表，绝不"读坏 -> 写入空表 -> 旧数据
 * 永远消失"（H1）。
 */
export function readUsage(): UsageStore {
  const path = usagePath()
  let raw: string
  try {
    raw = readFileSync(path, 'utf8')
  } catch {
    // 文件不存在：正常空表。
    return emptyUsage()
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UsageStore>
    if (typeof parsed !== 'object' || parsed === null) return emptyUsage()
    return {
      bySession: parsed.bySession ?? {},
      byDay: parsed.byDay ?? {},
      byModel: parsed.byModel ?? {},
      total: parsed.total ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 },
    }
  } catch {
    // 损坏：备份原文件，回退空表（写盘走原子写，下一次写入不会破坏备份）。
    const backup = `${path}.corrupt-${Date.now()}`
    try {
      renameSync(path, backup)
      console.warn(`[usage-dashboard] usage.json is corrupt; backed up to ${backup}`)
    } catch {
      console.warn(`[usage-dashboard] usage.json is corrupt and could not be backed up: ${path}`)
    }
    return emptyUsage()
  }
}

/**
 * 写入聚合数据（原子写：先写同目录 `usage.json.tmp` 再 rename 覆盖，
 * 进程崩溃/断电不会留下截断的目标文件；H1）。
 * 失败至少 console.warn 一次，宿主不再误以为已持久化。
 */
export function writeUsage(store: UsageStore): void {
  const path = usagePath()
  const tmp = `${path}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8')
    renameSync(tmp, path)
  } catch (error) {
    console.warn('[usage-dashboard] writeUsage failed:', error instanceof Error ? error.message : String(error))
  }
}

/** 把一条记录并入聚合（replace 语义：同会话以最新快照覆盖，避免双计）。 */
export function applyRecord(store: UsageStore, record: UsageRecord): void {
  const sessionId = record.sessionId || 'default'

  if (record.reset === true) {
    // 基线对齐：客户端在建立基线（首次见到会话/换会话/投影回退）时发送。
    // 只替换 bySession 桶（最新累计快照），不碰 day/model/total 与 calls；
    // 之后该会话的增长差值严格等于真实新增，宿主旧快照再怎么落后也不会
    // 把"上次没传上来的一段"重复计入（H3/C1）。
    const existing = store.bySession[sessionId]
    store.bySession[sessionId] = {
      title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
      lastModel: record.model || existing?.lastModel || 'unknown',
      lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadTokens: record.cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens,
      calls: existing?.calls ?? 0,
    }
    return
  }

  const existing = store.bySession[sessionId]

  // Session bucket holds the LATEST cumulative snapshot (client uploads the
  // current totals). Replace, never accumulate — the dashboard sums the
  // snapshots at read time, so repeated polls cannot double count.
  const prevInput = existing?.inputTokens ?? 0
  const prevOutput = existing?.outputTokens ?? 0
  const prevCache = existing?.cacheReadTokens ?? 0
  const prevCacheWrite = existing?.cacheWriteTokens ?? 0

  // Day / model buckets: running deltas relative to the previous snapshot.
  // The first upload for a session contributes its full snapshot; later
  // uploads contribute only the growth (clamped at zero so a projection
  // reset cannot subtract). With the reset protocol the host baseline is
  // aligned with the client, so this delta is the true new usage and cannot
  // overcount gaps the host never saw.
  const dInput = Math.max(0, record.inputTokens - prevInput)
  const dOutput = Math.max(0, record.outputTokens - prevOutput)
  const dCache = Math.max(0, record.cacheReadTokens - prevCache)
  const dCacheWrite = Math.max(0, record.cacheWriteTokens - prevCacheWrite)
  // calls 语义是"真实响应轮数"：只有 token 实际增长的上报才算一轮。
  // 重放同一快照（页面刷新后的基线对齐、会话来回切换）不再虚增计数。
  const grew = dInput + dOutput + dCache + dCacheWrite > 0
  const session: UsageStore['bySession'][string] = {
    title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
    lastModel: record.model || existing?.lastModel || 'unknown',
    lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cacheReadTokens: record.cacheReadTokens,
    cacheWriteTokens: record.cacheWriteTokens,
    calls: (existing?.calls ?? 0) + (grew ? 1 : 0),
  }
  store.bySession[sessionId] = session

  if (!grew) return

  const day = dayKey(record.ts)
  const dayBucket = store.byDay[day] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 }
  dayBucket.inputTokens += dInput
  dayBucket.outputTokens += dOutput
  dayBucket.cacheReadTokens += dCache
  dayBucket.cacheWriteTokens = (dayBucket.cacheWriteTokens ?? 0) + dCacheWrite
  dayBucket.calls += 1
  store.byDay[day] = dayBucket

  const model = record.model || 'unknown'
  const modelBucket = store.byModel[model] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 }
  modelBucket.inputTokens += dInput
  modelBucket.outputTokens += dOutput
  modelBucket.cacheReadTokens += dCache
  modelBucket.cacheWriteTokens = (modelBucket.cacheWriteTokens ?? 0) + dCacheWrite
  modelBucket.calls += 1
  store.byModel[model] = modelBucket

  store.total.inputTokens += dInput
  store.total.outputTokens += dOutput
  store.total.cacheReadTokens += dCache
  store.total.cacheWriteTokens = (store.total.cacheWriteTokens ?? 0) + dCacheWrite
  store.total.calls += 1
}

/** 最近 N 天的按天序列（缺失日补零，便于画图）。 */
export function recentDays(store: UsageStore, days: number): Array<{ day: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; calls: number }> {
  const out: Array<{ day: string; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; calls: number }> = []
  // 按本地日历日递减（对每一步 setDate），消除 DST 造成的重复/跳过日期（H4）。
  const cursor = new Date()
  cursor.setDate(cursor.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const key = dayKey(cursor.getTime())
    const bucket = store.byDay[key]
    out.push({
      day: key,
      inputTokens: bucket?.inputTokens ?? 0,
      outputTokens: bucket?.outputTokens ?? 0,
      cacheReadTokens: bucket?.cacheReadTokens ?? 0,
      cacheWriteTokens: bucket?.cacheWriteTokens ?? 0,
      calls: bucket?.calls ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/** 会话排行（按总 token 降序）。 */
export function sessionRanking(store: UsageStore, limit: number): Array<{
  id: string
  title: string
  model: string
  lastTs: number
  totalTokens: number
  calls: number
}> {
  return Object.entries(store.bySession)
    .map(([id, s]) => ({
      id,
      title: s.title,
      model: s.lastModel,
      lastTs: s.lastTs,
      totalTokens: s.inputTokens + s.outputTokens + s.cacheReadTokens + (s.cacheWriteTokens ?? 0),
      calls: s.calls,
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, limit)
}

/** 发送 JSON 响应（防御：连接已关/已结束时静默跳过，避免写已销毁 socket 抛错，H7）。 */
function sendJson(res: ServerResponse, status: number, data: unknown): void {
  if (res.destroyed || res.writableEnded) return
  try {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(data))
  } catch {
    /* 连接已关闭，放弃写入 */
  }
}

/** 读取请求体（上限 1MB；超限 reject 并销毁连接，走 413 分支）。 */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let body = ''
    let tooLarge = false
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
      if (body.length > 1_000_000 && !tooLarge) {
        tooLarge = true
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!tooLarge) resolveBody(body)
    })
    req.on('error', reject)
  })
}

/** 规范化上报载荷。 */
export function normalizeRecord(raw: Partial<UsageRecord>): UsageRecord | undefined {
  const inputTokens = typeof raw.inputTokens === 'number' && Number.isFinite(raw.inputTokens) ? Math.max(0, Math.round(raw.inputTokens)) : 0
  const outputTokens = typeof raw.outputTokens === 'number' && Number.isFinite(raw.outputTokens) ? Math.max(0, Math.round(raw.outputTokens)) : 0
  const cacheReadTokens = typeof raw.cacheReadTokens === 'number' && Number.isFinite(raw.cacheReadTokens) ? Math.max(0, Math.round(raw.cacheReadTokens)) : 0
  const cacheWriteTokens = typeof raw.cacheWriteTokens === 'number' && Number.isFinite(raw.cacheWriteTokens) ? Math.max(0, Math.round(raw.cacheWriteTokens)) : 0
  // 基线对齐（reset）即使全 0 也要透传：宿主需要记下"客户端当前快照为 0"。
  const allZero = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens <= 0
  if (allZero && raw.reset !== true) return undefined
  // 时间戳可信窗口 ±48h：客户端时钟跳变/未来时间不污染 byDay（H6）。
  const now = Date.now()
  const rawTs = typeof raw.ts === 'number' && Number.isFinite(raw.ts) ? raw.ts : NaN
  const ts = Number.isFinite(rawTs) && Math.abs(rawTs - now) <= MAX_TS_SKEW_MS ? rawTs : now
  return {
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : 'default',
    sessionTitle: typeof raw.sessionTitle === 'string' ? raw.sessionTitle : '',
    model: typeof raw.model === 'string' ? raw.model : 'unknown',
    ts,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reset: raw.reset === true,
  }
}

/** 请求分发：POST /api/usage/record, GET /api/usage/summary。 */
function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname === `${USAGE_API_PREFIX}/record` && req.method === 'POST') {
    void readBody(req)
      .then((body) => {
        const parsed = JSON.parse(body) as Partial<UsageRecord>
        const record = normalizeRecord(parsed)
        if (record === undefined) {
          sendJson(res, 200, { ok: true, skipped: true })
          return
        }
        const store = readUsage()
        applyRecord(store, record)
        writeUsage(store)
        sendJson(res, 200, { ok: true, skipped: false })
      })
      .catch((e) => {
        const tooLarge = e instanceof Error && e.message === 'body too large'
        // 超限直接 413（连接已 destroy，sendJson 自带防御不会再抛）。
        sendJson(res, tooLarge ? 413 : 400, {
          ok: false,
          error: tooLarge ? 'request body too large' : (e instanceof Error ? e.message : String(e)),
        })
      })
    return
  }
  if (url.pathname === `${USAGE_API_PREFIX}/summary` && req.method === 'GET') {
    const store = readUsage()
    // 费用：先算精确值（estimateCost 不做中间舍入，M4），最后展示层一次舍入。
    const modelCosts = Object.fromEntries(
      Object.entries(store.byModel).map(([model, b]) => [
        model,
        estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens ?? 0),
      ]),
    )
    const totalCost = Object.values(modelCosts).reduce((a, b) => a + b, 0)
    const sessions = sessionRanking(store, 20).map((s) => {
      const bucket = store.bySession[s.id]
      const cost = estimateCost(s.model, bucket?.inputTokens ?? 0, bucket?.outputTokens ?? 0, bucket?.cacheReadTokens ?? 0, bucket?.cacheWriteTokens ?? 0)
      return { ...s, cost: Math.round(cost * 10_000) / 10_000 }
    })
    sendJson(res, 200, {
      ok: true,
      total: store.total,
      byModel: store.byModel,
      recent: recentDays(store, 14),
      sessions,
      byDayCount: Object.keys(store.byDay).length,
      cost: {
        total: Math.round(totalCost * 100) / 100,
        byModel: Object.fromEntries(Object.entries(modelCosts).map(([m, v]) => [m, Math.round(v * 10_000) / 10_000])),
      },
    })
    return
  }
  sendJson(res, 404, { ok: false, error: 'not found' })
}

/** 价目表路由前缀。 */
export const USAGE_PRICING_API_PREFIX = '/api/usage-pricing'

/**
 * 价目表请求分发：
 * - GET  /api/usage-pricing         当前生效表元信息（来源/更新时间/覆盖量）
 * - POST /api/usage-pricing/refresh 拉取 LiteLLM 最新价目并写用户级覆盖。
 *   refresh 要求 `content-type: application/json` 且 body 为可解析的 JSON
 *   对象（哪怕空对象）：no-cors 的跨站表单 POST 默认 text/plain 会被拒绝，
 *   是本机端口的 CSRF 防护（H8）。
 */
function handlePricing(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname === USAGE_PRICING_API_PREFIX && req.method === 'GET') {
    sendJson(res, 200, { ok: true, pricing: pricingMeta() })
    return
  }
  if (url.pathname === `${USAGE_PRICING_API_PREFIX}/refresh` && req.method === 'POST') {
    void (async (): Promise<void> => {
      const contentType = (req.headers['content-type'] ?? '').toLowerCase()
      if (!contentType.startsWith('application/json')) {
        sendJson(res, 415, { ok: false, error: 'content-type must be application/json' })
        return
      }
      const body = await readBody(req)
      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(body)
      } catch {
        parsedBody = undefined
      }
      if (typeof parsedBody !== 'object' || parsedBody === null) {
        sendJson(res, 400, { ok: false, error: 'body must be a JSON object' })
        return
      }
      const { text, url: sourceUrl } = await fetchLiteLLMPricing()
      const { snapshot, stats } = normalizeLiteLLM(text, DEFAULT_FX)
      snapshot._url = sourceUrl
      // 保留用户自定义条目（LiteLLM 快照里没有的模型/别名），
      // 避免一次刷新把手写的 k3-256k 等条目冲掉（与 CLI 共用 mergeFreshSnapshot）。
      const existing: PricingSnapshot | null = readUserPricingFile()
      const path = writeUserPricing(mergeFreshSnapshot(existing, snapshot))
      sendJson(res, 200, { ok: true, pricing: pricingMeta(), stats, path })
    })().catch((error) => {
      const tooLarge = error instanceof Error && error.message === 'body too large'
      sendJson(res, tooLarge ? 413 : 502, {
        ok: false,
        error: tooLarge ? 'request body too large' : (error instanceof Error ? error.message : String(error)),
      })
    })
    return
  }
  sendJson(res, 404, { ok: false, error: 'not found' })
}

/** 宿主插件体：注册配置路由（无 webServer 服务时为空操作）。 */
export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (httpCtx) => {
    const dispose = httpCtx.webServer.register({ kind: 'prefix', path: USAGE_API_PREFIX, handler: handle })
    httpCtx.effect(() => dispose, 'ui-usage-dashboard: usage route')
    const disposePricing = httpCtx.webServer.register({ kind: 'prefix', path: USAGE_PRICING_API_PREFIX, handler: handlePricing })
    httpCtx.effect(() => disposePricing, 'ui-usage-dashboard: pricing route')
  })
}