import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useApi, apiPost, apiPatch, apiDelete } from '../hooks/useApi'

// ── Types ──
interface Goal {
  id: number
  parent_id: number | null
  title: string
  issue_type: 'epic' | 'story' | 'task' | 'subtask'
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

// ── SVG Icons ──
const IconEpic = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M9.5 1L3 9h4.5l-1 6L13 7H8.5l1-6z" fill="currentColor"/></svg>
)
const IconStory = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor"/></svg>
)
const IconTask = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
)
const IconSubtask = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="4" fill="currentColor"/></svg>
)

// ── Constants ──
const ISSUE_TYPES = {
  epic:    { label: 'Epic',    icon: <IconEpic />,    color: 'text-violet-400',  bg: 'bg-violet-500/15', border: 'border-violet-500/40', barBg: 'bg-violet-500/15', bar: 'bg-violet-500', barText: 'text-violet-300' },
  story:   { label: 'Story',   icon: <IconStory />,   color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', barBg: 'bg-emerald-500/15', bar: 'bg-emerald-500', barText: 'text-emerald-300' },
  task:    { label: 'Task',    icon: <IconTask />,    color: 'text-sky-400',     bg: 'bg-sky-500/15', border: 'border-sky-500/40', barBg: 'bg-sky-500/15', bar: 'bg-sky-500', barText: 'text-sky-300' },
  subtask: { label: 'Subtask', icon: <IconSubtask />, color: 'text-slate-400',   bg: 'bg-slate-500/15', border: 'border-slate-500/40', barBg: 'bg-slate-500/15', bar: 'bg-slate-500', barText: 'text-slate-300' },
}

const STATUSES = {
  todo:        { label: 'To Do',       bg: 'bg-slate-700',     text: 'text-slate-300' },
  in_progress: { label: 'In Progress', bg: 'bg-blue-900/50',   text: 'text-blue-300' },
  done:        { label: 'Done',        bg: 'bg-green-900/50',  text: 'text-green-300' },
}

const PRIORITIES = {
  high:   { label: 'High',   icon: '↑', color: 'text-red-400' },
  medium: { label: 'Medium', icon: '→', color: 'text-amber-400' },
  low:    { label: 'Low',    icon: '↓', color: 'text-blue-400' },
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

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

// Generate sub-header ticks based on view range
function getSubTicks(viewStart: string, totalDays: number, range: ViewRange, dayWidth: number) {
  const ticks: { offset: number; label: string; isWeekend: boolean; isSunday: boolean }[] = []

  if (range === '1m') {
    // Daily ticks
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(viewStart + 'T00:00:00')
      d.setDate(d.getDate() + i)
      const dow = d.getDay()
      const dayNum = d.getDate()
      // Show label based on available width
      let label = ''
      if (dayWidth >= 28) {
        label = `${dayNum} ${WEEKDAYS[dow]}`
      } else if (dayWidth >= 18) {
        label = `${dayNum}`
      } else {
        // Too narrow: show every other day or every few days
        const step = dayWidth >= 12 ? 2 : dayWidth >= 8 ? 3 : 5
        label = i % step === 0 ? `${dayNum}` : ''
      }
      ticks.push({ offset: i, label, isWeekend: dow === 0 || dow === 6, isSunday: dow === 0 })
    }
  } else if (range === '3m') {
    // Weekly ticks (every Monday or every 7 days)
    const startD = new Date(viewStart + 'T00:00:00')
    // Find first Monday
    let cursor = new Date(startD)
    const startDow = cursor.getDay()
    const daysToMon = startDow === 0 ? 1 : startDow === 1 ? 0 : 8 - startDow
    cursor.setDate(cursor.getDate() + daysToMon)

    while (diffDays(viewStart, formatDate(cursor)) < totalDays) {
      const off = diffDays(viewStart, formatDate(cursor))
      if (off >= 0 && off < totalDays) {
        const d = cursor.getDate()
        const m = cursor.getMonth() + 1
        const label = dayWidth * 7 >= 40 ? `${m}/${d}` : dayWidth * 7 >= 24 ? `${d}` : ''
        ticks.push({ offset: off, label, isWeekend: false, isSunday: false })
      }
      cursor.setDate(cursor.getDate() + 7)
    }
    // Also mark weekends for shading
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(viewStart + 'T00:00:00')
      d.setDate(d.getDate() + i)
      const dow = d.getDay()
      if (dow === 0 || dow === 6) {
        ticks.push({ offset: i, label: '', isWeekend: true, isSunday: dow === 0 })
      }
    }
  } else if (range === '6m') {
    // Weekly grid lines, label every 2 weeks
    const startD = new Date(viewStart + 'T00:00:00')
    let cursor = new Date(startD)
    const startDow = cursor.getDay()
    const daysToMon = startDow === 0 ? 1 : startDow === 1 ? 0 : 8 - startDow
    cursor.setDate(cursor.getDate() + daysToMon)
    let weekCount = 0

    while (diffDays(viewStart, formatDate(cursor)) < totalDays) {
      const off = diffDays(viewStart, formatDate(cursor))
      if (off >= 0 && off < totalDays) {
        const label = weekCount % 2 === 0 && dayWidth * 7 >= 20 ? `${cursor.getMonth() + 1}/${cursor.getDate()}` : ''
        ticks.push({ offset: off, label, isWeekend: false, isSunday: false })
      }
      cursor.setDate(cursor.getDate() + 7)
      weekCount++
    }
  }
  // '1y' → no sub-ticks, month header only

  return ticks
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

// Get all descendant IDs of a node (to prevent cyclic drops)
function getDescendantIds(nodes: TreeNode[], targetId: number): Set<number> {
  const ids = new Set<number>()
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.id === targetId || ids.has(n.parent_id ?? -1)) {
        ids.add(n.id)
      }
      walk(n.children)
    }
  }
  // Find the target node and collect its descendants
  const findAndCollect = (list: TreeNode[]) => {
    for (const n of list) {
      if (n.id === targetId) {
        const collectAll = (node: TreeNode) => {
          ids.add(node.id)
          for (const c of node.children) collectAll(c)
        }
        collectAll(n)
        return
      }
      findAndCollect(n.children)
    }
  }
  findAndCollect(nodes)
  return ids
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

  // Row drag & drop state
  const [dragRowId, setDragRowId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ id: number; position: 'before' | 'child' | 'after' } | null>(null)

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

  // Dynamic DAY_WIDTH based on available Gantt area width
  const ganttAreaRef = useRef<HTMLDivElement>(null)
  const [ganttWidth, setGanttWidth] = useState(0)

  useEffect(() => {
    const el = ganttAreaRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setGanttWidth(entry.contentRect.width)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loading])

  const DAY_WIDTH = ganttWidth > 0 ? ganttWidth / view.days : 12

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

  // Sub-header ticks (day/week labels)
  const subTicks = useMemo(() =>
    getSubTicks(view.start, view.days, viewRange, DAY_WIDTH)
  , [view.start, view.days, viewRange, DAY_WIDTH])

  // Separate weekend shading entries and label ticks
  const weekendDays = useMemo(() => subTicks.filter(t => t.isWeekend), [subTicks])
  const labelTicks = useMemo(() => subTicks.filter(t => !t.isWeekend), [subTicks])

  // For 1m view, all ticks are both labels and potentially weekends
  const dayTicks = useMemo(() => viewRange === '1m' ? subTicks : [], [viewRange, subTicks])

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
    setIssueType(parentType === 'epic' ? 'story' : parentType === 'story' ? 'task' : 'subtask')
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

  // ── Row drag & drop handlers ──
  const handleRowDragStart = useCallback((e: React.DragEvent, nodeId: number) => {
    setDragRowId(nodeId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(nodeId))
  }, [])

  const handleRowDragOver = useCallback((e: React.DragEvent, targetId: number, targetType: Goal['issue_type']) => {
    e.preventDefault()
    if (dragRowId === null || dragRowId === targetId) {
      setDropTarget(null)
      return
    }
    // Prevent drop onto descendants
    const descendants = getDescendantIds(tree, dragRowId)
    if (descendants.has(targetId)) {
      setDropTarget(null)
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const ratio = y / rect.height

    let position: 'before' | 'child' | 'after'
    if (targetType === 'subtask') {
      // Subtasks can't accept children, only before/after
      position = ratio < 0.5 ? 'before' : 'after'
    } else {
      position = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'child'
    }

    setDropTarget(prev => {
      if (prev?.id === targetId && prev?.position === position) return prev
      return { id: targetId, position }
    })
  }, [dragRowId, tree])

  const handleRowDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the row entirely
    const related = e.relatedTarget as HTMLElement | null
    if (!e.currentTarget.contains(related)) {
      setDropTarget(null)
    }
  }, [])

  const handleRowDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    if (!dropTarget || dragRowId === null || !goals) return

    const targetNode = goals.find(g => g.id === dropTarget.id)
    if (!targetNode) return

    if (dropTarget.position === 'child') {
      // Make dragged item a child of target
      const siblings = goals.filter(g => g.parent_id === dropTarget.id)
      const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.sort_order)) : 0
      await apiPatch(`/api/goals/${dragRowId}`, {
        parent_id: dropTarget.id,
        sort_order: maxOrder + 1,
      })
    } else {
      // Insert before or after target as sibling
      const newParentId = targetNode.parent_id
      const siblings = goals.filter(g =>
        (newParentId ? g.parent_id === newParentId : g.parent_id === null || g.parent_id === 0) && g.id !== dragRowId
      ).sort((a, b) => a.sort_order - b.sort_order)

      const targetIndex = siblings.findIndex(s => s.id === dropTarget.id)
      const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1

      // Build new order
      const ordered = [...siblings]
      const draggedGoal = goals.find(g => g.id === dragRowId)
      if (draggedGoal) {
        ordered.splice(insertIndex, 0, draggedGoal)
      }

      // Update parent_id first
      await apiPatch(`/api/goals/${dragRowId}`, { parent_id: newParentId })

      // Reorder siblings
      const orders = ordered.map((g, i) => ({ id: g.id, sort_order: i + 1 }))
      await apiPost('/api/goals/reorder', { orders })
    }

    setDragRowId(null)
    setDropTarget(null)
    refetch()
  }, [dropTarget, dragRowId, goals, refetch])

  const handleRowDragEnd = useCallback(() => {
    setDragRowId(null)
    setDropTarget(null)
  }, [])

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
            Delete {selected.size}
          </button>
        )}
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          className={`${selected.size === 0 ? 'ml-auto' : ''} bg-amber-500 text-black font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-400 text-sm transition-colors`}>
          + 作成
        </button>
      </div>

      {/* Add/Edit form – modal overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); resetForm() } }}>
          <form onSubmit={handleSubmit}
            className="bg-[#16161e] rounded-2xl shadow-2xl border border-[#2a2a3a] w-full max-w-lg mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="px-6 pt-5 pb-4 border-b border-[#2a2a3a]">
              <h3 className="text-lg font-bold text-[#e4e4ec] tracking-tight">
                {editId ? 'Edit Item' : 'Create New Item'}
              </h3>
              {addParentId && !editId && (
                <p className="text-xs text-[#5a5a6e] mt-1">Adding as child of #{addParentId}</p>
              )}
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs to be done?"
                  className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] placeholder-[#5a5a6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/50 transition-all text-sm" autoFocus />
              </div>

              {/* Type / Status / Priority row */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Type</label>
                  <select value={issueType} onChange={e => setIssueType(e.target.value as Goal['issue_type'])}
                    className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm cursor-pointer">
                    <option value="epic">Epic</option>
                    <option value="story">Story</option>
                    <option value="task">Task</option>
                    <option value="subtask">Subtask</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value as Goal['status'])}
                    className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm cursor-pointer">
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Priority</label>
                  <select value={priority} onChange={e => setPriority(e.target.value as Goal['priority'])}
                    className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm cursor-pointer">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              {/* Category + Dates */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Category</label>
                  <input type="text" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Frontend"
                    className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] placeholder-[#5a5a6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Start</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">End</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm" />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Color</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full ${COLOR_MAP[c].bar} transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-[#16161e] ring-amber-400 scale-110' : 'opacity-50 hover:opacity-90 hover:scale-105'}`} />
                  ))}
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className="block text-xs font-medium text-[#8b8b9e] mb-1.5">Memo</label>
                <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="Optional notes..."
                  className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2.5 text-[#e4e4ec] placeholder-[#5a5a6e] focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm" />
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-[#2a2a3a] flex gap-3 justify-end bg-[#0e0e12]/50">
              <button type="button" onClick={() => { setShowForm(false); resetForm() }}
                className="px-5 py-2.5 rounded-lg text-[#8b8b9e] hover:bg-[#252535] hover:text-[#e4e4ec] text-sm transition-colors">
                Cancel
              </button>
              <button type="submit"
                className="bg-amber-500 text-black font-semibold px-6 py-2.5 rounded-lg hover:bg-amber-400 text-sm transition-all hover:shadow-lg hover:shadow-amber-500/20">
                {editId ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* WBS Gantt */}
      {goals && goals.length === 0 ? (
        <p className="text-[#5a5a6e] text-center mt-12 text-sm">Create your first goal to get started</p>
      ) : (
        <div className="bg-[#16161e] rounded-xl shadow-lg border border-[#2a2a3a] overflow-hidden">
          <div className="flex">
            {/* Left: WBS table */}
            <div className="w-[560px] shrink-0 border-r border-[#2a2a3a]">
              {/* Table header - height matches gantt header rows */}
              <div className={`flex items-center border-b border-[#2a2a3a] bg-[#1e1e2a] text-xs font-bold text-[#8b8b9e]`}
                style={{ height: viewRange !== '1y' ? '52px' : '28px' }}>
                <div className="w-7 flex items-center justify-center shrink-0">
                  <input type="checkbox"
                    checked={flatList.length > 0 && selected.size === flatList.length}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" />
                </div>
                <div className="w-16 text-center shrink-0">Type</div>
                <div className="flex-1 px-2">Title</div>
                <div className="w-20 text-center shrink-0">Status</div>
                <div className="w-10 text-center shrink-0">Pri</div>
                <div className="w-12 text-center shrink-0">%</div>
                <div className="w-20 shrink-0"></div>
              </div>

              {/* Rows */}
              {flatList.map(node => {
                const it = ISSUE_TYPES[node.issue_type]
                const st = STATUSES[node.status]
                const pr = PRIORITIES[node.priority]
                const hasChildren = node.children.length > 0
                const isCollapsed = collapsed.has(node.id)
                const progress = hasChildren ? calcProgress(node) : (node.status === 'done' ? 100 : node.progress)

                const isDragOver = dropTarget?.id === node.id
                const dropPos = isDragOver ? dropTarget.position : null

                return (
                  <div key={node.id}
                    draggable
                    onDragStart={e => handleRowDragStart(e, node.id)}
                    onDragOver={e => handleRowDragOver(e, node.id, node.issue_type)}
                    onDragLeave={handleRowDragLeave}
                    onDrop={handleRowDrop}
                    onDragEnd={handleRowDragEnd}
                    className={`${ROW_H} flex items-center border-b border-[#1f1f2e] hover:bg-[#1e1e2a] group text-xs relative
                      ${selected.has(node.id) ? 'bg-amber-500/5' : ''}
                      ${dragRowId === node.id ? 'opacity-40' : ''}
                      ${dropPos === 'child' ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40' : ''}
                    `}>
                    {/* Checkbox */}
                    <div className="w-7 flex items-center justify-center shrink-0">
                      <input type="checkbox"
                        checked={selected.has(node.id)}
                        onChange={() => toggleSelect(node.id)}
                        className="w-3.5 h-3.5 accent-amber-500 cursor-pointer" />
                    </div>
                    {/* Type badge */}
                    <div className="w-16 flex items-center justify-center shrink-0">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${it.bg} border ${it.border} ${it.color} text-[10px] font-medium`}>
                        {it.icon}
                        <span className="hidden sm:inline">{it.label}</span>
                      </span>
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
                    <div className="w-20 text-center shrink-0">
                      <select
                        value={node.status}
                        onChange={e => handleStatusChange(node, e.target.value as Goal['status'])}
                        className={`text-[10px] px-1.5 py-0.5 rounded ${st.bg} ${st.text} border-0 cursor-pointer`}>
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div className={`w-10 text-center shrink-0 ${pr.color} font-bold`} title={pr.label}>
                      {pr.icon}
                    </div>

                    {/* Progress */}
                    <div className="w-12 text-center shrink-0 text-[#8b8b9e]">
                      {progress}%
                    </div>

                    {/* Actions */}
                    <div className="w-20 shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 justify-center">
                      {node.issue_type !== 'subtask' && (
                        <button onClick={() => openAddChild(node.id, node.issue_type)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-sky-500/10 text-sky-400 hover:bg-sky-500/25 hover:text-sky-300 text-sm font-bold transition-colors" title="Add child">+</button>
                      )}
                      <button onClick={() => openEdit(node)}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#5a5a6e] hover:bg-[#252535] hover:text-[#e4e4ec] text-xs transition-colors" title="Edit">✎</button>
                      <button onClick={() => handleDelete(node.id)}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#5a5a6e] hover:bg-red-500/15 hover:text-red-400 text-sm transition-colors" title="Delete">&times;</button>
                    </div>
                    {/* Drop indicators */}
                    {dropPos === 'before' && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400 z-10 pointer-events-none">
                        <div className="absolute -left-0.5 -top-1 w-2 h-2 rounded-full bg-amber-400" />
                      </div>
                    )}
                    {dropPos === 'after' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 z-10 pointer-events-none">
                        <div className="absolute -left-0.5 -top-1 w-2 h-2 rounded-full bg-amber-400" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Right: Gantt chart area */}
            <div ref={ganttAreaRef} className="flex-1 min-w-0 overflow-hidden">
                {/* Month headers – absolute positioning to align with row grid */}
                <div className="h-7 relative border-b border-[#2a2a3a] bg-[#1e1e2a]">
                  {months.map((m, i) => (
                    <div key={i} className="absolute top-0 bottom-0 flex items-center justify-center text-xs text-[#8b8b9e] font-medium"
                      style={{ left: `${m.left * DAY_WIDTH}px`, width: `${m.width * DAY_WIDTH}px` }}>
                      {m.label}
                    </div>
                  ))}
                  {/* Month boundary lines */}
                  {months.map((m, i) => i > 0 && (
                    <div key={`mbl${i}`} className="absolute top-0 bottom-0 w-px bg-[#3a3a4a] pointer-events-none"
                      style={{ left: `${m.left * DAY_WIDTH}px` }} />
                  ))}
                </div>

                {/* Sub-header: day/week labels */}
                {viewRange !== '1y' && (
                  <div className="h-6 relative border-b border-[#2a2a3a] bg-[#1a1a28] flex">
                    {viewRange === '1m' ? (
                      // Daily cells
                      dayTicks.map((t, i) => (
                        <div key={i}
                          className={`flex items-center justify-center text-[9px] border-r border-[#1f1f2e] shrink-0
                            ${t.isWeekend ? 'text-[#5a5a6e] bg-[#13131d]' : 'text-[#7a7a90]'}
                            ${t.isSunday ? 'text-red-400/60' : ''}`}
                          style={{ width: `${DAY_WIDTH}px` }}>
                          {t.label}
                        </div>
                      ))
                    ) : (
                      // Week ticks for 3m/6m + month boundaries
                      <>
                        {labelTicks.map((t, i) => (
                          <div key={`w${i}`}
                            className="absolute top-0 bottom-0 flex items-center text-[9px] text-[#7a7a90] pointer-events-none"
                            style={{ left: `${t.offset * DAY_WIDTH}px` }}>
                            <div className="border-l border-[#1f1f2e] h-full" />
                            {t.label && (
                              <span className="ml-1 whitespace-nowrap">{t.label}</span>
                            )}
                          </div>
                        ))}
                        {/* Month boundary lines (stronger) */}
                        {months.map((m, i) => i > 0 && (
                          <div key={`mb${i}`}
                            className="absolute top-0 bottom-0 w-px bg-[#3a3a4a] pointer-events-none"
                            style={{ left: `${m.left * DAY_WIDTH}px` }} />
                        ))}
                      </>
                    )}
                  </div>
                )}

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
                    const it = ISSUE_TYPES[node.issue_type]
                    const c = { bg: it.barBg, bar: it.bar, text: it.barText }
                    const progress = node.children.length > 0 ? calcProgress(node) : (node.status === 'done' ? 100 : node.progress)
                    const isEpic = node.issue_type === 'epic'
                    const isDragging = dd !== null

                    return (
                      <div key={node.id} className={`${ROW_H} relative border-b border-[#1f1f2e]`}>
                        {/* Grid lines + weekend shading */}
                        {viewRange === '1m' ? (
                          // Daily grid: shade weekends, line per day
                          <>
                            {dayTicks.map((t, i) => (
                              <div key={i} className={`absolute top-0 bottom-0 border-l border-[#1f1f2e] ${t.isWeekend ? 'bg-[#13131d]' : ''}`}
                                style={{ left: `${t.offset * DAY_WIDTH}px`, width: `${DAY_WIDTH}px` }} />
                            ))}
                          </>
                        ) : viewRange === '3m' ? (
                          // Weekly grid + weekend shading
                          <>
                            {weekendDays.map((t, i) => (
                              <div key={`we${i}`} className="absolute top-0 bottom-0 bg-[#13131d]"
                                style={{ left: `${t.offset * DAY_WIDTH}px`, width: `${DAY_WIDTH}px` }} />
                            ))}
                            {labelTicks.map((t, i) => (
                              <div key={`wl${i}`} className="absolute top-0 bottom-0 border-l border-[#1f1f2e]"
                                style={{ left: `${t.offset * DAY_WIDTH}px` }} />
                            ))}
                          </>
                        ) : viewRange === '6m' ? (
                          // Weekly grid lines + month boundaries
                          <>
                            {labelTicks.map((t, i) => (
                              <div key={`sl${i}`} className="absolute top-0 bottom-0 border-l border-[#1f1f2e]"
                                style={{ left: `${t.offset * DAY_WIDTH}px` }} />
                            ))}
                            {months.map((m, i) => i > 0 && (
                              <div key={`mb${i}`} className="absolute top-0 bottom-0 w-px bg-[#3a3a4a] z-[1] pointer-events-none"
                                style={{ left: `${m.left * DAY_WIDTH}px` }} />
                            ))}
                          </>
                        ) : (
                          // 1y: monthly grid only (from month markers)
                          <>
                            {months.map((m, i) => i > 0 && (
                              <div key={i} className="absolute top-0 bottom-0 w-px bg-[#3a3a4a] pointer-events-none"
                                style={{ left: `${m.left * DAY_WIDTH}px` }} />
                            ))}
                          </>
                        )}

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
      )}
    </div>
  )
}
