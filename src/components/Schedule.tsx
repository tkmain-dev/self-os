import { useState, useEffect, useCallback } from 'react'
import { apiPost, apiDelete } from '../hooks/useApi'

interface ScheduleItem {
  id: number
  title: string
  date: string
  start_time: string | null
  end_time: string | null
  memo: string | null
}

const formatDate = (d: Date) => d.toISOString().split('T')[0]

const HOUR_HEIGHT = 60 // px per hour
const START_HOUR = 7
const END_HOUR = 27 // 翌3:00
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

function timeToGridMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const minutes = h * 60 + m
  if (h < START_HOUR) return minutes + 24 * 60
  return minutes
}

function getEventStyle(item: ScheduleItem): React.CSSProperties | null {
  if (!item.start_time) return null
  const startMin = timeToGridMinutes(item.start_time)
  const endMin = item.end_time ? timeToGridMinutes(item.end_time) : startMin + 60
  const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
  const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 24)
  return { top: `${top}px`, height: `${height}px` }
}

const COLORS = [
  'bg-amber-50 border-amber-600 text-amber-900',
  'bg-stone-100 border-stone-500 text-stone-800',
  'bg-orange-50 border-orange-500 text-orange-900',
  'bg-yellow-50 border-yellow-600 text-yellow-900',
  'bg-lime-50 border-lime-600 text-lime-900',
  'bg-emerald-50 border-emerald-600 text-emerald-900',
]

const dayNames = ['日', '月', '火', '水', '木', '金', '土']

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}月${d.getDate()}日（${dayNames[d.getDay()]}）`
}

export default function Schedule() {
  const [date, setDate] = useState(formatDate(new Date()))
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
      title: title.trim(),
      date,
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

  const changeDate = (offset: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + offset)
    setDate(formatDate(d))
  }

  const isToday = date === formatDate(new Date())
  const now = new Date()
  const rawMinutes = now.getHours() * 60 + now.getMinutes()
  const currentMinutes = rawMinutes < START_HOUR * 60 ? rawMinutes + 24 * 60 : rawMinutes
  const nowLineTop = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT

  const timedEvents = schedules.filter(s => s.start_time)
  const untimedEvents = schedules.filter(s => !s.start_time)

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 className="techo-heading text-2xl mr-2">スケジュール</h2>
        <button onClick={() => changeDate(-1)} className="px-3 py-1 bg-stone-200 rounded hover:bg-stone-300 text-stone-600">&larr;</button>
        <span className="text-lg font-medium min-w-[140px] text-center text-stone-700">{formatDateLabel(date)}</span>
        <button onClick={() => changeDate(1)} className="px-3 py-1 bg-stone-200 rounded hover:bg-stone-300 text-stone-600">&rarr;</button>
        <button
          onClick={() => setDate(formatDate(new Date()))}
          className={`px-3 py-1 rounded text-sm ${isToday ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
        >
          今日
        </button>
        <button
          onClick={() => setShowForm(!showForm)}
          className="ml-auto bg-stone-700 text-white px-4 py-2 rounded hover:bg-stone-800 text-sm"
        >
          + 追加
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white/80 rounded p-4 shadow-sm mb-4 space-y-3 border border-stone-200">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="予定名"
            className="w-full border border-stone-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            autoFocus
          />
          <div className="flex gap-3">
            <div>
              <label className="text-sm text-stone-500">開始</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="block border border-stone-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="text-sm text-stone-500">終了</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="block border border-stone-300 rounded px-3 py-2" />
            </div>
          </div>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="メモ（任意）"
            className="w-full border border-stone-300 rounded px-3 py-2"
          />
          <div className="flex gap-2">
            <button type="submit" className="bg-stone-700 text-white px-4 py-2 rounded hover:bg-stone-800 text-sm">登録</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded text-stone-500 hover:bg-stone-100 text-sm">キャンセル</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>読み込み中...</p>
      ) : (
        <>
          {/* Untimed events */}
          {untimedEvents.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-stone-400 uppercase tracking-wider mb-1 pl-16">終日・時刻未設定</div>
              <div className="flex flex-wrap gap-2 pl-16">
                {untimedEvents.map((s, i) => (
                  <div
                    key={s.id}
                    className={`${COLORS[i % COLORS.length]} border-l-4 rounded px-3 py-1.5 text-sm flex items-center gap-2`}
                  >
                    <span className="font-medium">{s.title}</span>
                    {s.memo && <span className="opacity-70">- {s.memo}</span>}
                    <button onClick={() => handleDelete(s.id)} className="ml-1 opacity-50 hover:opacity-100">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white/80 rounded shadow-sm border border-stone-200 overflow-hidden">
            <div className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
              {/* Hour grid lines */}
              {HOURS.map(h => {
                const displayH = h >= 24 ? h - 24 : h
                return (
                <div
                  key={h}
                  className="absolute w-full border-t border-stone-100 flex"
                  style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                >
                  <div className={`w-14 pr-2 pt-1 text-right text-xs shrink-0 select-none ${h >= 24 ? 'text-stone-300' : 'text-stone-400'}`}>
                    {h >= 24 && <span className="text-[10px] text-stone-300">翌</span>}
                    {String(displayH).padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 border-l border-stone-200" />
                </div>
              )})}


              {/* Now indicator */}
              {isToday && currentMinutes >= START_HOUR * 60 && currentMinutes <= END_HOUR * 60 && (
                <div
                  className="absolute left-14 right-0 z-20 flex items-center pointer-events-none"
                  style={{ top: `${nowLineTop}px` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                </div>
              )}

              {/* Events */}
              {timedEvents.map((item, i) => {
                const style = getEventStyle(item)
                if (!style) return null
                return (
                  <div
                    key={item.id}
                    className={`absolute left-16 right-2 z-10 ${COLORS[i % COLORS.length]} border-l-4 rounded px-2.5 py-1 overflow-hidden cursor-default group`}
                    style={style}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{item.title}</div>
                        <div className="text-xs opacity-70">
                          {item.start_time}{item.end_time ? ` - ${item.end_time}` : ''}
                        </div>
                        {item.memo && <div className="text-xs opacity-60 truncate mt-0.5">{item.memo}</div>}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-0 group-hover:opacity-70 hover:!opacity-100 text-sm shrink-0"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
