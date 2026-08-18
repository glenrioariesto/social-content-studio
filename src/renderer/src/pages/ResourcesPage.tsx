import { useState } from 'react'
import { useResources } from '@/hooks/useResources'
import { Globe, Upload, Trash2, Film } from 'lucide-react'

export function ResourcesPage() {
  const { resources, loading, download } = useResources()
  const [url, setUrl] = useState('')
  const [downloading, setDownloading] = useState(false)

  const handleDownload = async () => {
    if (!url.trim()) return
    setDownloading(true)
    await download(url)
    setUrl('')
    setDownloading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resources</h1>
        <p className="mt-1 text-sm text-zinc-400">Download and manage video resources</p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDownload()}
              placeholder="Paste video URL (Twitter/X, YouTube, etc.)"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading || !url.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            <Globe className="h-4 w-4" />
            {downloading ? 'Downloading...' : 'Download'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">Loading resources...</p>
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Film className="mb-3 h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">No resources yet. Download a video to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {resources.map(resource => (
            <div key={resource.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
              <div className="aspect-video bg-zinc-800/50 flex items-center justify-center">
                <Film className="h-8 w-8 text-zinc-700" />
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{resource.fileName}</p>
                <p className="mt-1 text-xs text-zinc-500">{resource.source}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
