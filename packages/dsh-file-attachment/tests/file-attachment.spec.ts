/**
 * dsh-file-attachment 存储 provider 单测：validate/save/read/完整性/去重/名字净化。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile as fsRead, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FileAttachmentStore, UNLIMITED_ATTACHMENT } from '../src/index.ts'
import { AttachmentError } from '@deepseek-ai/dsh-attachment'

let root: string
let store: FileAttachmentStore

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dsh-file-attachment-'))
  store = FileAttachmentStore.atDshHome(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const sample = (text = 'hello file attachment', mediaType = 'text/plain'): { data: Uint8Array; mediaType: string; name?: string } => ({
  data: new TextEncoder().encode(text),
  mediaType,
  name: 'hello.txt',
})

describe('validateFile', () => {
  it('accepts a non-empty file within limits', async () => {
    await expect(store.validateFile(sample())).resolves.toBeUndefined()
  })

  it('rejects an empty file', async () => {
    await expect(store.validateFile({ data: new Uint8Array(0), mediaType: 'text/plain' }))
      .rejects.toThrowError(AttachmentError)
  })

  it('rejects a file above maxFileBytes when a finite limit is set', async () => {
    const limited = new FileAttachmentStore(root, {
      maxFileBytes: 4,
      maxFilesPerMessage: UNLIMITED_ATTACHMENT,
      maxMessageFileBytes: UNLIMITED_ATTACHMENT,
    })
    await expect(limited.validateFile(sample('longer than four')))
      .rejects.toThrowError(AttachmentError)
  })
})

describe('saveFile / readFile', () => {
  it('round-trips a file', async () => {
    const ref = await store.saveFile(sample())
    expect(ref.attachmentId).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(ref.mediaType).toBe('text/plain')
    expect(ref.bytes).toBe(new TextEncoder().encode('hello file attachment').byteLength)
    const stored = await store.readFile(ref)
    expect(new TextDecoder().decode(stored.data)).toBe('hello file attachment')
    expect(stored.ref.attachmentId).toBe(ref.attachmentId)
  })

  it('deduplicates identical bytes to one object', async () => {
    const a = await store.saveFile(sample())
    const b = await store.saveFile(sample())
    expect(a.attachmentId).toBe(b.attachmentId)
    // content-addressed: same digest, one object file
    const objects = await fsRead(join(root, 'attachments', 'v1', 'objects', a.attachmentId.slice(7, 9), a.attachmentId.slice(7)))
    expect(objects.byteLength).toBe(new TextEncoder().encode('hello file attachment').byteLength)
  })

  it('strips path info from display names', async () => {
    const ref = await store.saveFile({ ...sample(), name: 'C:\\Users\\x\\Desktop\\报告.txt' })
    expect(ref.name).toBe('报告.txt')
  })

  it('detects corruption on read', async () => {
    const ref = await store.saveFile(sample())
    const objPath = join(root, 'attachments', 'v1', 'objects', ref.attachmentId.slice(7, 9), ref.attachmentId.slice(7))
    await writeFile(objPath, Buffer.from('tampered bytes!'))
    await expect(store.readFile(ref)).rejects.toThrowError(AttachmentError)
  })

  it('throws ATTACHMENT_NOT_FOUND for a missing object', async () => {
    const ref = await store.saveFile(sample())
    const objPath = join(root, 'attachments', 'v1', 'objects', ref.attachmentId.slice(7, 9), ref.attachmentId.slice(7))
    await rm(objPath)
    await expect(store.readFile(ref)).rejects.toThrowError(AttachmentError)
  })

  it('rejects a mismatched byte count reference', async () => {
    const ref = await store.saveFile(sample())
    await expect(store.readFile({ ...ref, bytes: ref.bytes + 1 })).rejects.toThrowError(AttachmentError)
  })
})

describe('fileLimits', () => {
  it('defaults to unlimited', () => {
    expect(store.fileLimits.maxFileBytes).toBe(UNLIMITED_ATTACHMENT)
    expect(store.fileLimits.maxFilesPerMessage).toBe(UNLIMITED_ATTACHMENT)
    expect(store.fileLimits.maxMessageFileBytes).toBe(UNLIMITED_ATTACHMENT)
  })

  it('honors explicit finite limits', () => {
    const limited = new FileAttachmentStore(root, {
      maxFileBytes: 10,
      maxFilesPerMessage: 2,
      maxMessageFileBytes: 100,
    })
    expect(limited.fileLimits.maxFileBytes).toBe(10)
    expect(limited.fileLimits.maxFilesPerMessage).toBe(2)
    expect(limited.fileLimits.maxMessageFileBytes).toBe(100)
  })
})
