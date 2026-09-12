/**
 * Host-side entry for dsh-bilibili-download — runs in the DSH host process.
 *
 * Registers the /api/dsh-bilibili-download route family (info, start, check),
 * the bili-download settings namespace (remembered cookies), and makes the
 * plugin identity known to the cordis loader.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from 'schemastery'
import { makeRoutes } from './routes.ts'

/** Stable cordis plugin id (matches cordis.patch.yml insert id). */
export const name = 'ui-bilibili-download'

/** Required services (settings optional: installSettingsSection degrades gracefully). */
export const inject = ['webServer']

/** The remembered-cookie namespace (spelled here AND in the browser half). */
export const BILI_SETTINGS_NAMESPACE = settingsNamespace('bili-download')

/** Schema of the remembered-cookie namespace. Empty strings mean "not saved". */
export interface CookieSettings {
  sessdata?: string
  biliJct?: string
  dedeUserID?: string
}

export const Config: z<CookieSettings> = z.object({
  sessdata: z.string().default(''),
  biliJct: z.string().default(''),
  dedeUserID: z.string().default(''),
})

/** Composition-layer defaults (the settings section re-inherits these on reset). */
const ENTRY: CookieSettings = { sessdata: '', biliJct: '', dedeUserID: '' }

/**
 * Mount the download routes and the settings namespace.
 * @param ctx - host context with webServer/settings services.
 */
export function apply(ctx: Context): void {
  const { infoRoute, startRoute, checkRoute } = makeRoutes()
  const disposers: Array<() => void> = []
  try {
    disposers.push(ctx.webServer.register(infoRoute))
    disposers.push(ctx.webServer.register(startRoute))
    disposers.push(ctx.webServer.register(checkRoute))
  } catch (error) {
    console.warn('[dsh-bilibili-download] route registration failed:', error)
  }

  // The settings section only carries the remembered cookies; routes never
  // read it, so a change needs no live re-sync.
  installSettingsSection(ctx, BILI_SETTINGS_NAMESPACE, Config, ENTRY, {
    setSource: () => {},
    onChange: () => {},
  })

  ctx.effect(() => () => {
    for (const dispose of disposers.splice(0)) dispose()
  }, 'dsh-bilibili-download: routes')
}