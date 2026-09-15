import { useState, useEffect, useCallback } from 'react'
import { FileText, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

interface LogEntry {
  timestamp: string
  level: string
  message: string
  context?: string
  meta?: unknown
}

export function LogsPage() {
  const [logFiles, setLogFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState('')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  const loadLogFiles = useCallback(async () => {
    setError(null)
    const result = await window.electron.fs.readdir('workspace/config/logs')
    if (result.success && result.data) {
      const files = result.data
        .filter(f => f.isFile && f.name.endsWith('.log'))
        .map(f => f.name)
        .sort()
        .reverse()
      setLogFiles(files)
      if (files.length > 0 && !selectedFile) setSelectedFile(files[0])
    } else {
      setError(result.error ?? 'Failed to load log files')
    }
  }, [selectedFile])

  const loadLogContent = useCallback(async (fileName: string) => {
    if (!fileName) return
    setLoading(true)
    setError(null)
    const result = await window.electron.fs.readFile(`workspace/config/logs/${fileName}`)
    if (result.success && result.data) {
      const lines = result.data.split('\n').filter(Boolean)
      const parsed: LogEntry[] = []
      for (const line of lines) {
        try {
          const obj = JSON.parse(line)
          parsed.push({
            timestamp: obj.timestamp || '',
            level: obj.level || 'info',
            message: obj.message || obj.error || '',
            context: obj.context,
            meta: obj.meta
          })
        } catch {
          parsed.push({ timestamp: '', level: 'info', message: line })
        }
      }
      setEntries(parsed.reverse())
    } else {
      setError(result.error ?? `Failed to read ${fileName}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadLogFiles() }, [loadLogFiles])
  useEffect(() => { if (selectedFile) loadLogContent(selectedFile) }, [selectedFile, loadLogContent])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400 bg-red-400/10'
      case 'warn': return 'text-amber-400 bg-amber-400/10'
      default: return 'text-zinc-400 bg-zinc-800/50'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="mt-1 text-sm text-zinc-400">Application error and activity logs</p>
        </div>
        <Button
          variant="outline"
          onClick={() => { loadLogFiles(); if (selectedFile) loadLogContent(selectedFile) }}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-4">
        <div className="space-y-1">
          <p className="mb-2 text-xs font-semibold text-zinc-500">Log Files</p>
          {logFiles.length === 0 ? (
            <p className="text-xs text-zinc-600">No log files yet</p>
          ) : (
            logFiles.map(f => (
              <button
                key={f}
                onClick={() => setSelectedFile(f)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedFile === f ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                }`}
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                {f}
              </button>
            ))
          )}
        </div>

        <Card>
          {loading ? (
            <LoadingState label="Loading..." />
          ) : error ? (
            <ErrorState
              title="Failed to load logs"
              message={error}
              onRetry={() => { loadLogFiles(); if (selectedFile) loadLogContent(selectedFile) }}
            />
          ) : entries.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} title="No log entries" />
          ) : (
            <div className="max-h-[600px] divide-y divide-zinc-800/50 overflow-auto">
              {entries.map((entry, i) => (
                <div key={i} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${getLevelColor(entry.level)}`}>
                      {entry.level}
                    </span>
                    <span className="text-xs text-zinc-600">{entry.timestamp}</span>
                    {entry.context && <span className="text-xs text-zinc-600">[{entry.context}]</span>}
                    <button
                      onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                      className="ml-auto text-zinc-600 hover:text-zinc-400"
                    >
                      {expandedIdx === i ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-zinc-300">{entry.message}</p>
                  {expandedIdx === i && entry.meta != null && (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-800/50 p-3 text-xs text-zinc-500">
                      {typeof entry.meta === 'string' ? entry.meta : JSON.stringify(entry.meta, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
