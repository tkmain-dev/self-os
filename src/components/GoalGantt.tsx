import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useApi, apiPost, apiPatch, apiDelete } from '../hooks/useApi'

// ── Types ──
interface Goal {
  id: number
  parent_id: number | null
  title: string
  issue_type: 'epic' | 'task' | 'subtask'
  status: 'todo' | 'in_progress' | 'done'
  priority: 'high' | 'medium' | 'low'
  category: string
  start_date: string
  end_date: string
  progress: number
  color: string
  memo: string | null
  sort_order: number
}

interface TreeNode extends Goal {
  children: TreeNode[]
  depth: number
  effectiveStartDate: string
  effectiveEndDate: string
}

// ── Constants ──
const ISSUE_TYPES = {
  epic:    { label: 'エピック', icon: '⚡', color: 'text-purple-400', bg: 'bg-purple-900/30' },
  task:    { label: 'タスク',   icon: '✓',  color: 'text-blue-400',   bg: 'bg-blue-900/30' },
  subtask: { label: 'サブタスク', icon: '•', color: 'text-slate-400',  bg: 'bg-slate-700/30' },
}

const STATUSES = {
  todo:        { label: 'TODO',  bg: 'bg-slate-700', text: 'text-slate-300' },
  in_progress: { label: '進行中', bg: 'bg-blue-900/50',  text: 'text-blue-300' },
  done:        { label: '完了',   bg: 'bg-green-900/50', text: 'text-green-300' },
}

const PRIORITIES = {
  high:   { label: '高', icon: '↑', color: 'text-red-400' },
  medium: { label: '中', icon: '→', color: 'text-amber-400' },
  low:    { label: '低', icon: '↓', color: 'text-blue-400' },
}

const COLOR_MAP: Record<string, { bg: string; bar: string; text: string }> = {
  amber:  { bg: 'bg-amber-500/15',  bar: 'bg-amber-500',  text: 'text-amber-300' },
  blue:   { bg: 'bg-blue-500/15',   bar: 'bg-blue-500',   text: 'text-blue-300' },
  green:  { bg: 'bg-green-500/15',  bar: 'bg-green-500',  text: 'text-green-300' },
  purple: { bg: 'bg-purple-500/15', bar: 'bg-purple-500', text: 'text-purple-300' },
  rose:   { bg: 'bg-rose-500/15',   bar: 'bg-rose-500',   text: 'text-rose-300' },
  teal:   { bg: 'bg-teal-500/15',   bar: 'bg-teal-500',   text: 'text-teal-300' },
}

const COLORS = Object.keys(COLOR_MAP)

// ── Date utilities ──
const formatDate = (d: Date) => d.toISOString().split('T')[0]

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

function diffDays(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}/${d.getMonth() + 1}`
}

// ── View range ──
type ViewRange = '1m' | '3m' | '6m' | '1y'

function getViewDates(range: ViewRange, offset: number) {
  const today = new Date()
  today.setDate(1)
  today.setMonth(today.getMonth() + offset)
  const start = formatDate(today)
  const months = range === '1m' ? 1 : range === '3m' ? 3 : range === '6m' ? 6 : 12
  const end = new Date(today)
  end.setMonth(end.getMonth() + months)
  end.setDate(end.getDate() - 1)
  return { start, end: formatDate(end), days: diffDays(start, formatDate(end)) + 1 }
}

// ── Tree builder ──
function buildTree(goals: Goal[]): TreeNode[] {
  const map = new Map<number, TreeNode>()
  const roots: TreeNode[] = []

  for (const g of goals) {
    map.set(g.id, { ...g, children: [], depth: 0, effectiveStartDate: g.start_date, effectiveEndDate: g.end_date })
  }

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!
      node.depth = parent.depth + 1
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // Sort children by sort_order
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    for (const n of nodes) sortChildren(n.children)
  }
  sortChildren(roots)

  // Calculate effective dates: parent spans min(children start) ~ max(children end)
  const calcDates = (node: TreeNode) => {
    for (const c of node.children) calcDates(c)
    if (node.children.length > 0) {
      node.effectiveStartDate = node.children.reduce((min, c) => c.effectiveStartDate < min ? c.effectiveStartDate : min, node.children[0].effectiveStartDate)
      node.effectiveEndDate = node.children.reduce((max, c) => c.effectiveEndDate > max ? c.effectiveEndDate : max, node.children[0].effectiveEndDate)
    }
  }
  for (const r of roots) calcDates(r)

  return roots
}

function flattenTree(nodes: TreeNode[], collapsed: Set<number>): TreeNode[] {
  const result: TreeNode[] = []
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      result.push(n)
      if (!collapsed.has(n.id)) walk(n.children)
    }
  }
  walk(nodes)
  return result
}

// Calculate progress from children
function calcProgress(node: TreeNode): number {
  if (node.children.length === 0) {
    if (node.status === 'done') return 100
    if (node.status === 'todo') return node.progress
    return node.progress
  }
  const total = node.children.reduce((sum, c) => sum + calcProgress(c), 0)
  return Math.round(total / node.children.length)
}

// ══════════════════════════════════════
// Component
// ══════════════════════════════════════
export default function GoalGantt() {
  const { data: goals, loading, refetch } = useApi<Goal[]>('/api/goals')
  const [viewRange, setViewRange] = useState<ViewRange>('3m')
  const [offset, setOffset] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [addParentId, setAddParentId] = useState<number | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // Inline title editing
  const [editingTitleId, setEditingTitleId] = useState<number | null>(null)
  const [editingTitleValue, setEditingTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingTitleId !== null && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitleId])

  // Form state
  const [title, setTitle] = useState('')
  const [issueType, setIssueType] = useState<Goal['issue_type']>('task')
  const [status, setStatus] = useState<Goal['status']>('todo')
  const [priority, setPriority] = useState<Goal['priority']>('medium')
  const [category, setCategory] = useState('')
  const [startDate, setStartDate] = useState(formatDate(new Date()))
  const [endDate, setEndDate] = useState(addDays(formatDate(new Date()), 30))
  const [color, setColor] = useState('amber')
  const [memo, setMemo] = useState('')

  const view = useMemo(() => getViewDates(viewRange, offset), [viewRange, offset])
  const todayStr = formatDate(new Date())
  const todayOffset = diffDays(view.start, todayStr)
  const DAY_WIDTH = viewRange === '1m' ? 28 : viewRange === '3m' ? 12 : viewRange === '6m' ? 6 : 3

  const tree = useMemo(() => goals ? buildTree(goals) : [], [goals])
  const flatList = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed])

  // Month markers
  const months = useMemo(() => {
    const result: { label: string; left: number; width: number }[] = []
    let cursor = new Date(view.start + 'T00:00:00')
    while (formatDate(cursor) <= view.end) {
      const monthStart = formatDate(cursor)
      const nextMonth = new Date(cursor)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      nextMonth.setDate(1)
      const monthEnd = formatDate(nextMonth) > view.end ? view.end : addDays(formatDate(nextMonth), -1)
      const left = diffDays(view.start, monthStart)
      const width = diffDays(monthStart, monthEnd) + 1
      result.push({ label: getMonthLabel(monthStart), left, width })
      cursor = nextMonth
    }
    return result
  }, [view])

  const toggleCollapse = useCallback((id: number) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const resetForm = () => {
    setTitle(''); setIssueType('task'); setStatus('todo'); setPriority('medium')
    setCategory(''); setStartDate(formatDate(new Date()))
    setEndDate(addDays(formatDate(new Date()), 30)); setColor('amber'); setMemo('')
    setEditId(null); setAddParentId(null)
  }

  const openEdit = (g: Goal) => {
    setTitle(g.title); setIssueType(g.issue_type); setStatus(g.status); setPriority(g.priority)
    setCategory(g.category); setStartDate(g.start_date); setEndDate(g.end_date)
    setColor(g.color); setMemo(g.memo || ''); setEditId(g.id); setAddParentId(g.parent_id)
    setShowForm(true)
  }

  const openAddChild = (parentId: number, parentType: Goal['issue_type']) => {
    resetForm()
    setAddParentId(parentId)
    setIssueType(parentType === 'epic' ? 'task' : 'subtask')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !startDate || !endDate) return
    const body = {
      parent_id: addParentId,
      title: title.trim(),
      issue_type: issueType,
      status,
      priority,
      category,
      start_date: startDate,
      end_date: endDate,
      color,
      memo: memo || null,
    }
    if (editId) {
      await apiPatch(`/api/goals/${editId}`, body)
    } else {
      await apiPost('/api/goals', body)
    }
    resetForm(); setShowForm(false); refetch()
  }

  const handleDelete = async (id: number) => {
    await apiDelete(`/api/goals/${id}`)
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next })
    refetch()
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === flatList.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(flatList.map(n => n.id)))
    }
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    for (const id of selected) {
      await apiDelete(`/api/goals/${id}`)
    }
    setSelected(new Set())
    refetch()
  }

  const startTitleEdit = (g: Goal) => {
    setEditingTitleId(g.id)
    setEditingTitleValue(g.title)
  }

  const handleTitleSave = async () => {
    if (editingTitleId === null) return
    const trimmed = editingTitleValue.trim()
    if (trimmed) {
      await apiPatch(`/api/goals/${editingTitleId}`, { title: trimmed })
      refetch()
    }
    setEditingTitleId(null)
    setEditingTitleValue('')
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleSave()
    } else if (e.key === 'Escape') {
      setEditingTitleId(null)
      setEditingTitleValue('')
    }
  }

  const handleStatusChange = async (g: Goal, newStatus: Goal['status']) => {
    const progress = newStatus === 'done' ? 100 : newStatus === 'todo' ? 0 : g.progress
    await apiPatch(`/api/goals/${g.id}`, { status: newStatus, progress })
    refetch()
  }

  // ── Drag state for Gantt bars ──
  const dragRef = useRef<{
    id: number
    type: 'move' | 'resize-left' | 'resize-right'
    startX: number
    origStartDate: string
    origEndDate: string
  } | null>(null)
  const dragDeltaRef = useRef<{ id: number; startDays: number; endDays: number } | null>(null)
  const [dragDelta, setDragDelta] = useState<{ id: number; startDays: number; endDays: number } | null>(null)
  const dayWidthRef = useRef(DAY_WIDTH)
  dayWidthRef.current = DAY_WIDTH
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  const handleBarMouseDown = useCallback((e: React.MouseEvent, node: Goal, type: 'move' | 'resize-left' | 'resize-right') => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = {
      id: node.id,
      type,
      startX: e.clientX,
      origStartDate: node.start_date,
      origEndDate: node.end_date,
    }
    dragDeltaRef.current = null
    setDragDelta(null)

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = ev.clientX - dragRef.current.startX
      const daysDelta = Math.round(dx / dayWidthRef.current)
      const t = dragRef.current.type

      let startDays = 0
      let endDays = 0
      if (t === 'move') {
        startDays = daysDelta
        endDays = daysDelta
      } else if (t === 'resize-left') {
        const origLen = diffDays(dragRef.current.origStartDate, dragRef.current.origEndDate)
        startDays = Math.min(daysDelta, origLen)
        endDays = 0
      } else {
        const origLen = diffDays(dragRef.current.origStartDate, dragRef.current.origEndDate)
        startDays = 0
        endDays = Math.max(daysDelta, -origLen)
      }
      const newDelta = { id: dragRef.current.id, startDays, endDays }
      dragDeltaRef.current = newDelta
      setDragDelta(newDelta)
    }

    const onMouseUp = async () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      if (!dragRef.current) return
      const d = dragRef.current
      const delta = dragDeltaRef.current
      dragRef.current = null
      dragDeltaRef.current = null
      setDragDelta(null)
      if (delta && (delta.startDays !== 0 || delta.endDays !== 0)) {
        const newStart = addDays(d.origStartDate, delta.startDays)
        const newEnd = addDays(d.origEndDate, delta.endDays)
        await apiPatch(`/api/goals/${d.id}`, { start_date: newStart, end_date: newEnd })
        refetchRef.current()
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  if (loading) return <p className="text-[#5a5a6e]">読み込み中...</p>

  const ROW_H = 'h-11'

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="techo-heading text-2xl mr-2">目標管理 (WBS)</h2>
        <div className="flex gap-1 bg-[#1e1e2a] rounded-lg p-0.5">
          {(['1m', '3m', '6m', '1y'] as ViewRange[]).map(r => (
            <button key={r} onClick={() => { setViewRange(r); setOffset(0) }}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ${viewRange === r ? 'bg-[#16161e] text-[#e4e4ec] shadow-sm' : 'text-[#8b8b9e] hover:text-[#e4e4ec]'}`}>
              {r === '1m' ? '1ヶ月' : r === '3m' ? '3ヶ月' : r === '6m' ? '半年' : '1年'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setOffset(o => o - 1)} className="px-2 py-1 bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg hover:bg-[#252535] text-[#8b8b9e] hover:text-[#e4e4ec] text-xs transition-colors">&larr;</button>
          <button onClick={() => setOffset(0)} className="px-2 py-1 bg-[#1e1e2a] text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/10 text-xs transition-colors">今月</button>
          <button onClick={() => setOffset(o => o + 1)} className="px-2 py-1 bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg hover:bg-[#252535] text-[#8b8b9e] hover:text-[#e4e4ec] text-xs transition-colors">&rarr;</button>
        </div>
        {selected.size > 0 && (
          <button onClick={handleBulkDelete}
            className="ml-auto bg-red-600 text-white px-4 py-1.5 rounded-lg hover:bg-red-500 text-sm transition-colors">
            {selected.size}件を削除
          </button>
        )}
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className={`${selected.size === 0 ? 'ml-auto' : ''} bg-amber-500 text-black font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-400 text-sm transition-colors`}>
          + 作成
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#16161e] rounded-xl p-4 shadow-lg mb-4 border border-[#2a2a3a]">
          {addParentId && !editId && (
            <p className="text-xs text-[#8b8b9e] mb-2">
              親アイテム ID: {addParentId} の子として追加
            </p>
          )}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 mb-3">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="タイトル"
              className="border border-stone-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/50" autoFocus />
            <select value={issueType} onChange={e => setIssueType(e.target.value as Goal['issue_type'])}
              className="border border-stone-300 rounded px-3 py-2">
              <option value="epic">エピック</option>
              <option value="task">タスク</option>
              <option value="subtask">サブタスク</option>
            </select>
            <select value={status} onChange={e => setStatus(e.target.value as Goal['status'])}
              className="border border-stone-300 rounded px-3 py-2">
              <option value="todo">TODO</option>
              <option value="in_progress">進行中</option>
              <option value="done">完了</option>
            </select>
            <select value={priority} onChange={e => setPriority(e.target.value as Goal['priority'])}
              className="border border-stone-300 rounded px-3 py-2">
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </div>
          <div className="flex gap-3 mb-3 flex-wrap items-end">
            <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="カテゴリ"
              className="w-32 border border-stone-300 rounded px-3 py-2" />
            <div>
              <label className="text-xs text-[#8b8b9e]">開始</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="block border border-stone-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e]">終了</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="block border border-stone-300 rounded px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-[#8b8b9e]">色</label>
              <div className="flex gap-1 mt-1">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full ${COLOR_MAP[c].bar} ${color === c ? 'ring-2 ring-offset-1 ring-offset-[#16161e] ring-[#e4e4ec]' : 'opacity-60 hover:opacity-100'}`} />
                ))}
              </div>
            </div>
          </div>
          <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="メモ（任意）"
            className="w-full border border-stone-300 rounded px-3 py-2 mb-3" />
          <div className="flex gap-2">
            <button type="submit" className="bg-amber-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-amber-400 text-sm transition-colors">
              {editId ? '更新' : '追加'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); resetForm() }} className="px-4 py-2 rounded-lg text-[#8b8b9e] hover:bg-[#252535] text-sm transition-colors">キャンセル</button>
          </div>
        </form>
      )}

      {/* WBS Gantt */}
      {goals && goals.length === 0 ? (
        <p className="text-[#5a5a6e] text-center mt-12 text-sm">目標を追加して、WBSを作成しましょう</p>
      ) : (
        <div className="bg-[#16161e] rounded-xl shadow-lg border border-[#2a2a3a] overflow-auto">
          <div className="flex min-w-fit">
            {/* Left: WBS table */}
            <div className="w-[508px] shrink-0 border-r border-[#2a2a3a]">
              {/* Table header */}
              <div className={`${ROW_H} flex items-center border-b border-[#2a2a3a] bg-[#1e1e2a] text-xs font-bold text-[#8b8b9e]`}>
                <div className="w-7 flex items-center justify-center shrink-0">
                  <input type="checkbox"
                    checked={flatList.length > 0 && selected.size === flatList.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" />
                </div>
                <div className="w-8 text-center shrink-0">種別</div>
                <div className="flex-1 px-2">タイトル</div>
                <div className="w-16 text-center shrink-0">ステータス</div>
                <div className="w-8 text-center shrink-0">優先</div>
                <div className="w-12 text-center shrink-0">進捗</div>
                <div className="w-16 shrink-0"></div>
              </div>

              {/* Rows */}
              {flatList.map(node => {
                const it = ISSUE_TYPES[node.issue_type]
                const st = STATUSES[node.status]
                const pr = PRIORITIES[node.priority]
                const hasChildren = node.children.length > 0
                const isCollapsed = collapsed.has(node.id)
                const progress = hasChildren ? calcProgress(node) : (node.status === 'done' ? 100 : node.progress)

                return (
                  <div key={node.id} className={`${ROW_H} flex items-center border-b border-[#1f1f2e] hover:bg-[#1e1e2a] group text-xs ${selected.has(node.id) ? 'bg-amber-500/5' : ''}`}>
                    {/* Checkbox */}
                    <div className="w-7 flex items-center justify-center shrink-0">
                      <input type="checkbox"
                        checked={selected.has(node.id)}
                        onChange={() => toggleSelect(node.id)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" />
                    </div>
                    {/* Type icon */}
                    <div className={`w-8 text-center shrink-0 ${it.color} font-bold`} title={it.label}>
                      {it.icon}
                    </div>

                    {/* Title with indent and collapse toggle */}
                    <div className="flex-1 flex items-center min-w-0 px-1"
                      style={{ paddingLeft: `${node.depth * 20 + 4}px` }}>
                      {hasChildren ? (
                        <button onClick={() => toggleCollapse(node.id)}
                          className="w-4 h-4 flex items-center justify-center text-[#5a5a6e] hover:text-[#e4e4ec] shrink-0 mr-1">
                          {isCollapsed ? '▸' : '▾'}
                        </button>
                      ) : (
                        <span className="w-4 mr-1 shrink-0" />
                      )}
                      {editingTitleId === node.id ? (
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={editingTitleValue}
                          onChange={e => setEditingTitleValue(e.target.value)}
                          onBlur={handleTitleSave}
                          onKeyDown={handleTitleKeyDown}
                          className="flex-1 min-w-0 px-1 py-0.5 border border-amber-400 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                        />
                      ) : (
                        <span
                          className={`truncate cursor-pointer hover:text-amber-400 ${node.issue_type === 'epic' ? 'font-bold' : ''} ${node.status === 'done' ? 'line-through text-[#5a5a6e]' : ''}`}
                          title={node.title}
                          onClick={() => openEdit(node)}>
                          {node.title}
                        </span>
                      )}
                    </div>

                    {/* Status badge */}
                    <div className="w-16 text-center shrink-0">
                      <select
                        value={node.status}
                        onChange={e => handleStatusChange(node, e.target.value as Goal['status'])}
                        className={`text-[10px] px-1 py-0.5 rounded ${st.bg} ${st.text} border-0 cursor-pointer`}>
                        <option value="todo">TODO</option>
                        <option value="in_progress">進行中</option>
                        <option value="done">完了</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div className={`w-8 text-center shrink-0 ${pr.color} font-bold`} title={pr.label}>
                      {pr.icon}
                    </div>

                    {/* Progress */}
                    <div className="w-12 text-center shrink-0 text-[#8b8b9e]">
                      {progress}%
                    </div>

                    {/* Actions */}
                    <div className="w-16 shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 justify-center">
                      {node.issue_type !== 'subtask' && (
                        <button onClick={() => openAddChild(node.id, node.issue_type)}
                          className="text-[#5a5a6e] hover:text-blue-400" title="子を追加">+</button>
                      )}
                      <button onClick={() => openEdit(node)}
                        className="text-[#5a5a6e] hover:text-[#e4e4ec]" title="編集">✎</button>
                      <button onClick={() => handleDelete(node.id)}
                        className="text-[#5a5a6e] hover:text-red-400" title="削除">&times;</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right: Gantt chart area */}
            <div className="flex-1 min-w-0">
              <div style={{ width: `${view.days * DAY_WIDTH}px` }}>
                {/* Month headers */}
                <div className={`${ROW_H} relative border-b border-[#2a2a3a] flex bg-[#1e1e2a]`}>
                  {months.map((m, i) => (
                    <div key={i} className="border-r border-[#1f1f2e] flex items-center justify-center text-xs text-[#8b8b9e] font-medium"
                      style={{ width: `${m.width * DAY_WIDTH}px` }}>
                      {m.label}
                    </div>
                  ))}
                </div>

                {/* Gantt rows */}
                <div className="relative">
                  {/* Today line */}
                  {todayOffset >= 0 && todayOffset < view.days && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                      style={{ left: `${todayOffset * DAY_WIDTH + DAY_WIDTH / 2}px` }} />
                  )}

                  {flatList.map(node => {
                    const hasChildren = node.children.length > 0
                    // Apply drag delta if dragging this node (only leaf nodes are draggable)
                    const dd = dragDelta?.id === node.id ? dragDelta : null
                    const displayStart = hasChildren ? node.effectiveStartDate : (dd ? addDays(node.start_date, dd.startDays) : node.start_date)
                    const displayEnd = hasChildren ? node.effectiveEndDate : (dd ? addDays(node.end_date, dd.endDays) : node.end_date)

                    const barStart = diffDays(view.start, displayStart)
                    const barEnd = diffDays(view.start, displayEnd)
                    const barLeft = Math.max(0, barStart) * DAY_WIDTH
                    const barRight = Math.min(view.days - 1, barEnd) * DAY_WIDTH + DAY_WIDTH
                    const barWidth = barRight - barLeft
                    const isVisible = barStart < view.days && barEnd >= 0
                    const c = COLOR_MAP[node.color] || COLOR_MAP.amber
                    const progress = node.children.length > 0 ? calcProgress(node) : (node.status === 'done' ? 100 : node.progress)
                    const isEpic = node.issue_type === 'epic'
                    const isDragging = dd !== null

                    return (
                      <div key={node.id} className={`${ROW_H} relative border-b border-[#1f1f2e]`}>
                        {/* Week grid */}
                        {Array.from({ length: Math.ceil(view.days / 7) }, (_, i) => (
                          <div key={i} className="absolute top-0 bottom-0 border-l border-[#1f1f2e]"
                            style={{ left: `${i * 7 * DAY_WIDTH}px` }} />
                        ))}

                        {isVisible && barWidth > 0 && (
                          isEpic ? (
                            // Epic: diamond endpoints with line (Jira style)
                            <div className="absolute top-1/2 -translate-y-1/2 flex items-center"
                              style={{ left: `${barLeft}px`, width: `${barWidth}px` }}>
                              {hasChildren ? (
                                <>
                                  <div className={`w-2.5 h-2.5 ${c.bar} rotate-45 shrink-0 z-10`} />
                                  <div className={`flex-1 h-1 ${c.bar} opacity-50 -mx-1`} />
                                  <div className={`w-2.5 h-2.5 ${c.bar} rotate-45 shrink-0 z-10`} />
                                </>
                              ) : (
                                <>
                                  <div className={`w-2.5 h-2.5 ${c.bar} rotate-45 shrink-0 z-10 cursor-ew-resize`}
                                    onMouseDown={e => handleBarMouseDown(e, node, 'resize-left')} />
                                  <div className={`flex-1 h-1 ${c.bar} opacity-50 -mx-1 cursor-grab`}
                                    onMouseDown={e => handleBarMouseDown(e, node, 'move')} />
                                  <div className={`w-2.5 h-2.5 ${c.bar} rotate-45 shrink-0 z-10 cursor-ew-resize`}
                                    onMouseDown={e => handleBarMouseDown(e, node, 'resize-right')} />
                                </>
                              )}
                              {barWidth > 60 && (
                                <span className={`absolute left-4 text-[10px] font-bold ${c.text} whitespace-nowrap pointer-events-none`}>
                                  {progress}%
                                </span>
                              )}
                            </div>
                          ) : hasChildren ? (
                            // Task with children: auto-sized bar, no drag
                            <div className={`absolute top-2 h-7 ${c.bg} rounded-sm flex items-center`}
                              style={{ left: `${barLeft}px`, width: `${barWidth}px` }}>
                              <div className={`absolute inset-0 ${c.bar} opacity-30 rounded-sm pointer-events-none`}
                                style={{ width: `${progress}%` }} />
                              <span className={`relative z-0 text-[10px] font-bold px-1.5 ${c.text} truncate pointer-events-none`}>
                                {barWidth > 36 ? `${progress}%` : ''}
                              </span>
                            </div>
                          ) : (
                            // Leaf task/subtask: draggable bar
                            <div className={`absolute top-2 h-7 ${c.bg} rounded-sm flex items-center group/bar ${isDragging ? 'opacity-80 cursor-grabbing' : ''}`}
                              style={{ left: `${barLeft}px`, width: `${barWidth}px` }}>
                              <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-white/10 rounded-l-sm"
                                onMouseDown={e => handleBarMouseDown(e, node, 'resize-left')} />
                              <div className="absolute left-2 right-2 top-0 bottom-0 cursor-grab z-10"
                                onMouseDown={e => handleBarMouseDown(e, node, 'move')} />
                              <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 hover:bg-white/10 rounded-r-sm"
                                onMouseDown={e => handleBarMouseDown(e, node, 'resize-right')} />
                              <div className={`absolute inset-0 ${c.bar} opacity-30 rounded-sm pointer-events-none`}
                                style={{ width: `${progress}%` }} />
                              <span className={`relative z-0 text-[10px] font-bold px-1.5 ${c.text} truncate pointer-events-none`}>
                                {isDragging
                                  ? (barWidth > 100 ? `${displayStart} ~ ${displayEnd}` : '')
                                  : (barWidth > 36 ? `${progress}%` : '')}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
