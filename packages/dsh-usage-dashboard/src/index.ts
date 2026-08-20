/**
 * dsh-usage-dashboard 宿主半区。
 * 注册 `/api/usage/*` 路由：client 端把每次响应的 token 用量上报（POST
 * /api/usage/record），看板读取聚合数据（GET /api/usage/summary）。
 * 持久化到 `~/.dsh/usage.json`（与 aurora/pet/full-stats 同模式，绕开
 * /api 设置桥命名空间白名单）。
 *
 * 记录协议（replace + 基线对齐 + 补差）：
 *  - 普通上报是"会话累计快照"（replace 语义：同会话以最新快照覆盖）。
 *  - `reset: true` 由客户端在建立基线时（首次见到会话/换会话/投影回退）随
 *    快照发出：宿主替换 bySession 桶，并把"真实新增差额"（相对宿主旧快照）
 *    一并并入 day/model/total —— 即「补差」，把页面关闭/离屏期间宿主没见到的
 *    用量找补回来。
 *
 * 全会话扫描（subagent / AgentTeams / headless 子会话）：
 *  recorder 只挂前台打开的会话，子会话从不前台 —— 本插件额外通过
 *  `ctx.sessionPersistence` 枚举全部持久日志（listSnapshots 水位增量 +
 *  readFrom 折日志），把子会话用量也 replace+补差 并入看板（POST
 *  /api/usage/rescan 手动触发，插件启动后立即全量补录一次，之后 60s 增量）。
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
import { scanAndBackfill, scanTitle, type ScanHeader, type PersistenceLike } from './scan.ts'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-usage-dashboard'

/** 路由前缀。 */
export const USAGE_API_PREFIX = '/api/usage'

/** 一天的毫秒数（仅作兜底参考；recentDays 实际按本地日历日走）。 */
const DAY_MS = 24 * 60 * 60 * 1000

/** 客户端时间戳相对服务器时间的最大允许偏差（±48h，H6 越界回退 Date.now()）。 */
const MAX_TS_SKEW_MS = 48 * 60 * 60 * 1000

/** 全会话扫描间隔（ms）。 */
const SCAN_INTERVAL_MS = 60_000

/** 会话扫描水位文件（独立于 usage.json，避免与 record 互相写脏）。 */
const SCAN_WATERMARK_FILENAME = 'usage-scan.json'

/**
 * 宿主侧全部「读 usage.json -> 改 -> 写 usage.json」的串行队列：record 上报
 * 与全会话扫描共享，避免并发 read-modify-write 相互覆盖丢更新。
 */
let usageWriteChain: Promise<void> = Promise.resolve()

/** apply 注入的 sessionPersistence 引用（handle 的 rescan 分支读取）。 */
let scanPersistence: PersistenceLike | undefined

/** 扫描进行中标志（定时与手动触发去重）。 */
let scanning = false

/** 写串行链：排队执行一次 usage.json 读改写。 */
function withUsageWrite<T>(task: () => T): Promise<T> {
  const run = usageWriteChain.then(() => task())
  usageWriteChain = run.then(() => undefined, () => undefined)
  return run
}

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
  /**
   * 会话累计真实响应数：client 从 sessionStats 投影取的整个已关闭 step 数
   * （含失败/取消，近似 API 调用次数）。携带时 host 按「新 steps - 旧
   * bySession.steps」计 calls 增量，替换旧「每轮 flush 批次 +1」口径
   * （后者对多步 agent 运行/离屏会话严重偏低）。缺失时回退旧语义。
   */
  steps?: number
  /** 基线对齐标志：true 时宿主替换 bySession 桶，并把「真实新增差额」一并并入汇总（H3/C1 家族）。 */
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
    /** 会话累计真实响应数（steps 语义；旧数据/未带 steps 的记录无此字段）。 */
    steps?: number
    /** 展示用调用数：带 steps 的记录 = 最新 steps；否则旧「观测批次」计数。 */
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

/** 会话扫描水位文件路径（$DSH_HOME/usage-scan.json）。 */
export function usageScanPath(): string {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), SCAN_WATERMARK_FILENAME)
}

/** 读扫描水位（sessionId -> revision）；缺失/损坏回退空表。 */
export function readScanWatermark(): Record<string, string> {
  try {
    const parsed = JSON.parse(readFileSync(usageScanPath(), 'utf8')) as unknown
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {
    /* 缺失或损坏：全量重扫 */
  }
  return {}
}

/** 写扫描水位（原子写）。 */
export function writeScanWatermark(watermark: Record<string, string>): void {
  const path = usageScanPath()
  try {
    writeFileSync(`${path}.tmp`, JSON.stringify(watermark), 'utf8')
    renameSync(`${path}.tmp`, path)
  } catch (error) {
    console.warn('[usage-dashboard] writeScanWatermark failed:', error instanceof Error ? error.message : String(error))
  }
}

/**
 * 跑一次全会话扫描并补差并入 usage.json。
 * 队列化（withUsageWrite）避免与 record 并发读改写冲突；`limit` 为单次最大
 * 会话处理数（0 = 不限）。返回本次并入的会话数（0 = 无变化）。
 */
export async function runScan(persistence: PersistenceLike | undefined, limit = 0): Promise<number> {
  if (persistence === undefined || scanning) return 0
  scanning = true
  try {
    const known = readScanWatermark()
    const res = await scanAndBackfill(persistence, known, limit)
    if (res.outcomes.length === 0 || res.outcomes.reduce((acc, o) => acc + o.inputTokens + o.outputTokens + o.cacheReadTokens + o.cacheWriteTokens + o.steps, 0) === 0) {
      // 没有真实新增：只推进水位（新会话数变化也要记 revision，避免反复扫）。
      writeScanWatermark(res.revisions)
      return 0
    }
    const backfilled = await withUsageWrite(() => {
      const store = readUsage()
      for (const o of res.outcomes) {
        const existing = store.bySession[o.sessionId]
        const header: ScanHeader = { id: o.sessionId, origin: o.isSubagent ? 'subagent' : undefined }
        const record: UsageRecord = {
          sessionId: o.sessionId,
          // 已有标题保留，新会话用生成的（根/子会话标记）。
          sessionTitle: existing === undefined ? scanTitle(header) : '',
          model: o.model || 'unknown',
          ts: Date.now(),
          inputTokens: o.inputTokens,
          outputTokens: o.outputTokens,
          cacheReadTokens: o.cacheReadTokens,
          cacheWriteTokens: o.cacheWriteTokens,
          steps: o.steps,
          reset: true,
        }
        applyRecord(store, record)
      }
      writeUsage(store)
      return res.outcomes.length
    })
    writeScanWatermark(res.revisions)
    return backfilled
  } finally {
    scanning = false
  }
}

/** 把一条记录并入聚合（replace 语义：同会话以最新快照覆盖，避免双计）。 */
export function applyRecord(store: UsageStore, record: UsageRecord): void {
  const sessionId = record.sessionId || 'default'
  const existing = store.bySession[sessionId]

  // 相对宿主已存会话快照的「真实新增 token」（无论 reset 还是普通上报都取
  // 新快照 - 旧快照，钳零：投影回退/重放/重复上报既不会扣减也不会双计）。
  const prevInput = existing?.inputTokens ?? 0
  const prevOutput = existing?.outputTokens ?? 0
  const prevCache = existing?.cacheReadTokens ?? 0
  const prevCacheWrite = existing?.cacheWriteTokens ?? 0
  const dInput = Math.max(0, record.inputTokens - prevInput)
  const dOutput = Math.max(0, record.outputTokens - prevOutput)
  const dCache = Math.max(0, record.cacheReadTokens - prevCache)
  const dCacheWrite = Math.max(0, record.cacheWriteTokens - prevCacheWrite)
  const grewTokens = dInput + dOutput + dCache + dCacheWrite > 0

  // 「真实新增响应数」：
  //  - 客户端带 steps → 按 steps 差值（真实已关闭 step 数，含失败/取消）。
  //  - 不带 steps（旧客户端/投影缺失）→ 回退旧语义：普通上报有 token 增长 +1，reset 不加。
  const dSteps = record.steps !== undefined ? Math.max(0, record.steps - (existing?.steps ?? 0)) : 0
  const dCalls = record.steps !== undefined ? dSteps : (record.reset === true ? 0 : (grewTokens ? 1 : 0))

  const progressed = grewTokens || dCalls > 0

  // bySession：最新累计快照（replace 语义）。
  const steps = record.steps !== undefined ? record.steps : existing?.steps
  store.bySession[sessionId] = {
    title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
    lastModel: record.model || existing?.lastModel || 'unknown',
    lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cacheReadTokens: record.cacheReadTokens,
    cacheWriteTokens: record.cacheWriteTokens,
    ...steps !== undefined ? { steps } : {},
    calls: record.steps !== undefined
      ? record.steps
      : (existing?.calls ?? 0) + (record.reset === true ? 0 : (grewTokens ? 1 : 0)),
  }

  // 汇总并入（day / model / total）：
  //  - 普通上报：真实新增并入（旧 replace+delta 语义，保持）。
  //  - reset：也并入 —— 「补差」。客户端基线对齐时，若当前累计比宿主旧快照大，
  //    说明存在一段宿主没见到的真实用量（页面关闭/离屏期间/上次 flush 丢失），
  //    把它补进 day/model/total。旧版本 reset 完全不碰汇总 —— 这正是系统性少记
  //    的来源之一。差值钳零、只在有新增时并入，重复 reset（快照相等）什么都不会加；
  //    归日按上传时间（record.ts），所以历史缺失量会落在「打开那一刻」那天 ——
  //    这是拿不到真实消耗时刻时的最佳近似。
  if (!progressed) return

  const day = dayKey(record.ts)
  const dayBucket = store.byDay[day] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 }
  dayBucket.inputTokens += dInput
  dayBucket.outputTokens += dOutput
  dayBucket.cacheReadTokens += dCache
  dayBucket.cacheWriteTokens = (dayBucket.cacheWriteTokens ?? 0) + dCacheWrite
  dayBucket.calls += dCalls
  store.byDay[day] = dayBucket

  const model = record.model || 'unknown'
  const modelBucket = store.byModel[model] ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 }
  modelBucket.inputTokens += dInput
  modelBucket.outputTokens += dOutput
  modelBucket.cacheReadTokens += dCache
  modelBucket.cacheWriteTokens = (modelBucket.cacheWriteTokens ?? 0) + dCacheWrite
  modelBucket.calls += dCalls
  store.byModel[model] = modelBucket

  store.total.inputTokens += dInput
  store.total.outputTokens += dOutput
  store.total.cacheReadTokens += dCache
  store.total.cacheWriteTokens = (store.total.cacheWriteTokens ?? 0) + dCacheWrite
  store.total.calls += dCalls
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
  const steps = typeof raw.steps === 'number' && Number.isFinite(raw.steps) ? Math.max(0, Math.round(raw.steps)) : undefined
  // 全 0 且不带 steps 的上报直接丢弃（纯重放）；但 steps>0（如失败请求
  // token 为 0 只贡献调用数）和 reset（基线可能为 0）要透传。
  const allZero = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens <= 0 && (steps ?? 0) <= 0
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
    ...steps !== undefined ? { steps } : {},
    reset: raw.reset === true,
  }
}

/** 请求分发：POST /api/usage/record, GET /api/usage/summary, POST /api/usage/rescan。 */
function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname === `${USAGE_API_PREFIX}/record` && req.method === 'POST') {
    void readBody(req)
      .then(async (body) => {
        const parsed = JSON.parse(body) as Partial<UsageRecord>
        const record = normalizeRecord(parsed)
        if (record === undefined) {
          sendJson(res, 200, { ok: true, skipped: true })
          return
        }
        // 走写串行链，与全会话扫描排队，避免 read-modify-write 竞态。
        await withUsageWrite(() => {
          const store = readUsage()
          applyRecord(store, record)
          writeUsage(store)
        })
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
  if (url.pathname === `${USAGE_API_PREFIX}/rescan` && req.method === 'POST') {
    // 手动触发全会话扫描补录（含 subagent / AgentTeams / headless 子会话）。
    void runScan(scanPersistence)
      .then((scanned) => sendJson(res, 200, { ok: true, scanned }))
      .catch((error: unknown) => sendJson(res, 502, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }))
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

    // 全会话扫描（subagent / AgentTeams / headless 子会话补录）：
    // 通过 ctx.get 取 sessionPersistence（web profile 由 dsh-base 提供），拿不到就
    // 静默降级（只保留 recorder 上报路径，不扫描）。
    const persistence = (ctx as { get?: (name: string) => unknown }).get?.('sessionPersistence') as PersistenceLike | undefined
    if (persistence !== undefined) {
      scanPersistence = persistence
      // 立即全量补录一次（把历史缺失的子会话用量一次性并入），之后按修订增量。
      void runScan(persistence)
      const timer = setInterval(() => { void runScan(persistence) }, SCAN_INTERVAL_MS)
      httpCtx.effect(() => () => {
        clearInterval(timer)
        scanPersistence = undefined
      }, 'ui-usage-dashboard: scan timer')
    } else {
      console.warn('[usage-dashboard] sessionPersistence unavailable; all-session backfill disabled (recorder path stays on)')
    }
  })
}