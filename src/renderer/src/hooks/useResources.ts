import { useCallback } from 'react'
import { useDocument } from './useDocument'
import { useFsReload } from './useFsReload'
import type { Resource } from '@shared/resource'

export function useResources() {
  const loaded = useDocument(async () => {
    const result = await window.electron.resource.list()
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to load resources')
    }
    return result.data ?? []
  })

  useFsReload('resources', loaded.reload)

  const download = useCallback(async (url: string) => {
    const result = await window.electron.resource.download(url)
    if (result.success) {
      await loaded.reload()
    }
    return result
  }, [loaded.reload])

  const remove = useCallback(async (id: string) => {
    const result = await window.electron.resource.delete(id)
    if (result.success) {
      await loaded.reload()
    }
    return result
  }, [loaded.reload])

  return {
    resources: loaded.data ?? [],
    loading: loaded.loading,
    error: loaded.error,
    reload: loaded.reload,
    download,
    remove
  }
}