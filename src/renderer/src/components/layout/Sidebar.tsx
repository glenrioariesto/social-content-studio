import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileVideo,
  Layers,
  FolderOpen,
  Users,
  Settings,
  Clapperboard,
  CalendarDays
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { divider: 'CONTENT' },
  { to: '/content', icon: FileVideo, label: 'All Content' },
  { divider: 'PRODUCTION' },
  { to: '/templates', icon: Layers, label: 'Templates' },
  { to: '/assets', icon: FolderOpen, label: 'Assets' },
  { to: '/queue', icon: Clapperboard, label: 'Render Queue' },
  { divider: 'DISTRIBUTION' },
  { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { to: '/accounts', icon: Users, label: 'Accounts' },
  { divider: 'SYSTEM' },
  { to: '/settings', icon: Settings, label: 'Settings' }
]

export function Sidebar() {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold">
          SC
        </div>
        <span className="text-sm font-semibold tracking-tight">Social Studio</span>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map((item, i) => {
          if ('divider' in item) {
            return (
              <div key={i} className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                {item.divider}
              </div>
            )
          }
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-zinc-800 px-4 py-3">
        <p className="text-[10px] text-zinc-600">v0.1.0 — Local Studio</p>
      </div>
    </aside>
  )
}
