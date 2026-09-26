import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileVideo, Trash2, Sparkles, AlertTriangle } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { useAccounts } from '@/hooks/useAccounts'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { allowedNextStatuses, statusToLabel } from '@/lib/status-filters'
import type { Content, Account, ContentStatus } from '@shared/index'

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [matching, setMatching] = useState(false)
  const [transitioningTo, setTransitioningTo] = useState<ContentStatus | null>(null)
  const { accounts } = useAccounts()
  const { showSuccess, showError, showInfo } = useErrorToast()

  const account = content ? accounts.find(a => a.id === content.accountId) : null
  const nextStatuses = content ? allowedNextStatuses(content.status) : []

  const load = () => {
    if (!id) return
    window.electron.workspace.getContent(id)
      .then(res => {
        if (res.success && res.data) {
          if (res.data.kind === 'valid') {
            setContent(res.data.data)
          } else {
            setError('Content file is corrupted or invalid')
          }
        } else {
          setError(res.error || 'Content not found')
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [id])

  const handleDelete = async () => {
    setConfirmDelete(true)
  }

  const confirmDeleteContent = async () => {
    if (!content) return
    setDeleting(true)
    try {
      const result = await window.electron.workspace.deleteContent(content.id)
      if (result.success) {
        showSuccess('Content deleted')
        navigate('/content')
      } else {
        showError(result.error || 'Failed to delete content')
        setConfirmDelete(false)
      }
    } finally {
      setDeleting(false)
    }
  }

  const handleTransition = async (to: ContentStatus) => {
    setTransitioningTo(to)
    try {
      const result = await window.electron.workspace.updateContent(content!.id, { status: to })
      if (result.success) {
        showSuccess(`Moved to ${statusToLabel(to)}`)
        load()
      } else {
        showError(result.error || 'Failed to update status')
      }
    } finally {
      setTransitioningTo(null)
    }
  }

  const handleAiMatchmaker = async () => {
    if (!content?.templateId) {
      showError('Please assign a template first to find a matching asset.')
      return
    }
    setMatching(true)
    try {
      const templatesRes = await (window.electron.workspace as any).getTemplates()
      const template = templatesRes.data?.find((t: any) => t.id === content.templateId) || { id: content.templateId }
      
      const assetsRes = await window.electron.workspace.getAssets()
      const allAssets = [...(assetsRes.data?.images || []), ...(assetsRes.data?.video || [])]
      
      if (allAssets.length === 0) {
        showInfo('No images or videos found in the workspace.')
        return
      }

      let bestAsset = null
      let bestScore = -1
      let bestFolder = ''

      for (const folder of ['images', 'video'] as const) {
        for (const assetName of assetsRes.data?.[folder] || []) {
          const sRes = await window.electron.ai.scoreAsset(template, assetName)
          if (sRes.success && typeof sRes.data === 'number') {
            if (sRes.data > bestScore) {
              bestScore = sRes.data
              bestAsset = assetName
              bestFolder = folder
            }
          }
        }
      }

      if (bestAsset && bestScore > 50) {
        await window.electron.workspace.updateContent(content.id, { resourcePath: `assets/${bestFolder}/${bestAsset}` })
        showSuccess(`AI Matched: ${bestAsset} (Score: ${bestScore})`)
        load()
      } else {
        showInfo('No highly relevant assets found for this template.')
      }
    } catch (err) {
      showError('Failed to run AI Matchmaker')
    } finally {
      setMatching(false)
    }
  }

  if (loading) {
    return <LoadingState label="Loading..." />
  }

  if (error) {
    return <ErrorState title="Error" message={error} onRetry={load} />
  }

  if (!content) {
    return <EmptyState title="Not Found" description="The requested content does not exist." />
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/content')}
        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="aspect-[9/16] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800/50">
            {content.output?.thumbnail ? (
              <img src={`file://${content.output.thumbnail}`} alt={content.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <FileVideo className="h-12 w-12 text-zinc-700" />
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{content.title || 'Untitled'}</h1>
              <div className="mt-2 flex items-center gap-3">
                <StatusBadge status={content.status} size="md" />
                {account && (
                  <span className="text-sm text-zinc-400">{account.name}</span>
                )}
              </div>
            </div>
          </div>

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-300">Status</h3>
              <StatusBadge status={content.status} size="md" />
            </div>
            
            {content.status === 'failed' && content.error && (
              <div className="rounded-md border border-red-900/50 bg-red-950/20 p-3 mt-2">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-red-400 mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Failure Reason
                </h4>
                <p className="text-sm text-red-200">{content.error}</p>
              </div>
            )}
            
            {nextStatuses.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {nextStatuses.map(to => (
                  <Button
                    key={to}
                    variant="secondary"
                    size="sm"
                    disabled={transitioningTo !== null}
                    onClick={() => void handleTransition(to)}
                  >
                    {transitioningTo === to ? 'Moving...' : `Move to ${statusToLabel(to)}`}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No further transitions allowed from this status.</p>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300">Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-zinc-500">ID</span>
                <p className="font-mono text-zinc-300">{content.id}</p>
              </div>
              <div>
                <span className="text-zinc-500">Template</span>
                <p className="text-zinc-300">{content.templateId || 'None'}</p>
              </div>
              <div>
                <span className="text-zinc-500">Resource Path</span>
                <p className="font-mono text-zinc-300 truncate" title={content.resourcePath}>{content.resourcePath || 'None'}</p>
              </div>
              <div>
                <span className="text-zinc-500">Created</span>
                <p className="text-zinc-300">{new Date(content.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <span className="text-zinc-500">Updated</span>
                <p className="text-zinc-300">{new Date(content.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          {content.caption && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-semibold text-zinc-300">Caption</h3>
              <p className="text-sm text-zinc-400 whitespace-pre-wrap">{content.caption}</p>
              {content.hashtags && content.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {content.hashtags.map(tag => (
                    <Badge key={tag} className="px-2 py-0.5 text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card className="p-4 border-indigo-800/30 bg-indigo-950/20">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-300">AI Matchmaker</h3>
                <p className="text-xs text-zinc-500">Automatically find the best asset for this template.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleAiMatchmaker} disabled={matching || !content.templateId}>
                {matching ? <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 animate-pulse" /> Scoring...</span> : <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-400" /> Find Best Asset</span>}
              </Button>
            </div>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="danger"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete content"
        description={`Delete "${content?.title || 'this content'}"? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deleting}
        onConfirm={confirmDeleteContent}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
