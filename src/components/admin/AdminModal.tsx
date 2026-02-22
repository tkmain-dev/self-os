import { useState, useEffect, useCallback, useRef } from 'react'
import { useApi, apiPost, apiPatch, apiDelete } from '../../hooks/useApi'
import DiaryChecklist from '../DiaryChecklist'

interface FeatureRequest {
  id: number
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'done' | 'rejected'
  sort_order: number
  commit_message: string
  created_at: string
}

interface Routine {
  id: number
  name: string
  start_time: string
  end_time: string
  day_of_week: string
  sort_order: number
  created_at: string
}

interface DiaryEntry {
  date: string
  content: string
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

const STATUS_OPTIONS: { value: FeatureRequest['status']; label: string; color: string }[] = [
  { value: 'pending', label: '未着手', color: 'bg-[#2a2a3a] text-[#8b8b9e]' },
  { value: 'in_progress', label: '進行中', color: 'bg-amber-500/20 text-amber-400' },
  { value: 'done', label: '完了', color: 'bg-emerald-500/20 text-emerald-400' },
  { value: 'rejected', label: '却下', color: 'bg-red-500/20 text-red-400' },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const days = ['日', '月', '火', '水', '木', '金', '土']
  return `${d.getMonth() + 1}/${d.getDate()}（${days[d.getDay()]}）`
}

function shiftDate(dateStr: string, delta: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + delta)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatCreatedDate(dateStr: string) {
  const d = new Date(dateStr.replace(' ', 'T'))
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── Gear Button ──

export function GearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group p-2 rounded-lg hover:bg-[#1e1e2a] transition-all duration-300"
      title="管理"
    >
      <svg
        className="w-5 h-5 text-[#5a5a6e] group-hover:text-amber-500 transition-all duration-500 group-hover:rotate-90"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.248a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    </button>
  )
}

// ── Main Modal ──

type AdminTab = 'feature-requests' | 'routines'

export default function AdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('feature-requests')

  const { data: items, refetch } = useApi<FeatureRequest[]>('/api/feature-requests')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [animateIn, setAnimateIn] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Drag state
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('below')

  // Diary state
  const [diaryDate, setDiaryDate] = useState(todayStr)
  const { data: diaryEntry, refetch: refetchDiary } = useApi<DiaryEntry>(`/api/diary/${diaryDate}`)

  // Completed panel state
  const [selectedCompletedId, setSelectedCompletedId] = useState<number | null>(null)

  // Diary flush ref (call before close to save checked items as faded)
  const diaryFlushRef = useRef<(() => Promise<void>) | null>(null) as React.RefObject<(() => Promise<void>) | null>

  const isEditMode = activeTab === 'feature-requests' && (showForm || editingId !== null)

  // Split items into active and completed
  const activeItems = (items ?? []).filter(i => i.status !== 'done' && i.status !== 'rejected')
  const completedItems = (items ?? []).filter(i => i.status === 'done' || i.status === 'rejected')
  const showCompletedPanel = activeTab === 'feature-requests' && completedItems.length > 0

  const selectedCompleted = completedItems.find(i => i.id === selectedCompletedId) ?? null

  // Close handler: flush diary BEFORE unmounting, then close
  const handleClose = useCallback(async () => {
    await diaryFlushRef.current?.()
    onClose()
  }, [onClose])

  // Entrance animation + reset state on close
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimateIn(true)))
    } else {
      setAnimateIn(false)
      setShowForm(false)
      setEditingId(null)
      setExpandedId(null)
      setDiaryDate(todayStr())
      setSelectedCompletedId(null)
    }
  }, [open])

  // ── CRUD ──

  const handleCreate = useCallback(async () => {
    if (!formTitle.trim() || submitting) return
    setSubmitting(true)
    try {
      await apiPost('/api/feature-requests', { title: formTitle.trim(), description: formDesc.trim() })
      setFormTitle('')
      setFormDesc('')
      setShowForm(false)
      refetch()
    } catch (err) {
      console.error('Failed to create feature request:', err)
    } finally {
      setSubmitting(false)
    }
  }, [formTitle, formDesc, submitting, refetch])

  const handleUpdate = useCallback(async (id: number, data: Partial<FeatureRequest>) => {
    try {
      await apiPatch(`/api/feature-requests/${id}`, data)
      setEditingId(null)
      refetch()
    } catch (err) {
      console.error('Failed to update feature request:', err)
    }
  }, [refetch])

  const handleDelete = useCallback(async (id: number) => {
    try {
      await apiDelete(`/api/feature-requests/${id}`)
      if (selectedCompletedId === id) setSelectedCompletedId(null)
      refetch()
    } catch (err) {
      console.error('Failed to delete feature request:', err)
    }
  }, [refetch, selectedCompletedId])

  // ── Drag & Drop ──

  const handleDragStart = useCallback((e: React.DragEvent, id: number) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropPosition(e.clientY < midY ? 'above' : 'below')
    setDropTargetId(targetId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDragId(null)
    setDropTargetId(null)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    if (!items || dragId === null || dropTargetId === null || dragId === dropTargetId) {
      handleDragEnd()
      return
    }

    const ordered = [...items]
    const dragIdx = ordered.findIndex(i => i.id === dragId)
    const [dragged] = ordered.splice(dragIdx, 1)
    let dropIdx = ordered.findIndex(i => i.id === dropTargetId)
    if (dropPosition === 'below') dropIdx += 1
    ordered.splice(dropIdx, 0, dragged)

    const orders = ordered.map((item, i) => ({ id: item.id, sort_order: i }))
    await apiPost('/api/feature-requests/reorder', { orders })
    refetch()
    handleDragEnd()
  }, [items, dragId, dropTargetId, dropPosition, refetch, handleDragEnd])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: animateIn ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: animateIn ? 'blur(4px)' : 'blur(0px)',
        transition: 'background-color 0.3s ease, backdrop-filter 0.3s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div
        className="flex gap-4 mx-4 max-h-[80vh]"
        style={{
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
          transition: 'opacity 0.4s cubic-bezier(0.4,0,0.2,1), transform 0.4s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Left: Completed items panel ── */}
        <div
          style={{
            width: showCompletedPanel ? '220px' : '0px',
            opacity: showCompletedPanel ? 1 : 0,
            transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div
            className="bg-[#12121a] rounded-2xl shadow-2xl border border-[#2a2a3a] h-full flex flex-col"
            style={{ width: '220px' }}
          >
            <div className="px-4 pt-4 pb-3 border-b border-[#2a2a3a] shrink-0">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-emerald-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-xs font-medium text-[#5a5a6e]">完了済み</span>
                <span className="text-[10px] text-[#3a3a4e] ml-auto">{completedItems.length}</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {completedItems.map(item => {
                const isSelected = selectedCompletedId === item.id
                const isRejected = item.status === 'rejected'
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedCompletedId(isSelected ? null : item.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-all text-xs ${
                      isSelected
                        ? 'bg-[#1e1e2a] border border-[#3a3a4a]'
                        : 'hover:bg-[#1a1a24] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRejected ? 'bg-red-500/40' : 'bg-emerald-500/40'}`} />
                      <span className="text-[#8b8b9e] truncate leading-tight">{item.title}</span>
                    </div>
                    <span className="text-[10px] text-[#3a3a4e] ml-3.5 block mt-0.5">{formatCreatedDate(item.created_at)}</span>
                  </button>
                )
              })}
            </div>
            {/* Selected completed detail */}
            {selectedCompleted && (
              <div className="border-t border-[#2a2a3a] p-3 max-h-[40%] overflow-y-auto shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <select
                    value={selectedCompleted.status}
                    onChange={e => {
                      const newStatus = e.target.value as FeatureRequest['status']
                      handleUpdate(selectedCompleted.id, { status: newStatus })
                      if (newStatus !== 'done' && newStatus !== 'rejected') {
                        setSelectedCompletedId(null)
                      }
                    }}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer appearance-none text-center border-0 focus:outline-none focus:ring-1 focus:ring-amber-500/30 ${
                      (STATUS_OPTIONS.find(s => s.value === selectedCompleted.status) ?? STATUS_OPTIONS[0]).color
                    }`}
                  >
                    {STATUS_OPTIONS.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(selectedCompleted.id)}
                    className="text-[10px] text-[#3a3a4e] hover:text-red-400 transition-colors"
                  >
                    削除
                  </button>
                </div>
                <p className="text-xs text-[#e4e4ec] font-medium mb-1">{selectedCompleted.title}</p>
                {selectedCompleted.description && (
                  <pre className="text-[10px] text-[#5a5a6e] whitespace-pre-wrap font-sans leading-relaxed mb-2">
                    {selectedCompleted.description}
                  </pre>
                )}
                <div className="mt-1 pt-2 border-t border-[#2a2a3a]">
                  <p className="text-[9px] text-[#3a3a4e] uppercase tracking-widest mb-1">Commit</p>
                  {selectedCompleted.commit_message ? (
                    <pre className="text-[10px] text-emerald-500/60 whitespace-pre-wrap font-mono leading-relaxed break-all">
                      {selectedCompleted.commit_message}
                    </pre>
                  ) : (
                    <p className="text-[10px] text-[#2a2a3a] italic">未記録</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Active Feature Requests ── */}
        <div
          className="bg-[#16161e] rounded-2xl shadow-2xl border border-[#2a2a3a] overflow-hidden flex flex-col"
          style={{
            width: isEditMode ? '540px' : '640px',
            transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          {/* Header with tabs */}
          <div className="px-6 pt-5 pb-4 border-b border-[#2a2a3a] flex items-center gap-3 shrink-0">
            <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.248a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.212-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.248a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
            <div className="flex gap-1 bg-[#0e0e12] rounded-lg p-0.5 flex-1">
              <button
                onClick={() => setActiveTab('feature-requests')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'feature-requests'
                    ? 'bg-[#1e1e2a] text-amber-400 shadow-sm'
                    : 'text-[#5a5a6e] hover:text-[#8b8b9e]'
                }`}
              >
                Feature Requests
              </button>
              <button
                onClick={() => setActiveTab('routines')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'routines'
                    ? 'bg-[#1e1e2a] text-amber-400 shadow-sm'
                    : 'text-[#5a5a6e] hover:text-[#8b8b9e]'
                }`}
              >
                ルーティン
              </button>
            </div>
            <button onClick={handleClose} className="text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-xl leading-none shrink-0">&times;</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === 'feature-requests' && (<>
              {/* Add button / form */}
              {!showForm ? (
                <button
                  onClick={() => { setShowForm(true); setEditingId(null) }}
                  className="w-full mb-4 px-4 py-2.5 rounded-lg border border-dashed border-[#2a2a3a] text-[#5a5a6e] hover:border-amber-500/40 hover:text-amber-500 transition-all text-sm"
                >
                  + 新規追加
                </button>
              ) : (
                <div className="mb-4 p-4 rounded-lg bg-[#0e0e12] border border-[#2a2a3a] space-y-3">
                  <input
                    autoFocus
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="機能名"
                    className="w-full bg-[#16161e] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-[#3a3a4e]"
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreate() } }}
                  />
                  <textarea
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder={'実装したい機能の詳細を記述してください\n例:\n- 何を作るか\n- 受入基準\n- 備考'}
                    rows={5}
                    className="w-full bg-[#16161e] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/50 placeholder:text-[#3a3a4e] resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setShowForm(false); setFormTitle(''); setFormDesc('') }}
                      className="px-3 py-1.5 rounded-lg text-xs text-[#8b8b9e] hover:text-[#e4e4ec] transition-colors"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!formTitle.trim() || submitting}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      {submitting ? '追加中...' : '追加'}
                    </button>
                  </div>
                </div>
              )}

              {/* Active list */}
              {activeItems.length === 0 && !showForm && (
                <div className="text-center py-12 text-[#5a5a6e] text-sm">
                  Feature Requestはまだありません
                </div>
              )}

              {activeItems.map((item, idx) => (
                <FeatureRequestRow
                  key={item.id}
                  item={item}
                  index={idx}
                  isExpanded={expandedId === item.id}
                  isEditing={editingId === item.id}
                  isDragging={dragId === item.id}
                  isDropTarget={dropTargetId === item.id}
                  dropPosition={dropPosition}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onStartEdit={() => setEditingId(item.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onUpdate={(data) => handleUpdate(item.id, data)}
                  onDelete={() => handleDelete(item.id)}
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDrop}
                />
              ))}
            </>)}

            {activeTab === 'routines' && (
              <RoutinePanel />
            )}
          </div>
        </div>

        {/* ── Right: Diary panel (appears during create/edit) ── */}
        <div
          style={{
            width: isEditMode ? '320px' : '0px',
            opacity: isEditMode ? 1 : 0,
            transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div
            className="bg-[#16161e] rounded-2xl shadow-2xl border border-[#2a2a3a] h-full flex flex-col"
            style={{
              width: '320px',
              transform: isEditMode ? 'translateX(0)' : 'translateX(24px)',
              opacity: isEditMode ? 1 : 0,
              transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1) 0.08s, opacity 0.4s ease 0.08s',
            }}
          >
            {/* Diary header */}
            <div className="px-4 pt-4 pb-3 border-b border-[#2a2a3a] flex items-center gap-1 shrink-0">
              <svg className="w-4 h-4 text-[#5a5a6e] mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              <button
                onClick={() => setDiaryDate(d => shiftDate(d, -1))}
                className="px-1.5 py-0.5 text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-xs"
              >
                &lsaquo;
              </button>
              <button
                onClick={() => setDiaryDate(todayStr())}
                className="flex-1 text-center text-xs text-[#8b8b9e] hover:text-[#e4e4ec] transition-colors"
              >
                {formatDateLabel(diaryDate)}
              </button>
              <button
                onClick={() => setDiaryDate(d => shiftDate(d, 1))}
                className="px-1.5 py-0.5 text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-xs"
              >
                &rsaquo;
              </button>
            </div>

            {/* Diary body */}
            <div className="flex-1 p-3 overflow-y-auto">
              <DiaryChecklist
                date={diaryDate}
                content={diaryEntry?.content ?? ''}
                onUpdated={refetchDiary}
                flushRef={diaryFlushRef}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Routine Panel ──

function RoutinePanel() {
  const { data: routines, refetch } = useApi<Routine[]>('/api/routines')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formStartTime, setFormStartTime] = useState('09:00')
  const [formEndTime, setFormEndTime] = useState('10:00')
  const [formDays, setFormDays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]))
  const [submitting, setSubmitting] = useState(false)

  // Drag state
  const [dragId, setDragId] = useState<number | null>(null)
  const [dropTargetId, setDropTargetId] = useState<number | null>(null)
  const [dropPosition, setDropPosition] = useState<'above' | 'below'>('below')

  const toggleDay = (d: number) => {
    setFormDays(prev => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d); else next.add(d)
      return next
    })
  }

  const daysToString = (days: Set<number>) => Array.from(days).sort().join(',')
  const stringToDays = (s: string) => new Set(s.split(',').filter(Boolean).map(Number))

  const resetForm = () => {
    setFormName('')
    setFormStartTime('09:00')
    setFormEndTime('10:00')
    setFormDays(new Set([1, 2, 3, 4, 5]))
    setShowForm(false)
    setEditingId(null)
  }

  const handleCreate = async () => {
    if (!formName.trim() || submitting) return
    setSubmitting(true)
    try {
      await apiPost('/api/routines', {
        name: formName.trim(),
        start_time: formStartTime,
        end_time: formEndTime,
        day_of_week: daysToString(formDays),
      })
      resetForm()
      refetch()
    } catch (err) {
      console.error('Failed to create routine:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async (id: number, data: Partial<Routine>) => {
    try {
      await apiPatch(`/api/routines/${id}`, data)
      setEditingId(null)
      refetch()
    } catch (err) {
      console.error('Failed to update routine:', err)
    }
  }

  const handleDeleteRoutine = async (id: number) => {
    try {
      await apiDelete(`/api/routines/${id}`)
      refetch()
    } catch (err) {
      console.error('Failed to delete routine:', err)
    }
  }

  const startEdit = (r: Routine) => {
    setEditingId(r.id)
    setFormName(r.name)
    setFormStartTime(r.start_time)
    setFormEndTime(r.end_time)
    setFormDays(stringToDays(r.day_of_week))
    setShowForm(false)
  }

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(id))
  }

  const handleDragOver = (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropPosition(e.clientY < midY ? 'above' : 'below')
    setDropTargetId(targetId)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDropTargetId(null)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    if (!routines || dragId === null || dropTargetId === null || dragId === dropTargetId) {
      handleDragEnd()
      return
    }
    const ordered = [...routines]
    const dragIdx = ordered.findIndex(i => i.id === dragId)
    const [dragged] = ordered.splice(dragIdx, 1)
    let dropIdx = ordered.findIndex(i => i.id === dropTargetId)
    if (dropPosition === 'below') dropIdx += 1
    ordered.splice(dropIdx, 0, dragged)
    const orders = ordered.map((item, i) => ({ id: item.id, sort_order: i }))
    await apiPost('/api/routines/reorder', { orders })
    refetch()
    handleDragEnd()
  }

  const allItems = routines ?? []

  return (
    <>
      {/* Add button / form */}
      {!showForm && editingId === null ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full mb-4 px-4 py-2.5 rounded-lg border border-dashed border-[#2a2a3a] text-[#5a5a6e] hover:border-teal-500/40 hover:text-teal-400 transition-all text-sm"
        >
          + ルーティン追加
        </button>
      ) : (
        <div className="mb-4 p-4 rounded-lg bg-[#0e0e12] border border-[#2a2a3a] space-y-3">
          <input
            autoFocus
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="ルーティン名（例: 朝の準備）"
            className="w-full bg-[#16161e] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder:text-[#3a3a4e]"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); editingId ? handleUpdate(editingId, { name: formName.trim(), start_time: formStartTime, end_time: formEndTime, day_of_week: daysToString(formDays) }) : handleCreate() } }}
          />
          {/* Time range */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#5a5a6e]">時間帯</span>
            <input
              type="time"
              value={formStartTime}
              onChange={e => setFormStartTime(e.target.value)}
              className="bg-[#16161e] border border-[#2a2a3a] rounded-lg px-2 py-1.5 text-[#e4e4ec] focus:outline-none focus:border-teal-500/40 text-xs"
            />
            <span className="text-[#5a5a6e] text-xs">~</span>
            <input
              type="time"
              value={formEndTime}
              onChange={e => setFormEndTime(e.target.value)}
              className="bg-[#16161e] border border-[#2a2a3a] rounded-lg px-2 py-1.5 text-[#e4e4ec] focus:outline-none focus:border-teal-500/40 text-xs"
            />
          </div>
          {/* Day of week circles */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#5a5a6e]">曜日</span>
            <div className="flex gap-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`w-7 h-7 rounded-full text-[10px] font-semibold transition-all ${
                    formDays.has(i)
                      ? i === 0 ? 'bg-red-500/80 text-white' : i === 6 ? 'bg-blue-500/80 text-white' : 'bg-teal-500 text-black'
                      : 'bg-[#1e1e2a] text-[#5a5a6e] hover:bg-[#252535]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {/* Quick select */}
            <div className="flex gap-1 ml-2">
              {[
                { label: '平日', days: [1, 2, 3, 4, 5] },
                { label: '毎日', days: [0, 1, 2, 3, 4, 5, 6] },
                { label: 'クリア', days: [] as number[] },
              ].map(preset => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setFormDays(new Set(preset.days))}
                  className="px-2 py-0.5 rounded text-[9px] text-[#5a5a6e] hover:text-teal-400 hover:bg-[#1e1e2a] transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={resetForm}
              className="px-3 py-1.5 rounded-lg text-xs text-[#8b8b9e] hover:text-[#e4e4ec] transition-colors"
            >
              キャンセル
            </button>
            <button
              onClick={() => editingId ? handleUpdate(editingId, { name: formName.trim(), start_time: formStartTime, end_time: formEndTime, day_of_week: daysToString(formDays) }) : handleCreate()}
              disabled={!formName.trim() || submitting}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-teal-500 text-black hover:bg-teal-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {submitting ? '保存中...' : editingId ? '更新' : '追加'}
            </button>
          </div>
        </div>
      )}

      {/* Routine list */}
      {allItems.length === 0 && !showForm && editingId === null && (
        <div className="text-center py-12 text-[#5a5a6e] text-sm">
          ルーティンはまだありません
        </div>
      )}

      {allItems.map(routine => {
        const days = routine.day_of_week.split(',').filter(Boolean).map(Number)
        return (
          <div
            key={routine.id}
            className={`relative mb-1.5 rounded-lg border transition-all ${
              dragId === routine.id ? 'opacity-30' : ''
            } ${
              dropTargetId === routine.id && dragId !== routine.id
                ? dropPosition === 'above'
                  ? 'border-t-2 border-t-teal-500 border-[#2a2a3a]'
                  : 'border-b-2 border-b-teal-500 border-[#2a2a3a]'
                : 'border-[#2a2a3a]'
            } bg-[#0e0e12] hover:bg-[#13131d]`}
            draggable
            onDragStart={e => handleDragStart(e, routine.id)}
            onDragOver={e => handleDragOver(e, routine.id)}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
          >
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="cursor-grab active:cursor-grabbing text-[#3a3a4e] hover:text-[#5a5a6e] select-none text-sm shrink-0">
                &#x2807;
              </span>
              <span className="flex-1 text-sm text-[#e4e4ec] truncate">{routine.name}</span>
              <span className="text-[10px] text-teal-400/60 font-mono shrink-0">
                {routine.start_time} - {routine.end_time}
              </span>
              <div className="flex gap-0.5 shrink-0">
                {DAY_LABELS.map((label, i) => (
                  <span
                    key={i}
                    className={`w-4 h-4 rounded-full text-[8px] flex items-center justify-center ${
                      days.includes(i)
                        ? i === 0 ? 'bg-red-500/30 text-red-400' : i === 6 ? 'bg-blue-500/30 text-blue-400' : 'bg-teal-500/30 text-teal-400'
                        : 'text-[#2a2a3a]'
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <button
                onClick={() => startEdit(routine)}
                className="text-[10px] text-[#5a5a6e] hover:text-teal-400 transition-colors px-1"
              >
                &#x270E;
              </button>
              <button
                onClick={() => handleDeleteRoutine(routine.id)}
                className="text-[10px] text-[#5a5a6e] hover:text-red-400 transition-colors px-1"
              >
                &times;
              </button>
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Row Component ──

function FeatureRequestRow({
  item, index, isExpanded, isEditing, isDragging, isDropTarget, dropPosition,
  onToggleExpand, onStartEdit, onCancelEdit, onUpdate, onDelete,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  item: FeatureRequest
  index: number
  isExpanded: boolean
  isEditing: boolean
  isDragging: boolean
  isDropTarget: boolean
  dropPosition: 'above' | 'below'
  onToggleExpand: () => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onUpdate: (data: Partial<FeatureRequest>) => void
  onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const [editTitle, setEditTitle] = useState(item.title)
  const [editDesc, setEditDesc] = useState(item.description)

  useEffect(() => {
    setEditTitle(item.title)
    setEditDesc(item.description)
  }, [item.title, item.description, isEditing])

  const statusInfo = STATUS_OPTIONS.find(s => s.value === item.status) ?? STATUS_OPTIONS[0]

  return (
    <div
      className={`relative mb-1.5 rounded-lg border transition-all ${
        isDragging ? 'opacity-30' : ''
      } ${
        isDropTarget && !isDragging
          ? dropPosition === 'above'
            ? 'border-t-2 border-t-amber-500 border-[#2a2a3a]'
            : 'border-b-2 border-b-amber-500 border-[#2a2a3a]'
          : 'border-[#2a2a3a]'
      } bg-[#0e0e12] hover:bg-[#13131d]`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <span className="cursor-grab active:cursor-grabbing text-[#3a3a4e] hover:text-[#5a5a6e] select-none text-sm shrink-0">
          ⠿
        </span>

        {/* Priority number */}
        <span className="text-[10px] text-[#3a3a4e] font-mono w-4 text-right shrink-0">
          {index + 1}
        </span>

        {/* Title */}
        <button
          className="flex-1 text-left text-sm text-[#e4e4ec] truncate hover:text-amber-300 transition-colors"
          onClick={onToggleExpand}
        >
          {item.title}
        </button>

        {/* Status badge */}
        <select
          value={item.status}
          onChange={e => onUpdate({ status: e.target.value as FeatureRequest['status'] })}
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer appearance-none text-center ${statusInfo.color} border-0 focus:outline-none focus:ring-1 focus:ring-amber-500/30`}
          onClick={e => e.stopPropagation()}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* Expanded area */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-[#1e1e2a]">
          {isEditing ? (
            <div className="space-y-2 pt-2">
              <input
                autoFocus
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full bg-[#16161e] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={5}
                className="w-full bg-[#16161e] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-[#e4e4ec] focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={onCancelEdit} className="px-3 py-1 rounded text-xs text-[#8b8b9e] hover:text-[#e4e4ec]">
                  キャンセル
                </button>
                <button
                  onClick={() => onUpdate({ title: editTitle.trim(), description: editDesc.trim() })}
                  disabled={!editTitle.trim()}
                  className="px-3 py-1 rounded text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40"
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-2">
              {item.description ? (
                <pre className="text-xs text-[#8b8b9e] whitespace-pre-wrap font-sans leading-relaxed mb-2">
                  {item.description}
                </pre>
              ) : (
                <p className="text-xs text-[#3a3a4e] italic mb-2">説明なし</p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={onStartEdit} className="px-3 py-1 rounded text-xs text-[#5a5a6e] hover:text-amber-400 transition-colors">
                  編集
                </button>
                <button
                  onClick={() => { if (confirm('このFeature Requestを削除しますか？')) onDelete() }}
                  className="px-3 py-1 rounded text-xs text-[#5a5a6e] hover:text-red-400 transition-colors"
                >
                  削除
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
