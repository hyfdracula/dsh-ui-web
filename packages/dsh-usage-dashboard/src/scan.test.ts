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
import { foldSessionUsage, scanAndBackfill, scanTitle, type PersistenceLike, type ScanEventLike } from './scan.ts'
import { readUsage, runScan } from './index.ts'

const usage = (i: number, o: number, c = 0): { inputTokens: number; outputTokens: number; cacheReadTokens: number } => ({ inputTokens: i, outputTokens: o, cacheReadTokens: c })

type UsageShape = { inputTokens: number; outputTokens: number; cacheReadTokens?: number }

function step(key: string): ScanEventLike {
  const [turn, step] = key.split(':').map(Number)
  return { type: 'step/end', data: { turn, step } }
}
function chunk(key: string, u: UsageShape): ScanEventLike {
  const [turn, step] = key.split(':').map(Number)
  return { type: 'assistant/chunk', data: { turn, step, chunk: { type: 'usage', usage: u } } }
}
function message(key: string, u: UsageShape): ScanEventLike {
  const [turn, step] = key.split(':').map(Number)
  return { type: 'assistant/message', data: { turn, step, usage: u } }
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
    listSnapshots: async () =>
      Object.entries(logs).map(([id, events], idx) => ({
        header: { id, origin: id.includes('child') ? 'subagent' : undefined, delegationDepth: id.includes('child') ? 1 : undefined, parentSession: id.includes('child') ? 'parent' : undefined },
        revision: `rev-${idx}:${events.length}`,
      })),
    readFrom: async (id) => ({ events: logs[id] ?? [] }),
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
        listSnapshots: async () => Object.keys(logs).map((id, idx) => ({
          header: { id, origin: id === 'child' ? 'subagent' : undefined, delegationDepth: id === 'child' ? 1 : undefined, parentSession: id === 'child' ? 'parent' : undefined },
          revision: `v${idx}`,
        })),
        readFrom: async (id) => ({ events: logs[id] ?? [] }),
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
