import { useState, useCallback, useEffect } from 'react'

interface ResourceData {
  id: string
  source: string
  sourceUrl?: string
  fileName: string
  filePath: string
  status: string
  createdAt: string
}

export function useResources() {
  const [resources, setResources] = useState<ResourceData[]>([])
  const [loading, setLoading] = useState(false)

  const loadResources = useCallback(async () => {
    setLoading(true)
    const result = await window.electron.workspace.getAssets('video')
    if (result.success && result.data) {
      const videos = (result.data as any).video || []
      setResources(videos.map((f: string) => ({
        id: f,
        source: 'file',
        fileName: f,
        filePath: `workspace/assets/video/${f}`,
        status: 'ready',
        createdAt: ''
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadResources() }, [loadResources])

  const download = useCallback(async (url: string) => {
    const result = await (window.electron as any).resource?.download(url)
    if (result?.success) {
      await loadResources()
    }
    return result
  }, [loadResources])

  return { resources, loading, reload: loadResources, download }
}
