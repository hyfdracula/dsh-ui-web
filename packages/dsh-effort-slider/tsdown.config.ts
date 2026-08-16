/**
 * Standalone build config for the effort slider plugin.
 * Uses the vendored dsh client-bundle preset (shared/tsdown.client.ts).
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-effort-slider', ['src/index.ts'])
