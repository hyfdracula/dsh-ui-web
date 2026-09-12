/**
 * dsh-pane-shape 宿主半区。纯 UI 层：空 apply 让插件出现在宿主 cordis 加载列表里，
 * 浏览器半区经 package.json 的 dsh.client 声明加载。
 * @module @captain1275/dsh-pane-shape
 */
import type { Context } from '@deepseek-ai/cordis'

/** 稳定插件名（对应 cordis.patch.yml 的 insert id）。 */
export const name = 'ui-pane-shape'

/** 宿主插件体：无宿主侧行为。 */
export function apply(_ctx: Context): void {}
