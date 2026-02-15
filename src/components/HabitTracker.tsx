import { useState, useEffect, useCallback } from 'react'
import { apiPost, apiDelete } from '../hooks/useApi'

interface Habit {
  id: number
  name: string
}

interface HabitLog {
  habit_id: number
  date: string
}

const formatDate = (d: Date) => d.toISOString().split('T')[0]

function getLast7Days(): string[] {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(formatDate(d))
  }
  return days
}

const dayNames = ['日', '月', '火', '水', '木', '金', '土']

function shortDate(dateStr: string): { date: string; day: string; isToday: boolean } {
  const d = new Date(dateStr + 'T00:00:00')
  return {
    date: `${d.getMonth() + 1}/${d.getDate()}`,
    day: dayNames[d.getDay()],
    isToday: dateStr === formatDate(new Date()),
  }
}

export default function HabitTracker() {
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

  if (loading) return <p className="text-stone-400">読み込み中...</p>

  return (
    <div className="max-w-3xl">
      <h2 className="techo-heading text-2xl mb-5">習慣トラッカー</h2>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="新しい習慣..."
          className="flex-1 bg-white/80 border border-stone-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
        <button type="submit" className="bg-stone-700 text-white px-4 py-2 rounded hover:bg-stone-800 text-sm">追加</button>
      </form>

      {habits.length === 0 ? (
        <p className="text-stone-400 text-center mt-8 text-sm">習慣を追加してみましょう</p>
      ) : (
        <div className="bg-white/80 rounded shadow-sm overflow-auto border border-stone-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left p-3 min-w-[120px] text-stone-600 text-sm font-medium">習慣</th>
                {days.map(d => {
                  const info = shortDate(d)
                  return (
                    <th key={d} className={`p-2 text-center w-14 ${info.isToday ? 'bg-amber-50' : ''}`}>
                      <div className={`text-xs ${info.isToday ? 'text-amber-700 font-bold' : 'text-stone-400'}`}>{info.date}</div>
                      <div className={`text-xs ${info.isToday ? 'text-amber-600' : 'text-stone-300'}`}>{info.day}</div>
                    </th>
                  )
                })}
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {habits.map(habit => (
                <tr key={habit.id} className="border-b border-stone-100 last:border-0">
                  <td className="p-3 font-medium text-stone-700 text-sm">{habit.name}</td>
                  {days.map(d => {
                    const info = shortDate(d)
                    const checked = isChecked(habit.id, d)
                    return (
                      <td key={d} className={`p-2 text-center ${info.isToday ? 'bg-amber-50' : ''}`}>
                        <button
                          onClick={() => handleToggle(habit.id, d)}
                          className={`w-7 h-7 rounded border-2 transition-colors text-sm ${
                            checked
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'border-stone-300 hover:border-amber-500'
                          }`}
                        >
                          {checked ? '✓' : ''}
                        </button>
                      </td>
                    )
                  })}
                  <td className="p-2">
                    <button
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="text-stone-300 hover:text-red-500 text-sm"
                    >
                      &times;
                    </button>
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
