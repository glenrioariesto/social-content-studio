import { useEffect, useCallback } from 'react'
import { useAppStore } from '../stores/app-store'
import type { FileChangeEvent } from '@shared/index'

export function useWorkspaceSync() {
  const {
    setAccounts,
    setContents,
    setTemplates,
    setLoading
  } = useAppStore()

  const loadAll = useCallback(async () => {
    const api = window.electron
    if (!api) return

    setLoading(true)

    const [accounts, contents, templates] = await Promise.all([
      api.workspace.getAccounts(),
      api.workspace.getContents(),
      api.workspace.getTemplates()
    ])

    if (accounts.success && accounts.data) setAccounts(accounts.data as any)
    if (contents.success && contents.data) setContents(contents.data as any)
    if (templates.success && templates.data) setTemplates(templates.data as any)

    setLoading(false)
  }, [setAccounts, setContents, setTemplates, setLoading])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const api = window.electron
    if (!api) return

    const unsub = api.on('fs:changed', (event: unknown) => {
      const change = event as FileChangeEvent
      if (
        change.relativePath.startsWith('/contents/') ||
        change.relativePath.startsWith('/templates/') ||
        change.relativePath.startsWith('/accounts/')
      ) {
        loadAll()
      }
    })

    return unsub
  }, [loadAll])

  return { reload: loadAll }
}
