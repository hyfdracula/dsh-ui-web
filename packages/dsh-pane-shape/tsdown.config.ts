/**
 * Standalone build config for the pane-shape layer.
 * Uses the vendored dsh client-bundle preset (shared/tsdown.client.ts).
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-pane-shape', ['src/index.ts'])
