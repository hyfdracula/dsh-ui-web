/**
 * Content-addressed, owner-private local storage for generic file attachments.
 * Migrated from DSH fork `attachment-local/src/file-store.ts` (identical
 * logic); the File types are re-declared here so this package builds against
 * the released `@deepseek-ai/dsh-attachment` (which predates the fork's file
 * face) while staying wire-compatible with the fork at runtime.
 * @module @captain1275/dsh-file-attachment/file-store
 */

import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { link, open, readFile as fsReadFile, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { AttachmentError, AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { FileAttachmentLimits, FileAttachmentRef, SaveFileAttachment, StoredFileAttachment } from './types.ts'
import {
  digest, displayName, ensureDurableDirectory, ensureDurableHome, ensureReference, objectPath,
} from './store.ts'

/**
 * Run the admission policy for one generic file without touching storage.
 * @param input - encoded bytes and declared metadata.
 * @param limits - resolved storage policy.
 */
export function validateFile(input: SaveFileAttachment, limits: FileAttachmentLimits): void {
  if (input.data.byteLength === 0) {
    throw new AttachmentError('File is empty.', 'INVALID_FILE')
  }
  if (input.data.byteLength > limits.maxFileBytes) {
    throw new AttachmentError('File exceeds the configured byte limit.', 'FILE_TOO_LARGE')
  }
}

/**
 * Save and verify immutable file bytes below a versioned attachment root.
 * @param root - absolute `DSH_HOME/attachments/v1` root.
 * @param input - encoded bytes and declared metadata.
 * @param limits - resolved storage policy.
 * @returns durable content-addressed reference.
 */
export async function saveFile(root: string, input: SaveFileAttachment, limits: FileAttachmentLimits): Promise<FileAttachmentRef> {
  if (input.data.byteLength === 0) throw new AttachmentError('File is empty.', 'INVALID_FILE')
  if (input.data.byteLength > limits.maxFileBytes) throw new AttachmentError('File exceeds the configured byte limit.', 'FILE_TOO_LARGE')
  const sha256 = digest(input.data)
  const bucket = join(root, 'objects', sha256.slice(0, 2))
  const staging = join(root, 'tmp')
  const boundary = await ensureDurableHome(dirname(dirname(resolve(root))))
  await ensureDurableDirectory(bucket, boundary)
  await ensureDurableDirectory(staging, boundary)
  const temporary = join(staging, randomUUID())
  const target = objectPath(root, sha256)
  let handle
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
    await handle.writeFile(input.data)
    await handle.sync()
    await handle.close()
    handle = undefined
    try {
      await link(temporary, target)
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error
      const existing = new Uint8Array(await fsReadFile(target))
      if (digest(existing) !== sha256) throw new AttachmentError('Stored attachment failed integrity verification.', 'ATTACHMENT_CORRUPT')
    }
    await syncDirectory(bucket)
    await syncDirectory(join(root, 'objects'))
    await unlink(temporary)
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => {})
    await unlink(temporary).catch((cleanupError: unknown) => {
      if (!(cleanupError instanceof Error && 'code' in cleanupError && cleanupError.code === 'ENOENT')) throw cleanupError
    })
    if (error instanceof AttachmentError) throw error
    throw new AttachmentError('Unable to persist file attachment.', 'ATTACHMENT_WRITE_FAILED', { cause: error })
  }
  const name = displayName(input.name)
  return {
    attachmentId: AttachmentId(`sha256:${sha256}`),
    mediaType: input.mediaType,
    bytes: input.data.byteLength,
    ...(name !== undefined ? { name } : {}),
  }
}

/**
 * Read and verify one content-addressed generic file.
 * @param root - absolute `DSH_HOME/attachments/v1` root.
 * @param ref - reference recorded in the session log.
 * @param signal - optional cancellation for filesystem and verification work.
 * @returns verified bytes and reference.
 */
export async function readFile(
  root: string,
  ref: FileAttachmentRef,
  signal?: AbortSignal,
): Promise<StoredFileAttachment> {
  signal?.throwIfAborted()
  const sha256 = ensureReference(ref)
  let data: Uint8Array
  try {
    data = new Uint8Array(await fsReadFile(objectPath(root, sha256), { signal }))
  } catch (error) {
    signal?.throwIfAborted()
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new AttachmentError('Attachment object is missing.', 'ATTACHMENT_NOT_FOUND')
    }
    throw new AttachmentError('Unable to read file attachment.', 'ATTACHMENT_READ_FAILED', { cause: error })
  }
  signal?.throwIfAborted()
  if (digest(data) !== sha256) throw new AttachmentError('Stored attachment failed integrity verification.', 'ATTACHMENT_CORRUPT')
  if (data.byteLength !== ref.bytes) {
    throw new AttachmentError('Stored attachment metadata does not match its reference.', 'ATTACHMENT_CORRUPT')
  }
  return { ref, data }
}

async function syncDirectory(path: string): Promise<void> {
  if (process.platform === 'win32') return
  const handle = await open(path, constants.O_RDONLY)
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}
