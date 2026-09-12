/**
 * Browser client face of dsh-path-links: re-exports the pure functions.
 * No apply side effects — this face exists so the package emits a loader-table
 * client bundle (lib/client.js) other client bundles can import, and so the
 * package stays uniform with every other dsh-ui-web plugin's build shape.
 */
export { splitPathTokens } from '../index.ts'
export type { PathToken } from '../index.ts'
