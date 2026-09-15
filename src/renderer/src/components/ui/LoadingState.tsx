import { useEffect, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  label?: string
  className?: string
  /**
   * GH-007: after this many ms of loading, offer an escape (error hint + reload)
   * so no page shows an indefinite spinner. Defaults to 10s.
   */
  escapeAfterMs?: number
}

export function LoadingState({ label = 'Loading...', className, escapeAfterMs = 10_000 }: LoadingStateProps) {
  const [stuck, setStuck] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setStuck(true), escapeAfterMs)
    return () => clearTimeout(t)
  }, [escapeAfterMs])

  if (stuck) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-zinc-500', className)}>
        <AlertTriangle className="h-6 w-6 text-amber-500" />
        <p className="text-sm text-zinc-400">
          This is taking longer than expected. {label}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-xs text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
        >
          Reload
        </button>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-zinc-500', className)}>
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-xs">{label}</p>
    </div>
  )
}