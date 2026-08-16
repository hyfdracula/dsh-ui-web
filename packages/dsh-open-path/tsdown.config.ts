/**
 * Standalone build config for the open-path plugin (host-only; the browser
 * half is a stub that keeps the shared client-bundle preset happy).
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-open-path', ['src/index.ts'])