import { useMemo } from 'react'
import CalendarDayCell from './CalendarDayCell'
import {
  getMonthGrid, formatDate, WEEKDAY_LABELS_SHORT,
  buildGoalTree, layoutWeekBands, calcWeekBandsHeight,
} from './calendarUtils'
import type { GoalItem, CalendarEvent, BandSegment } from './calendarTypes'

interface CalendarMonthViewProps {
  anchorDate: string
  events: CalendarEvent[]
  goals: GoalItem[]
  onDateClick: (date: string) => void
  onEventClick: (event: CalendarEvent) => void
  onNavigateToDay: (date: string) => void
}

const LEAF_STYLE: Record<string, { bg: string; borderColor: string; text: string }> = {
  task:    { bg: 'bg-sky-500/20', borderColor: 'border-l-[3px] border-sky-500', text: 'text-sky-300' },
  subtask: { bg: 'bg-slate-500/20', borderColor: 'border-l-[3px] border-slate-400', text: 'text-slate-300' },
  story:   { bg: 'bg-emerald-500/15', borderColor: 'border-l-[3px] border-emerald-500', text: 'text-emerald-300' },
  epic:    { bg: 'bg-violet-500/12', borderColor: 'border-l-[3px] border-violet-500', text: 'text-violet-300' },
}

function BandRenderer({ segment, onEventClick }: { segment: BandSegment; onEventClick: (g: GoalItem) => void }) {
  const style = LEAF_STYLE[segment.issueType] ?? LEAF_STYLE.task
  const tooltipParts = [segment.epicTitle, segment.storyTitle, segment.title].filter(Boolean)
  return (
    <div
      className={`absolute ${style.bg} ${style.borderColor} rounded flex items-center cursor-pointer hover:brightness-125 transition-all overflow-hidden`}
      style={{
        left: `${segment.left}%`,
        width: `${segment.width}%`,
        top: `${segment.top}px`,
        height: `${segment.height}px`,
      }}
      onClick={(e) => { e.stopPropagation(); onEventClick(segment.goal) }}
      title={tooltipParts.join(' / ')}
    >
      <span className={`text-[10px] font-medium px-1.5 truncate ${style.text} flex items-center gap-1`}>
        {segment.epicTitle && <span className="text-[8px] px-1 py-px rounded bg-violet-500/20 text-violet-400/70 shrink-0">{segment.epicTitle}</span>}
        {segment.storyTitle && <span className="opacity-50 shrink-0">{segment.storyTitle} /</span>}
        <span className="truncate">{segment.title}</span>
      </span>
    </div>
  )
}

export default function CalendarMonthView({
  anchorDate,
  events,
  goals,
  onDateClick,
  onEventClick,
  onNavigateToDay: _onNavigateToDay,
}: CalendarMonthViewProps) {
  const year = parseInt(anchorDate.slice(0, 4), 10)
  const month = parseInt(anchorDate.slice(5, 7), 10)
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`

  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const today = useMemo(() => formatDate(new Date()), [])

  // Build goal tree for nested band rendering (exclude timed goals — they go to day cells)
  const bandGoals = useMemo(() => goals.filter(g => !g.scheduled_time), [goals])
  const goalTree = useMemo(() => buildGoalTree(bandGoals), [bandGoals])

  // Build event map by date: schedules + timed goals
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const add = (dateKey: string, ev: CalendarEvent) => {
      const existing = map.get(dateKey) ?? []
      existing.push(ev)
      map.set(dateKey, existing)
    }
    for (const e of events) {
      if (e.type === 'schedule') {
        add(e.date, e)
      } else if (e.type === 'goal' && e.startTime) {
        // Timed goal: show on each day in its date range
        const start = new Date(e.date + 'T00:00:00')
        const end = new Date((e.endDate ?? e.date) + 'T00:00:00')
        const fmt = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          add(fmt(d), e)
        }
      }
    }
    return map
  }, [events])

  const handleGoalClick = (goal: GoalItem) => {
    onEventClick({
      type: 'goal',
      id: goal.id,
      title: goal.title,
      date: goal.start_date,
      endDate: goal.end_date,
      color: goal.color,
      status: goal.status,
      issueType: goal.issue_type,
      original: goal,
    })
  }

  return (
    <div className="bg-[#16161e] rounded-xl shadow-lg border border-[#2a2a3a] overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-[#2a2a3a]">
        {WEEKDAY_LABELS_SHORT.map((label, i) => (
          <div
            key={label}
            className={`text-center py-2 text-xs font-medium ${
              i === 5 ? 'text-blue-400/60' : i === 6 ? 'text-red-400/60' : 'text-[#8b8b9e]'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {grid.map((week, weekIdx) => {
        const weekStart = week[0]
        const weekEnd = week[6]

        // Layout nested bands for this week
        const bands = layoutWeekBands(goalTree, weekStart, weekEnd)
        const bandsHeight = calcWeekBandsHeight(goalTree, weekStart, weekEnd)

        return (
          <div key={weekIdx} className="border-b border-[#2a2a3a] last:border-b-0">
            {/* Nested goal bands overlay area */}
            {bandsHeight > 0 && (
              <div
                className="relative pointer-events-none"
                style={{ height: `${bandsHeight}px` }}
              >
                {bands.map((seg) => (
                  <BandRenderer
                    key={`band-${seg.id}-w${weekIdx}`}
                    segment={seg}
                    onEventClick={handleGoalClick}
                  />
                ))}
              </div>
            )}

            {/* Day cells (schedules only) */}
            <div className="grid grid-cols-7">
              {week.map((dateStr, dayIdx) => {
                const isCurrentMonth = dateStr.startsWith(monthPrefix)
                const isToday = dateStr === today
                const isWeekend = dayIdx === 5 || dayIdx === 6

                const daySchedules = eventsByDate.get(dateStr) ?? []

                return (
                  <CalendarDayCell
                    key={dateStr}
                    date={dateStr}
                    events={daySchedules}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isToday}
                    isWeekend={isWeekend}
                    onClick={() => onDateClick(dateStr)}
                    onEventClick={onEventClick}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
