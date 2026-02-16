import { useState, useEffect, useCallback } from 'react'
import { apiPost, apiPut, apiDelete } from '../hooks/useApi'
import Diary from './Diary'

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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function getLast7Days(): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(formatDate(d))
  }
  return days
}

function shortDate(dateStr: string): { date: string; day: string; isToday: boolean } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    day: dayNames[d.getDay()],
    isToday: dateStr === formatDate(new Date()),
  }
}

// ── Timeline constants ──
const HOUR_HEIGHT = 48
const START_HOUR = 6
const END_HOUR = 24
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

const COLORS = [
  'bg-amber-50 border-amber-600 text-amber-900',
  'bg-stone-100 border-stone-500 text-stone-800',
  'bg-orange-50 border-orange-500 text-orange-900',
  'bg-yellow-50 border-yellow-600 text-yellow-900',
  'bg-lime-50 border-lime-600 text-lime-900',
  'bg-emerald-50 border-emerald-600 text-emerald-900',
]

function getEventStyle(item: ScheduleItem): React.CSSProperties | null {
  if (!item.start_time) return null
  const startMin = timeToMinutes(item.start_time)
  const endMin = item.end_time ? timeToMinutes(item.end_time) : startMin + 60
  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 22)
  return { top: `${top}px`, height: `${height}px` }
}

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
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => changeDate(-1)} className="px-3 py-1 bg-stone-200 rounded hover:bg-stone-300 text-stone-600">&larr;</button>
        <h2 className="techo-heading text-2xl min-w-[200px] text-center">{formatDateLabel(date)}</h2>
        <button onClick={() => changeDate(1)} className="px-3 py-1 bg-stone-200 rounded hover:bg-stone-300 text-stone-600">&rarr;</button>
        <button
          onClick={() => setDate(formatDate(new Date()))}
          className={`px-3 py-1 rounded text-sm ${isToday ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
        >
          今日
        </button>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-6 items-start">
        {/* Left: Timeline */}
        <div className="w-80 shrink-0">
          <ScheduleTimeline date={date} isToday={isToday} />
        </div>

        {/* Right: Diary + Habits */}
        <div className="flex-1 min-w-0 space-y-6">
          <Diary date={date} />
          <HabitSection />
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// Schedule Timeline
// ══════════════════════════════════════
function ScheduleTimeline({ date, isToday }: { date: string; isToday: boolean }) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [memo, setMemo] = useState('')

  const fetchSchedules = useCallback(() => {
    setLoading(true)
    fetch(`/api/schedules?date=${date}`)
      .then(r => r.json())
      .then(d => { setSchedules(d); setLoading(false); })
  }, [date])

  useEffect(() => { fetchSchedules() }, [fetchSchedules])

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

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const nowLineTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT

  const timedEvents = schedules.filter(s => s.start_time)
  const untimedEvents = schedules.filter(s => !s.start_time)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-stone-500 tracking-wider">SCHEDULE</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs bg-stone-700 text-white px-3 py-1 rounded hover:bg-stone-800"
        >
          + 追加
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white/80 rounded p-3 shadow-sm mb-3 space-y-2 border border-stone-200">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="予定名"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" autoFocus />
          <div className="flex gap-2">
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="border border-stone-300 rounded px-2 py-1.5 text-sm flex-1" />
            <span className="text-stone-400 self-center">-</span>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="border border-stone-300 rounded px-2 py-1.5 text-sm flex-1" />
          </div>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="メモ"
            className="w-full border border-stone-300 rounded px-2 py-1.5 text-sm" />
          <div className="flex gap-2">
            <button type="submit" className="bg-stone-700 text-white px-3 py-1 rounded text-xs hover:bg-stone-800">登録</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1 rounded text-xs text-stone-500 hover:bg-stone-100">取消</button>
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
        <p className="text-stone-400 text-sm">読み込み中...</p>
      ) : (
        <div className="bg-white/80 rounded shadow-sm border border-stone-200 overflow-hidden">
          <div className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full border-t border-stone-100 flex"
                style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                <div className="w-11 pr-1 pt-0.5 text-right text-[10px] text-stone-400 shrink-0 select-none">
                  {String(h).padStart(2, '0')}:00
                </div>
                <div className="flex-1 border-l border-stone-200" />
              </div>
            ))}

            {isToday && currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60 && (
              <div className="absolute left-11 right-0 z-20 flex items-center pointer-events-none"
                style={{ top: `${nowLineTop}px` }}>
                <div className="w-2 h-2 rounded-full bg-red-500 -ml-1" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            )}

            {timedEvents.map((item, i) => {
              const style = getEventStyle(item)
              if (!style) return null
              return (
                <div key={item.id}
                  className={`absolute left-12 right-1 z-10 ${COLORS[i % COLORS.length]} border-l-4 rounded px-2 py-0.5 overflow-hidden cursor-default group`}
                  style={style}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="font-medium text-xs truncate">{item.title}</div>
                      <div className="text-[10px] opacity-70">
                        {item.start_time}{item.end_time ? ` - ${item.end_time}` : ''}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(item.id)}
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 text-xs shrink-0">&times;</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════
// Habit Section
// ══════════════════════════════════════
function HabitSection() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  const days = getLast7Days()

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/habits').then(r => r.json()),
      fetch(`/api/habits/logs?from=${days[0]}&to=${days[6]}`).then(r => r.json()),
    ]).then(([h, l]) => {
      setHabits(h)
      setLogs(l)
      setLoading(false)
    })
  }, [days[0], days[6]])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await apiPost('/api/habits', { name: name.trim() })
    setName('')
    fetchData()
  }

  const handleToggle = async (habitId: number, date: string) => {
    await apiPost(`/api/habits/${habitId}/logs`, { date })
    fetchData()
  }

  const handleDeleteHabit = async (id: number) => {
    await apiDelete(`/api/habits/${id}`)
    fetchData()
  }

  const isChecked = (habitId: number, date: string) =>
    logs.some(l => l.habit_id === habitId && l.date === date)

  if (loading) return <p className="text-stone-400 text-sm">読み込み中...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-stone-500 tracking-wider">HABITS</h3>
        <form onSubmit={handleAdd} className="flex gap-1">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="新しい習慣..."
            className="bg-white/80 border border-stone-300 rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          <button type="submit" className="bg-stone-700 text-white px-2 py-1 rounded text-xs hover:bg-stone-800">追加</button>
        </form>
      </div>

      {habits.length === 0 ? (
        <p className="text-stone-400 text-center py-4 text-xs">習慣を追加してみましょう</p>
      ) : (
        <div className="bg-white/80 rounded shadow-sm overflow-auto border border-stone-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left p-2 min-w-[80px] text-stone-600 text-xs font-medium">習慣</th>
                {days.map(d => {
                  const info = shortDate(d)
                  return (
                    <th key={d} className={`p-1.5 text-center w-10 ${info.isToday ? 'bg-amber-50' : ''}`}>
                      <div className={`text-[10px] ${info.isToday ? 'text-amber-700 font-bold' : 'text-stone-400'}`}>{info.date}</div>
                      <div className={`text-[10px] ${info.isToday ? 'text-amber-600' : 'text-stone-300'}`}>{info.day}</div>
                    </th>
                  )
                })}
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {habits.map(habit => (
                <tr key={habit.id} className="border-b border-stone-100 last:border-0">
                  <td className="p-2 font-medium text-stone-700 text-xs">{habit.name}</td>
                  {days.map(d => {
                    const info = shortDate(d)
                    const checked = isChecked(habit.id, d)
                    return (
                      <td key={d} className={`p-1.5 text-center ${info.isToday ? 'bg-amber-50' : ''}`}>
                        <button onClick={() => handleToggle(habit.id, d)}
                          className={`w-6 h-6 rounded border-2 transition-colors text-xs ${
                            checked ? 'bg-amber-600 border-amber-600 text-white' : 'border-stone-300 hover:border-amber-500'
                          }`}>
                          {checked ? '✓' : ''}
                        </button>
                      </td>
                    )
                  })}
                  <td className="p-1.5">
                    <button onClick={() => handleDeleteHabit(habit.id)} className="text-stone-300 hover:text-red-500 text-xs">&times;</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
