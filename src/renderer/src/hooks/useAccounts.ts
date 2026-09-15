import { useDocument } from './useDocument'
import { useFsReload } from './useFsReload'
import { validEntries } from '@/lib/entries'
import type { Account } from '@shared/index'
import type { LoadedEntry } from '@shared/loaded-entry'

export function useAccounts() {
  const loaded = useDocument(async () => {
    const result = await window.electron.workspace.getAccounts()
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to load accounts')
    }
    const entries = (result.data ?? []) as LoadedEntry<Account>[]
    const quarantined = entries
      .filter((e): e is Extract<LoadedEntry<Account>, { kind: 'invalid' }> => e.kind === 'invalid')
      .map(e => ({ id: e.id, file: e.file, issues: e.issues }))
    return { accounts: validEntries<Account>(entries), quarantined }
  })

  useFsReload('accounts', loaded.reload)

  return {
    accounts: loaded.data?.accounts ?? [],
    quarantined: loaded.data?.quarantined ?? [],
    loading: loaded.loading,
    error: loaded.error,
    reload: loaded.reload
  }
}