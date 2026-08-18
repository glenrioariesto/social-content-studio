import { FolderOpen, FileVideo, Layers, Users } from 'lucide-react'

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-400">Social Content Production Studio</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Accounts', value: '3', icon: Users, color: 'text-indigo-400' },
          { label: 'Contents', value: '0', icon: FileVideo, color: 'text-emerald-400' },
          { label: 'Templates', value: '0', icon: Layers, color: 'text-amber-400' },
          { label: 'Assets', value: '0', icon: FolderOpen, color: 'text-cyan-400' }
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
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Render Queue</h2>
          <p className="text-sm text-zinc-500">No active renders</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-zinc-300">Upcoming Content</h2>
          <p className="text-sm text-zinc-500">Nothing scheduled</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="mb-3 text-sm font-semibold text-zinc-300">Recent Content</h2>
        <p className="text-sm text-zinc-500">No content yet. Create your first content to get started.</p>
      </div>
    </div>
  )
}
