/**
 * Shared content-addressing and durable-directory helpers for the file
 * attachment provider (migrated from DSH fork `attachment-local/src/store.ts`,
 * image-free subset).
 * @module @captain1275/dsh-file-attachment/store
 */

import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { chmod, mkdir, open } from 'node:fs/promises'
import { dirname, join, parse, resolve } from 'node:path'
import { AttachmentError } from '@deepseek-ai/dsh-attachment'

const ID_PATTERN = /^sha256:([a-f0-9]{64})$/
const durableHomes = new Set<string>()

export function digest(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

export function displayName(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  // Strip both separator styles by hand: a POSIX host treats `\` as an
  // ordinary character, so path.basename would keep a Windows client's full
  // local path and leak it into the reference and the session log.
  const leaf = value.slice(Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\')) + 1)
  const clean = leaf.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 255)
  return clean === '' ? undefined : clean
}

export function objectPath(root: string, sha256: string): string {
  return join(root, 'objects', sha256.slice(0, 2), sha256)
}

export function ensureReference(ref: { attachmentId: unknown }): string {
  const match = ID_PATTERN.exec(String(ref.attachmentId))
  if (match?.[1] === undefined) throw new AttachmentError('Attachment reference is invalid.', 'INVALID_ATTACHMENT_REF')
  return match[1]
}

async function syncDirectory(path: string): Promise<void> {
  /* v8 ignore next -- Windows cannot open directory handles; NTFS metadata journaling owns entry durability there. */
  if (process.platform === 'win32') return
  const handle = await open(path, constants.O_RDONLY)
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

/**
 * Create one private directory tree and persist every ancestor entry up to a
 * caller-vouched durable boundary.
 */
export async function ensureDurableDirectory(path: string, boundary: string): Promise<void> {
  const target = resolve(path)
  const stop = resolve(boundary)
  await mkdir(target, { recursive: true, mode: 0o700 })
  await chmod(target, 0o700)
  let level = target
  while (level !== stop) {
    const parent = dirname(level)
    await syncDirectory(parent)
    /* v8 ignore next -- filesystem-root guard */
    if (parent === level) return
    level = parent
  }
}

/** Establish this process's proof that one DSH_HOME entry and every ancestor are durable. */
export async function ensureDurableHome(path: string): Promise<string> {
  const home = resolve(path)
  if (!durableHomes.has(home)) {
    await ensureDurableDirectory(home, parse(home).root)
    durableHomes.add(home)
  }
  return home
}
