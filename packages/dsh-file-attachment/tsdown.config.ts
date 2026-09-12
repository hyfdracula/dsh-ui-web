/**
 * Standalone build config for the file-attachment provider plugin.
 * Host-side (node) package: node-half lib plus a minimal browser client face
 * (the client face exists only to keep the package uniform with the shared
 * build preset; it registers nothing). Default build emits node half during
 * the client pass alongside the client bundle — same posture as the other
 * dual-face dsh-ui-web packages.
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-file-attachment', ['src/index.ts'])
