import { useEffect, useCallback, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { Account } from '@shared/index'
import type { LoadedEntry } from '@shared/loaded-entry'

function validEntries<T>(entries: LoadedEntry<T>[] | undefined): T[] {
  if (!entries) return []
  return entries.filter((e): e is Extract<LoadedEntry<T>, { kind: 'valid' }> => e.kind === 'valid').map(e => e.data)
}

export function useAccounts() {
  const { accounts, setAccounts } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await window.electron.workspace.getAccounts()
    if (result.success && result.data) {
      setAccounts(validEntries<Account>(result.data as LoadedEntry<Account>[]))
    } else {
      setError(result.error ?? 'Failed to load accounts')
    }
    setLoading(false)
  }, [setAccounts])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return { accounts, loading, error, reload: loadAccounts }
}
