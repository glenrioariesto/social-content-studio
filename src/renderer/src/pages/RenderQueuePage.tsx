import { useRenderQueue } from '@/hooks/useRenderQueue'
import { Clapperboard, CheckCircle, XCircle, Clock, Loader } from 'lucide-react'

export function RenderQueuePage() {
  const { jobs } = useRenderQueue()

  const active = jobs.filter(j => j.status === 'rendering' || j.status === 'queued')
  const completed = jobs.filter(j => j.status === 'completed')
  const failed = jobs.filter(j => j.status === 'failed')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Render Queue</h1>
        <p className="mt-1 text-sm text-zinc-400">{active.length} active · {completed.length} completed · {failed.length} failed</p>
      </div>

      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Clapperboard className="mb-3 h-10 w-10 text-zinc-700" />
          <p className="text-sm text-zinc-500">No render jobs yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(job => (
            <div key={job.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {job.status === 'rendering' ? (
                    <Loader className="h-4 w-4 text-purple-400 animate-spin" />
                  ) : (
                    <Clock className="h-4 w-4 text-zinc-500" />
                  )}
                  <span className="text-sm font-medium">{job.contentId}</span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">{job.status}</span>
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
            </div>
          ))}

          {completed.map(job => (
            <div key={job.id} className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <span className="text-sm">{job.contentId}</span>
              <span className="text-xs text-zinc-500">Completed</span>
            </div>
          ))}

          {failed.map(job => (
            <div key={job.id} className="flex items-center gap-3 rounded-xl border border-red-900/30 bg-red-950/20 p-4">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm">{job.contentId}</span>
              <span className="text-xs text-red-400">{job.error || 'Failed'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
