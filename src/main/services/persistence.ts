import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Atomic write: serializes to a temp file in the same directory, then renames
 * over the target. A crash never leaves a truncated or half-written canonical
 * document (Spec REQ-003 / AC-005).
 */
export async function atomicWriteJson(file: string, value: unknown): Promise<void> {
  const payload = JSON.stringify(value, null, 2)
  const dir = file.substring(0, file.lastIndexOf('/') >= 0 ? file.lastIndexOf('/') : file.lastIndexOf('\\'))
  const tmp = join(dir || tmpdir(), `.${randomUUID()}.tmp`)
  await fs.writeFile(tmp, payload, 'utf-8')
  await fs.rename(tmp, file)
}

/**
 * Constrained merge: only the fields listed in `permit` are carried from
 * `patch` onto `base`. Unknown/forbidden fields are dropped (Spec REQ-003).
 */
export function mergeKnownFields<T extends object>(
  base: T,
  patch: Record<string, unknown>,
  permit: ReadonlyArray<keyof T>
): T {
  const out: T = { ...base }
  for (const key of permit) {
    if (key in patch) {
      ;(out as Record<string, unknown>)[key as string] = patch[key as string]
    }
  }
  return out
}
