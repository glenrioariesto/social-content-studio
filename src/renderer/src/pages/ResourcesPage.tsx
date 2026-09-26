import { useState } from 'react'
import { useResources } from '@/hooks/useResources'
import { Globe, Film, Trash2, X, Play } from 'lucide-react'
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
  const [previewResource, setPreviewResource] = useState<any>(null)
  const handleDownload = async () => {
    if (!url.trim()) return
    setDownloading(true)
    const result = await download(url)
    if (result.success) setUrl('')
    setDownloading(false)
  }

  return (
    <>
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
            <Card 
              key={resource.id} 
              className="overflow-hidden cursor-pointer hover:border-zinc-500 transition-colors group"
              onClick={() => setPreviewResource(resource)}
            >
              <div className="relative aspect-video bg-zinc-800/50 flex items-center justify-center">
                <Film className="h-8 w-8 text-zinc-700 group-hover:opacity-0 transition-opacity" />
                <Play className="h-10 w-10 text-white absolute opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{resource.fileName}</p>
                  <Button
                    onClick={(e) => { e.stopPropagation(); void remove(resource.id) }}
                    className="rounded p-1 text-zinc-600 hover:bg-transparent hover:text-red-400 z-10"
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

      {previewResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setPreviewResource(null)}>
          <div className="relative w-full max-w-4xl rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <h3 className="font-semibold text-zinc-200 truncate pr-4">{previewResource.fileName}</h3>
              <button
                onClick={() => setPreviewResource(null)}
                className="rounded p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-black aspect-video flex items-center justify-center relative">
              {previewResource.filePath ? (
                <video 
                  src={`file://${previewResource.filePath.replace(/\\/g, '/')}`} 
                  controls 
                  autoPlay 
                  className="w-full h-full"
                  onError={(e) => {
                     console.error("Video failed to load:", e);
                     // If video fails, it might be corrupt or an unsupported codec by Chromium
                  }}
                />
              ) : (
                <div className="text-zinc-500 flex flex-col items-center gap-2">
                   <Film className="h-12 w-12 opacity-50" />
                   <p>File path is missing</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
  )
}