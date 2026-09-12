/**
 * Client-side API for the dsh-bilibili-download plugin.
 *
 * Talks to the host routes via plain fetch, same origin.
 */
import { type DownloadProgress, type InfoResponse } from '../protocol.ts';
/** Error class for API errors. */
export declare class BiliApiError extends Error {
    constructor(message: string);
}
/** Client-side API for the download routes. */
export declare class BiliApi {
    /** Check if yt-dlp and ffmpeg are available. */
    check(): Promise<{
        ytDlp: boolean;
        ffmpeg: boolean;
        ytDlpPath: string;
        ffmpegPath: string | null;
    }>;
    /** Get video info (title, formats, etc.). */
    getInfo(url: string, cookies: {
        SESSDATA: string;
        bili_jct: string;
        DedeUserID: string;
    }): Promise<InfoResponse>;
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
    startDownload(url: string, cookies: {
        SESSDATA: string;
        bili_jct: string;
        DedeUserID: string;
    }, videoFmt: string, audioFmt: string, outputDir: string, onProgress: (progress: DownloadProgress) => void, onResult: (ok: boolean, fileOrError: string) => void): Promise<AbortController>;
}
