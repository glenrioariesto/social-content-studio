import { existsSync } from 'fs'
import { join } from 'path'
import { createAppError } from '../../../packages/shared/src/errors'

const MAX_ID_ATTEMPTS = 5

function hex(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) {
    s += Math.floor(Math.random() * 16).toString(16)
  }
  return s
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Compact local timestamp, e.g. "20260824T103912". */
function localTimestamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

/**
 * Durable, unique content identifier. Format: `content-<YYYYMMDDTHHMMSS>-<5hex>`.
 * Uniqueness does not depend on the directory count (fixes the overwrite risk
 * of the old count-based scheme). The caller loops with a fresh random suffix
 * until the target directory does not already exist.
 */
export function generateContentId(now: Date = new Date()): string {
  return `content-${localTimestamp(now)}-${hex(5)}`
}

/**
 * Generates an id guaranteed not to collide with an existing folder under
 * `contentsDir`. Caps retries at MAX_ID_ATTEMPTS; on exhaustion throws
 * FS_ALREADY_EXISTS.
 */
export function generateUniqueContentId(contentsDir: string, now: Date = new Date()): string {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
    const id = generateContentId(now)
    if (!existsSync(join(contentsDir, id))) return id
  }
  throw createAppError(
    'FS_ALREADY_EXISTS',
    'Could not generate a unique content id after maximum attempts',
    'main',
    { contentsDir }
  )
}
