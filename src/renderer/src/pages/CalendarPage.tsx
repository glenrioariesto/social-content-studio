import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContents } from '@/hooks/useContents'
import { useAccounts } from '@/hooks/useAccounts'
import { useAccountStore } from '@/stores/app-store'
import { ChevronLeft, ChevronRight, AlertTriangle, Plus, Clock, ExternalLink, Calendar as CalendarIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingState } from '@/components/ui/LoadingState'
import { Modal } from '@/components/ui/Modal'
import { Badge, contentStatusVariant } from '@/components/ui/Badge'
import { ContentCreationWizard } from '@/components/ContentCreationWizard'
import { cn } from '@/lib/utils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const ACCOUNT_COLORS: Record<string, string> = {
  'glen-rio-aristo': 'bg-purple-500',
  'jacksonlab': 'bg-blue-500',
  'highproduct': 'bg-emerald-500'
}

const PALETTE = [
  'bg-purple-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-teal-500'
]

function getAccountColor(accountId: string, allAccounts?: { id: string }[]): string {
  if (ACCOUNT_COLORS[accountId]) return ACCOUNT_COLORS[accountId]
  if (allAccounts) {
    const idx = allAccounts.findIndex(a => a.id === accountId)
    if (idx >= 0) return PALETTE[idx % PALETTE.length]
  }
  let hash = 0
  for (let i = 0; i < accountId.length; i++) {
    hash = (hash << 5) - hash + accountId.charCodeAt(i)
    hash |= 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  let startDay = firstDay.getDay() - 1
  if (startDay < 0) startDay = 6
  return { daysInMonth, startDay }
}

function formatScheduledTime(dateStr?: string): string | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  if (!dateStr.includes('T') && !dateStr.includes(':')) return null
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function CalendarPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const { activeAccountId, setActiveAccount } = useAccountStore()
  const { contents, loading: contentsLoading, error: contentsError, reload: reloadContents } = useContents(
    activeAccountId ? { accountId: activeAccountId } : undefined
  )
  const { accounts, loading: accountsLoading, error: accountsError, reload: reloadAccounts } = useAccounts()

  const loading = contentsLoading || accountsLoading
  const error = contentsError || accountsError

  const { daysInMonth, startDay } = useMemo(() => getDaysInMonth(year, month), [year, month])

  const scheduledByDay = useMemo(() => {
    const map: Record<number, typeof contents> = {}
    contents.forEach(c => {
      if (c.scheduledAt) {
        const d = new Date(c.scheduledAt)
        if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate()
          if (!map[day]) map[day] = []
          map[day].push(c)
        }
      }
    })
    // Sort each day chronologically
    Object.values(map).forEach(list => {
      list.sort((a, b) => {
        const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
        const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
        return timeA - timeB
      })
    })
    return map
  }, [contents, year, month])

  const totalScheduledThisMonth = useMemo(() => {
    return Object.values(scheduledByDay).reduce((acc, items) => acc + items.length, 0)
  }, [scheduledByDay])

  const prev = () => {
    if (month === 0) {
      setMonth(11)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  const next = () => {
    if (month === 11) {
      setMonth(0)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const goToToday = () => {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()

  // Full calendar grid: leading nulls + days + trailing nulls to fill complete weeks (multiples of 7)
  const cells = useMemo(() => {
    const list: (number | null)[] = []
    for (let i = 0; i < startDay; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(d)
    const remainder = list.length % 7
    if (remainder !== 0) {
      const padding = 7 - remainder
      for (let p = 0; p < padding; p++) list.push(null)
    }
    return list
  }, [startDay, daysInMonth])

  const activeAccount = accounts.find(a => a.id === activeAccountId)

  const selectedDayItems = selectedDay ? scheduledByDay[selectedDay] || [] : []
  const selectedDateFormatted = selectedDay
    ? new Date(year, month, selectedDay).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    : ''

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {activeAccount
              ? `Filtered by ${activeAccount.name} • ${totalScheduledThisMonth} scheduled in ${MONTHS[month]} ${year}`
              : `${totalScheduledThisMonth} scheduled post${totalScheduledThisMonth === 1 ? '' : 's'} in ${MONTHS[month]} ${year}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            disabled={isCurrentMonth}
            className="h-8 text-xs font-medium"
          >
            Today
          </Button>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={prev}
              aria-label="Previous month"
              title="Previous month"
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[150px] text-center text-sm font-semibold text-zinc-200">
              {MONTHS[month]} {year}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={next}
              aria-label="Next month"
              title="Next month"
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium"
            onClick={() => setShowWizard(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Content
          </Button>
        </div>
      </div>

      {/* Account Filters & Legend */}
      {accounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">Filter:</span>
          <button
            type="button"
            onClick={() => setActiveAccount(null)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
              activeAccountId === null
                ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
            )}
          >
            All Accounts
          </button>
          {accounts.map(acc => {
            const isSelected = activeAccountId === acc.id
            const color = getAccountColor(acc.id, accounts)
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setActiveAccount(isSelected ? null : acc.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors border',
                  isSelected
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', color)} />
                <span>{acc.name}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <Card className="flex items-center justify-between border-amber-800/40 bg-amber-950/20 p-4 text-xs text-amber-200">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void reloadContents()
              void reloadAccounts()
            }}
            className="h-7 border-amber-700/50 text-xs text-amber-200 hover:bg-amber-900/30"
          >
            Retry
          </Button>
        </Card>
      )}

      {/* Empty Month Notice */}
      {!loading && !error && totalScheduledThisMonth === 0 && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-800/60 bg-zinc-900/40 px-4 py-3 text-xs text-zinc-400">
          <span className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-zinc-500" />
            No content scheduled for {MONTHS[month]} {year}
            {activeAccount ? ` for ${activeAccount.name}` : ''}.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowWizard(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Schedule Content
          </Button>
        </div>
      )}

      {/* Main Calendar View */}
      {loading ? (
        <LoadingState label="Loading calendar..." />
      ) : (
        <Card className="overflow-hidden">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-900/50">
            {DAYS.map((d, idx) => (
              <div
                key={d}
                className={cn(
                  'px-3 py-2 text-center text-xs font-semibold',
                  idx >= 5 ? 'text-zinc-500' : 'text-zinc-400'
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const isToday =
                day !== null &&
                day === now.getDate() &&
                month === now.getMonth() &&
                year === now.getFullYear()
              const dayItems = day ? scheduledByDay[day] || [] : []
              const isWeekend = i % 7 === 5 || i % 7 === 6
              const isTrailingOrLeading = day === null

              return (
                <div
                  key={i}
                  className={cn(
                    'min-h-[110px] border-b border-r border-zinc-800/50 p-2 transition-colors',
                    (i + 1) % 7 === 0 && 'border-r-0',
                    isTrailingOrLeading && 'bg-zinc-950/40 opacity-40',
                    !isTrailingOrLeading && isWeekend && 'bg-zinc-900/20',
                    isToday && 'bg-indigo-950/20 ring-1 ring-inset ring-indigo-500/30'
                  )}
                >
                  {day && (
                    <>
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs font-medium',
                            isToday
                              ? 'flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 font-bold text-white shadow-sm'
                              : 'text-zinc-400'
                          )}
                        >
                          {day}
                        </span>

                        {dayItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedDay(day)}
                            className="rounded px-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                            title="View all scheduled items for this date"
                          >
                            {dayItems.length}
                          </button>
                        )}
                      </div>

                      <div className="mt-1.5 space-y-1">
                        {dayItems.slice(0, 3).map(c => {
                          const timeStr = formatScheduledTime(c.scheduledAt)
                          const account = accounts.find(a => a.id === c.accountId)
                          return (
                            <button
                              type="button"
                              key={c.id}
                              onClick={() => navigate(`/content/${c.id}`)}
                              title={`${c.title || c.id}${account ? ` (${account.name})` : ''}${timeStr ? ` at ${timeStr}` : ''}`}
                              className="group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] transition-colors hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 shrink-0 rounded-full',
                                  getAccountColor(c.accountId, accounts)
                                )}
                              />
                              <span className="truncate text-zinc-300 group-hover:text-zinc-100">
                                {c.title || c.id}
                              </span>
                              {timeStr && (
                                <span className="ml-auto shrink-0 text-[9px] text-zinc-500">
                                  {timeStr}
                                </span>
                              )}
                            </button>
                          )
                        })}

                        {dayItems.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setSelectedDay(day)}
                            className="block w-full rounded px-1 text-left text-[10px] font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
                          >
                            +{dayItems.length - 3} more
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Day Details Modal */}
      {selectedDay !== null && (
        <Modal
          open={selectedDay !== null}
          onClose={() => setSelectedDay(null)}
          title={selectedDateFormatted}
        >
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>
                {selectedDayItems.length} scheduled post{selectedDayItems.length === 1 ? '' : 's'}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelectedDay(null)
                  setShowWizard(true)
                }}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Content
              </Button>
            </div>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {selectedDayItems.length === 0 ? (
                <p className="py-6 text-center text-xs text-zinc-500">
                  No content scheduled for this date.
                </p>
              ) : (
                selectedDayItems.map(c => {
                  const account = accounts.find(a => a.id === c.accountId)
                  const timeStr = formatScheduledTime(c.scheduledAt)
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedDay(null)
                        navigate(`/content/${c.id}`)
                      }}
                      className="group flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800/40"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              getAccountColor(c.accountId, accounts)
                            )}
                          />
                          <span className="truncate text-xs font-semibold text-zinc-200 group-hover:text-indigo-300">
                            {c.title || c.id}
                          </span>
                        </div>
                        {c.description && (
                          <p className="line-clamp-2 text-xs text-zinc-400">
                            {c.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 pt-1 text-[11px] text-zinc-500">
                          {account && <span>{account.name}</span>}
                          {timeStr && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {timeStr}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={contentStatusVariant(c.status)}>
                          {c.status}
                        </Badge>
                        <ExternalLink className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300" />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Content Creation Wizard */}
      {showWizard && (
        <ContentCreationWizard
          onClose={() => {
            setShowWizard(false)
            void reloadContents()
          }}
        />
      )}
    </div>
  )
}
