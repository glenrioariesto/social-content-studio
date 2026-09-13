import { resolve, isAbsolute, normalize, sep, relative } from 'path'
import { createAppError } from '@shared/errors'

/**
 * Confinement Guard. Resolves a candidate path against the Workspace Root and
 * refuses anything that escapes it.
 *
 * Windows-safe:
 * - path comparison is case-insensitive (drive letter + directory names);
 * - '..' segments are handled purely lexically after resolve(), so a crafted
 *   path like `..\..\Windows\system32` cannot escape the root;
 * - another drive's absolute path (`C:\Elsewhere`) is a hard refusal.
 *
 * Symlinks inside the workspace pointing outward are intentionally out of scope
 * until symlinks are ever introduced (Spec §1.2).
 */
export interface ConfinedPath {
  readonly absolute: string
}

function caseInsensitiveEqual(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

export function assertInsideWorkspace(
  root: string,
  candidate: string,
  channel: string
): ConfinedPath {
  const absRoot = resolve(root)
  const absCandidate = resolve(candidate)

  // A candidate on a different drive can never be under the root.
  if (isAbsolute(absCandidate) && !caseInsensitiveEqual(absCandidate[0], absRoot[0])) {
    throw createAppError(
      'FS_PERMISSION_DENIED',
      `Path is outside the workspace root: ${candidate}`,
      'ipc',
      { channel, requested: candidate }
    )
  }

  // Relative portion of the candidate against the root; if it escapes upward
  // (starts with '..'), it is outside the workspace.
  const rel = relative(absRoot, absCandidate)
  if (rel.startsWith('..')) {
    throw createAppError(
      'FS_PERMISSION_DENIED',
      `Path escapes the workspace root: ${candidate}`,
      'ipc',
      { channel, requested: candidate }
    )
  }

  // Case-insensitive containment check: candidate must live strictly under
  // root. The root itself, or any path not under it, is refused (deleting the
  // root, or operating on the boundary, is not allowed).
  if (caseInsensitiveEqual(absCandidate, absRoot)) {
    throw createAppError(
      'FS_PERMISSION_DENIED',
      'Operation on the workspace root itself is not allowed',
      'ipc',
      { channel, requested: candidate }
    )
  }
  const rootPrefix = absRoot.endsWith(sep) ? absRoot : absRoot + sep
  if (!absCandidate.toLowerCase().startsWith(rootPrefix.toLowerCase())) {
    throw createAppError(
      'FS_PERMISSION_DENIED',
      `Path is outside the workspace root: ${candidate}`,
      'ipc',
      { channel, requested: candidate }
    )
  }

  return { absolute: absCandidate }
}
