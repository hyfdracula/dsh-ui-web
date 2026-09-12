/**
 * dsh-file-limits-projection 单测：注册逻辑（成功/跳过）+ schema 校验。
 */
import { describe, expect, it, vi } from 'vitest'
import { registerFileLimitsProjection, fileLimitsProjectionSchema } from '../src/index.ts'
import type { FileAttachmentLimits } from '../src/index.ts'

const limits: FileAttachmentLimits = {
  maxFileBytes: Number.MAX_SAFE_INTEGER,
  maxFilesPerMessage: Number.MAX_SAFE_INTEGER,
  maxMessageFileBytes: Number.MAX_SAFE_INTEGER,
}

describe('registerFileLimitsProjection', () => {
  it('registers the unit when the store supports generic files', () => {
    const register = vi.fn()
    const ok = registerFileLimitsProjection({
      sessionProjections: { register } as never,
      attachments: { fileLimits: limits },
    })
    expect(ok).toBe(true)
    expect(register).toHaveBeenCalledTimes(1)
    const [definition] = register.mock.calls[0] as [{ key: string; schema: unknown; init(): null; view(): unknown; stateVersion: number }]
    expect(definition.key).toBe('fileLimits')
    expect(definition.stateVersion).toBe(1)
    expect(definition.init()).toBeNull()
    expect(definition.view()).toBe(limits)
  })

  it('skips registration when the store does not support generic files', () => {
    const register = vi.fn()
    const throwingStore = {
      get fileLimits(): FileAttachmentLimits {
        throw new Error('This attachment store does not support generic files.')
      },
    }
    const ok = registerFileLimitsProjection({
      sessionProjections: { register } as never,
      attachments: throwingStore,
    })
    expect(ok).toBe(false)
    expect(register).not.toHaveBeenCalled()
  })

  it('schema accepts the wire shape', () => {
    const parsed = fileLimitsProjectionSchema.parse(limits)
    expect(parsed.maxFileBytes).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('schema rejects non-positive values', () => {
    expect(() => fileLimitsProjectionSchema.parse({
      maxFileBytes: 0,
      maxFilesPerMessage: 1,
      maxMessageFileBytes: 1,
    })).toThrow()
  })
})
