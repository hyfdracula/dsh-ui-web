/**
 * Host-side entry for dsh-bilibili-download — runs in the DSH host process.
 *
 * Registers the /api/dsh-bilibili-download route family (info, start, check),
 * the bili-download settings namespace (remembered cookies), and makes the
 * plugin identity known to the cordis loader.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
/** Stable cordis plugin id (matches cordis.patch.yml insert id). */
export declare const name = "ui-bilibili-download";
/** Required services (settings optional: installSettingsSection degrades gracefully). */
export declare const inject: string[];
/** The remembered-cookie namespace (spelled here AND in the browser half). */
export declare const BILI_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
/** Schema of the remembered-cookie namespace. Empty strings mean "not saved". */
export interface CookieSettings {
    sessdata?: string;
    biliJct?: string;
    dedeUserID?: string;
}
export declare const Config: z<CookieSettings>;
/**
 * Mount the download routes and the settings namespace.
 * @param ctx - host context with webServer/settings services.
 */
export declare function apply(ctx: Context): void;
