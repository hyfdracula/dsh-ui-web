/**
 * Standalone build config for the quick-restart plugin.
 * Uses the vendored dsh client-bundle preset (shared/tsdown.client.ts).
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-quick-restart', ['src/index.ts'])
