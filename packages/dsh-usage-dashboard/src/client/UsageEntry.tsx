/**
 * Usage dashboard sidebar entry — DOM-level injection.
 *
 * dsh's sidebar shell exposes no slot an external plugin can register into
 * (`sidebar.workspaces` / `sidebar.settings` are single-occupant and already
 * taken), so — following the task-board / ssh precedent of DOM-level
 * extension — the entry row is injected between the shell's New Session
 * button and the workspace browser. The injection self-heals: while the
 * shell has not rendered yet a body-level MutationObserver waits for it;
 * once the entry is placed that body observer disconnects (E1) and a
 * subtree observer on the sidebar root re-inserts the row whenever a React
 * re-render displaces it.
 *
 * The row is plain DOM; clicking it mounts the full-screen dashboard overlay
 * as a separate React root (see mountDashboard). The row text refreshes when
 * the document language changes (E3).
 * @module @captain1275/dsh-usage-dashboard/client/UsageEntry
 */
import { createRoot, type Root } from 'react-dom/client'
import { DashboardPanel } from './DashboardPanel.tsx'
import css from './usage-entry.module.css'
import { t } from './locales.ts'

/** Stable data attribute identifying the injected entry row. */
export const ENTRY_SELECTOR = '[data-dsh-usage-entry]'

/** Inline icon (matches the shell's 16px nav-icon look): three Aqua-blue bars. */
const ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="8" width="3" height="5" rx="0.8" fill="#a8ccf2"/><rect x="7" y="4.5" width="3" height="8.5" rx="0.8" fill="#6e9be8"/><rect x="11.5" y="1.5" width="3" height="11.5" rx="0.8" fill="#3f76d8"/></svg>'

/** 侧栏列候选（class 子串 + data-* 属性，shell 改版时可平滑迁移，E1）。 */
const SIDEBAR_COLUMN_SELECTORS = [
  '[data-pane="sidebar"]',
  '[data-sidebar-col]',
  '[data-dsh-sidebar]',
  '[class*="sidebarCol"]',
]

/** 标识"侧栏 UI 根"的 logo 行候选。 */
const LOGO_ROW_SELECTORS = [
  '[data-logo-row]',
  '[data-dsh-logo-row]',
  '[class*="logoRow"]',
]

/** 新建会话按钮候选。 */
const NEW_SESSION_SELECTORS = [
  'button[data-new-session]',
  'button[data-dsh-new-session]',
  'button[class*="newSession"]',
]

/** 按候选顺序查第一个命中的元素。 */
function queryFirst(selectors: string[], scope: ParentNode = document): HTMLElement | undefined {
  for (const selector of selectors) {
    const el = scope.querySelector<HTMLElement>(selector)
    if (el !== null) return el
  }
  return undefined
}

/** Find the sidebar shell root element, or undefined while not yet mounted. */
function sidebarRoot(): HTMLElement | undefined {
  const column = queryFirst(SIDEBAR_COLUMN_SELECTORS)
  if (column === undefined) return undefined
  // Current shells wrap the sidebar UI: column > wrapper > root(logoRow owner).
  // Prefer the element that owns the logo row — the real sidebar UI root —
  // and fall back to the column's first child for legacy shells.
  const logoOwner = queryFirst(LOGO_ROW_SELECTORS, column)?.parentElement
  return logoOwner ?? (column.firstElementChild as HTMLElement | undefined)
}

/** The New Session button: nested in the logo row on current shells, a direct child on legacy shells. */
function newSessionButton(root: HTMLElement): HTMLButtonElement | undefined {
  const nested = queryFirst(NEW_SESSION_SELECTORS, root)
  if (nested !== undefined && nested.tagName === 'BUTTON') return nested as HTMLButtonElement
  for (const child of root.children) {
    if (child.tagName === 'BUTTON') return child as HTMLButtonElement
  }
  return undefined
}

/** The injected dashboard overlay root (single instance while open). */
let overlayRoot: Root | undefined
let overlayHost: HTMLDivElement | undefined

/** Close the dashboard overlay if open. */
export function closeDashboard(): void {
  overlayRoot?.unmount()
  overlayRoot = undefined
  overlayHost?.remove()
  overlayHost = undefined
}

/** Open the full-screen dashboard overlay. */
export function openDashboard(): void {
  if (overlayRoot !== undefined) return
  overlayHost = document.createElement('div')
  overlayHost.dataset.dshUsageOverlay = ''
  document.body.appendChild(overlayHost)
  overlayRoot = createRoot(overlayHost)
  overlayRoot.render(<DashboardPanel onClose={closeDashboard} />)
}

/** Build the entry row (a detached button; insert once the shell is up). */
function createEntry(): HTMLButtonElement {
  const entry = document.createElement('button')
  entry.type = 'button'
  entry.dataset.dshUsageEntry = ''
  entry.className = css.entry
  applyEntryCopy(entry)
  entry.innerHTML = `<span class="${css.entryIcon}">${ICON}</span>`
  entry.addEventListener('click', () => { openDashboard() })
  return entry
}

/** 刷新入口文案与可访问性标签（挂载时与语言切换时调用，E3）。 */
function applyEntryCopy(entry: HTMLButtonElement): void {
  entry.setAttribute('aria-label', t('usage.entry'))
  entry.setAttribute('title', t('usage.entry'))
  let label = entry.querySelector<HTMLElement>(`.${css.entryLabel}`)
  if (label === null) {
    label = document.createElement('span')
    label.className = css.entryLabel
    entry.appendChild(label)
  }
  label.textContent = t('usage.entry')
}

/** Re-insert the entry after the New Session row (before the browser region). */
function placeEntry(root: HTMLElement, entry: HTMLButtonElement): boolean {
  const button = newSessionButton(root)
  if (button === undefined) return false
  if (entry.parentElement !== root) {
    // Position relative to the family block (entries injected by sibling
    // plugins), never relative to transient logoRow geometry: every family
    // plugin that self-heals during a re-render then lands in the same
    // relative order, so the entries cannot swap positions regardless of
    // observer callback order or of shell wrapper changes.
    const row = button.closest(LOGO_ROW_SELECTORS.join(', '))
    const base = (row !== null && row.parentElement === root) ? row : button
    const family = Array.from(root.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement
        && el.matches('[data-dsh-taskboard-entry], [data-dsh-ssh-entry], [data-dsh-usage-entry]'),
    )
    // usage sits after the whole family block.
    const anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
    root.insertBefore(entry, anchor)
  }
  return true
}

/**
 * Mount the sidebar entry, waiting for the shell to render and self-healing
 * on later React re-renders.
 * @returns disposer removing the entry and its observers.
 */
export function mountUsageEntry(): () => void {
  const entry = createEntry()
  let root: HTMLElement | undefined
  let placed = false
  let bodyWatching = false

  const stopBodyWatch = (): void => {
    if (bodyWatching) {
      bodyWatching = false
      waitObserver.disconnect()
    }
  }
  const ensureBodyWatch = (): void => {
    if (!bodyWatching) {
      bodyWatching = true
      waitObserver.observe(document.body, { childList: true, subtree: true })
    }
  }

  const tryPlace = (): void => {
    if (root !== undefined && !root.isConnected) {
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    if (placed) {
      if (document.body.contains(entry)) {
        // 已落位：停掉昂贵的全文档观察（E1），只留 rootObserver 自愈。
        stopBodyWatch()
        return
      }
      rootObserver.disconnect()
      root = undefined
      placed = false
    }
    root ??= sidebarRoot()
    if (root === undefined) {
      // 还没找到 shell：保持 body 观察，等它渲染。
      ensureBodyWatch()
      return
    }
    placed = placeEntry(root, entry)
    if (placed) {
      rootObserver.observe(root, { childList: true, subtree: true })
      stopBodyWatch()
    } else {
      // 根在但入口没放下（还没有 New Session 按钮）：继续观察。
      ensureBodyWatch()
    }
  }

  // Body-level watcher: ONLY active while the shell has not rendered /
  // the entry is not placed yet. Once placed it disconnects (E1).
  const waitObserver = new MutationObserver(() => { tryPlace() })

  // Self-heal: if a React re-render displaces the row, re-insert it in the
  // same frame (microtask before paint → no visible flicker).
  const rootObserver = new MutationObserver(() => {
    if (root === undefined || !root.isConnected) {
      placed = false
      tryPlace()
      return
    }
    if (!root.contains(entry)) {
      placed = placeEntry(root, entry)
      if (!placed) tryPlace()
    }
  })

  tryPlace()

  // E3：语言（zh↔en）切换后重建入口文案与 aria-label。
  const langObserver = new MutationObserver(() => {
    applyEntryCopy(entry)
  })
  if (typeof document !== 'undefined' && document.documentElement !== null) {
    langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  }

  return () => {
    stopBodyWatch()
    rootObserver.disconnect()
    langObserver.disconnect()
    entry.remove()
    closeDashboard()
  }
}