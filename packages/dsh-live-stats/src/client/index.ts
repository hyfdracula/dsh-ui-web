import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface SlotMap merge (the definitions that
// name the 'settings.*' holes) and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { LiveStatsSettingsCard, LiveStatsSettingsCardController, type LiveStatsSettings } from './LiveStatsSettingsCard.tsx'
import { TpsLineDockEntry, type LiveUsageReader } from './TpsLine.tsx'
import { en, zh, type SettingsCardKey } from './locales.ts'
// Type-only: 0.1.5 declares `ctx.slots` in ui-renderer's Context merge (ui-slots
// keeps the slot contracts).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

export { TpsLine, formatTokensPerSecond } from './TpsLine.tsx'
export type { LiveStatsSettings, LiveStatsSettingsCardFace, LiveStatsSettingsCardState } from './LiveStatsSettingsCard.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** live-stats settings-card copy. */
    'live-stats': SettingsCardKey
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
const NS = 'live-stats'

/** The projection key the host half registers and this half reads. */
const LIVE_USAGE_KEY = 'liveTokenUsage'

/**
 * Resolve one session's projection read face.
 *
 * The client contract is named explicitly because this combined program also sees
 * the HOST declaration (Context.sessions: SessionStore) via the projection
 * module's imports, and only the client shape exists at runtime.
 * @param ctx - client root context.
 * @param sessionId - the dock's session.
 * @returns the reader the TPS line subscribes to, or undefined when unbound.
 */
function usageReader(ctx: ClientContext, sessionId: string): LiveUsageReader | undefined {
  const sessions = ctx.sessions as unknown as ISessions
  const face = sessions.binding(sessionId as SessionId)?.session.projections.faceOf(LIVE_USAGE_KEY)
  if (face === undefined) return undefined
  return {
    read: () => face.getSnapshot() as ReturnType<LiveUsageReader['read']>,
    subscribe: listener => face.subscribe(listener),
  }
}

/** Settings namespace the live-stats card edits (the Host plugin registers it). */
const LIVE_STATS_NS = 'live-stats'

/** Services required by this plugin. */
export const inject = ['slots', 'locale', 'connection', 'settingsScope', 'remote']

/**
 * Register the live-stats surface: the generation-throughput TPS group lives
 * in the ui-conversation stats line (read directly from the `liveTokenUsage`
 * projection), and this build of the browser half mounts the plugin settings
 * card over the `live-stats` namespace.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'live-stats: dictionaries')

  // Plugin configuration card: one staged form over the `live-stats` settings
  // namespace, contributed to the plugin-configuration section.
  const binder = ctx.get('webUiSettings') ?? ctx.settingsScope
  const liveStatsSettings = new LiveStatsSettingsCardController(
    binder.bind<LiveStatsSettings>({ namespace: LIVE_STATS_NS }),
  )
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'live-stats',
    order: 110,
    locale: NS,
    inject: () => liveStatsSettings.inject(),
  }, LiveStatsSettingsCard))

  // The live TPS row mounts on the composer dock (the shipped stats-line seat).
  // 0.1.5's dock carries no useProjection hook share, so this plugin injects the
  // session's own projection face instead; the row subscribes to it. Previously
  // TpsLine was only exported for shell integration and never actually mounted on
  // rc.6 (issue #56).
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'live-stats',
    order: 100,
    inject: (sessionId?: string) => {
      const usage = sessionId === undefined ? undefined : usageReader(ctx, sessionId)
      return usage === undefined ? {} : { usage }
    },
  }, TpsLineDockEntry))
}
