import type { CalendarEvent } from './calendarTypes'

interface CalendarGoalItemProps {
  event: CalendarEvent
  variant: 'bar' | 'badge'
  onClick: () => void
  style?: React.CSSProperties
}

const ISSUE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  epic:    { bg: 'bg-violet-500/20', border: 'border-violet-500', text: 'text-violet-300' },
  story:   { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-300' },
  task:    { bg: 'bg-sky-500/20', border: 'border-sky-500', text: 'text-sky-300' },
  subtask: { bg: 'bg-slate-500/20', border: 'border-slate-500', text: 'text-slate-300' },
}

const DEFAULT_COLORS = { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-300' }

// Hierarchy level: epic/story are "parent" types (de-emphasized)
function isParentType(issueType?: string): boolean {
  return issueType === 'epic' || issueType === 'story'
}

export default function CalendarGoalItem({ event, variant, onClick, style }: CalendarGoalItemProps) {
  const colors = ISSUE_TYPE_COLORS[event.issueType ?? ''] ?? DEFAULT_COLORS
  const isParent = isParentType(event.issueType)

  if (variant === 'bar') {
    if (isParent) {
      // Epic/Story: thin subtle line, no text (de-emphasized)
      return (
        <div
          className={`absolute flex items-center cursor-pointer hover:opacity-80 transition-all ${
            event.issueType === 'epic' ? 'h-[3px]' : 'h-[4px]'
          }`}
          style={style}
          onClick={onClick}
          title={event.title}
        >
          <div className={`w-full h-full rounded-full ${
            event.issueType === 'epic'
              ? 'bg-violet-500/25'
              : 'bg-emerald-500/25'
          }`} />
        </div>
      )
    }

    // Task/Subtask: full visible bar with text
    return (
      <div
        className={`absolute h-5 ${colors.bg} border-l-[3px] ${colors.border} rounded-r-sm flex items-center cursor-pointer hover:brightness-125 transition-all`}
        style={style}
        onClick={onClick}
        title={event.title}
      >
        <span className={`text-[10px] font-medium px-1.5 truncate ${colors.text}`}>
          {event.title}
        </span>
      </div>
    )
  }

  // badge variant
  if (isParent) {
    // Epic/Story: subtle compact badge
    return (
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-1.5 py-0 rounded ${
          event.issueType === 'epic'
            ? 'bg-violet-500/10 text-violet-400/50'
            : 'bg-emerald-500/10 text-emerald-400/50'
        } text-[9px] truncate max-w-full hover:opacity-80 transition-all`}
        title={event.title}
      >
        <span className="truncate">{event.title}</span>
      </button>
    )
  }

  // Task/Subtask: prominent badge
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} text-[10px] font-medium truncate max-w-full hover:brightness-125 transition-all`}
      title={event.title}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.border.replace('border-', 'bg-')} shrink-0`} />
      <span className="truncate">{event.title}</span>
    </button>
  )
}
