import { useEffect } from 'react'
import { useApi } from '../../hooks/useApi'
import type { ScheduleItem, GoalItem, CalendarEvent } from './calendarTypes'
import { mergeEvents } from './calendarUtils'

interface CalendarDayPopupProps {
  date: string
  onClose: () => void
  onEventClick: (event: CalendarEvent) => void
  onNewSchedule: (date: string) => void
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export default function CalendarDayPopup({ date, onClose, onEventClick, onNewSchedule }: CalendarDayPopupProps) {
  const { data: schedules } = useApi<ScheduleItem[]>(`/api/schedules?date=${date}`)
  const { data: goals } = useApi<GoalItem[]>(`/api/goals?from=${date}&to=${date}`)

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const nonHabitSchedules = (schedules ?? []).filter(s => s.source !== 'habit')
  const events = mergeEvents(nonHabitSchedules, goals)

  // Split into timed and untimed
  const timed = events.filter(e => e.startTime).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
  const untimed = events.filter(e => !e.startTime)

  // Format date header
  const d = new Date(date + 'T00:00:00')
  const dayLabel = `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_LABELS[d.getDay()]}）`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#16161e] rounded-2xl shadow-2xl border border-[#2a2a3a] w-full max-w-sm max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a]">
          <h3 className="text-base font-bold text-[#e4e4ec]">{dayLabel}</h3>
          <button onClick={onClose} className="text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {events.length === 0 ? (
            <p className="text-[#5a5a6e] text-sm text-center py-6">予定はありません</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* Timed events */}
              {timed.map(ev => (
                <button
                  key={`${ev.type}-${ev.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#1e1e2a] transition-colors text-left w-full"
                  onClick={() => onEventClick(ev)}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ev.type === 'schedule' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                  <span className="text-[#5a5a6e] text-xs font-mono w-12 shrink-0">
                    {ev.startTime}
                  </span>
                  <span className="text-sm text-[#c0c0d0] truncate">{ev.title}</span>
                  {ev.endTime && (
                    <span className="text-[10px] text-[#5a5a6e] ml-auto shrink-0">~{ev.endTime}</span>
                  )}
                </button>
              ))}

              {/* Untimed events */}
              {untimed.length > 0 && timed.length > 0 && (
                <div className="border-t border-[#2a2a3a] my-1" />
              )}
              {untimed.map(ev => (
                <button
                  key={`${ev.type}-${ev.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[#1e1e2a] transition-colors text-left w-full"
                  onClick={() => onEventClick(ev)}
                >
                  <span className={`w-2 h-2 shrink-0 ${ev.type === 'schedule' ? 'rounded-full bg-amber-400' : 'rounded-sm bg-sky-400'}`} />
                  <span className="text-sm text-[#c0c0d0] truncate">{ev.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#2a2a3a]">
          <button
            onClick={() => onNewSchedule(date)}
            className="w-full py-2 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors"
          >
            ＋ 新規作成
          </button>
        </div>
      </div>
    </div>
  )
}
