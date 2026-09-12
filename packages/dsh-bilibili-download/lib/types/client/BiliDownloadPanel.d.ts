/**
 * Bilibili download panel — the main React UI component.
 *
 * Users paste a video URL and their cookies, select quality, then start
 * downloading. Progress is shown in real time.
 */
import { type FC } from 'react';
import type { BiliApi } from './api.ts';
import type { BiliCookies } from '../protocol.ts';
import type { BiliDownloadKey } from './locales.ts';
export interface BiliDownloadPanelProps {
    api: BiliApi;
    onClose: () => void;
    /** Locale reader (optional; falls back to built-in Chinese copy). */
    t?: (key: BiliDownloadKey) => string;
    /** Remembered cookies to pre-fill when the panel opens. */
    initialCookies?: BiliCookies;
    /** Persist the entered cookies into the settings namespace. */
    onRemember?: (cookies: BiliCookies) => Promise<void>;
}
export declare const BiliDownloadPanel: FC<BiliDownloadPanelProps>;
