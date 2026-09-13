import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useContents } from '@/hooks/useContents'
import { useAccounts } from '@/hooks/useAccounts'
import { useAccountStore } from '@/stores/app-store'
import { ContentCard } from '@/components/ContentCard'
import { QuarantineCard } from '@/components/QuarantineCard'
import { ContentCreationWizard } from '@/components/ContentCreationWizard'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
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
  const { activeAccountId } = useAccountStore()
  const { contents, loading, error, quarantined, reload } = useContents(
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
        <Button onClick={() => setShowWizard(true)}>+ New Content</Button>
      </div>

      {showWizard && (
        <ContentCreationWizard onClose={() => { setShowWizard(false); void reload() }} />
      )}

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
        <LoadingState label="Loading content..." />
      ) : error ? (
        <ErrorState
          title="Failed to load content"
          message={error}
          onRetry={() => window.location.reload()}
        />
      ) : (
        <>
          {quarantined.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-300">
                <AlertTriangle className="h-4 w-4" />
                {quarantined.length} broken {quarantined.length === 1 ? 'entry' : 'entries'} (fix the file on disk to recover)
              </h3>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {quarantined.map(entry => (
                  <QuarantineCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState title={
              contents.length === 0 && quarantined.length === 0
                ? 'No content yet. Create your first content!'
                : 'No content matches this filter'
            } />
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
        </>
      )}
    </div>
  )
}
