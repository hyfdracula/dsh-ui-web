import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage, createToolResultMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { CallId, TokenUsage } from '@deepseek-ai/dsh-llm'
import SessionStore from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { apply, inject, resolveEstimatorConfig } from '../src/index.ts'
import { createLiveTokenUsageProjectionDefinition } from '../src/projection.ts'
import type { LiveTokenUsageProjection } from '../src/projection.ts'

afterEach(() => { vi.useRealTimers() })

async function harness(): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin({ inject, apply })
  return { ctx, session: ctx.sessions.create() }
}

function projected(ctx: Context, session: Session): LiveTokenUsageProjection {
  const value = ctx.sessionProjections.snapshot(session).values.liveTokenUsage
  if (value === undefined) throw new Error('liveTokenUsage projection is absent')
  return value
}

/** One settled assistant message carrying provider usage for the step. */
function settleWithUsage(session: Session, usage: TokenUsage, turn = 1, step = 1): number {
  return session.append('assistant/message', {
    turn,
    step,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: 'done' }],
      source: { kind: 'model', provider: 'mock', model: 'mock' },
    }),
    usage,
  }, { surfaceOp: 'append' }).seq
}

describe('liveTokenUsage projection', () => {
  it('resolves configurable estimation parameters and rejects invalid values', () => {
    expect(resolveEstimatorConfig({
      charsPerToken: 2,
      blockOverhead: 1,
      roleOverhead: 3,
    })).toEqual({
      charsPerToken: 2,
      blockOverhead: 1,
      roleOverhead: 3,
    })
    expect(() => resolveEstimatorConfig({ charsPerToken: 0 })).toThrow('charsPerToken')
    expect(() => resolveEstimatorConfig({ blockOverhead: 0.5 })).toThrow('blockOverhead')
    expect(() => resolveEstimatorConfig({ unknown: 1 } as never)).toThrow('unknown config key')
  })

  it('prices the request header and the surface, then accepts settled provider usage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { ctx, session } = await harness()
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'abcd' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('request/header', {
      // The system prompt is a surface node in 0.1.5, so the header carries only
      // the call config and (when present) the tool schemas.
      header: { config: { provider: 'mock', model: 'mock' } },
      reason: 'initial',
    })
    // User message 'abcd' → 1 + 4 (block) + 4 (role) = 9.
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 9,
      outputTokens: 0,
      estimated: true,
    })

    // 30 output tokens over the step's 1s window.
    vi.setSystemTime(2_000)
    settleWithUsage(session, { inputTokens: 20, outputTokens: 30, cacheReadTokens: 80 })
    expect(projected(ctx, session)).toEqual({
      uncachedInputTokens: 20,
      outputTokens: 30,
      cacheReadTokens: 80,
      cacheWriteTokens: 0,
      estimated: false,
      tokensPerSecond: 30,
    })

    // Settling with a positive elapsed window keeps the rate on the last row.
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBe(30)
  })

  it('measures the rate from the step window and keeps it resident across later steps', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    vi.setSystemTime(2_000)
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'done' }],
        source: { kind: 'model', provider: 'mock', model: 'mock' },
      }),
      usage: { inputTokens: 5, outputTokens: 10 },
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    // 10 output tokens over the 1s window.
    expect(projected(ctx, session).tokensPerSecond).toBe(10)

    // A new step before its first output keeps the last rate on the row.
    session.append('step/start', { turn: 2, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBe(10)

    // A step that settles without output does not erase it either.
    vi.setSystemTime(3_000)
    session.append('step/end', { turn: 2, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBe(10)
  })

  it('replaces same-step retry estimates and drops aborted estimates', async () => {
    const { ctx, session } = await harness()
    // An aborted first attempt leaves an estimate the successor must replace.
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })

    session.append('step/start', { turn: 1, step: 1 })
    const source = settleWithUsage(session, { inputTokens: 20, outputTokens: 5, cacheReadTokens: 80 })
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 20,
      outputTokens: 5,
      cacheReadTokens: 80,
      estimated: false,
    })

    // A later aborted turn drops an estimate-only step without touching the
    // exact totals.
    session.append('step/start', { turn: 2, step: 1 })
    session.append('step/end', { turn: 2, step: 1 })
    session.append('turn/end', { turn: 2, reason: { kind: 'aborted', reason: { kind: 'user' } } })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 20,
      outputTokens: 5,
      cacheReadTokens: 80,
      estimated: false,
    })
    expect(source).toBeGreaterThan(0)
  })

  it('settles zero-output steps without a rate and accepts zero-output usage', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 0,
      outputTokens: 0,
      estimated: true,
    })
    expect(projected(ctx, session).tokensPerSecond).toBeUndefined()

    session.append('step/start', { turn: 2, step: 1 })
    settleWithUsage(session, { inputTokens: 5, outputTokens: 0 }, 2, 1)
    session.append('step/end', { turn: 2, step: 1 })
    expect(projected(ctx, session)).toMatchObject({
      uncachedInputTokens: 5,
      outputTokens: 0,
      estimated: true,
    })
  })

  it('settles an output-less assistant message without opening the timing window', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: createMessage({
        role: 'assistant',
        content: [{ type: 'text', text: 'none' }],
        source: { kind: 'model', provider: 'mock', model: 'mock' },
      }),
    }, { surfaceOp: 'append' })
    session.append('step/end', { turn: 1, step: 1 })
    expect(projected(ctx, session).tokensPerSecond).toBeUndefined()
    expect(projected(ctx, session)).toMatchObject({ outputTokens: 0, estimated: true })
  })

  it('prices tool results and user messages on the surface', async () => {
    const { ctx, session } = await harness()
    session.append('tool/result', {
      turn: 1,
      step: 1,
      message: createToolResultMessage({
        callId: 'call_1' as CallId,
        content: [{ type: 'text', text: 'abcd' }],
        isError: false,
      }),
    }, { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'efgh' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    // Tool result: 5 (text) + 4 (block) + 4 (role); user message: 5 + 4 (role).
    expect(projected(ctx, session).uncachedInputTokens).toBe(22)
  })

  it('replaces surface ranges in the canonical envelope and rejects invalid ranges', async () => {
    const { ctx, session } = await harness()
    const first = session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'one' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    const second = session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'two' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'three' }],
      source: { kind: 'user' },
    }), {
      // 0.1.5's canonical envelope spells the replacement span startSeq/endSeq.
      surfaceOp: { op: 'replace', startSeq: first.seq, endSeq: second.seq },
      sourceEventSeqs: [first.seq, second.seq],
    })
    session.append('step/start', { turn: 1, step: 1 })
    // One message (5 chars → 2 + 4 + 4): the replaced pair is gone.
    expect(projected(ctx, session).uncachedInputTokens).toBe(10)

    const definition = createLiveTokenUsageProjectionDefinition(resolveEstimatorConfig({}))
    let state = definition.init()
    const append = (text: string, surfaceOp: unknown, seq: number): void => {
      state = definition.apply(state, {
        type: 'user/message',
        seq,
        time: 1,
        data: createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: 'user' },
        }),
        surfaceOp,
      } as unknown as SessionEvent)
    }
    append('one', 'append', 1)
    append('two', 'append', 2)
    expect(() => { append('bad', { op: 'replace', startSeq: 5, endSeq: 2 }, 3) })
      .toThrow('invalid current range')
  })

  it('leaves unrelated events inert', async () => {
    const { ctx, session } = await harness()
    session.append('step/start', { turn: 1, step: 1 })
    const before = projected(ctx, session)
    session.append('plan/mode', { active: true })
    session.append('permission/preset', { preset: 'standard' })
    expect(projected(ctx, session)).toEqual(before)
  })

  it('persists a JSON-safe state that its own schema rehydrates', async () => {
    // 0.1.5 rehydrates projection state through `stateSchema.parse(row.val)`, so
    // the fold state must survive a JSON round trip: a Map (the pre-0.1.5 surface
    // store) stringifies to {} and silently loses every surface node.
    const { ctx, session } = await harness()
    session.append('user/message', createUserMessage({
      content: [{ type: 'text', text: 'abcd' }],
      source: { kind: 'user' },
    }), { surfaceOp: 'append' })
    session.append('step/start', { turn: 1, step: 1 })
    session.append('request/header', {
      header: { config: { provider: 'mock', model: 'mock' } },
      reason: 'initial',
    })
    settleWithUsage(session, { inputTokens: 3, outputTokens: 4 })

    const definition = createLiveTokenUsageProjectionDefinition(resolveEstimatorConfig({}))
    // The registry exposes the folded state through its snapshot rows.
    const row = ctx.sessionProjections.snapshot(session)
    const state = definition.init()
    void state
    const serialized = JSON.stringify(row.values)
    expect(serialized).toContain('liveTokenUsage')
    expect(JSON.parse(serialized).liveTokenUsage).toMatchObject({ outputTokens: 4 })
  })
})
