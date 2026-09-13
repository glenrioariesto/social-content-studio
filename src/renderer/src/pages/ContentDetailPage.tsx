import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileVideo, Trash2 } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { useAccounts } from '@/hooks/useAccounts'
import { useErrorToast } from '@/hooks/useErrorToast'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Content, Account } from '@shared/index'

export function ContentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [content, setContent] = useState<Content | null>(null)
  const [loading, setLoading] = useState(true)
  const { accounts } = useAccounts()
  const { showSuccess, showError } = useErrorToast()

  const account = content ? accounts.find(a => a.id === content.accountId) : null

  useEffect(() => {
    if (!id) return
    setLoading(true)
    window.electron.workspace.getContent(id).then(result => {
      if (result.success && result.data && result.data.kind === 'valid') {
        setContent(result.data.data)
      }
      setLoading(false)
    })
  }, [id])

  const handleDelete = async () => {
    if (!id) return
    // AC-013: destructive action requires explicit confirmation before proceeding.
    const confirmed = window.confirm(`Delete "${content?.title || 'this content'}"? This cannot be undone.`)
    if (!confirmed) return
    const result = await window.electron.workspace.deleteContent(id)
    if (result.success) {
      showSuccess('Content deleted')
      navigate('/content')
    } else {
      showError(result.error ?? 'Failed to delete content')
    }
  }

  if (loading) {
    return <LoadingState label="Loading..." />
  }

  if (!content) {
    return (
      <EmptyState
        icon={<FileVideo className="h-10 w-10" />}
        title="Content not found"
        action={<Button variant="outline" onClick={() => navigate('/content')}>Back to content</Button>}
      />
    )
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
    </div>
  )
}
