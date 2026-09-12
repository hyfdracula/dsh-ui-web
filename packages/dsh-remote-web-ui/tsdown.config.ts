import { clientBundle, mobileBundle } from '../../shared/tsdown.client.ts'

// The host half imports every SDK package type-only (services arrive through
// cordis: typertGateway / sessionQuery / workspaceRegistry), so the library
// build needs no external entry beyond cordis itself — the pre-0.1.5
// `@deepseek-ai/dsh-host-apiproxy` external went away with that package.
export default clientBundle('@captain1275/dsh-remote-web-ui', ['src/index.ts', 'src/invariant.ts'], {
  companions: [mobileBundle('@captain1275/dsh-remote-web-ui', 'src/mobile/index.tsx')],
})
