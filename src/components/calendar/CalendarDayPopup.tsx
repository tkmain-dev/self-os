import { useEffect, useCallback } from 'react'
import { useApi } from '../../hooks/useApi'
import type { ScheduleItem, GoalItem, CalendarEvent, RoutineItem } from './calendarTypes'
import { mergeEvents } from './calendarUtils'

interface CalendarDayPopupProps {
  date: string
  onClose: () => void
  onEventClick: (event: CalendarEvent) => void
  onNewSchedule: (date: string) => void
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

// Timeline constants (same as DailyPage)
const HOUR_HEIGHT = 48
const START_HOUR = 6
const END_HOUR = 25
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

function timeToGridMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const minutes = h * 60 + m
  if (h < START_HOUR) return minutes + 24 * 60
  return minutes
}

function addMinutesToTime(time: string, duration: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + duration
  const wrapped = total >= 24 * 60 ? total - 24 * 60 : total
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

const COLORS = [
  'bg-amber-500/10 border-amber-500 text-amber-300',
  'bg-slate-500/10 border-slate-400 text-slate-300',
  'bg-orange-500/10 border-orange-500 text-orange-300',
  'bg-yellow-500/10 border-yellow-500 text-yellow-300',
  'bg-lime-500/10 border-lime-500 text-lime-300',
  'bg-emerald-500/10 border-emerald-500 text-emerald-300',
]

interface TimelineItem {
  id: string
  title: string
  start_time: string | null
  end_time: string | null
  source: 'schedule' | 'goal'
}

export default function CalendarDayPopup({ date, onClose, onEventClick, onNewSchedule }: CalendarDayPopupProps) {
  const { data: schedules } = useApi<ScheduleItem[]>(`/api/schedules?date=${date}`)
  const { data: goals } = useApi<GoalItem[]>(`/api/goals?from=${date}&to=${date}`)
  const dateDay = new Date(date + 'T00:00:00').getDay()
  const { data: routines } = useApi<RoutineItem[]>(`/api/routines?day=${dateDay}`)

  const isToday = date === new Date().toISOString().split('T')[0]

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const nonHabitSchedules = (schedules ?? []).filter(s => s.source !== 'habit')
  const events = mergeEvents(nonHabitSchedules, goals)

  // Timed items for timeline
  const timedSchedules = nonHabitSchedules.filter(s => s.start_time)
  const timedGoals: TimelineItem[] = (goals ?? [])
    .filter(g => g.scheduled_time && (g.issue_type === 'task' || g.issue_type === 'subtask'))
    .map(g => ({
      id: `g-${g.id}`,
      title: g.title,
      start_time: g.scheduled_time,
      end_time: addMinutesToTime(g.scheduled_time!, g.scheduled_duration ?? 60),
      source: 'goal' as const,
    }))

  const allTimedItems: TimelineItem[] = [
    ...timedSchedules.map(s => ({
      id: `s-${s.id}`,
      title: s.title,
      start_time: s.start_time,
      end_time: s.end_time,
      source: 'schedule' as const,
    })),
    ...timedGoals,
  ]

  const untimedSchedules = nonHabitSchedules.filter(s => !s.start_time)

  // Current time indicator
  const now = new Date()
  const rawMinutes = now.getHours() * 60 + now.getMinutes()
  const currentMinutes = rawMinutes < START_HOUR * 60 ? rawMinutes + 24 * 60 : rawMinutes
  const nowLineTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT

  // Find event by click on timeline item
  const handleTimelineItemClick = useCallback((item: TimelineItem) => {
    const ev = events.find(e => `${e.type === 'schedule' ? 's' : 'g'}-${e.id}` === item.id)
    if (ev) onEventClick(ev)
  }, [events, onEventClick])

  // Format date header
  const d = new Date(date + 'T00:00:00')
  const dayLabel = `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_LABELS[d.getDay()]}）`

  const routinesList = routines ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#0e0e12] rounded-2xl shadow-2xl border border-[#2a2a3a] w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3a] shrink-0">
          <h3 className="text-base font-bold text-[#e4e4ec]">{dayLabel}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNewSchedule(date)}
              className="text-xs bg-amber-500 text-black font-semibold px-3 py-1 rounded-lg hover:bg-amber-400 transition-colors"
            >
              + 追加
            </button>
            <button onClick={onClose} className="text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-xl leading-none">&times;</button>
          </div>
        </div>

        {/* Body — scrollable timeline */}
        <div className="flex-1 overflow-y-auto">
          {/* Untimed events */}
          {untimedSchedules.length > 0 && (
            <div className="px-4 py-2 space-y-1 border-b border-[#2a2a3a]">
              {untimedSchedules.map((s, i) => {
                const ev = events.find(e => e.type === 'schedule' && e.id === s.id)
                return (
                  <button
                    key={s.id}
                    className={`${COLORS[i % COLORS.length]} border-l-4 rounded px-2 py-1 text-xs w-full text-left truncate hover:brightness-125 transition-all`}
                    onClick={() => ev && onEventClick(ev)}
                  >
                    {s.title}
                  </button>
                )
              })}
            </div>
          )}

          {/* Timeline grid */}
          <div className="bg-[#16161e] rounded-b-2xl overflow-hidden">
            <div className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
              {/* Hour lines */}
              {HOURS.map(h => {
                const displayH = h >= 24 ? h - 24 : h
                const isMidnight = h === 24
                return (
                  <div key={h} className="absolute w-full border-t border-[#1f1f2e] flex"
                    style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                    {isMidnight && <div className="absolute left-0 right-0 top-0 border-t border-dashed border-[#3a3a4e]" />}
                    <div className={`w-11 pr-1 pt-0.5 text-right text-[10px] shrink-0 select-none ${h >= 24 ? 'text-[#4a4a5e]' : 'text-[#5a5a6e]'}`}>
                      {h >= 24 && <span className="text-[8px] text-[#3a3a4e]">翌</span>}
                      {String(displayH).padStart(2, '0')}:00
                    </div>
                    <div className="flex-1 border-l border-[#2a2a3a]" />
                  </div>
                )
              })}

              {/* Routine background blocks */}
              {routinesList.map(routine => {
                const startMin = timeToGridMinutes(routine.start_time)
                const endMin = timeToGridMinutes(routine.end_time)
                const topPx = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
                const heightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT
                return (
                  <div
                    key={`routine-${routine.id}`}
                    className="absolute left-11 right-0 z-[1] pointer-events-none"
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                  >
                    <div className="h-full mx-0.5 rounded-md border border-dashed border-teal-500/20 bg-teal-500/5">
                      <span className="text-[9px] text-teal-400/30 font-medium px-2 pt-0.5 block truncate select-none">
                        {routine.name}
                      </span>
                    </div>
                  </div>
                )
              })}

              {/* Current time indicator */}
              {isToday && currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60 && (
                <div className="absolute left-11 right-0 z-20 flex items-center pointer-events-none"
                  style={{ top: `${nowLineTop}px` }}>
                  <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              )}

              {/* Timed events */}
              {allTimedItems.map((item, i) => {
                if (!item.start_time) return null
                const startMin = timeToGridMinutes(item.start_time)
                const endMin = item.end_time ? timeToGridMinutes(item.end_time) : startMin + 60
                const topPx = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
                const heightPx = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22)
                const isGoal = item.source === 'goal'
                const colorClass = isGoal
                  ? 'bg-sky-500/10 border-sky-500 text-sky-300'
                  : COLORS[i % COLORS.length]
                return (
                  <button
                    key={item.id}
                    className={`absolute left-12 right-1 z-10 ${colorClass} border-l-4 rounded px-2 py-0.5 overflow-hidden text-left hover:brightness-125 transition-all`}
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                    onClick={() => handleTimelineItemClick(item)}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate flex items-center gap-1">
                        {isGoal && <span className="text-[8px] px-1 py-px rounded bg-sky-500/20 text-sky-400/70 shrink-0">WBS</span>}
                        {item.title}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {item.start_time}{item.end_time ? ` - ${item.end_time}` : ''}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
