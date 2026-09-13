import { useDocument } from './useDocument'
import { validEntries } from '@/lib/entries'
import type { Account } from '@shared/index'
import type { LoadedEntry } from '@shared/loaded-entry'

export function useAccounts() {
  const loaded = useDocument(async () => {
    const result = await window.electron.workspace.getAccounts()
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to load accounts')
    }
    return validEntries<Account>((result.data ?? []) as LoadedEntry<Account>[])
  })

  return {
    accounts: loaded.data ?? [],
    loading: loaded.loading,
    error: loaded.error,
    reload: loaded.reload
  }
}