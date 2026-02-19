import { useMemo } from 'react'
import CalendarDayCell from './CalendarDayCell'
import {
  getMonthGrid, formatDate, diffDays, WEEKDAY_LABELS_SHORT,
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

// Depth-based styling for nested bands
const BAND_STYLES: Record<number, { bg: string; border: string; text: string; textSize: string }> = {
  0: {
    bg: 'bg-violet-500/[0.04]',
    border: 'border border-violet-500/[0.10]',
    text: 'text-violet-400/30',
    textSize: 'text-[8px]',
  },
  1: {
    bg: 'bg-emerald-500/[0.08]',
    border: 'border border-emerald-500/[0.14]',
    text: 'text-emerald-400/40',
    textSize: 'text-[9px]',
  },
}

const LEAF_STYLE: Record<string, { bg: string; borderColor: string; text: string }> = {
  task:    { bg: 'bg-sky-500/20', borderColor: 'border-l-[3px] border-sky-500', text: 'text-sky-300' },
  subtask: { bg: 'bg-slate-500/20', borderColor: 'border-l-[3px] border-slate-400', text: 'text-slate-300' },
  story:   { bg: 'bg-emerald-500/15', borderColor: 'border-l-[3px] border-emerald-500', text: 'text-emerald-300' },
  epic:    { bg: 'bg-violet-500/12', borderColor: 'border-l-[3px] border-violet-500', text: 'text-violet-300' },
}

function BandRenderer({ segment, onEventClick }: { segment: BandSegment; onEventClick: (g: GoalItem) => void }) {
  const isLeaf = !segment.hasChildren

  if (isLeaf) {
    // Leaf node: solid bar with text
    const style = LEAF_STYLE[segment.issueType] ?? LEAF_STYLE.task
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
        title={segment.title}
      >
        <span className={`text-[10px] font-medium px-1.5 truncate ${style.text}`}>
          {segment.title}
        </span>
      </div>
    )
  }

  // Parent node: container band
  const depthStyle = BAND_STYLES[segment.depth] ?? BAND_STYLES[1]
  return (
    <div
      className={`absolute ${depthStyle.bg} ${depthStyle.border} rounded-md cursor-pointer hover:brightness-110 transition-all overflow-hidden`}
      style={{
        left: `${segment.left}%`,
        width: `${segment.width}%`,
        top: `${segment.top}px`,
        height: `${segment.height}px`,
      }}
      onClick={(e) => { e.stopPropagation(); onEventClick(segment.goal) }}
      title={segment.title}
    >
      {/* Tiny title label at top-left for parent containers */}
      <span className={`absolute top-0 left-1 ${depthStyle.textSize} ${depthStyle.text} truncate pointer-events-none`}
        style={{ maxWidth: '90%' }}
      >
        {segment.title}
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
  onNavigateToDay,
}: CalendarMonthViewProps) {
  const year = parseInt(anchorDate.slice(0, 4), 10)
  const month = parseInt(anchorDate.slice(5, 7), 10)
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`

  const grid = useMemo(() => getMonthGrid(year, month), [year, month])
  const today = useMemo(() => formatDate(new Date()), [])

  // Build goal tree for nested band rendering
  const goalTree = useMemo(() => buildGoalTree(goals), [goals])

  // Build schedule map by date
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      if (e.type === 'schedule') {
        const existing = map.get(e.date) ?? []
        existing.push(e)
        map.set(e.date, existing)
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

                const daySchedules = schedulesByDate.get(dateStr) ?? []

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
