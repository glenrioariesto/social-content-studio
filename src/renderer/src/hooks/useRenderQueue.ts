import { useEffect, useState, useCallback } from 'react'
import { callIpc, requireBridge } from '@/lib/ipc-call'
import { useErrorToast } from './useErrorToast'
import type { RenderJobSummary } from '@shared/index'

export function useRenderQueue() {
  const [jobs, setJobs] = useState<RenderJobSummary[]>([])
  const [error, setError] = useState<string | null>(null)
  const { showError } = useErrorToast()

  const loadJobs = useCallback(async () => {
    if (!window.electron?.render) {
      setError('Bridge tidak tersedia. Mulai ulang aplikasi.')
      return
    }
    const result = await callIpc({
      call: () => window.electron.render.jobs(),
      showError,
      errorPrefix: 'Gagal memuat render queue'
    })
    if (result.ok && result.data) {
      setJobs(result.data)
      setError(null)
    } else if (!result.ok) {
      setError(result.message)
    }
  }, [showError])

  useEffect(() => { loadJobs() }, [loadJobs])

  useEffect(() => {
    if (!window.electron?.on) return
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

  return { jobs, error, reload: loadJobs }
}
