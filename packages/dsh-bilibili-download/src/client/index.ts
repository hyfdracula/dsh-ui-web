/**
 * Browser-half entry for the dsh-bilibili-download plugin.
 *
 * The plugin no longer occupies the sidebar: it registers a single card into
 * the `web-ui.plugin.item` child slot (the Web UI plugin group in the
 * settings page). The card opens the download panel as a full-screen modal,
 * and binds the `bili-download` settings namespace so cookies can be
 * remembered between sessions.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface Context merge (ctx.settingsScope).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the SlotMap merge (the 'web-ui.plugin.item' entry).
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type { CookieSettings } from '../protocol.ts'
import { BiliApi } from './api.ts'
import { BiliSettingsCard } from './BiliSettingsCard.tsx'
import { en, zh, type BiliDownloadKey } from './locales.ts'
// Type-only: 0.1.5 declares `ctx.slots` in ui-renderer's Context merge (ui-slots
// keeps the slot contracts).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

/** Locale namespace this plugin owns. */
const NS = 'bili-download'

/** Settings namespace of the remembered cookies (spelled here AND in the host half). */
const COOKIE_NS = 'bili-download'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Bilibili download card copy. */
    'bili-download': BiliDownloadKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group card declares; this card
     * registers into the group instead of the top-level `settings.plugin.item`
     * list. Spelled here with the same shape so this package can register
     * without depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: BiliSettingsCardOwnerProps }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Optional rc.6 compatibility binder provided by dsh-web-ui-settings;
     * absent when that group plugin is not installed, so callers fall back to
     * the official settings scope.
     */
    webUiSettings?: { bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S> }
  }
}

/** Owner share of a plugin card (the group card supplies nothing). */
export interface BiliSettingsCardOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

/** Required services. */
export const inject = ['slots', 'locale', 'settingsScope']

/**
 * Register the settings card.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'bili-download: dictionaries')

  const api = new BiliApi()
  const t = ctx.locale.bind(NS)
  const binder = ctx.get('webUiSettings') ?? ctx.settingsScope
  const cookieScope = binder.bind<CookieSettings>({ namespace: COOKIE_NS })

  // The single entry point: a card inside the Web UI plugin group. No sidebar
  // injection — the home page stays clean.
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'bili-download',
    order: 90,
    locale: NS,
    inject: () => ({ t, api, cookieScope }),
  }, BiliSettingsCard))
}