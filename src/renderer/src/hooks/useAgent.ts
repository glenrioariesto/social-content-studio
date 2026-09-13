import { useCallback, useEffect, useState } from 'react'
import type { AgentInvokeRequest, AgentToolDef } from '@shared/agent'
import { callIpc, requireBridge } from '@/lib/ipc-call'
import { useErrorToast } from './useErrorToast'

export function useAgentTools() {
  const [tools, setTools] = useState<AgentToolDef[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showError } = useErrorToast()

  const load = useCallback(async () => {
    if (!window.electron?.agent) {
      setError('Bridge tidak tersedia. Mulai ulang aplikasi.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const result = await callIpc({
      call: () => window.electron.agent.listTools(),
      showError,
      errorPrefix: 'Gagal memuat agent tools'
    })
    if (result.ok && result.data) setTools(result.data)
    else if (!result.ok) setError(result.message)
    setLoading(false)
  }, [showError])

  useEffect(() => { void load() }, [load])

  const invoke = useCallback(async (req: AgentInvokeRequest) => {
    if (!window.electron?.agent) {
      throw new Error('Bridge tidak tersedia')
    }
    const result = await callIpc({
      call: () => window.electron.agent.invoke(req),
      showError
    })
    if (result.ok) return { success: true as const, data: result.data }
    return { success: false as const, error: result.technical, errorCode: result.code }
  }, [showError])

  const available = typeof window !== 'undefined' && Boolean(window.electron?.agent)

  return { tools, loading, error, reload: load, invoke, available }
}
