import { AlertTriangle, FileVideo } from 'lucide-react'
import type { QuarantinedEntry } from '@/hooks/useContents'

interface QuarantineCardProps {
  entry: QuarantinedEntry
}

/**
 * Read-only broken-entry card (GH-003 / AC-005). Shows the offending file path
 * and the validation issues. No fabricated defaults are ever displayed.
 */
export function QuarantineCard({ entry }: QuarantineCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-red-800/50 bg-red-950/20">
      <div className="relative aspect-[9/16] bg-zinc-900/60">
        <div className="flex h-full items-center justify-center">
          <FileVideo className="h-8 w-8 text-red-800/60" />
        </div>
        <div className="absolute top-2 left-2 rounded bg-red-900/70 px-1.5 py-0.5 text-[10px] font-medium text-red-200">
          Broken
        </div>
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-300">
          <AlertTriangle className="h-3.5 w-3.5" />
          {entry.id}
        </div>
        <p className="truncate text-[10px] text-zinc-500" title={entry.file}>
          {entry.file}
        </p>
        <ul className="mt-1 space-y-0.5">
          {entry.issues.slice(0, 3).map((issue, i) => (
            <li key={i} className="truncate text-[10px] text-red-400/80" title={`${issue.field}: ${issue.message}`}>
              {issue.field}: {issue.message}
            </li>
          ))}
          {entry.issues.length > 3 && (
            <li className="text-[10px] text-zinc-500">+{entry.issues.length - 3} more</li>
          )}
        </ul>
      </div>
    </div>
  )
}
