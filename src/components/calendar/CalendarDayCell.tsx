import type { CalendarEvent } from './calendarTypes'

interface CalendarDayCellProps {
  date: string // YYYY-MM-DD
  events: CalendarEvent[]
  isCurrentMonth: boolean
  isToday: boolean
  isWeekend: boolean
  onClick: () => void
  onEventClick: (event: CalendarEvent) => void
}

const ISSUE_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  epic:    { bg: 'bg-violet-500/20', text: 'text-violet-300' },
  story:   { bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  task:    { bg: 'bg-sky-500/20', text: 'text-sky-300' },
  subtask: { bg: 'bg-slate-500/20', text: 'text-slate-300' },
}

const DEFAULT_GOAL_COLORS = { bg: 'bg-amber-500/20', text: 'text-amber-300' }

const MAX_VISIBLE = 3

export default function CalendarDayCell({
  date,
  events,
  isCurrentMonth,
  isToday,
  isWeekend,
  onClick,
  onEventClick,
}: CalendarDayCellProps) {
  const dayNum = new Date(date + 'T00:00:00').getDate()
  const visibleEvents = events.slice(0, MAX_VISIBLE)
  const overflowCount = events.length - MAX_VISIBLE

  return (
    <div
      className={`min-h-[100px] p-1.5 border-b border-r border-[#2a2a3a] cursor-pointer hover:bg-[#1e1e2a] transition-colors ${
        isWeekend ? 'bg-[#13131d]' : ''
      } ${isToday ? 'bg-amber-500/5' : ''}`}
      onClick={onClick}
    >
      {/* Day number */}
      <div className="mb-1">
        {isToday ? (
          <span className="w-6 h-6 flex items-center justify-center bg-amber-500 text-black rounded-full text-xs font-bold">
            {dayNum}
          </span>
        ) : (
          <span className={`text-xs ${isCurrentMonth ? 'text-[#e4e4ec]' : 'text-[#5a5a6e]'}`}>
            {dayNum}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="flex flex-col gap-0.5">
        {visibleEvents.map(ev => (
          <div
            key={`${ev.type}-${ev.id}`}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation()
              onEventClick(ev)
            }}
          >
            {ev.type === 'schedule' ? (
              <div className="flex items-center gap-1 group">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[10px] text-[#c0c0d0] truncate group-hover:text-[#e4e4ec] transition-colors">
                  {ev.startTime && (
                    <span className="text-[#5a5a6e] mr-0.5">{ev.startTime}</span>
                  )}
                  {ev.title}
                </span>
              </div>
            ) : (
              <div className="group">
                <div
                  className={`h-1 w-full rounded-full ${
                    (ISSUE_TYPE_COLORS[ev.issueType ?? ''] ?? DEFAULT_GOAL_COLORS).bg
                  }`}
                />
                <span
                  className={`text-[10px] truncate block ${
                    (ISSUE_TYPE_COLORS[ev.issueType ?? ''] ?? DEFAULT_GOAL_COLORS).text
                  } group-hover:brightness-125 transition-all`}
                >
                  {ev.title}
                </span>
              </div>
            )}
          </div>
        ))}

        {overflowCount > 0 && (
          <span className="text-[10px] text-[#5a5a6e] pl-0.5">+{overflowCount}件</span>
        )}
      </div>
    </div>
  )
}
