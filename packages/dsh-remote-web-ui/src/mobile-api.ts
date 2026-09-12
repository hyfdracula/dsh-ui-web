/**
 * The mobile surface's data channel: `/m/api` adapts the phone page onto the
 * 0.1.5 Typert Remote surface. The phone's calls ride THIS prefix instead of
 * the connection plugin's `/api` — so the tunneled Host never needs to enter
 * the connection trust fence (a distributable plugin cannot change that
 * fence), and this plugin's own pairing gate is the access control instead.
 *
 * 0.1.5 retired the `ApiProxy` service this module used to proxy. The
 * replacement path is `ctx.typertGateway`, the in-process dispatcher behind
 * every Remote method: `invoke({ namespace, method, args })` for unary calls
 * and `stream({ ... })` for `@Remote({ mode: 'stream' })` methods. Its `args`
 * keys are the generated descriptor's wire names (the implementation's own
 * parameter names — `request` for every session verb, `_request` for
 * `session.list`), and the gateway appends the cancellation signal for the
 * methods whose descriptor declares one.
 *
 * Security model (unchanged):
 * - Every request must carry a live paired-device cookie (the same gate
 *   semantic as the LAN fence), enforced before any host call.
 * - Only an explicit allowlist of Remote methods is reachable; privileged
 *   domains (settings, credentials, host actions, goals, subagents, …) are
 *   never exposed to the phone.
 * - `session.list` is paged here (the host API returns everything; this
 *   layer slices stable pages) so the phone never transfers the whole list.
 * - History paging resolves the tail cursor here: `session.page` demands a
 *   `throughSeq` from a follow opening frame, so the phone's `{ sessionId,
 *   beforeSeq }` request is completed with the cursor read from
 *   `ctx.sessionQuery` (the same observation `session.page` itself uses).
 * - Live frames ride Server-Sent Events on the same prefix: one
 *   `session.follow` stream per open chat, forwarded frame by frame, plus
 *   projection deltas so the phone's permission and model pickers stay live.
 */

import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { TypertGateway } from '@deepseek-ai/dsh-api-gateway'
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import type { PairingService } from './pairing.ts'
import { readCookie } from './gate.ts'

/** Methods the phone surface may call. Everything else is refused. */
const MOBILE_ALLOWLIST = new Set([
  'workspace.list',
  'session.create',
  'session.list',
  'session.page',
  'session.prompt',
  'session.models',
  'session.selectModel',
  'session.rename',
])

/** One session.list page (thin phones load incrementally). */
const SESSION_PAGE_SIZE = 20

/** Message-aligned window of one history page. */
const HISTORY_WINDOW_MESSAGES = 50

/** Opening window of the follow stream (the newest messages, tail-aligned). */
const FOLLOW_WINDOW_MESSAGES = 50

/** One wire failure in the transport envelope the phone's callUnary maps. */
interface MobileFailure {
  code: string
  message: string
  details: object
}

/** The result half of the transport envelope (values pass through unchanged). */
type MobileResult =
  | { ok: true; value: unknown }
  | { ok: false; error: MobileFailure }

/** Surface used to build the phone's workspace roster. */
export interface MobileWorkspaceRow {
  workspaceId: string
  path: string
  title: string
  sessionIds: readonly string[]
}

/** One session.list row as the phone consumes it. */
interface MobileSessionRow {
  sessionId: string
  updatedAt: number
  running: boolean
  blank: boolean
  cwd?: string
  projections?: unknown
}

/** Route-family dependencies. */
export interface MobileApiDeps {
  /** The pairing service (device gate + cookie name). */
  service: PairingService
  /** The Remote dispatcher (injected from the host context). */
  gateway: TypertGateway
  /** Host session query engine: tail-cursor lookups for history paging. */
  sessionQuery: SessionQueryEngine
  /** Host workspace registry: the phone's workspace roster. */
  workspaces: WorkspaceRegistry
}

/** Mobile API route paths. */
export const MOBILE_API_PATHS = {
  /** One live `session.follow` stream per open chat, bridged over SSE. */
  follow: '/m/api/session.follow',
} as const

/** The mobile-api prefix (every other path under it is a method name). */
const MOBILE_API_PREFIX = '/m/api'
/** Method extraction: the prefix plus one slash. */
const MOBILE_API_METHOD_PREFIX = `${MOBILE_API_PREFIX}/`

/**
 * Build the mobile data-channel routes.
 * @param deps - pairing service, Remote dispatcher, session query, workspaces.
 * @returns the routes to register on webServer.
 */
export function makeMobileApiRoutes(deps: MobileApiDeps): WebRoute[] {
  const { service } = deps

  /** The phone gate: a live paired-device cookie, or nothing else proceeds. */
  const gateOk = (req: IncomingMessage): boolean => {
    const deviceId = readCookie(req.headers.cookie, service.config.cookieName)
    return deviceId !== undefined && service.hasDevice(deviceId)
  }

  const writeJson = (res: ServerResponse, status: number, body: unknown): void => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  }

  const handleMethod = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') {
      res.writeHead(405)
      res.end()
      return
    }
    if (!gateOk(req)) {
      writeJson(res, 403, { ok: false, error: { code: 'unpaired', message: 'mobile session is not paired' } })
      return
    }
    const pathname = new URL(req.url ?? '/', 'http://x').pathname
    if (!pathname.startsWith(MOBILE_API_METHOD_PREFIX)) {
      writeJson(res, 404, { ok: false, error: { code: 'not-found', message: 'unknown mobile api path' } })
      return
    }
    const method = pathname.slice(MOBILE_API_METHOD_PREFIX.length)
    if (!MOBILE_ALLOWLIST.has(method)) {
      writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: `method ${method} is not exposed to the mobile surface` } })
      return
    }
    let envelope: unknown
    try {
      envelope = await readJsonBody(req)
    } catch {
      writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'invalid json body' } })
      return
    }
    const parsed = envelope as { rpcId?: unknown; payload?: unknown }
    const rpcId = typeof parsed?.rpcId === 'string' ? parsed.rpcId : ''
    if (rpcId === '') {
      writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'missing rpcId' } })
      return
    }
    // Every arm answers in the transport envelope the phone's callUnary
    // requires; a failure inside one arm is a result, never a 5xx.
    let result: MobileResult
    try {
      result = await dispatch(deps, method, parsed?.payload)
    } catch (error) {
      result = { ok: false, error: failureOf(error) }
    }
    writeJson(res, 200, { type: 'server-response', rpcId, result })
  }

  /** One live chat stream: forward `session.follow` frames, plus projection deltas. */
  const handleFollow = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.writeHead(405)
      res.end()
      return
    }
    if (!gateOk(req)) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    const sessionId = new URL(req.url ?? '/', 'http://x').searchParams.get('sessionId') ?? ''
    if (sessionId === '') {
      writeJson(res, 400, { ok: false, error: { code: 'bad-request', message: 'sessionId is required' } })
      return
    }
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    const controller = new AbortController()
    let closed = false
    const heartbeat = setInterval(() => {
      if (closed) return
      try {
        res.write(': ping\n\n')
      } catch {
        // The write failed; the close handler tears the subscription down.
      }
    }, 15_000)
    const onClose = (): void => {
      if (closed) return
      closed = true
      controller.abort()
      clearInterval(heartbeat)
    }
    res.on('close', onClose)
    req.on('close', onClose)
    try {
      const frames = await deps.gateway.stream({
        namespace: 'session',
        method: 'follow',
        args: {
          request: {
            address: { kind: 'session', sessionId },
            assistantStream: true,
            maxMessages: FOLLOW_WINDOW_MESSAGES,
          },
        },
        signal: controller.signal,
      })
      // Last projection values pushed to this phone: the follow stream carries
      // the opening baseline, and every later change is discovered by diffing
      // a fresh observation after each durable event.
      let pushed: Record<string, unknown> | undefined
      for await (const frame of frames) {
        if (closed) break
        res.write(`data: ${JSON.stringify(frame)}\n\n`)
        const type = (frame as { type?: unknown } | null)?.type
        if (pushed === undefined && type === 'snapshot') {
          pushed = projectionValuesOf((frame as { projections?: unknown }).projections)
          continue
        }
        if (type !== 'event') continue
        const observed = await observe(deps, sessionId, 'all')
        try {
          const values = observed.projections?.values ?? {}
          pushed ??= {}
          for (const [key, value] of Object.entries(values)) {
            if (sameJson(pushed[key], value)) continue
            pushed[key] = value
            if (closed) break
            res.write(`data: ${JSON.stringify({ type: 'projection', sessionId, key, value })}\n\n`)
          }
        } finally {
          observed.dispose()
        }
      }
    } catch {
      // The stream ended, aborted, or failed: EventSource reconnects and the
      // phone's polling fallback covers a tunnel that cannot carry SSE.
    } finally {
      controller.abort()
      clearInterval(heartbeat)
    }
    if (!closed) res.end()
  }

  return [
    { kind: 'prefix', path: MOBILE_API_PREFIX, handler: handleMethod },
    { kind: 'exact', path: MOBILE_API_PATHS.follow, handler: handleFollow },
  ]
}

/** Read a request body as JSON (bounded). */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > 64 * 1024) throw new Error('body too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Dispatch one allowlisted method onto the Remote surface. */
async function dispatch(deps: MobileApiDeps, method: string, payload: unknown): Promise<MobileResult> {
  const input = asRecord(payload)
  if (method === 'workspace.list') return { ok: true, value: { items: workspaceRows(deps) } }
  if (method === 'session.list') return pageSessions(deps, input)
  if (method === 'session.create') return createSession(deps, input)
  if (method === 'session.page') return pageHistory(deps, input)
  if (method === 'session.prompt') return promptSession(deps, input)
  if (method === 'session.models') return modelDirectory(deps, input)
  if (method === 'session.selectModel') return selectModel(deps, input)
  if (method === 'session.rename') return renameSession(deps, input)
  return { ok: false, error: { code: 'forbidden', message: `unhandled allowlisted method ${method}`, details: {} } }
}

/** The workspace roster: the host registry's stable order and membership. */
function workspaceRows(deps: MobileApiDeps): MobileWorkspaceRow[] {
  return deps.workspaces.list().map(workspace => ({
    workspaceId: String(workspace.id),
    path: workspace.path,
    title: workspace.title,
    sessionIds: workspace.sessionIds.map(String),
  }))
}

/** `workspace`/`session` Remote calls share one failure vocabulary. */
async function invoke(
  deps: MobileApiDeps,
  namespace: string,
  method: string,
  args: Readonly<Record<string, unknown>>,
): Promise<MobileResult> {
  try {
    const value = await deps.gateway.invoke({ namespace, method, args })
    return { ok: true, value }
  } catch (error) {
    return { ok: false, error: failureOf(error) }
  }
}

/** One paged `session.list`; the host API returns everything, this slices it. */
async function pageSessions(deps: MobileApiDeps, input: Record<string, unknown>): Promise<MobileResult> {
  const listed = await invoke(deps, 'session', 'list', { _request: {} })
  if (!listed.ok) return listed
  const items = [...((listed.value as { items?: MobileSessionRow[] }).items ?? [])]
  const cursor = typeof input['cursor'] === 'string' ? input['cursor'] : undefined
  // Every call pages (the first call with no cursor IS the first page): the
  // phone must never transfer the whole session list at once. One stable page
  // over (updatedAt desc, sessionId asc); pages never skip or repeat a row
  // while the list changes between calls.
  items.sort((a, b) => b.updatedAt - a.updatedAt
    || (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0))
  const position = cursor === undefined ? undefined : parseSessionListCursor(cursor)
  const from = position === undefined ? 0 : items.findIndex(row => afterCursor(row, position))
  const start = from < 0 ? items.length : from
  const page = items.slice(start, start + SESSION_PAGE_SIZE)
  const last = page[page.length - 1]
  const nextCursor = last !== undefined && start + page.length < items.length
    ? sessionListCursor(last.updatedAt, last.sessionId)
    : undefined
  return {
    ok: true,
    value: {
      items: page,
      hasMore: nextCursor !== undefined,
      ...(nextCursor !== undefined ? { nextCursor } : {}),
    },
  }
}

/** Create (or adopt) one session, naming a workspace or a cwd. */
async function createSession(deps: MobileApiDeps, input: Record<string, unknown>): Promise<MobileResult> {
  const request: Record<string, unknown> = {}
  if (typeof input['workspaceId'] === 'string') request['workspaceId'] = input['workspaceId']
  if (typeof input['cwd'] === 'string') request['cwd'] = input['cwd']
  return await invoke(deps, 'session', 'create', { request })
}

/**
 * One message-aligned history page. The phone names a session and an optional
 * `beforeSeq`; the Remote method additionally demands the inclusive tail cut,
 * which is read here from the same session observation it uses internally.
 * The projection baseline rides the tail page (the phone's permission picker
 * reads it), matching what the pre-0.1.5 history response carried.
 */
async function pageHistory(deps: MobileApiDeps, input: Record<string, unknown>): Promise<MobileResult> {
  const sessionId = typeof input['sessionId'] === 'string' ? input['sessionId'] : ''
  if (sessionId === '') return badRequest('sessionId is required')
  const beforeSeq = finiteNumber(input['beforeSeq'])
  const maxMessages = finiteNumber(input['maxMessages']) ?? HISTORY_WINDOW_MESSAGES
  const tail = beforeSeq === undefined
  let observed: SessionObservationView
  try {
    observed = await observe(deps, sessionId, tail ? 'all' : 'none')
  } catch (error) {
    return { ok: false, error: failureOf(error) }
  }
  try {
    const result = await invoke(deps, 'session', 'page', {
      request: {
        address: { kind: 'session', sessionId },
        throughSeq: observed.cursor,
        maxMessages,
        ...(beforeSeq === undefined ? {} : { beforeSeq }),
      },
    })
    if (!result.ok) return result
    const page = result.value as { records?: unknown[]; hasMore?: boolean }
    return {
      ok: true,
      value: {
        records: page.records ?? [],
        hasMore: page.hasMore === true,
        ...(observed.projections === undefined ? {} : { projections: observed.projections }),
      },
    }
  } finally {
    observed.dispose()
  }
}

/** Queue one text prompt; the host mints the request identity. */
async function promptSession(deps: MobileApiDeps, input: Record<string, unknown>): Promise<MobileResult> {
  const sessionId = typeof input['sessionId'] === 'string' ? input['sessionId'] : ''
  const text = typeof input['text'] === 'string' ? input['text'] : ''
  if (sessionId === '') return badRequest('sessionId is required')
  if (text.trim() === '') return badRequest('text is required')
  return await invoke(deps, 'session', 'prompt', {
    request: {
      requestId: randomUUID(),
      sessionId,
      mode: 'queue',
      content: [{ type: 'text', text }],
    },
  })
}

/**
 * The advisory model directory plus this session's current selection: the
 * Remote catalog carries the routable groups, and the durable
 * `modelSelection` projection carries `next` (the selection the next request
 * uses, falling back to the last used one).
 */
async function modelDirectory(deps: MobileApiDeps, input: Record<string, unknown>): Promise<MobileResult> {
  const sessionId = typeof input['sessionId'] === 'string' ? input['sessionId'] : ''
  if (sessionId === '') return badRequest('sessionId is required')
  const catalog = await invoke(deps, 'session', 'modelCatalog', {})
  if (!catalog.ok) return catalog
  const value = catalog.value as {
    default?: unknown
    routableProviders?: unknown
    groups?: unknown
    failures?: unknown
  }
  let observed: SessionObservationView | undefined
  try {
    observed = await observe(deps, sessionId, 'all')
  } catch {
    // A cold or unknown session still gets the host default; the picker
    // simply shows no preselection.
  }
  try {
    const selection = observed?.projections?.values?.['modelSelection'] as { next?: unknown } | undefined
    return {
      ok: true,
      value: {
        current: selection?.next ?? value.default,
        default: value.default,
        routableProviders: value.routableProviders ?? [],
        groups: value.groups ?? [],
        failures: value.failures ?? [],
      },
    }
  } finally {
    observed?.dispose()
  }
}

/** Install one explicit model selection on a session. */
async function selectModel(deps: MobileApiDeps, input: Record<string, unknown>): Promise<MobileResult> {
  const sessionId = typeof input['sessionId'] === 'string' ? input['sessionId'] : ''
  const provider = typeof input['provider'] === 'string' ? input['provider'] : ''
  const model = typeof input['model'] === 'string' ? input['model'] : ''
  if (sessionId === '' || provider === '' || model === '') {
    return badRequest('sessionId, provider and model are required')
  }
  return await invoke(deps, 'session', 'selectModel', {
    request: {
      sessionId,
      provider,
      model,
      ...(typeof input['reasoningEffort'] === 'string' ? { reasoningEffort: input['reasoningEffort'] } : {}),
    },
  })
}

/** Rename one session. */
async function renameSession(deps: MobileApiDeps, input: Record<string, unknown>): Promise<MobileResult> {
  const sessionId = typeof input['sessionId'] === 'string' ? input['sessionId'] : ''
  const title = typeof input['title'] === 'string' ? input['title'] : ''
  if (sessionId === '' || title.trim() === '') return badRequest('sessionId and title are required')
  return await invoke(deps, 'session', 'rename', { request: { sessionId, title } })
}

/** One session observation reduced to what this adapter consumes. */
interface SessionObservationView {
  /** Inclusive tail cut: the `throughSeq` a page request must carry. */
  readonly cursor: number
  /** Projection wire values at the cut, when the registry is mounted. */
  readonly projections?: { asOfSeq: number; values: Record<string, unknown> }
  dispose(): void
}

/**
 * Observe one session's tail cut. `session.page` demands a `throughSeq` that
 * is a valid log index no greater than the current tail, and only a follow
 * opening frame or an observation carries it — this is the observation path
 * (the same `ctx.sessionQuery.observeSession` the Remote method uses), so the
 * phone never has to open a stream before reading history.
 */
async function observe(
  deps: MobileApiDeps,
  sessionId: string,
  projectionMode: 'all' | 'none',
): Promise<SessionObservationView> {
  const observation = await deps.sessionQuery.observeSession(sessionId as never, { projectionMode })
  return {
    cursor: observation.cursor,
    ...(observation.projections === undefined
      ? {}
      : {
        projections: {
          asOfSeq: observation.projections.asOfSeq,
          values: observation.projections.values as Record<string, unknown>,
        },
      }),
    dispose: () => { observation[Symbol.dispose]() },
  }
}

/** Encode one list position as an opaque continuation cursor. */
function sessionListCursor(updatedAt: number, sessionId: string): string {
  return `${updatedAt}:${sessionId}`
}

/** Parse a cursor; malformed cursors mean "start over" (safe failure mode). */
function parseSessionListCursor(cursor: string): { updatedAt: number; sessionId: string } | undefined {
  const separator = cursor.indexOf(':')
  if (separator < 0) return undefined
  const updatedAt = Number(cursor.slice(0, separator))
  if (!Number.isFinite(updatedAt)) return undefined
  return { updatedAt, sessionId: cursor.slice(separator + 1) }
}

/** Whether a row comes strictly after the cursor position. */
function afterCursor(row: { updatedAt: number; sessionId: string }, position: { updatedAt: number; sessionId: string }): boolean {
  return row.updatedAt < position.updatedAt
    || (row.updatedAt === position.updatedAt && row.sessionId > position.sessionId)
}

/** Projection values out of one follow snapshot frame. */
function projectionValuesOf(projections: unknown): Record<string, unknown> | undefined {
  const values = asRecord(projections)['values']
  return values === undefined ? undefined : asRecord(values)
}

/** One JSON comparison for projection change detection. */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true
  try {
    return JSON.stringify(left) === JSON.stringify(right)
  } catch {
    return false
  }
}

/** A record view of an untrusted payload. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** A finite number, or undefined for anything else. */
function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/** One bad-request result. */
function badRequest(message: string): MobileResult {
  return { ok: false, error: { code: 'bad-request', message, details: {} } }
}

/**
 * The phone-facing failure for any thrown value. Business failures thrown by
 * a Remote method carry the structural marker the protocol uses
 * (`isDSHRemoteError` + `code`), which is read here without importing the
 * protocol's runtime (the host half stays type-only against the SDK).
 */
function failureOf(error: unknown): MobileFailure {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { isDSHRemoteError?: unknown; code?: unknown; message?: unknown; details?: unknown }
    if (candidate.isDSHRemoteError === true && typeof candidate.code === 'string') {
      return {
        code: candidate.code,
        message: typeof candidate.message === 'string' ? candidate.message : candidate.code,
        details: asRecord(candidate.details),
      }
    }
  }
  return { code: 'internal', message: error instanceof Error ? error.message : String(error), details: {} }
}
