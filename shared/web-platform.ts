/**
 * Shared browser platform modules. Seeding, bundling externals, and Vite
 * aliases consume this list so their module identities cannot drift.
 *
 * Mirrors `packages/client/web/src/platform.ts` of the 0.1.5-rc.2 SDK. Two
 * corrections came out of the 0.1.5 migration:
 *   - `@deepseek-ai/dsh-client-runtime` is gone (the package was deleted and its
 *     store engine became `@deepseek-ai/dsh-client-store`, which the shell now
 *     seeds itself), and `@deepseek-ai/dsh-client-ui-dockkit` joined the seeds.
 *   - `@deepseek-ai/dsh-client-web-react` and `@deepseek-ai/dsh-client-schema-form`
 *     were listed here but exist in NO DSH release: they only ever existed as
 *     local install copies. The purity gate therefore let value imports of them
 *     through as externals while the runtime module table could not answer them,
 *     so the first plugin to import either one would have failed at load time.
 * @module @deepseek-ai/dsh-client-web/src/platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
] as const

/** One platform module specifier (a seed-table key). */
export type PlatformModule = (typeof PLATFORM_MODULES)[number]
