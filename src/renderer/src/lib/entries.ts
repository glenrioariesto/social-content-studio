import type { LoadedEntry } from '@shared/loaded-entry'

export function validEntries<T>(entries: LoadedEntry<T>[] | undefined): T[] {
  if (!entries) return []
  return entries.filter((e): e is Extract<LoadedEntry<T>, { kind: 'valid' }> => e.kind === 'valid').map(e => e.data)
}