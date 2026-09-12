/**
 * Aqua skin — host half.
 *
 * Registers the empty `aqua` settings namespace: the 0.1.5 settings shell
 * dispatches plugin cards by the namespace they edit, so the browser card
 * (`settings.plugin.item` keyed `aqua`) needs the Host to expose that
 * namespace. Every Aqua knob lives in the browser (the layer persists them in
 * localStorage and re-applies on `storage` events), so the section itself
 * carries no fields.
 *
 * @module @captain1275/dsh-client-ui-skin-aqua
 */

import type { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-settings'

/** Stable cordis plugin name (mirrors the cordis.patch.yml insert id). */
export const name = 'ui-skin-aqua'

/**
 * Settings namespace pairing the browser card to the Plugins tab. Spelled as a
 * plain literal: since 0.1.5 a namespace is named directly (the old
 * `settingsNamespace()` helper is gone), and the browser half spells the same
 * value without depending on a Host package.
 */
export const AQUA_SETTINGS_NAMESPACE = 'aqua'

/** Plugin configuration: intentionally empty (the Host stores no Aqua state). */
export interface Config {}

/** The section schema: an empty object, so the namespace exists and validates. */
export const AquaSettingsSchema: z<Config> = z.object({})

/**
 * Mount the Aqua settings namespace.
 *
 * The section installs behind `ctx.inject(['settings'], …)` (the pattern every
 * host half in this repository uses): the settings service may mount after this
 * plugin, and the install is skipped cleanly while it is absent.
 * @param ctx - host plugin context.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, AQUA_SETTINGS_NAMESPACE, AquaSettingsSchema, {}, {
      setSource: () => {},
      onChange: () => {},
    })
  })
}
