import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { Select } from '@/components/ui/Field'
import { buildStatusOptions, statusToLabel, allowedNextStatuses, type StatusFilterValue } from '@/lib/status-filters'

const STATUS_OPTIONS = buildStatusOptions()

export function ContentPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all')
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

      <div className="flex items-center gap-3">
        <label className="text-sm text-zinc-400">Status</label>
        <Select
          className="w-48"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilterValue)}
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </Select>
        {statusFilter !== 'all' && (
          <p className="text-xs text-zinc-500">
            Can move to: {allowedNextStatuses(statusFilter).map(statusToLabel).join(', ') || '—'}
          </p>
        )}
      </div>

      {loading ? (
        <LoadingState label="Loading content..." />
      ) : error ? (
        <ErrorState
          title="Failed to load content"
          message={error}
          onRetry={() => void reload()}
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
                  onClick={() => navigate(`/content/${content.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
