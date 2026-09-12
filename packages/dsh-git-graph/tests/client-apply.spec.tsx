// @vitest-environment jsdom
/**
 * Client apply() registration tests: the browser half registers the branch
 * chip on `conversation.input.dock` — the only seat that exists in a DSH
 * release. This guards both regressions around that seat: the first pass
 * registered on the phantom `conversation.input.selector.context` key (no
 * shell ever declared it, so a declaration-aware inject would wait forever),
 * and the entry handed `inject` a plain object where the renderer calls
 * `entry.inject(sessionId)`.
 */
import { describe, expect, it, vi } from 'vitest'
import { apply } from '../src/client/index.ts'
import { BranchChip } from '../src/client/chips/BranchChip.tsx'

describe('client apply()', () => {
  it('registers the branch chip on the input dock (session scope)', () => {
    const register = vi.fn((_options: { inject?: unknown }, _component: unknown) => () => undefined)
    const slotInject = vi.fn((_name: string, callback: () => () => void) => callback())

    const scope = {
      slots: { inject: slotInject, register },
      conversation: {},
      sessions: { list: { getSnapshot: () => ({ byId: {} }) } },
    }
    const ctx = {
      effect: vi.fn((fn: () => void) => { fn(); return () => {} }),
      locale: { register: vi.fn() },
      inject: vi.fn((_services: unknown, callback: (s: typeof scope) => void) => { callback(scope) }),
    }

    apply(ctx as never)

    // The registration waits on the conversation/sessions seam, then on the
    // dock declaration before registering the chip component.
    expect(ctx.inject).toHaveBeenCalledWith(['slots', 'conversation', 'sessions'], expect.any(Function))
    expect(slotInject).toHaveBeenCalledWith('conversation.input.dock', expect.any(Function))
    expect(register).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'conversation.input.dock',
        id: 'git-graph',
        order: 100,
      }),
      BranchChip,
    )
    // The inject seat is a factory the renderer calls with the session id;
    // a plain object face throws `inject is not a function` at first render.
    expect(typeof register.mock.calls[0]?.[0]?.inject).toBe('function')
    expect(slotInject).not.toHaveBeenCalledWith('conversation.input.selector.context', expect.anything())
  })
})

