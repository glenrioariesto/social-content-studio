/** Minimal structural view of an AdmZip entry needed for zip-slip validation. */
export interface ZipEntryLike {
  readonly entryName: string
  readonly isDirectory: boolean
  /** MS-DOS / unix packed attribute value (upper 16 bits hold the unix mode). */
  readonly attr: number
}

const DRIVE_RE = /^[A-Za-z]:/i

/**
 * Returns the list of unsafe entry names in `entries`:
 * empty names, absolute paths, drive-volume paths, `..` segments, and unix
 * symlink entries. A non-empty result means extraction must be refused so a
 * crafted archive cannot write outside the workspace (zip-slip, SEC-002).
 */
export function validateZipEntries(entries: readonly ZipEntryLike[]): string[] {
  const offenders: string[] = []
  for (const entry of entries) {
    const name = entry.entryName
    if (name.length === 0) {
      offenders.push('<empty>')
      continue
    }
    const normalized = name.replace(/\\/g, '/')
    if (DRIVE_RE.test(normalized) || normalized.startsWith('/')) {
      offenders.push(name)
      continue
    }
    const segments = normalized.split('/')
    if (segments.includes('..')) {
      offenders.push(name)
      continue
    }
    const mode = (entry.attr >>> 16) & 0xf000
    if (mode === 0xa000) {
      offenders.push(name)
      continue
    }
  }
  return offenders
}