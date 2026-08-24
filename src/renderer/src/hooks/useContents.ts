import { useEffect, useCallback, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { Content } from '@shared/index'
import type { LoadedEntry } from '@shared/loaded-entry'
import type { ValidationIssue } from '@shared/validators'


function validEntries<T>(entries: LoadedEntry<T>[] | undefined): T[] {
  if (!entries) return []
  return entries.filter((e): e is Extract<LoadedEntry<T>, { kind: 'valid' }> => e.kind === 'valid').map(e => e.data)
}

export interface QuarantinedEntry {
  id: string
  file: string
  issues: ValidationIssue[]
}

export function useContents(filters?: { accountId?: string; status?: string }) {
  const { contents, setContents } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [quarantined, setQuarantined] = useState<QuarantinedEntry[]>([])

  const loadContents = useCallback(async () => {
    setLoading(true)
    const result = await window.electron.workspace.getContents(filters)
    if (result.success && result.data) {
      const entries = result.data as LoadedEntry<Content>[]
      setContents(validEntries<Content>(entries))
      // GH-003 / AC-005: surface invalid (quarantined) entries read-only.
      setQuarantined(
        entries
          .filter((e): e is Extract<LoadedEntry<Content>, { kind: 'invalid' }> => e.kind === 'invalid')
          .map(e => ({ id: e.id, file: e.file, issues: e.issues }))
      )
    }
    setLoading(false)
  }, [setContents, filters?.accountId, filters?.status])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  return { contents, loading, quarantined, reload: loadContents }
}
