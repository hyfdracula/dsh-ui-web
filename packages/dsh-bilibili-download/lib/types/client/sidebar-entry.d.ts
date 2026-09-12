/**
 * Sidebar entry + panel mounting for the Bilibili download plugin.
 *
 * Injects a sidebar button between the New Session button and the workspace
 * browser. Uses DOM-level mutation observer for self-healing, following the
 * dsh-ssh precedent.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { BiliApi } from './api.ts';
import type { BiliDownloadPanel } from './BiliDownloadPanel.tsx';
/** Stable selector for the entry row. */
export declare const ENTRY_SELECTOR = "[data-dsh-bili-entry]";
/** The injected panel container. */
export declare const PANEL_SELECTOR = "[data-dsh-bili-view]";
/** Inject the sidebar entry. */
declare function mountSidebar(ctx: ClientContext, api: BiliApi, PanelComponent: typeof BiliDownloadPanel): () => void;
export { mountSidebar };
