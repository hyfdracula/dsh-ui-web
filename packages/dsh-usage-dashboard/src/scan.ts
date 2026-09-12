/**
 * 宿主侧全会话聚合扫描（scan）。
 *
 * 背景：UsageRecorder 只挂在 GUI 前台打开的会话上，subagent / AgentTeams /
 * headless 等**子会话**从不前台打开，其用量不会进 usage.json。但它们的持久
 * 日志（走 sessionPersistence）里每次模型调用都有完整 usage —— 本模块把它们
 * 也折出来，经 replace+补差并入看板。
 *
 * 用法：
 *  - `foldSessionUsage(events)`：纯 fold，把一段事件日志折成会话累计用量，
 *    口径与 tokenUsage / sessionStats 投影一致（同一 (turn,step) 去重、chunk
 *    用量被 message 用量替换；steps = step/end 数；model = 最后 request/header）。
 *  - `scanAndBackfill(persistence, knownRevisions)`：枚举全部会话日志，对
 *    新增/修订的会话重算累计（水位增量），返回待并表的 outcome，由调用方走
 *    applyRecord(reset:true) 补差写入。
 *
 * @module @captain1275/dsh-usage-dashboard/scan
 */

/** 会话日志事件的最小形状（只读宿主侧扫描用，避免引入 dsh-session 运行时/类型依赖）。 */
export interface ScanEventLike {
  type: string
  /** 事件落盘时间（ms）；缺失时 fold 退回到调用方给的兜底时间。 */
  time?: number
  data: {
    turn?: number
    step?: number
    usage?: Partial<Record<'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'reasoningTokens', number>> | undefined
    chunk?: { type?: string; usage?: Partial<Record<'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'reasoningTokens', number>> }
    header?: { config?: { provider?: string; model?: string } }
    /** assistant/message 的响应来源：v3 日志把每次调用实际用的模型记在这里。 */
    message?: { source?: { provider?: string; model?: string } }
  }
}

/** 一个桶的 token/调用计数（聚合的最小单元）。 */
export interface TokenBucket {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  calls: number
}

/** 本地日历日键（YYYY-MM-DD）。 */
export function localDayKey(ts: number): string {
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/** 空桶。 */
export function emptyBucket(): TokenBucket {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 }
}

/** 日 -> 模型 -> 桶：用量真实归属（趋势图与模型分布都由它派生）。 */
export type DayModelBuckets = Record<string, Record<string, TokenBucket>>

/** 往归属表里记一笔（缺行即建行）。 */
export function creditBucket(
  days: DayModelBuckets,
  day: string,
  model: string,
  delta: Partial<TokenBucket>,
): void {
  const byModel = days[day] ?? (days[day] = {})
  const bucket = byModel[model] ?? (byModel[model] = emptyBucket())
  bucket.inputTokens += delta.inputTokens ?? 0
  bucket.outputTokens += delta.outputTokens ?? 0
  bucket.cacheReadTokens += delta.cacheReadTokens ?? 0
  bucket.cacheWriteTokens += delta.cacheWriteTokens ?? 0
  bucket.calls += delta.calls ?? 0
}

/** 会话 header 的最小形状（标题/子会话判定用）。 */
export interface PersistenceHeaderLike {
  id: string
  parentSession?: string
  origin?: string
  delegationDepth?: number
  agentPreset?: string
}

/** 一次快照观察（0.1.5 `list()` 的条目）。 */
export interface PersistenceSnapshotLike {
  header: PersistenceHeaderLike
  /** 后端不透明修订号；只有同源同会话可比（0.1.5 起是 brand 字符串）。 */
  revision?: unknown
}

/** 读句柄（0.1.5 `open(id, 'read')` 的返回值）。 */
export interface PersistenceReadHandleLike {
  read: () => Promise<{ events?: ReadonlyArray<ScanEventLike> }>
  close?: () => Promise<void>
}

/**
 * sessionPersistence 服务的最小形状。
 *
 * 0.1.5 把 API 换成了 `list()` + `open(id, 'read')` + `handle.read()`：旧的
 * `listSnapshots()` / `readFrom(id, 0)` **在 0.1.5 上不存在**，只按旧接口探测
 * 会让整个补录静默变成空转（扫描水位被写成 `{}`、一个会话都进不来）。两种
 * 形状都探测，优先新接口，旧宿主仍可用（`canScan` 是唯一入口）。
 */
export interface PersistenceLike {
  /** 0.1.5：枚举全部会话快照。 */
  list?: (options?: { signal?: AbortSignal }) => Promise<ReadonlyArray<PersistenceSnapshotLike>>
  /** 0.1.5：打开读句柄。 */
  open?: (id: string, access: 'read', options?: unknown) => Promise<PersistenceReadHandleLike>
  /** 0.1.1 旧接口（保留兼容）。 */
  listSnapshots?: (signal?: AbortSignal) => Promise<ReadonlyArray<PersistenceSnapshotLike>>
  /** 0.1.1 旧接口（保留兼容）。 */
  readFrom?: (id: string, fromSeq: number, signal?: AbortSignal) => Promise<{ events?: ReadonlyArray<ScanEventLike> }>
}

/** 该服务是否具备可用的读取能力（0.1.5 的 list+open，或 0.1.1 的 listSnapshots+readFrom）。 */
export function canScan(persistence: PersistenceLike | undefined): boolean {
  if (persistence === undefined) return false
  const modern = typeof persistence.list === 'function' && typeof persistence.open === 'function'
  const legacy = typeof persistence.listSnapshots === 'function' && typeof persistence.readFrom === 'function'
  return modern || legacy
}

/** 枚举全部会话快照（新旧接口统一）。 */
async function listSnapshots(persistence: PersistenceLike): Promise<ReadonlyArray<PersistenceSnapshotLike>> {
  if (typeof persistence.list === 'function') return await persistence.list()
  if (typeof persistence.listSnapshots === 'function') return await persistence.listSnapshots()
  return []
}

/** 读取一个会话的全部事件（新旧接口统一）。 */
async function readEvents(persistence: PersistenceLike, id: string): Promise<ReadonlyArray<ScanEventLike>> {
  if (typeof persistence.open === 'function') {
    const handle = await persistence.open(id, 'read')
    try {
      const { events } = await handle.read()
      return events ?? []
    } finally {
      // 句柄必须归还：0.1.5 的读句柄持有后端资源（zstd 帧缓存/文件描述符）。
      try { await handle.close?.() } catch { /* 关闭失败不掩盖折叠结果 */ }
    }
  }
  if (typeof persistence.readFrom === 'function') {
    const { events } = await persistence.readFrom(id, 0)
    return events ?? []
  }
  return []
}

/** 一个会话折出来的累计用量。 */
export interface SessionUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** 已关闭 step 数（step/end；含失败/取消，近似真实响应/调用数）。 */
  steps: number
  /** 该会话最后一条 request/header 记录的模型；空串 = 未取到。 */
  model: string
  /** 用量真实归属：日 -> 模型 -> 桶（会话行的 days 字段，聚合全部由它派生）。 */
  days: DayModelBuckets
}

/** 一次扫描产出的「待并表」结果。 */
export interface ScanOutcome extends SessionUsage {
  sessionId: string
  parentSession?: string
  isSubagent: boolean
}

/** 一个会话的 header 形状（供标题构造）。 */
export interface ScanHeader {
  id: string
  parentSession?: string
  origin?: string
  delegationDepth?: number
  agentPreset?: string
}

/** 会话标题：子会话带标记，根会话用 id 前 8 位（已有标题由 host 保留）。 */
export function scanTitle(header: ScanHeader): string {
  const bare = header.id.slice(0, 8)
  const shallow = header.origin === 'subagent' || (header.delegationDepth ?? 0) > 0
  return shallow ? `子会话 ${bare}` : `会话 ${bare}`
}

/** 空累计。 */
export function emptySessionUsage(): SessionUsage {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, steps: 0, model: '', days: {} }
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
export function foldSessionUsage(events: readonly ScanEventLike[], fallbackTs = Date.now()): SessionUsage {
  const out = emptySessionUsage()
  let lastKey = ''
  let last: { i: number; o: number; c: number; w: number } | undefined
  /** 上一个样本归属到哪一天（同一步骤的后续增量沿用，避免一步跨天被拆开）。 */
  let lastDay = ''
  /** 当前生效模型（request/header 流式更新）。 */
  let currentModel = ''
  for (const ev of events) {
    const time = typeof ev.time === 'number' && Number.isFinite(ev.time) ? ev.time : fallbackTs
    const day = localDayKey(time)
    if (ev.type === 'request/header') {
      const config = ev.data?.header?.config
      if (config !== undefined && typeof config.model === 'string' && config.model.length > 0) {
        out.model = config.model
        currentModel = config.model
      }
      continue
    }
    // v3 日志把「这次响应实际用的模型」记在 assistant/message 的
    // `data.message.source.model` 上；`request/header` 只出现在压缩/标题这类
    // 附带 LLM 调用里（实测 2336 条响应只有 29 条 header）。所以模型必须逐条
    // 从 message 上取：同一会话可以跨多个模型，先前只认 request/header 会把
    // 整段会话记成 unknown（或过期的旧模型），费用按通用档/错误单价估算。
    if (ev.type === 'assistant/message') {
      const declared = ev.data?.message?.source?.model
      if (typeof declared === 'string' && declared.length > 0) {
        out.model = declared
        currentModel = declared
      }
    }
    // 模型必须在上面两条更新之后再取值：本条响应记的是本条自己的模型。
    const model = currentModel === '' ? 'unknown' : currentModel
    const usage = ev.data?.chunk?.type === 'usage' ? ev.data.chunk.usage
      : ev.type === 'assistant/message' ? ev.data?.usage
        : undefined
    const stepIsEnd = ev.type === 'step/end'
    if (usage === undefined) {
      if (stepIsEnd) {
        out.steps += 1
        creditBucket(out.days, day, model, { calls: 1 })
      }
      continue
    }
    const turn = ev.data?.turn ?? -1
    const step = ev.data?.step ?? -1
    const b = {
      i: usage.inputTokens ?? 0,
      o: usage.outputTokens ?? 0,
      c: usage.cacheReadTokens ?? 0,
      w: usage.cacheWriteTokens ?? 0,
    }
    const key = `${turn}:${step}`
    let delta = { i: b.i, o: b.o, c: b.c, w: b.w }
    let dayOfDelta = day
    if (lastKey === key && last !== undefined) {
      if (last.i === b.i && last.o === b.o && last.c === b.c && last.w === b.w) {
        // 同一 (turn,step) 的相同样本：替换计（避免把 chunk 与 message 各算一次）。
        if (stepIsEnd) {
          out.steps += 1
          creditBucket(out.days, lastDay === '' ? day : lastDay, model, { calls: 1 })
        }
        last = b
        continue
      }
      delta = { i: b.i - last.i, o: b.o - last.o, c: b.c - last.c, w: b.w - last.w }
      dayOfDelta = lastDay === '' ? day : lastDay
    }
    out.inputTokens += delta.i
    out.outputTokens += delta.o
    out.cacheReadTokens += delta.c
    out.cacheWriteTokens += delta.w
    creditBucket(out.days, dayOfDelta, model, {
      inputTokens: delta.i,
      outputTokens: delta.o,
      cacheReadTokens: delta.c,
      cacheWriteTokens: delta.w,
    })
    lastKey = key
    last = b
    lastDay = dayOfDelta
    if (stepIsEnd) {
      out.steps += 1
      creditBucket(out.days, dayOfDelta, model, { calls: 1 })
    }
  }
  return out
}

/** 无变化/出错时的扫描结果轮廓。 */
export interface ScanSummary {
  /** 本次新增或修订（待并表）的会话。 */
  outcomes: ScanOutcome[]
  /** 出错会话数。 */
  errors: number
  /** 更新后的水位（sessionId -> revision）。 */
  revisions: Record<string, string>
  /** 全量会话数（含未变化的）。 */
  total: number
}

/**
 * 扫描全部会话日志，重算「新增或 revision 变化」的会话累计。
 * `knownRevisions` 为上次水位；冷启动（空对象）即全量补录。
 * 单次最多处理 `limit` 个会话（0 = 不限），避免某次大扫阻塞宿主任意时长。
 */
export async function scanAndBackfill(
  persistence: PersistenceLike,
  knownRevisions: Record<string, string> = {},
  limit = 0,
): Promise<ScanSummary> {
  const outcomes: ScanOutcome[] = []
  const revisions: Record<string, string> = { ...knownRevisions }
  let errors = 0
  let total = 0

  // 没有任何可用读取接口时直接退出（调用方用 canScan 先行告警，避免静默空转）。
  if (!canScan(persistence)) {
    return { outcomes, errors, revisions, total }
  }

  const snapshots = await listSnapshots(persistence)
  total = snapshots.length
  let handled = 0

  for (const snap of snapshots) {
    const id = snap.header?.id
    if (typeof id !== 'string' || id.length === 0) continue
    // 0.1.5 的 revision 是 brand 字符串：统一成字符串再比水位。
    const rev = snap.revision === undefined ? undefined : String(snap.revision)
    if (limit > 0 && handled >= limit) break
    if (rev !== undefined && revisions[id] === rev) continue // 未变化
    handled += 1
    try {
      const events = await readEvents(persistence, id)
      const usage = foldSessionUsage(events)
      const parent = snap.header?.parentSession
      outcomes.push({
        sessionId: id,
        // exactOptionalPropertyTypes 下不能显式赋 undefined，按需展开字段。
        ...parent !== undefined ? { parentSession: parent } : {},
        isSubagent: snap.header?.origin === 'subagent' || (snap.header?.delegationDepth ?? 0) > 0,
        ...usage,
      })
    } catch (error) {
      errors += 1
      console.warn(`[usage-dashboard] scan failed for ${id}:`, error instanceof Error ? error.message : String(error))
    }
    if (rev !== undefined) revisions[id] = rev
  }

  return { outcomes, errors, revisions, total }
}
