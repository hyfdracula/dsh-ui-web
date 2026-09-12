/**
 * Mobile-surface business API: the handful of host methods the simplified
 * surface needs, called over the plugin's own `/m/api` channel (see
 * `mobile-api.ts` host half). Types come from the 0.1.5 Remote contract
 * (type-only imports; the wire schemas stay in the bundle only through the
 * `wire.ts` guards and the `rpc.ts` envelope).
 *
 * The method names are the adapter's own vocabulary — the adapter maps each
 * one onto the official Remote namespace (`session.page`, `session.follow`,
 * `session.modelCatalog`, …), fills in what the phone cannot know (the history
 * tail cursor), and narrows what the phone must not see.
 */

import { callUnary } from './rpc.ts'
import {
  parseCreatedSession,
  parseHistoryPage,
  parseSelectedModel,
  parseSessionListPage,
  parseSessionModels,
  parseWorkspaceRows,
  type CreatedSession,
  type HistoryPage,
  type SessionListPage,
  type SessionModels,
  type WorkspaceRow,
} from './wire.ts'

export type {
  CreatedSession,
  HistoryPage,
  SessionListPage,
  SessionModels,
  WorkspaceRow,
} from './wire.ts'

/** One selected model triple (the wire `ModelSelection`). */
export interface ModelSelection {
  provider: string
  model: string
  reasoningEffort?: string
}

/** The workspace roster (the host registry's stable order). */
export async function listWorkspaces(): Promise<WorkspaceRow[]> {
  return parseWorkspaceRows(await callUnary<unknown>('workspace.list', {}))
}

/** One session.list page; omit the cursor for the first page. */
export async function listSessions(cursor?: string): Promise<SessionListPage> {
  return parseSessionListPage(await callUnary<unknown>('session.list', cursor === undefined ? {} : { cursor }))
}

/**
 * Create a blank session (entity birth precedes the first message). Name a
 * workspace to attach it there, or a cwd; omitting both uses the host cwd.
 */
export async function createSession(
  options: { workspaceId?: string; cwd?: string } = {},
): Promise<CreatedSession> {
  return parseCreatedSession(await callUnary<unknown>('session.create', options))
}

/**
 * One message-aligned history window; omit beforeSeq for the tail page. The
 * host supplies the inclusive tail cut the Remote method demands.
 */
export async function history(
  sessionId: string,
  beforeSeq?: number,
  maxMessages = 30,
): Promise<HistoryPage> {
  return parseHistoryPage(await callUnary<unknown>('session.page', {
    sessionId,
    maxMessages,
    ...(beforeSeq !== undefined ? { beforeSeq } : {}),
  }))
}

/** Send one text prompt (queued: the agent picks it up in order). */
export async function prompt(sessionId: string, text: string): Promise<void> {
  await callUnary<unknown>('session.prompt', { sessionId, text })
}

/** Send one slash command line (e.g. `/permission workspace-write`). */
export async function sendCommand(sessionId: string, line: string): Promise<unknown> {
  return await callUnary<unknown>('session.prompt', { sessionId, text: line })
}

/** Fresh advisory model directory for one session (groups + current selection). */
export async function models(sessionId: string): Promise<SessionModels> {
  return parseSessionModels(await callUnary<unknown>('session.models', { sessionId }))
}

/** Select the complete model selection (provider/model/reasoning effort) for a session. */
export async function selectModel(
  sessionId: string,
  selection: ModelSelection,
): Promise<{ selected: ModelSelection }> {
  const value = await callUnary<unknown>('session.selectModel', {
    sessionId,
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort !== undefined ? { reasoningEffort: selection.reasoningEffort } : {}),
  })
  return { selected: parseSelectedModel(value) }
}
