/**
 * The phone bundle's wire vocabulary: what `/m/api` and its SSE stream carry,
 * plus the runtime guards that keep an unknown or newer host from crashing the
 * page. The shapes are the 0.1.5 Typert Remote surface, declared type-only
 * from the official packages (erased at build time — this bundle inlines
 * everything it needs and shares no runtime instance with the host).
 *
 * Two wire layers meet here:
 * - the Remote types the host adapter passes through unchanged
 *   (`SessionFollowFrame`, `SessionPage`, `WorkspaceView`, `SessionSummary`,
 *   `ModelCatalog`), and
 * - the plugin's own frames the adapter adds for this page (the
 *   `{ type: 'projection' }` deltas, plus the unary envelopes in `rpc.ts`).
 */

import type {
  ModelCatalogFailure,
  ModelProviderGroup,
  ModelSelection,
  SessionFollowFrame,
  SessionProjectionBaseline,
  SessionSummary,
} from '@deepseek-ai/dsh-api-session-controller'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller'
import type { WireEvent } from './messages.ts'

/** One workspace roster row (the host registry's durable fields). */
export type WorkspaceRow = WorkspaceView

/** One session list row. */
export type SessionRow = SessionSummary

/** One `{ type: 'event', event }` history record. */
export type SessionHistoryRecord = Extract<SessionFollowFrame, { type: 'event' }>

/** One follow snapshot frame (the opening window of a live chat). */
export type FollowSnapshot = Extract<SessionFollowFrame, { type: 'snapshot' }>

/** One process-local assistant presentation frame. */
export type AssistantStreamFrame = Extract<SessionFollowFrame, { type: 'assistant-stream' }>['frame']

/** One message-aligned history page, with the tail page's projection baseline. */
export interface HistoryPage {
  records: SessionHistoryRecord[]
  hasMore: boolean
  /**
   * Projection baseline riding the tail page (permissions select and model
   * selection); absent on older pages and when the deployment mounts no
   * projection registry.
   */
  projections?: SessionProjectionBaseline
}

/** One unary `session.list` page (the host adapter slices stable pages). */
export interface SessionListPage {
  items: SessionRow[]
  nextCursor?: string
  hasMore: boolean
}

/** The `session.create` result (the id is the commit the caller navigates to). */
export interface CreatedSession {
  sessionId: string
  agentPreset?: string
}

/**
 * The phone-facing model directory: the host catalog plus this session's
 * current selection (the durable `modelSelection` projection's `next`).
 */
export interface SessionModels {
  current: ModelSelection
  groups: readonly ModelProviderGroup[]
  failures: readonly ModelCatalogFailure[]
}

/** One live frame the phone surface consumes. */
export type MobileFrame =
  | { type: 'session/event'; sessionId: string; event: WireEvent }
  | { type: 'session/projection'; sessionId: string; key: string; value: unknown }

/** One plugin-owned projection delta frame on the SSE channel. */
export interface ProjectionFrame {
  type: 'projection'
  sessionId: string
  key: string
  value: unknown
}

/** Runtime shape guard for an object payload. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Runtime shape guard for one durable session event. */
export function isWireEvent(value: unknown): value is WireEvent {
  return isRecord(value) && typeof value['type'] === 'string' && typeof value['seq'] === 'number'
}

/** Whether a value is one `{ type: 'event', event }` history record. */
export function isHistoryRecord(value: unknown): value is SessionHistoryRecord {
  return isRecord(value) && value['type'] === 'event' && isWireEvent(value['event'])
}

/**
 * Parse one SSE payload as a follow frame. Unknown frame types (a newer host)
 * parse to undefined and are dropped by the caller, so the stream stays
 * forward-compatible.
 */
export function parseFollowFrame(value: unknown): SessionFollowFrame | undefined {
  if (!isRecord(value)) return undefined
  if (value['type'] === 'snapshot' && typeof value['cursor'] === 'number') {
    const records = Array.isArray(value['records']) ? value['records'].filter(isHistoryRecord) : []
    const snapshot: FollowSnapshot = {
      type: 'snapshot',
      header: value['header'] as FollowSnapshot['header'],
      cursor: value['cursor'],
      records,
      hasMore: value['hasMore'] === true,
      projections: parseProjectionBaseline(value['projections']) ?? { asOfSeq: value['cursor'], values: {} },
      ...(isRecord(value['assistantStream'])
        ? { assistantStream: value['assistantStream'] as unknown as FollowSnapshot['assistantStream'] }
        : {}),
    }
    return snapshot
  }
  if (value['type'] === 'event' && isHistoryRecord(value)) return value
  if (value['type'] === 'assistant-stream' && isRecord(value['frame']) && typeof value['frame']['type'] === 'string') {
    return { type: 'assistant-stream', frame: value['frame'] as AssistantStreamFrame }
  }
  return undefined
}

/** Parse the projection delta frame the host adapter adds to the stream. */
export function parseProjectionFrame(value: unknown): ProjectionFrame | undefined {
  if (!isRecord(value) || value['type'] !== 'projection') return undefined
  const sessionId = value['sessionId']
  const key = value['key']
  if (typeof sessionId !== 'string' || typeof key !== 'string') return undefined
  return { type: 'projection', sessionId, key, value: value['value'] }
}

/** Parse a projection baseline (the snapshot frame's and the tail page's shape). */
export function parseProjectionBaseline(value: unknown): SessionProjectionBaseline | undefined {
  if (!isRecord(value) || typeof value['asOfSeq'] !== 'number') return undefined
  const values = isRecord(value['values']) ? value['values'] : {}
  return { asOfSeq: value['asOfSeq'], values } as SessionProjectionBaseline
}

/** Parse one unary history-page value. */
export function parseHistoryPage(value: unknown): HistoryPage {
  if (!isRecord(value)) return { records: [], hasMore: false }
  const records = Array.isArray(value['records']) ? value['records'].filter(isHistoryRecord) : []
  const projections = parseProjectionBaseline(value['projections'])
  return {
    records,
    hasMore: value['hasMore'] === true,
    ...(projections === undefined ? {} : { projections }),
  }
}

/** Parse one unary session-list page. */
export function parseSessionListPage(value: unknown): SessionListPage {
  if (!isRecord(value)) return { items: [], hasMore: false }
  const items = Array.isArray(value['items']) ? value['items'].filter(isRecord) as unknown as SessionRow[] : []
  const nextCursor = typeof value['nextCursor'] === 'string' ? value['nextCursor'] : undefined
  return {
    items,
    hasMore: value['hasMore'] === true,
    ...(nextCursor === undefined ? {} : { nextCursor }),
  }
}

/** Parse one workspace roster response. */
export function parseWorkspaceRows(value: unknown): WorkspaceRow[] {
  if (!isRecord(value)) return []
  const items = Array.isArray(value['items']) ? value['items'] : []
  return items.filter((item): item is WorkspaceRow => isRecord(item) && typeof item['workspaceId'] === 'string')
}

/** Parse one created-session value. */
export function parseCreatedSession(value: unknown): CreatedSession {
  if (!isRecord(value) || typeof value['sessionId'] !== 'string') {
    throw new Error('session.create returned no session id')
  }
  return {
    sessionId: value['sessionId'],
    ...(typeof value['agentPreset'] === 'string' ? { agentPreset: value['agentPreset'] } : {}),
  }
}

/** Parse the model directory response (defensive: unknown fields are dropped). */
export function parseSessionModels(value: unknown): SessionModels {
  const record = isRecord(value) ? value : {}
  const selection = isRecord(record['current']) ? record['current'] : {}
  return {
    current: {
      provider: typeof selection['provider'] === 'string' ? selection['provider'] : '',
      model: typeof selection['model'] === 'string' ? selection['model'] : '',
      ...(typeof selection['reasoningEffort'] === 'string' ? { reasoningEffort: selection['reasoningEffort'] } : {}),
    },
    groups: Array.isArray(record['groups']) ? record['groups'] as ModelProviderGroup[] : [],
    failures: Array.isArray(record['failures']) ? record['failures'] as ModelCatalogFailure[] : [],
  }
}

/** Parse one selected-model value (`session.selectModel`). */
export function parseSelectedModel(value: unknown): { provider: string; model: string; reasoningEffort?: string } {
  const record = isRecord(value) ? value : {}
  const selected = isRecord(record['selected']) ? record['selected'] : {}
  return {
    provider: typeof selected['provider'] === 'string' ? selected['provider'] : '',
    model: typeof selected['model'] === 'string' ? selected['model'] : '',
    ...(typeof selected['reasoningEffort'] === 'string' ? { reasoningEffort: selected['reasoningEffort'] } : {}),
  }
}
