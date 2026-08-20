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
  data: {
    turn?: number
    step?: number
    usage?: Partial<Record<'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'reasoningTokens', number>> | undefined
    chunk?: { type?: string; usage?: Partial<Record<'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens' | 'reasoningTokens', number>> }
    header?: { config?: { provider?: string; model?: string } }
  }
}

/** sessionPersistence 服务的最小形状。 */
export interface PersistenceLike {
  listSnapshots?: (signal?: AbortSignal) => Promise<Array<{
    header: { id: string; parentSession?: string; origin?: string; delegationDepth?: number; agentPreset?: string }
    revision: string
  }>>
  readFrom?: (id: string, fromSeq: number, signal?: AbortSignal) => Promise<{ events: ReadonlyArray<ScanEventLike> }>
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
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, steps: 0, model: '' }
}

/**
 * 纯 fold：把一段事件日志折成会话累计用量。
 * - token：`assistant/chunk{type:'usage'}` 与 `assistant/message.usage` 都记；
 *   同一 (turn,step) 的重度样本按「后者替换前者」处理，绝不双计。
 * - steps：数 `step/end` 事件（含失败/取消），与 sessionStats 投影同口径。
 * - model：取最后一条 `request/header` 的 `config.model`。
 */
export function foldSessionUsage(events: readonly ScanEventLike[]): SessionUsage {
  const out = emptySessionUsage()
  let lastKey = ''
  let last: { i: number; o: number; c: number; w: number } | undefined
  for (const ev of events) {
    if (ev.type === 'request/header') {
      const config = ev.data?.header?.config
      if (config !== undefined && typeof config.model === 'string' && config.model.length > 0) {
        out.model = config.model
      }
      continue
    }
    let usage = ev.data?.chunk?.type === 'usage' ? ev.data.chunk.usage
      : ev.type === 'assistant/message' ? ev.data?.usage
        : undefined
    const stepIsEnd = ev.type === 'step/end'
    if (usage === undefined) {
      if (stepIsEnd) out.steps += 1
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
    if (lastKey === key && last !== undefined) {
      if (last.i === b.i && last.o === b.o && last.c === b.c && last.w === b.w) {
        // 同一 (turn,step) 的相同样本：替换计（避免把 chunk 与 message 各算一次）。
        last = b
        continue
      }
      out.inputTokens += b.i - last.i
      out.outputTokens += b.o - last.o
      out.cacheReadTokens += b.c - last.c
      out.cacheWriteTokens += b.w - last.w
    } else {
      out.inputTokens += b.i
      out.outputTokens += b.o
      out.cacheReadTokens += b.c
      out.cacheWriteTokens += b.w
    }
    lastKey = key
    last = b
    if (stepIsEnd) out.steps += 1
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

  if (persistence.listSnapshots === undefined || persistence.readFrom === undefined) {
    return { outcomes, errors, revisions, total }
  }

  const snapshots = await persistence.listSnapshots()
  total = snapshots.length
  let handled = 0

  for (const snap of snapshots) {
    const id = snap.header?.id
    if (typeof id !== 'string' || id.length === 0) continue
    const rev = snap.revision
    if (limit > 0 && handled >= limit) break
    if (rev !== undefined && revisions[id] === rev) continue // 未变化
    handled += 1
    try {
      const { events } = await persistence.readFrom(id, 0)
      const usage = foldSessionUsage(events ?? [])
      outcomes.push({
        sessionId: id,
        parentSession: snap.header?.parentSession,
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
