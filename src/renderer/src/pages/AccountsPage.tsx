import { useState } from 'react'
import { useAccounts } from '@/hooks/useAccounts'
import { useContents } from '@/hooks/useContents'
import { useAppStore } from '@/stores/app-store'
import { AccountCard } from '@/components/AccountCard'
import { AccountEditor } from '@/components/AccountEditor'
import type { Account } from '@shared/index'

export function AccountsPage() {
  const { accounts, loading, error, reload } = useAccounts()
  const { contents } = useContents()
  const { activeAccountId, setActiveAccount } = useAppStore()
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
        <button
          onClick={() => { setEditingAccount(null); setEditorOpen(true) }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          + New Account
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">Loading accounts...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-sm text-red-300">Failed to load accounts</p>
          <button onClick={() => void reload()} className="mt-2 text-sm text-indigo-400 hover:text-indigo-300">Retry</button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">No accounts yet. Create your first account!</p>
        </div>
      ) : (
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
      )}

      {activeAccountId && (
        <div className="rounded-xl border border-indigo-800/30 bg-indigo-950/20 p-4">
          <p className="text-sm text-indigo-300">
            Filtering by: <span className="font-semibold">{accounts.find(a => a.id === activeAccountId)?.name}</span>
            <button
              onClick={() => setActiveAccount(null)}
              className="ml-3 text-xs text-indigo-400 underline hover:text-indigo-300"
            >
              Clear filter
            </button>
          </p>
        </div>
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
