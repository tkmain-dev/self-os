import type { CalendarView } from './calendarTypes'

interface CalendarHeaderProps {
  view: CalendarView
  onViewChange: (v: CalendarView) => void
  anchorDate: string  // YYYY-MM-DD
  onNavigate: (direction: -1 | 0 | 1) => void
}

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: 'month', label: '月' },
  { key: 'week', label: '週' },
  { key: 'day', label: '日' },
]

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function formatTitle(view: CalendarView, dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1

  if (view === 'month') {
    return `${y}年${m}月`
  }

  if (view === 'week') {
    // Calculate ISO week number
    const jan1 = new Date(y, 0, 1)
    const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1
    const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7)
    return `${y}年${m}月 第${weekNum}週`
  }

  // day
  const day = d.getDate()
  const dow = WEEKDAY_LABELS[d.getDay()]
  return `${y}年${m}月${day}日（${dow}）`
}

export default function CalendarHeader({ view, onViewChange, anchorDate, onNavigate }: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
      {/* Left: Title */}
      <h2 className="techo-heading text-lg md:text-2xl">
        {formatTitle(view, anchorDate)}
      </h2>

      {/* Center: Navigation */}
      <div className="flex gap-1">
        <button
          onClick={() => onNavigate(-1)}
          className="px-3 py-1.5 bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg hover:bg-[#252535] text-[#8b8b9e] hover:text-[#e4e4ec] transition-colors"
        >
          &larr;
        </button>
        <button
          onClick={() => onNavigate(0)}
          className="px-3 py-1.5 bg-[#1e1e2a] text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 text-sm transition-colors"
        >
          今日
        </button>
        <button
          onClick={() => onNavigate(1)}
          className="px-3 py-1.5 bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg hover:bg-[#252535] text-[#8b8b9e] hover:text-[#e4e4ec] transition-colors"
        >
          &rarr;
        </button>
      </div>

      {/* Right: View toggle */}
      <div className="flex gap-1 bg-[#1e1e2a] rounded-lg p-0.5">
        {VIEWS.map(v => (
          <button
            key={v.key}
            onClick={() => onViewChange(v.key)}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              view === v.key
                ? 'bg-[#16161e] text-[#e4e4ec] shadow-sm'
                : 'text-[#5a5a6e] hover:text-[#8b8b9e]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
