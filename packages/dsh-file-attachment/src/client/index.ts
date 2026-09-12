/**
 * Browser client face of dsh-file-attachment.
 *
 * This package's storage is host-side only (node fs). The client face exists
 * solely to keep the package uniform with every other dsh-ui-web plugin's
 * build shape (clientBundle expects src/client/index.ts); it registers
 * nothing and exports nothing of runtime value. A future client surface (e.g.
 * upload affordance labels) would mount here.
 */
export {}
