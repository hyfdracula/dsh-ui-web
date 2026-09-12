// @vitest-environment jsdom
/**
 * DashboardPanel keyboard behaviour: Escape must close the dashboard, the way
 * every official dialog in the shell does, and keys that are not Escape must
 * leave it open. The overlay is portalled into document.body and its own
 * controls take no focus, so the expectation is stated against the document
 * listener the panel installs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { DashboardPanel } from './DashboardPanel.tsx'

/** React 18 only flushes effects through act() when this flag is set. */
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // The panel loads a summary on mount; a resolved empty body keeps the effect
  // quiet without reaching the network.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => { root.unmount() })
  container.remove()
  vi.unstubAllGlobals()
})

/** Mount the panel and flush its mount effects. */
async function renderPanel(onClose: () => void): Promise<void> {
  await act(async () => {
    root.render(<DashboardPanel onClose={onClose} />)
  })
}

/** Deliver one keydown the way a real keypress arrives. */
function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('DashboardPanel Escape handling', () => {
  it('closes on Escape', async () => {
    const onClose = vi.fn()
    await renderPanel(onClose)
    press('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores every other key', async () => {
    const onClose = vi.fn()
    await renderPanel(onClose)
    press('Enter')
    press('a')
    press('Tab')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('leaves a key another control already consumed alone', async () => {
    const onClose = vi.fn()
    await renderPanel(onClose)
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      event.preventDefault()
      document.dispatchEvent(event)
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('stops listening once unmounted', async () => {
    const onClose = vi.fn()
    await renderPanel(onClose)
    act(() => { root.unmount() })
    press('Escape')
    expect(onClose).not.toHaveBeenCalled()
    // Re-create the root so afterEach's unmount stays valid.
    root = createRoot(container)
  })
})
