import type { ContentStatus } from '@shared/index'

interface StatusBadgeProps {
  status: ContentStatus
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; dot: string }> = {
  'idea': { label: 'Idea', color: 'bg-zinc-800 text-zinc-400', dot: 'bg-zinc-500' },
  'draft': { label: 'Draft', color: 'bg-amber-950/50 text-amber-400', dot: 'bg-amber-400' },
  'ready': { label: 'Ready', color: 'bg-blue-950/50 text-blue-400', dot: 'bg-blue-400' },
  'rendering': { label: 'Rendering', color: 'bg-purple-950/50 text-purple-400', dot: 'bg-purple-400 animate-pulse' },
  'ready-to-post': { label: 'Ready to Post', color: 'bg-emerald-950/50 text-emerald-400', dot: 'bg-emerald-400' },
  'posted': { label: 'Posted', color: 'bg-green-950/50 text-green-400', dot: 'bg-green-400' },
  'failed': { label: 'Failed', color: 'bg-red-950/50 text-red-400', dot: 'bg-red-400' }
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG['idea']
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}
