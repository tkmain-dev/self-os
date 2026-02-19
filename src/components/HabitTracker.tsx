import { useState, useEffect, useCallback } from 'react'
import { apiPost, apiDelete } from '../hooks/useApi'

interface Habit {
  id: number
  name: string
  parent_id: number | null
  sort_order: number
}

interface HabitNode extends Habit {
  children: HabitNode[]
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

export default function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<number | ''>('')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
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
    const body: { name: string; parent_id?: number } = { name: name.trim() }
    if (parentId !== '') body.parent_id = parentId as number
    await apiPost('/api/habits', body)
    setName('')
    fetchData()
  }

  const handleToggle = async (habitId: number, date: string) => {
    await apiPost(`/api/habits/${habitId}/logs`, { date })
    fetchData()
  }

  const handleDeleteHabit = async (id: number, hasChildren: boolean) => {
    const msg = hasChildren
      ? 'このグループと配下の習慣をすべて削除しますか？'
      : 'この習慣を削除しますか？'
    if (!confirm(msg)) return
    await apiDelete(`/api/habits/${id}`)
    fetchData()
  }

  const toggleCollapse = (id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const isChecked = (habitId: number, date: string) =>
    logs.some(l => l.habit_id === habitId && l.date === date)

  const tree = buildHabitTree(habits)
  const rootHabits = habits.filter(h => h.parent_id === null)

  const flatRows: { node: HabitNode; depth: number }[] = []
  const walk = (nodes: HabitNode[], depth: number) => {
    for (const n of nodes) {
      flatRows.push({ node: n, depth })
      if (!collapsed.has(n.id)) walk(n.children, depth + 1)
    }
  }
  walk(tree, 0)

  if (loading) return <p className="text-[#5a5a6e] text-sm">読み込み中...</p>

  return (
    <div className="max-w-3xl">
      <h2 className="techo-heading text-2xl mb-5">習慣トラッカー</h2>

      <form onSubmit={handleAdd} className="flex gap-2 mb-6 items-center">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="習慣名..."
          className="flex-1 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-400/50 placeholder:text-[#3a3a4e]"
        />
        <select value={parentId} onChange={e => setParentId(e.target.value === '' ? '' : Number(e.target.value))}
          className="bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-2 py-2 text-sm text-[#8b8b9e] focus:outline-none focus:ring-2 focus:ring-amber-400/50">
          <option value="">グループなし</option>
          {rootHabits.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <button type="submit" className="bg-amber-500 text-black px-4 py-2 rounded-lg hover:bg-amber-400 text-sm font-semibold transition-colors">追加</button>
      </form>

      {habits.length === 0 ? (
        <p className="text-[#5a5a6e] text-center mt-8 text-sm">習慣を追加してみましょう</p>
      ) : (
        <div className="bg-[#16161e] rounded-xl shadow-lg overflow-auto border border-[#2a2a3a]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a3a]">
                <th className="text-left p-3 min-w-[120px] text-[#8b8b9e] text-sm font-medium">習慣</th>
                {days.map(d => {
                  const info = shortDate(d)
                  return (
                    <th key={d} className={`p-2 text-center w-14 ${info.isToday ? 'bg-amber-500/5' : ''}`}>
                      <div className={`text-xs ${info.isToday ? 'text-amber-400 font-bold' : 'text-[#5a5a6e]'}`}>{info.date}</div>
                      <div className={`text-xs ${info.isToday ? 'text-amber-400/70' : 'text-[#5a5a6e]/50'}`}>{info.day}</div>
                    </th>
                  )
                })}
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map(({ node, depth }) => {
                const isGroup = node.children.length > 0
                const isCollapsed = collapsed.has(node.id)
                return (
                  <tr key={node.id} className={`border-b border-[#1f1f2e] last:border-0 ${isGroup ? 'bg-[#0e0e12]/60' : ''}`}>
                    <td className="p-3 text-sm" style={{ paddingLeft: `${depth * 20 + 12}px` }}>
                      <div className="flex items-center gap-1.5">
                        {isGroup ? (
                          <button onClick={() => toggleCollapse(node.id)}
                            className="text-[#5a5a6e] hover:text-amber-400 transition-colors w-4 shrink-0 text-center">
                            {isCollapsed ? '▸' : '▾'}
                          </button>
                        ) : (
                          <span className="w-4 shrink-0" />
                        )}
                        <span className={isGroup ? 'font-semibold text-[#8b8b9e]' : 'font-medium text-[#e4e4ec]'}>
                          {node.name}
                        </span>
                      </div>
                    </td>
                    {days.map(d => {
                      const info = shortDate(d)
                      if (isGroup) {
                        const childIds = node.children.map(c => c.id)
                        const doneCount = childIds.filter(cid => isChecked(cid, d)).length
                        return (
                          <td key={d} className={`p-2 text-center ${info.isToday ? 'bg-amber-500/5' : ''}`}>
                            {childIds.length > 0 && (
                              <span className={`text-xs font-mono ${doneCount === childIds.length ? 'text-amber-400' : 'text-[#3a3a4e]'}`}>
                                {doneCount}/{childIds.length}
                              </span>
                            )}
                          </td>
                        )
                      }
                      const checked = isChecked(node.id, d)
                      return (
                        <td key={d} className={`p-2 text-center ${info.isToday ? 'bg-amber-500/5' : ''}`}>
                          <button
                            onClick={() => handleToggle(node.id, d)}
                            className={`w-7 h-7 rounded border-2 transition-colors text-sm ${
                              checked ? 'bg-amber-500 border-amber-500 text-black' : 'border-[#2a2a3a] hover:border-amber-500'
                            }`}
                          >
                            {checked ? '✓' : ''}
                          </button>
                        </td>
                      )
                    })}
                    <td className="p-2">
                      <button
                        onClick={() => handleDeleteHabit(node.id, isGroup)}
                        className="text-[#5a5a6e] hover:text-red-400 text-sm transition-colors"
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
