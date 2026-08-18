import { FileVideo } from 'lucide-react'
import type { Content, Account } from '@shared/index'
import { StatusBadge } from './StatusBadge'

const ACCOUNT_COLORS: Record<string, string> = {
  'glen-rio-aristo': 'text-purple-400',
  'jacksonlab': 'text-blue-400',
  'highproduct': 'text-emerald-400'
}

interface ContentCardProps {
  content: Content
  account?: Account
  onClick?: () => void
}

export function ContentCard({ content, account, onClick }: ContentCardProps) {
  const accountColor = ACCOUNT_COLORS[content.accountId] || 'text-zinc-400'

  return (
    <button
      onClick={onClick}
      className="group w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 text-left transition-all hover:border-zinc-600 hover:bg-zinc-900"
    >
      <div className="relative aspect-[9/16] bg-zinc-800/50">
        {content.output?.thumbnail ? (
          <img
            src={`file://${content.output.thumbnail}`}
            alt={content.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileVideo className="h-8 w-8 text-zinc-700" />
          </div>
        )}

        <div className="absolute top-2 left-2">
          <StatusBadge status={content.status} />
        </div>

        {content.output?.video && (
          <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
            Video ready
          </div>
        )}
      </div>

      <div className="p-3">
        <h4 className="truncate text-sm font-medium group-hover:text-zinc-100">{content.title || 'Untitled'}</h4>
        <div className="mt-1 flex items-center gap-2">
          <span className={`text-xs ${accountColor}`}>
            {account?.name || content.accountId}
          </span>
          {content.templateId && (
            <span className="text-xs text-zinc-600">
              · {content.templateId}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
