import { useState, useRef, useEffect } from 'react'

interface DatePickerProps {
  value: string  // YYYY-MM-DD or ''
  onChange: (value: string) => void
  placeholder?: string
  accentColor?: 'amber' | 'teal'
  className?: string
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}` }

const DAYS = ['日', '月', '火', '水', '木', '金', '土']

export default function DatePicker({ value, onChange, placeholder = '日付を選択', accentColor = 'amber', className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const today = new Date()
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate())

  // Determine which month to show: based on selected date or today
  const baseDate = value ? new Date(value + 'T00:00:00') : today
  const [viewYear, setViewYear] = useState(baseDate.getFullYear())
  const [viewMonth, setViewMonth] = useState(baseDate.getMonth())

  // Sync view when value changes while closed
  useEffect(() => {
    if (!open && value) {
      const d = new Date(value + 'T00:00:00')
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value, open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectDate = (day: number) => {
    onChange(toDateStr(viewYear, viewMonth, day))
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setOpen(false)
  }

  // Display value
  const displayValue = value
    ? (() => {
        const d = new Date(value + 'T00:00:00')
        return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}（${DAYS[d.getDay()]}）`
      })()
    : ''

  const accent = accentColor === 'teal'
    ? { ring: 'ring-teal-500/30', bg: 'bg-teal-500', text: 'text-teal-400', hover: 'hover:bg-teal-500/10', todayBorder: 'ring-1 ring-teal-500/40' }
    : { ring: 'ring-amber-500/30', bg: 'bg-amber-500', text: 'text-amber-400', hover: 'hover:bg-amber-500/10', todayBorder: 'ring-1 ring-amber-500/40' }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm transition-colors focus:outline-none focus:${accent.ring} ${
          value ? 'text-white' : 'text-[#3a3a4a]'
        }`}
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#5a5a6e] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          {displayValue || placeholder}
        </span>
      </button>

      {/* Calendar popup */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 bg-[#16161e] border border-[#2a2a3a] rounded-xl shadow-2xl p-3 w-[280px] animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors rounded hover:bg-[#1e1e2a]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
              className="text-sm font-medium text-[#e4e4ec] hover:text-amber-400 transition-colors px-2"
            >
              {viewYear}年{viewMonth + 1}月
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors rounded hover:bg-[#1e1e2a]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-medium py-1 ${i === 0 ? 'text-red-400/60' : i === 6 ? 'text-blue-400/60' : 'text-[#5a5a6e]'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (day === null) return <div key={`empty-${i}`} />
              const dateStr = toDateStr(viewYear, viewMonth, day)
              const isSelected = dateStr === value
              const isToday = dateStr === todayStr
              const dayOfWeek = new Date(viewYear, viewMonth, day).getDay()
              const isSun = dayOfWeek === 0
              const isSat = dayOfWeek === 6

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`relative w-full aspect-square flex items-center justify-center text-xs rounded-lg transition-all ${
                    isSelected
                      ? `${accent.bg} text-black font-bold`
                      : isToday
                        ? `${accent.todayBorder} ${accent.text} font-medium`
                        : `${accent.hover} ${isSun ? 'text-red-400/80' : isSat ? 'text-blue-400/80' : 'text-[#8b8b9e]'} hover:text-white`
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2a2a3a]">
            <button
              type="button"
              onClick={() => { selectDate(today.getDate()); setViewYear(today.getFullYear()); setViewMonth(today.getMonth()) }}
              className={`text-xs ${accent.text} hover:underline transition-colors`}
            >
              今日
            </button>
            {value && (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-[#5a5a6e] hover:text-red-400 transition-colors"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
