import React, { useState, useEffect, useCallback, useRef } from 'react'
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
  'bg-amber-500/10 border-amber-500 text-amber-300',
  'bg-slate-500/10 border-slate-400 text-slate-300',
  'bg-orange-500/10 border-orange-500 text-orange-300',
  'bg-yellow-500/10 border-yellow-500 text-yellow-300',
  'bg-lime-500/10 border-lime-500 text-lime-300',
  'bg-emerald-500/10 border-emerald-500 text-emerald-300',
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

      {/* Two-column layout – stacks on narrow, side-by-side on wide */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Timeline */}
        <div className="w-full lg:w-80 shrink-0">
          <ScheduleTimeline date={date} isToday={isToday} />
        </div>

        {/* Right: Diary + Habits + Goals */}
        <div className="flex-1 min-w-0 w-full space-y-6">
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
          <div className="relative" style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full border-t border-[#1f1f2e] flex"
                style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}>
                <div className="w-11 pr-1 pt-0.5 text-right text-[10px] text-[#5a5a6e] shrink-0 select-none">
                  {String(h).padStart(2, '0')}:00
                </div>
                <div className="flex-1 border-l border-[#2a2a3a]" />
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

// Habit Section
// ══════════════════════════════════════
function HabitSection() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [logs, setLogs] = useState<HabitLog[]>([])
  const [name, setName] = useState('')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  // inline child-add: habitId → current input value
  const [inlineAdd, setInlineAdd] = useState<Record<number, string>>({})

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

  // Add root-level habit
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await apiPost('/api/habits', { name: name.trim() })
    setName('')
    fetchData()
  }

  // Add child habit inline under parentId
  const handleAddChild = async (parentId: number) => {
    const childName = inlineAdd[parentId]?.trim()
    if (!childName) return
    await apiPost('/api/habits', { name: childName, parent_id: parentId })
    setInlineAdd(prev => { const n = { ...prev }; delete n[parentId]; return n })
    // Ensure parent is expanded
    setCollapsed(prev => { const n = new Set(prev); n.delete(parentId); return n })
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

  const openInlineAdd = (parentId: number) => {
    setInlineAdd(prev => prev[parentId] !== undefined ? prev : { ...prev, [parentId]: '' })
    setCollapsed(prev => { const n = new Set(prev); n.delete(parentId); return n })
  }

  const isChecked = (habitId: number, date: string) =>
    logs.some(l => l.habit_id === habitId && l.date === date)

  const tree = buildHabitTree(habits)

  if (loading) return <p className="text-[#5a5a6e] text-sm">読み込み中...</p>

  // Flatten tree for rendering, respecting collapsed state
  const flatRows: { node: HabitNode; depth: number }[] = []
  const walk = (nodes: HabitNode[], depth: number) => {
    for (const n of nodes) {
      flatRows.push({ node: n, depth })
      if (!collapsed.has(n.id)) walk(n.children, depth + 1)
    }
  }
  walk(tree, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-[#8b8b9e] tracking-wider">HABITS</h3>
        <form onSubmit={handleAdd} className="flex gap-1 items-center">
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="新しい習慣..."
            className="bg-[#0e0e12] border border-[#2a2a3a] rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-amber-400/50 text-[#e4e4ec] placeholder:text-[#3a3a4e]" />
          <button type="submit" className="bg-amber-500 text-black font-semibold px-2 py-1 rounded-lg text-xs hover:bg-amber-400 transition-colors">追加</button>
        </form>
      </div>

      {habits.length === 0 ? (
        <p className="text-[#5a5a6e] text-center py-4 text-xs">習慣を追加してみましょう</p>
      ) : (
        <div className="bg-[#16161e] rounded-xl shadow-lg overflow-auto border border-[#2a2a3a]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a3a]">
                <th className="text-left p-2 min-w-[130px] text-[#8b8b9e] text-xs font-medium">習慣</th>
                {days.map(d => {
                  const info = shortDate(d)
                  return (
                    <th key={d} className={`p-1.5 text-center w-10 ${info.isToday ? 'bg-amber-500/5' : ''}`}>
                      <div className={`text-[10px] ${info.isToday ? 'text-amber-400 font-bold' : 'text-[#5a5a6e]'}`}>{info.date}</div>
                      <div className={`text-[10px] ${info.isToday ? 'text-amber-400/70' : 'text-[#5a5a6e]/50'}`}>{info.day}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {flatRows.map(({ node, depth }) => {
                const isGroup = node.children.length > 0 || inlineAdd[node.id] !== undefined
                const hasChildren = node.children.length > 0
                const isCollapsed = collapsed.has(node.id)
                const showingInlineAdd = inlineAdd[node.id] !== undefined
                return (
                  <React.Fragment key={node.id}>
                    <tr className={`border-b border-[#1f1f2e] last:border-0 ${hasChildren ? 'bg-[#0e0e12]/60' : ''}`}>
                      <td className="p-2 text-xs" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
                        <div className="flex items-center gap-1.5">
                          {hasChildren ? (
                            <button onClick={() => toggleCollapse(node.id)}
                              className="text-[#5a5a6e] hover:text-amber-400 transition-colors w-4 shrink-0 text-center leading-none">
                              {isCollapsed ? '▸' : '▾'}
                            </button>
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          <span className={hasChildren ? 'font-semibold text-[#8b8b9e]' : 'font-medium text-[#e4e4ec]'}>
                            {node.name}
                          </span>
                          <span className="flex items-center gap-1 ml-1">
                            {!showingInlineAdd && (
                              <button onClick={() => openInlineAdd(node.id)}
                                title="子習慣を追加"
                                className="text-[#3a3a4e] hover:text-amber-400 transition-colors text-sm w-5 h-5 flex items-center justify-center leading-none">
                                +
                              </button>
                            )}
                            <button onClick={() => handleDeleteHabit(node.id, isGroup)}
                              className="text-[#5a5a6e] hover:text-red-400 transition-colors text-sm w-5 h-5 flex items-center justify-center leading-none">
                              &times;
                            </button>
                          </span>
                        </div>
                      </td>
                      {days.map(d => {
                        const info = shortDate(d)
                        if (hasChildren) {
                          const childIds = node.children.map(c => c.id)
                          const doneCount = childIds.filter(cid => isChecked(cid, d)).length
                          return (
                            <td key={d} className={`p-1.5 text-center ${info.isToday ? 'bg-amber-500/5' : ''}`}>
                              {childIds.length > 0 && (
                                <span className={`text-[10px] font-mono ${doneCount === childIds.length ? 'text-amber-400' : 'text-[#3a3a4e]'}`}>
                                  {doneCount}/{childIds.length}
                                </span>
                              )}
                            </td>
                          )
                        }
                        const checked = isChecked(node.id, d)
                        return (
                          <td key={d} className={`p-1.5 text-center ${info.isToday ? 'bg-amber-500/5' : ''}`}>
                            <button onClick={() => handleToggle(node.id, d)}
                              className={`w-6 h-6 rounded border-2 transition-colors text-xs ${
                                checked ? 'bg-amber-500 border-amber-500 text-black' : 'border-[#2a2a3a] hover:border-amber-500'
                              }`}>
                              {checked ? '✓' : ''}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                    {/* Inline child-add row */}
                    {showingInlineAdd && (
                      <tr className="border-b border-[#1f1f2e] bg-[#0e0e12]/40">
                        <td colSpan={days.length + 1} style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1.5 pr-3">
                          <form onSubmit={e => { e.preventDefault(); handleAddChild(node.id) }} className="flex gap-1 items-center">
                            <span className="text-[#3a3a4e] text-xs mr-0.5">└</span>
                            <input
                              autoFocus
                              value={inlineAdd[node.id] ?? ''}
                              onChange={e => setInlineAdd(prev => ({ ...prev, [node.id]: e.target.value }))}
                              placeholder="子習慣名..."
                              className="flex-1 bg-transparent border-b border-[#2a2a3a] focus:border-amber-500/50 text-xs text-[#e4e4ec] placeholder:text-[#3a3a4e] outline-none py-0.5"
                              onKeyDown={e => {
                                if (e.key === 'Escape') setInlineAdd(prev => { const n = { ...prev }; delete n[node.id]; return n })
                              }}
                            />
                            <button type="submit" className="text-xs text-amber-500 hover:text-amber-400 px-1">追加</button>
                            <button type="button" onClick={() => setInlineAdd(prev => { const n = { ...prev }; delete n[node.id]; return n })}
                              className="text-[10px] text-[#5a5a6e] hover:text-[#8b8b9e]">キャンセル</button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
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
