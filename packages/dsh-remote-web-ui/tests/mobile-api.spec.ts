/**
 * The /m data channel: every allowlisted method must answer with the transport
 * envelope the phone's callUnary requires ({ type: 'server-response', rpcId,
 * result }) — regressions here surface as a dead "加载中…" mobile surface.
 *
 * 0.1.5 replaced the ApiProxy service with `ctx.typertGateway`: the stub below
 * records `{ namespace, method, args }` dispatches, so the tests also pin the
 * descriptor wire names (`_request` for `session.list`, `request` everywhere
 * else) and the tail cursor the adapter fills in for `session.page`.
 */
import { createServer, request as httpRequest } from 'node:http'
import { describe, expect, it } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { TypertGateway } from '@deepseek-ai/dsh-api-gateway'
import type { SessionQueryEngine } from '@deepseek-ai/dsh-session-query'
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import { makeMobileApiRoutes } from '../src/mobile-api.ts'

interface TestServer {
  port: number
  close: () => Promise<void>
}

const cookieName = 'dsh_pair'

/** A pairing service stub that recognizes every cookie value. */
const service = {
  config: { cookieName },
  hasDevice: () => true,
} as never

/** One recorded gateway dispatch. */
interface Dispatch {
  namespace: string
  method: string
  args: Readonly<Record<string, unknown>>
}

/** Build a gateway stub answering each Remote method with a fixed value. */
function makeGateway(): { gateway: TypertGateway; calls: Dispatch[] } {
  const calls: Dispatch[] = []
  const values: Record<string, unknown> = {
    'workspace/…': {},
    'session/list': { items: [] },
    'session/create': { sessionId: 's-created' },
    'session/page': { records: [], hasMore: false },
    'session/prompt': { accepted: true },
    'session/modelCatalog': { default: { provider: 'fx', model: 'fx-1' }, groups: [], failures: [] },
    'session/selectModel': { selected: { provider: 'fx', model: 'fx-2' } },
    'session/rename': { title: 'renamed', seq: 1 },
  }
  const gateway = {
    invoke: async (request: Dispatch) => {
      calls.push(request)
      const value = values[`${request.namespace}/${request.method}`]
      if (value === undefined) throw new Error(`unstubbed ${request.namespace}/${request.method}`)
      return value
    },
    stream: () => (async function* () {})(),
  } as unknown as TypertGateway
  return { gateway, calls }
}

/** A session query stub: one observation at the tail cut, with projections. */
const sessionQuery = {
  observeSession: async (sessionId: string, options: { projectionMode?: string }) => ({
    cursor: 41,
    header: { id: sessionId, version: 3, createdAt: 1, isSeeded: false },
    events: [],
    ...(options.projectionMode === 'all'
      ? { projections: { asOfSeq: 41, values: { permissions: { options: [{ value: 'workspace-write', name: '读写工作区' }], currentValue: 'workspace-write' } } } }
      : {}),
    retain: () => { throw new Error('not used') },
    [Symbol.dispose]: () => {},
  }),
} as unknown as SessionQueryEngine

/** A workspace registry stub with one row. */
const workspaces = {
  list: () => [{
    id: 'w-1',
    path: '/tmp/demo',
    title: '演示项目',
    sessionIds: ['s-1'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }],
} as unknown as WorkspaceRegistry

async function serve(routes: WebRoute[]): Promise<TestServer> {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://x').pathname
    // Exact routes win over the /m/api prefix (the follow stream is one).
    const route = routes.find(r => r.kind === 'exact' && r.path === pathname)
      ?? routes.find(r => r.kind === 'prefix' && pathname.startsWith(r.path))
    if (route === undefined) {
      response.writeHead(404)
      response.end()
      return
    }
    void route.handler(request, response)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return {
    port: address.port,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined || error === null) resolve()
        else reject(error)
      })
    }),
  }
}

async function call(
  port: number,
  method: string,
  payload: unknown = {},
): Promise<{ status: number; body: string }> {
  return await new Promise((resolve, reject) => {
    const body = JSON.stringify({ type: 'client-request', rpcId: 'probe-1', method, payload })
    const req = httpRequest({
      host: '127.0.0.1', port, path: `/m/api/${method}`, method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `${cookieName}=device-1`, 'content-length': Buffer.byteLength(body) },
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => { chunks.push(chunk as Buffer) })
      response.on('end', () => {
        resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
      })
    })
    req.on('error', reject)
    req.end(body)
  })
}

describe('mobile api envelope', () => {
  it('wraps every allowlisted unary method in the server-response envelope', async () => {
    const { gateway } = makeGateway()
    const server = await serve(makeMobileApiRoutes({ service, gateway, sessionQuery, workspaces }))
    try {
      for (const [method, payload] of [
        ['workspace.list', {}],
        ['session.create', { workspaceId: 'w-1' }],
        ['session.list', {}],
        ['session.page', { sessionId: 's-1' }],
        ['session.prompt', { sessionId: 's-1', text: 'hi' }],
        ['session.models', { sessionId: 's-1' }],
        ['session.selectModel', { sessionId: 's-1', provider: 'fx', model: 'fx-2' }],
        ['session.rename', { sessionId: 's-1', title: 'x' }],
      ] as const) {
        const { status, body } = await call(server.port, method, payload)
        expect(status, method).toBe(200)
        const envelope = JSON.parse(body) as { type?: string; rpcId?: string; result?: { ok?: boolean } }
        expect(envelope.type, method).toBe('server-response')
        expect(envelope.rpcId, method).toBe('probe-1')
        expect(envelope.result?.ok, method).toBe(true)
      }
    } finally {
      await server.close()
    }
  })

  it('dispatches the descriptor wire names and completes the history tail cursor', async () => {
    const { gateway, calls } = makeGateway()
    const server = await serve(makeMobileApiRoutes({ service, gateway, sessionQuery, workspaces }))
    try {
      await call(server.port, 'session.list')
      await call(server.port, 'session.page', { sessionId: 's-1' })
      expect(calls[0]).toMatchObject({ namespace: 'session', method: 'list', args: { _request: {} } })
      // The phone names the session only; `throughSeq` comes from the tail
      // observation (41) because the Remote method demands an inclusive cut.
      expect(calls[1]).toEqual({
        namespace: 'session',
        method: 'page',
        args: { request: { address: { kind: 'session', sessionId: 's-1' }, throughSeq: 41, maxMessages: 50 } },
      })
    } finally {
      await server.close()
    }
  })

  it('refuses methods outside the allowlist and unpaired requests', async () => {
    const { gateway } = makeGateway()
    const server = await serve(makeMobileApiRoutes({ service, gateway, sessionQuery, workspaces }))
    try {
      const denied = await call(server.port, 'settings.describe')
      expect(denied.status).toBe(403)
      expect(JSON.parse(denied.body)).toMatchObject({ error: { code: 'forbidden' } })
    } finally {
      await server.close()
    }
  })

  it('answers a business failure inside the envelope instead of a 5xx', async () => {
    const gateway = {
      invoke: async () => {
        const failure = new Error('session "ghost" not found') as Error & { isDSHRemoteError: boolean; code: string; details: object }
        failure.isDSHRemoteError = true
        failure.code = 'session/not-found'
        failure.details = {}
        throw failure
      },
      stream: () => (async function* () {})(),
    } as unknown as TypertGateway
    const server = await serve(makeMobileApiRoutes({ service, gateway, sessionQuery, workspaces }))
    try {
      const { status, body } = await call(server.port, 'session.page', { sessionId: 'ghost' })
      expect(status).toBe(200)
      expect(JSON.parse(body)).toMatchObject({
        type: 'server-response',
        result: { ok: false, error: { code: 'session/not-found', message: 'session "ghost" not found' } },
      })
    } finally {
      await server.close()
    }
  })
})

/** One SSE GET; resolves once the adapter ends the response. */
async function getSse(port: number, path: string, paired = true): Promise<{ status: number; body: string }> {
  return await new Promise((resolve, reject) => {
    const req = httpRequest({
      host: '127.0.0.1', port, path, method: 'GET',
      ...(paired ? { headers: { cookie: `${cookieName}=device-1` } } : {}),
    }, (response) => {
      const chunks: Buffer[] = []
      let settled = false
      const finish = (): void => {
        if (settled) return
        settled = true
        resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') })
      }
      response.on('data', (chunk) => { chunks.push(chunk as Buffer) })
      response.on('end', finish)
      response.on('close', finish)
    })
    req.on('error', reject)
    req.end()
  })
}

describe('mobile api follow stream', () => {
  /** Frames the gateway stub yields, plus the projection the event diff finds. */
  function streamGateway(): TypertGateway {
    const frames = [
      {
        type: 'snapshot',
        header: { id: 's-1', version: 3, createdAt: 1, isSeeded: false },
        cursor: 3,
        hasMore: false,
        records: [],
        projections: { asOfSeq: 3, values: { permissions: { options: [], currentValue: 'default' } } },
      },
      { type: 'event', event: { type: 'user/message', seq: 4, time: 4, data: {} } },
    ]
    return {
      invoke: async () => ({}),
      stream: async () => (async function* () { for (const frame of frames) yield frame })(),
    } as unknown as TypertGateway
  }

  it('bridges session.follow frames and pushes changed projections', async () => {
    const server = await serve(makeMobileApiRoutes({
      service,
      gateway: streamGateway(),
      // The diff after the durable event sees a different permission value
      // (workspace-write) than the opening snapshot carried (default), so
      // exactly one delta is pushed.
      sessionQuery,
      workspaces,
    }))
    try {
      const { status, body } = await getSse(server.port, '/m/api/session.follow?sessionId=s-1')
      expect(status).toBe(200)
      const lines = body.split('\n').filter(line => line.startsWith('data: '))
      expect(lines).toHaveLength(3)
      expect(JSON.parse(lines[0]!.slice('data: '.length))).toMatchObject({ type: 'snapshot' })
      expect(JSON.parse(lines[1]!.slice('data: '.length))).toMatchObject({ type: 'event', event: { seq: 4 } })
      expect(JSON.parse(lines[2]!.slice('data: '.length))).toMatchObject({
        type: 'projection',
        sessionId: 's-1',
        key: 'permissions',
        value: { options: [{ value: 'workspace-write', name: '读写工作区' }], currentValue: 'workspace-write' },
      })
    } finally {
      await server.close()
    }
  })

  it('refuses an unpaired follow request before opening any stream', async () => {
    const unpaired = { config: { cookieName }, hasDevice: () => false } as never
    const server = await serve(makeMobileApiRoutes({
      service: unpaired,
      gateway: streamGateway(),
      sessionQuery,
      workspaces,
    }))
    try {
      const { status } = await getSse(server.port, '/m/api/session.follow?sessionId=s-1', false)
      expect(status).toBe(403)
    } finally {
      await server.close()
    }
  })
})
