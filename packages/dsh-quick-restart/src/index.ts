/**
 * dsh-quick-restart — 宿主半区。
 *
 * 只做一件事：把「请重启」变成 checkout 里那个巡检脚本看得懂的文件。
 *  `C:\Users\19161\deepseek-harness-next\dsh-restart.request`
 * 由 `dsh-restart-agent.ps1`（计划任务 `DSH Restart Agent`，每 2 分钟一次）读取：
 * 它检测到请求后先问宿主「有没有回合在跑」，等到空闲才停→起→替换窗口。
 *
 * 端点（同源 JSON，和 dsh-pet 的 /api/pet 家族同一套做法）：
 *   GET  /api/quick-restart/state    -> { ok, pending, requestedAt, note, keeperTail }
 *   POST /api/quick-restart/request  -> 写请求文件，返回同上结构
 *
 * 为什么写文件而不是直接在这里重启：重启要杀掉本插件所在的进程，
 * 只有进程外的巡检（计划任务）能可靠地干这件事——宿主挂了它也还在。
 * @module @captain1275/dsh-quick-restart
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-quick-restart'

/** 需要宿主 web 服务器来挂自己的 JSON 端点。 */
export const inject = ['webServer']

/** 插件配置：checkout 根目录。 */
export interface QuickRestartConfig {
  readonly repoRoot?: string
}

const DEFAULT_REPO_ROOT = 'C:\\Users\\19161\\deepseek-harness-next'
const REQUEST_FILE = 'dsh-restart.request'
const KEEPER_LOG = 'dsh-restart-agent.log'
const KEEPER_TAIL_LINES = 3

/** 重启请求文件的内容上限（防止写进一大堆东西）。 */
const MAX_NOTE_LENGTH = 500

interface QuickRestartState {
  readonly ok: true
  readonly pending: boolean
  readonly requestPath: string
  readonly requestedAt?: string
  readonly note?: string
  readonly keeperTail: readonly string[]
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function requireMethod(req: IncomingMessage, res: ServerResponse, method: string): boolean {
  if (req.method === method) return true
  json(res, 405, { ok: false, error: 'method-not-allowed' })
  return false
}

/** 读请求体（有上限），空体当 {}。 */
function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 64 * 1024) {
        reject(new Error('body-too-large'))
        queueMicrotask(() => req.destroy())
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (chunks.length === 0) { resolve({}); return }
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        resolve(parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {})
      } catch { reject(new Error('invalid-json')) }
    })
    req.on('error', reject)
  })
}

/** 当前状态：请求文件在不在、里面写了什么、巡检日志最后几行。 */
function readState(repoRoot: string): QuickRestartState {
  const requestPath = join(repoRoot, REQUEST_FILE)
  const keeperTail: string[] = []
  try {
    const logPath = join(repoRoot, KEEPER_LOG)
    if (existsSync(logPath)) {
      const lines = readFileSync(logPath, 'utf8').split(/\r?\n/).filter(line => line.trim() !== '')
      for (const line of lines.slice(-KEEPER_TAIL_LINES)) keeperTail.push(line)
    }
  } catch { /* 日志读不到不影响状态 */ }

  if (!existsSync(requestPath)) {
    return { ok: true, pending: false, requestPath, keeperTail }
  }
  let note = ''
  let requestedAt: string | undefined
  try {
    note = readFileSync(requestPath, 'utf8').trim().slice(0, MAX_NOTE_LENGTH)
    requestedAt = statSync(requestPath).mtime.toISOString()
  } catch { /* 读不到就当空请求 */ }
  return {
    ok: true,
    pending: true,
    requestPath,
    ...(requestedAt === undefined ? {} : { requestedAt }),
    ...(note === '' ? {} : { note }),
    keeperTail,
  }
}

/**
 * 挂上两个端点。
 * @param ctx - 宿主上下文（需要 webServer）。
 * @param config - 插件配置（repoRoot）。
 */
export function apply(ctx: Context, config: QuickRestartConfig = {}): void {
  const repoRoot = config.repoRoot ?? DEFAULT_REPO_ROOT
  const requestPath = join(repoRoot, REQUEST_FILE)

  const stateRoute: WebRoute = {
    kind: 'exact',
    path: '/api/quick-restart/state',
    handler: (req: IncomingMessage, res: ServerResponse): void => {
      if (!requireMethod(req, res, 'GET')) return
      try { json(res, 200, readState(repoRoot)) } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
      }
    },
  }

  const requestRoute: WebRoute = {
    kind: 'exact',
    path: '/api/quick-restart/request',
    handler: (req: IncomingMessage, res: ServerResponse): void => {
      if (!requireMethod(req, res, 'POST')) return
      void readJsonBody(req).then((body) => {
        const note = typeof body.note === 'string' ? body.note.slice(0, MAX_NOTE_LENGTH) : 'sidebar quick-restart'
        // 无 BOM 的 UTF-8：巡检脚本按普通文本读它。
        writeFileSync(requestPath, `${note}\n`, { encoding: 'utf8' })
        json(res, 200, readState(repoRoot))
      }, (error: unknown) => {
        json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) })
      })
    },
  }

  ctx.effect(() => {
    const disposers = [ctx.webServer.register(stateRoute), ctx.webServer.register(requestRoute)]
    return () => { for (const dispose of disposers) dispose() }
  }, 'quick-restart.routes')
}
