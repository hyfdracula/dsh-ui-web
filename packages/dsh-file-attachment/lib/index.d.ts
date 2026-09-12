import type { AttachmentId } from '@deepseek-ai/dsh-attachment'

/** Sentinel for "no limit": matches the DSH fork's UNLIMITED_ATTACHMENT. */
export declare const UNLIMITED_ATTACHMENT: number

/** Default file limits: unlimited by default (mirrors the fork's defaults). */
export declare const DEFAULT_FILE_LIMITS: FileAttachmentLimits

/**
 * Synchronous admission policy for one generic file (no storage touch).
 * @param input - encoded bytes and declared metadata.
 * @param limits - resolved storage policy.
 */
export declare function validateFileSync(input: SaveFileAttachment, limits: FileAttachmentLimits): void

export interface FileAttachmentRef {
  attachmentId: AttachmentId
  mediaType: string
  bytes: number
  name?: string
}

export interface FileAttachmentLimits {
  maxFileBytes: number
  maxFilesPerMessage: number
  maxMessageFileBytes: number
}

export interface SaveFileAttachment {
  data: Uint8Array
  mediaType: string
  name?: string
}

export interface StoredFileAttachment {
  ref: FileAttachmentRef
  data: Uint8Array
}

/**
 * Durable generic-file attachment store: content-addressed sha256 objects
 * below `DSH_HOME/attachments/v1`, with integrity verification on read.
 */
export declare class FileAttachmentStore {
  readonly root: string
  readonly fileLimits: FileAttachmentLimits
  constructor(root: string, limits?: FileAttachmentLimits)
  validateFile(input: SaveFileAttachment): Promise<void>
  saveFile(input: SaveFileAttachment): Promise<FileAttachmentRef>
  readFile(ref: FileAttachmentRef, signal?: AbortSignal): Promise<StoredFileAttachment>
  static atDshHome(dshHome: string, limits?: FileAttachmentLimits): FileAttachmentStore
}
