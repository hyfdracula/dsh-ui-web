/**
 * Task-board client plugin: wires the framework-free core (controller,
 * execution service, store) to the real client runtime and mounts the two
 * DOM surfaces — the sidebar entry row and the board view in the center
 * column.
 *
 * Failure policy: DOM mounting problems are logged, never thrown — the web
 * shell fails the whole boot when a plugin apply throws, and an external
 * plugin must not take the GUI down.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SettingsScope, SettingsScopeSpec } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the locale plugin's Context merge (ctx.locale) and its
// LocaleNamespaceMap merge table.
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the settings-surface Context merge (ctx.settingsScope).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BoardController } from '../core/controller.ts'
import { ExecutionService, type SessionDriver } from '../core/execution.ts'
import { SchedulerService } from '../core/scheduler.ts'
import { LocalStorageTaskStore } from '../core/store.ts'
import { mountBoard } from './board-mount.tsx'
import { mountSidebarEntry } from './sidebar-entry.ts'
import { TaskBoardSettingsCard, TaskBoardSettingsCardController, type TaskBoardSettings } from './TaskBoardSettingsCard.tsx'
import { en, zh, type TaskBoardKey } from './locales.ts'
// Type-only: 0.1.5 declares `ctx.slots` in ui-renderer's Context merge (ui-slots
// keeps the slot contracts).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: the CLIENT controller declares Context.sessions/workspaces
// (ISessions), which is the face this half drives. The branded ids above come
// from the packages' /types entries so the HOST declaration
// (Context.sessions: SessionStore) stays out of this program.
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { IWorkspaces } from '@deepseek-ai/dsh-api-workspace-controller/client'

/** Locale namespace this plugin owns. */
const NS = 'task-board'

/** Settings namespace the settings card edits (the Host plugin registers it). */
const TASK_BOARD_NS = 'task-board'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Task-board surface copy. */
    'task-board': TaskBoardKey
  }

  interface SlotMap {
    /**
     * The child slot the Web UI plugin group declares; this card registers
     * into the group instead of the top-level `settings.plugin.item` list.
     * Spelled here with the same shape so this package can register without
     * depending on the sibling UI package.
     */
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}

/** Owner share of a plugin card (the section supplies nothing). */
export interface SettingsPluginItemOwnerProps {
  /** Marker field: card owner props are intentionally empty. */
  children?: never
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /**
     * Optional rc.6 compatibility binder provided by dsh-web-ui-settings;
     * absent when that group plugin is not installed, so callers fall back to
     * the official settings scope.
     */
    webUiSettings?: { bind<S>(spec: SettingsScopeSpec<S>): SettingsScope<S> }
  }
}

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots', 'sessions', 'workspaces', 'connection', 'settingsScope', 'locale', 'remote']

/**
 * Mount the task board.
 * @param ctx - client root context (services: sessions, workspaces).
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'task-board: dictionaries')

  // Plugin configuration card: one staged form over the `task-board` settings
  // namespace, contributed to the Web UI plugin group.
  const binder = ctx.get('webUiSettings') ?? ctx.settingsScope
  const settingsScope = binder.bind<TaskBoardSettings>({ namespace: TASK_BOARD_NS })
  const settingsCard = new TaskBoardSettingsCardController(settingsScope)
  ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
    name: 'web-ui.plugin.item',
    id: 'task-board',
    order: 110,
    locale: NS,
    inject: () => settingsCard.inject(),
  }, TaskBoardSettingsCard))

  // The sidebar entry and board view mount once the settings scope settles;
  // while the scope is still loading, the composition default is unknown, so
  // nothing mounts yet. Only an unavailable scope (no settings surface served)
  // falls back to the composition default (enabled).
  let uiDisposer: (() => void) | undefined
  const mountUi = (): void => {
    if (uiDisposer !== undefined) return
    // The client contracts, named at the access point: this combined program also
    // sees the HOST declaration (Context.sessions: SessionStore), and the client
    // shape is the one that exists at runtime.
    const sessions = ctx.sessions as unknown as ISessions
    const workspaces = ctx.workspaces as unknown as IWorkspaces

    /** The workspace the current session's directory belongs to (0.1.5 has no
     *  recentWorkspaceId fact; the current session's cwd is the same signal). */
    const recentWorkspaceId = (): string | undefined => {
      const list = sessions.list.getSnapshot()
      const cwd = list.current === undefined ? undefined : list.byId[list.current]?.cwd
      if (cwd === undefined) return undefined
      const match = workspaces.list.getSnapshot().items.find(item => item.path === cwd)
      return match === undefined ? undefined : String(match.workspaceId)
    }

    // Core wiring: real runtime faces into the framework-free services.
    const store = new LocalStorageTaskStore()
    const exec = new ExecutionService({
      sessions: {
        list: sessions.list,
        // The client face, narrowed to the service's own structural driver.
        binding: id => sessions.binding(id as SessionId) as unknown as { session: SessionDriver } | undefined,
      },
      workspaces: {
        list: {
          getSnapshot: () => {
            const snapshot = workspaces.list.getSnapshot()
            return {
              items: snapshot.items.map(item => ({ workspaceId: String(item.workspaceId) })),
              recentWorkspaceId: recentWorkspaceId(),
            }
          },
        },
        // Creating/adopting a session in a workspace is the sessions service's
        // job in 0.1.5 (it reuses a blank session targeting the same workspace).
        connectWorkspace: async id => String(await sessions.create({ workspaceId: id as WorkspaceId })),
      },
      history: {
        // 0.1.5's client no longer serves a raw history tail for an arbitrary
        // session; the session face carries the failure fact outright.
        showsFailure: async sessionId =>
          sessions.binding(sessionId as SessionId)?.session.getSnapshot().lastAgentError != null,
      },
    })
    const controller = new BoardController({
      store,
      exec,
      sessions: {
        list: sessions.list,
        open: id => sessions.open(id as SessionId),
      },
    })
    controller.start()

    // Scheduled runs: a browser-side heartbeat that triggers due tasks through
    // the same run path as the manual Run button. The first tick is gated on
    // the session list baseline so a page-load catch-up never fires into a
    // not-yet-ready runtime; tab visibility recovery ticks immediately.
    const scheduler = new SchedulerService({
      tasks: () => controller.getSnapshot().tasks,
      now: () => Date.now(),
      runTask: id => controller.runTask(id),
      applySchedule: (id, nextRunAt, lastTriggeredAt) =>
        controller.applyScheduleNextRun(id, nextRunAt, lastTriggeredAt),
      ready: () => sessions.list.getSnapshot().phase === 'ready',
      environment: {
        addEventListener: (type, listener) => document.addEventListener(type, listener),
        removeEventListener: (type, listener) => document.removeEventListener(type, listener),
      },
    })
    scheduler.start()

    const disposers: Array<() => void> = []
    try {
      disposers.push(mountSidebarEntry(controller))
      disposers.push(mountBoard(controller, {
        list: sessions.list,
        open: id => sessions.open(id as SessionId),
      }))
    } catch (error) {
      // DOM failures degrade the board, never the GUI.
      console.error('[dsh-task-board] mount failed:', error)
    }

    uiDisposer = () => {
      for (const dispose of disposers.splice(0)) dispose()
      scheduler.dispose()
      controller.dispose()
      uiDisposer = undefined
    }
  }
  const syncEnabled = (): void => {
    const snapshot = settingsScope.getSnapshot()
    const enabled = snapshot.status === 'ready'
      ? snapshot.value?.enabled ?? true
      : snapshot.status === 'unavailable'
    if (enabled) mountUi()
    else uiDisposer?.()
  }
  settingsScope.subscribe(syncEnabled)
  syncEnabled()
}
