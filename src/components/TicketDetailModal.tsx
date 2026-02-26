import { useState, useEffect, useCallback, useRef } from 'react'
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
  scheduled_time: string | null
  scheduled_duration: number | null
  milestone_date: string | null
  milestone_label: string | null
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
const MONTHS_JP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const DAYS_JP   = ['日','月','火','水','木','金','土']

// ── Custom date picker popover ──
function DatePickerPopover({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  const init = value ? new Date(value + 'T00:00:00') : today
  const [open, setOpen] = useState(false)
  const [vy, setVy] = useState(init.getFullYear())
  const [vm, setVm] = useState(init.getMonth())
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const fn = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  // Sync view when value changes externally
  useEffect(() => {
    if (value) { const d = new Date(value + 'T00:00:00'); setVy(d.getFullYear()); setVm(d.getMonth()) }
  }, [value])

  const prevM = () => vm === 0 ? (setVy(y => y-1), setVm(11)) : setVm(m => m-1)
  const nextM = () => vm === 11 ? (setVy(y => y+1), setVm(0)) : setVm(m => m+1)

  const firstDow = new Date(vy, vm, 1).getDay()
  const daysInMonth = new Date(vy, vm+1, 0).getDate()
  const cells: (number|null)[] = [...Array(firstDow).fill(null), ...Array.from({length: daysInMonth}, (_,i)=>i+1)]

  const pick = (day: number) => {
    onChange(`${vy}-${String(vm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)
    setOpen(false)
  }
  const goToday = () => {
    const t = new Date()
    setVy(t.getFullYear()); setVm(t.getMonth())
    pick(t.getDate())
  }

  const display = value ? value.replace(/-/g, '/') : ''

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between bg-[#0e0e12] border rounded-lg px-3 py-2 text-xs transition-colors ${open ? 'border-amber-500/50 ring-1 ring-amber-500/20' : 'border-[#2a2a3a] hover:border-[#3a3a4a]'}`}>
        <span className={value ? 'text-[#e4e4ec] font-mono tracking-wide' : 'text-[#3a3a4a] italic'}>
          {display || '日付を選択...'}
        </span>
        {value
          ? <div className="w-2 h-2 bg-amber-400 rotate-45 shrink-0" style={{ boxShadow: '0 0 4px rgba(251,191,36,0.5)' }} />
          : <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-[#3a3a4a] shrink-0">
              <rect x="2" y="4" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M5 2v3M11 2v3M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
        }
      </button>

      {/* Calendar popover */}
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 w-64 select-none"
          style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.8))' }}>
          <div className="bg-[#0e0e12] border border-[#2a2a3a] rounded-2xl overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(251,191,36,0.10) inset' }}>

            {/* Month / year header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a28]">
              <button type="button" onClick={prevM}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a5a6e] hover:text-amber-400 hover:bg-amber-500/8 transition-colors text-sm">
                ‹
              </button>
              <span className="text-[13px] font-bold text-[#e4e4ec] tracking-tight">
                {vy}<span className="text-[#5a5a6e] font-normal text-[11px] mx-0.5">年</span>{MONTHS_JP[vm]}
              </span>
              <button type="button" onClick={nextM}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#5a5a6e] hover:text-amber-400 hover:bg-amber-500/8 transition-colors text-sm">
                ›
              </button>
            </div>

            <div className="px-3 pt-2 pb-3">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_JP.map((d, i) => (
                  <div key={d} className={`text-center text-[10px] font-semibold py-1 ${i===0?'text-rose-400/70':i===6?'text-sky-400/70':'text-[#3a3a4a]'}`}>{d}</div>
                ))}
              </div>

              {/* Day grid */}
              <div className="grid grid-cols-7 gap-y-0.5">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`x${i}`} />
                  const dow = (firstDow + day - 1) % 7
                  const ds = `${vy}-${String(vm+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const isSel = value === ds
                  const isToday = todayStr === ds
                  return (
                    <button key={day} type="button" onClick={() => pick(day)}
                      className={`w-8 h-8 mx-auto flex items-center justify-center text-[11px] rounded-lg font-medium transition-all ${
                        isSel
                          ? 'bg-amber-500 text-black shadow-lg'
                          : isToday
                          ? 'text-amber-400 ring-1 ring-amber-500/50 hover:bg-amber-500/15'
                          : dow===0
                          ? 'text-rose-400/70 hover:bg-[#1a1a28] hover:text-rose-300'
                          : dow===6
                          ? 'text-sky-400/70 hover:bg-[#1a1a28] hover:text-sky-300'
                          : 'text-[#8b8b9e] hover:bg-[#1a1a28] hover:text-[#e4e4ec]'
                      }`}
                      style={isSel ? { boxShadow: '0 2px 12px rgba(251,191,36,0.35)' } : {}}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-[#1a1a28]">
              {value
                ? <button type="button" onClick={() => { onChange(''); setOpen(false) }}
                    className="text-[10px] text-[#5a5a6e] hover:text-rose-400 transition-colors px-2 py-1 rounded-md hover:bg-rose-500/5">
                    削除
                  </button>
                : <span />
              }
              <button type="button" onClick={goToday}
                className="text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors px-2 py-1 rounded-md hover:bg-amber-500/8 font-medium">
                今日
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

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
  const [scheduledTime, setScheduledTime] = useState(goal.scheduled_time ?? '')
  const [scheduledDuration, setScheduledDuration] = useState(goal.scheduled_duration ?? 60)
  const [milestoneDate, setMilestoneDate] = useState(goal.milestone_date ?? '')
  const [milestoneLabel, setMilestoneLabel] = useState(goal.milestone_label ?? '')

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

        {/* ── Schedule section (task / subtask only) ── */}
        {(issueType === 'task' || issueType === 'subtask') && (
          <div className="px-6 py-4 border-b border-[#2a2a3a]">
            <label className="block text-[10px] font-medium text-[#5a5a6e] mb-2 uppercase tracking-wider">Schedule</label>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Time picker */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#5a5a6e]">開始</span>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={e => {
                    setScheduledTime(e.target.value)
                    patchField({ scheduled_time: e.target.value || null })
                  }}
                  className="bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-2 py-1.5 text-[#e4e4ec] focus:outline-none focus:border-amber-500/40 text-xs"
                />
              </div>
              {/* Duration presets */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#5a5a6e]">所要</span>
                {[30, 60, 90, 120].map(d => (
                  <button key={d} type="button"
                    onClick={() => { setScheduledDuration(d); patchField({ scheduled_duration: d }) }}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      scheduledDuration === d
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                        : 'bg-[#1e1e2a] text-[#5a5a6e] hover:bg-[#252535] hover:text-[#8b8b9e]'
                    }`}>
                    {d < 60 ? `${d}分` : `${d / 60}h`}
                  </button>
                ))}
                {/* Custom duration */}
                <div className={`flex items-center rounded-md border overflow-hidden transition-colors ${
                  ![30, 60, 90, 120].includes(scheduledDuration)
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : 'border-[#2a2a3a] bg-[#1e1e2a]'
                }`}>
                  <button type="button" onClick={() => { const v = Math.max(15, scheduledDuration - 15); setScheduledDuration(v); patchField({ scheduled_duration: v }) }}
                    className="px-1.5 py-1 text-[#5a5a6e] hover:text-amber-400 text-xs font-semibold">−</button>
                  <span className="w-6 text-center text-[10px] text-[#e4e4ec] font-mono">{scheduledDuration}</span>
                  <span className="text-[8px] text-[#5a5a6e] pr-1">分</span>
                  <button type="button" onClick={() => { const v = Math.min(480, scheduledDuration + 15); setScheduledDuration(v); patchField({ scheduled_duration: v }) }}
                    className="px-1.5 py-1 text-[#5a5a6e] hover:text-amber-400 text-xs font-semibold border-l border-[#2a2a3a]">+</button>
                </div>
              </div>
              {/* Clear button */}
              {scheduledTime && (
                <button type="button"
                  onClick={() => { setScheduledTime(''); patchField({ scheduled_time: null }) }}
                  className="text-[10px] text-[#5a5a6e] hover:text-red-400 transition-colors px-2 py-1 rounded-md border border-[#2a2a3a] hover:border-red-500/30">
                  クリア
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Milestone section (story only) ── */}
        {issueType === 'story' && (
          <div className="px-6 py-4 border-b border-[#2a2a3a]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 bg-amber-400 rotate-45 shrink-0"
                style={{ boxShadow: milestoneDate ? '0 0 6px 2px rgba(251,191,36,0.4)' : 'none' }} />
              <label className="text-[10px] font-medium text-amber-400/70 uppercase tracking-wider">Milestone</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-[#5a5a6e] mb-1 uppercase tracking-wider">Date</label>
                <DatePickerPopover
                  value={milestoneDate}
                  onChange={date => {
                    setMilestoneDate(date)
                    patchField({ milestone_date: date || null } as Partial<Goal>)
                  }} />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-[#5a5a6e] mb-1 uppercase tracking-wider">Label</label>
                <input
                  type="text"
                  value={milestoneLabel}
                  onChange={e => setMilestoneLabel(e.target.value)}
                  onBlur={() => patchField({ milestone_label: milestoneLabel || null } as Partial<Goal>)}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  placeholder="e.g. v1.0 リリース"
                  className="w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-[#e4e4ec] placeholder-[#3a3a4a] focus:outline-none focus:border-amber-500/40 text-xs" />
              </div>
            </div>
          </div>
        )}

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
