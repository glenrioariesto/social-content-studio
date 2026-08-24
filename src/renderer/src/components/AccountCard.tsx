import { useEffect, useState } from 'react'
import { Users, Layers, Pencil } from 'lucide-react'
import type { Account } from '@shared/index'

/** Loads and renders the account logo image; falls back to the initial letter. */
export function AccountLogo({ accountId, fallback }: { accountId: string; fallback: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    window.electron.account.getLogoUrl(accountId).then(res => {
      if (!cancelled) setUrl(res.success && res.data ? res.data : null)
    })
    return () => { cancelled = true }
  }, [accountId])
  if (url) return <img src={url} alt="" className="h-full w-full object-cover" />
  return <>{fallback}</>
}

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
  onEdit?: () => void
}

export function AccountCard({ account, contentCount = 0, isActive, onClick, onEdit }: AccountCardProps) {
  const colorClass = ACCOUNT_COLORS[account.id] || 'bg-zinc-600'

  return (
    <button
      onClick={onClick}
      className={`group w-full rounded-xl border p-5 text-left transition-all hover:border-zinc-600 ${
        isActive
          ? 'border-indigo-600/50 bg-indigo-950/20'
          : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'
      }`}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg ${colorClass} text-sm font-bold text-white`}>
          {account.branding?.logo ? (
            <AccountLogo accountId={account.id} fallback={account.name.charAt(0)} />
          ) : (
            account.name.charAt(0)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="truncate text-sm font-semibold">{account.name}</h3>
          <p className="text-xs text-zinc-500">{account.id}</p>
        </div>
        {onEdit && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEdit() } }}
            className="rounded p-1.5 text-zinc-500 opacity-0 transition-opacity hover:text-zinc-200 group-hover:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {account.description && (
        <p className="mb-3 line-clamp-2 text-xs text-zinc-400">{account.description}</p>
      )}

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
