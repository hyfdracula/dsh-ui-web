/**
 * Client-side API for the dsh-bilibili-download plugin.
 *
 * Talks to the host routes via plain fetch, same origin.
 */
import { BILI_API, type DownloadProgress, type InfoResponse, type StreamLine } from '../protocol.ts'

/** Error class for API errors. */
export class BiliApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BiliApiError'
  }
}

/** Helper: check response or throw. */
async function readJson<T>(response: Response): Promise<T> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new BiliApiError(`HTTP ${response.status}: invalid JSON`)
  }
  if (!response.ok) {
    const msg = typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `HTTP ${response.status}`
    throw new BiliApiError(msg)
  }
  return body as T
}

/** Client-side API for the download routes. */
export class BiliApi {
  /** Check if yt-dlp and ffmpeg are available. */
  async check(): Promise<{ ytDlp: boolean; ffmpeg: boolean; ytDlpPath: string; ffmpegPath: string | null }> {
    const response = await fetch(BILI_API.check)
    return readJson(response)
  }

  /** Get video info (title, formats, etc.). */
  async getInfo(url: string, cookies: { SESSDATA: string; bili_jct: string; DedeUserID: string }): Promise<InfoResponse> {
    const response = await fetch(BILI_API.info, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, cookies }),
    })
    return readJson(response)
  }

  /**
   * Start a download. Returns an NDJSON stream reader.
   * @param url - video URL
   * @param cookies - auth cookies
   * @param videoFmt - yt-dlp format id for video
   * @param audioFmt - yt-dlp format id for audio
   * @param outputDir - output directory
   * @param onProgress - progress callback
   * @param onResult - result callback (file path or error)
   * @returns AbortController to cancel the download
   */
  async startDownload(
    url: string,
    cookies: { SESSDATA: string; bili_jct: string; DedeUserID: string },
    videoFmt: string,
    audioFmt: string,
    outputDir: string,
    onProgress: (progress: DownloadProgress) => void,
    onResult: (ok: boolean, fileOrError: string) => void,
  ): Promise<AbortController> {
    const controller = new AbortController()

    const response = await fetch(BILI_API.start, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url, cookies, videoFmt, audioFmt, outputDir }),
      signal: controller.signal,
    })

    if (!response.ok || response.body === null) {
      const text = await response.text().catch(() => '')
      throw new BiliApiError(text || `HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const readLoop = async (): Promise<void> => {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (line.trim() === '') continue
            try {
              const parsed: StreamLine = JSON.parse(line)
              if (parsed.type === 'progress') {
                onProgress(parsed.progress)
              } else if (parsed.type === 'result') {
                onResult(parsed.ok, parsed.ok ? parsed.file : parsed.error)
              }
            } catch { /* skip unparseable lines */ }
          }
        }
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          onResult(false, e.message || '下载中断')
        }
      }
    }

    readLoop()
    return controller
  }
}