import { useMemo } from 'react'
import CalendarTimeGrid from './CalendarTimeGrid'
import { formatDate, buildGoalTree, collectLeaves } from './calendarUtils'
import type { GoalItem, CalendarEvent } from './calendarTypes'

interface CalendarDayViewProps {
  date: string
  events: CalendarEvent[]
  goals: GoalItem[]
  onSlotClick: (date: string, time: string) => void
  onEventClick: (event: CalendarEvent) => void
}

const LEAF_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  task:    { bg: 'bg-sky-500/20', border: 'border-l-[3px] border-sky-500', text: 'text-sky-300' },
  subtask: { bg: 'bg-slate-500/20', border: 'border-l-[3px] border-slate-400', text: 'text-slate-300' },
  story:   { bg: 'bg-emerald-500/15', border: 'border-l-[3px] border-emerald-500', text: 'text-emerald-300' },
  epic:    { bg: 'bg-violet-500/12', border: 'border-l-[3px] border-violet-500', text: 'text-violet-300' },
}

export default function CalendarDayView({ date, events, goals, onSlotClick, onEventClick }: CalendarDayViewProps) {
  const allDaySchedules = events.filter(e => e.type === 'schedule' && !e.startTime)
  const timedEvents = events.filter(e => e.startTime)

  // Build goal tree and extract leaves for this day (exclude timed goals — they go to time grid)
  const dayGoals = useMemo(() => goals.filter(g => g.start_date <= date && g.end_date >= date && !g.scheduled_time), [goals, date])
  const goalTree = useMemo(() => buildGoalTree(dayGoals), [dayGoals])
  const leaves = useMemo(() => collectLeaves(goalTree), [goalTree])

  const hasAllDay = leaves.length > 0 || allDaySchedules.length > 0
  const columns = [{ date, isToday: date === formatDate(new Date()) }]

  const handleGoalClick = (goal: GoalItem) => {
    onEventClick({
      type: 'goal', id: goal.id, title: goal.title,
      date: goal.start_date, endDate: goal.end_date,
      color: goal.color, status: goal.status, issueType: goal.issue_type,
      original: goal,
    })
  }

  return (
    <div className="flex flex-col gap-0">
      {/* All-day area: nested goal tree + untimed schedules */}
      {hasAllDay && (
        <div className="bg-[#1e1e2a] border-b border-[#2a2a3a] px-4 py-2 space-y-1">
          {leaves.map(({ node, epicTitle, storyTitle }) => {
            const g = node.goal
            const style = LEAF_STYLES[g.issue_type] ?? LEAF_STYLES.task
            const tooltipParts = [epicTitle, storyTitle, g.title].filter(Boolean)
            return (
              <div
                key={g.id}
                className={`${style.bg} ${style.border} rounded-r-sm flex items-center h-5 cursor-pointer hover:brightness-125 transition-all overflow-hidden`}
                onClick={() => handleGoalClick(g)}
                title={tooltipParts.join(' / ')}
              >
                <span className={`text-[10px] font-medium px-2 truncate ${style.text} flex items-center gap-1`}>
                  {epicTitle && <span className="text-[8px] px-1 py-px rounded bg-violet-500/20 text-violet-400/70 shrink-0">{epicTitle}</span>}
                  {storyTitle && <span className="opacity-50 shrink-0">{storyTitle} /</span>}
                  <span className="truncate">{g.title}</span>
                </span>
              </div>
            )
          })}

          {allDaySchedules.length > 0 && (
            <div className={`flex flex-col gap-1 ${leaves.length > 0 ? 'mt-1' : ''}`}>
              {allDaySchedules.map(ev => (
                <button
                  key={`allday-${ev.id}`}
                  onClick={() => onEventClick(ev)}
                  className="flex items-center gap-1.5 text-[11px] text-[#c0c0d0] hover:text-[#e4e4ec] transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="truncate">{ev.title}</span>
                </button>
              ))}
            </div>
          )}
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
