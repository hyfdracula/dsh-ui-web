/**
 * dsh-file-attachment: generic-file attachment storage provider.
 *
 * Provides the file face of the DSH attachment seam (`fileLimits`,
 * `validateFile`, `saveFile`, `readFile`) as an independent host package,
 * content-addressed under `DSH_HOME/attachments/v1` (identical storage
 * semantics to the DSH fork's `attachment-local` file-store).
 *
 * Integration note (方案A): the DSH fork source patches (030/070) remain in
 * place; this package is a standalone, testable provider library. To have the
 * host use it, compose it where the attachment service is built (e.g. inject
 * the store into `ctx.attachments`, or have the fork's attachment-local
 * delegate its file face here). See README.md.
 * @module @captain1275/dsh-file-attachment
 */

import { Context } from '@deepseek-ai/cordis'
import { AttachmentError } from '@deepseek-ai/dsh-attachment'
import type { FileAttachmentLimits, FileAttachmentRef, SaveFileAttachment, StoredFileAttachment } from './types.ts'
import { readFile as readObject, saveFile as persistFile, validateFile as admitFile } from './file-store.ts'

/** Sentinel for "no limit": matches the DSH fork's UNLIMITED_ATTACHMENT. */
export const UNLIMITED_ATTACHMENT = Number.MAX_SAFE_INTEGER

/** Default file limits: unlimited by default (mirrors the fork's defaults). */
export const DEFAULT_FILE_LIMITS: FileAttachmentLimits = Object.freeze({
  maxFileBytes: UNLIMITED_ATTACHMENT,
  maxFilesPerMessage: UNLIMITED_ATTACHMENT,
  maxMessageFileBytes: UNLIMITED_ATTACHMENT,
})

export type { FileAttachmentLimits, FileAttachmentRef, SaveFileAttachment, StoredFileAttachment } from './types.ts'

/**
 * Synchronous admission policy for one generic file (no storage touch).
 * The async store method awaits this; exposed separately so a thin delegating
 * layer can preserve synchronous throw semantics.
 * @param input - encoded bytes and declared metadata.
 * @param limits - resolved storage policy.
 */
export function validateFileSync(input: SaveFileAttachment, limits: FileAttachmentLimits): void {
  admitFile(input, limits)
}

/**
 * Durable generic-file attachment store: content-addressed sha256 objects
 * below `DSH_HOME/attachments/v1`, with integrity verification on read.
 * This is the file-only face of the DSH attachment seam; a deployment may use
 * it standalone or compose it beside an image store.
 */
export class FileAttachmentStore {
  /** Absolute storage root (versioned). */
  readonly root: string
  /** Deployment-resolved file policy (unlimited by default). */
  readonly fileLimits: FileAttachmentLimits

  /**
   * @param root - absolute `DSH_HOME/attachments/v1` root.
   * @param limits - resolved file policy; defaults to unlimited.
   */
  constructor(root: string, limits: FileAttachmentLimits = DEFAULT_FILE_LIMITS) {
    this.root = root
    this.fileLimits = Object.freeze({ ...limits })
  }

  /** Run the admission policy for one generic file without touching storage. */
  async validateFile(input: SaveFileAttachment): Promise<void> {
    admitFile(input, this.fileLimits)
  }

  /** Validate and durably commit one generic file; returns a content-addressed reference. */
  async saveFile(input: SaveFileAttachment): Promise<FileAttachmentRef> {
    return persistFile(this.root, input, this.fileLimits)
  }

  /** Read and verify one content-addressed generic file. */
  async readFile(ref: FileAttachmentRef, signal?: AbortSignal): Promise<StoredFileAttachment> {
    return readObject(this.root, ref, signal)
  }

  /** Convenience factory: build a store rooted at `${dshHome}/attachments/v1`. */
  static atDshHome(dshHome: string, limits?: FileAttachmentLimits): FileAttachmentStore {
    return new FileAttachmentStore(
      `${dshHome.replace(/[\\/]+$/, '')}/attachments/v1`,
      limits,
    )
  }
}

export { AttachmentError }
export type { Context }
