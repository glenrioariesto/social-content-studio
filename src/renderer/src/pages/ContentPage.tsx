import { useState } from 'react'
import { useContents } from '@/hooks/useContents'
import { useAccounts } from '@/hooks/useAccounts'
import { useAppStore } from '@/stores/app-store'
import { ContentCard } from '@/components/ContentCard'
import { ContentCreationWizard } from '@/components/ContentCreationWizard'
import type { ContentStatus } from '@shared/index'

const STATUS_FILTERS: Array<{ label: string; value: ContentStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Idea', value: 'idea' },
  { label: 'Draft', value: 'draft' },
  { label: 'Ready', value: 'ready' },
  { label: 'Rendering', value: 'rendering' },
  { label: 'Ready to Post', value: 'ready-to-post' },
  { label: 'Posted', value: 'posted' },
  { label: 'Failed', value: 'failed' }
]

export function ContentPage() {
  const [statusFilter, setStatusFilter] = useState<ContentStatus | 'all'>('all')
  const [showWizard, setShowWizard] = useState(false)
  const { activeAccountId } = useAppStore()
  const { contents, loading } = useContents(
    activeAccountId ? { accountId: activeAccountId } : undefined
  )
  const { accounts } = useAccounts()

  const filtered = statusFilter === 'all'
    ? contents
    : contents.filter(c => c.status === statusFilter)

  const getAccount = (accountId: string) => accounts.find(a => a.id === accountId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {activeAccountId
              ? `Filtered by ${getAccount(activeAccountId)?.name || activeAccountId}`
              : 'All content'
            }
          </p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          + New Content
        </button>
      </div>

      {showWizard && <ContentCreationWizard onClose={() => setShowWizard(false)} />}

      <div className="flex gap-2">
        {STATUS_FILTERS.map(filter => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              statusFilter === filter.value
                ? 'border-indigo-600/50 bg-indigo-950/30 text-indigo-300'
                : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">Loading content...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-sm text-zinc-500">
            {contents.length === 0 ? 'No content yet. Create your first content!' : 'No content matches this filter'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map(content => (
            <ContentCard
              key={content.id}
              content={content}
              account={getAccount(content.accountId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
