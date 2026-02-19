import { useMemo } from 'react'
import CalendarTimeGrid from './CalendarTimeGrid'
import {
  getWeekDays, formatDate,
  buildGoalTree, layoutWeekBands, calcWeekBandsHeight,
} from './calendarUtils'
import type { GoalItem, CalendarEvent, BandSegment } from './calendarTypes'

interface CalendarWeekViewProps {
  anchorDate: string
  events: CalendarEvent[]
  goals: GoalItem[]
  onSlotClick: (date: string, time: string) => void
  onEventClick: (event: CalendarEvent) => void
}

// Depth-based styles (same as MonthView)
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
      <span className={`absolute top-0 left-1 ${depthStyle.textSize} ${depthStyle.text} truncate pointer-events-none`}
        style={{ maxWidth: '90%' }}
      >
        {segment.title}
      </span>
    </div>
  )
}

export default function CalendarWeekView({
  anchorDate,
  events,
  goals,
  onSlotClick,
  onEventClick,
}: CalendarWeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate])
  const today = useMemo(() => formatDate(new Date()), [])

  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  // Build goal tree and layout bands
  const goalTree = useMemo(() => buildGoalTree(goals), [goals])
  const bands = useMemo(() => layoutWeekBands(goalTree, weekStart, weekEnd), [goalTree, weekStart, weekEnd])
  const bandsHeight = useMemo(() => calcWeekBandsHeight(goalTree, weekStart, weekEnd), [goalTree, weekStart, weekEnd])

  // All-day schedules (no time)
  const allDaySchedules = useMemo(
    () => events.filter((e) => e.type === 'schedule' && !e.startTime),
    [events],
  )

  // Timed events for the time grid
  const timedEvents = useMemo(
    () => events.filter((e) => e.type === 'schedule' && e.startTime),
    [events],
  )

  const columns = useMemo(
    () => weekDays.map((d) => ({ date: d, isToday: d === today })),
    [weekDays, today],
  )

  const handleGoalClick = (goal: GoalItem) => {
    onEventClick({
      type: 'goal', id: goal.id, title: goal.title,
      date: goal.start_date, endDate: goal.end_date,
      color: goal.color, status: goal.status, issueType: goal.issue_type,
      original: goal,
    })
  }

  const hasAllDay = bandsHeight > 0 || allDaySchedules.length > 0

  return (
    <div className="flex flex-col gap-0">
      {/* All-day banner with nested bands */}
      {hasAllDay && (
        <div className="bg-[#1e1e2a] border-b border-[#2a2a3a]">
          <div className="flex">
            <div className="shrink-0 w-12 text-[10px] text-[#5a5a6e] pt-1 text-right pr-1">
              終日
            </div>
            <div className="flex-1 relative" style={{ minHeight: `${Math.max(24, bandsHeight + (allDaySchedules.length > 0 ? 24 : 0) + 4)}px` }}>
              {/* Nested goal bands */}
              {bands.map((seg) => (
                <BandRenderer
                  key={`band-${seg.id}`}
                  segment={seg}
                  onEventClick={handleGoalClick}
                />
              ))}

              {/* All-day schedules */}
              {allDaySchedules.length > 0 && (
                <div
                  className="absolute flex flex-wrap gap-1 px-1"
                  style={{ top: `${bandsHeight + 2}px` }}
                >
                  {allDaySchedules.map((event) => {
                    const colIdx = weekDays.indexOf(event.date)
                    if (colIdx < 0) return null
                    return (
                      <button
                        key={`allday-${event.id}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-medium truncate hover:brightness-125 transition-all"
                        onClick={() => onEventClick(event)}
                        title={event.title}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">{event.title}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Time grid */}
      <CalendarTimeGrid
        columns={columns}
        events={timedEvents}
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
      />
    </div>
  )
}
