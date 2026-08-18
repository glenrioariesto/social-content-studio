import { useEffect, useCallback, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { Content } from '@shared/index'

export function useContents(filters?: { accountId?: string; status?: string }) {
  const { contents, setContents } = useAppStore()
  const [loading, setLoading] = useState(false)

  const loadContents = useCallback(async () => {
    setLoading(true)
    const result = await window.electron.workspace.getContents(filters)
    if (result.success && result.data) {
      setContents(result.data as Content[])
    }
    setLoading(false)
  }, [setContents, filters?.accountId, filters?.status])

  useEffect(() => {
    loadContents()
  }, [loadContents])

  return { contents, loading, reload: loadContents }
}
