import { useMemo } from 'react'
import CalendarTimeGrid from './CalendarTimeGrid'
import { formatDate, buildGoalTree, calcNodeHeight } from './calendarUtils'
import type { GoalItem, GoalTreeNode, CalendarEvent } from './calendarTypes'

interface CalendarDayViewProps {
  date: string
  events: CalendarEvent[]
  goals: GoalItem[]
  onSlotClick: (date: string, time: string) => void
  onEventClick: (event: CalendarEvent) => void
}

// Styles by depth
const CONTAINER_STYLES: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: 'bg-violet-500/[0.06]', border: 'border border-violet-500/[0.15]', text: 'text-violet-400/40 text-[8px]' },
  1: { bg: 'bg-emerald-500/[0.10]', border: 'border border-emerald-500/[0.18]', text: 'text-emerald-400/50 text-[9px]' },
}

const LEAF_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  task:    { bg: 'bg-sky-500/20', border: 'border-l-[3px] border-sky-500', text: 'text-sky-300' },
  subtask: { bg: 'bg-slate-500/20', border: 'border-l-[3px] border-slate-400', text: 'text-slate-300' },
  story:   { bg: 'bg-emerald-500/15', border: 'border-l-[3px] border-emerald-500', text: 'text-emerald-300' },
  epic:    { bg: 'bg-violet-500/12', border: 'border-l-[3px] border-violet-500', text: 'text-violet-300' },
}

function GoalTreeBand({ node, onClick }: { node: GoalTreeNode; onClick: (g: GoalItem) => void }) {
  const g = node.goal
  const isLeaf = node.children.length === 0

  if (isLeaf) {
    const style = LEAF_STYLES[g.issue_type] ?? LEAF_STYLES.task
    return (
      <div
        className={`${style.bg} ${style.border} rounded-r-sm flex items-center h-5 cursor-pointer hover:brightness-125 transition-all overflow-hidden`}
        onClick={() => onClick(g)}
        title={g.title}
      >
        <span className={`text-[10px] font-medium px-2 truncate ${style.text}`}>
          {g.title}
        </span>
      </div>
    )
  }

  const cStyle = CONTAINER_STYLES[node.depth] ?? CONTAINER_STYLES[1]
  return (
    <div
      className={`${cStyle.bg} ${cStyle.border} rounded p-0.5 cursor-pointer hover:brightness-110 transition-all`}
      onClick={(e) => { e.stopPropagation(); onClick(g) }}
      title={g.title}
    >
      <div className={`${cStyle.text} truncate px-1 mb-0.5`}>{g.title}</div>
      <div className="flex flex-col gap-px">
        {node.children.map(child => (
          <GoalTreeBand key={child.goal.id} node={child} onClick={onClick} />
        ))}
      </div>
    </div>
  )
}

export default function CalendarDayView({ date, events, goals, onSlotClick, onEventClick }: CalendarDayViewProps) {
  const allDaySchedules = events.filter(e => e.type === 'schedule' && !e.startTime)
  const timedSchedules = events.filter(e => e.type === 'schedule' && e.startTime)

  // Build goal tree and filter for this day
  const dayGoals = useMemo(() => goals.filter(g => g.start_date <= date && g.end_date >= date), [goals, date])
  const goalTree = useMemo(() => buildGoalTree(dayGoals), [dayGoals])

  const hasAllDay = goalTree.length > 0 || allDaySchedules.length > 0
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
          {goalTree.map(root => (
            <GoalTreeBand key={root.goal.id} node={root} onClick={handleGoalClick} />
          ))}

          {allDaySchedules.length > 0 && (
            <div className={`flex flex-col gap-1 ${goalTree.length > 0 ? 'mt-1' : ''}`}>
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
        events={timedSchedules}
        onSlotClick={onSlotClick}
        onEventClick={onEventClick}
      />
    </div>
  )
}
