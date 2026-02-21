import { useState, useEffect, useCallback } from 'react'
import { apiPatch } from '../hooks/useApi'
import type { PartialBlock } from '@blocknote/core'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'

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
  note: string | null
  sort_order: number
}

interface TicketDetailModalProps {
  goal: Goal
  onClose: () => void
  onUpdate: () => void
}

// ── Constants ──
const ISSUE_TYPES = {
  epic:    { label: 'Epic',    color: 'text-violet-400',  bg: 'bg-violet-500/15' },
  story:   { label: 'Story',   color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  task:    { label: 'Task',    color: 'text-sky-400',     bg: 'bg-sky-500/15' },
  subtask: { label: 'Subtask', color: 'text-slate-400',   bg: 'bg-slate-500/15' },
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

const COLOR_MAP: Record<string, { bg: string; bar: string }> = {
  amber:  { bg: 'bg-amber-500/15',  bar: 'bg-amber-500' },
  blue:   { bg: 'bg-blue-500/15',   bar: 'bg-blue-500' },
  green:  { bg: 'bg-green-500/15',  bar: 'bg-green-500' },
  purple: { bg: 'bg-purple-500/15', bar: 'bg-purple-500' },
  rose:   { bg: 'bg-rose-500/15',   bar: 'bg-rose-500' },
  teal:   { bg: 'bg-teal-500/15',   bar: 'bg-teal-500' },
}
const COLORS = Object.keys(COLOR_MAP)

export default function TicketDetailModal({ goal, onClose, onUpdate }: TicketDetailModalProps) {
  // ── Metadata state ──
  const [title, setTitle] = useState(goal.title)
  const [issueType, setIssueType] = useState(goal.issue_type)
  const [status, setStatus] = useState(goal.status)
  const [priority, setPriority] = useState(goal.priority)
  const [category, setCategory] = useState(goal.category)
  const [startDate, setStartDate] = useState(goal.start_date)
  const [endDate, setEndDate] = useState(goal.end_date)
  const [color, setColor] = useState(goal.color)

  // ── Note editor state ──
  const [saved, setSaved] = useState(false)
  const [noteLoading, setNoteLoading] = useState(true)
  const [initialContent, setInitialContent] = useState<PartialBlock[] | undefined>(undefined)
  const [hasChanges, setHasChanges] = useState(false)

  // Parse note content on mount
  useEffect(() => {
    if (goal.note) {
      try {
        const parsed = JSON.parse(goal.note) as PartialBlock[]
        setInitialContent(parsed)
      } catch {
        setInitialContent([{ type: 'paragraph', content: '' }])
      }
    } else {
      setInitialContent([{ type: 'paragraph', content: '' }])
    }
    setNoteLoading(false)
  }, [goal.id])

  const editor = useCreateBlockNote({ initialContent })

  // Replace editor blocks when content loads
  useEffect(() => {
    if (!noteLoading && initialContent && editor) {
      editor.replaceBlocks(editor.document, initialContent)
      setHasChanges(false)
    }
  }, [initialContent, noteLoading, editor])

  // Change detection
  useEffect(() => {
    if (editor && !noteLoading) {
      editor.onChange(() => {
        setHasChanges(true)
        setSaved(false)
      })
    }
  }, [editor, noteLoading])

  // Auto-save (5 seconds)
  useEffect(() => {
    if (!hasChanges || noteLoading) return
    const timer = setTimeout(() => { handleSaveNote() }, 5000)
    return () => clearTimeout(timer)
  }, [hasChanges, noteLoading, goal.id])

  // Save note (no refetch — editor must stay stable)
  const handleSaveNote = useCallback(async () => {
    try {
      const blocks = editor.document
      const contentJson = JSON.stringify(blocks)
      await apiPatch(`/api/goals/${goal.id}`, { note: contentJson })
      setSaved(true)
      setHasChanges(false)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('ノート保存エラー:', error)
    }
  }, [editor, goal.id])

  // Save metadata field immediately (no refetch — modal must stay stable)
  const patchField = useCallback(async (fields: Partial<Goal>) => {
    try {
      await apiPatch(`/api/goals/${goal.id}`, fields)
    } catch (error) {
      console.error('更新エラー:', error)
    }
  }, [goal.id])

  // Close handler (save note if unsaved, then refresh parent)
  const handleClose = useCallback(async () => {
    if (hasChanges) {
      await handleSaveNote().catch(() => {})
    }
    onUpdate()
    onClose()
  }, [hasChanges, handleSaveNote, onUpdate, onClose])

  const it = ISSUE_TYPES[issueType]
  const st = STATUSES[status]
  const pr = PRIORITIES[priority]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <div className="bg-[#16161e] rounded-2xl shadow-2xl border border-[#2a2a3a] w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* ── Header: Title + Close ── */}
        <div className="px-6 pt-5 pb-4 border-b border-[#2a2a3a]">
          <div className="flex items-start justify-between gap-4">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={() => { if (title !== goal.title) patchField({ title }) }}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="flex-1 min-w-0 bg-transparent text-xl font-bold text-[#e4e4ec] outline-none border-b-2 border-transparent hover:border-[#2a2a3a] focus:border-amber-500/50 pb-1 transition-colors"
            />
            <button onClick={handleClose}
              className="text-[#5a5a6e] hover:text-[#e4e4ec] text-2xl leading-none shrink-0 mt-1 transition-colors">&times;</button>
          </div>

          {/* ── Badges row ── */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Type */}
            <select value={issueType}
              onChange={e => { const v = e.target.value as Goal['issue_type']; setIssueType(v); patchField({ issue_type: v }) }}
              className={`text-xs px-2 py-1 rounded-md ${it.bg} ${it.color} border-0 cursor-pointer bg-none appearance-none font-medium`}>
              <option value="epic">Epic</option>
              <option value="story">Story</option>
              <option value="task">Task</option>
              <option value="subtask">Subtask</option>
            </select>
            {/* Status */}
            <select value={status}
              onChange={e => {
                const v = e.target.value as Goal['status']
                setStatus(v)
                const progressVal = v === 'done' ? 100 : v === 'todo' ? 0 : undefined
                patchField(progressVal !== undefined ? { status: v, progress: progressVal } : { status: v })
              }}
              className={`text-xs px-2 py-1 rounded-md ${st.bg} ${st.text} border-0 cursor-pointer bg-none appearance-none font-medium`}>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            {/* Priority */}
            <select value={priority}
              onChange={e => { const v = e.target.value as Goal['priority']; setPriority(v); patchField({ priority: v }) }}
              className={`text-xs px-2 py-1 rounded-md bg-[#1e1e2a] ${pr.color} border-0 cursor-pointer bg-none appearance-none font-medium`}>
              <option value="high">↑ High</option>
              <option value="medium">→ Medium</option>
              <option value="low">↓ Low</option>
            </select>
          </div>
        </div>

        {/* ── Metadata section ── */}
        <div className="px-6 py-4 border-b border-[#2a2a3a] space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Category */}
            <div>
              <label className="block text-[10px] font-medium text-[#5a5a6e] mb-1 uppercase tracking-wider">Category</label>
              <input type="text" value={category}
                onChange={e => setCategory(e.target.value)}
                onBlur={() => { if (category !== goal.category) patchField({ category }) }}
                placeholder="e.g. Frontend"
                className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-[#e4e4ec] placeholder-[#3a3a4a] focus:outline-none focus:border-amber-500/40 text-xs" />
            </div>
            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-medium text-[#5a5a6e] mb-1 uppercase tracking-wider">Start</label>
              <input type="date" value={startDate}
                onChange={e => { setStartDate(e.target.value); patchField({ start_date: e.target.value }) }}
                className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-[#e4e4ec] focus:outline-none focus:border-amber-500/40 text-xs" />
            </div>
            {/* End Date */}
            <div>
              <label className="block text-[10px] font-medium text-[#5a5a6e] mb-1 uppercase tracking-wider">End</label>
              <input type="date" value={endDate}
                onChange={e => { setEndDate(e.target.value); patchField({ end_date: e.target.value }) }}
                className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-[#e4e4ec] focus:outline-none focus:border-amber-500/40 text-xs" />
            </div>
            {/* Color */}
            <div>
              <label className="block text-[10px] font-medium text-[#5a5a6e] mb-1 uppercase tracking-wider">Color</label>
              <div className="flex gap-1.5 mt-1">
                {COLORS.map(c => (
                  <button key={c} type="button"
                    onClick={() => { setColor(c); patchField({ color: c }) }}
                    className={`w-6 h-6 rounded-full ${COLOR_MAP[c].bar} transition-all ${
                      color === c ? 'ring-2 ring-offset-1 ring-offset-[#16161e] ring-amber-400 scale-110' : 'opacity-40 hover:opacity-80 hover:scale-105'
                    }`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Note editor section ── */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-[#8b8b9e]">ノート</label>
            <div className="flex items-center gap-3">
              {saved && <span className="text-amber-400 text-xs">保存しました</span>}
              {hasChanges && !saved && <span className="text-[#5a5a6e] text-xs">未保存の変更あり</span>}
              <button onClick={handleSaveNote} disabled={!hasChanges}
                className="bg-amber-500 text-black font-semibold px-4 py-1.5 rounded-lg hover:bg-amber-400 text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                保存
              </button>
            </div>
          </div>
          {noteLoading ? (
            <p className="text-[#5a5a6e] text-sm">読み込み中...</p>
          ) : (
            <div className="bg-[#0e0e12] border border-[#2a2a3a] rounded-xl p-4 min-h-[300px] shadow-inner">
              <BlockNoteView editor={editor} theme="dark" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
