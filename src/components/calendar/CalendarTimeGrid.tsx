import { useRef, useEffect, useState } from 'react'
import type { CalendarEvent } from './calendarTypes'
import CalendarEventItem from './CalendarEventItem'

interface CalendarTimeGridProps {
  columns: { date: string; isToday: boolean }[]
  events: CalendarEvent[]
  onSlotClick: (date: string, time: string) => void
  onEventClick: (event: CalendarEvent) => void
}

// Timeline constants (same as DailyPage)
const HOUR_HEIGHT = 48
const START_HOUR = 6
const END_HOUR = 24
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT
const TIME_LABEL_WIDTH = 48

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function CalendarTimeGrid({ columns, events, onSlotClick, onEventClick }: CalendarTimeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  // Update current time every minute
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }
    const timer = setInterval(tick, 60000)
    return () => clearInterval(timer)
  }, [])

  // Scroll to 8am on mount
  useEffect(() => {
    if (containerRef.current) {
      const scrollTo = (8 - START_HOUR) * HOUR_HEIGHT
      containerRef.current.scrollTop = scrollTo
    }
  }, [])

  const colCount = columns.length

  // Group events by column date
  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    if (ev.startTime) {
      const existing = eventsByDate.get(ev.date) ?? []
      existing.push(ev)
      eventsByDate.set(ev.date, existing)
    }
  }

  const handleSlotClick = (e: React.MouseEvent, date: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const totalMinutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60
    // Snap to 15-minute intervals
    const snapped = Math.round(totalMinutes / 15) * 15
    const clamped = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - 15, snapped))
    onSlotClick(date, minutesToTime(clamped))
  }

  const nowLineTop = ((nowMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT
  const showNowLine = nowMinutes >= START_HOUR * 60 && nowMinutes <= END_HOUR * 60

  return (
    <div
      ref={containerRef}
      className="bg-[#16161e] rounded-xl shadow-lg border border-[#2a2a3a] overflow-auto"
      style={{ maxHeight: '70vh' }}
    >
      {/* Column headers */}
      <div className="sticky top-0 z-30 bg-[#16161e] border-b border-[#2a2a3a] flex">
        <div className="shrink-0" style={{ width: `${TIME_LABEL_WIDTH}px` }} />
        {columns.map(col => {
          const d = new Date(col.date + 'T00:00:00')
          const dayNames = ['日', '月', '火', '水', '木', '金', '土']
          const dow = d.getDay()
          return (
            <div
              key={col.date}
              className={`flex-1 min-w-[100px] text-center py-2 border-l border-[#2a2a3a] ${
                col.isToday ? 'bg-amber-500/10' : ''
              }`}
            >
              <div className={`text-[10px] ${col.isToday ? 'text-amber-400' : dow === 0 ? 'text-red-400/60' : dow === 6 ? 'text-blue-400/60' : 'text-[#5a5a6e]'}`}>
                {dayNames[dow]}
              </div>
              <div className={`text-sm font-medium ${col.isToday ? 'text-amber-400' : 'text-[#e4e4ec]'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid body */}
      <div className="relative flex" style={{ height: `${TOTAL_HEIGHT}px` }}>
        {/* Time labels */}
        <div className="shrink-0 relative" style={{ width: `${TIME_LABEL_WIDTH}px` }}>
          {HOURS.map(h => (
            <div
              key={h}
              className="absolute w-full pr-1 pt-0.5 text-right text-[10px] text-[#5a5a6e] select-none"
              style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Columns */}
        {columns.map((col, colIdx) => {
          const colEvents = eventsByDate.get(col.date) ?? []
          const isWeekend = new Date(col.date + 'T00:00:00').getDay() === 0 || new Date(col.date + 'T00:00:00').getDay() === 6

          return (
            <div
              key={col.date}
              className={`flex-1 min-w-[100px] relative border-l border-[#2a2a3a] ${
                isWeekend ? 'bg-[#13131d]' : ''
              }`}
              onClick={(e) => handleSlotClick(e, col.date)}
            >
              {/* Hour grid lines */}
              {HOURS.map(h => (
                <div
                  key={h}
                  className="absolute w-full border-t border-[#1f1f2e]"
                  style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
                />
              ))}

              {/* Today column highlight */}
              {col.isToday && (
                <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
              )}

              {/* Current time line (red) */}
              {col.isToday && showNowLine && (
                <div
                  className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                  style={{ top: `${nowLineTop}px` }}
                >
                  {colIdx === 0 && (
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                  )}
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              )}

              {/* Events */}
              {colEvents.map((ev, evIdx) => {
                if (!ev.startTime) return null
                const startMin = timeToMinutes(ev.startTime)
                const endMin = ev.endTime ? timeToMinutes(ev.endTime) : startMin + 60
                const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22)
                return (
                  <CalendarEventItem
                    key={ev.id}
                    event={ev}
                    style={{ top: `${top}px`, height: `${height}px` }}
                    colorIndex={evIdx}
                    onClick={() => { onEventClick(ev) }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
