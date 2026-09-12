/**
 * Aqua client plugin body: the toggleable glassmorphism skin. Owns the durable
 * enable flag (localStorage), applies/retracts the theme layer through
 * {@link AquaLayer}, and registers two settings surfaces:
 * - the master on/off card into the Plugins section (`settings.plugin.item`,
 *   same shape as the other plugin cards);
 * - every glass knob into the General section's Appearance row area
 *   (`settings.general.item`, right under 外观).
 * One click on the master switch returns the stock UI (every layer is an
 * effect, disposed on flip).
 */
// Type-only: pulls `ctx.theme`, `ctx.slots` and `ctx.locale` into this program, and
// the two settings seats the Aqua surfaces register into.
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the `settings.plugin.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
// Type-only: pulls the `settings.general.item` SlotMap merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: 0.1.5 declares `ctx.slots` in ui-renderer's Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the theme plugin's Context merge (ctx.theme) and the locale
// plugin's (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ThemeRuntime } from '@deepseek-ai/dsh-client-ui-theme/client'
import { AquaPluginCard, type AquaPluginCardInjected } from './AquaPluginCard.tsx'
import { AquaAppearanceRow, type AquaAppearanceRowInjected } from './AquaAppearanceRow.tsx'
import { createAquaRowStore, type AquaSettingsPayload } from './settings-store.ts'
import { en, NS, zh } from './locales.ts'
import { AquaLayer, type AquaLayerHost } from './theme-layer.ts'
// Side-effect imports: the theme-layer stylesheet (unloaded with the plugin)
// and the self-hosted Space Grotesk @font-face (no shell dependency).
import './aqua.module.css'
import './fonts.module.css'

/** Required services: theme override stack plus the settings-card surfaces. */
export const inject = ['theme', 'slots', 'locale']

/**
 * The client context as this bundle reads it. The boot-graph path provides the
 * declared services; the skin center's live try-on mounts the same bundle on a
 * minimal stage context that implements only `effect` and `get`. Every optional
 * surface is therefore read defensively: an absent renderer or locale simply
 * skips the settings seats, and the visual layer still applies in full.
 */
type AquaContext = AquaLayerHost & {
  slots?: ClientContext['slots']
  locale?: ClientContext['locale']
}

/**
 * Client plugin body.
 * @param ctx - client cordis context, or the skin center's stage context.
 */
export function apply(ctx: ClientContext): void {
  const host = ctx as unknown as AquaContext
  const theme = host.get?.('theme') as ThemeRuntime | undefined
  // No renderer means a stage mount (skin-center try-on): the settings seats
  // below have nowhere to render, and the layer must not persist its flag.
  const stage = host.slots === undefined
  const locale = host.locale

  if (locale !== undefined) {
    ctx.effect(() => locale.register(NS, { zh, en }), 'ui-aqua: settings dictionaries')
  }

  // The layer owns its lifecycle: enable flag, token stack, and CSS attribute
  // are all effects released on disable/dispose.
  const layer = new AquaLayer(host, { theme, stage })

  // Two store mirrors of the same layer state: one for the Plugins card
  // (master switch) and one for the General section's Appearance row (knobs).
  const pluginStore = createAquaRowStore()
  const appearanceStore = createAquaRowStore()
  let pluginBound: BoundActions<typeof pluginStore> | undefined
  let appearanceBound: BoundActions<typeof appearanceStore> | undefined
  let revision = 0
  const payload = (): AquaSettingsPayload => {
    const s = layer.getSettings()
    return {
      enabled: layer.getEnabled(),
      mode: s.mode,
      blur: s.blur,
      frost: s.frost,
      fluidHue: s.fluidHue,
      bgBrightness: s.bgBrightness,
      dark: layer.getDark(),
      background: s.background,
      wallpaper: s.wallpaper,
      whale: s.whale,
      wallpaperBlur: s.wallpaperBlur,
      wallpaperFrost: s.wallpaperFrost,
    }
  }
  const sync = (): void => {
    const next = payload()
    pluginBound?.sync(next, revision)
    appearanceBound?.sync(next, revision)
    revision += 1
  }
  // The Appearance switch flips the brightness knob's half-range; re-sync
  // both stores so the row re-renders with the new range. Stages have no
  // stores bound, so no listener is needed there.
  const on = host.on?.bind(host)
  if (on !== undefined) {
    ctx.effect(() => on('theme/change', () => { sync() }), 'ui-aqua: appearance scheme sync')
  }

  const pluginInjected = (actions: BoundActions<typeof pluginStore>): AquaPluginCardInjected => {
    pluginBound = actions
    // Re-sync from the layer so no flip is lost between registration and
    // first render (the store's revision guard drops stale duplicates).
    sync()
    return {
      setEnabled: (enabled) => {
        layer.setEnabled(enabled)
        sync()
      },
    }
  }
  const appearanceInjected = (actions: BoundActions<typeof appearanceStore>): AquaAppearanceRowInjected => {
    appearanceBound = actions
    sync()
    return {
      setMode: (mode) => {
        layer.setMode(mode)
        sync()
      },
      setBlur: (blur) => {
        layer.setBlur(blur)
        sync()
      },
      setFrost: (frost) => {
        layer.setFrost(frost)
        sync()
      },
      setFluidHue: (fluidHue) => {
        layer.setFluidHue(fluidHue)
        sync()
      },
      setBgBrightness: (bgBrightness) => {
        layer.setBgBrightness(bgBrightness)
        sync()
      },
      setBackground: (background) => {
        layer.setBackground(background)
        sync()
      },
      setWallpaper: (wallpaper) => {
        layer.setWallpaper(wallpaper)
        sync()
      },
      setWhale: (whale) => {
        layer.setWhale(whale)
        sync()
      },
      setWallpaperBlur: (wallpaperBlur) => {
        layer.setWallpaperBlur(wallpaperBlur)
        sync()
      },
      setWallpaperFrost: (wallpaperFrost) => {
        layer.setWallpaperFrost(wallpaperFrost)
        sync()
      },
    }
  }

  // Master switch card in the Plugins configurable tab.
  // rc.8 keyed protocol: the card is dispatched by the settings namespace it
  // edits (`aqua`, registered by the node half) — not by a list id.
  const slots = host.slots
  if (slots !== undefined && locale !== undefined) {
    slots.inject('settings.plugin.item', () => slots.register({
      name: 'settings.plugin.item',
      key: 'aqua',
      store: pluginStore,
      locale: NS,
      inject: pluginInjected,
    }, AquaPluginCard))

    // Glass knobs row in the General section: after the official Appearance (10)
    // and Font size (11) rows.
    slots.inject('settings.general.item', () => slots.register({
      name: 'settings.general.item',
      id: 'aqua',
      order: 12,
      store: appearanceStore,
      locale: NS,
      inject: appearanceInjected,
    }, AquaAppearanceRow))
  }
}
