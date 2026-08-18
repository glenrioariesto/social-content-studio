import { useAccounts } from '@/hooks/useAccounts'
import { useContents } from '@/hooks/useContents'
import { useAppStore } from '@/stores/app-store'
import { AccountCard } from '@/components/AccountCard'

export function AccountsPage() {
  const { accounts, loading } = useAccounts()
  const { contents } = useContents()
  const { activeAccountId, setActiveAccount } = useAppStore()

  const getContentCount = (accountId: string) =>
    contents.filter(c => c.accountId === accountId).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="mt-1 text-sm text-zinc-400">Manage your social media accounts</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">Loading accounts...</p>
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-zinc-500">No accounts found</p>
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
    </div>
  )
}
