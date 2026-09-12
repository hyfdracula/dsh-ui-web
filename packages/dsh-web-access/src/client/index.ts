/**
 * Browser half — intentionally empty. The `/web` command is host-side only;
 * the shared tsdown preset still emits a client bundle from this entry, but
 * package.json declares no `dsh.client`, so the GUI never composes it.
 */
export {}
