import type { CalendarEvent } from './calendarTypes'

interface CalendarEventItemProps {
  event: CalendarEvent
  style: React.CSSProperties  // top, height
  colorIndex: number
  onClick: () => void
}

const COLORS = [
  'bg-amber-500/10 border-amber-500 text-amber-300',
  'bg-slate-500/10 border-slate-400 text-slate-300',
  'bg-orange-500/10 border-orange-500 text-orange-300',
  'bg-yellow-500/10 border-yellow-500 text-yellow-300',
  'bg-lime-500/10 border-lime-500 text-lime-300',
  'bg-emerald-500/10 border-emerald-500 text-emerald-300',
]

export default function CalendarEventItem({ event, style, colorIndex, onClick }: CalendarEventItemProps) {
  const colorClass = COLORS[colorIndex % COLORS.length]

  return (
    <div
      className={`absolute left-0 right-0 mx-1 z-10 ${colorClass} border-l-4 rounded px-2 py-0.5 overflow-hidden cursor-pointer group`}
      style={style}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          <div className="font-medium text-xs truncate">{event.title}</div>
          <div className="text-[10px] opacity-70">
            {event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
