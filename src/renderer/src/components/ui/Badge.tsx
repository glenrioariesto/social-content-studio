import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { ContentStatus } from '@shared/index'

const badgeVariants = cva('inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium', {
  variants: {
    variant: {
      default: 'bg-zinc-800 text-zinc-400',
      indigo: 'bg-indigo-950/50 text-indigo-300',
      amber: 'bg-amber-950/50 text-amber-300',
      cyan: 'bg-cyan-950/50 text-cyan-300',
      blue: 'bg-blue-950/50 text-blue-300',
      purple: 'bg-purple-950/50 text-purple-300',
      emerald: 'bg-emerald-950/50 text-emerald-300',
      green: 'bg-green-950/50 text-green-300',
      red: 'bg-red-950/50 text-red-300'
    }
  },
  defaultVariants: {
    variant: 'default'
  }
})

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

const CONTENT_STATUS_VARIANT: Record<ContentStatus, NonNullable<VariantProps<typeof badgeVariants>['variant']>> = {
  'idea': 'default',
  'draft': 'amber',
  'ready': 'blue',
  'rendering': 'purple',
  'ready-to-post': 'emerald',
  'posted': 'green',
  'failed': 'red'
}

export function contentStatusVariant(status: ContentStatus): NonNullable<VariantProps<typeof badgeVariants>['variant']> {
  return CONTENT_STATUS_VARIANT[status] ?? 'default'
}