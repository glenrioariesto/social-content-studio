import { useContents } from '@/hooks/useContents'
import { useAccounts } from '@/hooks/useAccounts'
import { useTemplates } from '@/hooks/useTemplates'
import { useAppStore } from '@/stores/app-store'
import { FolderOpen, FileVideo, Layers, Users, ArrowRight, Zap, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const { accounts } = useAccounts()
  const { contents } = useContents()
  const { templates } = useTemplates()
  const { setActiveAccount } = useAppStore()
  const navigate = useNavigate()

  const statusCounts = contents.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const recentContent = [...contents]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  const scheduledCount = contents.filter(c => c.scheduledAt && new Date(c.scheduledAt) > new Date()).length

  const getStatusDot = (status: string) => {
    const colors: Record<string, string> = {
      'idea': 'bg-zinc-500',
      'draft': 'bg-amber-500',
      'ready': 'bg-cyan-500',
      'rendering': 'bg-indigo-500',
      'ready-to-post': 'bg-emerald-500',
      'posted': 'bg-green-500',
      'failed': 'bg-red-500'
    }
    return colors[status] || 'bg-zinc-500'
  }

  const getAccountColor = (id: string) => {
    const colors: Record<string, string> = {
      'glen-rio-aristo': 'bg-purple-500',
      'jacksonlab': 'bg-blue-500',
      'highproduct': 'bg-emerald-500'
    }
    return colors[id] || 'bg-zinc-500'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Social Content Production Studio</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Accounts', value: accounts.length, icon: Users, color: 'text-indigo-400' },
          { label: 'Contents', value: contents.length, icon: FileVideo, color: 'text-emerald-400' },
          { label: 'Templates', value: templates.length, icon: Layers, color: 'text-amber-400' },
          { label: 'Scheduled', value: scheduledCount, icon: Calendar, color: 'text-cyan-400' },
          { label: 'Failed', value: statusCounts['failed'] || 0, icon: FolderOpen, color: 'text-red-400' }
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

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">Status Overview</h2>
          </div>
          <div className="space-y-2">
            {(['idea', 'draft', 'ready', 'rendering', 'ready-to-post', 'posted', 'failed'] as const).map(status => (
              <div key={status} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${getStatusDot(status)}`} />
                  <span className="text-zinc-400 capitalize">{status.replace('-', ' ')}</span>
                </div>
                <span className="font-mono text-zinc-500">{statusCounts[status] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">Accounts</h2>
            <div className="space-y-2">
              {accounts.map(account => {
                const count = contents.filter(c => c.accountId === account.id).length
                return (
                  <button
                    key={account.id}
                    onClick={() => { setActiveAccount(account.id); navigate('/content') }}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${getAccountColor(account.id)}`} />
                      <span className="text-sm text-zinc-300">{account.name}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="mb-3 text-sm font-semibold text-zinc-300">Quick Actions</h2>
            <div className="space-y-1">
              {[
                { label: 'New Content', path: '/content', icon: FileVideo },
                { label: 'Batch Render', path: '/batch', icon: Zap },
                { label: 'Templates', path: '/templates', icon: Layers }
              ].map(action => (
                <button
                  key={action.path}
                  onClick={() => navigate(action.path)}
                  className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200"
                >
                  <action.icon className="h-3.5 w-3.5" />
                  <span>{action.label}</span>
                  <ArrowRight className="ml-auto h-3 w-3 text-zinc-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">Recent Activity</h2>
          <button onClick={() => navigate('/content')} className="text-xs text-zinc-500 hover:text-zinc-300">
            View all →
          </button>
        </div>
        {recentContent.length === 0 ? (
          <p className="text-sm text-zinc-500">No content yet. Create your first content to get started.</p>
        ) : (
          <div className="space-y-2">
            {recentContent.map(content => (
              <button
                key={content.id}
                onClick={() => navigate(`/content/${content.id}`)}
                className="flex w-full items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-zinc-800/50"
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${getStatusDot(content.status)}`} />
                  <div>
                    <p className="text-sm text-zinc-300">{content.title || content.id}</p>
                    <p className="text-xs text-zinc-600">{content.accountId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 capitalize">{content.status.replace('-', ' ')}</p>
                  <p className="text-[10px] text-zinc-600">
                    {new Date(content.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
