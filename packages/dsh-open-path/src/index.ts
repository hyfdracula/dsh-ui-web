/**
 * dsh-open-path 宿主半区。
 * 注册 POST /api/open-path：把聊天里 linkify 的本地绝对路径用 Explorer
 * 打开（文件夹开窗口、文件用默认程序打开）。纯宿主路由，无浏览器行为。
 * @module @captain1275/dsh-open-path
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { spawn } from 'node:child_process'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'open-path'

/** 路由前缀。 */
export const OPEN_PATH_API_PREFIX = '/api/open-path'

/**
 * 规范化一个待打开路径：必须是 Windows 绝对路径（盘符或 UNC），允许
 * 两侧带引号（复制为路径会带引号）；不存在或非法返回 undefined。
 * @param raw - 客户端传来的原始值。
 * @returns 规范化后的绝对路径，或 undefined。
 */
export function normalizeOpenTarget(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  let p = raw.trim()
  if (p.length === 0) return undefined
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
    p = p.slice(1, -1).trim()
  }
  if (p.length === 0 || p.includes('\0')) return undefined
  if (!/^[A-Za-z]:[\\/]/.test(p) && !/^\\\\/.test(p)) return undefined
  const abs = resolvePath(p)
  if (!existsSync(abs)) return undefined
  return abs
}

/** 用 Explorer 打开绝对路径（detached，不阻塞请求）。 */
export function openWithExplorer(abs: string): void {
  const child = spawn('explorer.exe', [abs], { detached: true, stdio: 'ignore' })
  child.unref()
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8')
      if (body.length > 1_000_000) {
        reject(new Error('body too large'))
        req.destroy()
      }
    })
    req.on('end', () => resolveBody(body))
    req.on('error', reject)
  })
}

/** 请求分发：POST /api/open-path。 */
function handle(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? '/', 'http://dsh.local')
  if (url.pathname !== OPEN_PATH_API_PREFIX) {
    sendJson(res, 404, { ok: false, error: 'not found' })
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'method not allowed' })
    return
  }
  void readBody(req)
    .then((body) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(body) as { path?: unknown }
      } catch {
        sendJson(res, 400, { ok: false, error: 'bad json' })
        return
      }
      const target = normalizeOpenTarget((parsed as { path?: unknown })?.path)
      if (target === undefined) {
        sendJson(res, 400, { ok: false, error: 'invalid path' })
        return
      }
      openWithExplorer(target)
      sendJson(res, 200, { ok: true })
    })
    .catch((e) => sendJson(res, 400, { ok: false, error: e instanceof Error ? e.message : String(e) }))
}

/** 宿主插件体：注册打开路径路由（无 webServer 服务时为空操作）。 */
export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (httpCtx) => {
    const dispose = httpCtx.webServer.register({ kind: 'prefix', path: OPEN_PATH_API_PREFIX, handler: handle })
    httpCtx.effect(() => dispose, 'open-path: route')
  })
}