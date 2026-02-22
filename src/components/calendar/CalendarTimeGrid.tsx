import React, { useRef, useEffect, useState } from 'react'
import type { CalendarEvent, RoutineItem } from './calendarTypes'
import CalendarEventItem from './CalendarEventItem'

interface CalendarTimeGridProps {
  columns: { date: string; isToday: boolean }[]
  events: CalendarEvent[]
  routines?: RoutineItem[]
  onSlotClick: (date: string, time: string) => void
  onEventClick: (event: CalendarEvent) => void
}

// Timeline constants (same as DailyPage)
const HOUR_HEIGHT = 48
const START_HOUR = 7
const END_HOUR = 27 // 翌3:00 (7:00〜翌3:00 = 20時間)
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT
const TIME_LABEL_WIDTH = 48

// Convert HH:MM to grid minutes (early morning hours map to extended range)
function timeToGridMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const minutes = h * 60 + m
  if (h < START_HOUR) return minutes + 24 * 60
  return minutes
}

function minutesToTime(minutes: number): string {
  const wrapped = minutes >= 24 * 60 ? minutes - 24 * 60 : minutes
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function CalendarTimeGrid({ columns, events, routines, onSlotClick, onEventClick }: CalendarTimeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    const raw = n.getHours() * 60 + n.getMinutes()
    return raw < START_HOUR * 60 ? raw + 24 * 60 : raw
  })

  // Update current time every minute
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const raw = n.getHours() * 60 + n.getMinutes()
      setNowMinutes(raw < START_HOUR * 60 ? raw + 24 * 60 : raw)
    }
    const timer = setInterval(tick, 60000)
    return () => clearInterval(timer)
  }, [])

  // Scroll to 9am on mount
  useEffect(() => {
    if (containerRef.current) {
      const scrollTo = (9 - START_HOUR) * HOUR_HEIGHT
      containerRef.current.scrollTop = scrollTo
    }
  }, [])

  // Routine popover
  const [routinePopover, setRoutinePopover] = useState<{ id: number; x: number; y: number } | null>(null)

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
    <>
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
          {HOURS.map(h => {
            const displayH = h >= 24 ? h - 24 : h
            return (
              <div
                key={h}
                className={`absolute w-full pr-1 pt-0.5 text-right text-[10px] select-none ${h >= 24 ? 'text-[#4a4a5e]' : 'text-[#5a5a6e]'}`}
                style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
              >
                {h >= 24 && <span className="text-[8px] text-[#3a3a4e]">翌</span>}
                {String(displayH).padStart(2, '0')}:00
              </div>
            )
          })}
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
                <div key={h}>
                  <div
                    className="absolute w-full border-t border-[#1f1f2e]"
                    style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
                  />
                  {h === 24 && (
                    <div
                      className="absolute w-full border-t border-dashed border-[#3a3a4e]"
                      style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }}
                    />
                  )}
                </div>
              ))}

              {/* Today column highlight */}
              {col.isToday && (
                <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
              )}

              {/* Routine background blocks */}
              {(routines ?? [])
                .filter(r => {
                  const dow = new Date(col.date + 'T00:00:00').getDay()
                  return r.day_of_week.split(',').filter(Boolean).includes(String(dow))
                })
                .map(routine => {
                  const startMin = timeToGridMinutes(routine.start_time)
                  const endMin = timeToGridMinutes(routine.end_time)
                  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
                  const height = ((endMin - startMin) / 60) * HOUR_HEIGHT
                  return (
                    <React.Fragment key={`routine-${routine.id}`}>
                      <div
                        className="absolute left-0 right-0 z-[1] pointer-events-none mx-0.5"
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="h-full rounded-sm border border-dashed border-teal-500/20 bg-teal-500/5">
                          <span className="text-[8px] text-teal-400/25 font-medium px-1 pt-px block truncate select-none">
                            {routine.name}
                          </span>
                        </div>
                      </div>
                      {routine.memo && (
                        <button
                          className="absolute z-[25] right-1 w-4 h-4 flex items-center justify-center rounded-full bg-teal-500/15 hover:bg-teal-500/40 text-teal-400/50 hover:text-teal-300 transition-all shadow-sm hover:shadow-teal-500/20"
                          style={{ top: `${top + 1}px` }}
                          onClick={(e) => {
                            e.stopPropagation()
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setRoutinePopover(routinePopover?.id === routine.id ? null : { id: routine.id, x: rect.left, y: rect.bottom + 4 })
                          }}
                        >
                          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                        </button>
                      )}
                    </React.Fragment>
                  )
                })}

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
                const startMin = timeToGridMinutes(ev.startTime)
                const endMin = ev.endTime ? timeToGridMinutes(ev.endTime) : startMin + 60
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

      {/* Routine popover — rendered outside overflow-auto container */}
      {routinePopover && (() => {
        const routine = (routines ?? []).find(r => r.id === routinePopover.id)
        if (!routine?.memo) return null
        return (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setRoutinePopover(null)}
            />
            <div
              className="fixed z-50 w-52"
              style={{ top: `${routinePopover.y}px`, left: `${routinePopover.x}px` }}
            >
              <div className="bg-[#1a1a2e] border border-teal-500/30 rounded-xl shadow-2xl shadow-teal-500/10 overflow-hidden backdrop-blur-sm">
                <div className="px-3 py-2 border-b border-teal-500/15 flex items-center gap-2 bg-teal-500/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                  <span className="text-xs font-semibold text-teal-300 truncate">{routine.name}</span>
                  <span className="text-[8px] text-teal-400/40 font-mono ml-auto shrink-0">
                    {routine.start_time}-{routine.end_time}
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[10px] text-[#b0b0c0] leading-relaxed whitespace-pre-wrap">
                    {routine.memo}
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </>
  )
}
