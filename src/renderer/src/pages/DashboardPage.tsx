import { useContents } from '@/hooks/useContents'
import { useAccounts } from '@/hooks/useAccounts'
import { useAppStore } from '@/stores/app-store'
import { FolderOpen, FileVideo, Layers, Users } from 'lucide-react'

export function DashboardPage() {
  const { accounts } = useAccounts()
  const { contents } = useContents()
  const { setActiveAccount } = useAppStore()

  const statusCounts = contents.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Social Content Production Studio</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Accounts', value: accounts.length, icon: Users, color: 'text-indigo-400' },
          { label: 'Contents', value: contents.length, icon: FileVideo, color: 'text-emerald-400' },
          { label: 'Drafts', value: statusCounts['draft'] || 0, icon: Layers, color: 'text-amber-400' },
          { label: 'Ready', value: (statusCounts['ready'] || 0) + (statusCounts['ready-to-post'] || 0), icon: FolderOpen, color: 'text-cyan-400' }
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Status Overview</h2>
          <div className="space-y-2">
            {(['idea', 'draft', 'ready', 'rendering', 'ready-to-post', 'posted', 'failed'] as const).map(status => (
              <div key={status} className="flex items-center justify-between text-sm">
                <span className="text-zinc-400 capitalize">{status.replace('-', ' ')}</span>
                <span className="font-mono text-zinc-500">{statusCounts[status] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Accounts</h2>
          <div className="space-y-3">
            {accounts.map(account => {
              const count = contents.filter(c => c.accountId === account.id).length
              return (
                <button
                  key={account.id}
                  onClick={() => setActiveAccount(account.id)}
                  className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-zinc-800/50"
                >
                  <span className="text-sm text-zinc-300">{account.name}</span>
                  <span className="text-xs text-zinc-500">{count} contents</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Recent Content</h2>
        {contents.length === 0 ? (
          <p className="text-sm text-zinc-500">No content yet. Create your first content to get started.</p>
        ) : (
          <div className="space-y-2">
            {contents.slice(0, 5).map(content => (
              <div key={content.id} className="flex items-center justify-between rounded-lg p-2">
                <span className="text-sm text-zinc-300">{content.title || content.id}</span>
                <span className="text-xs text-zinc-500">{content.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
