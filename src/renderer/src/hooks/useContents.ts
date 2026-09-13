import { useDocument } from './useDocument'
import { validEntries } from '@/lib/entries'
import type { Content } from '@shared/index'
import type { LoadedEntry } from '@shared/loaded-entry'
import type { ValidationIssue } from '@shared/validators'

export interface QuarantinedEntry {
  id: string
  file: string
  issues: ValidationIssue[]
}

export function useContents(filters?: { accountId?: string; status?: string }) {
  const loaded = useDocument(async () => {
    const result = await window.electron.workspace.getContents(filters)
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to load content')
    }
    const entries = (result.data ?? []) as LoadedEntry<Content>[]
    // GH-003 / AC-005: surface invalid (quarantined) entries read-only.
    const quarantined = entries
      .filter((e): e is Extract<LoadedEntry<Content>, { kind: 'invalid' }> => e.kind === 'invalid')
      .map(e => ({ id: e.id, file: e.file, issues: e.issues }))
    return { contents: validEntries<Content>(entries), quarantined }
  }, [filters?.accountId, filters?.status])

  return {
    contents: loaded.data?.contents ?? [],
    quarantined: loaded.data?.quarantined ?? [],
    loading: loaded.loading,
    error: loaded.error,
    reload: loaded.reload
  }
}