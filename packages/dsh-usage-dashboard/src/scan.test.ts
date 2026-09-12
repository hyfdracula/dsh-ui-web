/**
 * Tests for the all-session scanner (scan.ts): pure fold (token dedupe, steps,
 * model attribution), title naming, watermark-based incremental scan, and the
 * backfill integration that folds subagent/AgentTeams child logs into usage.json.
 * @module @captain1275/dsh-usage-dashboard/scan
 */
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdirSync, rmSync } from 'node:fs'
import { canScan, foldSessionUsage, scanAndBackfill, scanTitle, type PersistenceLike, type ScanEventLike } from './scan.ts'
import { readUsage, runScan } from './index.ts'

const usage = (i: number, o: number, c = 0): { inputTokens: number; outputTokens: number; cacheReadTokens: number } => ({ inputTokens: i, outputTokens: o, cacheReadTokens: c })

type UsageShape = { inputTokens: number; outputTokens: number; cacheReadTokens?: number }

function step(key: string, time?: number): ScanEventLike {
  const [turn, step] = key.split(':').map(Number)
  return { type: 'step/end', time, data: { turn, step } }
}
function chunk(key: string, u: UsageShape, time?: number): ScanEventLike {
  const [turn, step] = key.split(':').map(Number)
  return { type: 'assistant/chunk', time, data: { turn, step, chunk: { type: 'usage', usage: u } } }
}
function message(key: string, u: UsageShape, time?: number): ScanEventLike {
  const [turn, step] = key.split(':').map(Number)
  return { type: 'assistant/message', time, data: { turn, step, usage: u } }
}

describe('foldSessionUsage', () => {
  it('accumulates across steps, counts steps, and takes the model from request/header', () => {
    const events: ScanEventLike[] = [
      { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' } } } },
      step('1:1'), chunk('1:1', usage(100, 10, 50)),
      step('1:2'), chunk('1:2', usage(200, 20)),
      step('1:3'), message('1:3', usage(50, 5)),
    ]
    const out = foldSessionUsage(events)
    expect(out.inputTokens).toBe(350)
    expect(out.outputTokens).toBe(35)
    expect(out.cacheReadTokens).toBe(50)
    expect(out.steps).toBe(3)
    expect(out.model).toBe('deepseek-v4-flash')
  })

  it('a chunk sample replaced by the same-step message usage is not double counted', () => {
    const events: ScanEventLike[] = [
      chunk('1:1', usage(100, 10, 50)),
      message('1:1', usage(100, 10, 50)), // 相同值：替换，不重复计
    ]
    expect(foldSessionUsage(events).inputTokens).toBe(100)
    expect(foldSessionUsage(events).outputTokens).toBe(10)
    const replaced: ScanEventLike[] = [
      chunk('1:1', usage(100, 10, 50)),
      message('1:1', usage(150, 15, 60)), // 更新值：后者胜
    ]
    expect(foldSessionUsage(replaced).inputTokens).toBe(150)
    expect(foldSessionUsage(replaced).outputTokens).toBe(15)
    expect(foldSessionUsage(replaced).cacheReadTokens).toBe(60)
  })

  it('failed/cancelled steps (no usage) still count toward steps', () => {
    const events: ScanEventLike[] = [step('1:1'), step('1:2'), step('2:1')]
    expect(foldSessionUsage(events).steps).toBe(3)
  })

  it('attributes tokens to the event day and to the model in effect at that moment', () => {
    const day1 = new Date('2026-09-11T23:50:00').getTime()
    const day2 = new Date('2026-09-12T00:10:00').getTime()
    const events: ScanEventLike[] = [
      { type: 'request/header', time: day1, data: { header: { config: { model: 'deepseek-flash' } } } },
      step('1:1', day1), chunk('1:1', usage(100, 10, 50), day1),
      { type: 'request/header', time: day2, data: { header: { config: { model: 'deepseek-v4-pro' } } } },
      step('1:2', day2), chunk('1:2', usage(200, 20), day2),
    ]
    const out = foldSessionUsage(events)
    // 历史补录落在事件真正发生的日期，而不是"扫描那一刻"。
    expect(out.days['2026-09-11']?.['deepseek-flash']).toEqual({ inputTokens: 100, outputTokens: 10, cacheReadTokens: 50, cacheWriteTokens: 0, calls: 1 })
    expect(out.days['2026-09-12']?.['deepseek-v4-pro']).toEqual({ inputTokens: 200, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 1 })
    expect(out.model).toBe('deepseek-v4-pro')
    // 归属合计与会话合计恒等。
    const sum = Object.values(out.days).flatMap((m) => Object.values(m)).reduce(
      (acc, b) => ({ i: acc.i + b.inputTokens, o: acc.o + b.outputTokens, c: acc.c + b.cacheReadTokens, calls: acc.calls + b.calls }),
      { i: 0, o: 0, c: 0, calls: 0 },
    )
    expect(sum).toEqual({ i: out.inputTokens, o: out.outputTokens, c: out.cacheReadTokens, calls: out.steps })
  })

  it('takes the model from each assistant message source (v3 logs barely have request/header)', () => {
    const day = new Date('2026-09-12T10:00:00').getTime()
    const events: ScanEventLike[] = [
      {
        type: 'assistant/message',
        time: day,
        data: { turn: 1, step: 1, usage: usage(100, 10), message: { source: { provider: 'deepseek-official', model: 'deepseek-flash' } } },
      },
      step('1:1', day),
      {
        type: 'assistant/message',
        time: day,
        data: { turn: 1, step: 2, usage: usage(200, 20), message: { source: { model: 'glm-5.3' } } },
      },
      step('1:2', day),
    ]
    const out = foldSessionUsage(events)
    // 一个会话跨模型：每步的用量归到该步真正用的模型上（旧实现只认
    // request/header，整段会落成 unknown 或过期的旧模型）。
    expect(out.days['2026-09-12']?.['deepseek-flash']).toEqual({ inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 1 })
    expect(out.days['2026-09-12']?.['glm-5.3']).toEqual({ inputTokens: 200, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 1 })
    expect(out.model).toBe('glm-5.3')
    expect(out.inputTokens).toBe(300)
  })

  it('falls back to the caller timestamp when events carry no time', () => {
    const fallback = new Date('2026-09-12T08:00:00').getTime()
    const out = foldSessionUsage([step('1:1'), chunk('1:1', usage(10, 1))], fallback)
    expect(Object.keys(out.days)).toEqual(['2026-09-12'])
    expect(out.days['2026-09-12']?.unknown?.calls).toBe(1)
  })
})

describe('scanTitle', () => {
  it('marks subagent children and leaves roots as plain sessions', () => {
    expect(scanTitle({ id: 'session-abcdef0123456789', origin: 'subagent' })).toBe('子会话 session-')
    expect(scanTitle({ id: 'session-abcdef0123456789', delegationDepth: 1 })).toBe('子会话 session-')
    expect(scanTitle({ id: 'session-abcdef0123456789' })).toBe('会话 session-')
    expect(scanTitle({ id: '43399b3a-3481-446b-be05-81ff0ad820b6', origin: 'subagent' })).toBe('子会话 43399b3a')
  })
})

describe('scanAndBackfill (watermark incremental)', () => {
  const fakePersistence = (logs: Record<string, ScanEventLike[]>): PersistenceLike => ({
    // 0.1.5 API：list() + open(id,'read') + handle.read() + close()
    list: async () =>
      Object.entries(logs).map(([id, events], idx) => ({
        header: { id, origin: id.includes('child') ? 'subagent' : undefined, delegationDepth: id.includes('child') ? 1 : undefined, parentSession: id.includes('child') ? 'parent' : undefined },
        revision: `rev-${idx}:${events.length}`,
      })),
    open: async (id) => ({
      read: async () => ({ events: logs[id] ?? [] }),
      close: async () => {},
    }),
  })

  it('cold start backfills every session; unchanged revisions are skipped on the next pass', async () => {
    const persistence = fakePersistence({
      parent: [step('1:1'), chunk('1:1', usage(100, 10)), step('1:2'), chunk('1:2', usage(200, 20))],
      child: [step('1:1'), chunk('1:1', usage(50, 5)), step('1:2')], // 其中一个失败 step 无用量
    })
    const first = await scanAndBackfill(persistence, {})
    expect(first.outcomes).toHaveLength(2)
    expect(first.outcomes.find(o => o.sessionId === 'parent')?.inputTokens).toBe(300)
    expect(first.outcomes.find(o => o.sessionId === 'child')?.steps).toBe(2)
    expect(first.outcomes.find(o => o.sessionId === 'child')?.isSubagent).toBe(true)
    // 同 revision 再来一次：无输出。
    const second = await scanAndBackfill(persistence, first.revisions)
    expect(second.outcomes).toHaveLength(0)
  })

  it('still reads the legacy 0.1.1 interface (listSnapshots + readFrom)', async () => {
    const legacy: PersistenceLike = {
      listSnapshots: async () => [{ header: { id: 'old' }, revision: 'r1' }],
      readFrom: async () => ({ events: [step('1:1'), chunk('1:1', usage(7, 3))] }),
    }
    expect(canScan(legacy)).toBe(true)
    const res = await scanAndBackfill(legacy, {})
    expect(res.outcomes).toHaveLength(1)
    expect(res.outcomes[0]?.inputTokens).toBe(7)
  })

  it('flags an unusable service instead of silently no-oping', async () => {
    // 形状不认识（宿主换了 API 名字）：canScan 必须为 false，宿主据此告警，
    // 否则扫描会静默空转、水位被写成空表而看板毫无提示。
    const weird = { whatever: async () => [] } as unknown as PersistenceLike
    expect(canScan(weird)).toBe(false)
    expect(canScan(undefined)).toBe(false)
    const res = await scanAndBackfill(weird, {})
    expect(res.outcomes).toHaveLength(0)
    expect(res.total).toBe(0)
  })
})

describe('runScan integration (backfill into usage.json)', () => {
  const freshHome = (): string => {
    const home = join(tmpdir(), `usage-scan-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(home, { recursive: true })
    return home
  }

  it('folds child sessions into bySession/byModel/total and stays idempotent', async () => {
    const home = freshHome()
    process.env.DSH_HOME = home
    try {
      const logs = {
        parent: [
          { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' } } } } as ScanEventLike,
          step('1:1'), chunk('1:1', usage(100, 10)),
        ],
        child: [
          { type: 'request/header', data: { header: { config: { provider: 'deepseek', model: 'deepseek-v4-flash' } } } } as ScanEventLike,
          step('1:1'), chunk('1:1', usage(400, 40)),
        ],
      }
      const persistence: PersistenceLike = {
        // 0.1.5 API（宿主实际注入的形状）
        list: async () => Object.keys(logs).map((id, idx) => ({
          header: { id, origin: id === 'child' ? 'subagent' : undefined, delegationDepth: id === 'child' ? 1 : undefined, parentSession: id === 'child' ? 'parent' : undefined },
          revision: `v${idx}`,
        })),
        open: async (id) => ({
          read: async () => ({ events: logs[id] ?? [] }),
          close: async () => {},
        }),
      }
      const scanned = await runScan(persistence)
      expect(scanned).toBe(2)
      const store = readUsage()
      expect(store.bySession['parent']?.inputTokens).toBe(100)
      expect(store.bySession['child']?.inputTokens).toBe(400)
      expect(store.bySession['child']?.calls).toBe(1)
      expect(store.total.inputTokens).toBe(500)
      expect(store.total.calls).toBe(2)
      expect(store.byModel['deepseek-v4-flash']?.inputTokens).toBe(500)
      // 等量重扫不双计。
      const again = await runScan(persistence)
      expect(again).toBe(0)
      expect(readUsage().total.inputTokens).toBe(500)
    } finally {
      delete process.env.DSH_HOME
      rmSync(home, { recursive: true, force: true })
    }
  })
})
