import { Users, Layers } from 'lucide-react'
import type { Account } from '@shared/index'

const ACCOUNT_COLORS: Record<string, string> = {
  'glen-rio-aristo': 'bg-purple-600',
  'jacksonlab': 'bg-blue-600',
  'highproduct': 'bg-emerald-600'
}

const WORKFLOW_LABELS: Record<string, string> = {
  'manual-video': 'Manual Video',
  'internet-video': 'Internet Video',
  'product-video': 'Product Video'
}

interface AccountCardProps {
  account: Account
  contentCount?: number
  isActive?: boolean
  onClick?: () => void
}

export function AccountCard({ account, contentCount = 0, isActive, onClick }: AccountCardProps) {
  const colorClass = ACCOUNT_COLORS[account.id] || 'bg-zinc-600'

  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border p-5 text-left transition-all hover:border-zinc-600 ${
        isActive
          ? 'border-indigo-600/50 bg-indigo-950/20'
          : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass} text-sm font-bold text-white`}>
          {account.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-semibold">{account.name}</h3>
          <p className="text-xs text-zinc-500">{account.id}</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(account.workflows || []).map(w => (
          <span key={w} className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[10px] text-zinc-400">
            {WORKFLOW_LABELS[w] || w}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <Layers className="h-3 w-3" />
          {(account.templates || []).length} templates
        </span>
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3" />
          {contentCount} contents
        </span>
      </div>

      {account.branding?.watermark && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <span className="text-[10px] text-zinc-600">Watermark: {account.branding.watermark}</span>
        </div>
      )}
    </button>
  )
}
