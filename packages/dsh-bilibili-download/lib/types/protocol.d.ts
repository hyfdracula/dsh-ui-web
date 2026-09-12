/**
 * Shared types for the dsh-bilibili-download plugin — used by both
 * host (routes) and browser (client API) halves.
 */
/** One downloadable format (from yt-dlp --list-formats). */
export interface BiliFormat {
    id: string;
    ext: string;
    resolution: string;
    fps: number;
    filesize: number;
    tbr: number;
    vcodec: string;
    acodec: string;
    note: string;
}
/** Video metadata returned by the /info endpoint. */
export interface BiliVideoInfo {
    title: string;
    url: string;
    duration: number;
    formats: BiliFormat[];
    thumbnail?: string;
}
/** Quality preset for the UI dropdown. */
export interface QualityPreset {
    label: string;
    videoFmt: string;
    audioFmt: string;
    description: string;
}
/** Cookies submitted by the user (minimum set for Bilibili auth). */
export interface BiliCookies {
    SESSDATA: string;
    bili_jct: string;
    DedeUserID: string;
}
/** Remembered-cookie settings namespace shape (host writes, browser reads). */
export interface CookieSettings {
    sessdata?: string;
    biliJct?: string;
    dedeUserID?: string;
}
/** Convert the settings-namespace shape to the API cookie shape. */
export declare function settingsToCookies(settings: CookieSettings | undefined): BiliCookies;
/** Convert the API cookie shape to the settings-namespace shape. */
export declare function cookiesToSettings(cookies: BiliCookies): CookieSettings;
/** Download request payload. */
export interface DownloadRequest {
    url: string;
    cookies: BiliCookies;
    videoFmt: string;
    audioFmt: string;
    outputDir: string;
}
/** Progress line from the download stream. */
export interface DownloadProgress {
    percent: string;
    speed: string;
    eta: string;
    downloaded: string;
    total: string;
    target: 'video' | 'audio' | 'merging' | 'done';
}
/** Info request payload. */
export interface InfoRequest {
    url: string;
    cookies: BiliCookies;
}
/** Info response. */
export type InfoResponse = {
    ok: true;
    info: BiliVideoInfo;
} | {
    ok: false;
    error: string;
};
/** Start response (starts streaming NDJSON). */
export type StartResponse = {
    ok: true;
    outputPath: string;
} | {
    ok: false;
    error: string;
};
/** NDJSON line in the download stream. */
export type StreamLine = {
    type: 'progress';
    progress: DownloadProgress;
} | {
    type: 'result';
    ok: true;
    file: string;
} | {
    type: 'result';
    ok: false;
    error: string;
};
/** API prefix constant (shared by host routes and client api.ts). */
export declare const BILI_API: {
    readonly info: "/api/dsh-bilibili-download/info";
    readonly start: "/api/dsh-bilibili-download/start";
    readonly check: "/api/dsh-bilibili-download/check";
};
/** Predefined quality presets the UI offers. */
export declare const QUALITY_PRESETS: QualityPreset[];
