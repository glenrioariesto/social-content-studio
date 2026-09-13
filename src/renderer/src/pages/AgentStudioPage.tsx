import { useState } from 'react'
import { Bot, Loader2, Play, RefreshCw } from 'lucide-react'
import { useAgentTools } from '@/hooks/useAgent'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Field'
import type { AgentInvokeRequest } from '@shared/agent'

const PRESETS: { tool: string; label: string; build: () => AgentInvokeRequest }[] = [
  {
    tool: 'content.list',
    label: 'List content',
    build: () => ({ tool: 'content.list', args: {} })
  },
  {
    tool: 'template.list',
    label: 'List templates',
    build: () => ({ tool: 'template.list', args: {} })
  },
  {
    tool: 'render.jobs',
    label: 'Render jobs',
    build: () => ({ tool: 'render.jobs', args: {} })
  },
  {
    tool: 'workspace.backupInfo',
    label: 'Workspace info',
    build: () => ({ tool: 'workspace.backupInfo', args: {} })
  }
]

export function AgentStudioPage() {
  const { tools, loading, error, reload, invoke, available } = useAgentTools()
  const { showError, showSuccess } = useErrorToast()
  const [running, setRunning] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<unknown>(null)
  const [contentId, setContentId] = useState('')
  const [targetStatus, setTargetStatus] = useState('draft')

  const run = async (tool: string, args: Record<string, unknown>) => {
    setRunning(tool)
    setLastResult(null)
    try {
      const result = await invoke({ tool, args })
      setRunning(null)
      if (result.success) {
        showSuccess(`${tool} succeeded`)
        setLastResult(result.data ?? null)
      } else {
        showError(result.error ?? `${tool} failed`)
        setLastResult({ error: result.error, errorCode: result.errorCode })
      }
    } catch (e) {
      setRunning(null)
      const message = e instanceof Error ? e.message : String(e)
      showError(message)
      setLastResult({ error: message })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bot className="h-6 w-6 text-indigo-400" />
            Agent Studio
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Intent-only tools via window.electron.agent. Writes stay confined in main.
          </p>
        </div>
        <Button variant="outline" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
          Reload tools
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading agent tools...
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!available && !loading && (
        <Card className="border-amber-800/40 bg-amber-950/20 p-4 text-xs text-amber-200">
          Bridge window.electron.agent tidak tersedia. Penyebab umum: preload lama
          (index.js vs preload.mjs). Tutup Electron, jalankan bun run build lalu bun run dev.
        </Card>
      )}
      {tools.length === 0 && !loading && !error && (
        <p className="text-sm text-zinc-500">No agent tools registered yet.</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map(p => (
          <Button
            key={p.tool}
            variant="outline"
            disabled={running !== null}
            onClick={() => void run(p.tool, p.build().args)}
            className="flex items-center justify-between rounded-xl border-zinc-800 bg-zinc-900/50 p-4 text-left hover:bg-zinc-800/50 disabled:opacity-50"
          >
            <span className="text-sm font-medium">{p.label}</span>
            {running === p.tool ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            ) : (
              <Play className="h-4 w-4 text-zinc-500" />
            )}
          </Button>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-zinc-300">Transition content status</h2>
        <p className="mt-1 text-xs text-zinc-500">Checked by CONTENT_STATUS_FLOW in main.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input
            value={contentId}
            onChange={e => setContentId(e.target.value)}
            placeholder="content id"
            className="min-w-[220px] flex-1 border-zinc-800 bg-zinc-950 font-mono text-xs"
          />
          <Select
            value={targetStatus}
            onChange={e => setTargetStatus(e.target.value)}
            className="border-zinc-800 bg-zinc-950 text-xs"
          >
            {['idea', 'draft', 'ready', 'rendering', 'ready-to-post', 'posted', 'failed'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Button
            disabled={!contentId || running !== null}
            onClick={() => void run('content.transition', { id: contentId, to: targetStatus })}
            className="text-xs"
          >
            Run transition
          </Button>
        </div>
      </Card>

      {lastResult !== null && (
        <pre className="max-h-[320px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-xs text-zinc-300">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      )}
    </div>
  )
}
