/**
 * Runtime seam stamper.
 *
 * The Aqua stylesheet keys off stable data-* hooks (`data-dsh-frame`,
 * `data-dsh-sidebar-root`, `data-hero-headline`, …). In the monorepo those
 * hooks are authored into the base packages' source; for a self-contained
 * distribution (installed against a stock DSH) this module stamps them onto
 * the matching elements at runtime, so the stylesheet works with zero base
 * edits. Each selector uses only stable attributes already present in the stock
 * UI (`data-composer-card`, `data-slot` values, ARIA roles) or
 * lightningcss-preserved class-name substrings.
 *
 * Stamps are idempotent and inert without the `data-dsh-aqua` root attribute
 * (the whole stylesheet is gated on it), so they are simply left in place when
 * the layer flips off — "off" still renders the exact stock UI.
 */

interface Seam {
  /** Attribute to stamp (bare name; value is always ''). */
  readonly attribute: string
  /** CSS selector for the element(s) to stamp. */
  readonly selector: string
  /** Stamp only the first (topmost) match, not every descendant match. */
  readonly first?: boolean
}

const SEAMS: readonly Seam[] = [
  // The layout frame: the sidebar column's direct parent (0.1.5 class `frame`).
  { attribute: 'data-dsh-frame', selector: ':has(> [class*="sidebarCol"])' },
  // The sidebar COLUMN box itself (the bubble the shell insets by 12px and
  // rounds to 20px). Stamped so the stylesheet can line its top row up with the
  // conversation header card and the right column without keying off the
  // hashed module class.
  { attribute: 'data-dsh-sidebar-col', selector: '[class*="sidebarCol"]', first: true },
  // The sidebar content root (topmost `root` under the column — settings
  // internals also carry a `root` class but sit deeper, so first match wins).
  { attribute: 'data-dsh-sidebar-root', selector: '[class*="sidebarCol"] [class*="root"]', first: true },
  // New-session button (the raised-surface seam).
  { attribute: 'data-dsh-surface', selector: 'button[class*="newSession"]' },
  // Right-hand column: 0.1.5 declares it as the `rightbar` slot (the 0.1.1
  // `detailsCol` class no longer exists), so the stable slot hook is used.
  { attribute: 'data-dsh-details', selector: '[data-slot="rightbar"]', first: true },
  // Composer bar root: the composer card's direct parent.
  { attribute: 'data-dsh-inputbar', selector: ':has(> [data-composer-card])' },
  // Composer attach "+" button.
  { attribute: 'data-dsh-add', selector: '[data-composer-card] [class*="add"]' },
  // The sidebar wordmark button (its badge plate gets the official pill).
  { attribute: 'data-dsh-wordmark', selector: '[class*="sidebarCol"] [class*="brand"]', first: true },
  //
  // Two 0.1.1 seams have no 0.1.5 equivalent and are intentionally absent
  // (their stylesheet rules then simply never apply, and the stock look is
  // what shows through):
  //   - `data-dsh-trajectory`: the composer-overlay view container
  //     (`[data-conversation-composer-overlay]`) was replaced by the
  //     conversation "view" mechanism (ui-trajectory renders into the normal
  //     conversation area, keyed by `data-slot="main.conversation"`).
  //   - `data-dsh-stats`: the `conversation.composer.dock` stats line was
  //     replaced by the per-turn usage row in the turn tail; the slot no
  //     longer exists in the 0.1.5 slot contract.
]

function stamp(seam: Seam): void {
  if (seam.first) {
    const el = document.querySelector(seam.selector)
    if (el !== null && !el.hasAttribute(seam.attribute)) el.setAttribute(seam.attribute, '')
    return
  }
  for (const el of document.querySelectorAll(seam.selector)) {
    if (!el.hasAttribute(seam.attribute)) el.setAttribute(seam.attribute, '')
  }
}

function stampAll(): void {
  for (const seam of SEAMS) stamp(seam)
}

/**
 * Stamp the seams once, then keep them stamped as React remounts nodes.
 * @returns a disposer that disconnects the observer.
 */
export function startSeamStamper(): () => void {
  stampAll()
  const observer = new MutationObserver(() => { stampAll() })
  observer.observe(document.documentElement, { childList: true, subtree: true })
  return () => { observer.disconnect() }
}
