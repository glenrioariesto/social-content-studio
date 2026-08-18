import { useEffect, useCallback, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useErrorToast } from '@/hooks/useErrorToast'
import type { Account } from '@shared/index'

export function useAccounts() {
  const { accounts, setAccounts } = useAppStore()
  const [loading, setLoading] = useState(false)
  const { showSuccess } = useErrorToast()

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    const result = await window.electron.workspace.getAccounts()
    if (result.success && result.data) {
      setAccounts(result.data as Account[])
    }
    setLoading(false)
  }, [setAccounts])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  return { accounts, loading, reload: loadAccounts }
}
