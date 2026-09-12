/**
 * Standalone build config for the path-links pure-function library.
 * Pure TS (no React/DOM/cordis runtime), so the browser client face is a
 * plain module — the same closure-factory artifact every dsh-ui-web plugin
 * emits, importable by other client bundles through the loader table.
 */
import { clientBundle } from '../../shared/tsdown.client.ts'

export default clientBundle('@captain1275/dsh-path-links', ['src/index.ts'])
