import { useState, useEffect } from 'react'
import type { ScheduleItem, GoalItem } from './calendarTypes'
import { apiPost, apiPut, apiPatch, apiDelete } from '../../hooks/useApi'

interface CalendarFormModalProps {
  mode: 'schedule' | 'goal'
  editItem: ScheduleItem | GoalItem | null  // null = new
  prefilledDate: string | null
  prefilledStartTime?: string | null
  prefilledEndTime?: string | null
  onClose: () => void
  onSaved: () => void
}

const ISSUE_TYPES = [
  { value: 'epic', label: 'Epic' },
  { value: 'story', label: 'Story' },
  { value: 'task', label: 'Task' },
  { value: 'subtask', label: 'Subtask' },
]

const STATUSES = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
]

const PRIORITIES = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const COLOR_OPTIONS = [
  { value: 'amber', bg: 'bg-amber-500' },
  { value: 'blue', bg: 'bg-blue-500' },
  { value: 'green', bg: 'bg-green-500' },
  { value: 'purple', bg: 'bg-purple-500' },
  { value: 'rose', bg: 'bg-rose-500' },
  { value: 'teal', bg: 'bg-teal-500' },
]

const inputClass = 'w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/50'
const selectClass = inputClass + ' cursor-pointer'
const labelClass = 'block text-xs text-[#8b8b9e] font-medium mb-1.5'

function formatDateToday(): string {
  const d = new Date()
  return d.toISOString().split('T')[0]
}

export default function CalendarFormModal({ mode: initialMode, editItem, prefilledDate, prefilledStartTime, prefilledEndTime, onClose, onSaved }: CalendarFormModalProps) {
  const isEdit = editItem !== null
  const [mode, setMode] = useState<'schedule' | 'goal'>(initialMode)

  // Schedule fields
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(prefilledDate ?? formatDateToday())
  const [startTime, setStartTime] = useState(prefilledStartTime ?? '')
  const [endTime, setEndTime] = useState(prefilledEndTime ?? '')
  const [memo, setMemo] = useState('')

  // Goal fields
  const [issueType, setIssueType] = useState<string>('task')
  const [status, setStatus] = useState<string>('todo')
  const [priority, setPriority] = useState<string>('medium')
  const [startDate, setStartDate] = useState(prefilledDate ?? formatDateToday())
  const [endDate, setEndDate] = useState(prefilledDate ?? formatDateToday())
  const [color, setColor] = useState('amber')
  const [goalTitle, setGoalTitle] = useState('')
  const [goalMemo, setGoalMemo] = useState('')

  const [submitting, setSubmitting] = useState(false)

  // Populate fields when editing
  useEffect(() => {
    if (!editItem) return
    if (mode === 'schedule' && 'start_time' in editItem) {
      const item = editItem as ScheduleItem
      setTitle(item.title)
      setDate(item.date)
      setStartTime(item.start_time ?? '')
      setEndTime(item.end_time ?? '')
      setMemo(item.memo ?? '')
    } else if (mode === 'goal' && 'issue_type' in editItem) {
      const item = editItem as GoalItem
      setGoalTitle(item.title)
      setIssueType(item.issue_type)
      setStatus(item.status)
      setPriority(item.priority)
      setStartDate(item.start_date)
      setEndDate(item.end_date)
      setColor(item.color)
      setGoalMemo(item.memo ?? '')
    }
  }, [editItem, mode])

  const handleSubmitSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setSubmitting(true)
    try {
      const body = {
        title: title.trim(),
        date,
        start_time: startTime || null,
        end_time: endTime || null,
        memo: memo || null,
      }
      if (isEdit) {
        await apiPut(`/api/schedules/${editItem!.id}`, body)
      } else {
        await apiPost('/api/schedules', body)
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!goalTitle.trim() || !startDate || !endDate) return
    setSubmitting(true)
    try {
      const body = {
        title: goalTitle.trim(),
        issue_type: issueType,
        status,
        priority,
        start_date: startDate,
        end_date: endDate,
        color,
        memo: goalMemo || null,
      }
      if (isEdit) {
        await apiPatch(`/api/goals/${editItem!.id}`, body)
      } else {
        await apiPost('/api/goals', body)
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!editItem) return
    setSubmitting(true)
    try {
      if (mode === 'schedule') {
        await apiDelete(`/api/schedules/${editItem.id}`)
      } else {
        await apiDelete(`/api/goals/${editItem.id}`)
      }
      onSaved()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={mode === 'schedule' ? handleSubmitSchedule : handleSubmitGoal}
        className="bg-[#16161e] rounded-2xl shadow-2xl border border-[#2a2a3a] w-full max-w-lg mx-4 overflow-hidden"
      >
        {/* Modal header */}
        <div className="px-6 pt-5 pb-4 border-b border-[#2a2a3a]">
          <h3 className="text-lg font-bold text-[#e4e4ec] tracking-tight">
            {isEdit ? (mode === 'schedule' ? 'スケジュール編集' : 'ゴール編集') : '新規作成'}
          </h3>

          {/* Tab toggle (only for new items) */}
          {!isEdit && (
            <div className="flex gap-1 bg-[#1e1e2a] rounded-lg p-0.5 mt-3">
              <button
                type="button"
                onClick={() => setMode('schedule')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs transition-colors ${
                  mode === 'schedule'
                    ? 'bg-[#16161e] text-[#e4e4ec] shadow-sm'
                    : 'text-[#5a5a6e] hover:text-[#8b8b9e]'
                }`}
              >
                スケジュール
              </button>
              <button
                type="button"
                onClick={() => setMode('goal')}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs transition-colors ${
                  mode === 'goal'
                    ? 'bg-[#16161e] text-[#e4e4ec] shadow-sm'
                    : 'text-[#5a5a6e] hover:text-[#8b8b9e]'
                }`}
              >
                ゴール
              </button>
            </div>
          )}
        </div>

        {/* Modal body */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {mode === 'schedule' ? (
            <>
              {/* Title */}
              <div>
                <label className={labelClass}>タイトル</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="予定名を入力"
                  className={inputClass}
                  autoFocus
                  required
                />
              </div>

              {/* Date */}
              <div>
                <label className={labelClass}>日付</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>

              {/* Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>開始時間</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>終了時間</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className={labelClass}>メモ</label>
                <textarea
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="メモ（任意）"
                  className={inputClass + ' resize-none'}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              {/* Goal Title */}
              <div>
                <label className={labelClass}>タイトル</label>
                <input
                  type="text"
                  value={goalTitle}
                  onChange={e => setGoalTitle(e.target.value)}
                  placeholder="ゴール名を入力"
                  className={inputClass}
                  autoFocus
                  required
                />
              </div>

              {/* Type / Status / Priority */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>タイプ</label>
                  <select value={issueType} onChange={e => setIssueType(e.target.value)} className={selectClass}>
                    {ISSUE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>ステータス</label>
                  <select value={status} onChange={e => setStatus(e.target.value)} className={selectClass}>
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>優先度</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)} className={selectClass}>
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>開始日</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>終了日</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className={labelClass}>カラー</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setColor(c.value)}
                      className={`w-7 h-7 rounded-full ${c.bg} transition-all ${
                        color === c.value
                          ? 'ring-2 ring-offset-2 ring-offset-[#16161e] ring-amber-400 scale-110'
                          : 'opacity-50 hover:opacity-90 hover:scale-105'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Memo */}
              <div>
                <label className={labelClass}>メモ</label>
                <textarea
                  value={goalMemo}
                  onChange={e => setGoalMemo(e.target.value)}
                  placeholder="メモ（任意）"
                  className={inputClass + ' resize-none'}
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-[#2a2a3a] flex items-center gap-3 bg-[#0e0e12]/50">
          {isEdit && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={submitting}
              className="text-red-400 hover:text-red-300 text-sm transition-colors"
            >
              削除
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="text-[#8b8b9e] hover:text-[#e4e4ec] px-4 py-2 text-sm transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="bg-amber-500 text-black font-semibold px-4 py-2 rounded-lg hover:bg-amber-400 text-sm transition-all hover:shadow-lg hover:shadow-amber-500/20 disabled:opacity-50"
          >
            {isEdit ? '更新' : '作成'}
          </button>
        </div>
      </form>
    </div>
  )
}
