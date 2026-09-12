/**
 * The Bilibili download plugin card for the settings page.
 *
 * Registers into the `web-ui.plugin.item` child slot the Web UI plugin group
 * declares. Hidden from the sidebar entirely: the card is the only entry
 * point. Clicking "open panel" mounts the download panel as a full-screen
 * modal (portal to body), so it reliably appears above the GUI.
 */
import { type FC } from 'react';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { BiliApi } from './api.ts';
import type { CookieSettings } from '../protocol.ts';
/** What the registration injects (beyond the locale reader). */
export interface BiliCardFace {
    /** The API client the panel operates through. */
    api: BiliApi;
    /** The remembered-cookie settings scope (may be unready on the wire). */
    cookieScope: SettingsScope<CookieSettings>;
}
/** Props the renderer binds for the Bilibili download card. */
export type BiliSettingsCardProps = PropsLocale<'bili-download'> & InjectFace<BiliCardFace>;
/**
 * Render the settings card; clicking its header expands the card, and the
 * open button mounts a full-screen modal.
 * @param props - locale reader, API client, and the cookie scope.
 */
export declare const BiliSettingsCard: FC<BiliSettingsCardProps>;
