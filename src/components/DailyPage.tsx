import React, { useState, useEffect, useCallback, useRef } from 'react'
import { apiPost, apiPut, apiPatch, apiDelete } from '../hooks/useApi'
import Diary from './Diary'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// ── Types ──
interface ScheduleItem {
  id: number
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  memo: string | null
}

interface Habit {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
  duration: number
  day_of_week: string
}

interface HabitNode extends Habit {
  children: HabitNode[]
}

interface HabitLog {
  habit_id: number
  date: string
}


// ── Helpers ──
const formatDate = (d: Date) => d.toISOString().split('T')[0]
const dayNames = ['日', '月', '火', '水', '木', '金', '土']

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${dayNames[d.getDay()]}）`
}

// ── Timeline constants ──
const HOUR_HEIGHT = 48
const START_HOUR = 7
const END_HOUR = 27 // 翌3:00 (7:00〜翌3:00 = 20時間)
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

// Convert HH:MM to grid minutes (early morning hours map to extended range)
function timeToGridMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const minutes = h * 60 + m
  if (h < START_HOUR) return minutes + 24 * 60
  return minutes
}

// Convert grid minutes back to HH:MM (wraps around 24h for storage)
function gridMinutesToTime(m: number): string {
  const wrapped = m >= 24 * 60 ? m - 24 * 60 : m
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

const COLORS = [
  'bg-amber-500/10 border-amber-500 text-amber-300',
  'bg-slate-500/10 border-slate-400 text-slate-300',
  'bg-orange-500/10 border-orange-500 text-orange-300',
  'bg-yellow-500/10 border-yellow-500 text-yellow-300',
  'bg-lime-500/10 border-lime-500 text-lime-300',
  'bg-emerald-500/10 border-emerald-500 text-emerald-300',
]


// ══════════════════════════════════════
// DailyPage
// ══════════════════════════════════════
export default function DailyPage() {
  const [date, setDate] = useState(formatDate(new Date()))
  const isToday = date === formatDate(new Date())

  const changeDate = (offset: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    setDate(formatDate(d))
  }

  return (
    <div>
      {/* Shared date header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => changeDate(-1)} className="px-3 py-1.5 bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg hover:bg-[#252535] text-[#8b8b9e] hover:text-[#e4e4ec] transition-colors">&larr;</button>
        <h2 className="techo-heading text-2xl min-w-[200px] text-center">{formatDateLabel(date)}</h2>
        <button onClick={() => changeDate(1)} className="px-3 py-1.5 bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg hover:bg-[#252535] text-[#8b8b9e] hover:text-[#e4e4ec] transition-colors">&rarr;</button>
        <button
          onClick={() => setDate(formatDate(new Date()))}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${isToday ? 'bg-amber-500 text-black font-semibold' : 'bg-[#1e1e2a] text-amber-400 border border-amber-500/30 hover:bg-amber-500/10'}`}
        >
          今日
        </button>
        <MonthlyGoalBadge />
      </div>

      <WeeklyGoalSection />

      {/* Two-column layout – stacks on narrow, side-by-side on wide */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Timeline */}
        <div className="w-full lg:w-80 shrink-0">
          <ScheduleTimeline date={date} isToday={isToday} />
        </div>

        {/* Right: Diary + Habits + Goals */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          <Diary date={date} />
          <HabitSection date={date} />
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// Schedule Timeline
// ══════════════════════════════════════
interface GoalItem {
  id: number
  title: string
  issue_type: string
  start_date: string
  end_date: string
  scheduled_time: string | null
  scheduled_duration: number | null
}

interface RoutineItem {
  id: number
  name: string
  start_time: string
  end_time: string
  day_of_week: string
  sort_order: number
  memo: string | null
}

// Unified timeline item for rendering
interface TimelineItem {
  id: string        // prefixed to avoid collision: 's-1' or 'g-1'
  title: string
  start_time: string | null
  end_time: string | null
  source: 'schedule' | 'goal'
  scheduleId?: number  // for delete
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function ScheduleTimeline({ date, isToday }: { date: string; isToday: boolean }) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [goals, setGoals] = useState<GoalItem[]>([])
  const [routines, setRoutines] = useState<RoutineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [memo, setMemo] = useState('')

  // Drag state for move & resize
  const [dragging, setDragging] = useState<{id: number; type: 'move'|'resize'; startY: number; origTop: number; origHeight: number} | null>(null)
  const [ghostStyle, setGhostStyle] = useState<{top: number; height: number} | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)

  // Drop indicator for habit D&D
  const [dropIndicator, setDropIndicator] = useState<number | null>(null)

  // Routine popover
  const [routinePopover, setRoutinePopover] = useState<{ id: number; x: number; y: number } | null>(null)

  const fetchSchedules = useCallback(() => {
    setLoading(true)
    const dateDay = new Date(date + 'T00:00:00').getDay()
    Promise.all([
      fetch(`/api/schedules?date=${date}`).then(r => r.json()),
      fetch(`/api/goals?from=${date}&to=${date}`).then(r => r.json()),
      fetch(`/api/routines?day=${dateDay}`).then(r => r.json()),
    ]).then(([s, g, r]) => {
      setSchedules(s)
      setGoals(g)
      setRoutines(r)
      setLoading(false)
    })
  }, [date])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

  // Timed goals (task/subtask with scheduled_time on this date)
  const timedGoals: TimelineItem[] = goals
    .filter(g => g.scheduled_time && (g.issue_type === 'task' || g.issue_type === 'subtask'))
    .map(g => ({
      id: `g-${g.id}`,
      title: g.title,
      start_time: g.scheduled_time,
      end_time: addMinutesToTime(g.scheduled_time!, g.scheduled_duration ?? 60),
      source: 'goal' as const,
    }))

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await apiPost('/api/schedules', {
      title: title.trim(), date,
      start_time: startTime || null,
      end_time: endTime || null,
      memo: memo || null,
    })
    setTitle(''); setStartTime(''); setEndTime(''); setMemo('')
    setShowForm(false)
    fetchSchedules()
  }

  const handleDelete = async (id: number) => {
    await apiDelete(`/api/schedules/${id}`)
    fetchSchedules()
  }

  // Habit D&D handlers
  const handleHabitDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('habit-id')) return
    e.preventDefault()
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    const y = e.clientY - rect.top
    const minutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60
    const snapped = Math.round(minutes / 15) * 15
    const clampedMin = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - 30, snapped))
    setDropIndicator(((clampedMin - START_HOUR * 60) / 60) * HOUR_HEIGHT)
    // Note: snapped/clampedMin are in grid-space (e.g. 25*60 for 1AM)
  }

  const handleHabitDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDropIndicator(null)
    const habitId = e.dataTransfer.getData('habit-id')
    if (!habitId) return
    const habitName = e.dataTransfer.getData('habit-name')
    const duration = Number(e.dataTransfer.getData('habit-duration')) || 30
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    const y = e.clientY - rect.top
    const minutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60
    const snapped = Math.round(minutes / 15) * 15
    const startMin = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - duration, snapped))
    const endMin = startMin + duration
    await apiPost('/api/schedules', {
      title: habitName,
      date,
      start_time: gridMinutesToTime(startMin),
      end_time: gridMinutesToTime(endMin),
      source: 'habit',
    })
    fetchSchedules()
  }

  const handleMouseDownMove = (e: React.MouseEvent, item: ScheduleItem, origTop: number, origHeight: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging({ id: item.id, type: 'move', startY: e.clientY, origTop, origHeight })
    setGhostStyle({ top: origTop, height: origHeight })
    document.body.style.userSelect = 'none'
  }

  const handleMouseDownResize = (e: React.MouseEvent, item: ScheduleItem, origTop: number, origHeight: number) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging({ id: item.id, type: 'resize', startY: e.clientY, origTop, origHeight })
    setGhostStyle({ top: origTop, height: origHeight })
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    if (!dragging) return
    const onMouseMove = (e: MouseEvent) => {
      const dy = e.clientY - dragging.startY
      if (dragging.type === 'move') {
        const rawTop = dragging.origTop + dy
        const minutes = START_HOUR * 60 + (rawTop / HOUR_HEIGHT) * 60
        const snapped = Math.round(minutes / 15) * 15
        const maxStartMin = END_HOUR * 60 - (dragging.origHeight / HOUR_HEIGHT) * 60
        const clampedMin = Math.max(START_HOUR * 60, Math.min(maxStartMin, snapped))
        const newTop = ((clampedMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
        setGhostStyle({ top: newTop, height: dragging.origHeight })
      } else {
        const rawHeight = dragging.origHeight + dy
        const durationMin = Math.round((rawHeight / HOUR_HEIGHT) * 60 / 15) * 15
        const maxDur = (END_HOUR * 60) - (START_HOUR * 60 + (dragging.origTop / HOUR_HEIGHT) * 60)
        const clampedDur = Math.max(15, Math.min(durationMin, maxDur))
        setGhostStyle({ top: dragging.origTop, height: (clampedDur / 60) * HOUR_HEIGHT })
      }
    }
    const onMouseUp = async () => {
      document.body.style.userSelect = ''
      if (ghostStyle && dragging) {
        const item = schedules.find(s => s.id === dragging.id)
        if (item) {
          const startMin = START_HOUR * 60 + (ghostStyle.top / HOUR_HEIGHT) * 60
          const endMin = startMin + (ghostStyle.height / HOUR_HEIGHT) * 60
          await apiPatch(`/api/schedules/${dragging.id}`, { start_time: gridMinutesToTime(startMin), end_time: gridMinutesToTime(endMin) })
          fetchSchedules()
        }
      }
      setDragging(null)
      setGhostStyle(null)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragging, ghostStyle, schedules])

  const now = new Date()
  const rawMinutes = now.getHours() * 60 + now.getMinutes()
  const currentMinutes = rawMinutes < START_HOUR * 60 ? rawMinutes + 24 * 60 : rawMinutes
  const nowLineTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT

  const timedSchedules = schedules.filter(s => s.start_time)
  const untimedEvents = schedules.filter(s => !s.start_time)

  // Merge timed schedules + timed goals for timeline display
  const allTimedItems: TimelineItem[] = [
    ...timedSchedules.map(s => ({
      id: `s-${s.id}`,
      title: s.title,
      start_time: s.start_time,
      end_time: s.end_time,
      source: 'schedule' as const,
      scheduleId: s.id,
    })),
    ...timedGoals,
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[#8b8b9e] tracking-wider">SCHEDULE</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs bg-amber-500 text-black font-semibold px-3 py-1 rounded-lg hover:bg-amber-400 transition-colors"
        >
          + 追加
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-[#16161e] rounded-xl p-3 shadow-lg mb-3 space-y-2 border border-[#2a2a3a]">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="予定名"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" autoFocus />
          <div className="flex gap-2">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="border border-stone-300 rounded px-2 py-1.5 text-sm flex-1" />
            <span className="text-[#5a5a6e] self-center">-</span>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="border border-stone-300 rounded px-2 py-1.5 text-sm flex-1" />
          </div>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="メモ"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button type="submit" className="bg-amber-500 text-black font-semibold px-3 py-1 rounded-lg text-xs hover:bg-amber-400 transition-colors">登録</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 rounded-lg text-xs text-[#8b8b9e] hover:bg-[#252535] transition-colors">取消</button>
          </div>
        </form>
      )}

      {/* Untimed events */}
      {untimedEvents.length > 0 && (
        <div className="mb-2 space-y-1">
          {untimedEvents.map((s, i) => (
            <div key={s.id} className={`${COLORS[i % COLORS.length]} border-l-4 rounded px-2 py-1 text-xs flex items-center gap-1`}>
              <span className="font-medium truncate flex-1">{s.title}</span>
              <button onClick={() => handleDelete(s.id)} className="opacity-50 hover:opacity-100">&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {loading ? (
        <p className="text-[#5a5a6e] text-sm">読み込み中...</p>
      ) : (
        <div className="bg-[#16161e] rounded-xl shadow-lg border border-[#2a2a3a] overflow-hidden">
          <div ref={timelineRef} className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}
            onDragOver={handleHabitDragOver}
            onDragLeave={() => setDropIndicator(null)}
            onDrop={handleHabitDrop}>
            {HOURS.map(h => {
              const displayH = h >= 24 ? h - 24 : h
              const isMidnight = h === 24
              return (
              <div key={h} className="absolute w-full border-t border-[#1f1f2e] flex"
                style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                {isMidnight && <div className="absolute left-0 right-0 top-0 border-t border-dashed border-[#3a3a4e]" />}
                <div className={`w-11 pr-1 pt-0.5 text-right text-[10px] shrink-0 select-none ${h >= 24 ? 'text-[#4a4a5e]' : 'text-[#5a5a6e]'}`}>
                  {h >= 24 && <span className="text-[8px] text-[#3a3a4e]">翌</span>}
                  {String(displayH).padStart(2, '0')}:00
                </div>
                <div className="flex-1 border-l border-[#2a2a3a]" />
              </div>
            )})}

            {/* Routine background blocks */}
            {routines.map(routine => {
              const startMin = timeToGridMinutes(routine.start_time)
              const endMin = timeToGridMinutes(routine.end_time)
              const topPx = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
              const heightPx = ((endMin - startMin) / 60) * HOUR_HEIGHT
              return (
                <React.Fragment key={`routine-${routine.id}`}>
                  <div
                    className="absolute left-11 right-0 z-[1] pointer-events-none"
                    style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                  >
                    <div className="h-full mx-0.5 rounded-md border border-dashed border-teal-500/20 bg-teal-500/5">
                      <span className="text-[9px] text-teal-400/30 font-medium px-2 pt-0.5 block truncate select-none">
                        {routine.name}
                      </span>
                    </div>
                  </div>
                  {routine.memo && (
                    <button
                      className="absolute z-[25] right-2 w-5 h-5 flex items-center justify-center rounded-full bg-teal-500/15 hover:bg-teal-500/40 text-teal-400/50 hover:text-teal-300 transition-all shadow-sm hover:shadow-teal-500/20"
                      style={{ top: `${topPx + 2}px` }}
                      onClick={(e) => {
                        e.stopPropagation()
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setRoutinePopover(routinePopover?.id === routine.id ? null : { id: routine.id, x: rect.left, y: rect.bottom + 6 })
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </button>
                  )}
                </React.Fragment>
              )
            })}

            {isToday && currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60 && (
              <div className="absolute left-11 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: `${nowLineTop}px` }}>
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            )}

            {allTimedItems.map((item, i) => {
              if (!item.start_time) return null
              const startMin = timeToGridMinutes(item.start_time)
              const endMin = item.end_time ? timeToGridMinutes(item.end_time) : startMin + 60
              const topPx = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
              const heightPx = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22)
              const isGoal = item.source === 'goal'
              const colorClass = isGoal
                ? 'bg-sky-500/10 border-sky-500 text-sky-300'
                : COLORS[i % COLORS.length]
              const isDraggingThis = dragging?.id === item.scheduleId
              return (
                <div key={item.id}
                  className={`absolute left-12 right-1 z-10 ${colorClass} border-l-4 rounded px-2 py-0.5 overflow-hidden ${
                    isGoal ? '' : (dragging ? (isDraggingThis ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-grab')
                  } group`}
                  style={{ top: `${topPx}px`, height: `${heightPx}px`, opacity: isDraggingThis ? 0.4 : 1 }}
                  onMouseDown={isGoal ? undefined : e => handleMouseDownMove(e, schedules.find(s => s.id === item.scheduleId)!, topPx, heightPx)}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate flex items-center gap-1">
                        {isGoal && <span className="text-[8px] px-1 py-px rounded bg-sky-500/20 text-sky-400/70 shrink-0">WBS</span>}
                        {item.title}
                      </div>
                      <div className="text-[10px] opacity-70">
                        {item.start_time}{item.end_time ? ` - ${item.end_time}` : ''}
                      </div>
                    </div>
                    {!isGoal && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(item.scheduleId!) }}
                        className="opacity-0 group-hover:opacity-70 hover:!opacity-100 text-xs shrink-0">&times;</button>
                    )}
                  </div>
                  {!isGoal && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-2 cursor-row-resize hover:bg-amber-400/30"
                      onMouseDown={e => handleMouseDownResize(e, schedules.find(s => s.id === item.scheduleId)!, topPx, heightPx)}
                    />
                  )}
                </div>
              )
            })}

            {dragging && ghostStyle && (
              <div className="absolute left-12 right-1 z-30 bg-amber-500/20 border-2 border-amber-400 border-dashed rounded pointer-events-none"
                style={{ top: `${ghostStyle.top}px`, height: `${ghostStyle.height}px` }} />
            )}

            {dropIndicator !== null && (
              <div className="absolute left-12 right-1 z-25 border-2 border-dashed border-amber-400/60 rounded pointer-events-none"
                style={{ top: `${dropIndicator}px`, height: '2px' }} />
            )}
          </div>
        </div>
      )}

      {/* Routine popover — rendered outside overflow-hidden container */}
      {routinePopover && (() => {
        const routine = routines.find(r => r.id === routinePopover.id)
        if (!routine?.memo) return null
        return (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setRoutinePopover(null)}
            />
            <div
              className="fixed z-50 w-56"
              style={{ top: `${routinePopover.y}px`, left: `${routinePopover.x}px` }}
            >
              <div className="bg-[#1a1a2e] border border-teal-500/30 rounded-xl shadow-2xl shadow-teal-500/10 overflow-hidden backdrop-blur-sm">
                <div className="px-3 py-2 border-b border-teal-500/15 flex items-center gap-2 bg-teal-500/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                  <span className="text-xs font-semibold text-teal-300 truncate">{routine.name}</span>
                  <span className="text-[9px] text-teal-400/40 font-mono ml-auto shrink-0">
                    {routine.start_time}-{routine.end_time}
                  </span>
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[11px] text-[#b0b0c0] leading-relaxed whitespace-pre-wrap">
                    {routine.memo}
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

// ══════════════════════════════════════
// ── Build habit tree from flat list ──
function buildHabitTree(habits: Habit[]): HabitNode[] {
  const map = new Map<number, HabitNode>()
  const roots: HabitNode[] = []
  for (const h of habits) map.set(h.id, { ...h, children: [] })
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const sort = (nodes: HabitNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    for (const n of nodes) sort(n.children)
  }
  sort(roots)
  return roots
}

// ══════════════════════════════════════
// Habit constants
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120]

// ══════════════════════════════════════
// HabitEditPanel — modern settings for a single leaf habit
// ══════════════════════════════════════
function HabitEditPanel({ habit, onSave }: {
  habit: Habit
  onSave: (name: string, duration: number, day_of_week: string) => void
}) {
  const [name, setName] = useState(habit.name)
  const [duration, setDuration] = useState(habit.duration ?? 30)
  const [selected, setSelected] = useState<Set<string>>(
    new Set((habit.day_of_week || '').split(',').filter(Boolean))
  )
  useEffect(() => {
    setName(habit.name)
    setDuration(habit.duration ?? 30)
    setSelected(new Set((habit.day_of_week || '').split(',').filter(Boolean)))
  }, [habit.id])

  const toggleDay = (d: string) => setSelected(prev => {
    const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n
  })
  const isCustomDuration = !DURATION_PRESETS.includes(duration)

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="text-[10px] text-[#5a5a6e] uppercase tracking-widest font-mono block mb-2">名前</label>
        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSave(name.trim() || habit.name, duration, Array.from(selected).sort().join(','))}
          className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] outline-none focus:border-amber-500/40 transition-colors" />
      </div>

      {/* Duration */}
      <div>
        <label className="text-[10px] text-[#5a5a6e] uppercase tracking-widest font-mono block mb-2">所要時間</label>
        <div className="flex gap-1.5 flex-wrap items-center">
          {DURATION_PRESETS.map(p => (
            <button key={p} type="button" onClick={() => setDuration(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                duration === p && !isCustomDuration
                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                  : 'bg-[#1e1e2a] text-[#5a5a6e] hover:bg-[#252535] hover:text-[#8b8b9e]'
              }`}>
              {p < 60 ? `${p}分` : `${p / 60}h`}
            </button>
          ))}
          <div className={`flex items-center rounded-lg border overflow-hidden transition-colors ${
            isCustomDuration ? 'border-amber-500/40 bg-amber-500/5' : 'border-[#2a2a3a] bg-[#1e1e2a]'
          }`}>
            <button type="button"
              onClick={() => setDuration(d => Math.max(5, d - 5))}
              className="px-2.5 py-1.5 text-[#5a5a6e] hover:text-amber-400 hover:bg-white/5 active:bg-white/10 transition-colors text-sm font-semibold leading-none select-none">
              −
            </button>
            <input type="text" inputMode="numeric" value={duration}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 5 && v <= 480) setDuration(v) }}
              className="w-8 bg-transparent text-xs text-center text-[#e4e4ec] outline-none font-mono" />
            <span className="text-[10px] text-[#5a5a6e] pr-1.5">分</span>
            <button type="button"
              onClick={() => setDuration(d => Math.min(480, d + 5))}
              className="px-2.5 py-1.5 text-[#5a5a6e] hover:text-amber-400 hover:bg-white/5 active:bg-white/10 transition-colors text-sm font-semibold leading-none select-none border-l border-[#2a2a3a]">
              +
            </button>
          </div>
        </div>
      </div>

      {/* Day of week */}
      <div>
        <label className="text-[10px] text-[#5a5a6e] uppercase tracking-widest font-mono block mb-2">実行曜日</label>
        <div className="flex gap-2 mb-2">
          {DAY_LABELS.map((label, i) => {
            const d = String(i)
            const active = selected.has(d)
            const isWeekend = i === 0 || i === 6
            return (
              <button key={d} type="button" onClick={() => toggleDay(d)}
                className={`w-9 h-9 rounded-full text-xs font-bold transition-all select-none ${
                  active
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/25 scale-110'
                    : `bg-[#1e1e2a] ${isWeekend ? 'text-[#4a4a6e]' : 'text-[#5a5a6e]'} hover:bg-[#252535] hover:scale-105`
                }`}>
                {label}
              </button>
            )
          })}
        </div>
        <div className="flex gap-3">
          {[['平日', '1,2,3,4,5'], ['週末', '0,6'], ['毎日', '0,1,2,3,4,5,6']].map(([label, val]) => (
            <button key={label} type="button"
              onClick={() => setSelected(new Set(val.split(',')))}
              className="text-[10px] text-amber-500/50 hover:text-amber-400 transition-colors">{label}</button>
          ))}
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-[10px] text-[#3a3a4e] hover:text-[#5a5a6e] transition-colors">クリア</button>
        </div>
      </div>

      <button
        onClick={() => onSave(name.trim() || habit.name, duration, Array.from(selected).sort().join(','))}
        className="bg-amber-500 text-black font-bold text-sm px-5 py-2 rounded-lg hover:bg-amber-400 transition-colors">
        保存
      </button>
    </div>
  )
}

// ══════════════════════════════════════
// HabitManagerModal — manage all habits
// ══════════════════════════════════════
function HabitManagerModal({ onClose }: { onClose: () => void }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectOpen, setSelectOpen] = useState(false)
  const selectRef = useRef<HTMLDivElement>(null)

  const fetchHabits = useCallback(() => {
    setLoading(true)
    fetch('/api/habits').then(r => r.json()).then(h => { setHabits(h); setLoading(false) })
  }, [])
  useEffect(() => { fetchHabits() }, [fetchHabits])
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(e.target as Node)) setSelectOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const tree = buildHabitTree(habits)
  const selectedHabit = habits.find(h => h.id === selected)
  const isLeaf = selectedHabit ? !habits.some(h => h.parent_id === selectedHabit.id) : false
  const roots = habits.filter(h => !h.parent_id)

  const handleAdd = async () => {
    if (!newName.trim()) return
    const res = await apiPost('/api/habits', { name: newName.trim(), parent_id: newParentId })
    setNewName('')
    await fetchHabits()
    setSelected((res as Habit).id)
  }

  const handleDelete = async (id: number) => {
    const hasChildren = habits.some(h => h.parent_id === id)
    if (!confirm(hasChildren ? 'グループと配下の習慣をすべて削除しますか？' : 'この習慣を削除しますか？')) return
    await apiDelete(`/api/habits/${id}`)
    if (selected === id) setSelected(null)
    fetchHabits()
  }

  const renderNode = (node: HabitNode, depth: number): React.ReactNode => (
    <React.Fragment key={node.id}>
      <button
        onClick={() => setSelected(node.id)}
        className={`w-full flex items-center gap-2 py-1.5 text-left text-xs transition-colors group ${
          selected === node.id
            ? 'bg-amber-500/10 text-amber-300'
            : 'text-[#8b8b9e] hover:bg-[#1f1f2e] hover:text-[#e4e4ec]'
        }`}
        style={{ paddingLeft: `${depth * 14 + 12}px`, paddingRight: '8px' }}
      >
        {node.children.length > 0
          ? <span className="text-[9px] opacity-50 shrink-0">▾</span>
          : depth > 0 ? <span className="text-[#2a2a3a] text-[10px] shrink-0">└</span>
          : <span className="w-2 shrink-0" />
        }
        <span className={`flex-1 truncate ${node.children.length > 0 ? 'font-semibold text-[#8b8b9e]' : ''}`}>
          {node.name}
        </span>
        {node.day_of_week && node.children.length === 0 && (
          <span className="text-[8px] text-amber-500/40 font-mono shrink-0">
            {node.day_of_week.split(',').filter(Boolean).map(d => DAY_LABELS[Number(d)]).join('')}
          </span>
        )}
        <button onClick={e => { e.stopPropagation(); handleDelete(node.id) }}
          className="opacity-0 group-hover:opacity-100 text-[#3a3a4e] hover:text-red-400 transition-colors text-xs shrink-0 ml-1">
          &times;
        </button>
      </button>
      {node.children.map(child => renderNode(child, depth + 1))}
    </React.Fragment>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#16161e] border border-[#2a2a3a] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a3a] shrink-0">
          <h2 className="text-sm font-bold text-[#8b8b9e] tracking-wider">HABITS 管理</h2>
          <button onClick={onClose} className="text-[#5a5a6e] hover:text-[#e4e4ec] text-xl leading-none transition-colors">&times;</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: habit list */}
          <div className="w-52 border-r border-[#2a2a3a] flex flex-col shrink-0">
            {/* Add form */}
            <div className="p-3 border-b border-[#1f1f2e] space-y-2">
              <div className="flex gap-1">
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  placeholder="習慣名..." onKeyDown={e => e.key === 'Enter' && handleAdd()}
                  className="flex-1 bg-[#0e0e12] border border-[#2a2a3a] rounded px-2 py-1 text-xs text-[#e4e4ec] placeholder:text-[#3a3a4e] outline-none focus:border-amber-500/40 min-w-0" />
                <button onClick={handleAdd}
                  className="bg-amber-500 text-black text-xs font-bold px-2 py-1 rounded hover:bg-amber-400 transition-colors shrink-0">
                  +
                </button>
              </div>
              {/* Custom group select */}
              <div ref={selectRef} className="relative">
                <button type="button"
                  onClick={() => setSelectOpen(v => !v)}
                  className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] border transition-colors focus:outline-none ${
                    selectOpen ? 'border-amber-500/40 bg-[#1a1a26]' : 'border-[#2a2a3a] bg-[#0e0e12] hover:border-[#3a3a4e]'
                  }`}>
                  <span className={newParentId !== null ? 'text-[#e4e4ec]' : 'text-[#3a3a4e]'}>
                    {newParentId !== null ? (roots.find(h => h.id === newParentId)?.name ?? '—') : 'グループなし（ルート）'}
                  </span>
                  <span className={`text-[8px] text-[#3a3a4e] transition-transform duration-150 ${selectOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {selectOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#1a1a26] border border-[#2a2a3a] rounded-xl overflow-hidden shadow-2xl z-50">
                    {[{ id: null as number | null, name: 'グループなし（ルート）' }, ...roots].map(opt => (
                      <button key={String(opt.id)} type="button"
                        onClick={() => { setNewParentId(opt.id); setSelectOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                          newParentId === opt.id
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'text-[#8b8b9e] hover:bg-[#252535] hover:text-[#e4e4ec]'
                        }`}>
                        {opt.id === null && <span className="text-[#3a3a4e] mr-1.5 text-[9px]">—</span>}
                        {opt.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1">
              {loading
                ? <p className="text-[#3a3a4e] text-xs text-center py-4">読み込み中...</p>
                : tree.length === 0
                  ? <p className="text-[#3a3a4e] text-xs text-center py-4">習慣がありません</p>
                  : tree.map(node => renderNode(node, 0))
              }
            </div>
          </div>

          {/* Right: edit panel */}
          <div className="flex-1 overflow-y-auto p-5">
            {!selectedHabit ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <p className="text-[#3a3a4e] text-xs">左の一覧から習慣を選択</p>
                <p className="text-[#2a2a3a] text-[10px]">子習慣（グループでないもの）は曜日・時間を設定できます</p>
              </div>
            ) : isLeaf ? (
              <HabitEditPanel
                habit={selectedHabit}
                onSave={async (name, dur, dow) => {
                  await apiPatch(`/api/habits/${selectedHabit.id}`, { name, duration: dur, day_of_week: dow })
                  fetchHabits()
                }}
              />
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="text-[10px] text-[#5a5a6e] uppercase tracking-widest font-mono block mb-2">グループ名</label>
                  <div className="flex gap-2">
                    <input
                      defaultValue={selectedHabit.name}
                      key={selectedHabit.id}
                      id="group-name-input"
                      className="flex-1 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] outline-none focus:border-amber-500/40 transition-colors" />
                    <button
                      onClick={async () => {
                        const el = document.getElementById('group-name-input') as HTMLInputElement
                        if (el?.value.trim()) {
                          await apiPatch(`/api/habits/${selectedHabit.id}`, { name: el.value.trim() })
                          fetchHabits()
                        }
                      }}
                      className="bg-amber-500 text-black font-bold text-sm px-4 py-2 rounded-lg hover:bg-amber-400 transition-colors">
                      保存
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-[#3a3a4e]">グループには曜日・時間の設定はありません。子習慣に個別に設定してください。</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// HabitSection — daily habit list (date-filtered)
// ══════════════════════════════════════
function HabitSection({ date }: { date: string }) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [showManager, setShowManager] = useState(false)
  const [loading, setLoading] = useState(true)

  const dateDay = new Date(date + 'T00:00:00').getDay()

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/habits').then(r => r.json()),
      fetch(`/api/habits/logs?from=${date}&to=${date}`).then(r => r.json()),
    ]).then(([h, l]) => { setHabits(h); setLogs(l); setLoading(false) })
  }, [date])
  useEffect(() => { fetchData() }, [fetchData])

  // Only leaf habits (no children) scheduled for today's weekday
  const leafHabitsToday = habits.filter(h => {
    const isLeaf = !habits.some(other => other.parent_id === h.id)
    const hasSchedule = h.day_of_week && h.day_of_week.split(',').filter(Boolean).length > 0
    return isLeaf && hasSchedule && h.day_of_week.split(',').filter(Boolean).includes(String(dateDay))
  })

  const isChecked = (habitId: number) => logs.some(l => l.habit_id === habitId && l.date === date)

  const handleToggle = async (habitId: number) => {
    await apiPost(`/api/habits/${habitId}/logs`, { date })
    fetchData()
  }

  // Build display items: groups as boxes, standalone as individual cards
  type DisplayItem =
    | { type: 'group'; parentId: number; parentName: string; habits: Habit[] }
    | { type: 'standalone'; habit: Habit }

  const displayItems: DisplayItem[] = []
  const seenGroups = new Set<number>()
  for (const h of leafHabitsToday) {
    if (h.parent_id !== null) {
      if (!seenGroups.has(h.parent_id)) {
        seenGroups.add(h.parent_id)
        displayItems.push({
          type: 'group',
          parentId: h.parent_id,
          parentName: habits.find(p => p.id === h.parent_id)?.name ?? '',
          habits: leafHabitsToday.filter(c => c.parent_id === h.parent_id),
        })
      }
    } else {
      displayItems.push({ type: 'standalone', habit: h })
    }
  }

  const HabitItem = ({ habit, inGroup }: { habit: Habit; inGroup?: boolean }) => {
    const checked = isChecked(habit.id)
    return (
      <div
        className={`flex items-center gap-2.5 px-3 py-2.5 transition-all ${
          inGroup
            ? `rounded-lg ${checked ? 'bg-amber-500/5' : 'hover:bg-[#1f1f2e]'}`
            : `rounded-xl border ${checked ? 'bg-amber-500/5 border-amber-500/15' : 'bg-[#16161e] border-[#2a2a3a] hover:border-[#3a3a4e]'}`
        }`}>
        {/* Drag handle */}
        <span
          draggable
          onDragStart={e => {
            e.dataTransfer.setData('habit-id', String(habit.id))
            e.dataTransfer.setData('habit-name', habit.name)
            e.dataTransfer.setData('habit-duration', String(habit.duration || 30))
          }}
          className="cursor-grab text-[#2a2a3a] hover:text-amber-400 transition-colors text-sm select-none shrink-0"
          title="タイムラインにドラッグして予定を設定">
          ⠿
        </span>
        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${checked ? 'text-[#3a3a4e] line-through' : 'text-[#e4e4ec]'}`}>
            {habit.name}
          </div>
        </div>
        {/* Duration badge */}
        {habit.duration > 0 && (
          <span className={`text-[9px] shrink-0 font-mono px-1.5 py-0.5 rounded ${
            checked ? 'text-[#2a2a3a]' : 'text-[#3a3a4e] bg-[#1e1e2a]'
          }`}>
            {habit.duration}分
          </span>
        )}
        {/* Done toggle */}
        <button onClick={() => handleToggle(habit.id)}
          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs shrink-0 transition-all ${
            checked
              ? 'bg-amber-500 border-amber-500 text-black shadow-md shadow-amber-500/25'
              : 'border-[#3a3a4e] hover:border-amber-500 text-transparent hover:scale-110'
          }`}>
          ✓
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[#8b8b9e] tracking-wider">HABITS</h3>
        <button onClick={() => setShowManager(true)}
          className="text-xs text-[#5a5a6e] hover:text-amber-400 transition-colors flex items-center gap-1 px-2 py-1 rounded-lg border border-[#2a2a3a] hover:border-amber-500/30">
          ⚙ 管理
        </button>
      </div>

      {loading ? (
        <p className="text-[#5a5a6e] text-xs">読み込み中...</p>
      ) : leafHabitsToday.length === 0 ? (
        <div className="text-center py-5 bg-[#16161e] rounded-xl border border-[#2a2a3a]">
          <p className="text-[#3a3a4e] text-xs mb-2">今日の習慣が設定されていません</p>
          <button onClick={() => setShowManager(true)}
            className="text-xs text-amber-500/60 hover:text-amber-400 transition-colors">
            + 管理メニューから習慣を設定
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map((item, idx) =>
            item.type === 'standalone' ? (
              <HabitItem key={item.habit.id} habit={item.habit} />
            ) : (
              <div key={`group-${item.parentId}-${idx}`}
                className="bg-[#16161e] border border-[#2a2a3a] rounded-xl overflow-hidden">
                {/* Group header */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a26] border-b border-[#2a2a3a]">
                  <span className="text-[9px] text-[#3a3a4e]">▤</span>
                  <span className="text-[10px] font-semibold text-[#5a5a6e] tracking-wider uppercase">{item.parentName}</span>
                  <span className="ml-auto text-[9px] text-[#2a2a3a] font-mono">
                    {item.habits.filter(h => isChecked(h.id)).length}/{item.habits.length}
                  </span>
                </div>
                {/* Children */}
                <div className="px-1 py-1 space-y-0.5">
                  {item.habits.map(h => <HabitItem key={h.id} habit={h} inGroup />)}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {showManager && (
        <HabitManagerModal onClose={() => { setShowManager(false); fetchData() }} />
      )}
    </div>
  )
}

// ══════════════════════════════════════
// Monthly Goal Badge — compact header inline
// ══════════════════════════════════════
function MonthlyGoalBadge() {
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/monthly-goals/${yearMonth}`)
      .then(r => r.json())
      .then(d => setContent(d.content ?? ''))
  }, [yearMonth])

  const startEdit = () => {
    setDraft(content)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const save = async () => {
    const trimmed = draft.trim()
    await apiPut(`/api/monthly-goals/${yearMonth}`, { content: trimmed })
    setContent(trimmed)
    setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
    setDraft('')
  }

  if (editing) {
    return (
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-amber-500/40 shrink-0 font-mono tracking-widest uppercase">
          {now.getMonth() + 1}月
        </span>
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          placeholder="今月の目標..."
          className="flex-1 bg-transparent border-b border-amber-500/40 focus:border-amber-400 text-sm font-bold tracking-tight text-amber-200 outline-none py-0.5 min-w-0 placeholder:text-amber-500/20 placeholder:font-normal"
        />
        <button onClick={save} className="text-xs text-amber-400 hover:text-amber-300 shrink-0 transition-colors">✓</button>
        <button onClick={cancel} className="text-xs text-[#5a5a6e] hover:text-[#8b8b9e] shrink-0 transition-colors">✕</button>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center gap-2 min-w-0 group">
      <span className="text-[10px] text-amber-500/30 shrink-0 font-mono tracking-widest uppercase">
        {now.getMonth() + 1}月
      </span>
      {content ? (
        <span className="text-base font-bold tracking-tight text-amber-300/80 truncate min-w-0 select-none">
          ✦ {content}
        </span>
      ) : (
        <span className="text-sm text-[#3a3a4e] italic truncate select-none">
          今月の目標を設定...
        </span>
      )}
      <button
        onClick={startEdit}
        className="opacity-30 group-hover:opacity-100 text-base text-amber-500/60 hover:text-amber-400 transition-opacity shrink-0 px-1"
        title="今月の目標を編集"
      >
        ✎
      </button>
    </div>
  )
}


// ══════════════════════════════════════
// Weekly Goal Section
// ══════════════════════════════════════
function getISOWeekString(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getWeekRange(d: Date): { start: Date; end: Date } {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const start = new Date(d)
  start.setDate(d.getDate() + diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start, end }
}

function WeeklyGoalSection() {
  const now = new Date()
  const yearWeek = getISOWeekString(now)
  const { start, end } = getWeekRange(now)
  const weekLabel = `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`

  const [content, setContent] = useState('')
  const [memo, setMemo] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftMemo, setDraftMemo] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const memoRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch(`/api/weekly-goals/${yearWeek}`)
      .then(r => r.json())
      .then(d => { setContent(d.content ?? ''); setMemo(d.memo ?? null) })
  }, [yearWeek])

  const startEdit = () => {
    setDraft(content)
    setDraftMemo(memo ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const save = async () => {
    const trimmedContent = draft.trim()
    const trimmedMemo = draftMemo.trim() || null
    await apiPut(`/api/weekly-goals/${yearWeek}`, { content: trimmedContent, memo: trimmedMemo })
    setContent(trimmedContent)
    setMemo(trimmedMemo)
    setEditing(false)
  }

  const cancel = () => {
    setEditing(false)
    setDraft('')
    setDraftMemo('')
  }

  if (editing) {
    return (
      <div className="mb-4 rounded-xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-[#1a1a2e] to-[#1a1a2e] overflow-hidden">
        <div className="px-4 py-3 space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
            <span className="text-[10px] text-amber-500/40 font-mono tracking-widest uppercase">WEEK {yearWeek.split('-W')[1]}</span>
            <span className="text-[10px] text-[#3a3a4e]">{weekLabel}</span>
            <div className="ml-auto flex gap-1.5">
              <button onClick={save} className="px-2.5 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-md transition-colors">保存</button>
              <button onClick={cancel} className="px-2.5 py-1 text-xs text-[#5a5a6e] hover:text-[#8b8b9e] bg-[#1e1e2a] hover:bg-[#252535] rounded-md transition-colors">取消</button>
            </div>
          </div>
          {/* Goal input */}
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') cancel() }}
            placeholder="今週の目標..."
            className="w-full bg-transparent border-b border-amber-500/30 focus:border-amber-400 text-sm font-semibold tracking-tight text-amber-200 outline-none py-1 placeholder:text-amber-500/20 placeholder:font-normal"
          />
          {/* Memo textarea */}
          <div>
            <label className="text-[10px] text-[#5a5a6e] mb-1 block">詳細・理由</label>
            <textarea
              ref={memoRef}
              value={draftMemo}
              onChange={e => setDraftMemo(e.target.value)}
              placeholder="なぜこの目標か、具体的に何をするか..."
              rows={3}
              className="w-full bg-[#12121c] border border-[#2a2a3a] focus:border-amber-500/30 rounded-lg text-xs text-[#b0b0c0] outline-none px-3 py-2 resize-none placeholder:text-[#3a3a4e]"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4">
      <div
        className={`rounded-xl border transition-all duration-300 ${
          expanded
            ? 'border-amber-500/25 bg-gradient-to-r from-amber-500/8 via-[#1a1a2e] to-[#1a1a2e] shadow-lg shadow-amber-500/5'
            : 'border-[#2a2a3a] bg-[#16161e] hover:border-amber-500/15'
        }`}
      >
        {/* Goal bar */}
        <div className="flex items-center gap-3 px-4 py-2.5 group">
          <svg className="w-4 h-4 text-amber-400/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0 2.77-.693a9 9 0 0 1 6.208.682l.108.054a9 9 0 0 0 6.086.71l3.114-.732a48.524 48.524 0 0 1-.005-10.499l-3.11.732a9 9 0 0 1-6.085-.711l-.108-.054a9 9 0 0 0-6.208-.682L3 4.5M3 15V4.5" />
          </svg>
          <span className="text-[10px] text-amber-500/35 font-mono tracking-widest uppercase shrink-0">W{yearWeek.split('-W')[1]}</span>
          {content ? (
            <span className="text-sm font-semibold tracking-tight text-amber-300/80 truncate min-w-0 select-none">
              {content}
            </span>
          ) : (
            <span className="text-sm text-[#3a3a4e] italic truncate select-none">
              今週の目標を設定...
            </span>
          )}
          <div className="ml-auto flex items-center gap-1 shrink-0">
            {memo && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                  expanded
                    ? 'bg-amber-500/20 text-amber-300 shadow-sm shadow-amber-500/10'
                    : 'text-amber-400/30 hover:text-amber-400/70 hover:bg-amber-500/10'
                }`}
                title="詳細を表示"
              >
                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            )}
            <button
              onClick={startEdit}
              className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 text-amber-500/40 hover:text-amber-400 hover:bg-amber-500/10 transition-all"
              title="今週の目標を編集"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable detail panel */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="px-4 pb-3">
            <div className="border-t border-amber-500/10 pt-3">
              <div className="flex items-start gap-2">
                <div className="w-0.5 h-full min-h-[20px] bg-gradient-to-b from-amber-400/40 to-amber-400/0 rounded-full shrink-0 mt-0.5" />
                <div className="weekly-goal-markdown text-xs text-[#b0b0c0] leading-relaxed flex-1 min-w-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{memo ?? ''}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
