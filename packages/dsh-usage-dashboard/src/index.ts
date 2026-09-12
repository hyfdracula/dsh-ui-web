/**
 * dsh-usage-dashboard 宿主半区。
 * 注册 `/api/usage/*` 路由：client 端把每次响应的 token 用量上报（POST
 * /api/usage/record），看板读取聚合数据（GET /api/usage/summary）。
 * 持久化到 `~/.dsh/usage.json`（与 aurora/pet/full-stats 同模式，绕开
 * /api 设置桥命名空间白名单）。
 *
 * 记录协议（v2：单账本 + 派生聚合）：
 *  - `bySession` 是**唯一真相**：每行带一张 `days`（日 -> 模型 -> 桶）归属表，
 *    会话行 token 合计恒等于该表之和（写入时同步更新，构造上不会漂移）。
 *  - `byDay / byModel / total` **不落盘**，读时从会话行派生
 *    （`recomputeAggregates`）。v1 把它们当独立累加器，只要客户端会话投影与
 *    宿主日志 fold 对同一会话报出不同数字，差值就被反复重加 —— 实测总费用
 *    虚高 3 倍。派生之后不可能再漂移。
 *  - 普通上报只更新标题/模型/时间/steps 与单调取大的 token 增量；`reset: true`
 *    由客户端在建立基线时（首次见到会话/换会话/投影回退）发出，用于对齐基线。
 *  - **权威记录**：带 `days` 的上报只可能来自会话日志扫描，宿主整行替换该会话
 *    并把 authority 标为 `scan`；此后该会话的 token/调用数不再接受 recorder
 *    上报值（日志是唯一真相），从根上消除两端口径分叉。日志缺失的会话保持
 *    `live`，继续按上报增量记账。
 *
 * 全会话扫描（subagent / AgentTeams / headless 子会话）：
 *  recorder 只挂前台打开的会话，子会话从不前台 —— 本插件额外通过
 *  `ctx.sessionPersistence` 枚举全部持久日志（listSnapshots 水位增量 +
 *  readFrom 折日志），把子会话用量按**事件真实时间**归属到日/模型后整行并入
 *  看板（POST /api/usage/rescan 手动触发，插件启动后立即全量补录一次，
 *  之后 60s 增量）。
 * @module @captain1275/dsh-usage-dashboard
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { estimateCost } from './cost.ts'
import { mergeFreshSnapshot, pricingMeta, readUserPricingFile, writeUserPricing } from './pricing.ts'
import type { PricingSnapshot } from './pricing-normalize.d.mts'
import { fetchLiteLLMPricing, normalizeLiteLLM, DEFAULT_FX } from './pricing-normalize.mjs'
import { canScan, creditBucket, emptyBucket, scanAndBackfill, scanTitle, type DayModelBuckets, type PersistenceLike, type ScanHeader, type TokenBucket } from './scan.ts'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-usage-dashboard'

/** 路由前缀。 */
export const USAGE_API_PREFIX = '/api/usage'

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
  /**
   * 用量真实归属（日 -> 模型 -> 桶）。**只有全会话日志扫描会带**：带上即代表
   * 这是一条权威记录，宿主整行替换会话（累计 token / calls / 归属全以日志
   * fold 为准），并把该会话标记为 `authority: 'scan'`。
   */
  days?: DayModelBuckets
}

/**
 * 一个桶的 token/调用计数。宿主半区复用 scan 的桶形状，保证两端同一口径。
 */
export type { DayModelBuckets, TokenBucket } from './scan.ts'

/** 会话行：唯一真相（所有聚合都由它派生，见 recomputeAggregates）。 */
export interface SessionEntry {
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
  /**
   * 用量真实归属：本地日历日 -> 模型 -> 桶。
   * 趋势图、模型分布、按天费用全部由它派生；会话行 token 合计必须等于
   * 它各项之和（同一次写入同时更新两者，构造上不会漂移）。
   */
  days: DayModelBuckets
  /**
   * 该会话 token 数据的权威来源：
   * - `scan`：全会话日志扫描已覆盖（日志是唯一真相，recorder 的累计值不再
   *   参与 token 记账，只更新标题/模型/steps）。
   * - `live`：只有 recorder 上报（日志缺失/持久化不可用），按增量记账。
   * 旧数据迁移时按 `live` 处理，等首次全量扫描后转 `scan`。
   */
  authority: 'scan' | 'live'
}

/** 持久化聚合数据（v2：只落盘 bySession，聚合读时派生）。 */
export interface UsageStore {
  /** 存储版本（1 = 旧的双账本；2 = 单账本 + 派生聚合）。 */
  version: number
  /** 按会话聚合（唯一真相）。 */
  bySession: Record<string, SessionEntry>
  /** 按天聚合（派生，不落盘）。 */
  byDay: Record<string, TokenBucket>
  /** 按模型聚合（派生，不落盘）。 */
  byModel: Record<string, TokenBucket>
  /** 全量累计（派生，不落盘）。 */
  total: TokenBucket
}

/** 当前存储版本。 */
export const USAGE_STORE_VERSION = 2

/**
 * 「日期未知」归属键：v1 迁移时旧数据只有会话累计、没有按天归属，先整段记到
 * 这个键下 —— 它参与 `total` 与 `byModel`（总额/模型分布不丢），但**不进**
 * `byDay`（宁可不显示，也不把整个会话的历史伪造成"迁移那天"的用量）。
 * 首次全量扫描按日志事件时间重建真实归属后，这批兜底数据即被整行替换。
 */
export const UNATTRIBUTED_DAY = 'unattributed'

/** 空聚合。 */
export function emptyUsage(): UsageStore {
  return {
    version: USAGE_STORE_VERSION,
    bySession: {},
    byDay: {},
    byModel: {},
    total: emptyBucket(),
  }
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
export function recomputeAggregates(store: UsageStore): void {
  const byDay: Record<string, TokenBucket> = {}
  const byModel: Record<string, TokenBucket> = {}
  const total = emptyBucket()
  const add = (target: Record<string, TokenBucket>, key: string, source: TokenBucket): void => {
    const bucket = target[key] ?? (target[key] = emptyBucket())
    bucket.inputTokens += source.inputTokens
    bucket.outputTokens += source.outputTokens
    bucket.cacheReadTokens += source.cacheReadTokens
    bucket.cacheWriteTokens += source.cacheWriteTokens
    bucket.calls += source.calls
  }
  for (const session of Object.values(store.bySession)) {
    total.inputTokens += session.inputTokens
    total.outputTokens += session.outputTokens
    total.cacheReadTokens += session.cacheReadTokens
    total.cacheWriteTokens += session.cacheWriteTokens
    total.calls += session.calls
    for (const [day, models] of Object.entries(session.days ?? {})) {
      for (const [model, bucket] of Object.entries(models)) {
        // 「日期未知」只进模型维度：总额与模型分布不丢，但不伪造某一天的用量。
        if (day !== UNATTRIBUTED_DAY) add(byDay, day, bucket)
        add(byModel, model, bucket)
      }
    }
  }
  store.byDay = byDay
  store.byModel = byModel
  store.total = total
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
 *
 * v1（双账本：bySession 覆盖 + byDay/byModel/total 各自累加）在读取时一次性
 * 迁移到 v2：旧文件先改名备份为 `usage.json.v1-<ts>`，聚合桶整体丢弃（它们
 * 已被重复计数污染且无法还原），`byDay/byModel` 改由会话行派生；同时清空扫描
 * 水位，让下一次全会话扫描按日志重建真实归属。
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
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
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
  if (typeof parsed !== 'object' || parsed === null) return emptyUsage()
  const store = migrateStore(parsed as Record<string, unknown>, path)
  recomputeAggregates(store)
  return store
}

/**
 * 归一化/迁移已解析的存储对象（纯函数，便于单测）。
 * 逐会话补齐 `days` 与 `authority`：缺 `days` 的旧行按 `lastTs` 那一天 +
 * `lastModel` 建一个兜底桶，保证「会话合计 == 归属合计」这一恒等式成立
 * （真实归属等全量扫描用日志重建）。
 */
export function migrateStore(parsed: Record<string, unknown>, path?: string): UsageStore {
  const version = typeof parsed.version === 'number' ? parsed.version : 1
  const rawSessions = typeof parsed.bySession === 'object' && parsed.bySession !== null
    ? parsed.bySession as Record<string, Partial<SessionEntry>>
    : {}
  const store = emptyUsage()
  for (const [id, row] of Object.entries(rawSessions)) {
    if (typeof row !== 'object' || row === null) continue
    const bucket: TokenBucket = {
      inputTokens: number(rawInput(row, 'inputTokens')),
      outputTokens: number(rawInput(row, 'outputTokens')),
      cacheReadTokens: number(rawInput(row, 'cacheReadTokens')),
      cacheWriteTokens: number(rawInput(row, 'cacheWriteTokens')),
      calls: number(rawInput(row, 'calls')),
    }
    const days: DayModelBuckets = typeof row.days === 'object' && row.days !== null
      ? row.days as DayModelBuckets
      : { [UNATTRIBUTED_DAY]: { [typeof row.lastModel === 'string' && row.lastModel !== '' ? row.lastModel : 'unknown']: { ...bucket } } }
    store.bySession[id] = {
      title: typeof row.title === 'string' && row.title !== '' ? row.title : `会话 ${id.slice(0, 8)}`,
      lastModel: typeof row.lastModel === 'string' && row.lastModel !== '' ? row.lastModel : 'unknown',
      lastTs: number(row.lastTs),
      ...bucket,
      ...(typeof row.steps === 'number' ? { steps: row.steps } : {}),
      days,
      authority: row.authority === 'scan' ? 'scan' : 'live',
    }
  }
  if (version < USAGE_STORE_VERSION) {
    // v1 → v2：备份旧文件（含被污染的聚合桶，留档可查），并强制一次全量重建。
    if (path !== undefined) {
      const backup = `${path}.v1-${Date.now()}`
      try {
        renameSync(path, backup)
        writeUsage(store)
        writeScanWatermark({})
        console.warn(`[usage-dashboard] usage.json migrated to v${USAGE_STORE_VERSION}; old file kept at ${backup}; full rescan queued to rebuild per-day attribution`)
      } catch (error) {
        console.warn('[usage-dashboard] usage.json migration backup failed:', error instanceof Error ? error.message : String(error))
      }
    }
  }
  return store
}

/** 读字段的宽松数值转换（非有限值 → 0）。 */
function number(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** 读旧行字段（v1 行没有 days/authority）。 */
function rawInput(row: Partial<SessionEntry>, key: keyof TokenBucket): number {
  return number(row[key])
}

/**
 * 写入聚合数据（原子写：先写同目录 `usage.json.tmp` 再 rename 覆盖，
 * 进程崩溃/断电不会留下截断的目标文件；H1）。
 * 只落盘 `version` + `bySession`（唯一真相）；聚合桶读时派生，落盘反而会
 * 制造第二份可能漂移的账（v1 的教训）。
 * 失败至少 console.warn 一次，宿主不再误以为已持久化。
 */
export function writeUsage(store: UsageStore): void {
  const path = usagePath()
  const tmp = `${path}.tmp`
  try {
    writeFileSync(tmp, JSON.stringify({ version: USAGE_STORE_VERSION, bySession: store.bySession }, null, 2), 'utf8')
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
    // 先读一次账本：v1 -> v2 迁移会在这里落地（迁移同时清空扫描水位），
    // 必须排在读水位之前，否则本轮的"全量重建"会被旧水位挡住。
    readUsage()
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
        // exactOptionalPropertyTypes 下不能显式赋 undefined，按需展开字段。
        const header: ScanHeader = { id: o.sessionId, ...o.isSubagent ? { origin: 'subagent' } : {} }
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
          // 权威归属：日志 fold 出来的「日 -> 模型 -> 桶」，整行替换该会话。
          days: o.days,
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
export function applyRecord(store: UsageStore, record: UsageRecord): void {
  const sessionId = record.sessionId || 'default'
  const existing = store.bySession[sessionId]
  // 上报里的空串/'unknown' 视为「这次没有模型信息」：客户端模型轮询失败时会这么
  // 报，若直接采信就会把扫描 fold 出来的真实模型降级成 unknown —— 会话行显示
  // unknown，且按通用档计价（实测某会话 1050M tokens 只算成 ¥28）。
  const reported = record.model === '' || record.model === 'unknown' ? undefined : record.model
  const model = reported ?? existing?.lastModel ?? 'unknown'
  const prev = {
    inputTokens: existing?.inputTokens ?? 0,
    outputTokens: existing?.outputTokens ?? 0,
    cacheReadTokens: existing?.cacheReadTokens ?? 0,
    cacheWriteTokens: existing?.cacheWriteTokens ?? 0,
    calls: existing?.calls ?? 0,
  }

  // 1) 权威（扫描）记录：整行替换，归属表随行一起落定。
  if (record.days !== undefined) {
    const steps = record.steps
    store.bySession[sessionId] = {
      title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
      lastModel: model,
      lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      cacheReadTokens: record.cacheReadTokens,
      cacheWriteTokens: record.cacheWriteTokens,
      ...steps !== undefined ? { steps } : {},
      calls: steps !== undefined ? steps : prev.calls,
      days: record.days,
      authority: 'scan',
    }
    recomputeAggregates(store)
    return
  }

  // 2) 上报记录：token/调用数单调取大；已被扫描覆盖的会话不再接受上报值。
  const authoritative = existing?.authority === 'scan'
  const grewTokens = record.inputTokens > prev.inputTokens
    || record.outputTokens > prev.outputTokens
    || record.cacheReadTokens > prev.cacheReadTokens
    || record.cacheWriteTokens > prev.cacheWriteTokens
  const reportedCalls = record.steps !== undefined
    ? Math.max(prev.calls, record.steps)
    : prev.calls + (record.reset === true ? 0 : (grewTokens ? 1 : 0))
  const next = authoritative
    ? prev
    : {
        inputTokens: Math.max(prev.inputTokens, record.inputTokens),
        outputTokens: Math.max(prev.outputTokens, record.outputTokens),
        cacheReadTokens: Math.max(prev.cacheReadTokens, record.cacheReadTokens),
        cacheWriteTokens: Math.max(prev.cacheWriteTokens, record.cacheWriteTokens),
        calls: reportedCalls,
      }

  const days: DayModelBuckets = existing?.days ?? {}
  const delta = {
    inputTokens: next.inputTokens - prev.inputTokens,
    outputTokens: next.outputTokens - prev.outputTokens,
    cacheReadTokens: next.cacheReadTokens - prev.cacheReadTokens,
    cacheWriteTokens: next.cacheWriteTokens - prev.cacheWriteTokens,
    calls: next.calls - prev.calls,
  }
  const progressed = delta.inputTokens + delta.outputTokens + delta.cacheReadTokens + delta.cacheWriteTokens + delta.calls > 0
  if (progressed) {
    // 归日按上报时间戳（record.ts，已做 ±48h 可信窗口校验）。历史缺失量会落在
    // 「打开那一刻」那天 —— 真实归属由后续全量扫描按日志事件时间重建。
    creditBucket(days, dayKey(record.ts), model, delta)
  }

  const steps = record.steps !== undefined ? record.steps : existing?.steps
  store.bySession[sessionId] = {
    title: record.sessionTitle || existing?.title || `会话 ${sessionId.slice(0, 8)}`,
    lastModel: model,
    lastTs: Math.max(existing?.lastTs ?? 0, record.ts),
    ...next,
    ...steps !== undefined ? { steps } : {},
    days,
    authority: existing?.authority ?? 'live',
  }
  if (progressed) recomputeAggregates(store)
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

/**
 * 日 -> 模型 -> 桶（按天算费用用；与 byDay / byModel 同源，恒等）。
 * `store.byDay` 只保留「日 -> 桶」的合计，这里保留模型维度以便按天计价。
 */
export function dayModelBuckets(store: UsageStore): DayModelBuckets {
  const out: DayModelBuckets = {}
  for (const session of Object.values(store.bySession)) {
    for (const [day, models] of Object.entries(session.days ?? {})) {
      if (day === UNATTRIBUTED_DAY) continue
      for (const [model, bucket] of Object.entries(models)) {
        creditBucket(out, day, model, bucket)
      }
    }
  }
  return out
}

/** 「日期未知」那部分用量折算的费用（元）：总额里含它、按天图表里不含它。 */
export function unattributedCost(store: UsageStore): number {
  let sum = 0
  for (const session of Object.values(store.bySession)) {
    for (const [model, bucket] of Object.entries(session.days?.[UNATTRIBUTED_DAY] ?? {})) {
      sum += estimateCost(model, bucket.inputTokens, bucket.outputTokens, bucket.cacheReadTokens, bucket.cacheWriteTokens)
    }
  }
  return sum
}

/** 按模型估算费用（元，精确值；展示层最后舍入）。 */
export function modelCosts(byModel: Record<string, TokenBucket>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(byModel).map(([model, b]) => [
      model,
      estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens),
    ]),
  )
}

/** 按天估算费用（元）：Σ 该天各模型桶 × 模型单价。 */
export function dayCosts(days: DayModelBuckets): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [day, models] of Object.entries(days)) {
    let sum = 0
    for (const [model, b] of Object.entries(models)) {
      sum += estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens)
    }
    out[day] = sum
  }
  return out
}

/**
 * 单个会话的费用（元）：按该会话归属表**逐模型**计价。
 *
 * 不能用行上的单一 `lastModel` 计价：一个会话经常跨模型（实测某会话 1996 次
 * deepseek-flash + 421 次 deepseek-v4-flash），而 `lastModel` 只是最后一条记录的
 * 模型，甚至可能是 unknown —— 那样整段会话会被按通用档估价（1050M tokens 算成
 * ¥28，真值近 ¥70）。逐模型计价与会话排行、模型分布、按天费用口径完全一致。
 */
export function sessionCost(row: SessionEntry): number {
  let sum = 0
  for (const models of Object.values(row.days ?? {})) {
    for (const [model, b] of Object.entries(models)) {
      sum += estimateCost(model, b.inputTokens, b.outputTokens, b.cacheReadTokens, b.cacheWriteTokens)
    }
  }
  return sum
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
    const round4 = (value: number): number => Math.round(value * 10_000) / 10_000
    const round2 = (value: number): number => Math.round(value * 100) / 100
    // 费用：先算精确值（estimateCost 不做中间舍入，M4），最后展示层一次舍入。
    const perModel = modelCosts(store.byModel)
    const perDay = dayCosts(dayModelBuckets(store))
    const totalCost = Object.values(perModel).reduce((a, b) => a + b, 0)
    const sessions = sessionRanking(store, 20).map((s) => {
      const row = store.bySession[s.id]
      return { ...s, cost: round4(row === undefined ? 0 : sessionCost(row)) }
    })
    // 近 14 天：token 序列 + 当天费用（面板据此显示"今日费用"）。
    const recent = recentDays(store, 14).map((d) => ({ ...d, cost: round4(perDay[d.day] ?? 0) }))
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
        // 迁移遗留的「日期未知」额度：含在 total 里，不在按天图表里（首次全量
        // 扫描完成后归零）。
        unattributed: round4(unattributedCost(store)),
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
    // 服务在、但接口形状不认识（例如宿主把 API 换成了别的名字）：必须显式告警。
    // 之前只探测旧接口，0.1.5 上扫描静默空转 —— 水位被写成空表、历史全是迁移
    // 兜底值，看板看起来"跑过了"其实一个会话都没折进来。
    if (persistence !== undefined && !canScan(persistence)) {
      console.warn('[usage-dashboard] sessionPersistence has no readable API (expected list()+open() or listSnapshots()+readFrom()); all-session backfill disabled')
    }
  })
}