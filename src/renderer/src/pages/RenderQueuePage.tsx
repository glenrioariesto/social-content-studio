import { useRenderQueue } from '@/hooks/useRenderQueue'
import { Clapperboard, CheckCircle, XCircle, Clock, Loader } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export function RenderQueuePage() {
  const { jobs, error } = useRenderQueue()

  const active = jobs.filter(j => j.status === 'rendering' || j.status === 'waiting')
  const completed = jobs.filter(j => j.status === 'completed')
  const failed = jobs.filter(j => j.status === 'failed')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Render Queue</h1>
        <p className="mt-1 text-sm text-zinc-400">{active.length} active · {completed.length} completed · {failed.length} failed</p>
      </div>

      {error && (
        <Card className="border-amber-800/40 bg-amber-950/20 p-4 text-xs text-amber-200">
          {error}
        </Card>
      )}

      {jobs.length === 0 ? (
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
                  <span className="text-sm font-medium">{job.contentId}</span>
                  <Badge>{job.status}</Badge>
                </div>
                <span className="text-xs text-zinc-500">{job.id}</span>
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
            <Card key={job.id} className="flex items-center gap-3 p-4">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm">{job.contentId}</span>
              <span className="text-xs text-zinc-500">Completed</span>
            </Card>
          ))}

          {failed.map(job => (
            <Card key={job.id} className="flex items-center gap-3 border-red-900/30 bg-red-950/20 p-4">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm">{job.contentId}</span>
              <span className="text-xs text-red-400">{job.error || 'Failed'}</span>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
