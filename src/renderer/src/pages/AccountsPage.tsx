import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAccounts } from '@/hooks/useAccounts'
import { useContents } from '@/hooks/useContents'
import { useAccountStore } from '@/stores/app-store'
import { AccountCard } from '@/components/AccountCard'
import { AccountEditor } from '@/components/AccountEditor'
import { QuarantineCard } from '@/components/QuarantineCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Account } from '@shared/index'

export function AccountsPage() {
  const { accounts, quarantined, loading, error, reload } = useAccounts()
  const { contents } = useContents()
  const { activeAccountId, setActiveAccount } = useAccountStore()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const getContentCount = (accountId: string) =>
    contents.filter(c => c.accountId === accountId).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage your social media accounts</p>
        </div>
        <Button
          onClick={() => { setEditingAccount(null); setEditorOpen(true) }}
        >
          + New Account
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Loading accounts..." />
      ) : error ? (
        <ErrorState title="Failed to load accounts" onRetry={() => void reload()} />
      ) : accounts.length === 0 && quarantined.length === 0 ? (
        <EmptyState title="No accounts yet. Create your first account!" />
      ) : (
        <>
          {quarantined.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-red-300">
                <AlertTriangle className="h-4 w-4" />
                {quarantined.length} broken {quarantined.length === 1 ? 'entry' : 'entries'} (fix the file on disk to recover)
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quarantined.map(entry => (
                  <QuarantineCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                contentCount={getContentCount(account.id)}
                isActive={activeAccountId === account.id}
                onClick={() => setActiveAccount(activeAccountId === account.id ? null : account.id)}
                onEdit={() => { setEditingAccount(account); setEditorOpen(true) }}
              />
            ))}
          </div>
        </>
      )}

      {activeAccountId && (
        <Card className="border-indigo-800/30 bg-indigo-950/20 p-4">
          <p className="text-sm text-indigo-300">
            Filtering by: <span className="font-semibold">{accounts.find(a => a.id === activeAccountId)?.name}</span>
            <button
              onClick={() => setActiveAccount(null)}
              className="ml-3 text-xs text-indigo-400 underline hover:text-indigo-300"
            >
              Clear filter
            </button>
          </p>
        </Card>
      )}

      {editorOpen && (
        <AccountEditor
          account={editingAccount}
          onClose={() => setEditorOpen(false)}
          onSaved={() => void reload()}
        />
      )}
    </div>
  )
}
