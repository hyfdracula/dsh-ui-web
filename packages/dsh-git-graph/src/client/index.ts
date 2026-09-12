/**
 * Git-graph surface plugin, browser half: the git branch selector chip,
 * docked above the input card in `conversation.input.dock`.
 *
 * The dock is this chip's only seat. Its previously preferred seat — the
 * input selector row's context hole `conversation.input.selector.context`
 * — exists in no DSH release: the 0.1.5 ui-conversation slot contract
 * declares composer extension points only, and no released shell ever
 * declared the hole. Waiting on that declaration stranded the chip behind a
 * 2s timer whose fallback raced the dock declaration, and the locally
 * spelled SlotMap entry kept a phantom key type-checked.
 *
 * The dock is a session-scoped list slot: the conversation root publishes
 * the input zone (`{ session, input }`) as the entry owner share, so the
 * chip mounts once a session is active and reads its session id off
 * `props.session.sessionId`. It hides itself when its data source is absent
 * (no session cwd, or not a git repository) — no workspace selector lives
 * here, the official chip above the input card owns workspace selection.
 * Only the cold start (no session at all) has no seat, which is the
 * accepted degradation. All git facts arrive through the host /git routes
 * (this package's own host half); the inject face carries the business
 * verbs, the components stay pure props.
 * @module dsh-git-graph/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// /types, not the root: the root entry carries the HOST Context merge
// (sessions: SessionStore) and this is the browser program.
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-conversation SlotMap merge — the conversation
// slots, `conversation.input.dock` (this chip's seat) among them.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: 0.1.5 declares `ctx.slots` in ui-renderer's Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {
  BranchesView, GitError, GraphView, RepoStatus, SwitchResult,
} from '../core/types.ts'
import { GitApi, subscribeChanges } from './api.ts'
import { BranchChip } from './chips/BranchChip.tsx'
import { en, zh, type GitGraphKey } from './locales.ts'

export type { GitGraphKey } from './locales.ts'
export { BranchChip } from './chips/BranchChip.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The git-graph chip copy. */
    'git-graph': GitGraphKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'git-graph'

/** Required services: slots for the input-dock entry, sessions for the cwd lookup, locale for the copy. */
export const inject = ['slots', 'sessions', 'connection', 'locale']

/** Injected business face of the branch chip: git verbs, keyed by the current session id. */
export interface GitGraphInjected {
  /** The workspace repository snapshot; null when not a repository. */
  repoStatus: (sessionId: SessionId | undefined) => Promise<RepoStatus | null>
  /** Local branch list with the current branch marked. */
  branches: (sessionId: SessionId | undefined) => Promise<BranchesView | null>
  /** Workspace-level `git switch --no-guess <branch>`. */
  switchBranch: (sessionId: SessionId | undefined, branch: string) => Promise<SwitchResult>
  /** `git switch --no-guess -c <name>` from the current HEAD. */
  createBranch: (sessionId: SessionId | undefined, name: string) => Promise<SwitchResult>
  /** Topo-ordered commit graph. */
  graph: (sessionId: SessionId | undefined, limit?: number) => Promise<GraphView | null>
  /** Host-pushed branch-state changes for the session's workspace. */
  subscribeChanges: (sessionId: SessionId | undefined, onChange: () => void) => () => void
}

/** The session-cwd lookup failure shared by the injected verbs. */
const NO_WORKSPACE: GitError = { code: 'workspace-unknown', message: 'session has no workspace' }

/**
 * Client plugin body: the branch chip entry with its git verbs, on the
 * `conversation.input.dock` seat.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-git-graph: dictionaries')

  const git = new GitApi()

  // Conditional mount: the conversation service being up is the
  // registration-safe signal (the GoalBar/QueueDock seam) — the very root
  // that declares and renders the input dock.
  ctx.inject(['slots', 'conversation', 'sessions'], (scope: ClientContext) => {
    const sessions = scope.sessions

    /** The session's workspace root, resolved at call time from the sessions baseline. */
    const cwdOf = (sessionId: SessionId | undefined): string | undefined =>
      sessionId === undefined ? undefined : sessions.list.getSnapshot().byId[sessionId]?.cwd

    /** The injected face shared by every seat this chip registers into. */
    const injected = (): GitGraphInjected => {
      /** Resolve the workspace root for one git call. */
      const pathOf = (sessionId: SessionId | undefined): { ok: true; path: string } | { ok: false; error: GitError } => {
        const cwd = cwdOf(sessionId)
        if (cwd === undefined || cwd === '') return { ok: false, error: NO_WORKSPACE }
        return { ok: true, path: cwd }
      }
      return {
        repoStatus: async (sessionId) => {
          const resolved = pathOf(sessionId)
          if (!resolved.ok) return null
          const result = await git.status(resolved.path)
          return result.ok ? result.value : null
        },
        branches: async (sessionId) => {
          const resolved = pathOf(sessionId)
          if (!resolved.ok) return null
          const result = await git.branches(resolved.path)
          return result.ok ? result.value : null
        },
        switchBranch: async (sessionId, branch) => {
          const resolved = pathOf(sessionId)
          if (!resolved.ok) return { ok: false, error: resolved.error }
          const result = await git.switchBranch(resolved.path, branch)
          return result.ok ? { ok: true, branch: result.value.branch } : result
        },
        createBranch: async (sessionId, name) => {
          const resolved = pathOf(sessionId)
          if (!resolved.ok) return { ok: false, error: resolved.error }
          const result = await git.createBranch(resolved.path, name)
          return result.ok ? { ok: true, branch: result.value.branch } : result
        },
        graph: async (sessionId, limit) => {
          const resolved = pathOf(sessionId)
          if (!resolved.ok) return null
          const result = await git.graph(resolved.path, limit)
          return result.ok ? result.value : null
        },
        subscribeChanges: (sessionId, onChange) => {
          const resolved = pathOf(sessionId)
          if (!resolved.ok) return () => {}
          return subscribeChanges(resolved.path, onChange)
        },
      }
    }

    // Declaration-aware: a bare register() would throw on a shell that has
    // not declared the dock yet (SDK SlotCore.register rejects undeclared
    // slots), so the entry routes through inject like the GoalBar /
    // model-selection entries. The wait dies with the fiber, so no seat
    // survives an unload.
    //
    // The inject face is a factory: the renderer calls
    // `entry.inject(sessionId)` and merges the result into the component
    // props. The face itself is session-keyed per verb (the chip passes the
    // id it reads from the published zone), so the parameter is unused.
    const chipEntry = {
      id: 'git-graph',
      order: 100,
      locale: NS,
      inject: () => injected(),
    } as const
    scope.slots.inject('conversation.input.dock', () =>
      scope.slots.register({ name: 'conversation.input.dock', ...chipEntry }, BranchChip))
  })
}
