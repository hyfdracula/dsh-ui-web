/**
 * Tests for dsh-open-path: path normalization (drive-letter, UNC, quoted,
 * relative/garbage rejection, existence checks).
 * @module @captain1275/dsh-open-path
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { normalizeOpenTarget, openWithExplorer } from './index.ts'

describe('normalizeOpenTarget', () => {
  it('accepts drive-letter absolute paths (backslash and forward slash)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'open-path-'))
    try {
      expect(normalizeOpenTarget(dir)).toBe(dir)
      expect(normalizeOpenTarget(dir.replaceAll('\\', '/'))).toBe(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('accepts quoted paths (复制为路径 style)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'open-path-q-'))
    try {
      expect(normalizeOpenTarget(`"${dir}"`)).toBe(dir)
      expect(normalizeOpenTarget(`'${dir}'`)).toBe(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('accepts path to an existing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'open-path-f-'))
    try {
      const file = join(dir, 'x.txt')
      writeFileSync(file, 'hi')
      expect(normalizeOpenTarget(file)).toBe(file)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('rejects relative paths, garbage, null bytes, and missing targets', () => {
    expect(normalizeOpenTarget('folder\\x')).toBeUndefined()
    expect(normalizeOpenTarget('C:\\no\\such\\path\\xyz')).toBeUndefined()
    expect(normalizeOpenTarget('not a path')).toBeUndefined()
    expect(normalizeOpenTarget('C:\\a\0b')).toBeUndefined()
    expect(normalizeOpenTarget('')).toBeUndefined()
    expect(normalizeOpenTarget(undefined)).toBeUndefined()
    expect(normalizeOpenTarget(42)).toBeUndefined()
    expect(normalizeOpenTarget('\t  ')).toBeUndefined()
  })

  it('opens an existing path via explorer (does not throw)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'open-path-o-'))
    try {
      expect(() => openWithExplorer(dir)).not.toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})