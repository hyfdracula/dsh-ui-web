/**
 * Shared types for the dsh-bilibili-download plugin — used by both
 * host (routes) and browser (client API) halves.
 */

/** One downloadable format (from yt-dlp --list-formats). */
export interface BiliFormat {
  id: string
  ext: string
  resolution: string
  fps: number
  filesize: number
  tbr: number
  vcodec: string
  acodec: string
  note: string
}

/** Video metadata returned by the /info endpoint. */
export interface BiliVideoInfo {
  title: string
  url: string
  duration: number
  formats: BiliFormat[]
  thumbnail?: string
}

/** Quality preset for the UI dropdown. */
export interface QualityPreset {
  label: string
  videoFmt: string
  audioFmt: string
  description: string
}

/** Cookies submitted by the user (minimum set for Bilibili auth). */
export interface BiliCookies {
  SESSDATA: string
  bili_jct: string
  DedeUserID: string
}

/** Remembered-cookie settings namespace shape (host writes, browser reads). */
export interface CookieSettings {
  sessdata?: string
  biliJct?: string
  dedeUserID?: string
}

/** Convert the settings-namespace shape to the API cookie shape. */
export function settingsToCookies(settings: CookieSettings | undefined): BiliCookies {
  return {
    SESSDATA: settings?.sessdata ?? '',
    bili_jct: settings?.biliJct ?? '',
    DedeUserID: settings?.dedeUserID ?? '',
  }
}

/** Convert the API cookie shape to the settings-namespace shape. */
export function cookiesToSettings(cookies: BiliCookies): CookieSettings {
  return {
    sessdata: cookies.SESSDATA,
    biliJct: cookies.bili_jct,
    dedeUserID: cookies.DedeUserID,
  }
}

/** Download request payload. */
export interface DownloadRequest {
  url: string
  cookies: BiliCookies
  videoFmt: string
  audioFmt: string
  outputDir: string
}

/** Progress line from the download stream. */
export interface DownloadProgress {
  percent: string
  speed: string
  eta: string
  downloaded: string
  total: string
  target: 'video' | 'audio' | 'merging' | 'done'
}

/** Info request payload. */
export interface InfoRequest {
  url: string
  cookies: BiliCookies
}

/** Info response. */
export type InfoResponse =
  | { ok: true; info: BiliVideoInfo }
  | { ok: false; error: string }

/** Start response (starts streaming NDJSON). */
export type StartResponse =
  | { ok: true; outputPath: string }
  | { ok: false; error: string }

/** NDJSON line in the download stream. */
export type StreamLine =
  | { type: 'progress'; progress: DownloadProgress }
  | { type: 'result'; ok: true; file: string }
  | { type: 'result'; ok: false; error: string }

/** API prefix constant (shared by host routes and client api.ts). */
export const BILI_API = {
  info: '/api/dsh-bilibili-download/info',
  start: '/api/dsh-bilibili-download/start',
  check: '/api/dsh-bilibili-download/check',
} as const

/** Predefined quality presets the UI offers. */
export const QUALITY_PRESETS: QualityPreset[] = [
  { label: '4K 超高清 (HEVC)', videoFmt: '30121', audioFmt: '30280', description: '5.1 GB, 麒麟芯片硬解' },
  { label: '4K 超高清 (AV1)', videoFmt: '100029', audioFmt: '30280', description: '3.6 GB, 需软解' },
  { label: '4K 超高清 (AVC)', videoFmt: '30120', audioFmt: '30280', description: '9.6 GB, 最兼容' },
  { label: '1080P 高码率 (HEVC)', videoFmt: '30102', audioFmt: '30280', description: '1.9 GB' },
  { label: '1080P 高码率 (AVC)', videoFmt: '30112', audioFmt: '30280', description: '2.7 GB' },
  { label: '1080P 高清 (AVC)', videoFmt: '30080', audioFmt: '30280', description: '1.8 GB' },
  { label: '720P 准高清 (AVC)', videoFmt: '30064', audioFmt: '30280', description: '840 MB' },
]