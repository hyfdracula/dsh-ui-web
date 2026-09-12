/**
 * Browser-half entry for the dsh-bilibili-download plugin.
 *
 * The plugin no longer occupies the sidebar: it registers a single card into
 * the `web-ui.plugin.item` child slot (the Web UI plugin group in the
 * settings page). The card opens the download panel as a full-screen modal,
 * and binds the `bili-download` settings namespace so cookies can be
 * remembered between sessions.
 */
import type { ClientContext, SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client';
import { type BiliDownloadKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Bilibili download card copy. */
        'bili-download': BiliDownloadKey;
    }
    interface SlotMap {
        /**
         * The child slot the Web UI plugin group card declares; this card
         * registers into the group instead of the top-level `settings.plugin.item`
         * list. Spelled here with the same shape so this package can register
         * without depending on the sibling UI package.
         */
        'web-ui.plugin.item': {
            kind: 'list';
            scope: 'root';
            owner: BiliSettingsCardOwnerProps;
        };
    }
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /**
         * Optional rc.6 compatibility binder provided by dsh-web-ui-settings;
         * absent when that group plugin is not installed, so callers fall back to
         * the official settings scope.
         */
        webUiSettings?: {
            bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S>;
        };
    }
}
/** Owner share of a plugin card (the group card supplies nothing). */
export interface BiliSettingsCardOwnerProps {
    /** Marker field: card owner props are intentionally empty. */
    children?: never;
}
/** Required services. */
export declare const inject: string[];
/**
 * Register the settings card.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
