import { useState, useCallback } from 'react'
import { Upload, FileText, Play, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useErrorToast } from '@/hooks/useErrorToast'

interface ParsedRow {
  title: string
  caption?: string
  hashtags?: string
  resourcePath?: string
  templateId?: string
}

export function BatchRenderPage() {
  const { accounts } = useAccounts()
  const { showSuccess, showError, showInfo } = useErrorToast()
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'running' | 'done'>('upload')
  const [createdIds, setCreatedIds] = useState<string[]>([])
  const [progress, setProgress] = useState({ created: 0, queued: 0 })

  const handleUpload = useCallback(async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setCsvFileName(file.name)
      const text = await file.text()

      const lines = text.trim().split('\n')
      if (lines.length < 2) {
        showError('CSV must have a header row and at least one data row')
        return
      }
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const rows: ParsedRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const row: Record<string, string> = {}
        headers.forEach((h, idx) => { row[h] = values[idx] || '' })
        rows.push({
          title: row['title'] || `Item ${i}`,
          caption: row['caption'],
          hashtags: row['hashtags'],
          resourcePath: row['resourcepath'] || row['resource'],
          templateId: row['templateid'] || row['template']
        })
      }
      setParsedRows(rows)
      setStep('preview')
      showInfo(`Parsed ${rows.length} rows from ${file.name}`)
    }
    input.click()
  }, [showError, showInfo])

  const handleRun = async () => {
    if (!selectedAccountId) {
      showError('Select an account first')
      return
    }
    setStep('running')
    setProgress({ created: 0, queued: 0 })

    const result = await window.electron.batch.createContent(selectedAccountId, parsedRows as unknown as Record<string, string>[], selectedTemplateId || undefined)
    if (!result.success || !result.data) {
      showError('Failed to create content')
      setStep('preview')
      return
    }
    setCreatedIds(result.data.ids)
    setProgress(p => ({ ...p, created: result.data!.count }))

    const queueResult = await window.electron.batch.enqueueAll(result.data.ids)
    if (queueResult.success && queueResult.data) {
      setProgress(p => ({ ...p, queued: queueResult.data!.queued }))
    }

    showSuccess(`Created ${result.data.count} items, ${queueResult.data?.queued || 0} queued for render`)
    setStep('done')
  }

  const handleExportCsv = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.setAttribute('nwsaveas', 'export.csv')
    const outPath = `workspace/assets/batch-export-${Date.now()}.csv`
    const result = await window.electron.batch.exportCsv(outPath)
    if (result.success) showSuccess(`Exported to ${result.data}`)
    else showError('Export failed')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Batch Render</h1>
        <p className="mt-1 text-sm text-zinc-400">Upload a CSV to create and render multiple content items</p>
      </div>

      {step === 'upload' && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-700 py-20">
          <Upload className="mb-4 h-10 w-10 text-zinc-600" />
          <p className="mb-1 text-sm text-zinc-400">Upload a CSV file</p>
          <p className="mb-4 text-xs text-zinc-600">Headers: title, caption, hashtags, resourcePath, templateId</p>
          <button onClick={handleUpload} className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500">
            Choose CSV File
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-zinc-400" />
              <div>
                <p className="text-sm font-medium">{csvFileName}</p>
                <p className="text-xs text-zinc-500">{parsedRows.length} rows found</p>
              </div>
            </div>
            <button onClick={() => setStep('upload')} className="text-xs text-zinc-500 hover:text-zinc-300">Change file</button>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-400">Account</label>
              <select
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
              >
                <option value="">Select account...</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-400">Template (optional)</label>
              <input
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                placeholder="Template ID"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500 placeholder:text-zinc-600"
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-auto rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Caption</th>
                  <th className="px-3 py-2">Hashtags</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-zinc-800/50 text-zinc-400">
                    <td className="px-3 py-2 text-zinc-600">{i + 1}</td>
                    <td className="px-3 py-2">{row.title}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-xs">{row.caption || '—'}</td>
                    <td className="px-3 py-2 text-xs">{row.hashtags || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedRows.length > 50 && (
              <p className="px-3 py-2 text-center text-xs text-zinc-600">+{parsedRows.length - 50} more rows</p>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setStep('upload')} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
              Cancel
            </button>
            <button onClick={handleRun} disabled={!selectedAccountId} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
              <Play className="h-4 w-4" />
              Create & Enqueue ({parsedRows.length})
            </button>
          </div>
        </div>
      )}

      {step === 'running' && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-indigo-500" />
          <p className="text-sm text-zinc-400">Creating content items...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/50 py-12">
            <CheckCircle2 className="mb-4 h-12 w-12 text-emerald-500" />
            <h2 className="text-lg font-semibold">Batch Complete</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Created <span className="font-medium text-zinc-200">{progress.created}</span> content items
              {' • '}
              Queued <span className="font-medium text-zinc-200">{progress.queued}</span> for rendering
            </p>
          </div>

          <div className="flex justify-center gap-2">
            <button onClick={() => { setStep('upload'); setParsedRows([]); setCreatedIds([]) }} className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
              New Batch
            </button>
            <button onClick={handleExportCsv} className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700">
              <Download className="h-4 w-4" />
              Export All Content CSV
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
