import { useEffect, useState, useCallback } from 'react'

interface RenderJobData {
  id: string
  contentId: string
  status: 'queued' | 'rendering' | 'completed' | 'failed'
  progress: number
  error?: string
  createdAt: string
  completedAt?: string
}

export function useRenderQueue() {
  const [jobs, setJobs] = useState<RenderJobData[]>([])

  const loadJobs = useCallback(async () => {
    const result = await window.electron.render.jobs()
    if (result.success && result.data) {
      setJobs(result.data as RenderJobData[])
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  useEffect(() => {
    const unsubs = [
      window.electron.on('render:progress', (data: unknown) => {
        const d = data as { id: string; progress: number }
        setJobs(prev => prev.map(j => j.id === d.id ? { ...j, progress: d.progress, status: 'rendering' as const } : j))
      }),
      window.electron.on('render:completed', (data: unknown) => {
        const d = data as { id: string }
        setJobs(prev => prev.map(j => j.id === d.id ? { ...j, status: 'completed' as const, progress: 100 } : j))
      }),
      window.electron.on('render:failed', (data: unknown) => {
        const d = data as { id: string; error?: string }
        setJobs(prev => prev.map(j => j.id === d.id ? { ...j, status: 'failed' as const, error: d.error } : j))
      }),
      window.electron.on('render:started', (data: unknown) => {
        const d = data as { id: string }
        setJobs(prev => prev.map(j => j.id === d.id ? { ...j, status: 'rendering' as const } : j))
      })
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  return { jobs, reload: loadJobs }
}
