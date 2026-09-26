import { useRenderQueue } from '@/hooks/useRenderQueue'
import { useContents } from '@/hooks/useContents'
import { Clapperboard, CheckCircle, XCircle, Clock, Loader, Trash2, X, Folder } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
export function RenderQueuePage() {
  const { jobs, error, loading, reload, cancel, remove, clearFinished } = useRenderQueue()
  const { contents } = useContents()

  const getContentTitle = (id: string) => {
    const c = contents.find(c => c.id === id)
    return c ? c.title : id
  }

  const active = jobs.filter(j => j.status === 'rendering' || j.status === 'waiting')
  const completed = jobs.filter(j => j.status === 'completed')
  const failed = jobs.filter(j => j.status === 'failed')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Render Queue</h1>
          <p className="mt-1 text-sm text-zinc-400">{active.length} active · {completed.length} completed · {failed.length} failed</p>
        </div>
        {(completed.length > 0 || failed.length > 0) && (
          <Button variant="outline" size="sm" onClick={clearFinished} className="text-xs">
            <Trash2 className="h-3.5 w-3.5 mr-2" /> Clear finished
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-amber-800/40 bg-amber-950/20 p-4 text-xs text-amber-200">
          {error}
          <button onClick={() => void reload()} className="ml-2 text-amber-300 underline hover:text-amber-100">Retry</button>
        </Card>
      )}

      {loading ? (
        <LoadingState label="Loading render queue..." />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<Clapperboard className="h-10 w-10" />}
          title="No render jobs yet"
        />
      ) : (
        <div className="space-y-3">
          {active.map(job => (
            <Card key={job.id} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {job.status === 'rendering' ? (
                    <Loader className="h-4 w-4 text-purple-400 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 text-zinc-500" />
                  )}
                  <span className="text-sm font-medium">{getContentTitle(job.contentId)}</span>
                  <Badge>{job.status}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-red-400" onClick={() => cancel(job.id)} title="Cancel Render">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[10px] text-zinc-600">{job.progress}%</p>
            </Card>
          ))}

          {completed.map(job => (
            <Card key={job.id} className="flex items-center justify-between p-4 group">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-4 w-4 text-green-400" />
                <span className="text-sm">{getContentTitle(job.contentId)}</span>
                <span className="text-xs text-zinc-500">Completed</span>
              </div>
              <div className="flex items-center gap-2">
                {job.outputPath && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-zinc-400 hover:text-indigo-400 transition-colors" 
                    onClick={() => window.electron.fs.showInFolder(job.outputPath!)}
                    title="Show in Folder"
                  >
                    <Folder className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity" onClick={() => remove(job.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}

          {failed.map(job => (
            <Card key={job.id} className="flex items-center justify-between border-red-900/30 bg-red-950/20 p-4 group">
              <div className="flex items-center gap-3">
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-sm">{getContentTitle(job.contentId)}</span>
                <span className="text-xs text-red-400">{job.error || 'Failed'}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-300 transition-opacity" onClick={() => remove(job.id)}>
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
