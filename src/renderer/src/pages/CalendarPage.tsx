import { useState, useMemo } from 'react'
import { useContents } from '@/hooks/useContents'
import { useAccounts } from '@/hooks/useAccounts'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  let startDay = firstDay.getDay() - 1
  if (startDay < 0) startDay = 6
  return { daysInMonth, startDay }
}

export function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const { contents } = useContents()
  const { accounts } = useAccounts()

  const { daysInMonth, startDay } = useMemo(() => getDaysInMonth(year, month), [year, month])

  const scheduledByDay = useMemo(() => {
    const map: Record<number, typeof contents> = {}
    contents.forEach(c => {
      if (c.scheduledAt) {
        const d = new Date(c.scheduledAt)
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate()
          if (!map[day]) map[day] = []
          map[day].push(c)
        }
      }
    })
    return map
  }, [contents, year, month])

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const getAccountColor = (accountId: string) => {
    const colors: Record<string, string> = {
      'glen-rio-aristo': 'bg-purple-500',
      'jacksonlab': 'bg-blue-500',
      'highproduct': 'bg-emerald-500'
    }
    return colors[accountId] || 'bg-zinc-500'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-400">Content schedule overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={prev} className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold">
            {MONTHS[month]} {year}
          </span>
          <button onClick={next} className="rounded-lg border border-zinc-800 p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-800">
          {DAYS.map(d => (
            <div key={d} className="px-3 py-2 text-center text-xs font-semibold text-zinc-500">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => (
            <div
              key={i}
              className={`min-h-[100px] border-b border-r border-zinc-800/50 p-2 ${
                day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
                  ? 'bg-indigo-950/20'
                  : ''
              }`}
            >
              {day && (
                <>
                  <span className={`text-xs ${
                    day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
                      ? 'font-bold text-indigo-400'
                      : 'text-zinc-500'
                  }`}>
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {(scheduledByDay[day] || []).slice(0, 3).map(c => (
                      <div key={c.id} className="flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${getAccountColor(c.accountId)}`} />
                        <span className="truncate text-[10px] text-zinc-400">{c.title || c.id}</span>
                      </div>
                    ))}
                    {(scheduledByDay[day] || []).length > 3 && (
                      <span className="text-[10px] text-zinc-600">+{(scheduledByDay[day] || []).length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
