/**
 * Mobile remote control — browser half. Registers the `remote` dictionaries,
 * the sidebar-foot entry (phone trigger + pairing panel) into the
 * ui-sidebar-declared `sidebar.footer.action` seat, and runs the phone-side boot
 * flow (pair accept + workspace deep-link + presence heartbeats) plus the
 * one-time failed-pair notice. Export discipline: packages/client/AGENTS.md
 * — the /client surface carries only what cordis loading needs plus types.
 */
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) and the
// ui-sidebar SlotMap merge (the 'sidebar.footer.action' seat).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: 0.1.5 declares `ctx.workspaces` / `ctx.sessions` in these client
// contracts; the entry's injected face resolves the deep-link target from them.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
// Type-only: pulls the settings-surface SlotMap merge (the 'settings.section'
// entry) and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { RemoteEntry, type RemoteEntryFace } from './RemoteEntry.tsx'
import { PairFailedNotice } from './PairFailedNotice.tsx'
import { RemoteSettingsCard, RemoteSettingsCardController, type RemoteSettings } from './RemoteSettingsCard.tsx'
import { en, zh, type RemoteKey } from './locales.ts'
import { PAIR_FAILED_MARKER, runPairBootFlow } from './deep-link.ts'
import { sendHeartbeat } from './pair-api.ts'
// Type-only: 0.1.5 declares `ctx.slots` in ui-renderer's Context merge (ui-slots
// keeps the slot contracts).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

export type { RemoteEntryFace, RemoteEntryProps } from './RemoteEntry.tsx'
export type { PanelState, RemotePanelProps } from './RemotePanel.tsx'
export type { PairFailedNoticeProps } from './PairFailedNotice.tsx'
export type { RemoteKey } from './locales.ts'
export type { RemoteSettingsCardFace, RemoteSettingsCardState } from './RemoteSettingsCard.tsx'
export type { UpdateEntryProps } from './UpdateEntry.tsx'
export type { UpdatePanelProps, UpdateView } from './UpdatePanel.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Mobile remote-control surface copy. */
    remote: RemoteKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
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


/** Dictionary namespace owned by this plugin. */
const NS = 'remote'

/** Settings namespace the remote-control card edits (the Host plugin registers it). */
const REMOTE_WEB_UI_NS = 'remote-web-ui'

/**
 * The browser session face this entry reads. 0.1.5 declares `sessions` twice:
 * the host half merges `SessionStore` and the browser half merges `ISessions`,
 * and this package compiles both halves in one program — so the browser face
 * is spelled structurally here rather than read through `ctx.sessions`.
 */
interface ClientSessions {
  readonly list: { getSnapshot(): { current?: string } }
}

/**
 * Resolve the workspace a minted QR link should open: the workspace owning
 * the current session when there is one, else the registry's first row (the
 * host order the sidebar itself renders). Reading the live snapshots inside
 * the call keeps the value current for every mint.
 * @returns the workspace id, or undefined when none is registered.
 */
function resolveWorkspaceId(ctx: ClientContext): string | undefined {
  const items = ctx.get('workspaces')?.list.getSnapshot().items ?? []
  const sessions = ctx.get('sessions') as unknown as ClientSessions | undefined
  const current = sessions?.list.getSnapshot().current
  const owning = current === undefined
    ? undefined
    : items.find(workspace => workspace.sessionIds.some(id => String(id) === current))
  return owning?.workspaceId ?? items[0]?.workspaceId
}

/** Heartbeat cadence from a paired phone (presence + revocation liveness). */
const HEARTBEAT_INTERVAL_MS = 10_000

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

/**
 * Register the remote-control surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'remote-web-ui: dictionaries')

  const t = ctx.locale.bind(NS)
  const resolveWorkspaceIdOfPhone = (): string | undefined => resolveWorkspaceId(ctx)
  const binder = ctx.get('webUiSettings') ?? ctx.settingsScope
  const settingsScope = binder.bind<RemoteSettings>({ namespace: REMOTE_WEB_UI_NS })
  const enabled = (): boolean => {
    const snapshot = settingsScope.getSnapshot()
    return snapshot.status === 'ready'
      ? snapshot.value?.enabled ?? true
      : snapshot.status === 'unavailable'
  }

  // Sidebar foot entry: 0.1.5 declares only 'sidebar.footer.action' (the
  // legacy `sidebar.remote` seat and its fallback wrapper are gone), and the
  // seat supplies display state alone — the deep-link target arrives through
  // the injected face built from the live workspace/session services.
  // Registration is declaration-aware (slots.inject waits for the
  // declaration, drops the contribution when it collapses, and re-runs after
  // a redeclaration), and the entry follows the plugin's enabled setting:
  // toggling it off removes the trigger, toggling it back on re-registers it.
  ctx.slots.inject('sidebar.footer.action', () => {
    let disposeEntry: (() => void) | undefined
    const syncEntry = (): void => {
      if (enabled() && disposeEntry === undefined) {
        disposeEntry = ctx.slots.register({
          name: 'sidebar.footer.action',
          id: 'remote-web-ui',
          locale: NS,
          inject: (): RemoteEntryFace => ({ resolveWorkspaceId: resolveWorkspaceIdOfPhone }),
        }, RemoteEntry)
      } else if (!enabled() && disposeEntry !== undefined) {
        disposeEntry()
        disposeEntry = undefined
      }
    }
    const unsubscribe = settingsScope.subscribe(syncEntry)
    syncEntry()
    return () => {
      unsubscribe()
      disposeEntry?.()
    }
  })

  // Plugin configuration card: one staged form over the `remote-web-ui`
  // settings namespace, contributed to the Web UI plugin group.
  const remoteSettings = new RemoteSettingsCardController(settingsScope)
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'remote-web-ui',
    order: 90,
    locale: NS,
    inject: () => remoteSettings.inject(),
  }, RemoteSettingsCard))

  // Phone-side boot flow + heartbeats. Loopback pages (the desktop) never
  // heartbeat; the server ignores unpaired heartbeats anyway. Both run only
  // while the plugin is enabled.
  let disposeRuntime: (() => void) | undefined
  const syncRuntime = (): void => {
    if (enabled() && disposeRuntime === undefined) {
      disposeRuntime = ctx.effect(() => {
        const connection = ctx.get('connection') as ConnectionHandle | undefined
        const loopback = connection?.isLoopback ?? true
        runPairBootFlow(ctx, window.location.search)
        if (loopback) return () => {}
        const timer = window.setInterval(() => { void sendHeartbeat().catch(() => {}) }, HEARTBEAT_INTERVAL_MS)
        return () => { window.clearInterval(timer) }
      }, 'remote-web-ui: pair flow + heartbeats')
    } else if (!enabled() && disposeRuntime !== undefined) {
      disposeRuntime()
      disposeRuntime = undefined
    }
  }
  settingsScope.subscribe(syncRuntime)
  syncRuntime()

  // One-time failed-pair toast. The accept result lands asynchronously, so
  // the marker check is deferred past the accept round trip.
  ctx.effect(() => {
    const timer = window.setTimeout(() => {
      if (sessionStorage.getItem(PAIR_FAILED_MARKER) === null) return
      sessionStorage.removeItem(PAIR_FAILED_MARKER)
      const mount = document.createElement('div')
      document.body.appendChild(mount)
      const root = createRoot(mount)
      root.render(createElement(PairFailedNotice, { t }))
      // The toast owns its dismissal; the root lives for the page lifetime.
      void root
    }, 1500)
    return () => { window.clearTimeout(timer) }
  }, 'remote-web-ui: failed-pair notice')
}
