/**
 * HTTP route handlers for the /api/dsh-bilibili-download family.
 *
 * info  — POST /api/dsh-bilibili-download/info   (JSON → JSON)
 * start — POST /api/dsh-bilibili-download/start  (JSON → NDJSON stream)
 * check — GET  /api/dsh-bilibili-download/check  (→ JSON)
 */
import { execSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import {
  BILI_API,
  type DownloadRequest,
  type DownloadProgress,
  type InfoRequest,
  type InfoResponse,
  type StreamLine,
} from './protocol.ts'

/** Cap on JSON body bytes. */
const MAX_JSON_BYTES = 64 * 1024

/**
 * Resolve yt-dlp. Prefers the Python Scripts path used by the current
 * machine, falls back to PATH lookup.
 */
function findYtdlp(): string | undefined {
  const candidates = [
    join(process.env.LOCALAPPDATA ?? 'C:\\', 'Programs', 'Python', 'Python312', 'Scripts', 'yt-dlp.exe'),
    'yt-dlp',
  ]
  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" --version`, { timeout: 5000, stdio: 'pipe' })
      return candidate
    } catch { /* try next */ }
  }
  return undefined
}

/**
 * Resolve ffmpeg. Prefers the imageio-ffmpeg bundled binary, falls back to
 * PATH lookup.
 */
function findFfmpeg(): string | undefined {
  const bundled = join(
    process.env.LOCALAPPDATA ?? 'C:\\',
    'Programs', 'Python', 'Python312', 'Lib', 'site-packages',
    'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v7.1.exe',
  )
  if (existsSync(bundled)) return bundled
  try {
    execSync('ffmpeg -version', { timeout: 5000, stdio: 'pipe' })
    return 'ffmpeg'
  } catch { /* not on PATH */ }
  return undefined
}

/** Read a JSON request body. */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = chunk as Buffer
    size += buffer.length
    if (size > MAX_JSON_BYTES) return undefined
    chunks.push(buffer)
  }
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : undefined
  } catch {
    return undefined
  }
}

/** Write a JSON response. */
function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** Build a Netscape-format cookie file for yt-dlp. Returns the file path. */
function makeCookieFile(cookies: { SESSDATA: string; bili_jct: string; DedeUserID: string }): string {
  const cookieFile = join(tmpdir(), `dsh-bili-cookies-${Date.now()}.txt`)
  const content = [
    '# Netscape HTTP Cookie File',
    `.bilibili.com\tTRUE\t/\tTRUE\t2147483647\tSESSDATA\t${cookies.SESSDATA}`,
    `.bilibili.com\tTRUE\t/\tTRUE\t2147483647\tbili_jct\t${cookies.bili_jct}`,
    `.bilibili.com\tTRUE\t/\tTRUE\t2147483647\tDedeUserID\t${cookies.DedeUserID}`,
    '',
  ].join('\n')
  writeFileSync(cookieFile, content, 'utf8')
  return cookieFile
}

/** Parse a yt-dlp size string like "5.14GiB" → bytes. */
function parseSize(text: string | undefined): number {
  if (!text) return 0
  const match = /^([\d.]+)\s*([kMGTP]?i?B)/i.exec(text.trim())
  if (!match) return 0
  const num = Number(match[1])
  const unit = match[2].toLowerCase()
  const mult: Record<string, number> = {
    b: 1,
    kb: 1000, kib: 1024,
    mb: 1000**2, mib: 1024**2,
    gb: 1000**3, gib: 1024**3,
  }
  return Math.round(num * (mult[unit] ?? 1))
}

/**
 * Build the three route handlers.
 */
export function makeRoutes(): { infoRoute: WebRoute; startRoute: WebRoute; checkRoute: WebRoute } {
  const ytdlpPath = findYtdlp()
  const ffmpegPath = findFfmpeg()

  // ------------------------------------------------------------------ check
  const checkRoute: WebRoute = {
    kind: 'exact',
    path: `${BILI_API.check}`,
    handler: async (_req: IncomingMessage, res: ServerResponse) => {
      writeJson(res, 200, {
        ytDlp: ytdlpPath !== undefined,
        ffmpeg: ffmpegPath !== undefined,
        ytDlpPath: ytdlpPath ?? null,
        ffmpegPath: ffmpegPath ?? null,
      })
    },
  }

  // ------------------------------------------------------------------ info
  const infoRoute: WebRoute = {
    kind: 'exact',
    path: `${BILI_API.info}`,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const body = await readJsonBody(req) as InfoRequest | undefined
      if (!body?.url || !body?.cookies?.SESSDATA) {
        writeJson(res, 400, { ok: false, error: '缺少 url 或 cookies' })
        return
      }
      if (!ytdlpPath) {
        writeJson(res, 500, { ok: false, error: '未找到 yt-dlp，请先安装' })
        return
      }

      let cookieFile: string | undefined
      try {
        cookieFile = makeCookieFile(body.cookies)

        // Ask yt-dlp for video metadata as JSON (--dump-json), no download.
        const child = spawn(ytdlpPath, [
          '--force-ipv4',
          '--cookies', cookieFile,
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--dump-json',
          '--no-playlist',
          body.url,
        ], { stdio: ['ignore', 'pipe', 'pipe'] })

        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (d: Buffer) => { stdout += d.toString('utf8') })
        child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8') })

        const code = await new Promise<number>((resolve) => {
          child.on('close', (c) => resolve(c ?? 1))
        })
        if (code !== 0) {
          const errLine = stderr.split('\n').filter(l => l.trim()).slice(-3).join(' | ')
          writeJson(res, 500, { ok: false, error: `yt-dlp 失败: ${errLine || `退出码 ${code}`}` })
          return
        }

        // Parse the JSON (first line). Formats carry a `format` field.
        const firstLine = stdout.split('\n').find(l => l.trim().startsWith('{'))
        if (!firstLine) {
          writeJson(res, 500, { ok: false, error: 'yt-dlp 输出为空' })
          return
        }
        const info = JSON.parse(firstLine)
        const formats = (info.formats ?? []).map((f: any) => ({
          id: String(f.format_id ?? ''),
          ext: f.ext ?? '',
          resolution: [f.width, f.height].filter(Boolean).join('x') || f.resolution || 'audio',
          fps: f.fps ?? 0,
          filesize: f.filesize ?? f.filesize_approx ?? 0,
          tbr: Math.round(f.tbr ?? 0),
          vcodec: f.vcodec ?? '',
          acodec: f.acodec ?? '',
          note: f.format_note ?? '',
        }))

        writeJson(res, 200, {
          ok: true,
          info: {
            title: info.title ?? '未知标题',
            url: body.url,
            duration: info.duration ?? 0,
            thumbnail: info.thumbnail ?? undefined,
            formats,
          },
        } satisfies InfoResponse)
      } catch (e: any) {
        writeJson(res, 500, { ok: false, error: `获取视频信息失败: ${e.message}` })
      } finally {
        if (cookieFile) {
          try { unlinkSync(cookieFile) } catch { /* ignore */ }
        }
      }
    },
  }

  // ----------------------------------------------------------------- start
  const startRoute: WebRoute = {
    kind: 'exact',
    path: `${BILI_API.start}`,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      const body = await readJsonBody(req) as DownloadRequest | undefined
      if (!body?.url || !body?.cookies?.SESSDATA || !body?.videoFmt) {
        writeJson(res, 400, { ok: false, error: '缺少必填参数' })
        return
      }
      if (!ytdlpPath) {
        writeJson(res, 500, { ok: false, error: '未找到 yt-dlp，请先安装' })
        return
      }

      let cookieFile: string | undefined
      try {
        cookieFile = makeCookieFile(body.cookies)

        // Resolve the output directory: absolute, or join the user's Desktop.
        const raw = (body.outputDir || 'B 站下载').trim()
        let outputDir: string
        if (join === undefined) outputDir = raw // unreachable; keeps TS happy
        else if (raw.includes(':') || raw.startsWith('/') || raw.startsWith('\\\\')) outputDir = raw
        else outputDir = join(process.env.USERPROFILE ?? '', 'Desktop', raw)
        mkdirSync(outputDir, { recursive: true })

        // NDJSON stream headers.
        res.writeHead(200, {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-cache',
        })

        const args = [
          '--force-ipv4',
          '--cookies', cookieFile,
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          '--extractor-args', 'BiliBili:cdn=coso1',
          '-f', `${body.videoFmt}+${body.audioFmt}`,
          '--merge-output-format', 'mp4',
          '--no-playlist',
          '--newline',
          '-o', join(outputDir, '%(title)s.%(ext)s'),
          body.url,
        ]
        if (ffmpegPath) args.push('--ffmpeg-location', ffmpegPath)

        const child = spawn(ytdlpPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
        let outputFile = ''
        let stderr = ''

        child.stdout.on('data', (d: Buffer) => {
          const text = d.toString('utf8')
          for (const line of text.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue

            // Destination line: [download] Destination: C:\...\file.mp4
            const dest = /^\[download\] Destination: (.+)$/.exec(trimmed)
            if (dest) {
              outputFile = dest[1].trim()
              continue
            }

            // Progress line: [download]  45.6% of    5.14GiB at 19.37MiB/s ETA 02:38
            const prog = /^\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w?B\/s)\s+ETA\s+([\d:]+|--:--:--)/.exec(trimmed)
            if (prog) {
              const progress: DownloadProgress = {
                percent: prog[1],
                total: prog[2],
                speed: prog[3],
                eta: prog[4],
                downloaded: '',
                target: 'video',
              }
              res.write(JSON.stringify({ type: 'progress', progress } satisfies StreamLine) + '\n')
              continue
            }

            // Merger start
            const merge = /^\[Merger\] Merging formats into "(.+)"$/.exec(trimmed)
            if (merge) {
              outputFile = merge[1]
              res.write(JSON.stringify({ type: 'progress', progress: { percent: '100', speed: '', eta: '', downloaded: '', total: '', target: 'merging' } } satisfies StreamLine) + '\n')
            }
          }
        })

        child.stderr.on('data', (d: Buffer) => { stderr += d.toString('utf8') })

        child.on('close', (code) => {
          if (code === 0) {
            // Normalise the output path (strip .part / .fN suffixes).
            const finalFile = outputFile
              .replace(/\.part$/, '')
              .replace(/\.(f\d+\.)?(mp4|m4a)$/, '.mp4')
            res.write(JSON.stringify({ type: 'result', ok: true, file: finalFile } satisfies StreamLine) + '\n')
          } else {
            const err = stderr.split('\n').filter(l => l.trim()).slice(-6).join(' | ') || `yt-dlp 退出码 ${code}`
            res.write(JSON.stringify({ type: 'result', ok: false, error: err } satisfies StreamLine) + '\n')
          }
          res.end()
        })

        // If the client disconnects, kill the child.
        req.on('close', () => {
          if (!child.killed && child.exitCode === null) {
            try { child.kill() } catch { /* already gone */ }
          }
        })
      } catch (e: any) {
        writeJson(res, 500, { ok: false, error: `下载启动失败: ${e.message}` })
        if (cookieFile) {
          try { unlinkSync(cookieFile) } catch { /* ignore */ }
        }
      }
    },
  }

  return { infoRoute, startRoute, checkRoute }
}