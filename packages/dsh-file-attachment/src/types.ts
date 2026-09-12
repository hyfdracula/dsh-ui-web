/**
 * File-attachment wire types, re-declared to match the DSH fork's file face
 * (`@deepseek-ai/dsh-attachment` FileAttachment* types). The released rc.6
 * attachment package predates the fork, so this package carries its own
 * declarations and stays structurally compatible at runtime.
 * @module @captain1275/dsh-file-attachment/types
 */

/** Opaque storage identifier; never a filesystem path or bearer URL. */
export interface FileAttachmentRef {
  attachmentId: string
  /** Caller-declared media type; generic files are not re-validated beyond size. */
  mediaType: string
  /** Exact encoded byte length. */
  bytes: number
  /** Optional display name stripped of local path information. */
  name?: string
}

/** Deployment-resolved generic-file policy. */
export interface FileAttachmentLimits {
  maxFileBytes: number
  maxFilesPerMessage: number
  maxMessageFileBytes: number
}

/** Base64-decoded generic file upload accompanying one wire request. */
export interface SaveFileAttachment {
  data: Uint8Array
  /** Caller-declared media type; generic files are not re-validated beyond size. */
  mediaType: string
  /** Optional browser/provider display name; it is never interpreted as a path. */
  name?: string
}

/** Stored file bytes returned after reference and digest verification. */
export interface StoredFileAttachment {
  ref: FileAttachmentRef
  data: Uint8Array
}
