/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { TpsLine, formatTokensPerSecond, type LiveUsageReader } from '../src/client/TpsLine.tsx'

afterEach(cleanup)

/**
 * Reader over a fixed value: 0.1.5 removed the dock's `useProjection` hook share,
 * so the row now takes the session projection face through the plugin's inject
 * face. The value is captured once because useSyncExternalStore requires a stable
 * snapshot — the real face is identity-stable per publish, and a reader handing
 * back a fresh object every call would loop.
 */
function readerOf(value: unknown): LiveUsageReader {
  return {
    read: () => value as ReturnType<LiveUsageReader['read']>,
    subscribe: () => () => {},
  }
}

describe('TPS composer line', () => {
  it('formats stable compact rates', () => {
    expect(formatTokensPerSecond(42.64)).toBe('42.6')
    expect(formatTokensPerSecond(142.64)).toBe('143')
  })

  it('renders only after an elapsed output sample exists', () => {
    const absent = readerOf({
      estimated: true,
      uncachedInputTokens: 10,
      outputTokens: 1,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    const view = render(<TpsLine usage={absent} />)
    expect(view.container.textContent).toBe('')

    const live = readerOf({
      estimated: true,
      uncachedInputTokens: 10,
      outputTokens: 8,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      tokensPerSecond: 42.64,
    })
    view.rerender(<TpsLine usage={live} />)
    expect(view.container.textContent).toBe('TPS 42.6 tok/s')
  })

  it('renders nothing when the dock mounted without a bound session', () => {
    const view = render(<TpsLine />)
    expect(view.container.textContent).toBe('')
  })
})
