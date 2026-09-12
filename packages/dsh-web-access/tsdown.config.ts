/**
 * Build config for the dsh-web-access command plugin. Uses the repo's shared
 * client-bundle preset (shared/tsdown.client.ts). The node half builds from
 * src/index.ts (host: registers the /web command) and types ship from
 * lib/types (tsc). libExternal keeps the SDK value imports external so the
 * host Loader resolves them from the profile tree at runtime.
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-web-access', ['src/index.ts'], {
  libExternal: ['@deepseek-ai/dsh-llm'],
})
