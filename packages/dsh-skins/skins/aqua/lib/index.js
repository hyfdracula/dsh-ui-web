import z from "schemastery";
//#region src/index.ts
/** Stable cordis plugin name (mirrors the cordis.patch.yml insert id). */
const name = "ui-skin-aqua";
/**
* Settings namespace pairing the browser card to the Plugins tab. Spelled as a
* plain literal: since 0.1.5 a namespace is named directly (the old
* `settingsNamespace()` helper is gone), and the browser half spells the same
* value without depending on a Host package.
*/
const AQUA_SETTINGS_NAMESPACE = "aqua";
/** The section schema: an empty object, so the namespace exists and validates. */
const AquaSettingsSchema = z.object({});
/**
* Mount the Aqua settings namespace.
*
* The section installs behind `ctx.inject(['settings'], …)` (the pattern every
* host half in this repository uses): the settings service may mount after this
* plugin, and the install is skipped cleanly while it is absent.
* @param ctx - host plugin context.
*/
function apply(ctx) {
	ctx.inject(["settings"], (settingsCtx) => {
		settingsCtx.settings.installSection(ctx, AQUA_SETTINGS_NAMESPACE, AquaSettingsSchema, {}, {
			setSource: () => {},
			onChange: () => {}
		});
	});
}
//#endregion
export { AQUA_SETTINGS_NAMESPACE, AquaSettingsSchema, apply, name };
