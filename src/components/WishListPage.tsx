import { useState, useEffect, useRef, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import DatePicker from './DatePicker'
import DiaryChecklist from './DiaryChecklist'

interface WishItem {
  id: number
  list_type: 'wish' | 'bucket'
  title: string
  price: number | null
  url: string | null
  deadline: string | null
  memo: string | null
  done: number
  done_at: string | null
  sort_order: number
}

interface DiaryEntry {
  date: string
  content: string
}

interface Goal {
  id: number
  parent_id: number | null
  title: string
  issue_type: string
  start_date: string
  end_date: string
  color: string
}

type ListType = 'wish' | 'bucket'

// ── Theme per tab ──

const themes = {
  wish: {
    // Warm, luxurious gold
    tabActive: 'bg-gradient-to-r from-amber-500/15 to-amber-600/5 text-amber-400 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/20',
    cardBorder: 'border-[#2a2a3a]',
    cardHover: 'hover:border-amber-500/30 hover:shadow-md hover:shadow-amber-500/5',
    cardDragOver: 'border-amber-500/50 shadow-lg shadow-amber-500/10',
    checkDone: 'bg-amber-500 border-amber-500',
    checkHover: 'hover:border-amber-500/50',
    priceColor: 'text-amber-400',
    addBtn: 'text-amber-500 hover:text-amber-400',
    submitBtn: 'bg-amber-500 hover:bg-amber-400',
    statAccent: 'text-amber-500/70',
    focusBorder: 'focus:border-amber-500/50',
    cardBg: 'bg-[#16161e]',
    cardRadius: 'rounded-xl',
    leftAccent: 'border-l-2 border-l-amber-500/40',
    headerGradient: 'from-amber-500/8 to-transparent',
    subtitle: '欲しいものを整理する',
    emptyIcon: '✦',
    emptyText: '欲しいものを追加しましょう',
    emptySubText: '気になる商品をリストに追加して、購入計画を立てましょう',
    gripColor: 'text-amber-800/30 hover:text-amber-600/40',
  },
  bucket: {
    // Cool, dreamy teal-violet
    tabActive: 'bg-gradient-to-r from-teal-500/15 to-violet-500/10 text-teal-300 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/20',
    cardBorder: 'border-teal-500/10',
    cardHover: 'hover:border-teal-500/25 hover:shadow-md hover:shadow-teal-500/5',
    cardDragOver: 'border-teal-400/50 shadow-lg shadow-teal-500/10',
    checkDone: 'bg-teal-500 border-teal-500',
    checkHover: 'hover:border-teal-500/50',
    priceColor: 'text-teal-400',
    addBtn: 'text-teal-400 hover:text-teal-300',
    submitBtn: 'bg-teal-500 hover:bg-teal-400',
    statAccent: 'text-teal-400/70',
    focusBorder: 'focus:border-teal-500/50',
    cardBg: 'bg-gradient-to-r from-[#12161e] to-[#141420]',
    cardRadius: 'rounded-2xl',
    leftAccent: 'border-l-2 border-l-teal-500/30',
    headerGradient: 'from-teal-500/6 to-transparent',
    subtitle: 'やりたいことを整理する',
    emptyIcon: '✧',
    emptyText: 'やりたいことを追加しましょう',
    emptySubText: '夢や目標をリストに追加して、一歩ずつ実現しましょう',
    gripColor: 'text-teal-800/30 hover:text-teal-600/40',
  },
} as const

function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return ''
  return `¥${price.toLocaleString()}`
}

function extractDomain(url: string | null): string {
  if (!url) return ''
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function daysUntil(deadline: string | null): { text: string; urgent: boolean } | null {
  if (!deadline) return null
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { text: `${Math.abs(diff)}日超過`, urgent: true }
  if (diff === 0) return { text: '今日まで', urgent: true }
  if (diff <= 3) return { text: `あと${diff}日`, urgent: true }
  if (diff <= 7) return { text: `あと${diff}日`, urgent: false }
  return { text: `あと${diff}日`, urgent: false }
}

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

async function safeFetch<T>(method: 'POST' | 'PATCH' | 'DELETE', url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status}: ${text || res.statusText}`)
  }
  if (method === 'DELETE') return undefined as T
  return res.json()
}

export default function WishListPage() {
  const [activeTab, setActiveTab] = useState<ListType>('wish')
  const { data: items, refetch } = useApi<WishItem[]>(`/api/wish-items?type=${activeTab}`)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ title: '', price: '', url: '', deadline: '', memo: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOverId, setDragOverId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showDone, setShowDone] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  // Diary state — aggregate: all recent entries with unchecked lines
  const { data: diaryEntries, refetch: refetchDiary } = useApi<DiaryEntry[]>('/api/diary/')
  const [diaryFlush, setDiaryFlush] = useState(0)

  // Ticket modal state
  const [ticketItem, setTicketItem] = useState<WishItem | null>(null)
  const { data: goals } = useApi<Goal[]>('/api/goals')
  const epics = (goals ?? []).filter(g => g.issue_type === 'epic')

  const theme = themes[activeTab]
  const isEditMode = showForm || editingId !== null

  useEffect(() => {
    if (showForm || editingId !== null) {
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [showForm, editingId])

  const resetForm = () => {
    setDiaryFlush(n => n + 1)
    setForm({ title: '', price: '', url: '', deadline: '', memo: '' })
    setShowForm(false)
    setEditingId(null)
    setError('')
  }

  const handleCreate = async () => {
    if (!form.title.trim() || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await safeFetch('POST', '/api/wish-items', {
        list_type: activeTab,
        title: form.title.trim(),
        price: form.price ? parseInt(form.price) : null,
        url: form.url.trim() || null,
        deadline: form.deadline || null,
        memo: form.memo.trim() || null,
      })
      resetForm()
      refetch()
    } catch (e) {
      console.error('Failed to create wish item:', e)
      setError('保存に失敗しました。サーバーを再起動してください。')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!form.title.trim() || submitting || editingId === null) return
    setSubmitting(true)
    setError('')
    try {
      await safeFetch('PATCH', `/api/wish-items/${editingId}`, {
        title: form.title.trim(),
        price: form.price ? parseInt(form.price) : null,
        url: form.url.trim() || null,
        deadline: form.deadline || null,
        memo: form.memo.trim() || null,
      })
      resetForm()
      refetch()
    } catch (e) {
      console.error('Failed to update wish item:', e)
      setError('更新に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await safeFetch('DELETE', `/api/wish-items/${id}`)
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleDone = async (item: WishItem) => {
    try {
      await safeFetch('PATCH', `/api/wish-items/${item.id}`, { done: item.done ? 0 : 1 })
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  const startEdit = (item: WishItem) => {
    setEditingId(item.id)
    setShowForm(false)
    setError('')
    setForm({
      title: item.title,
      price: item.price?.toString() ?? '',
      url: item.url ?? '',
      deadline: item.deadline ?? '',
      memo: item.memo ?? '',
    })
  }

  // ── Ticket creation ──
  const handleCreateTicket = async (epicId: number | 'new', newEpicTitle?: string) => {
    if (!ticketItem) return
    try {
      let parentId = epicId
      const today = todayStr()
      const monthLater = shiftDate(today, 30)

      // Create new epic if needed
      if (epicId === 'new' && newEpicTitle?.trim()) {
        const epic = await safeFetch<Goal>('POST', '/api/goals', {
          title: newEpicTitle.trim(),
          issue_type: 'epic',
          start_date: today,
          end_date: monthLater,
          color: 'violet',
        })
        parentId = epic.id
      }
      if (parentId === 'new') return

      // Create story under the epic
      await safeFetch('POST', '/api/goals', {
        parent_id: parentId,
        title: ticketItem.title,
        issue_type: 'story',
        start_date: today,
        end_date: ticketItem.deadline || monthLater,
        color: 'violet',
        memo: ticketItem.memo || '',
      })

      // Mark bucket item as done
      await safeFetch('PATCH', `/api/wish-items/${ticketItem.id}`, { done: 1 })
      setTicketItem(null)
      refetch()
    } catch (e) {
      console.error('Failed to create ticket:', e)
    }
  }

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, id: number) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = useCallback((e: React.DragEvent, id: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }, [])

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault()
    setDragOverId(null)
    if (!items || dragId === null || dragId === targetId) { setDragId(null); return }

    const list = [...items]
    const fromIdx = list.findIndex(i => i.id === dragId)
    const toIdx = list.findIndex(i => i.id === targetId)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return }

    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)

    const orders = list.map((item, i) => ({ id: item.id, sort_order: i }))
    setDragId(null)

    try {
      await safeFetch('POST', '/api/wish-items/reorder', { orders })
      refetch()
    } catch (e) {
      console.error(e)
    }
  }

  const activeItems = items?.filter(i => !i.done) ?? []
  const doneItems = items?.filter(i => !!i.done) ?? []
  const totalPrice = activeItems.reduce((s, i) => s + (i.price ?? 0), 0)
  const doneCount = doneItems.length
  const totalCount = items?.length ?? 0

  return (
    <div className="flex gap-6 max-w-5xl mx-auto">
      {/* ── Left: Main content ── */}
      <div className="flex-1 min-w-0">
        {/* Header with gradient accent */}
        <div className={`mb-6 pb-4 border-b border-[#2a2a3a] bg-gradient-to-r ${theme.headerGradient} -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 pt-1 transition-all duration-500`}>
          <h1 className="text-2xl font-bold text-white tracking-wide mb-1">Wish List</h1>
          <p className="text-sm text-[#5a5a6e]">{theme.subtitle}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 bg-[#0a0a10] rounded-2xl p-1.5 border border-[#1e1e2a]">
          {([
            { type: 'wish' as const, label: '買いたいもの', icon: '✦' },
            { type: 'bucket' as const, label: 'やりたいこと', icon: '✧' },
          ]).map(tab => (
            <button
              key={tab.type}
              onClick={() => { setActiveTab(tab.type); resetForm() }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-300 ${
                activeTab === tab.type
                  ? themes[tab.type].tabActive
                  : 'text-[#5a5a6e] hover:text-[#8b8b9e] hover:bg-[#16161e]/50'
              }`}
            >
              <span className="mr-1.5 text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats bar */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-4 text-xs text-[#5a5a6e]">
            <span>{doneCount}/{totalCount} 達成</span>
            {activeTab === 'wish' && totalPrice > 0 && (
              <span className={`${theme.statAccent} font-medium`}>
                合計 ¥{totalPrice.toLocaleString()}
              </span>
            )}
          </div>
          <button
            onClick={() => { setShowForm(true); setEditingId(null); setError(''); setForm({ title: '', price: '', url: '', deadline: '', memo: '' }) }}
            className={`flex items-center gap-1.5 text-sm ${theme.addBtn} transition-colors`}
          >
            <span className="text-lg leading-none">+</span> 追加
          </button>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Add/Edit Form — desktop inline */}
        {(showForm || editingId !== null) && (
          <div className={`hidden md:block mb-4 ${theme.cardBg} border ${theme.cardBorder} ${theme.leftAccent} ${theme.cardRadius} p-4`}>
            <div className="grid gap-3">
              <input
                ref={titleRef}
                type="text"
                placeholder={activeTab === 'wish' ? '欲しいものの名前' : 'やりたいことの名前'}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') editingId !== null ? handleUpdate() : handleCreate() }}
                className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors`}
              />
              <div className="grid grid-cols-2 gap-3">
                {activeTab === 'wish' && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e] text-sm">¥</span>
                    <input
                      type="number"
                      placeholder="価格"
                      value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors`}
                    />
                  </div>
                )}
                <DatePicker
                  value={form.deadline}
                  onChange={v => setForm(f => ({ ...f, deadline: v }))}
                  placeholder="期限を選択"
                  accentColor={activeTab === 'wish' ? 'amber' : 'teal'}
                  className={activeTab === 'bucket' ? 'col-span-2' : ''}
                />
              </div>
              <input
                type="text"
                placeholder={activeTab === 'wish' ? 'URL（商品ページなど）' : 'URL（参考ページなど）'}
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors`}
              />
              <textarea
                placeholder="メモ"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                rows={2}
                className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors resize-none`}
              />
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={resetForm} className="px-3 py-1.5 text-xs text-[#5a5a6e] hover:text-[#8b8b9e] transition-colors">
                キャンセル
              </button>
              <button
                onClick={editingId !== null ? handleUpdate : handleCreate}
                disabled={!form.title.trim() || submitting}
                className={`px-4 py-1.5 ${theme.submitBtn} disabled:opacity-40 ${activeTab === 'wish' ? 'text-black' : 'text-white'} text-xs font-medium rounded-lg transition-colors`}
              >
                {submitting ? '保存中...' : editingId !== null ? '更新' : '追加'}
              </button>
            </div>
          </div>
        )}

        {/* Add/Edit Form — mobile popup with diary */}
        {(showForm || editingId !== null) && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col">
            {/* Backdrop */}
            <div className="flex-1 bg-black/60" onClick={resetForm} />
            {/* Sheet */}
            <div className="bg-[#16161e] rounded-t-2xl shadow-2xl border-t border-[#2a2a3a] flex flex-col" style={{ maxHeight: '88vh' }}>
              {/* Header */}
              <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#2a2a3a] shrink-0">
                <span className="text-sm font-bold text-[#e4e4ec]">
                  {editingId !== null ? '編集' : '追加'}
                </span>
                <button onClick={resetForm} className="ml-auto text-xl leading-none text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors">&times;</button>
              </div>
              {/* Form inputs */}
              <div className="px-4 py-3 space-y-3 border-b border-[#2a2a3a] shrink-0">
                {error && (
                  <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
                )}
                <input
                  autoFocus
                  type="text"
                  placeholder={activeTab === 'wish' ? '欲しいものの名前' : 'やりたいことの名前'}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') editingId !== null ? handleUpdate() : handleCreate() }}
                  className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors`}
                />
                <div className="grid grid-cols-2 gap-3">
                  {activeTab === 'wish' && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a6e] text-sm">¥</span>
                      <input
                        type="number"
                        placeholder="価格"
                        value={form.price}
                        onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                        className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors`}
                      />
                    </div>
                  )}
                  <DatePicker
                    value={form.deadline}
                    onChange={v => setForm(f => ({ ...f, deadline: v }))}
                    placeholder="期限を選択"
                    accentColor={activeTab === 'wish' ? 'amber' : 'teal'}
                    className={activeTab === 'bucket' ? 'col-span-2' : ''}
                  />
                </div>
                <input
                  type="text"
                  placeholder={activeTab === 'wish' ? 'URL（商品ページなど）' : 'URL（参考ページなど）'}
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors`}
                />
                <textarea
                  placeholder="メモ"
                  value={form.memo}
                  onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                  rows={2}
                  className={`w-full bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a4a] ${theme.focusBorder} focus:outline-none transition-colors resize-none`}
                />
                <div className="flex justify-end gap-2">
                  <button onClick={resetForm} className="px-3 py-1.5 text-xs text-[#5a5a6e] hover:text-[#8b8b9e] transition-colors">
                    キャンセル
                  </button>
                  <button
                    onClick={editingId !== null ? handleUpdate : handleCreate}
                    disabled={!form.title.trim() || submitting}
                    className={`px-4 py-1.5 ${theme.submitBtn} disabled:opacity-40 ${activeTab === 'wish' ? 'text-black' : 'text-white'} text-xs font-medium rounded-lg transition-colors`}
                  >
                    {submitting ? '保存中...' : editingId !== null ? '更新' : '追加'}
                  </button>
                </div>
              </div>
              {/* Diary section */}
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="px-4 pt-3 pb-2 border-b border-[#2a2a3a] flex items-center gap-2 shrink-0">
                  <svg className="w-4 h-4 text-[#5a5a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
                  </svg>
                  <span className="text-xs text-[#8b8b9e]">日記の未チェック</span>
                </div>
                <div className="p-3 space-y-4">
                  {(!diaryEntries || diaryEntries.length === 0) && (
                    <p className="text-xs text-[#2a2a3a] italic">日記がありません</p>
                  )}
                  {(diaryEntries ?? []).map(entry => (
                    <div key={entry.date}>
                      <div className="text-[10px] text-[#3a3a4e] font-mono px-1 mb-1">
                        {formatDateLabel(entry.date)}
                      </div>
                      <DiaryChecklist
                        date={entry.date}
                        content={entry.content}
                        onUpdated={refetchDiary}
                        flushTrigger={diaryFlush}
                        hideFaded
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Item List (active only) */}
        <div className="flex flex-col gap-2">
          {activeItems.map(item => {
            const dl = daysUntil(item.deadline)
            const isDragging = dragId === item.id
            const isDragOver = dragOverId === item.id
            const isExpanded = expandedId === item.id
            const hasDetails = !!(item.memo || item.url || item.deadline)

            return (
              <div
                key={item.id}
                draggable
                onDragStart={e => handleDragStart(e, item.id)}
                onDragOver={e => handleDragOver(e, item.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                onDrop={e => handleDrop(e, item.id)}
                onClick={() => { if (!isDragging) setExpandedId(isExpanded ? null : item.id) }}
                className={`group relative ${theme.cardBg} border ${theme.leftAccent} ${theme.cardRadius} transition-all duration-300 cursor-pointer ${
                  isDragging ? 'opacity-40 scale-[0.98]' : ''
                } ${isDragOver ? theme.cardDragOver : isExpanded
                  ? activeTab === 'wish'
                    ? 'border-amber-500/30 shadow-lg shadow-amber-500/5'
                    : 'border-teal-500/30 shadow-lg shadow-teal-500/5'
                  : theme.cardBorder
                } ${theme.cardHover}`}
              >
                <div className="flex items-start gap-3 p-4">
                  <span
                    className={`cursor-grab active:cursor-grabbing ${theme.gripColor} mt-0.5 select-none transition-colors`}
                    onClick={e => e.stopPropagation()}
                  >⠿</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleDone(item) }}
                    className={`mt-0.5 w-4.5 h-4.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      item.done
                        ? `${theme.checkDone} text-black`
                        : `border-[#3a3a4a] ${theme.checkHover}`
                    }`}
                  >
                    {!!item.done && <span className="text-[10px] leading-none">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${item.done ? 'line-through text-[#5a5a6e]' : 'text-white'}`}>
                        {item.title}
                      </span>
                      {item.price !== null && activeTab === 'wish' && (
                        <span className={`text-sm font-bold ${item.done ? 'text-[#5a5a6e]' : theme.priceColor}`}>
                          {formatPrice(item.price)}
                        </span>
                      )}
                    </div>
                    {!isExpanded && (
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {item.url && (
                          <span className="text-xs text-blue-400/70 truncate max-w-[200px]">
                            {extractDomain(item.url)}
                          </span>
                        )}
                        {dl && (
                          <span className={`text-xs ${dl.urgent ? 'text-red-400' : 'text-[#5a5a6e]'}`}>
                            {dl.text}
                          </span>
                        )}
                        {item.memo && (
                          <span className="text-xs text-[#5a5a6e] truncate max-w-[200px]">{item.memo}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {hasDetails && (
                      <div className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${
                        isExpanded
                          ? activeTab === 'wish' ? 'text-amber-400/70' : 'text-teal-400/70'
                          : 'text-[#3a3a4e] group-hover:text-[#5a5a6e]'
                      }`}>
                        <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    )}
                    <div className={`flex items-center gap-1 transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {activeTab === 'bucket' && !item.done && (
                        <button
                          onClick={e => { e.stopPropagation(); setTicketItem(item) }}
                          className="p-1.5 text-[#5a5a6e] hover:text-violet-400 transition-colors"
                          title="チケット化"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 3v4M8 3v4" />
                            <path d="M2 12h20" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); startEdit(item) }}
                        className={`p-1.5 text-[#5a5a6e] ${activeTab === 'wish' ? 'hover:text-amber-500' : 'hover:text-teal-400'} transition-colors`}
                        title="編集"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                        className="p-1.5 text-[#5a5a6e] hover:text-red-400 transition-colors"
                        title="削除"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded detail panel */}
                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  isExpanded ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  <div className={`px-4 pb-4 pt-0 border-t ${
                    activeTab === 'wish' ? 'border-amber-500/10' : 'border-teal-500/10'
                  }`}>
                    <div className="pt-3 space-y-2.5">
                      {/* URL */}
                      {item.url && (
                        <div className="flex items-center gap-2">
                          <svg className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'wish' ? 'text-amber-500/40' : 'text-teal-500/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                          </svg>
                          <a
                            href={item.url.startsWith('http') ? item.url : `https://${item.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400/80 hover:text-blue-400 transition-colors truncate"
                            onClick={e => e.stopPropagation()}
                          >
                            {item.url}
                          </a>
                        </div>
                      )}
                      {/* Deadline */}
                      {item.deadline && (
                        <div className="flex items-center gap-2">
                          <svg className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'wish' ? 'text-amber-500/40' : 'text-teal-500/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                          </svg>
                          <span className="text-xs text-[#8b8b9e]">{item.deadline}</span>
                          {dl && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                              dl.urgent
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : activeTab === 'wish'
                                  ? 'bg-amber-500/10 text-amber-400/70 border border-amber-500/15'
                                  : 'bg-teal-500/10 text-teal-400/70 border border-teal-500/15'
                            }`}>
                              {dl.text}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Price detail (wish only) */}
                      {item.price !== null && activeTab === 'wish' && (
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 shrink-0 text-amber-500/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                          </svg>
                          <span className="text-xs text-amber-400/80 font-medium">{formatPrice(item.price)}</span>
                        </div>
                      )}
                      {/* Memo */}
                      {item.memo && (
                        <div className="flex items-start gap-2 mt-1">
                          <svg className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${activeTab === 'wish' ? 'text-amber-500/40' : 'text-teal-500/40'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                          <p className="text-xs text-[#b0b0c0] leading-relaxed whitespace-pre-wrap">{item.memo}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {items && activeItems.length === 0 && doneItems.length === 0 && !showForm && (
            <div className={`text-center py-20 ${activeTab === 'wish' ? 'text-amber-500/15' : 'text-teal-500/15'}`}>
              <div className="text-6xl mb-4">{theme.emptyIcon}</div>
              <p className={`text-base font-medium mb-1 ${activeTab === 'wish' ? 'text-amber-400/40' : 'text-teal-400/40'}`}>
                {theme.emptyText}
              </p>
              <p className="text-xs text-[#3a3a4a]">
                {theme.emptySubText}
              </p>
            </div>
          )}
        </div>

        {/* Done items archive — grouped by done_at date, newest first */}
        {doneItems.length > 0 && (
          <div className="mt-6">
            <button
              onClick={() => setShowDone(v => !v)}
              className="flex items-center gap-2 text-xs text-[#5a5a6e] hover:text-[#8b8b9e] transition-colors mb-2 px-1"
            >
              <svg className={`w-3 h-3 transition-transform duration-200 ${showDone ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
              完了済み ({doneCount})
            </button>
            {showDone && (() => {
              const sorted = [...doneItems].sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''))
              const groups: { date: string; items: WishItem[] }[] = []
              for (const item of sorted) {
                const key = item.done_at ?? '不明'
                const last = groups[groups.length - 1]
                if (last && last.date === key) { last.items.push(item) }
                else { groups.push({ date: key, items: [item] }) }
              }
              return (
                <div className="space-y-3">
                  {groups.map(group => (
                    <div key={group.date}>
                      <div className="text-[10px] text-[#3a3a4e] font-mono px-1 mb-1">
                        {group.date === '不明' ? '日付不明' : group.date}
                      </div>
                      <div className="space-y-1">
                        {group.items.map(item => (
                          <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#12121a] border border-[#1e1e2a]">
                            <button
                              onClick={() => handleToggleDone(item)}
                              className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${theme.checkDone} text-black`}
                              title="完了を取り消す"
                            >
                              <span className="text-[9px] leading-none">✓</span>
                            </button>
                            <span className="text-xs text-[#5a5a6e] line-through truncate flex-1">{item.title}</span>
                            {item.price !== null && activeTab === 'wish' && (
                              <span className="text-[10px] text-[#3a3a4e]">{formatPrice(item.price)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── Right: Diary panel (desktop: side panel / mobile: bottom sheet) ── */}
      {/* Desktop side panel */}
      <div
        className="shrink-0 hidden md:block"
        style={{
          width: isEditMode ? '320px' : '0px',
          opacity: isEditMode ? 1 : 0,
          transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease',
          overflow: 'hidden',
        }}
      >
        <div
          className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] flex flex-col h-[calc(100vh-8rem)]"
          style={{
            width: '320px',
            transform: isEditMode ? 'translateX(0)' : 'translateX(24px)',
            opacity: isEditMode ? 1 : 0,
            transition: 'transform 0.4s cubic-bezier(0.4,0,0.2,1) 0.08s, opacity 0.4s ease 0.08s',
          }}
        >
          <div className="px-4 pt-4 pb-3 border-b border-[#2a2a3a] flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4 text-[#5a5a6e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <span className="text-xs text-[#8b8b9e]">日記の未チェック</span>
          </div>
          <div className="flex-1 p-3 overflow-y-auto space-y-4">
            {(!diaryEntries || diaryEntries.length === 0) && (
              <p className="text-xs text-[#2a2a3a] italic">日記がありません</p>
            )}
            {(diaryEntries ?? []).map(entry => (
              <div key={entry.date}>
                <div className="text-[10px] text-[#3a3a4e] font-mono px-1 mb-1">
                  {formatDateLabel(entry.date)}
                </div>
                <DiaryChecklist
                  date={entry.date}
                  content={entry.content}
                  onUpdated={refetchDiary}
                  flushTrigger={diaryFlush}
                  hideFaded
                />
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ── Ticket creation modal ── */}
      {ticketItem && (
        <TicketModal
          item={ticketItem}
          epics={epics}
          onClose={() => setTicketItem(null)}
          onCreate={handleCreateTicket}
        />
      )}
    </div>
  )
}

// ── Ticket Modal Component ──

function TicketModal({
  item, epics, onClose, onCreate,
}: {
  item: WishItem
  epics: Goal[]
  onClose: () => void
  onCreate: (epicId: number | 'new', newEpicTitle?: string) => Promise<void>
}) {
  const [selectedEpic, setSelectedEpic] = useState<number | 'new'>(epics[0]?.id ?? 'new')
  const [newEpicTitle, setNewEpicTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const handleSubmit = async () => {
    if (creating) return
    if (selectedEpic === 'new' && !newEpicTitle.trim()) return
    setCreating(true)
    await onCreate(selectedEpic, newEpicTitle)
    setCreating(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-[#16161e] rounded-2xl border border-[#2a2a3a] shadow-2xl w-[420px] mx-4">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-[#2a2a3a] flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 3v4M8 3v4" />
            <path d="M2 12h20" />
          </svg>
          <h3 className="text-sm font-bold text-[#e4e4ec] flex-1">チケット化</h3>
          <button onClick={onClose} className="text-[#5a5a6e] hover:text-[#e4e4ec] transition-colors text-lg leading-none">&times;</button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Item info */}
          <div className="bg-[#0e0e12] rounded-lg px-3 py-2.5 border border-[#2a2a3a]">
            <p className="text-xs text-[#5a5a6e] mb-0.5">ストーリーとして作成</p>
            <p className="text-sm text-[#e4e4ec] font-medium">{item.title}</p>
            {item.memo && <p className="text-xs text-[#5a5a6e] mt-1">{item.memo}</p>}
          </div>

          {/* Epic selection */}
          <div>
            <label className="block text-xs text-[#5a5a6e] mb-2">紐づけるEpic</label>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {epics.map(epic => (
                <button
                  key={epic.id}
                  onClick={() => setSelectedEpic(epic.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                    selectedEpic === epic.id
                      ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                      : 'border-[#2a2a3a] text-[#8b8b9e] hover:border-[#3a3a4a] hover:text-[#e4e4ec]'
                  }`}
                >
                  {epic.title}
                </button>
              ))}
              <button
                onClick={() => setSelectedEpic('new')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all border ${
                  selectedEpic === 'new'
                    ? 'bg-violet-500/10 border-violet-500/30 text-violet-300'
                    : 'border-dashed border-[#2a2a3a] text-[#5a5a6e] hover:border-violet-500/30 hover:text-violet-400'
                }`}
              >
                + 新しいEpicを作成
              </button>
            </div>
            {selectedEpic === 'new' && (
              <input
                autoFocus
                value={newEpicTitle}
                onChange={e => setNewEpicTitle(e.target.value)}
                placeholder="Epic名"
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                className="w-full mt-2 bg-[#0e0e12] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#3a3a4a] focus:border-violet-500/50 focus:outline-none transition-colors"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs text-[#5a5a6e] hover:text-[#8b8b9e] transition-colors">
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating || (selectedEpic === 'new' && !newEpicTitle.trim())}
            className="px-4 py-1.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {creating ? '作成中...' : 'チケット作成'}
          </button>
        </div>
      </div>
    </div>
  )
}
