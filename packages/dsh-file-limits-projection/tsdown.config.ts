/**
 * Standalone build config for the file-limits projection plugin.
 * Host-side (node) plugin: node-half lib plus a minimal browser client face.
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-file-limits-projection', ['src/index.ts'])
