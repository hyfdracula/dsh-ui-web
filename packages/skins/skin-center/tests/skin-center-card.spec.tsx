// @vitest-environment jsdom
/**
 * Skin-center card tests: the rewritten card drives the host's trial API
 * instead of the removed in-page try-on engine, so these cover what a reader of
 * the panel actually sees — the serving profile, the trial banner with its exit
 * button, and the POST each control issues.
 *
 * Rendering goes through react-dom directly (the package deliberately carries
 * no @testing-library dependency).
 * @module @captain1275/dsh-client-ui-skin-center/tests/skin-center-card
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ThemeSnapshot } from '@deepseek-ai/dsh-client-ui-theme/client'
import { SkinCenter, type SkinCenterComponentProps } from '../src/client/SkinCenter.tsx'
import { zh, type SkinCenterKey } from '../src/client/locales.ts'

// React 18 requires this flag before act() is used outside a test renderer;
// without it every act() call logs "not configured to support act(...)".
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** The card's copy seat: the Chinese dictionary, keyed like the real `t`. */
const t = (key: SkinCenterKey): string => zh[key]

/** A minimal theme snapshot: the card only reads the resolved colour scheme. */
const snapshot: ThemeSnapshot = {
  preference: 'system',
  fontSize: 14,
  active: { id: 'light', colorScheme: 'light', tokens: {} },
  themes: [],
  revision: 0,
}

/** The injected business face, with the theme/background handles stubbed. */
function props(): SkinCenterComponentProps {
  return {
    t,
    theme: {
      getTheme: () => snapshot,
      subscribe: () => () => {},
      setTheme: vi.fn(),
    },
    background: {
      opacity: () => 0,
      subscribe: () => () => {},
      set: vi.fn(),
    },
  } as unknown as SkinCenterComponentProps
}

/** One /api/skin-center/state payload. */
function stateBody(trial: string | null): string {
  return JSON.stringify({ ok: true, active: 'aqua', profile: 'web-next', trial })
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => { root.unmount() })
  container.remove()
  vi.restoreAllMocks()
})

/**
 * Render the card and let its mount-time state fetch settle.
 * @param trial - skin id the host should report as being tried on.
 * @param calls - records every fetched URL.
 */
async function renderCard(trial: string | null, calls: string[] = []): Promise<string[]> {
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/api/skin-center/state')) {
      return Promise.resolve(new Response(stateBody(trial), { status: 200 }))
    }
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  }))
  await act(async () => {
    root.render(createElement(SkinCenter, props()))
  })
  return calls
}

/**
 * Make sure the disclosure is open. A running trial opens the card by itself,
 * so this only clicks when it is still collapsed (clicking twice would close
 * it again and hide the banner under test).
 */
async function openCard(): Promise<void> {
  const header = container.querySelector('button[aria-expanded]')
  expect(header).not.toBeNull()
  if (header?.getAttribute('aria-expanded') === 'true') return
  await act(async () => {
    header?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

describe('skin-center card', () => {
  it('renders the plugin card and reads the host state on mount', async () => {
    const calls = await renderCard(null)
    expect(container.textContent).toContain('皮肤中心')
    expect(calls.some(url => url.includes('/api/skin-center/state'))).toBe(true)
  })

  it('shows the serving profile and no banner while no trial runs', async () => {
    await renderCard(null)
    await openCard()
    expect(container.textContent).toContain('当前 profile')
    expect(container.textContent).toContain('web-next')
    expect(container.textContent).not.toContain('试用中:')
  })

  it('banners the running trial and exits it through the host API', async () => {
    const calls = await renderCard('xp')
    await openCard()
    const text = container.textContent ?? ''
    expect(text).toContain('试用中:')
    // The banner names the skin by its English name (the card's own convention)
    // and carries the one control that ends the trial.
    expect(text).toContain('Windows XP Luna')
    expect(text).toContain('退出试用')

    // Scope to the banner: the disclosure header's own description also
    // contains the words 退出试用, so a document-wide text search would click
    // the header and merely collapse the card.
    const exit = container.querySelector('[role="status"] button')
    expect(exit).not.toBeNull()
    expect(exit?.textContent).toContain('退出试用')
    await act(async () => {
      exit?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      // The handler awaits fetch before it can act on the answer: let the
      // microtask queue drain inside this act() so the call is observable.
      await new Promise(resolve => { setTimeout(resolve, 0) })
    })
    expect(calls.some(url => url.includes('/api/skin-center/trial/exit'))).toBe(true)
  })

  it('lists every registered skin next to the official default', async () => {
    await renderCard(null)
    await openCard()
    const text = container.textContent ?? ''
    expect(text).toContain('官方默认')
    for (const name of ['Aqua', 'Aurora', 'Windows XP Luna']) {
      expect(text).toContain(name)
    }
    expect(text).toContain('恢复默认')
    expect(text).toContain('应用')
  })
})
