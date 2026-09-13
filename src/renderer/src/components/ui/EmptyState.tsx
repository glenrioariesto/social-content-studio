import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-16 text-center', className)}>
      {icon && <div className="mb-2 text-zinc-500">{icon}</div>}
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && <p className="max-w-sm text-xs text-zinc-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}