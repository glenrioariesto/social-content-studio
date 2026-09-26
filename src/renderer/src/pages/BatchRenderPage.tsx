import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UploadCloud,
  FileSpreadsheet,
  Play,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Search,
  Clapperboard,
  FileVideo,
  RefreshCw,
  HelpCircle,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useTemplates } from '@/hooks/useTemplates'
import { useAccountStore } from '@/stores/app-store'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

interface ParsedRow {
  rowNumber: number
  title: string
  caption?: string
  hashtags?: string
  resourcePath?: string
  templateId?: string
  scheduledAt?: string
  hasDefaultTitle?: boolean
}

const SAMPLE_CSV = `title,caption,hashtags,resourcePath,templateId,scheduledAt
"5 Morning Habits for Focus","Starting your day with intention changes everything. Here are 5 habits to try today.","#mindset #productivity #habits",assets/morning-routine.mp4,,2026-10-01T09:00:00Z
"Quick Tip: Batch Your Creative Work","Don't switch tasks every 20 minutes. Protect 90-minute deep work blocks for content creation.","#creator #deepwork #workflow",,,2026-10-02T14:30:00Z
"Weekly Quote: Simple Wins","Keep it simple. Consistency beats intensity every single week.","#quote #inspiration",assets/weekly-quote.mp4,,2026-10-03T10:00:00Z
`

/**
 * Parses raw CSV text conforming to RFC 4180:
 * - Handles quoted fields with commas, line breaks, and escaped quotes ("")
 * - Trims UTF-8 BOM
 * - Normalizes Windows (\r\n) and Unix (\n) line endings
 */
function parseCsvToMatrix(text: string): string[][] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentVal = ''
  let inQuotes = false
  let i = 0

  while (i < clean.length) {
    const char = clean[i]
    const nextChar = clean[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        currentVal += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      }
      if (char === ',') {
        currentRow.push(currentVal.trim())
        currentVal = ''
        i++
        continue
      }
      if (char === '\r') {
        if (nextChar === '\n') {
          i++
        }
        currentRow.push(currentVal.trim())
        currentVal = ''
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        i++
        continue
      }
      if (char === '\n') {
        currentRow.push(currentVal.trim())
        currentVal = ''
        if (currentRow.some((c) => c.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        i++
        continue
      }
      currentVal += char
      i++
    }
  }

  // Push final cell/row if remaining
  if (currentVal.length > 0 || currentRow.length > 0) {
    currentRow.push(currentVal.trim())
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow)
    }
  }

  if (inQuotes) {
    throw new Error('Unclosed quotation mark detected in CSV. Please ensure all quoted fields are closed.')
  }

  return rows
}

function normalizeHeaderKey(header: string): string {
  const h = header.trim().toLowerCase().replace(/[\s_-]+/g, '')
  if (['title', 'name', 'headline', 'itemtitle'].includes(h)) return 'title'
  if (['caption', 'text', 'description', 'body', 'captiontext', 'content'].includes(h)) return 'caption'
  if (['hashtags', 'tags', 'hashtag', 'tag'].includes(h)) return 'hashtags'
  if (['resourcepath', 'resource', 'asset', 'assetpath', 'media', 'mediapath', 'video', 'videopath', 'image'].includes(h)) return 'resourcePath'
  if (['templateid', 'template', 'templatename', 'layout'].includes(h)) return 'templateId'
  if (['scheduledat', 'schedule', 'scheduleddate', 'date', 'time', 'postat'].includes(h)) return 'scheduledAt'
  return h
}

export function BatchRenderPage() {
  const navigate = useNavigate()
  const { accounts, loading: accountsLoading } = useAccounts()
  const { templates, loading: templatesLoading } = useTemplates()
  const { activeAccountId } = useAccountStore()
  const { showSuccess, showError, showInfo } = useErrorToast()

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [useCustomTemplate, setUseCustomTemplate] = useState(false)
  const [customTemplateId, setCustomTemplateId] = useState('')

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [parseWarnings, setParseWarnings] = useState<string[]>([])
  const [csvFileName, setCsvFileName] = useState('')
  const [csvFileSize, setCsvFileSize] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const [step, setStep] = useState<'upload' | 'preview' | 'running' | 'done'>('upload')
  const [runningPhase, setRunningPhase] = useState<'creating' | 'scheduling'>('creating')
  const [runningProgress, setRunningProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [copiedSample, setCopiedSample] = useState(false)
  const [showFormatGuide, setShowFormatGuide] = useState(true)

  const [progress, setProgress] = useState({ created: 0, added: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Default to active account when accounts load
  useEffect(() => {
    if (!selectedAccountId && accounts.length > 0) {
      if (activeAccountId && accounts.some((a) => a.id === activeAccountId)) {
        setSelectedAccountId(activeAccountId)
      } else {
        setSelectedAccountId(accounts[0].id)
      }
    }
  }, [accounts, activeAccountId, selectedAccountId])

  const processCsvContent = useCallback(
    (text: string, fileName: string, fileSize?: number) => {
      try {
        if (!text.trim()) {
          showError('The uploaded CSV file is empty.')
          return
        }

        const matrix = parseCsvToMatrix(text)
        if (matrix.length < 2) {
          showError('CSV must have a header row and at least one data row.')
          return
        }

        const rawHeaders = matrix[0]
        const normalizedHeaders = rawHeaders.map(normalizeHeaderKey)

        const RECOGNIZED_KEYS: Record<string, true> = {
          title: true,
          caption: true,
          hashtags: true,
          resourcePath: true,
          templateId: true,
          scheduledAt: true
        }
        const matched = normalizedHeaders.filter((h) => RECOGNIZED_KEYS[h])

        if (matched.length === 0) {
          showError(`Unrecognized CSV columns: "${rawHeaders.slice(0, 3).join(', ')}". Check the column guide below.`)
          return
        }

        const warnings: string[] = []
        const rows: ParsedRow[] = []

        for (let i = 1; i < matrix.length; i++) {
          const values = matrix[i]
          const rowMap: Record<string, string> = {}

          normalizedHeaders.forEach((h, idx) => {
            rowMap[h] = values[idx] || ''
          })

          const hasExplicitTitle = Boolean(rowMap['title'] && rowMap['title'].trim())
          const title = hasExplicitTitle ? rowMap['title'].trim() : `Item ${i}`

          if (!hasExplicitTitle) {
            warnings.push(`Row ${i}: Missing title; defaulted to "${title}"`)
          }

          rows.push({
            rowNumber: i,
            title,
            caption: rowMap['caption']?.trim() || undefined,
            hashtags: rowMap['hashtags']?.trim() || undefined,
            resourcePath: rowMap['resourcePath']?.trim() || undefined,
            templateId: rowMap['templateId']?.trim() || undefined,
            scheduledAt: rowMap['scheduledAt']?.trim() || undefined,
            hasDefaultTitle: !hasExplicitTitle
          })
        }

        if (rows.length === 0) {
          showError('No valid data rows found in the CSV file.')
          return
        }

        setCsvFileName(fileName)
        setCsvFileSize(fileSize ?? null)
        setParsedRows(rows)
        setParseWarnings(warnings)
        setSearchQuery('')
        setStep('preview')
        showInfo(`Parsed ${rows.length} rows from ${fileName}${warnings.length > 0 ? ` (${warnings.length} notices)` : ''}`)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to parse CSV file'
        showError(message)
      }
    },
    [showError, showInfo]
  )

  const handleFileSelected = useCallback(
    async (file?: File) => {
      if (!file) return
      if (!file.name.toLowerCase().endsWith('.csv')) {
        showError('Please select a valid CSV file (.csv)')
        return
      }
      const text = await file.text()
      processCsvContent(text, file.name, file.size)
    },
    [processCsvContent, showError]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) {
        await handleFileSelected(file)
      }
    },
    [handleFileSelected]
  )

  const handleDownloadSampleCsv = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'sample-batch-render.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showSuccess('Sample CSV downloaded')
  }

  const handleCopySampleCsv = async () => {
    try {
      await navigator.clipboard.writeText(SAMPLE_CSV)
      setCopiedSample(true)
      showSuccess('Sample CSV copied to clipboard')
      setTimeout(() => setCopiedSample(false), 2000)
    } catch {
      showError('Unable to copy to clipboard')
    }
  }

  const effectiveTemplateId = useCustomTemplate ? customTemplateId.trim() : selectedTemplateId

  const handleRun = async () => {
    if (!selectedAccountId) {
      showError('Please select an account for batch rendering.')
      return
    }

    if (parsedRows.length === 0) {
      showError('No content rows to render.')
      return
    }

    setStep('running')
    setRunningPhase('creating')
    setRunningProgress(20)
    setProgress({ created: 0, added: 0 })

    const rowsPayload = parsedRows.map((r) => ({
      title: r.title,
      caption: r.caption || '',
      hashtags: r.hashtags || '',
      resourcePath: r.resourcePath || '',
      templateId: r.templateId || '',
      scheduledAt: r.scheduledAt || ''
    }))

    const createResult = await window.electron.batch.createContent(
      selectedAccountId,
      rowsPayload as unknown as Record<string, string>[],
      effectiveTemplateId || undefined
    )

    if (!createResult.success || !createResult.data) {
      showError(createResult.error || 'Failed to create content items.')
      setStep('preview')
      return
    }

    const createdCount = createResult.data.count
    const ids = createResult.data.ids
    setProgress((p) => ({ ...p, created: createdCount }))
    setRunningProgress(65)
    setRunningPhase('scheduling')

    const queueResult = await window.electron.batch.enqueueAll(ids)
    const addedCount = queueResult.success && queueResult.data ? queueResult.data.added : 0
    setProgress((p) => ({ ...p, added: addedCount }))
    setRunningProgress(100)

    if (queueResult.success) {
      showSuccess(`Created ${createdCount} items, ${addedCount} added for rendering`)
    } else {
      showInfo(`Created ${createdCount} items. Some items could not be added to the render queue automatically.`)
    }

    setTimeout(() => {
      setStep('done')
    }, 400)
  }

  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const outPath = `workspace/assets/batch-export-${timestamp}.csv`
      const result = await window.electron.batch.exportCsv(outPath)
      if (result.success) {
        showSuccess(`Exported content list to ${result.data}`)
      } else {
        showError(result.error || 'Export failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed'
      showError(msg)
    } finally {
      setIsExporting(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setParsedRows([])
    setParseWarnings([])
    setCsvFileName('')
    setCsvFileSize(null)
    setSearchQuery('')
    setProgress({ created: 0, added: 0 })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Filter rows for preview search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return parsedRows
    const q = searchQuery.toLowerCase()
    return parsedRows.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.caption?.toLowerCase().includes(q) ||
        r.hashtags?.toLowerCase().includes(q) ||
        r.resourcePath?.toLowerCase().includes(q) ||
        r.templateId?.toLowerCase().includes(q)
    )
  }, [parsedRows, searchQuery])

  const stats = useMemo(() => {
    const withMedia = parsedRows.filter((r) => Boolean(r.resourcePath)).length
    const withTemplate = parsedRows.filter((r) => Boolean(r.templateId)).length
    const withSchedule = parsedRows.filter((r) => Boolean(r.scheduledAt)).length
    return { withMedia, withTemplate, withSchedule }
  }, [parsedRows])

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const selectedTemplate = templates.find((t) => t.id === effectiveTemplateId)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Batch Render</h1>
          <p className="text-sm text-zinc-400">Upload a CSV file to bulk create content items and schedule them for rendering.</p>
        </div>
        {step !== 'upload' && step !== 'running' && (
          <Button variant="outline" size="sm" onClick={handleReset} className="self-start sm:self-auto">
            <RefreshCw className="h-3.5 w-3.5" />
            Upload New File
          </Button>
        )}
      </div>

      {/* No Accounts Warning Banner */}
      {!accountsLoading && accounts.length === 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-200">No Social Accounts Configured</h3>
              <p className="mt-1 text-xs text-amber-300/80">
                Batch rendering assigns content items to a target account. Please configure at least one account before launching a batch run.
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => navigate('/accounts')}>
              Go to Accounts
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 1: UPLOAD */}
      {step === 'upload' && (
        <div className="space-y-6">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileSelected(file)
            }}
          />

          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
              isDragging
                ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60'
            }`}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/80 text-zinc-300 shadow-inner">
              <UploadCloud className="h-8 w-8 text-indigo-400" />
            </div>

            <h2 className="text-base font-semibold text-zinc-200">Drag and drop your CSV file here</h2>
            <p className="mt-1 max-w-md text-xs text-zinc-400">
              Select or drop a standard CSV file. We support quoted commas, newlines in captions, and custom templates.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                <FileSpreadsheet className="h-4 w-4" />
                Choose CSV File
              </Button>
              <Button variant="outline" onClick={handleDownloadSampleCsv}>
                <Download className="h-4 w-4" />
                Download Sample CSV
              </Button>
            </div>

            <p className="mt-4 text-[11px] text-zinc-500">Supports UTF-8 encoded .csv files up to 500 rows</p>
          </div>

          {/* CSV Schema Specification Card */}
          <Card className="overflow-hidden border-zinc-800 bg-zinc-900/70 p-0">
            <div
              className="flex cursor-pointer items-center justify-between border-b border-zinc-800/80 px-5 py-4 transition-colors hover:bg-zinc-800/30"
              onClick={() => setShowFormatGuide((v) => !v)}
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="h-4 w-4 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-semibold text-zinc-200">CSV Column Specifications & Format Guide</h3>
                  <p className="text-xs text-zinc-400">Review supported headers, required fields, and sample data</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopySampleCsv()
                  }}
                  className="h-7 text-xs"
                >
                  {copiedSample ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedSample ? 'Copied!' : 'Copy Sample'}
                </Button>
                {showFormatGuide ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
              </div>
            </div>

            {showFormatGuide && (
              <div className="space-y-4 p-5">
                <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-zinc-800 bg-zinc-900/90 text-zinc-400">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">Column Name</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">Description</th>
                        <th className="px-3 py-2.5 font-medium">Example Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                      <tr>
                        <td className="px-3 py-2.5 font-mono text-indigo-300">title</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="indigo">Recommended</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400">Content title or headline. Defaults to &quot;Item N&quot; if omitted.</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">&quot;5 Morning Habits for Focus&quot;</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-mono text-indigo-300">caption</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="default">Optional</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400">Post description or script copy. Commas inside quotes are supported.</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">&quot;Consistency beats intensity every time.&quot;</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-mono text-indigo-300">hashtags</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="default">Optional</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400">Tags separated by spaces or # symbols. Automatically normalized.</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">&quot;#productivity #mindset #growth&quot;</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-mono text-indigo-300">resourcePath</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="default">Optional</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400">Workspace-relative path to background video, image, or asset.</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">assets/morning-routine.mp4</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-mono text-indigo-300">templateId</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="default">Optional</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400">Specific template ID. If omitted, uses the batch default template.</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">minimal-quote-v1</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-mono text-indigo-300">scheduledAt</td>
                        <td className="px-3 py-2.5">
                          <Badge variant="default">Optional</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-zinc-400">ISO timestamp for post scheduling.</td>
                        <td className="px-3 py-2.5 font-mono text-zinc-400">2026-10-01T09:00:00Z</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg bg-zinc-950/80 p-3 text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5 font-medium text-zinc-300">
                    <Info className="h-3.5 w-3.5 text-indigo-400" />
                    <span>CSV Pro-Tips:</span>
                  </div>
                  <ul className="mt-1.5 list-inside list-disc space-y-1 text-zinc-500">
                    <li>Header names are case-insensitive and allow variations (e.g. &apos;resource&apos;, &apos;tags&apos;, &apos;schedule&apos;).</li>
                    <li>Fields containing commas, quotes, or newlines must be enclosed in double quotes.</li>
                    <li>To include literal double quotes inside a quoted column, double them (e.g. &quot;&quot;quoted&quot;&quot;).</li>
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* STEP 2: PREVIEW & CONFIGURATION */}
      {step === 'preview' && (
        <div className="space-y-6">
          {/* File summary pill & actions */}
          <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-950/50 text-indigo-400">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-zinc-200">{csvFileName}</p>
                  {csvFileSize && (
                    <span className="text-[11px] text-zinc-500">({(csvFileSize / 1024).toFixed(1)} KB)</span>
                  )}
                  <Badge variant="emerald">Valid CSV</Badge>
                </div>
                <p className="text-xs text-zinc-400">
                  {parsedRows.length} items ready • {stats.withMedia} with media • {stats.withTemplate} with template
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fileInputRef.current?.click()
                }}
              >
                Change File
              </Button>
            </div>
          </Card>

          {/* Validation Warnings if any */}
          {parseWarnings.length > 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-amber-200">
                    {parseWarnings.length} format notice{parseWarnings.length > 1 ? 's' : ''} detected:
                  </p>
                  <ul className="list-inside list-disc text-[11px] text-amber-300/80">
                    {parseWarnings.slice(0, 3).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                    {parseWarnings.length > 3 && <li>...and {parseWarnings.length - 3} more rows adjusted.</li>}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          {/* Batch Configuration */}
          <Card className="space-y-4 p-5">
            <h3 className="text-sm font-semibold text-zinc-200">Batch Rendering Settings</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Account Selector */}
              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-zinc-300">
                  <span>Target Account (Required)</span>
                  {accountsLoading && <span className="text-[11px] text-zinc-500">Loading...</span>}
                </label>
                {accounts.length === 0 ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
                    No accounts found.{' '}
                    <button onClick={() => navigate('/accounts')} className="font-semibold underline">
                      Create an account
                    </button>
                  </div>
                ) : (
                  <Select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)}>
                    <option value="">Select target account...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.replizPlatform ? `${a.name} (${a.replizPlatform})` : a.name}
                      </option>
                    ))}
                  </Select>
                )}
                <p className="mt-1 text-[11px] text-zinc-500">All created content items will be linked to this account.</p>
              </div>

              {/* Template Selector */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Default Template (Optional)</label>
                  <button
                    type="button"
                    onClick={() => setUseCustomTemplate((v) => !v)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    {useCustomTemplate ? 'Choose from library' : 'Enter custom ID'}
                  </button>
                </div>

                {useCustomTemplate ? (
                  <Input
                    value={customTemplateId}
                    onChange={(e) => setCustomTemplateId(e.target.value)}
                    placeholder="e.g. custom-template-id"
                  />
                ) : (
                  <Select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                    <option value="">None (Use CSV value or default)</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.type})
                      </option>
                    ))}
                  </Select>
                )}
                <p className="mt-1 text-[11px] text-zinc-500">
                  Applied to items where the CSV row doesn&apos;t specify a template ID.
                </p>
              </div>
            </div>
          </Card>

          {/* Table Preview */}
          <div className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-200">Content Preview</h3>
                <span className="text-xs text-zinc-500">
                  Showing {filteredRows.length} of {parsedRows.length} items
                </span>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search parsed items..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {filteredRows.length === 0 ? (
              <EmptyState
                icon={<Search className="h-6 w-6 text-zinc-500" />}
                title="No matching items"
                description={`No rows match your search query "${searchQuery}".`}
                action={
                  <Button size="sm" variant="outline" onClick={() => setSearchQuery('')}>
                    Clear Search
                  </Button>
                }
              />
            ) : (
              <div className="max-h-[380px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/60 shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">#</th>
                      <th className="px-3 py-2.5 font-medium">Title</th>
                      <th className="px-3 py-2.5 font-medium">Caption</th>
                      <th className="px-3 py-2.5 font-medium">Hashtags</th>
                      <th className="px-3 py-2.5 font-medium">Media Asset</th>
                      <th className="px-3 py-2.5 font-medium">Template</th>
                      <th className="px-3 py-2.5 font-medium">Scheduled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {filteredRows.slice(0, 100).map((row) => (
                      <tr key={row.rowNumber} className="hover:bg-zinc-800/30">
                        <td className="px-3 py-2 font-mono text-zinc-500">{row.rowNumber}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-zinc-200">{row.title}</span>
                            {row.hasDefaultTitle && (
                              <Badge variant="amber" className="text-[9px]">
                                Default
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="max-w-[200px] truncate px-3 py-2 text-zinc-400" title={row.caption || ''}>
                          {row.caption || <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="max-w-[150px] truncate px-3 py-2 text-indigo-300/80" title={row.hashtags || ''}>
                          {row.hashtags || <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="max-w-[130px] truncate px-3 py-2 font-mono text-[11px] text-zinc-400" title={row.resourcePath || ''}>
                          {row.resourcePath || <span className="text-zinc-600">—</span>}
                        </td>
                        <td className="px-3 py-2">
                          {row.templateId ? (
                            <Badge variant="indigo" className="font-mono text-[10px]">
                              {row.templateId}
                            </Badge>
                          ) : effectiveTemplateId ? (
                            <span className="text-[11px] text-zinc-500">
                              (Batch: {selectedTemplate?.name || effectiveTemplateId})
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-zinc-400">
                          {row.scheduledAt || <span className="text-zinc-600">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredRows.length > 100 && (
                  <p className="border-t border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-center text-xs text-zinc-500">
                    Showing first 100 of {filteredRows.length} items. All items will be created upon confirmation.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-zinc-400">
              Target:{' '}
              <span className="font-medium text-zinc-200">
                {selectedAccount?.name || 'No account selected'}
              </span>
              {' • '}
              Items to create: <span className="font-medium text-zinc-200">{parsedRows.length}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleRun}
                disabled={!selectedAccountId || parsedRows.length === 0}
              >
                <Play className="h-4 w-4" />
                Create &amp; Queue ({parsedRows.length} Items)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: RUNNING PROGRESS */}
      {step === 'running' && (
        <Card className="flex flex-col items-center justify-center space-y-6 py-16 text-center">
          <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600/10">
            <Layers className="h-10 w-10 animate-pulse text-indigo-400" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-zinc-200">Processing Batch Render</h2>
            <p className="text-xs text-zinc-400">
              {runningPhase === 'creating'
                ? `Step 1 of 2: Generating ${parsedRows.length} content items for ${selectedAccount?.name || 'account'}...`
                : `Step 2 of 2: Preparing and adding items for rendering...`}
            </p>
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-md space-y-2">
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                style={{ width: `${runningProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>{runningPhase === 'creating' ? 'Writing documents' : 'Render pipeline'}</span>
              <span>{runningProgress}%</span>
            </div>
          </div>

          <p className="text-[11px] text-zinc-500">Please keep Social Content Studio open while processing.</p>
        </Card>
      )}

      {/* STEP 4: DONE */}
      {step === 'done' && (
        <div className="space-y-6">
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 ring-8 ring-emerald-500/5">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h2 className="text-xl font-bold text-zinc-100">Batch Processing Complete</h2>
            <p className="mt-1 max-w-md text-xs text-zinc-400">
              Content documents have been created in your workspace and added to the rendering schedule.
            </p>

            {/* Metrics Grid */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-2xl font-bold text-zinc-100">{progress.created}</p>
                <p className="text-[11px] text-zinc-500">Items Created</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="text-2xl font-bold text-emerald-400">{progress.added}</p>
                <p className="text-[11px] text-zinc-500">Added to Queue</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="truncate text-sm font-semibold text-zinc-200">{selectedAccount?.name || '—'}</p>
                <p className="text-[11px] text-zinc-500">Target Account</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                <p className="truncate text-sm font-semibold text-zinc-200">
                  {selectedTemplate?.name || (effectiveTemplateId ? 'Custom' : 'None')}
                </p>
                <p className="text-[11px] text-zinc-500">Default Template</p>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button variant="primary" onClick={() => navigate('/queue')}>
              <Clapperboard className="h-4 w-4" />
              Go to Render Queue
            </Button>
            <Button variant="secondary" onClick={() => navigate('/content')}>
              <FileVideo className="h-4 w-4" />
              View Created Content
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="h-4 w-4" />
              Create Another Batch
            </Button>
            <Button variant="ghost" onClick={handleExportCsv} disabled={isExporting}>
              <Download className="h-4 w-4" />
              {isExporting ? 'Exporting...' : 'Export Content CSV'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
