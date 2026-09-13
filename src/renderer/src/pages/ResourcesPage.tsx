import { useState } from 'react'
import { useResources } from '@/hooks/useResources'
import { Globe, Film, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'

export function ResourcesPage() {
  const { resources, loading, error, reload, download, remove } = useResources()
  const [url, setUrl] = useState('')
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!url.trim()) return
    setDownloading(true)
    const result = await download(url)
    if (result.success) setUrl('')
    setDownloading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resources</h1>
        <p className="mt-1 text-sm text-zinc-400">Download and manage video resources</p>
      </div>

      <Card className="p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDownload()}
              placeholder="Paste video URL (Twitter/X, YouTube, etc.)"
              className="py-2.5"
            />
          </div>
          <Button onClick={handleDownload} disabled={downloading || !url.trim()} className="py-2.5">
            <Globe className="h-4 w-4" />
            {downloading ? 'Downloading...' : 'Download'}
          </Button>
        </div>
      </Card>

      {loading ? (
        <LoadingState label="Loading resources..." />
      ) : error ? (
        <ErrorState
          title="Failed to load resources"
          message={error}
          onRetry={() => void reload()}
        />
      ) : resources.length === 0 ? (
        <EmptyState
          icon={<Film className="h-10 w-10" />}
          title="No resources yet. Download a video to get started."
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {resources.map(resource => (
            <Card key={resource.id} className="overflow-hidden">
              <div className="aspect-video bg-zinc-800/50 flex items-center justify-center">
                <Film className="h-8 w-8 text-zinc-700" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{resource.fileName}</p>
                  <Button
                    onClick={() => void remove(resource.id)}
                    className="rounded p-1 text-zinc-600 hover:bg-transparent hover:text-red-400"
                    aria-label={`Delete ${resource.fileName}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="mt-1 text-xs text-zinc-500">{resource.source}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}